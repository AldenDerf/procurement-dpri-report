import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CommitSchema = z.object({
  rows: z.array(
    z.object({
      poNumber: z.string().min(1),
      itemNo: z.number().int(),

      poDate: z.string().nullable().optional(),
      supplier: z.string().nullable().optional(),
      modeOfProcurement: z.string().nullable().optional(),

      genericName: z.string().nullable().optional(),
      acquisitionCost: z.number().nullable().optional(),
      quantity: z.number().nullable().optional(),
      totalCost: z.number().nullable().optional(),

      brandName: z.string().nullable().optional(),
      manufacturer: z.string().nullable().optional(),
      deliveryStatus: z.string().nullable().optional(),
      bidAttempt: z.number().nullable().optional(),
    }),
  ),
});

function toMoney2(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value * 100) / 100;
}

type PreparedRow = {
  poNumber: string;
  itemNo: number;
  poDate: Date | null;
  supplier: string | null;
  modeOfProcurement: string | null;
  genericName: string | null;
  acquisitionCost: number | null;
  quantity: number | null;
  totalCost: number | null;
  brandName: string | null;
  manufacturer: string | null;
  deliveryStatus: string | null;
  bidAttempt: number | null;
  rowIndex: number;
};

type CommitLog = {
  rowIndex: number;
  poNumber: string;
  itemNo: number;
  result: "inserted" | "skipped";
  reason?: "already_exists" | "duplicate_in_upload";
};

const keyOf = (poNumber: string, itemNo: number) => `${poNumber}::${itemNo}`;

function parsePoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function chunk<T>(items: T[], size: number): T[][];
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CommitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const mapped: PreparedRow[] = parsed.data.rows.map((r, idx) => ({
    poNumber: r.poNumber,
    itemNo: r.itemNo,
    poDate: parsePoDate(r.poDate),
    supplier: r.supplier ?? null,
    modeOfProcurement: r.modeOfProcurement ?? null,
    genericName: r.genericName ?? null,
    acquisitionCost: toMoney2(r.acquisitionCost),
    quantity: r.quantity ?? null,
    totalCost: toMoney2(r.totalCost),
    brandName: r.brandName ?? null,
    manufacturer: r.manufacturer ?? null,
    deliveryStatus: r.deliveryStatus ?? null,
    bidAttempt: r.bidAttempt ?? null,
    rowIndex: idx,
  }));

  const commitLogs: CommitLog[] = [];
  const dedupedRows: PreparedRow[] = [];
  const seenKeys = new Set<string>();

  for (const row of mapped) {
    const key = keyOf(row.poNumber, row.itemNo);
    if (seenKeys.has(key)) {
      commitLogs.push({
        rowIndex: row.rowIndex,
        poNumber: row.poNumber,
        itemNo: row.itemNo,
        result: "skipped",
        reason: "duplicate_in_upload",
      });
      continue;
    }
    seenKeys.add(key);
    dedupedRows.push(row);
  }

  const existingKeys = new Set<string>();
  for (const group of chunk(dedupedRows, 500)) {
    const existing = await prisma.procuredMed.findMany({
      where: {
        OR: group.map((r) => ({ poNumber: r.poNumber, itemNo: r.itemNo })),
      },
      select: {
        poNumber: true,
        itemNo: true,
      },
    });

    for (const item of existing) {
      existingKeys.add(keyOf(item.poNumber, item.itemNo));
    }
  }

  const dataToInsert = dedupedRows
    .filter((row) => !existingKeys.has(keyOf(row.poNumber, row.itemNo)))
    .map((row) => ({
      poNumber: row.poNumber,
      itemNo: row.itemNo,
      poDate: row.poDate,
      supplier: row.supplier,
      modeOfProcurement: row.modeOfProcurement,
      genericName: row.genericName,
      acquisitionCost: row.acquisitionCost,
      quantity: row.quantity,
      totalCost: row.totalCost,
      brandName: row.brandName,
      manufacturer: row.manufacturer,
      deliveryStatus: row.deliveryStatus,
      bidAttempt: row.bidAttempt,
    }));

  for (const row of dedupedRows) {
    const exists = existingKeys.has(keyOf(row.poNumber, row.itemNo));
    commitLogs.push({
      rowIndex: row.rowIndex,
      poNumber: row.poNumber,
      itemNo: row.itemNo,
      result: exists ? "skipped" : "inserted",
      reason: exists ? "already_exists" : undefined,
    });
  }

  const result = await prisma.procuredMed.createMany({
    data: dataToInsert,
  });

  const sortedLogs = commitLogs.sort((a, b) => a.rowIndex - b.rowIndex);
  const skippedCount = sortedLogs.filter((x) => x.result === "skipped").length;

  console.info("[upload-procured-meds/commit]", {
    totalReceived: mapped.length,
    insertedCount: result.count,
    skippedCount,
  });

  return NextResponse.json({
    insertedCount: result.count,
    totalReceived: mapped.length,
    skippedDuplicates: skippedCount,
    logs: sortedLogs.map(({ rowIndex, ...rest }) => rest),
  });
}
