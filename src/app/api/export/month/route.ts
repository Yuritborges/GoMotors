import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";

function csvEscape(value: string | number) {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function monthRange(monthParam: string) {
  const [y, m] = monthParam.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = endOfDay(new Date(y, m, 0));
  return { from: startOfDay(from), to };
}

export async function GET(request: Request) {
  try {
    await requireOwner();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Mês inválido (YYYY-MM)" }, { status: 400 });
    }

    const { from, to } = monthRange(month);

    const [orders, expenses, movements] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: { entryAt: { gte: from, lte: to } },
        include: {
          client: { select: { name: true, phone: true } },
          vehicle: { select: { plate: true } },
          items: { select: { serviceName: true, price: true } },
        },
        orderBy: { entryAt: "asc" },
      }),
      prisma.expense.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
      }),
      prisma.stockMovement.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const lines: string[] = [];

    lines.push("ORDENS DE SERVIÇO");
    lines.push(
      ["Data", "Placa", "Cliente", "Telefone", "Status", "Pagamento", "Total", "Serviços"].map(csvEscape).join(",")
    );
    for (const o of orders) {
      lines.push(
        [
          o.entryAt.toISOString(),
          o.vehicle.plate,
          o.client.name,
          o.client.phone,
          ORDER_STATUS_LABELS[o.status] ?? o.status,
          PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod,
          o.total.toFixed(2),
          o.items.map((i) => i.serviceName).join(" + "),
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    lines.push("");
    lines.push("DESPESAS");
    lines.push(["Data", "Categoria", "Descrição", "Valor"].map(csvEscape).join(","));
    for (const e of expenses) {
      lines.push(
        [e.date.toISOString(), e.category, e.description, e.amount.toFixed(2)].map(csvEscape).join(",")
      );
    }

    lines.push("");
    lines.push("MOVIMENTAÇÕES DE ESTOQUE");
    lines.push(
      ["Data", "Produto", "Tipo", "Antes", "Depois", "Delta", "Usuário", "Obs"].map(csvEscape).join(",")
    );
    for (const m of movements) {
      lines.push(
        [
          m.createdAt.toISOString(),
          m.product.name,
          m.type,
          m.quantityBefore,
          m.quantityAfter,
          m.delta,
          m.userName,
          m.notes ?? "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const csv = "\uFEFF" + lines.join("\n");
    const filename = `gomotors-${month}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
