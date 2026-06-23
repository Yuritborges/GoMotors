import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_FLOW } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status as string;

  if (!ORDER_STATUS_FLOW.includes(status as (typeof ORDER_STATUS_FLOW)[number]) && status !== "CANCELADO") {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
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
}
