"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isOwner } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

type LowStockProduct = {
  id: string;
  name: string;
  stock: number | null;
  minStock: number;
};

export function StockAlertsBanner() {
  const [alerts, setAlerts] = useState<LowStockProduct[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user && isOwner(data.user.role)) {
          setIsAdmin(true);
          return fetch("/api/stock/alerts");
        }
        return null;
      })
      .then((res) => (res ? res.json() : null))
      .then((data) => {
        if (data?.lowStock) setAlerts(data.lowStock);
      });
  }, []);

  if (!isAdmin || alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900">
            Estoque baixo — {alerts.length} produto(s) precisam de reposição
          </p>
          <ul className="mt-1 text-sm text-amber-800">
            {alerts.slice(0, 5).map((p) => (
              <li key={p.id}>
                {p.name}: {p.stock} un. (mínimo {p.minStock})
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/estoque"
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          Ver estoque
        </Link>
      </div>
    </div>
  );
}
