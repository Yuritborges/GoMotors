import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { excludeImportedOrdersWhere } from "@/lib/imported-orders";

export async function GET() {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());

  const orders = await prisma.serviceOrder.findMany({
    where: {
      entryAt: { gte: start, lte: end },
      status: { notIn: ["ENTREGUE", "CANCELADO"] },
      ...excludeImportedOrdersWhere,
    },
    include: {
      client: { select: { name: true } },
      vehicle: { select: { plate: true } },
      items: {
        select: {
          serviceName: true,
          employee: { select: { name: true } },
        },
        orderBy: { serviceName: "asc" },
      },
    },
    orderBy: { entryAt: "asc" },
  });

  const columns = ["AGUARDANDO", "EM_LAVAGEM", "FINALIZACAO", "PRONTO"] as const;

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    columns: columns.map((status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      orders: orders
        .filter((o) => o.status === status)
        .map((o, index) => ({
          id: o.id,
          plate: o.vehicle.plate,
          clientName: o.client.name.split(" ")[0],
          items: o.items.map((i) => ({
            serviceName: i.serviceName,
            employeeName: i.employee?.name ?? null,
          })),
          position: index + 1,
        })),
    })),
    stats: {
      aguardando: orders.filter((o) => o.status === "AGUARDANDO").length,
      emLavagem: orders.filter((o) => o.status === "EM_LAVAGEM").length,
      finalizacao: orders.filter((o) => o.status === "FINALIZACAO").length,
      prontos: orders.filter((o) => o.status === "PRONTO").length,
    },
  });
}
