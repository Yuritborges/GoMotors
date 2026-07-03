import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const paymentMethod = body.paymentMethod as string;

    if (!paymentMethod || paymentMethod === "PENDENTE") {
      return NextResponse.json(
        { error: "Selecione uma forma de pagamento válida." },
        { status: 400 }
      );
    }

    const existing = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
    }

    if (existing.paymentStatus === "PAGO") {
      return NextResponse.json({ error: "Esta ordem já foi paga." }, { status: 400 });
    }

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: {
        paymentMethod: paymentMethod as never,
        paymentStatus: "PAGO",
        payments: {
          create: {
            method: paymentMethod as never,
            amount: existing.total,
            type: "PAGAMENTO",
          },
        },
      },
      include: {
        client: true,
        vehicle: true,
        employee: true,
        items: true,
        payments: true,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    return handleAuthError(error);
  }
}
