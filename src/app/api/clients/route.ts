import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  const clients = await prisma.client.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { vehicles: { some: { plate: { contains: search.toUpperCase() } } } },
          ],
        }
      : undefined,
    include: {
      vehicles: true,
      _count: { select: { orders: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const body = await request.json();

  const plate = body.vehicle?.plate
    ? body.vehicle.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    : null;

  if (plate) {
    const existing = await prisma.vehicle.findUnique({ where: { plate } });
    if (existing) {
      return NextResponse.json(
        { error: `A placa ${plate} já está cadastrada.` },
        { status: 409 }
      );
    }
  }

  const client = await prisma.client.create({
    data: {
      name: body.name?.trim(),
      phone: body.phone?.trim() || "—",
      notes: body.notes || null,
      vehicles: plate
        ? {
            create: {
              plate,
              brand: body.vehicle.brand || null,
              model: body.vehicle.model || null,
              color: body.vehicle.color || null,
              vehicleType: body.vehicle.vehicleType || "CARRO",
              notes: body.vehicle.notes || null,
            },
          }
        : undefined,
    },
    include: { vehicles: true },
  });

  return NextResponse.json(client, { status: 201 });
}
