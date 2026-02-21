"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  poNumber: string;
  itemNo: string;
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

const initialForm: FormState = {
  poNumber: "",
  itemNo: "",
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

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: string): number | null {
  const parsed = toNullableNumber(value);
  if (parsed == null) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

export default function ManualProcuredMedsPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  const [modeOptions, setModeOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successPoNumber, setSuccessPoNumber] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOptions = async () => {
      try {
        const [supplierRes, modeRes] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/modes-of-procurement"),
        ]);

        if (!isMounted) return;

        if (supplierRes.ok) {
          const supplierJson = (await supplierRes.json()) as {
            suppliers?: string[];
          };
          setSupplierOptions(
            Array.isArray(supplierJson.suppliers) ? supplierJson.suppliers : [],
          );
        } else {
          setSupplierOptions([]);
        }

        if (modeRes.ok) {
          const modeJson = (await modeRes.json()) as { modes?: string[] };
          setModeOptions(Array.isArray(modeJson.modes) ? modeJson.modes : []);
        } else {
          setModeOptions([]);
        }
      } catch {
        if (!isMounted) return;
        setSupplierOptions([]);
        setModeOptions([]);
      }
    };

    loadOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");

    const itemNo = Number(form.itemNo);
    if (!form.poNumber.trim() || !Number.isInteger(itemNo) || itemNo < 1) {
      setError("PO Number and Item No are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        poNumber: form.poNumber.trim(),
        itemNo,
        poDate: form.poDate.trim() || null,
        supplier: form.supplier.trim() || null,
        modeOfProcurement: form.modeOfProcurement.trim() || null,
        genericName: form.genericName.trim() || null,
        acquisitionCost: toNullableNumber(form.acquisitionCost),
        quantity: toNullableInteger(form.quantity),
        totalCost: toNullableNumber(form.totalCost),
        brandName: form.brandName.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        deliveryStatus: form.deliveryStatus.trim() || null,
        bidAttempt: toNullableInteger(form.bidAttempt),
      };

      const res = await fetch("/api/procured-meds/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Insert failed.");
        return;
      }

      setSuccessPoNumber(json.poNumber);
      setForm(initialForm);
    } catch {
      setError("Insert failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToDashboardPo = () => {
    if (!successPoNumber) return;
    router.push(`/dashboard/${encodeURIComponent(successPoNumber)}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Manual Procured Meds Insert
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Add a single `procured_meds` row manually.
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">PO Number *</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.poNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, poNumber: e.target.value }))
                }
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Item No *</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.itemNo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, itemNo: e.target.value }))
                }
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">PO Date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.poDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, poDate: e.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Supplier</span>
              <input
                list="supplier-options"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.supplier}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, supplier: e.target.value }))
                }
                placeholder="Type or select supplier"
              />
              <datalist id="supplier-options">
                {supplierOptions.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </datalist>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Mode of Procurement
              </span>
              <input
                list="mode-options"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.modeOfProcurement}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    modeOfProcurement: e.target.value,
                  }))
                }
                placeholder="Type or select mode"
              />
              <datalist id="mode-options">
                {modeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </datalist>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Generic Name</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.genericName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, genericName: e.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Acquisition Cost
              </span>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.acquisitionCost}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    acquisitionCost: e.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Quantity</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.quantity}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, quantity: e.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Total Cost</span>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.totalCost}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, totalCost: e.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Brand Name</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.brandName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Manufacturer</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.manufacturer}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    manufacturer: e.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Delivery Status
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.deliveryStatus}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    deliveryStatus: e.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Bid Attempt</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-400 focus:ring"
                value={form.bidAttempt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bidAttempt: e.target.value }))
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
              {isSubmitting ? "Inserting..." : "Insert"}
            </button>
          </div>
        </form>
      </div>

      {successPoNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">
              Successfully installed
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Record inserted for PO {successPoNumber}.
            </p>
            <button
              onClick={goToDashboardPo}
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
