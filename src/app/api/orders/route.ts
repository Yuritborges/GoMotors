import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const status = searchParams.get("status");
  const today = dateParam ? new Date(dateParam) : new Date();

  const orders = await prisma.serviceOrder.findMany({
    where: {
      entryAt: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      ...(status ? { status: status as never } : {}),
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: true,
      payments: true,
    },
    orderBy: { entryAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const body = await request.json();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: body.vehicleId },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
  }

  const services = await prisma.service.findMany({
    where: { id: { in: body.serviceIds } },
    include: { vehiclePrices: true },
  });

  const items = services.map((service) => {
    const vehiclePrice = service.vehiclePrices.find(
      (vp) => vp.vehicleType === vehicle.vehicleType
    );
    const price = vehiclePrice?.price ?? service.defaultPrice;
    return {
      serviceId: service.id,
      serviceName: service.name,
      price,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const discount = Number(body.discount ?? 0);
  const total = Math.max(subtotal - discount, 0);
  const paymentMethod = body.paymentMethod ?? "PENDENTE";
  const paymentStatus =
    paymentMethod === "PENDENTE" ? "PENDENTE" : "PAGO";

  const order = await prisma.serviceOrder.create({
    data: {
      clientId: body.clientId,
      vehicleId: body.vehicleId,
      employeeId: body.employeeId || null,
      status: "AGUARDANDO",
      subtotal,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      notes: body.notes || null,
      items: { create: items },
      payments:
        paymentStatus === "PAGO"
          ? {
              create: {
                method: paymentMethod,
                amount: total,
                type: "PAGAMENTO",
              },
            }
          : undefined,
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: true,
      payments: true,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
