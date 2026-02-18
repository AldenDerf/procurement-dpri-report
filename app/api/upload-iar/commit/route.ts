import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CommitSchema = z.object({
  rows: z.array(
    z.object({
      iarNumber: z.string().min(1),
      dateOfInspection: z.string().min(1),
      poNumber: z.string().min(1),
      itemNumber: z.number().int(),
      inspectedQuantity: z.number().int().nonnegative(),

      requisitioningOffice: z.string().nullable().optional(),
      brand: z.string().nullable().optional(),
      batchLotNumber: z.string().nullable().optional(),
      expirationDate: z.string().nullable().optional(),
    }),
  ),
});

type PreparedRow = {
  iarNumber: string;
  dateOfInspection: Date;
  poNumber: string;
  itemNumber: number;
  inspectedQuantity: number;
  requisitioningOffice: string | null;
  brand: string | null;
  batchLotNumber: string | null;
  expirationDate: Date | null;
  rowIndex: number;
};

type CommitLog = {
  rowIndex: number;
  iarNumber: string;
  poNumber: string;
  itemNumber: number;
  result: "inserted" | "skipped";
  reason?: "already_exists" | "duplicate_in_upload";
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const keyOf = (iarNumber: string, poNumber: string, itemNumber: number) =>
  `${iarNumber}::${poNumber}::${itemNumber}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CommitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const iarDelegate = (
      prisma as unknown as {
        iar?: {
          findMany: typeof prisma.procuredMed.findMany;
          createMany: typeof prisma.procuredMed.createMany;
        };
      }
    ).iar;

    if (!iarDelegate) {
      return NextResponse.json(
        {
          error:
            "Prisma client has no IAR model loaded. Run `pnpm prisma generate` and restart `pnpm dev`.",
        },
        { status: 500 },
      );
    }

    const mapped: PreparedRow[] = [];
    for (const [idx, r] of parsed.data.rows.entries()) {
      const inspectionDate = new Date(r.dateOfInspection);
      if (Number.isNaN(inspectionDate.getTime())) {
        return NextResponse.json(
          { error: `Invalid inspection date at row ${idx + 2}: ${r.dateOfInspection}` },
          { status: 400 },
        );
      }

      let expirationDate: Date | null = null;
      if (r.expirationDate) {
        const exp = new Date(r.expirationDate);
        if (Number.isNaN(exp.getTime())) {
          return NextResponse.json(
            { error: `Invalid expiration date at row ${idx + 2}: ${r.expirationDate}` },
            { status: 400 },
          );
        }
        expirationDate = exp;
      }

      mapped.push({
        iarNumber: r.iarNumber.trim(),
        dateOfInspection: inspectionDate,
        poNumber: r.poNumber.trim(),
        itemNumber: r.itemNumber,
        inspectedQuantity: r.inspectedQuantity,
        requisitioningOffice: r.requisitioningOffice ?? null,
        brand: r.brand ?? null,
        batchLotNumber: r.batchLotNumber ?? null,
        expirationDate,
        rowIndex: idx,
      });
    }

    const logs: CommitLog[] = [];
    const dedupedRows: PreparedRow[] = [];
    const seen = new Set<string>();

    for (const row of mapped) {
      const key = keyOf(row.iarNumber, row.poNumber, row.itemNumber);
      if (seen.has(key)) {
        logs.push({
          rowIndex: row.rowIndex,
          iarNumber: row.iarNumber,
          poNumber: row.poNumber,
          itemNumber: row.itemNumber,
          result: "skipped",
          reason: "duplicate_in_upload",
        });
        continue;
      }

      seen.add(key);
      dedupedRows.push(row);
    }

    const existing = new Set<string>();

    for (const group of chunk(dedupedRows, 500)) {
      const found = await iarDelegate.findMany({
        where: {
          OR: group.map((r) => ({
            iarNumber: r.iarNumber,
            poNumber: r.poNumber,
            itemNumber: r.itemNumber,
          })),
        },
        select: {
          iarNumber: true,
          poNumber: true,
          itemNumber: true,
        },
      });

      for (const row of found as Array<{ iarNumber: string; poNumber: string; itemNumber: number }>) {
        existing.add(keyOf(row.iarNumber, row.poNumber, row.itemNumber));
      }
    }

    const dataToInsert = dedupedRows
      .filter(
        (row) => !existing.has(keyOf(row.iarNumber, row.poNumber, row.itemNumber)),
      )
      .map((row) => ({
        iarNumber: row.iarNumber,
        dateOfInspection: row.dateOfInspection,
        poNumber: row.poNumber,
        itemNumber: row.itemNumber,
        inspectedQuantity: row.inspectedQuantity,
        requisitioningOffice: row.requisitioningOffice,
        brand: row.brand,
        batchLotNumber: row.batchLotNumber,
        expirationDate: row.expirationDate,
      }));

    for (const row of dedupedRows) {
      const alreadyExists = existing.has(
        keyOf(row.iarNumber, row.poNumber, row.itemNumber),
      );

      logs.push({
        rowIndex: row.rowIndex,
        iarNumber: row.iarNumber,
        poNumber: row.poNumber,
        itemNumber: row.itemNumber,
        result: alreadyExists ? "skipped" : "inserted",
        reason: alreadyExists ? "already_exists" : undefined,
      });
    }

    const result = await iarDelegate.createMany({ data: dataToInsert });
    const sortedLogs = logs.sort((a, b) => a.rowIndex - b.rowIndex);
    const skipped = sortedLogs.filter((x) => x.result === "skipped").length;

    return NextResponse.json({
      insertedCount: result.count,
      totalReceived: mapped.length,
      skippedDuplicates: skipped,
      logs: sortedLogs.map((log) => ({
        iarNumber: log.iarNumber,
        poNumber: log.poNumber,
        itemNumber: log.itemNumber,
        result: log.result,
        reason: log.reason,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while inserting IAR records.",
      },
      { status: 500 },
    );
  }
}
