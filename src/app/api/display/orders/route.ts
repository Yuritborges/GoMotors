import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { buildDisplayColumns, displayLaneStats } from "@/lib/display-lanes";
import { operationalOrdersWhere } from "@/lib/imported-orders";

export async function GET() {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());

  const orders = await prisma.serviceOrder.findMany({
    where: {
      entryAt: { gte: start, lte: end },
      status: { notIn: ["ENTREGUE", "CANCELADO"] },
      ...operationalOrdersWhere,
    },
    select: {
      id: true,
      status: true,
      currentLane: true,
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

  const columns = buildDisplayColumns(orders);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    columns,
    stats: displayLaneStats(columns),
  });
}
