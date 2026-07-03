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

const TYPE_LABELS: Record<StockMovementType, string> = {
  COMPRA: "compra",
  AJUSTE: "ajuste",
  SAIDA: "saída",
  ENTRADA: "entrada",
  INVENTARIO: "inventário",
};

function stockAuditSummary(params: {
  userName: string;
  type: StockMovementType;
  productName: string;
  quantityBefore: number;
  quantityAfter: number;
  delta: number;
  notes?: string | null;
}) {
  const deltaText =
    params.delta !== 0
      ? ` (${params.delta > 0 ? "+" : ""}${params.delta} un.)`
      : "";
  const notesText = params.notes ? ` — ${params.notes}` : "";
  return `${params.userName} registrou ${TYPE_LABELS[params.type]} de "${params.productName}": ${params.quantityBefore} → ${params.quantityAfter}${deltaText}${notesText}`;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireOwner();
    const { id: productId } = await params;
    const body = await request.json();

    const type = body.type as StockMovementType;
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "Tipo de movimentação inválido" }, { status: 400 });
    }

    let result;

    if (type === "INVENTARIO" && body.quantityAfter !== undefined) {
      result = await recordStockMovement({
        productId,
        type,
        quantityAfter: Number(body.quantityAfter),
        user,
        notes: body.notes ?? null,
      });
    } else if (body.delta !== undefined) {
      result = await applyStockDelta({
        productId,
        delta: Number(body.delta),
        type,
        user,
        unitCost: body.unitCost !== undefined ? Number(body.unitCost) : null,
        notes: body.notes ?? null,
      });
    } else if (type === "COMPRA" && body.quantity !== undefined) {
      result = await applyStockDelta({
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

    const { movement, productName } = result;

    await logAudit({
      user,
      action: `STOCK_${type}`,
      entityType: "product",
      entityId: productId,
      summary: stockAuditSummary({
        userName: movement.userName,
        type,
        productName,
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter,
        delta: movement.delta,
        notes: movement.notes,
      }),
      metadata: {
        productName,
        productId,
        delta: movement.delta,
        notes: movement.notes,
        unitCost: movement.unitCost,
        movementType: type,
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
