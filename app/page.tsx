import ListsOfPOs from "@/app/ui/dashboard/lists-of-pos";
import Link from "next/link";

const appRoutes = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dpri-b-report", label: "DPRI-B Report" },
  { href: "/upload-iar", label: "Upload IAR" },
  { href: "/upload-procured-meds", label: "Upload Procured Meds" },
  { href: "/manual-iar", label: "Manual IAR Insert" },
  { href: "/manual-procured-meds", label: "Manual Procured Meds Insert" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Procurement Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            List of unique PO numbers with PO date, supplier, and completion
            status.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Routes
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {appRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                {route.label}
              </Link>
            ))}
          </div>
        </section>

        <ListsOfPOs />
      </div>
    </main>
  );
}
