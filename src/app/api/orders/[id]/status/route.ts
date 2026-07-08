import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_FLOW } from "@/lib/constants";
import { handleAuthError, requireAuth } from "@/lib/auth";
import { canDeliverWithPendingPayment } from "@/lib/payments";
import {
  getNextLane,
  laneToStatus,
  resolveOrderLane,
} from "@/lib/order-lanes";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
    }

    let status = body.status as string | undefined;
    let currentLane = existing.currentLane;

    if (body.advance === true) {
      const lane = resolveOrderLane(existing);
      const nextLane = getNextLane(lane, existing.items);
      if (!nextLane) {
        return NextResponse.json(
          { error: "Não há próxima etapa para esta ordem." },
          { status: 400 }
        );
      }
      currentLane = nextLane;
      status = laneToStatus(nextLane);
    }

    if (!status) {
      return NextResponse.json({ error: "Status ou advance obrigatório." }, { status: 400 });
    }

    if (
      !ORDER_STATUS_FLOW.includes(status as (typeof ORDER_STATUS_FLOW)[number]) &&
      status !== "CANCELADO"
    ) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    if (
      status === "ENTREGUE" &&
      existing.paymentStatus === "PENDENTE" &&
      !canDeliverWithPendingPayment(existing.paymentMethod)
    ) {
      return NextResponse.json(
        { error: "Receba o pagamento antes de liberar o veículo." },
        { status: 400 }
      );
    }

    if (status === "ENTREGUE") {
      currentLane = "PRONTO";
    }

    const laneChanged = currentLane !== existing.currentLane;

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: {
        status: status as never,
        currentLane,
        ...(laneChanged ? { laneEnteredAt: new Date() } : {}),
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
