import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { BLOCKING_ORDER_STATUSES } from "@/lib/order-workflow";
import { generatePlateLookupVariants } from "@/lib/plate-ocr";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("plate")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Placa obrigatória" }, { status: 400 });
  }

  const plate = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plate.length < 6) {
    return NextResponse.json({ error: "Placa inválida" }, { status: 400 });
  }

  let vehicle = await prisma.vehicle.findUnique({
    where: { plate },
    include: {
      client: true,
      orders: {
        where: {
          entryAt: { gte: startOfDay(), lte: endOfDay() },
          status: { in: [...BLOCKING_ORDER_STATUSES] },
        },
        orderBy: { entryAt: "desc" },
        take: 1,
        include: { items: true },
      },
    },
  });

  if (!vehicle) {
    const variants = generatePlateLookupVariants(plate);
    for (const variant of variants) {
      if (variant === plate) continue;
      const match = await prisma.vehicle.findUnique({
        where: { plate: variant },
        include: {
          client: true,
          orders: {
            where: {
              entryAt: { gte: startOfDay(), lte: endOfDay() },
              status: { in: [...BLOCKING_ORDER_STATUSES] },
            },
            orderBy: { entryAt: "desc" },
            take: 1,
            include: { items: true },
          },
        },
      });
      if (match) {
        vehicle = match;
        break;
      }
    }
  }

  if (!vehicle) {
    return NextResponse.json({ found: false, plate });
  }

  const activeOrder = vehicle.orders[0] ?? null;

  return NextResponse.json({
    found: true,
    plate: vehicle.plate,
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand,
      vehicleType: vehicle.vehicleType,
    },
    client: {
      id: vehicle.client.id,
      name: vehicle.client.name,
      phone: vehicle.client.phone,
    },
    activeOrder: activeOrder
      ? {
          id: activeOrder.id,
          status: activeOrder.status,
          statusLabel: ORDER_STATUS_LABELS[activeOrder.status] ?? activeOrder.status,
          total: activeOrder.total,
          items: activeOrder.items.map((i) => i.serviceName),
        }
      : null,
  });
}
