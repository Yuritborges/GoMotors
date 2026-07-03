import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_FLOW } from "@/lib/constants";
import { handleAuthError, requireAuth } from "@/lib/auth";
import { isAllowedStatusTransition } from "@/lib/order-status-advance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const status = body.status as string;

    if (!ORDER_STATUS_FLOW.includes(status as (typeof ORDER_STATUS_FLOW)[number]) && status !== "CANCELADO") {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    const existing = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
    }

    if (
      status !== "CANCELADO" &&
      !isAllowedStatusTransition(existing.status, status, existing.items)
    ) {
      return NextResponse.json({ error: "Transição de status inválida para esta ordem." }, { status: 400 });
    }

    if (status === "ENTREGUE" && existing.paymentStatus === "PENDENTE") {
      return NextResponse.json(
        { error: "Receba o pagamento antes de liberar o veículo." },
        { status: 400 }
      );
    }

    const order = await prisma.serviceOrder.update({
    where: { id },
    data: {
      status: status as never,
      deliveredAt: status === "ENTREGUE" ? new Date() : undefined,
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: true,
    },
  });

  return NextResponse.json(order);
  } catch (error) {
    return handleAuthError(error);
  }
}
