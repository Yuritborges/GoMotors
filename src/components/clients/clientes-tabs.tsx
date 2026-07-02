"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/clientes", label: "Clientes" },
  { href: "/clientes/lojas", label: "Lojas parceiras" },
];

export function ClientesTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => {
        const active =
          tab.href === "/clientes"
            ? pathname === "/clientes"
            : pathname.startsWith("/clientes/lojas");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors sm:flex-none",
              active
                ? "bg-white text-sky-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
