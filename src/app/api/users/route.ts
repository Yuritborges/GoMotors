import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleAuthError,
  hashPassword,
  requireOwner,
} from "@/lib/auth";

export async function GET() {
  try {
    await requireOwner();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!body.name || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Nome, e-mail e senha (mín. 6 caracteres) são obrigatórios" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "E-mail já cadastrado" },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        passwordHash: await hashPassword(password),
        role: body.role === "PROPRIETARIO" ? "PROPRIETARIO" : "ATENDENTE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
