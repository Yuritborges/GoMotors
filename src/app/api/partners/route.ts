import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";
import { computePartnerBalance, summarizePartnerEntries } from "@/lib/partner-ledger";
import { endOfDay, startOfDay } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = fromParam ? startOfDay(new Date(fromParam)) : null;
    const to = toParam ? endOfDay(new Date(toParam)) : null;

    const partners = await prisma.partnerStore.findMany({
      orderBy: { name: "asc" },
      include: {
        entries: { orderBy: { date: "desc" } },
        orders: {
          where: { status: { not: "CANCELADO" } },
          select: { id: true, total: true, entryAt: true, paymentStatus: true },
        },
      },
    });

    return NextResponse.json(
      partners.map((p) => {
        const periodOrders =
          from && to
            ? p.orders.filter((o) => o.entryAt >= from && o.entryAt <= to)
            : p.orders;
        const periodEntries =
          from && to
            ? p.entries.filter((e) => e.date >= from && e.date <= to)
            : p.entries;

        const washTotal = periodOrders
          .filter((o) => o.paymentStatus === "PENDENTE")
          .reduce((s, o) => s + o.total, 0);
        const summary = summarizePartnerEntries(periodEntries);

        return {
          id: p.id,
          name: p.name,
          active: p.active,
          phone: p.phone,
          notes: p.notes,
          orderCount: periodOrders.length,
          washTotal,
          balance: computePartnerBalance(p.entries, p.orders),
          periodSummary: { ...summary, washTotal },
          entryCount: periodEntries.length,
        };
      })
    );
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const partner = await prisma.partnerStore.create({
      data: {
        name,
        phone: body.phone ? String(body.phone).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        active: body.active !== false,
      },
    });

    return NextResponse.json(partner, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
