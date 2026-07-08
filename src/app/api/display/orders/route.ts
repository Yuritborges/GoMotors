import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { businessDateKey, businessDayBounds } from "@/lib/business-day";
import { buildDisplayColumns, displayLaneStats } from "@/lib/display-lanes";
import { operationalOrdersWhere } from "@/lib/imported-orders";
import { getDisplayLaneDurations } from "@/lib/shop-settings";

export async function GET() {
  const dateKey = businessDateKey();
  const { start, end } = businessDayBounds(dateKey);
  const durations = await getDisplayLaneDurations(prisma);

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
      laneEnteredAt: true,
      client: { select: { name: true } },
      vehicle: { select: { plate: true } },
      items: {
        select: {
          serviceName: true,
          estimatedMinutes: true,
          employee: { select: { name: true } },
        },
        orderBy: { serviceName: "asc" },
      },
    },
    orderBy: { entryAt: "asc" },
  });

  const columns = buildDisplayColumns(orders, durations);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    columns,
    stats: displayLaneStats(columns),
  });
}
