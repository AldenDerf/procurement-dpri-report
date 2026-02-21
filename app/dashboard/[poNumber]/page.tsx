
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

function statusBadgeClass(status: "Complete" | "Partial" | "Not Delivered") {
  if (status === "Complete") {
    return "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700";
  }
  if (status === "Partial") {
    return "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700";
  }
  return "inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700";
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
            brand: true;
          };
        }) => Promise<
          Array<{
            poNumber: string;
            itemNumber: number;
            inspectedQuantity: number | null;
            brand: string | null;
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
            brand: true,
          },
        })
      : prisma.$queryRaw<
          Array<{
            poNumber: string;
            itemNumber: number;
            inspectedQuantity: number | null;
            brand: string | null;
          }>
        >`SELECT po_number AS poNumber, item_number AS itemNumber, inspected_quantity AS inspectedQuantity, brand AS brand FROM iar WHERE po_number = ${poNumber}`,
  ]);

  if (rows.length === 0) notFound();

  const inspectedByItem = new Map<number, number>();
  const iarBrandByItem = new Map<number, string>();
  for (const iar of iarRows) {
    const existing = inspectedByItem.get(iar.itemNumber) ?? 0;
    inspectedByItem.set(iar.itemNumber, existing + (iar.inspectedQuantity ?? 0));
    const brand = iar.brand?.trim();
    if (brand && !iarBrandByItem.has(iar.itemNumber)) {
      iarBrandByItem.set(iar.itemNumber, brand);
    }
  }

  const first = rows[0];
  const itemStatuses = rows.map((row) => {
    const required = row.quantity ?? 0;
    const inspected = inspectedByItem.get(row.itemNo) ?? 0;
    return getInspectionStatus(required, inspected);
  });

  const completeCount = itemStatuses.filter((s) => s === "Complete").length;
  const partialCount = itemStatuses.filter((s) => s === "Partial").length;
  const notDeliveredCount = itemStatuses.filter(
    (s) => s === "Not Delivered",
  ).length;
  const withInspectionCount = itemStatuses.filter(
    (s) => s !== "Not Delivered",
  ).length;
  const poStatus =
    completeCount === rows.length
      ? "Complete"
      : withInspectionCount > 0
        ? "Partial"
        : "Not Delivered";

  const rowsWithStatus = rows.map((row) => {
    const required = row.quantity ?? 0;
    const inspected = inspectedByItem.get(row.itemNo) ?? 0;
    const inspectionStatus = getInspectionStatus(required, inspected);
    const displayBrand = iarBrandByItem.get(row.itemNo) ?? row.brandName ?? "-";
    return {
      row,
      inspected,
      inspectionStatus,
      displayBrand,
    };
  });

  const completedRows = rowsWithStatus.filter(
    (x) => x.inspectionStatus === "Complete",
  );
  const partialRows = rowsWithStatus.filter((x) => x.inspectionStatus === "Partial");
  const notDeliveredRows = rowsWithStatus.filter(
    (x) => x.inspectionStatus === "Not Delivered",
  );

  const renderStatusTable = (
    title: "Complete" | "Partial" | "Not Delivered",
    data: Array<{
      row: (typeof rows)[number];
      inspected: number;
      inspectionStatus: "Complete" | "Partial" | "Not Delivered";
      displayBrand: string;
    }>,
  ) => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{data.length} item(s)</p>
      </div>
      <div className="h-[360px] overflow-x-auto overflow-y-auto">
        <table className="min-w-[1300px] w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
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
            {data.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={11}>
                  No items under {title.toLowerCase()}.
                </td>
              </tr>
            ) : (
              data.map(({ row, inspected, inspectionStatus, displayBrand }) => (
                <tr key={`${row.poNumber}-${row.itemNo}`} className="odd:bg-white even:bg-slate-50/50">
                  <td className="px-3 py-2">{row.itemNo}</td>
                  <td className="px-3 py-2">{row.genericName ?? "-"}</td>
                  <td className="px-3 py-2">{displayBrand}</td>
                  <td className="px-3 py-2">{row.manufacturer ?? "-"}</td>
                  <td className="px-3 py-2">{row.modeOfProcurement ?? "-"}</td>
                  <td className="px-3 py-2">{formatMoney(row.acquisitionCost)}</td>
                  <td className="px-3 py-2">{row.quantity ?? "-"}</td>
                  <td className="px-3 py-2">{inspected}</td>
                  <td className="px-3 py-2">{formatMoney(row.totalCost)}</td>
                  <td className="px-3 py-2">
                    <span className={statusBadgeClass(inspectionStatus)}>
                      {inspectionStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.bidAttempt ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

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
              <p className="mt-1">
                <span className={statusBadgeClass(poStatus)}>{poStatus}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
              <span className="font-semibold">Complete:</span> {completeCount}
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800">
              <span className="font-semibold">Partial:</span> {partialCount}
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-800">
              <span className="font-semibold">Not Delivered:</span>{" "}
              {notDeliveredCount}
            </div>
          </div>
        </section>

        {renderStatusTable("Complete", completedRows)}
        {renderStatusTable("Partial", partialRows)}
        {renderStatusTable("Not Delivered", notDeliveredRows)}
      </div>
    </main>
  );
}
