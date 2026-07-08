import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";
import { computePartnerBalance, summarizePartnerEntries } from "@/lib/partner-ledger";
import { endOfDay, startOfDay } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = fromParam ? startOfDay(new Date(fromParam)) : null;
    const to = toParam ? endOfDay(new Date(toParam)) : null;

    const partner = await prisma.partnerStore.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { date: "desc" } },
        orders: {
          where: { status: { not: "CANCELADO" } },
          orderBy: { entryAt: "desc" },
          include: {
            vehicle: { select: { plate: true, model: true } },
            items: { select: { serviceName: true, price: true } },
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const periodOrders =
      from && to
        ? partner.orders.filter((o) => o.entryAt >= from && o.entryAt <= to)
        : partner.orders;
    const periodEntries =
      from && to
        ? partner.entries.filter((e) => e.date >= from && e.date <= to)
        : partner.entries;

    const washTotal = periodOrders
      .filter((o) => o.paymentStatus === "PENDENTE")
      .reduce((s, o) => s + o.total, 0);

    return NextResponse.json({
      id: partner.id,
      name: partner.name,
      active: partner.active,
      phone: partner.phone,
      notes: partner.notes,
      balance: computePartnerBalance(partner.entries, partner.orders),
      periodSummary: {
        ...summarizePartnerEntries(periodEntries),
        washTotal,
        orderCount: periodOrders.length,
      },
      entries: periodEntries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount,
        description: e.description,
        installment: e.installment,
        date: e.date.toISOString(),
      })),
      orders: periodOrders.map((o) => ({
        id: o.id,
        total: o.total,
        entryAt: o.entryAt.toISOString(),
        paymentStatus: o.paymentStatus,
        plate: o.vehicle.plate,
        model: o.vehicle.model,
        services: o.items.map((i) => i.serviceName).join(", "),
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const body = await request.json();
    const data: { name?: string; phone?: string | null; notes?: string | null; active?: boolean } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.active !== undefined) data.active = Boolean(body.active);

    const partner = await prisma.partnerStore.update({ where: { id }, data });
    return NextResponse.json(partner);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;

    const orderCount = await prisma.serviceOrder.count({ where: { partnerStoreId: id } });
    if (orderCount > 0) {
      return NextResponse.json(
        { error: `Esta loja tem ${orderCount} lavagem(ns) vinculada(s). Desative em vez de excluir.` },
        { status: 400 }
      );
    }

    await prisma.partnerStore.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
