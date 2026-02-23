import Link from "next/link";
import { prisma } from "@/lib/prisma";

type IarRow = {
  iarNumber: string;
  dateOfInspection: Date | null;
  itemNumber: number;
  createdAt: Date | null;
};

type IarSummary = {
  iarNumber: string;
  dateOfInspection: Date | null;
  itemsCount: number;
  createdAt: Date | null;
};

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function PoIarsPage({
  params,
}: {
  params: Promise<{ poNumber: string }>;
}) {
  const { poNumber: poParam } = await params;
  const poNumber = decodeURIComponent(poParam);

  const iarDelegate = (
    prisma as unknown as {
      iar?: {
        findMany: (args: {
          where: { poNumber: string };
          select: {
            iarNumber: true;
            dateOfInspection: true;
            itemNumber: true;
            createdAt: true;
          };
          orderBy: Array<{ createdAt: "desc" } | { iarNumber: "asc" }>;
        }) => Promise<IarRow[]>;
      };
    }
  ).iar;

  const rows = iarDelegate
    ? await iarDelegate.findMany({
        where: { poNumber },
        select: {
          iarNumber: true,
          dateOfInspection: true,
          itemNumber: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { iarNumber: "asc" }],
      })
    : await prisma.$queryRaw<IarRow[]>`
        SELECT
          iar_number AS iarNumber,
          date_of_inspection AS dateOfInspection,
          item_number AS itemNumber,
          created_at AS createdAt
        FROM iar
        WHERE po_number = ${poNumber}
        ORDER BY created_at DESC, iar_number ASC
      `;

  const grouped = new Map<string, IarSummary>();
  for (const row of rows) {
    const existing = grouped.get(row.iarNumber);
    if (!existing) {
      grouped.set(row.iarNumber, {
        iarNumber: row.iarNumber,
        dateOfInspection: row.dateOfInspection,
        itemsCount: 1,
        createdAt: row.createdAt,
      });
      continue;
    }

    existing.itemsCount += 1;
    if (!existing.dateOfInspection && row.dateOfInspection) {
      existing.dateOfInspection = row.dateOfInspection;
    }
    if (!existing.createdAt && row.createdAt) {
      existing.createdAt = row.createdAt;
    }
  }

  const summaries = Array.from(grouped.values()).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime || a.iarNumber.localeCompare(b.iarNumber);
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href={`/dashboard/${encodeURIComponent(poNumber)}`}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Back to PO Details
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                PO {poNumber} IAR List
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {summaries.length} IAR(s) found for this PO
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {summaries.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No IAR records found for this PO.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">IAR Number</th>
                    <th className="px-4 py-3 font-semibold">Date Inspected</th>
                    <th className="px-4 py-3 font-semibold">No. of Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaries.map((row) => (
                    <tr key={row.iarNumber} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{row.iarNumber}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(row.dateOfInspection)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.itemsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
