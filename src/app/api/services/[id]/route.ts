import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const body = await request.json();

    await prisma.serviceVehiclePrice.deleteMany({ where: { serviceId: id } });

    const service = await prisma.service.update({
      where: { id },
      data: {
        name: body.name,
        category: body.category,
        defaultPrice: Number(body.defaultPrice),
        estimatedMinutes: Number(body.estimatedMinutes),
        active: body.active,
        vehiclePrices: body.vehiclePrices
          ? {
              create: body.vehiclePrices.map(
                (vp: { vehicleType: string; price: number }) => ({
                  vehicleType: vp.vehicleType,
                  price: Number(vp.price),
                })
              ),
            }
          : undefined,
      },
      include: { vehiclePrices: true },
    });

    return NextResponse.json(service);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    await prisma.service.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
