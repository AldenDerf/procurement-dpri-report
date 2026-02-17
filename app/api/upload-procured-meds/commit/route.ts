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

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CommitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data.rows.map((r) => ({
    poNumber: r.poNumber,
    itemNo: r.itemNo,
    poDate: r.poDate ? new Date(r.poDate) : null,
    supplier: r.supplier ?? null,
    modeOfProcurement: r.modeOfProcurement ?? null,
    genericName: r.genericName ?? null,
    acquisitionCost: r.acquisitionCost ?? null,
    quantity: r.quantity ?? null,
    totalCost: r.totalCost ?? null,
    brandName: r.brandName ?? null,
    manufacturer: r.manufacturer ?? null,
    deliveryStatus: r.deliveryStatus ?? null,
    bidAttempt: r.bidAttempt ?? null,
  }));

  // Uses your UNIQUE(po_number, item_no)
  const result = await prisma.procuredMed.createMany({
    data,
    skipDuplicates: true,
  });

  return NextResponse.json({
    insertedCount: result.count,
    totalReceived: data.length,
    skippedDuplicates: data.length - result.count,
  });
}
