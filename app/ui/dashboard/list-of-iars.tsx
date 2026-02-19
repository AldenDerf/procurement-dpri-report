import { prisma } from "@/lib/prisma";

type IarSummary = {
  iarNumber: string;
  dateOfInspection: Date | null;
  poNumber: string;
};

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function ListOfIars() {
  const iarDelegate = (
    prisma as unknown as {
      iar?: {
        findMany: (args: {
          select: {
            iarNumber: true;
            dateOfInspection: true;
            poNumber: true;
          };
          orderBy: Array<{ dateOfInspection: "desc" } | { iarNumber: "asc" }>;
        }) => Promise<IarSummary[]>;
      };
    }
  ).iar;

  const rows = iarDelegate
    ? await iarDelegate.findMany({
        select: {
          iarNumber: true,
          dateOfInspection: true,
          poNumber: true,
        },
        orderBy: [{ dateOfInspection: "desc" }, { iarNumber: "asc" }],
      })
    : await prisma.$queryRaw<IarSummary[]>`
        SELECT
          iar_number AS iarNumber,
          date_of_inspection AS dateOfInspection,
          po_number AS poNumber
        FROM iar
        ORDER BY date_of_inspection DESC, iar_number ASC
      `;

  const seenIars = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    if (seenIars.has(row.iarNumber)) return false;
    seenIars.add(row.iarNumber);
    return true;
  });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">List of IAR Numbers</h2>
        <p className="text-sm text-slate-600">{uniqueRows.length} unique IAR(s)</p>
      </div>

      {uniqueRows.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">No IAR records found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">IAR Number</th>
                <th className="px-4 py-3 font-semibold">Inspection Date</th>
                <th className="px-4 py-3 font-semibold">PO Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {uniqueRows.map((row, idx) => (
                <tr key={`${row.iarNumber}-${row.poNumber}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{row.iarNumber}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(row.dateOfInspection)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.poNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
