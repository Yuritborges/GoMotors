import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";
import {
  DEFAULT_DISPLAY_LANE_DURATIONS,
  ensureShopSettings,
  getDisplayLaneDurations,
} from "@/lib/shop-settings";

export async function GET() {
  try {
    await requireAuth();
    await ensureShopSettings(prisma);
    const durations = await getDisplayLaneDurations(prisma);
    return NextResponse.json(durations);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();

    function minutes(value: unknown, fallback: number) {
      const n = Number(value);
      return Number.isFinite(n) && n >= 1 && n <= 480 ? Math.round(n) : fallback;
    }

    const durations = {
      lavagem: minutes(body.lavagem, DEFAULT_DISPLAY_LANE_DURATIONS.lavagem),
      aspiracao: minutes(body.aspiracao, DEFAULT_DISPLAY_LANE_DURATIONS.aspiracao),
      secagem: minutes(body.secagem, DEFAULT_DISPLAY_LANE_DURATIONS.secagem),
      finalizacao: minutes(body.finalizacao, DEFAULT_DISPLAY_LANE_DURATIONS.finalizacao),
    };

    await prisma.shopSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        laneLavagemMinutes: durations.lavagem,
        laneAspiracaoMinutes: durations.aspiracao,
        laneSecagemMinutes: durations.secagem,
        laneFinalizacaoMinutes: durations.finalizacao,
      },
      update: {
        laneLavagemMinutes: durations.lavagem,
        laneAspiracaoMinutes: durations.aspiracao,
        laneSecagemMinutes: durations.secagem,
        laneFinalizacaoMinutes: durations.finalizacao,
      },
    });

    return NextResponse.json(durations);
  } catch (error) {
    return handleAuthError(error);
  }
}
