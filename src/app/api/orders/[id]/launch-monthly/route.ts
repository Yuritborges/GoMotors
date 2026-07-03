import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Marca a OS na conta mensal do cliente — permanece pendente até o fechamento. */
export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const deliver = body?.deliver === true;

    const existing = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { client: true, vehicle: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
    }

    if (existing.paymentStatus === "PAGO") {
      return NextResponse.json({ error: "Esta ordem já foi paga." }, { status: 400 });
    }

    const alreadyMonthly = existing.paymentMethod === "FECHAMENTO_MENSAL";

    if (alreadyMonthly && !deliver) {
      return NextResponse.json(
        { error: "Esta ordem já está lançada na mensalidade." },
        { status: 400 }
      );
    }

    if (deliver && existing.status !== "PRONTO") {
      return NextResponse.json(
        { error: "Só é possível liberar veículos na coluna Pronto." },
        { status: 400 }
      );
    }

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: {
        paymentMethod: "FECHAMENTO_MENSAL",
        paymentStatus: "PENDENTE",
        notes:
          !alreadyMonthly && !existing.notes?.includes("[Lançado na mensalidade]")
            ? existing.notes
              ? `${existing.notes}\n[Lançado na mensalidade]`
              : "[Lançado na mensalidade]"
            : existing.notes,
        ...(deliver
          ? {
              status: "ENTREGUE",
              deliveredAt: new Date(),
              currentLane: "PRONTO",
            }
          : {}),
      },
      include: {
        client: true,
        vehicle: true,
        items: true,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    return handleAuthError(error);
  }
}
