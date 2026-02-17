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

export default function UploadProcuredMedsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Row[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<{ index: number; message: string }[]>(
    [],
  );
  const [status, setStatus] = useState<string>("");

  const parseFile = async () => {
    if (!file) return;

    setStatus("Parsing...");
    setErrors([]);
    setPreview([]);
    setAllRows([]);

    const fd = new FormData();
    fd.append("file", file);

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
  };

  const commitRows = async () => {
    if (allRows.length === 0) {
      setStatus("No valid rows to insert.");
      return;
    }

    setStatus("Inserting...");
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

    setStatus(
      `Done. Inserted: ${json.insertedCount}, Skipped duplicates: ${json.skippedDuplicates}`,
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1>Upload Procured Meds</h1>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <button onClick={parseFile} disabled={!file}>
          Preview
        </button>
        <button onClick={commitRows} disabled={allRows.length === 0}>
          Insert to Database
        </button>
      </div>

      <p style={{ marginTop: 12 }}>
        <b>Status:</b> {status}
      </p>

      {errors.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3>Validation Errors (Row # in Excel)</h3>
          <ul>
            {errors.slice(0, 20).map((e, i) => (
              <li key={i}>
                Row {e.index}: {e.message}
              </li>
            ))}
          </ul>
          {errors.length > 20 && <p>…and {errors.length - 20} more</p>}
        </div>
      )}

      {preview.length > 0 && (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <h3>Preview (first {preview.length} rows)</h3>
          <table
            border={1}
            cellPadding={6}
            style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Item No</th>
                <th>PO Date</th>
                <th>Supplier</th>
                <th>Mode</th>
                <th>Generic</th>
                <th>Acq Cost</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Brand</th>
                <th>Manufacturer</th>
                <th>Status</th>
                <th>Bid Attempt</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.poNumber}</td>
                  <td>{r.itemNo}</td>
                  <td>{r.poDate ?? ""}</td>
                  <td>{r.supplier ?? ""}</td>
                  <td>{r.modeOfProcurement ?? ""}</td>
                  <td>{r.genericName ?? ""}</td>
                  <td>{r.acquisitionCost ?? ""}</td>
                  <td>{r.quantity ?? ""}</td>
                  <td>{r.totalCost ?? ""}</td>
                  <td>{r.brandName ?? ""}</td>
                  <td>{r.manufacturer ?? ""}</td>
                  <td>{r.deliveryStatus ?? ""}</td>
                  <td>{r.bidAttempt ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
