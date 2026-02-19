"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  iarNumber: string;
  dateOfInspection: string;
  poNumber: string;
  itemNumber: number;
  inspectedQuantity: number;

  requisitioningOffice?: string | null;
  brand?: string | null;
  batchLotNumber?: string | null;
  expirationDate?: string | null;
};

type CommitLog = {
  iarNumber: string;
  poNumber: string;
  itemNumber: number;
  result: "inserted" | "skipped";
  reason?: "already_exists" | "duplicate_in_upload";
};

export default function UploadIarPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Row[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<{ index: number; message: string }[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitLogs, setCommitLogs] = useState<CommitLog[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [insertedCount, setInsertedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const parseFile = async (selectedFile?: File) => {
    const fileToParse = selectedFile ?? file;
    if (!fileToParse || isParsing) return;

    setIsParsing(true);
    setStatus("Parsing...");
    setErrors([]);
    setPreview([]);
    setAllRows([]);
    setCommitLogs([]);
    setShowSuccessModal(false);
    setInsertedCount(0);
    setSkippedCount(0);

    try {
      const fd = new FormData();
      fd.append("file", fileToParse);

      const res = await fetch("/api/upload-iar/parse", {
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
      const res = await fetch("/api/upload-iar/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: allRows }),
      });

      const text = await res.text();
      let json: { [key: string]: unknown } | null = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        const message =
          json?.error ??
          json?.message ??
          `Insert failed (HTTP ${res.status})`;
        setStatus(String(message));
        return;
      }

      const logs = Array.isArray(json?.logs) ? (json.logs as CommitLog[]) : [];
      const inserted = Number(json?.insertedCount ?? 0);
      const skipped = Number(json?.skippedDuplicates ?? 0);

      setCommitLogs(logs);
      setInsertedCount(inserted);
      setSkippedCount(skipped);
      setShowSuccessModal(inserted > 0);
      setStatus(`Done. Inserted: ${inserted}, Skipped duplicates: ${skipped}`);
    } catch {
      setStatus("Insert failed. Please try again.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-success-title"
            className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="upload-success-title" className="text-lg font-semibold text-slate-900">
                IAR Upload Result
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Inserted: {insertedCount}, Skipped: {skippedCount}
              </p>
            </div>

            <div className="max-h-[55vh] overflow-auto px-5 py-4">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">IAR No</th>
                    <th className="px-3 py-2 font-semibold">PO Number</th>
                    <th className="px-3 py-2 font-semibold">Item Number</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commitLogs
                    .filter((log) => log.result === "inserted")
                    .map((log, idx) => (
                      <tr key={`${log.iarNumber}-${log.poNumber}-${log.itemNumber}-${idx}`}>
                        <td className="px-3 py-2">{log.iarNumber}</td>
                        <td className="px-3 py-2">{log.poNumber}</td>
                        <td className="px-3 py-2">{log.itemNumber}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            inserted
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push("/dashboard");
                }}
                className="inline-flex min-w-24 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Upload IAR
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Upload IAR Excel, preview parsed rows, then insert to database.
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
                    setShowSuccessModal(false);
                    setInsertedCount(0);
                    setSkippedCount(0);
                  }
                }}
              />
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

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Status:</span>{" "}
            {status || "Waiting for file upload"}
          </p>
        </section>

        {errors.length > 0 && (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <h3 className="text-lg font-semibold text-rose-900">Validation Errors</h3>
            <ul className="mt-4 space-y-2 text-sm text-rose-800">
              {errors.slice(0, 20).map((e, i) => (
                <li key={i} className="rounded-md bg-white/70 px-3 py-2">
                  <span className="font-semibold">Row {e.index}:</span> {e.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        {preview.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
              <p className="text-sm text-slate-600">First {preview.length} valid rows</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">IAR No</th>
                    <th className="px-3 py-2 font-semibold">Inspection Date</th>
                    <th className="px-3 py-2 font-semibold">PO Number</th>
                    <th className="px-3 py-2 font-semibold">Item Number</th>
                    <th className="px-3 py-2 font-semibold">Brand</th>
                    <th className="px-3 py-2 font-semibold">Batch/Lot</th>
                    <th className="px-3 py-2 font-semibold">Expiration</th>
                    <th className="px-3 py-2 font-semibold">Quantity</th>
                    <th className="px-3 py-2 font-semibold">Req Office</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                      <td className="px-3 py-2">{r.iarNumber}</td>
                      <td className="px-3 py-2">{r.dateOfInspection}</td>
                      <td className="px-3 py-2">{r.poNumber}</td>
                      <td className="px-3 py-2">{r.itemNumber}</td>
                      <td className="px-3 py-2">{r.brand ?? "-"}</td>
                      <td className="px-3 py-2">{r.batchLotNumber ?? "-"}</td>
                      <td className="px-3 py-2">{r.expirationDate ?? "-"}</td>
                      <td className="px-3 py-2">{r.inspectedQuantity}</td>
                      <td className="px-3 py-2">{r.requisitioningOffice ?? "-"}</td>
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
              <h3 className="text-lg font-semibold text-slate-900">Insert Logs</h3>
              <p className="text-sm text-slate-600">{commitLogs.length} processed rows</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">IAR No</th>
                    <th className="px-3 py-2 font-semibold">PO Number</th>
                    <th className="px-3 py-2 font-semibold">Item Number</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commitLogs.map((log, idx) => (
                    <tr key={`${log.iarNumber}-${log.poNumber}-${log.itemNumber}-${idx}`}>
                      <td className="px-3 py-2">{log.iarNumber}</td>
                      <td className="px-3 py-2">{log.poNumber}</td>
                      <td className="px-3 py-2">{log.itemNumber}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            log.result === "inserted"
                              ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }
                        >
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
