"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

type Order = {
  id: string;
  status: string;
  total: number;
  entryAt: string;
  client: { name: string };
  vehicle: { plate: string };
  items: { serviceName: string }[];
};

export default function OrdensPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then(setOrders);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Ordens de serviço" description="Ordens registradas hoje">
        <Link href="/ordens/nova" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Nova ordem</Button>
        </Link>
      </PageHeader>

      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{order.vehicle.plate}</p>
                  <p className="text-sm text-slate-600">{order.client.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(order.entryAt)}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {order.items.map((i) => i.serviceName).join(", ")}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                <Link href={`/ordens/${order.id}/comprovante`}>
                  <Button size="sm">Comprovante</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            Nenhuma ordem registrada hoje.
          </p>
        )}
      </div>

      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Entrada</th>
                <th className="pb-3 pr-4 font-medium">Veículo</th>
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Serviços</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Total</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{formatDateTime(order.entryAt)}</td>
                  <td className="py-3 pr-4 font-medium">{order.vehicle.plate}</td>
                  <td className="py-3 pr-4">{order.client.name}</td>
                  <td className="py-3 pr-4">
                    {order.items.map((i) => i.serviceName).join(", ")}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 pr-4">{formatCurrency(order.total)}</td>
                  <td className="py-3">
                    <Link href={`/ordens/${order.id}/comprovante`}>
                      <Button size="sm">Imprimir comprovante</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma ordem registrada hoje.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
