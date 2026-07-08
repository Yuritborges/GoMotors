import { NextResponse } from "next/server";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { buildDailyCashReport } from "@/lib/cash-report";

export async function GET(request: Request) {
  try {
    await requireOwner();
    const { searchParams } = new URL(request.url);
    const report = await buildDailyCashReport(searchParams.get("date"));
    return NextResponse.json(report);
  } catch (error) {
    return handleAuthError(error);
  }
}
