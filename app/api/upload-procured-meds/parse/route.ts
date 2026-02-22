//Parse endpoint: POST /api/upload-procured-meds/parse

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";

const RowSchema = z.object({
  poNumber: z.string().min(1),
  itemNo: z.number().int().nonnegative(),

  poDate: z.string().optional().nullable(), // keep as string for preview
  supplier: z.string().optional().nullable(),
  modeOfProcurement: z.string().optional().nullable(),

  genericName: z.string().optional().nullable(),
  acquisitionCost: z.number().optional().nullable(),
  quantity: z.number().int().optional().nullable(),
  totalCost: z.number().optional().nullable(),

  brandName: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  deliveryStatus: z.string().optional().nullable(),
  bidAttempt: z.number().int().optional().nullable(),
});

// Helper: turn Excel date to ISO string if possible
function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  const toYyyyMmDd = (year: number, month: number, day: number) =>
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // If it already looks like a date string
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

    return trimmed;
  }

  // XLSX may give Date if cellDates:true
  if (value instanceof Date && !isNaN(value.getTime()))
    return toYyyyMmDd(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );

  // Sometimes Excel date becomes a number (serial)
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return toYyyyMmDd(d.y, d.m, d.d);
  }

  return null;
}

function normalizeMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return numeric;
  return Math.round(numeric * 100) / 100;
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function splitGenericAndBrand(
  rawGeneric: unknown,
  rawBrand: unknown,
): { genericName: string | null; brandName: string | null } {
  const explicitBrand = cleanText(rawBrand);
  const genericText = cleanText(rawGeneric);

  if (!genericText) {
    return { genericName: null, brandName: explicitBrand };
  }

  // If Brand Name column is populated, trust it and strip quoted notes/brands
  // from generic text to avoid duplicating brand info.
  if (explicitBrand) {
    const genericWithoutQuotes = genericText
      .replace(/"[^"]*"/g, "")
      .replace(/[,\s]+$/, "")
      .trim();
    return {
      genericName: genericWithoutQuotes || null,
      brandName: explicitBrand,
    };
  }

  // Common source format: Generic description with brand wrapped in quotes at the end.
  const quotedBrandMatch = genericText.match(/"(.*?)"\s*$/);
  if (!explicitBrand && quotedBrandMatch?.[1]) {
    const brandName = quotedBrandMatch[1].trim();
    const genericName = genericText
      .slice(0, quotedBrandMatch.index)
      .replace(/[,\s]+$/, "")
      .trim();

    return {
      genericName: genericName || null,
      brandName: brandName || null,
    };
  }

  return { genericName: genericText, brandName: explicitBrand };
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

  // Convert to JSON using the first row as headers
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: null,
    raw: true,
  });

  // IMPORTANT: These must match your Excel headers (case-insensitive mapping below)
  const get = (row: Record<string, any>, key: string) => {
    const found = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === key.trim().toLowerCase(),
    );
    return found ? row[found] : null;
  };

  const mapped = rawRows
    .filter((r) => Object.keys(r).length > 0)
    .map((r) => {
      const splitNames = splitGenericAndBrand(
        get(r, "Generic Name of Medicine with Strength Dosage / Form"),
        get(r, "Brand Name") ?? get(r, "Brand"),
      );
      const poNumber = String(get(r, "PO Number") ?? "").trim();
      const itemNoVal =
        get(r, "Item No") ?? get(r, "item_no") ?? get(r, "Item") ?? null;

      const itemNo =
        itemNoVal == null || itemNoVal === "" ? NaN : Number(itemNoVal);

      return {
        poNumber,
        itemNo,

        poDate: normalizeDate(get(r, "PO Date")),
        supplier: get(r, "Supplier"),
        modeOfProcurement: get(r, "Mode of Procurement"),

        genericName: splitNames.genericName,
        acquisitionCost: normalizeMoney(get(r, "Acquisition Cost")),
        quantity:
          get(r, "Quantity") == null ? null : Number(get(r, "Quantity")),
        totalCost: normalizeMoney(get(r, "Total Cost")),

        brandName: splitNames.brandName,
        manufacturer: get(r, "Manufacturer"),
        deliveryStatus: get(r, "Delivery Status"),
        bidAttempt:
          get(r, "Bid Attempt") == null ? null : Number(get(r, "Bid Attempt")),
      };
    });

  const errors: { index: number; message: string }[] = [];
  const validRows: any[] = [];

  mapped.forEach((row, i) => {
    const parsed = RowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({
        index: i + 2,
        message: parsed.error.issues.map((x) => x.message).join(", "),
      }); // +2 header row
    } else {
      validRows.push(parsed.data);
    }
  });

  return NextResponse.json({
    sheet: sheetName,
    totalRows: mapped.length,
    validRowsCount: validRows.length,
    errors,
    preview: validRows.slice(0, 200), // preview first 200
    allValidRows: validRows, // you can remove this if file is huge
  });
}
