import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { BLOCKING_ORDER_STATUSES } from "@/lib/order-workflow";
import { generatePlateLookupVariants } from "@/lib/plate-ocr";

type OrderSummary = {
  id: string;
  status: string;
  statusLabel: string;
  total: number;
  items: string[];
};

function mapOrder(order: {
  id: string;
  status: string;
  total: number;
  items: { serviceName: string }[];
}): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    total: order.total,
    items: order.items.map((i) => i.serviceName),
  };
}

async function findVehicleByPlate(plate: string) {
  let vehicle = await prisma.vehicle.findUnique({
    where: { plate },
    include: { client: true },
  });

  if (!vehicle) {
    const variants = generatePlateLookupVariants(plate);
    for (const variant of variants) {
      if (variant === plate) continue;
      const match = await prisma.vehicle.findUnique({
        where: { plate: variant },
        include: { client: true },
      });
      if (match) {
        vehicle = match;
        break;
      }
    }
  }

  return vehicle;
}

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

  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) {
    return NextResponse.json({ found: false, plate });
  }

  const todayFilter = {
    entryAt: { gte: startOfDay(), lte: endOfDay() },
  };

  const [blockingOrder, readyOrder] = await Promise.all([
    prisma.serviceOrder.findFirst({
      where: {
        vehicleId: vehicle.id,
        ...todayFilter,
        status: { in: [...BLOCKING_ORDER_STATUSES] },
      },
      orderBy: { entryAt: "desc" },
      include: { items: true },
    }),
    prisma.serviceOrder.findFirst({
      where: {
        vehicleId: vehicle.id,
        ...todayFilter,
        status: "PRONTO",
      },
      orderBy: { entryAt: "desc" },
      include: { items: true },
    }),
  ]);

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
    /** Bloqueia nova OS — só em andamento na fila */
    activeOrder: blockingOrder ? mapOrder(blockingOrder) : null,
    /** Informativo — carro pronto NÃO bloqueia nova lavagem */
    readyOrder: readyOrder ? mapOrder(readyOrder) : null,
  });
}
