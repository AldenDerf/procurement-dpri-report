import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatMoney(value: unknown): string {
  if (value == null) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getInspectionStatus(
  requiredQty: number,
  inspectedQty: number,
): "Complete" | "Partial" | "Not Delivered" {
  if (inspectedQty <= 0) return "Not Delivered";
  if (requiredQty > 0 && inspectedQty >= requiredQty) return "Complete";
  return "Partial";
}

export default async function PoDetailsPage({
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
      where: { poNumber },
      orderBy: { itemNo: "asc" },
    }),
    iarDelegate
      ? iarDelegate.findMany({
          where: { poNumber },
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
        >`SELECT po_number AS poNumber, item_number AS itemNumber, inspected_quantity AS inspectedQuantity FROM iar WHERE po_number = ${poNumber}`,
  ]);

  if (rows.length === 0) notFound();

  const inspectedByItem = new Map<number, number>();
  for (const iar of iarRows) {
    const existing = inspectedByItem.get(iar.itemNumber) ?? 0;
    inspectedByItem.set(iar.itemNumber, existing + (iar.inspectedQuantity ?? 0));
  }

  const first = rows[0];
  const itemStatuses = rows.map((row) => {
    const required = row.quantity ?? 0;
    const inspected = inspectedByItem.get(row.itemNo) ?? 0;
    return getInspectionStatus(required, inspected);
  });

  const completeCount = itemStatuses.filter((s) => s === "Complete").length;
  const withInspectionCount = itemStatuses.filter(
    (s) => s !== "Not Delivered",
  ).length;
  const poStatus =
    completeCount === rows.length
      ? "Complete"
      : withInspectionCount > 0
        ? "Partial"
        : "Not Delivered";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to PO List
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            PO {poNumber}
          </h1>

          <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">PO Date</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDate(first.poDate)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Supplier</p>
              <p className="mt-1 font-semibold text-slate-900">{first.supplier ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
              <p className="mt-1 font-semibold text-slate-900">{rows.length}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 font-semibold text-slate-900">{poStatus}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1300px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item No</th>
                  <th className="px-3 py-2 font-semibold">Generic</th>
                  <th className="px-3 py-2 font-semibold">Brand</th>
                  <th className="px-3 py-2 font-semibold">Manufacturer</th>
                  <th className="px-3 py-2 font-semibold">Mode</th>
                  <th className="px-3 py-2 font-semibold">Acq Cost</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Inspected Qty</th>
                  <th className="px-3 py-2 font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Inspection Status</th>
                  <th className="px-3 py-2 font-semibold">Bid Attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const required = row.quantity ?? 0;
                  const inspected = inspectedByItem.get(row.itemNo) ?? 0;
                  const inspectionStatus = getInspectionStatus(required, inspected);

                  return (
                    <tr key={`${row.poNumber}-${row.itemNo}`} className="odd:bg-white even:bg-slate-50/50">
                      <td className="px-3 py-2">{row.itemNo}</td>
                      <td className="px-3 py-2">{row.genericName ?? "-"}</td>
                      <td className="px-3 py-2">{row.brandName ?? "-"}</td>
                      <td className="px-3 py-2">{row.manufacturer ?? "-"}</td>
                      <td className="px-3 py-2">{row.modeOfProcurement ?? "-"}</td>
                      <td className="px-3 py-2">{formatMoney(row.acquisitionCost)}</td>
                      <td className="px-3 py-2">{row.quantity ?? "-"}</td>
                      <td className="px-3 py-2">{inspected}</td>
                      <td className="px-3 py-2">{formatMoney(row.totalCost)}</td>
                      <td className="px-3 py-2">{inspectionStatus}</td>
                      <td className="px-3 py-2">{row.bidAttempt ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
