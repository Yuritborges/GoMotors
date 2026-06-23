import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Params = { params: Promise<{ id: string }> };

export default async function ClienteDetailPage({ params }: Params) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      vehicles: true,
      orders: {
        include: { vehicle: true, items: true },
        orderBy: { entryAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-slate-500">{client.phone}</p>
        </div>
        <Link href="/clientes">
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Veículos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {client.vehicles.map((v) => (
            <div key={v.id} className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium">{v.plate}</p>
              <p className="text-slate-600">
                {v.brand} {v.model} — {v.color} ({VEHICLE_TYPE_LABELS[v.vehicleType]})
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de serviços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.orders.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum serviço registrado.</p>
          ) : (
            client.orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {order.vehicle.plate} —{" "}
                    {order.items.map((i) => i.serviceName).join(", ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(order.entryAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-medium">
                    {formatCurrency(order.total)}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
