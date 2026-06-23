import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const body = await request.json();
  const employee = await prisma.employee.create({
    data: { name: body.name },
  });
  return NextResponse.json(employee, { status: 201 });
}
