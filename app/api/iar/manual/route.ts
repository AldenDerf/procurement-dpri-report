import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ManualIarInsertSchema = z.object({
  iarNumber: z.string().trim().min(1),
  dateOfInspection: z.string().trim().min(1),
  poNumber: z.string().trim().min(1),
  itemNumber: z.number().int().min(1),
  inspectedQuantity: z.number().int().min(0),
  requisitioningOffice: z.string().trim().min(1).nullable().optional(),
  brand: z.string().trim().min(1).nullable().optional(),
  batchLotNumber: z.string().trim().min(1).nullable().optional(),
  expirationDate: z.string().trim().min(1).nullable().optional(),
});

function parseDateOnly(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ManualIarInsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input. Please check required fields." },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const dateOfInspection = parseDateOnly(data.dateOfInspection);
    if (!dateOfInspection) {
      return NextResponse.json(
        { error: "Invalid inspection date." },
        { status: 400 },
      );
    }

    const expirationDate = data.expirationDate
      ? parseDateOnly(data.expirationDate)
      : null;
    if (data.expirationDate && !expirationDate) {
      return NextResponse.json(
        { error: "Invalid expiration date." },
        { status: 400 },
      );
    }

    const procured = await prisma.procuredMed.findFirst({
      where: {
        poNumber: data.poNumber,
        itemNo: data.itemNumber,
      },
      select: { manufacturer: true },
    });

    const manufacturer = procured?.manufacturer?.trim() || null;

    const iarDelegate = (
      prisma as unknown as {
        iar?: {
          findFirst: (args: {
            where: {
              iarNumber: string;
              poNumber: string;
              itemNumber: number;
            };
            select: { id: true };
          }) => Promise<{ id: number } | null>;
          create: (args: {
            data: {
              iarNumber: string;
              dateOfInspection: Date;
              poNumber: string;
              itemNumber: number;
              inspectedQuantity: number;
              requisitioningOffice: string | null;
              brand: string | null;
              manufacturer: string | null;
              batchLotNumber: string | null;
              expirationDate: Date | null;
            };
            select: { iarNumber: true; poNumber: true; itemNumber: true };
          }) => Promise<{ iarNumber: string; poNumber: string; itemNumber: number }>;
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

    const existing = await iarDelegate.findFirst({
      where: {
        iarNumber: data.iarNumber,
        poNumber: data.poNumber,
        itemNumber: data.itemNumber,
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "IAR number, PO number, and item number already exist." },
        { status: 409 },
      );
    }

    const created = await iarDelegate.create({
      data: {
        iarNumber: data.iarNumber,
        dateOfInspection,
        poNumber: data.poNumber,
        itemNumber: data.itemNumber,
        inspectedQuantity: data.inspectedQuantity,
        requisitioningOffice: data.requisitioningOffice ?? null,
        brand: data.brand ?? null,
        manufacturer,
        batchLotNumber: data.batchLotNumber ?? null,
        expirationDate: expirationDate ?? null,
      },
      select: {
        iarNumber: true,
        poNumber: true,
        itemNumber: true,
      },
    });

    return NextResponse.json({
      message: "Inserted",
      iarNumber: created.iarNumber,
      poNumber: created.poNumber,
      itemNumber: created.itemNumber,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while inserting manual IAR.",
      },
      { status: 500 },
    );
  }
}
