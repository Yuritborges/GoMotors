import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth();
  } catch (error) {
    return handleAuthError(error);
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      vehicles: true,
      orders: {
        include: {
          vehicle: true,
          items: true,
          employee: true,
        },
        orderBy: { entryAt: "desc" },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireAuth();
  } catch (error) {
    return handleAuthError(error);
  }

  const { id } = await params;
  const body = await request.json();

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone,
      notes: body.notes ?? null,
    },
    include: { vehicles: true },
  });

  return NextResponse.json(client);
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
  } catch (error) {
    return handleAuthError(error);
  }

  const { id } = await params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
