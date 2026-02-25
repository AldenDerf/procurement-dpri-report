"use client";

import { useMemo, useState } from "react";

export type DpriBRow = {
  poNumber: string;
  poDate: string | null;
  supplier: string | null;
  modeOfProcurement: string | null;
  genericName: string | null;
  acquisitionCost: unknown;
  quantity: number | null;
  totalCost: unknown;
  brandName: string | null;
  manufacturer: string | null;
  deliveryStatus: "Complete" | "Partial" | "Not Delivered";
  bidAttempt: number | null;
};

type FilterState = {
  poNumber: string;
  poDate: string;
  supplier: string;
  modeOfProcurement: string;
  genericName: string;
  acquisitionCost: string;
  quantity: string;
  totalCost: string;
  brandName: string;
  manufacturer: string;
  deliveryStatus: string;
  bidAttempt: string;
};

const initialFilters: FilterState = {
  poNumber: "",
  poDate: "",
  supplier: "",
  modeOfProcurement: "",
  genericName: "",
  acquisitionCost: "",
  quantity: "",
  totalCost: "",
  brandName: "",
  manufacturer: "",
  deliveryStatus: "",
  bidAttempt: "",
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function money(value: unknown): string {
  if (!value) return "-";
  const raw = String(value).replace(/,/g, "").trim();
  if (!raw) return "-";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseNumeric(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).replace(/,/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function effectiveAcquisitionCost(row: DpriBRow): number | null {
  const direct = parseNumeric(row.acquisitionCost);
  if (direct != null) return direct;
  const total = parseNumeric(row.totalCost);
  const qty = row.quantity;
  if (total == null || qty == null || qty <= 0) return null;
  return total / qty;
}

function dateText(value: string | null): string {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function DpriBReportTable({ rows }: { rows: DpriBRow[] }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isExporting, setIsExporting] = useState(false);
  const hasActiveFilters = Object.values(filters).some(
    (value) => value.trim() !== "",
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const checks: Array<[string, string]> = [
        [text(row.poNumber), filters.poNumber],
        [text(row.poDate), filters.poDate],
        [text(row.supplier), filters.supplier],
        [text(row.modeOfProcurement), filters.modeOfProcurement],
        [text(row.genericName), filters.genericName],
        [text(effectiveAcquisitionCost(row) ?? row.acquisitionCost), filters.acquisitionCost],
        [text(row.quantity), filters.quantity],
        [text(row.totalCost), filters.totalCost],
        [text(row.brandName), filters.brandName],
        [text(row.manufacturer), filters.manufacturer],
        [text(row.deliveryStatus), filters.deliveryStatus],
        [text(row.bidAttempt), filters.bidAttempt],
      ];

      return checks.every(([value, needle]) =>
        value.toLowerCase().includes(needle.trim().toLowerCase()),
      );
    });
  }, [filters, rows]);

  const exportToExcel = async () => {
    if (filteredRows.length === 0 || isExporting) return;

    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");

      const exportRows = filteredRows.map((row) => ({
        "PO Number": row.poNumber,
        "PO Date": dateText(row.poDate),
        Supplier: row.supplier ?? "",
        "Mode of Procurement": row.modeOfProcurement ?? "",
        "Generic Name of Medicine with Strength Dosage / Form":
          row.genericName ?? "",
        "Acquisition Cost": money(effectiveAcquisitionCost(row) ?? row.acquisitionCost),
        Quantity: row.quantity ?? "",
        "Total Cost": money(row.totalCost),
        "Brand Name": row.brandName ?? "",
        Manufacturer: row.manufacturer ?? "",
        "Delivery Status": row.deliveryStatus,
        "Bid Attempt": row.bidAttempt ?? "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DPRI-B Report");
      XLSX.writeFile(workbook, `dpri-b-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-black shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">DPRI-B Table</h2>
        <p className="text-sm text-slate-600">
          Showing {filteredRows.length} of {rows.length}
        </p>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Filters</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredRows.length === 0 || isExporting}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Export to Excel"}
            </button>
            <button
              type="button"
              onClick={() => setFilters(initialFilters)}
              disabled={!hasActiveFilters}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1 text-xs text-slate-600">
            <span>PO Number</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.poNumber} onChange={(e) => setFilters((p) => ({ ...p, poNumber: e.target.value }))} placeholder="e.g. 25030079" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>PO Date</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.poDate} onChange={(e) => setFilters((p) => ({ ...p, poDate: e.target.value }))} placeholder="YYYY-MM-DD or text" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Supplier</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} placeholder="Supplier name" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Mode of Procurement</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.modeOfProcurement} onChange={(e) => setFilters((p) => ({ ...p, modeOfProcurement: e.target.value }))} placeholder="Mode" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Generic Name</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.genericName} onChange={(e) => setFilters((p) => ({ ...p, genericName: e.target.value }))} placeholder="Generic / dosage / form" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Acquisition Cost</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.acquisitionCost} onChange={(e) => setFilters((p) => ({ ...p, acquisitionCost: e.target.value }))} placeholder="Amount" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Quantity</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.quantity} onChange={(e) => setFilters((p) => ({ ...p, quantity: e.target.value }))} placeholder="Quantity" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Total Cost</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.totalCost} onChange={(e) => setFilters((p) => ({ ...p, totalCost: e.target.value }))} placeholder="Amount" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Brand Name</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.brandName} onChange={(e) => setFilters((p) => ({ ...p, brandName: e.target.value }))} placeholder="Brand" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Manufacturer</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.manufacturer} onChange={(e) => setFilters((p) => ({ ...p, manufacturer: e.target.value }))} placeholder="Manufacturer" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Delivery Status</span>
            <select className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.deliveryStatus} onChange={(e) => setFilters((p) => ({ ...p, deliveryStatus: e.target.value }))}>
              <option value="">All</option>
              <option value="Complete">Complete</option>
              <option value="Partial">Partial</option>
              <option value="Not Delivered">Not Delivered</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Bid Attempt</span>
            <input className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" value={filters.bidAttempt} onChange={(e) => setFilters((p) => ({ ...p, bidAttempt: e.target.value }))} placeholder="Bid attempt" />
          </label>
        </div>
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="min-w-[1700px] w-full border-collapse text-left text-sm text-black">
          <thead className="sticky top-0 z-20 bg-slate-200 text-black shadow-md">
            <tr className="text-sm">
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">PO Number</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">PO Date</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Supplier</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Mode of Procurement</th>
              <th className="px-3 py-3 font-semibold min-w-[260px] text-black">
                Generic Name of Medicine with Strength Dosage / Form
              </th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Acquisition Cost</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Quantity</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Total Cost</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Brand Name</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Manufacturer</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Delivery Status</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-black">Bid Attempt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={12}>
                  No rows matched your filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={`${row.poNumber}-${idx}`} className="odd:bg-white even:bg-slate-50/50">
                  <td className="px-3 py-2">{row.poNumber}</td>
                  <td className="px-3 py-2">{dateText(row.poDate)}</td>
                  <td className="px-3 py-2">{row.supplier ?? "-"}</td>
                  <td className="px-3 py-2">{row.modeOfProcurement ?? "-"}</td>
                  <td className="px-3 py-2">{row.genericName ?? "-"}</td>
                  <td className="px-3 py-2">{money(effectiveAcquisitionCost(row) ?? row.acquisitionCost)}</td>
                  <td className="px-3 py-2">{row.quantity ?? "-"}</td>
                  <td className="px-3 py-2">{money(row.totalCost)}</td>
                  <td className="px-3 py-2">{row.brandName ?? "-"}</td>
                  <td className="px-3 py-2">{row.manufacturer ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.deliveryStatus === "Complete"
                          ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          : row.deliveryStatus === "Partial"
                            ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                            : "inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                      }
                    >
                      {row.deliveryStatus}
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
}
