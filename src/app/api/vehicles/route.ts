import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  const vehicles = await prisma.vehicle.findMany({
    where: clientId ? { clientId } : undefined,
    include: { client: true },
    orderBy: { plate: "asc" },
  });

  return NextResponse.json(vehicles);
}

export async function POST(request: Request) {
  const body = await request.json();

  const vehicle = await prisma.vehicle.create({
    data: {
      clientId: body.clientId,
      plate: body.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      brand: body.brand || null,
      model: body.model || null,
      color: body.color || null,
      vehicleType: body.vehicleType || "CARRO",
      notes: body.notes || null,
    },
    include: { client: true },
  });

  return NextResponse.json(vehicle, { status: 201 });
}
