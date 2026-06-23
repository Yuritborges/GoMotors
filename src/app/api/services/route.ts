import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const services = await prisma.service.findMany({
      include: { vehiclePrices: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(services);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();

    const vehicleTypes = ["MOTO", "CARRO", "SUV", "CAMINHONETE", "OUTRO"] as const;
    const defaultPrice = Number(body.defaultPrice);

    const service = await prisma.service.create({
      data: {
        name: body.name,
        category: body.category,
        defaultPrice,
        estimatedMinutes: Number(body.estimatedMinutes ?? 30),
        active: body.active ?? true,
        vehiclePrices: {
          create: (body.vehiclePrices ?? vehicleTypes.map((vt) => ({
            vehicleType: vt,
            price: defaultPrice,
          }))).map((vp: { vehicleType: string; price: number }) => ({
            vehicleType: vp.vehicleType,
            price: Number(vp.price),
          })),
        },
      },
      include: { vehiclePrices: true },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
