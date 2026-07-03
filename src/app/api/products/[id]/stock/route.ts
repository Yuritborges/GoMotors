import { NextResponse } from "next/server";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { applyStockDelta, recordStockMovement } from "@/lib/stock-movements";
import type { StockMovementType } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

const VALID_TYPES = new Set<StockMovementType>([
  "COMPRA",
  "AJUSTE",
  "SAIDA",
  "ENTRADA",
  "INVENTARIO",
]);

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireOwner();
    const { id: productId } = await params;
    const body = await request.json();

    const type = body.type as StockMovementType;
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "Tipo de movimentação inválido" }, { status: 400 });
    }

    let movement;

    if (type === "INVENTARIO" && body.quantityAfter !== undefined) {
      movement = await recordStockMovement({
        productId,
        type,
        quantityAfter: Number(body.quantityAfter),
        user,
        notes: body.notes ?? null,
      });
    } else if (body.delta !== undefined) {
      movement = await applyStockDelta({
        productId,
        delta: Number(body.delta),
        type,
        user,
        unitCost: body.unitCost !== undefined ? Number(body.unitCost) : null,
        notes: body.notes ?? null,
      });
    } else if (type === "COMPRA" && body.quantity !== undefined) {
      movement = await applyStockDelta({
        productId,
        delta: Math.abs(Number(body.quantity)),
        type: "COMPRA",
        user,
        unitCost: body.unitCost !== undefined ? Number(body.unitCost) : null,
        notes: body.notes ?? null,
      });
    } else {
      return NextResponse.json({ error: "Informe delta ou quantityAfter" }, { status: 400 });
    }

    await logAudit({
      user,
      action: `STOCK_${type}`,
      entityType: "product",
      entityId: productId,
      summary: `${movement.userName} registrou ${type.toLowerCase()}: ${movement.quantityBefore} → ${movement.quantityAfter}`,
      metadata: {
        delta: movement.delta,
        notes: movement.notes,
        unitCost: movement.unitCost,
      },
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao movimentar estoque";
    if (message.includes("não encontrado") || message.includes("sem controle")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
