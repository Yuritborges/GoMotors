import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { BLOCKING_ORDER_STATUSES } from "@/lib/order-workflow";
import { generatePlateLookupVariants } from "@/lib/plate-ocr";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

async function findSimilarPlates(plate: string, maxDistance = 2): Promise<string[]> {
  if (plate.length !== 7) return [];

  const vehicles = await prisma.vehicle.findMany({ select: { plate: true } });
  return vehicles
    .map((v) => ({ plate: v.plate, distance: levenshtein(plate, v.plate) }))
    .filter((x) => x.distance > 0 && x.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((x) => x.plate);
}

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
    const suggestions = await findSimilarPlates(plate);
    return NextResponse.json({ found: false, plate, suggestions });
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
