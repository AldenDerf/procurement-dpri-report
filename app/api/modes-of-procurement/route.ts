import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ModeRow = {
  modeOfProcurement: string | null;
};

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<ModeRow[]>`
      SELECT DISTINCT mode_of_procurement AS modeOfProcurement
      FROM procured_meds
      WHERE mode_of_procurement IS NOT NULL
        AND TRIM(mode_of_procurement) <> ''
      ORDER BY mode_of_procurement ASC
    `;

    const modes = rows
      .map((row) => row.modeOfProcurement?.trim() ?? "")
      .filter((value) => value.length > 0);

    return NextResponse.json({ modes });
  } catch {
    return NextResponse.json(
      { error: "Failed to load modes of procurement." },
      { status: 500 },
    );
  }
}
