import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth";
import { isSettlementPaymentMethod } from "@/lib/payments";

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const clientId = body.clientId as string;
    const settlementMethod = body.settlementMethod as string;

    if (!clientId) {
      return NextResponse.json({ error: "Cliente obrigatório." }, { status: 400 });
    }

    if (!settlementMethod || !isSettlementPaymentMethod(settlementMethod)) {
      return NextResponse.json(
        { error: "Selecione como o cliente pagou (Pix, dinheiro, etc.)." },
        { status: 400 }
      );
    }

    const pending = await prisma.serviceOrder.findMany({
      where: {
        clientId,
        paymentStatus: "PENDENTE",
        status: { not: "CANCELADO" },
      },
      orderBy: { entryAt: "asc" },
    });

    if (pending.length === 0) {
      return NextResponse.json(
        { error: "Este cliente não possui serviços pendentes de pagamento." },
        { status: 400 }
      );
    }

    const totalAmount = pending.reduce((sum, o) => sum + o.total, 0);
    const note = `Fechamento mensal — ${pending.length} serviço(s). Recebido via ${settlementMethod}.`;

    const updated = await prisma.$transaction(
      pending.map((order) =>
        prisma.serviceOrder.update({
          where: { id: order.id },
          data: {
            paymentMethod: "FECHAMENTO_MENSAL",
            paymentStatus: "PAGO",
            payments: {
              create: {
                method: settlementMethod as never,
                amount: order.total,
                type: "PAGAMENTO",
                notes: note,
              },
            },
          },
          include: {
            client: true,
            vehicle: true,
            items: true,
          },
        })
      )
    );

    return NextResponse.json({
      paidCount: updated.length,
      totalAmount,
      orders: updated,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
