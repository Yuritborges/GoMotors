import { NextResponse } from "next/server";
import { handleAuthError, requireAuth } from "@/lib/auth";
import {
  fetchPendingByClient,
  fetchRecentSettlements,
  summarizePendingClients,
} from "@/lib/pending-payments";

export async function GET() {
  try {
    await requireAuth();

    const debtors = await fetchPendingByClient();
    const recentSettlements = await fetchRecentSettlements();

    return NextResponse.json({
      summary: summarizePendingClients(debtors),
      debtors,
      recentSettlements,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
