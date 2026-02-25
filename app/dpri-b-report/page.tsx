import { prisma } from "@/lib/prisma";
import DpriBReportTable, { type DpriBRow } from "./report-table";

function toDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function toDecimalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  const withToString = value as { toString?: () => string };
  if (typeof withToString.toString === "function") {
    const text = withToString.toString().trim();
    return text ? text : null;
  }

  return null;
}

export default async function DpriBReportPage() {
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
        itemNo: true,
        poDate: true,
        supplier: true,
        modeOfProcurement: true,
        genericName: true,
        acquisitionCost: true,
        quantity: true,
        totalCost: true,
        brandName: true,
        manufacturer: true,
        bidAttempt: true,
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

  const reportRows: DpriBRow[] = rows.map((row) => ({
    deliveryStatus:
      (inspectedByItem.get(`${row.poNumber}::${row.itemNo}`) ?? 0) <= 0
        ? "Not Delivered"
        : (row.quantity ?? 0) > 0 &&
            (inspectedByItem.get(`${row.poNumber}::${row.itemNo}`) ?? 0) >=
              (row.quantity ?? 0)
          ? "Complete"
          : "Partial",
    poNumber: row.poNumber,
    poDate: toDateOnly(row.poDate),
    supplier: row.supplier,
    modeOfProcurement: row.modeOfProcurement,
    genericName: row.genericName,
    acquisitionCost: toDecimalText(row.acquisitionCost),
    quantity: row.quantity,
    totalCost: toDecimalText(row.totalCost),
    brandName: row.brandName,
    manufacturer: row.manufacturer,
    bidAttempt: row.bidAttempt,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            DPRI-B Report
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Filter by any column using the fields under each header.
          </p>
        </section>
        <DpriBReportTable rows={reportRows} />
      </div>
    </main>
  );
}
