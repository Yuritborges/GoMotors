import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Marca a OS na conta mensal do cliente — permanece pendente até o fechamento. */
export async function POST(_request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

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

    if (existing.paymentMethod === "FECHAMENTO_MENSAL") {
      return NextResponse.json(
        { error: "Esta ordem já está lançada na mensalidade." },
        { status: 400 }
      );
    }

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: {
        paymentMethod: "FECHAMENTO_MENSAL",
        paymentStatus: "PENDENTE",
        notes: existing.notes
          ? `${existing.notes}\n[Lançado na mensalidade]`
          : "[Lançado na mensalidade]",
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
