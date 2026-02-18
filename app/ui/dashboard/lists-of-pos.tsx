import Link from "next/link";
import { prisma } from "@/lib/prisma";

type PoSummary = {
  poNumber: string;
  poDate: Date | null;
  supplier: string | null;
  itemCount: number;
  status: "Complete" | "Partial" | "Not Delivered";
};

function getInspectionStatus(
  requiredQty: number,
  inspectedQty: number,
): "Complete" | "Partial" | "Not Delivered" {
  if (inspectedQty <= 0) return "Not Delivered";
  if (requiredQty > 0 && inspectedQty >= requiredQty) return "Complete";
  return "Partial";
}

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function ListsOfPOs() {
  const iarDelegate = (
    prisma as unknown as {
      iar?: {
        findMany: (args: {
          select: {
            poNumber: true;
            itemNumber: true;
            inspectedQuantity: true;
          };
        }) => Promise<
          Array<{
            poNumber: string;
            itemNumber: number;
            inspectedQuantity: number | null;
          }>
        >;
      };
    }
  ).iar;

  const [rows, iarRows] = await Promise.all([
    prisma.procuredMed.findMany({
      select: {
        poNumber: true,
        poDate: true,
        supplier: true,
        itemNo: true,
        quantity: true,
      },
      orderBy: [{ poDate: "desc" }, { poNumber: "asc" }, { itemNo: "asc" }],
    }),
    iarDelegate
      ? iarDelegate.findMany({
          select: {
            poNumber: true,
            itemNumber: true,
            inspectedQuantity: true,
          },
        })
      : prisma.$queryRaw<
          Array<{
            poNumber: string;
            itemNumber: number;
            inspectedQuantity: number | null;
          }>
        >`SELECT po_number AS poNumber, item_number AS itemNumber, inspected_quantity AS inspectedQuantity FROM iar`,
  ]);

  const inspectedByItem = new Map<string, number>();
  for (const iar of iarRows) {
    const key = `${iar.poNumber}::${iar.itemNumber}`;
    const existing = inspectedByItem.get(key) ?? 0;
    inspectedByItem.set(key, existing + (iar.inspectedQuantity ?? 0));
  }

  const grouped = new Map<
    string,
    {
      poNumber: string;
      poDate: Date | null;
      supplier: string | null;
      itemCount: number;
      completeCount: number;
      withInspectionCount: number;
    }
  >();

  for (const row of rows) {
    const itemKey = `${row.poNumber}::${row.itemNo}`;
    const inspectedQty = inspectedByItem.get(itemKey) ?? 0;
    const requiredQty = row.quantity ?? 0;
    const itemStatus = getInspectionStatus(requiredQty, inspectedQty);
    const itemComplete = itemStatus === "Complete";
    const withInspection = itemStatus !== "Not Delivered";

    const existing = grouped.get(row.poNumber);
    if (!existing) {
      grouped.set(row.poNumber, {
        poNumber: row.poNumber,
        poDate: row.poDate ?? null,
        supplier: row.supplier ?? null,
        itemCount: 1,
        completeCount: itemComplete ? 1 : 0,
        withInspectionCount: withInspection ? 1 : 0,
      });
      continue;
    }

    existing.itemCount += 1;
    if (!existing.poDate && row.poDate) existing.poDate = row.poDate;
    if (!existing.supplier && row.supplier) existing.supplier = row.supplier;
    if (itemComplete) existing.completeCount += 1;
    if (withInspection) existing.withInspectionCount += 1;
  }

  const summaries: PoSummary[] = Array.from(grouped.values())
    .map((g) => ({
      poNumber: g.poNumber,
      poDate: g.poDate,
      supplier: g.supplier,
      itemCount: g.itemCount,
      status:
        g.completeCount === g.itemCount
          ? "Complete"
          : g.withInspectionCount > 0
            ? "Partial"
            : "Not Delivered",
    }))
    .sort((a, b) => {
      const aTime = a.poDate?.getTime() ?? 0;
      const bTime = b.poDate?.getTime() ?? 0;
      return bTime - aTime || a.poNumber.localeCompare(b.poNumber);
    });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">List of PO Numbers</h2>
        <p className="text-sm text-slate-600">{summaries.length} unique PO(s)</p>
      </div>

      {summaries.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">No PO records found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">PO Number</th>
                <th className="px-4 py-3 font-semibold">PO Date</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.map((po) => {
                const href = `/dashboard/${encodeURIComponent(po.poNumber)}`;
                return (
                  <tr key={po.poNumber} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={href} className="block font-medium text-slate-900">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="block text-slate-700">
                        {formatDate(po.poDate)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="block text-slate-700">
                        {po.supplier ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="block text-slate-700">
                        {po.itemCount}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="block">
                        <span
                          className={
                            po.status === "Complete"
                              ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : po.status === "Partial"
                                ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                                : "inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                          }
                        >
                          {po.status}
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
