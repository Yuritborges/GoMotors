import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { buildDailyCashReport } from "@/lib/cash-report";
import { findCashClosingByDateKey } from "@/lib/cash-closing-date";
import type { DailyCashReport } from "@/lib/cash-report";
import {
  EXPENSE_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";

type Params = { params: Promise<{ date: string }> };

function csvLine(cols: (string | number)[]) {
  return cols
    .map((v) => {
      const s = String(v);
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(";");
}

export async function GET(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { date } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }

    const closing = await findCashClosingByDateKey(prisma, date);
    const report = closing
      ? (closing.snapshot as DailyCashReport)
      : await buildDailyCashReport(date);

    if (format === "csv" || format === "xlsx") {
      const lines: string[] = [];
      lines.push("FECHAMENTO DE CAIXA — GO MOTORS");
      lines.push(`Data;${report.dateLabel}`);
      lines.push("");
      lines.push("RESUMO");
      lines.push(`Total recebido;${report.totalSold.toFixed(2)}`);
      lines.push(`Despesas operacionais;${report.totalExpenses.toFixed(2)}`);
      lines.push(`Vales/funcionários;${report.employeeExpenses.toFixed(2)}`);
      lines.push(`Lucro estimado;${report.estimatedResult.toFixed(2)}`);
      lines.push(`Veículos;${report.vehicleCount}`);
      lines.push(`Pagos;${report.paidCount}`);
      lines.push(`Pendentes;${report.pendingPaymentCount}`);
      lines.push(`Ticket médio;${report.averageTicket.toFixed(2)}`);
      lines.push("");
      lines.push("FORMAS DE PAGAMENTO");
      for (const [method, amount] of Object.entries(report.byPaymentMethod)) {
        lines.push(`${PAYMENT_METHOD_LABELS[method] ?? method};${amount.toFixed(2)}`);
      }
      lines.push("");
      lines.push("DESPESAS DO DIA");
      lines.push("Descrição;Categoria;Valor");
      for (const e of report.expenses) {
        lines.push(
          csvLine([
            e.description,
            EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
            e.amount.toFixed(2),
          ])
        );
      }
      lines.push("");
      lines.push("MOVIMENTAÇÃO");
      lines.push("Hora;Placa;Cliente;Serviços;Status;Pagamento;Valor");
      for (const o of report.todayOrders) {
        const time = new Date(o.entryAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        lines.push(
          csvLine([
            time,
            o.plate,
            o.clientName,
            o.services,
            ORDER_STATUS_LABELS[o.status] ?? o.status,
            `${PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus} · ${PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}`,
            o.total.toFixed(2),
          ])
        );
      }

      const csv = "\uFEFF" + lines.join("\n");
      const ext = format === "xlsx" ? "xlsx" : "csv";
      const mime =
        format === "xlsx"
          ? "application/vnd.ms-excel;charset=utf-8"
          : "text/csv;charset=utf-8";

      return new NextResponse(csv, {
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="fechamento-caixa-${date}.${ext}"`,
        },
      });
    }

    return NextResponse.json({ error: "Formato não suportado" }, { status: 400 });
  } catch (error) {
    return handleAuthError(error);
  }
}
