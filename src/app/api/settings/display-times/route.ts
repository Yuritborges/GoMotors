import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";
import {
  DEFAULT_DISPLAY_LANE_DURATIONS,
  ensureShopSettings,
  getDisplayLaneDurations,
} from "@/lib/shop-settings";

function parseMinutes(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 480 ? Math.round(n) : fallback;
}

export async function GET() {
  try {
    await requireAuth();
    await ensureShopSettings(prisma);

    const [lanes, services] = await Promise.all([
      getDisplayLaneDurations(prisma),
      prisma.service.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          category: true,
          estimatedMinutes: true,
          active: true,
        },
      }),
    ]);

    return NextResponse.json({ lanes, services });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();

    const lanes = {
      lavagem: parseMinutes(body.lanes?.lavagem, DEFAULT_DISPLAY_LANE_DURATIONS.lavagem),
      aspiracao: parseMinutes(body.lanes?.aspiracao, DEFAULT_DISPLAY_LANE_DURATIONS.aspiracao),
      secagem: parseMinutes(body.lanes?.secagem, DEFAULT_DISPLAY_LANE_DURATIONS.secagem),
      finalizacao: parseMinutes(
        body.lanes?.finalizacao,
        DEFAULT_DISPLAY_LANE_DURATIONS.finalizacao
      ),
    };

    const serviceUpdates = Array.isArray(body.services) ? body.services : [];

    await prisma.$transaction(async (tx) => {
      await tx.shopSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          laneLavagemMinutes: lanes.lavagem,
          laneAspiracaoMinutes: lanes.aspiracao,
          laneSecagemMinutes: lanes.secagem,
          laneFinalizacaoMinutes: lanes.finalizacao,
        },
        update: {
          laneLavagemMinutes: lanes.lavagem,
          laneAspiracaoMinutes: lanes.aspiracao,
          laneSecagemMinutes: lanes.secagem,
          laneFinalizacaoMinutes: lanes.finalizacao,
        },
      });

      for (const row of serviceUpdates) {
        const id = String(row.id ?? "");
        if (!id) continue;
        await tx.service.update({
          where: { id },
          data: { estimatedMinutes: parseMinutes(row.estimatedMinutes, 20) },
        });
      }
    });

    const services = await prisma.service.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        estimatedMinutes: true,
        active: true,
      },
    });

    return NextResponse.json({ lanes, services });
  } catch (error) {
    return handleAuthError(error);
  }
}
