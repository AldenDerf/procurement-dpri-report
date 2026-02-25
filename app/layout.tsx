import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Procurement DPRI Report",
  description: "Procurement dashboard and upload tools",
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dpri-b-report", label: "DPRI-B Report" },
  { href: "/upload-iar", label: "Upload IAR" },
  { href: "/upload-procured-meds", label: "Upload Procured Meds" },
  { href: "/manual-iar", label: "Manual IAR Insert" },
  { href: "/manual-procured-meds", label: "Manual Insert" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
            <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="text-sm font-semibold text-slate-900">
                Procurement DPRI
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
