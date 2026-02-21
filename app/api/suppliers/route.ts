import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SupplierRow = {
  supplier: string | null;
};

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<SupplierRow[]>`
      SELECT DISTINCT supplier
      FROM database_suplier
      WHERE supplier IS NOT NULL
        AND TRIM(supplier) <> ''
      ORDER BY supplier ASC
    `;

    const suppliers = rows
      .map((row) => row.supplier?.trim() ?? "")
      .filter((value) => value.length > 0);

    return NextResponse.json({ suppliers });
  } catch {
    return NextResponse.json(
      { error: "Failed to load suppliers." },
      { status: 500 },
    );
  }
}
