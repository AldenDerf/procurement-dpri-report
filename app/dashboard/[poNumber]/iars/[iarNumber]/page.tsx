import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type IarItemRow = {
  iarNumber: string;
  poNumber: string;
  dateOfInspection: Date | null;
  itemNumber: number;
  inspectedQuantity: number;
  brand: string | null;
  batchLotNumber: string | null;
  expirationDate: Date | null;
  requisitioningOffice: string | null;
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

export default async function IarItemsPage({
  params,
}: {
  params: Promise<{ poNumber: string; iarNumber: string }>;
}) {
  const { poNumber: poParam, iarNumber: iarParam } = await params;
  const poNumber = decodeURIComponent(poParam);
  const iarNumber = decodeURIComponent(iarParam);

  const iarDelegate = (
    prisma as unknown as {
      iar?: {
        findMany: (args: {
          where: { poNumber: string; iarNumber: string };
          select: {
            iarNumber: true;
            poNumber: true;
            dateOfInspection: true;
            itemNumber: true;
            inspectedQuantity: true;
            brand: true;
            batchLotNumber: true;
            expirationDate: true;
            requisitioningOffice: true;
            createdAt: true;
          };
          orderBy: Array<{ itemNumber: "asc" } | { createdAt: "asc" }>;
        }) => Promise<IarItemRow[]>;
      };
    }
  ).iar;

  const rows = iarDelegate
    ? await iarDelegate.findMany({
        where: { poNumber, iarNumber },
        select: {
          iarNumber: true,
          poNumber: true,
          dateOfInspection: true,
          itemNumber: true,
          inspectedQuantity: true,
          brand: true,
          batchLotNumber: true,
          expirationDate: true,
          requisitioningOffice: true,
          createdAt: true,
        },
        orderBy: [{ itemNumber: "asc" }, { createdAt: "asc" }],
      })
    : await prisma.$queryRaw<IarItemRow[]>`
        SELECT
          iar_number AS iarNumber,
          po_number AS poNumber,
          date_of_inspection AS dateOfInspection,
          item_number AS itemNumber,
          inspected_quantity AS inspectedQuantity,
          brand AS brand,
          batch_lot_number AS batchLotNumber,
          expiration_date AS expirationDate,
          requisitioning_office AS requisitioningOffice,
          created_at AS createdAt
        FROM iar
        WHERE po_number = ${poNumber} AND iar_number = ${iarNumber}
        ORDER BY item_number ASC, created_at ASC
      `;

  if (rows.length === 0) notFound();

  const inspectedTotal = rows.reduce((sum, row) => sum + (row.inspectedQuantity ?? 0), 0);
  const inspectionDate = rows[0]?.dateOfInspection ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Link
            href={`/dashboard/${encodeURIComponent(poNumber)}/iars`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to IAR List
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            IAR {iarNumber}
          </h1>

          <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">PO Number</p>
              <p className="mt-1 font-semibold text-slate-900">{poNumber}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Date Inspected</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDate(inspectionDate)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
              <p className="mt-1 font-semibold text-slate-900">{rows.length}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Total Inspected Qty
              </p>
              <p className="mt-1 font-semibold text-slate-900">{inspectedTotal}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item No</th>
                  <th className="px-4 py-3 font-semibold">Inspected Qty</th>
                  <th className="px-4 py-3 font-semibold">Brand</th>
                  <th className="px-4 py-3 font-semibold">Batch/Lot</th>
                  <th className="px-4 py-3 font-semibold">Expiration Date</th>
                  <th className="px-4 py-3 font-semibold">Requisitioning Office</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={`${row.iarNumber}-${row.poNumber}-${row.itemNumber}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-900">{row.itemNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{row.inspectedQuantity}</td>
                    <td className="px-4 py-3 text-slate-700">{row.brand ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.batchLotNumber ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(row.expirationDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.requisitioningOffice ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
