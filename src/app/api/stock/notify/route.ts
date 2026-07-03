import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { sendEmail, stockAlertEmailTo } from "@/lib/email";

export async function POST() {
  try {
    await requireOwner();

    const to = stockAlertEmailTo();
    if (!to) {
      return NextResponse.json(
        {
          error:
            "Configure STOCK_ALERT_EMAIL no servidor (Vercel) para receber alertas por e-mail.",
        },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      where: { active: true, stock: { not: null } },
      orderBy: { name: "asc" },
    });

    const low = products.filter((p) => p.stock !== null && p.stock <= p.minStock);
    if (low.length === 0) {
      return NextResponse.json({ ok: true, message: "Nenhum produto com estoque baixo." });
    }

    const lines = low.map(
      (p) => `• ${p.name}: ${p.stock} un (mínimo ${p.minStock})`
    );

    const result = await sendEmail({
      to,
      subject: `[Go Motors] ${low.length} produto(s) com estoque baixo`,
      text: `Alerta de estoque — Go Motors\n\n${lines.join("\n")}\n\nAcesse o sistema para repor.`,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Falha ao enviar e-mail" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sent: low.length });
  } catch (error) {
    return handleAuthError(error);
  }
}
