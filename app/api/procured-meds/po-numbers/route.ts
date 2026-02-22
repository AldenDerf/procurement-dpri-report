import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.procuredMed.findMany({
    select: { poNumber: true },
    distinct: ["poNumber"],
    orderBy: { poNumber: "asc" },
  });

  const poNumbers = rows
    .map((row) => row.poNumber.trim())
    .filter((value) => value.length > 0);

  return NextResponse.json({ poNumbers });
}

