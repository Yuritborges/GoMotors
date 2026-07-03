import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const orders = await prisma.serviceOrder.findMany({
      where: {
        clientId: id,
        paymentStatus: "PENDENTE",
        status: { not: "CANCELADO" },
      },
      include: {
        vehicle: true,
        items: true,
      },
      orderBy: { entryAt: "asc" },
    });

    const totalAmount = orders.reduce((sum, o) => sum + o.total, 0);

    return NextResponse.json({
      clientId: id,
      clientName: client.name,
      count: orders.length,
      totalAmount,
      orders: orders.map((o) => ({
        id: o.id,
        plate: o.vehicle.plate,
        total: o.total,
        status: o.status,
        entryAt: o.entryAt.toISOString(),
        services: o.items.map((i) => i.serviceName),
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
