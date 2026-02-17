"use client";

import { useState } from "react";

type Row = {
  poNumber: string;
  itemNo: number;
  poDate?: string | null;
  supplier?: string | null;
  modeOfProcurement?: string | null;
  genericName?: string | null;
  acquisitionCost?: number | null;
  quantity?: number | null;
  totalCost?: number | null;
  brandName?: string | null;
  manufacturer?: string | null;
  deliveryStatus?: string | null;
  bidAttempt?: number | null;
};

type CommitLog = {
  poNumber: string;
  itemNo: number;
  result: "inserted" | "skipped";
  reason?: "already_exists" | "duplicate_in_upload";
};

export default function UploadProcuredMedsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Row[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<{ index: number; message: string }[]>(
    [],
  );
  const [status, setStatus] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitLogs, setCommitLogs] = useState<CommitLog[]>([]);

  const formatMoney = (value?: number | null) =>
    value == null
      ? ""
      : value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const parseFile = async (selectedFile?: File) => {
    const fileToParse = selectedFile ?? file;
    if (!fileToParse || isParsing) return;

    setIsParsing(true);
    setStatus("Parsing...");
    setErrors([]);
    setPreview([]);
    setAllRows([]);
    setCommitLogs([]);

    try {
      const fd = new FormData();
      fd.append("file", fileToParse);

      const res = await fetch("/api/upload-procured-meds/parse", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error ?? "Parse failed");
        return;
      }

      setStatus(`Parsed. Valid: ${json.validRowsCount}/${json.totalRows}`);
      setErrors(json.errors ?? []);
      setPreview(json.preview ?? []);
      setAllRows(json.allValidRows ?? []);
    } catch {
      setStatus("Parse failed. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const commitRows = async () => {
    if (allRows.length === 0 || isCommitting) {
      setStatus("No valid rows to insert.");
      return;
    }

    setIsCommitting(true);
    setStatus("Inserting...");

    try {
      const res = await fetch("/api/upload-procured-meds/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: allRows }),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus("Insert failed");
        console.log(json);
        return;
      }

      setCommitLogs(json.logs ?? []);
      setStatus(
        `Done. Inserted: ${json.insertedCount}, Skipped duplicates: ${json.skippedDuplicates}`,
      );
    } catch {
      setStatus("Insert failed. Please try again.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Upload Procured Meds
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Upload an Excel file, preview valid rows, then commit to the
                database.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              .xlsx / .xls
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 transition hover:border-slate-400 hover:bg-slate-100">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected) {
                    void parseFile(selected);
                  } else {
                    setStatus("");
                    setErrors([]);
                    setPreview([]);
                    setAllRows([]);
                    setCommitLogs([]);
                  }
                }}
              />
              <div className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {file ? file.name : "Choose Excel file"}
                </p>
                <p className="text-xs text-slate-500">
                  {file
                    ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                    : "Click to browse from your device"}
                </p>
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  void parseFile();
                }}
                disabled={!file || isParsing || isCommitting}
                className="inline-flex min-w-32 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isParsing ? "Parsing..." : "Re-Preview"}
              </button>
              <button
                onClick={commitRows}
                disabled={allRows.length === 0 || isParsing || isCommitting}
                className="inline-flex min-w-32 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                {isCommitting ? "Inserting..." : "Insert to DB"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Valid Rows
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {allRows.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Validation Errors
            </p>
            <p className="mt-1 text-2xl font-semibold text-rose-600">
              {errors.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Preview Rows
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {preview.length}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Status:</span>{" "}
            {status || "Waiting for file upload"}
          </p>
        </section>

        {errors.length > 0 && (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <h3 className="text-lg font-semibold text-rose-900">
              Validation Errors
            </h3>
            <p className="mt-1 text-sm text-rose-700">
              Row numbers below refer to Excel row positions.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-rose-800">
              {errors.slice(0, 20).map((e, i) => (
                <li key={i} className="rounded-md bg-white/70 px-3 py-2">
                  <span className="font-semibold">Row {e.index}:</span>{" "}
                  {e.message}
                </li>
              ))}
            </ul>
            {errors.length > 20 && (
              <p className="mt-3 text-sm text-rose-700">
                ...and {errors.length - 20} more.
              </p>
            )}
          </section>
        )}

        {preview.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
              <p className="text-sm text-slate-600">
                First {preview.length} valid rows
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">PO Number</th>
                    <th className="px-3 py-2 font-semibold">Item No</th>
                    <th className="px-3 py-2 font-semibold">PO Date</th>
                    <th className="px-3 py-2 font-semibold">Supplier</th>
                    <th className="px-3 py-2 font-semibold">Mode</th>
                    <th className="px-3 py-2 font-semibold">Generic</th>
                    <th className="px-3 py-2 font-semibold">Acq Cost</th>
                    <th className="px-3 py-2 font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Total</th>
                    <th className="px-3 py-2 font-semibold">Brand</th>
                    <th className="px-3 py-2 font-semibold">Manufacturer</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Bid Attempt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                      <td className="px-3 py-2">{r.poNumber}</td>
                      <td className="px-3 py-2">{r.itemNo}</td>
                      <td className="px-3 py-2">{r.poDate ?? ""}</td>
                      <td className="px-3 py-2">{r.supplier ?? ""}</td>
                      <td className="px-3 py-2">{r.modeOfProcurement ?? ""}</td>
                      <td className="px-3 py-2">{r.genericName ?? ""}</td>
                      <td className="px-3 py-2">
                        {formatMoney(r.acquisitionCost)}
                      </td>
                      <td className="px-3 py-2">{r.quantity ?? ""}</td>
                      <td className="px-3 py-2">{formatMoney(r.totalCost)}</td>
                      <td className="px-3 py-2">{r.brandName ?? ""}</td>
                      <td className="px-3 py-2">{r.manufacturer ?? ""}</td>
                      <td className="px-3 py-2">{r.deliveryStatus ?? ""}</td>
                      <td className="px-3 py-2">{r.bidAttempt ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {commitLogs.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Insert Logs
              </h3>
              <p className="text-sm text-slate-600">
                {commitLogs.length} processed rows
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">PO Number</th>
                    <th className="px-3 py-2 font-semibold">Item No</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commitLogs.map((log, idx) => (
                    <tr key={`${log.poNumber}-${log.itemNo}-${idx}`}>
                      <td className="px-3 py-2">{log.poNumber}</td>
                      <td className="px-3 py-2">{log.itemNo}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            log.result === "inserted"
                              ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }>
                          {log.result}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {log.reason === "already_exists"
                          ? "Already exists in database"
                          : log.reason === "duplicate_in_upload"
                            ? "Duplicate in uploaded file"
                            : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
