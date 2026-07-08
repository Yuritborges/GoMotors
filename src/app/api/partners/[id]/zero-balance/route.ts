import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import {
  computePartnerBalance,
  ledgerEntryToZeroBalance,
  PARTNER_ENTRY_LABELS,
} from "@/lib/partner-ledger";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;

    const partner = await prisma.partnerStore.findUnique({
      where: { id },
      include: {
        entries: true,
        orders: {
          where: { status: { not: "CANCELADO" } },
          select: { total: true, paymentStatus: true },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const balance = computePartnerBalance(partner.entries, partner.orders);
    const zero = ledgerEntryToZeroBalance(balance);
    if (!zero) {
      return NextResponse.json({ error: "O saldo já está zerado." }, { status: 400 });
    }

    const description =
      zero.type === "PAGAMENTO"
        ? "Quitação — saldo zerado manualmente"
        : "Ajuste — saldo zerado manualmente";

    const entry = await prisma.partnerLedgerEntry.create({
      data: {
        partnerStoreId: id,
        type: zero.type,
        amount: zero.amount,
        description,
        date: new Date(),
      },
    });

    const newBalance = computePartnerBalance(
      [...partner.entries, entry],
      partner.orders
    );

    return NextResponse.json({
      entry,
      previousBalance: balance,
      balance: newBalance,
      typeLabel: PARTNER_ENTRY_LABELS[zero.type],
      amount: zero.amount,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
