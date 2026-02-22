import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";

const RowSchema = z.object({
  iarNumber: z.string().min(1),
  dateOfInspection: z.string().min(1),
  poNumber: z.string().min(1),
  itemNumber: z.number().int().nonnegative(),
  inspectedQuantity: z.number().int().nonnegative(),

  requisitioningOffice: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  batchLotNumber: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
});

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  const toYyyyMmDd = (year: number, month: number, day: number) =>
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      const month = Number(mmddyyyy[1]);
      const day = Number(mmddyyyy[2]);
      const year = Number(mmddyyyy[3]);
      return toYyyyMmDd(year, month, day);
    }

    const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmdd) {
      return toYyyyMmDd(
        Number(yyyymmdd[1]),
        Number(yyyymmdd[2]),
        Number(yyyymmdd[3]),
      );
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toYyyyMmDd(
        parsed.getFullYear(),
        parsed.getMonth() + 1,
        parsed.getDate(),
      );
    }
    return trimmed;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toYyyyMmDd(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return toYyyyMmDd(d.y, d.m, d.d);
  }

  return null;
}

function normalizeExpiry(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const monthYear = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    const year = Number(monthYear[2]);
    if (month >= 1 && month <= 12) {
      const date = new Date(Date.UTC(year, month - 1, 1));
      return date.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function parseParticulars(raw: unknown): {
  brand: string | null;
  batchLotNumber: string | null;
  expirationDate: string | null;
} {
  const particulars = cleanText(raw);
  if (!particulars) {
    return { brand: null, batchLotNumber: null, expirationDate: null };
  }

  const brand = particulars.match(/"([^"]+)"/)?.[1]?.trim() ?? null;
  const lines = particulars
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let batchRaw =
    particulars.match(/\b(?:B\/L|Batch|Lot)\.?\s*:\s*([^;,\n]+)/i)?.[1]?.trim() ??
    null;

  if (!batchRaw) {
    const likelyBatch = lines.find(
      (line) =>
        /[0-9]/.test(line) &&
        /^[A-Za-z0-9-]{5,}$/.test(line) &&
        !/^\d{1,2}\/\d{4}$/.test(line) &&
        !/^\d{4}-\d{1,2}-\d{1,2}$/.test(line),
    );
    batchRaw = likelyBatch ?? null;
  }

  let expiryRaw =
    particulars.match(/\b(?:Exp|Expiry|Expiration)\.?\s*:\s*([^;,\n]+)/i)?.[1]?.trim() ??
    null;

  if (!expiryRaw) {
    const inlineDate =
      particulars.match(/\b(0?[1-9]|1[0-2])\/\d{4}\b/)?.[0] ??
      particulars.match(/\b\d{4}-\d{1,2}-\d{1,2}\b/)?.[0] ??
      null;
    expiryRaw = inlineDate;
  }

  return {
    brand,
    batchLotNumber: batchRaw,
    expirationDate: normalizeExpiry(expiryRaw),
  };
}

function normalizeInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const raw = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  const get = (row: Record<string, unknown>, key: string) => {
    const found = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === key.trim().toLowerCase(),
    );
    return found ? row[found] : null;
  };

  const mapped = rawRows
    .filter((r) => Object.keys(r).length > 0)
    .map((r) => {
      const particulars = parseParticulars(get(r, "Particulars"));

      return {
        iarNumber: String(get(r, "IAR No") ?? get(r, "IAR Number") ?? "").trim(),
        dateOfInspection: normalizeDate(get(r, "Date of Inspection")),
        poNumber: String(get(r, "PO Number") ?? "").trim(),
        itemNumber: normalizeInt(
          get(r, "Item Number") ??
            get(r, "Item No") ??
            get(r, "Item") ??
            get(r, "Item #"),
        ),
        inspectedQuantity: normalizeInt(
          get(r, "Quantity") ??
            get(r, "Inspected Quantity") ??
            get(r, "Qty"),
        ),

        requisitioningOffice: cleanText(get(r, "Requisitioning Office")),
        brand: particulars.brand,
        batchLotNumber: particulars.batchLotNumber,
        expirationDate: particulars.expirationDate,
      };
    });

  const errors: { index: number; message: string }[] = [];
  const validRows: z.infer<typeof RowSchema>[] = [];

  mapped.forEach((row, i) => {
    const parsed = RowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({
        index: i + 2,
        message: parsed.error.issues
          .map((x) => {
            const field = x.path[0] ? `${x.path[0]}: ` : "";
            return `${field}${x.message}`;
          })
          .join(", "),
      });
      return;
    }

    validRows.push(parsed.data);
  });

  return NextResponse.json({
    sheet: sheetName,
    totalRows: mapped.length,
    validRowsCount: validRows.length,
    errors,
    preview: validRows.slice(0, 200),
    allValidRows: validRows,
  });
}
