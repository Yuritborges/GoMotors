import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { handleAuthError, requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireOwner();
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const from = fromParam ? startOfDay(new Date(fromParam)) : undefined;
  const to = toParam ? endOfDay(new Date(toParam)) : undefined;

  const expenses = await prisma.expense.findMany({
    where:
      from && to
        ? { date: { gte: from, lte: to } }
        : undefined,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
  const body = await request.json();

  const expense = await prisma.expense.create({
    data: {
      category: body.category,
      description: body.description,
      amount: Number(body.amount),
      date: new Date(body.date),
    },
  });

  return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
