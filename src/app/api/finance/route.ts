import { NextResponse } from "next/server";
import { getFinanceSummary } from "@/lib/finance";
import { handleAuthError, requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireOwner();
    const { searchParams } = new URL(request.url);
    const data = await getFinanceSummary(
      searchParams.get("month"),
      searchParams.get("from"),
      searchParams.get("to")
    );

    return NextResponse.json({
      ...data,
      period: {
        ...data.period,
        from: data.period.from.toISOString(),
        to: data.period.to.toISOString(),
      },
      previousPeriod: {
        ...data.previousPeriod,
        from: data.previousPeriod.from.toISOString(),
        to: data.previousPeriod.to.toISOString(),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
