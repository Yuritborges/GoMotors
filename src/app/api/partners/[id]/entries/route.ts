import { NextResponse } from "next/server";
import type { PartnerEntryType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const VALID: PartnerEntryType[] = ["DIVIDA", "PRODUTO", "PARCELA", "PAGAMENTO", "AJUSTE"];

export async function POST(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id: partnerStoreId } = await params;
    const body = await request.json();

    const type = String(body.type ?? "").toUpperCase() as PartnerEntryType;
    if (!VALID.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const description = String(body.description ?? "").trim();
    if (!description) {
      return NextResponse.json({ error: "Descrição é obrigatória" }, { status: 400 });
    }

    const partner = await prisma.partnerStore.findUnique({ where: { id: partnerStoreId } });
    if (!partner) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const entry = await prisma.partnerLedgerEntry.create({
      data: {
        partnerStoreId,
        type,
        amount,
        description: description.slice(0, 300),
        installment: body.installment ? String(body.installment).trim().slice(0, 80) : null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
