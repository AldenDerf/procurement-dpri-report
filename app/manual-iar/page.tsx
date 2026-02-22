"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  iarNumber: string;
  dateOfInspection: string;
  poNumber: string;
  itemNumber: string;
  inspectedQuantity: string;
  requisitioningOffice: string;
  brand: string;
  batchLotNumber: string;
  expirationDate: string;
};

const initialForm: FormState = {
  iarNumber: "",
  dateOfInspection: "",
  poNumber: "",
  itemNumber: "",
  inspectedQuantity: "",
  requisitioningOffice: "",
  brand: "",
  batchLotNumber: "",
  expirationDate: "",
};

function toRequiredInteger(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

export default function ManualIarPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [poOptions, setPoOptions] = useState<string[]>([]);
  const [poSearch, setPoSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    iarNumber: string;
    poNumber: string;
    itemNumber: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPoNumbers = async () => {
      try {
        const res = await fetch("/api/procured-meds/po-numbers");
        if (!isMounted) return;
        if (!res.ok) {
          setPoOptions([]);
          return;
        }

        const json = (await res.json()) as { poNumbers?: string[] };
        setPoOptions(Array.isArray(json.poNumbers) ? json.poNumbers : []);
      } catch {
        if (!isMounted) return;
        setPoOptions([]);
      }
    };

    loadPoNumbers();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPoOptions = useMemo(() => {
    const needle = poSearch.trim().toLowerCase();
    if (!needle) return poOptions;
    return poOptions.filter((po) => po.toLowerCase().includes(needle));
  }, [poOptions, poSearch]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");

    const itemNumber = toRequiredInteger(form.itemNumber);
    const inspectedQuantity = toRequiredInteger(form.inspectedQuantity);

    if (
      !form.iarNumber.trim() ||
      !form.dateOfInspection.trim() ||
      !form.poNumber.trim() ||
      itemNumber == null ||
      itemNumber < 1 ||
      inspectedQuantity == null ||
      inspectedQuantity < 0
    ) {
      setError(
        "IAR Number, Date of Inspection, PO Number, Item Number, and Inspected Quantity are required.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        iarNumber: form.iarNumber.trim(),
        dateOfInspection: form.dateOfInspection.trim(),
        poNumber: form.poNumber.trim(),
        itemNumber,
        inspectedQuantity,
        requisitioningOffice: form.requisitioningOffice.trim() || null,
        brand: form.brand.trim() || null,
        batchLotNumber: form.batchLotNumber.trim() || null,
        expirationDate: form.expirationDate.trim() || null,
      };

      const res = await fetch("/api/iar/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        json = {};
      }
      if (!res.ok) {
        setError(
          typeof json.error === "string"
            ? json.error
            : `Insert failed (HTTP ${res.status}).`,
        );
        return;
      }

      setSuccess({
        iarNumber: String(json.iarNumber ?? ""),
        poNumber: String(json.poNumber ?? ""),
        itemNumber: Number(json.itemNumber ?? 0),
      });
      setForm(initialForm);
      setPoSearch("");
    } catch {
      setError("Insert failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Manual IAR Insert
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Add a single `iar` row manually. PO Number options come from
            distinct `po_number` values in `procured_meds`.
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">IAR Number *</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.iarNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, iarNumber: e.target.value }))
                }
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Date of Inspection *
              </span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.dateOfInspection}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    dateOfInspection: e.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">PO Number *</span>
              <input
                list="po-number-options"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.poNumber}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, poNumber: e.target.value }));
                  setPoSearch(e.target.value);
                }}
                placeholder="Type to search PO number"
                required
              />
              <datalist id="po-number-options">
                {filteredPoOptions.map((po) => (
                  <option key={po} value={po}>
                    {po}
                  </option>
                ))}
              </datalist>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Item Number *</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.itemNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, itemNumber: e.target.value }))
                }
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Inspected Quantity *
              </span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.inspectedQuantity}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    inspectedQuantity: e.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Requisitioning Office
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.requisitioningOffice}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    requisitioningOffice: e.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Brand</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.brand}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brand: e.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Batch/Lot Number</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.batchLotNumber}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    batchLotNumber: e.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Expiration Date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.expirationDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    expirationDate: e.target.value,
                  }))
                }
              />
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-w-32 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Inserting..." : "Insert IAR"}
            </button>
          </div>
        </form>
      </div>

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">
              Successfully inserted
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              IAR {success.iarNumber} inserted for PO {success.poNumber} item{" "}
              {success.itemNumber}.
            </p>
            <button
              onClick={() =>
                router.push(`/dashboard/${encodeURIComponent(success.poNumber)}`)
              }
              className="mt-6 inline-flex min-w-40 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to PO Dashboard
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
