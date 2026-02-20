import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ManualInsertSchema = z.object({
  poNumber: z.string().trim().min(1),
  itemNo: z.number().int().min(1),
  poDate: z.string().trim().min(1).nullable().optional(),
  supplier: z.string().trim().min(1).nullable().optional(),
  modeOfProcurement: z.string().trim().min(1).nullable().optional(),
  genericName: z.string().trim().min(1).nullable().optional(),
  acquisitionCost: z.number().nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  totalCost: z.number().nullable().optional(),
  brandName: z.string().trim().min(1).nullable().optional(),
  manufacturer: z.string().trim().min(1).nullable().optional(),
  deliveryStatus: z.string().trim().min(1).nullable().optional(),
  bidAttempt: z.number().int().nullable().optional(),
});

function toMoney2(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value * 100) / 100;
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ManualInsertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input. Please check required fields." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const existing = await prisma.procuredMed.findFirst({
    where: {
      poNumber: data.poNumber,
      itemNo: data.itemNo,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "PO number and item number already exist." },
      { status: 409 },
    );
  }

  const poDate = data.poDate ? new Date(`${data.poDate}T00:00:00`) : null;
  if (poDate && Number.isNaN(poDate.getTime())) {
    return NextResponse.json({ error: "Invalid PO date." }, { status: 400 });
  }

  const created = await prisma.procuredMed.create({
    data: {
      poNumber: data.poNumber,
      itemNo: data.itemNo,
      poDate,
      supplier: data.supplier ?? null,
      modeOfProcurement: data.modeOfProcurement ?? null,
      genericName: data.genericName ?? null,
      acquisitionCost: toMoney2(data.acquisitionCost),
      quantity: data.quantity ?? null,
      totalCost: toMoney2(data.totalCost),
      brandName: data.brandName ?? null,
      manufacturer: data.manufacturer ?? null,
      deliveryStatus: data.deliveryStatus ?? null,
      bidAttempt: data.bidAttempt ?? null,
    },
    select: {
      poNumber: true,
      itemNo: true,
    },
  });

  return NextResponse.json({
    message: "Inserted",
    poNumber: created.poNumber,
    itemNo: created.itemNo,
  });
}
