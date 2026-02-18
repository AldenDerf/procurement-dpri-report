import ListsOfPOs from "@/app/ui/dashboard/lists-of-pos";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Procurement Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Unique PO list with computed completion status.
          </p>
        </section>

        <ListsOfPOs />
      </div>
    </main>
  );
}
