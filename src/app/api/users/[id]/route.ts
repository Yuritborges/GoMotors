import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleAuthError,
  hashPassword,
  requireOwner,
} from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const session = await requireOwner();
    const { id } = await params;
    const body = await request.json();

    if (id === session.id && body.active === false) {
      return NextResponse.json(
        { error: "Você não pode desativar sua própria conta" },
        { status: 400 }
      );
    }

    const data: {
      name?: string;
      email?: string;
      role?: "PROPRIETARIO" | "ATENDENTE";
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (body.name) data.name = body.name;
    if (body.email) {
      const email = String(body.email).trim().toLowerCase();
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: "E-mail já em uso" }, { status: 409 });
      }
      data.email = email;
    }
    if (body.role) data.role = body.role;
    if (body.active !== undefined) data.active = body.active;
    if (body.password && String(body.password).length >= 6) {
      data.passwordHash = await hashPassword(String(body.password));
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireOwner();
    const { id } = await params;

    if (id === session.id) {
      return NextResponse.json(
        { error: "Você não pode excluir sua própria conta" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
