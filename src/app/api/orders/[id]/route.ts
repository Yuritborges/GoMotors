import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth();
  } catch (error) {
    return handleAuthError(error);
  }

  const { id } = await params;

  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: true,
      payments: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireOwner();
  } catch (error) {
    return handleAuthError(error);
  }

  const { id } = await params;
  const body = await request.json();

  const order = await prisma.serviceOrder.update({
    where: { id },
    data: {
      employeeId: body.employeeId,
      discount: body.discount !== undefined ? Number(body.discount) : undefined,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
      notes: body.notes,
      total:
        body.discount !== undefined
          ? undefined
          : body.total !== undefined
            ? Number(body.total)
            : undefined,
      ...(body.discount !== undefined
        ? {
            total: Math.max(
              (await prisma.serviceOrder.findUnique({ where: { id } }))!.subtotal -
                Number(body.discount),
              0
            ),
          }
        : {}),
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: true,
      payments: true,
    },
  });

  return NextResponse.json(order);
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireOwner();
    const { id } = await params;

    const existing = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { vehicle: true, client: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
    }

    await prisma.serviceOrder.delete({ where: { id } });

    await logAudit({
      user,
      action: "ORDER_DELETE",
      entityType: "order",
      entityId: id,
      summary: `${user.name} excluiu OS ${existing.vehicle.plate} (${existing.client.name})`,
      metadata: {
        plate: existing.vehicle.plate,
        total: existing.total,
        entryAt: existing.entryAt.toISOString(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
