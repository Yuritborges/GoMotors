import type { PrismaClient } from "@/generated/prisma/client";

export type DisplayLaneDurations = {
  lavagem: number;
  aspiracao: number;
  secagem: number;
  finalizacao: number;
};

export const DEFAULT_DISPLAY_LANE_DURATIONS: DisplayLaneDurations = {
  lavagem: 20,
  aspiracao: 20,
  secagem: 20,
  finalizacao: 20,
};

export async function getDisplayLaneDurations(
  prisma: PrismaClient
): Promise<DisplayLaneDurations> {
  const row = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_DISPLAY_LANE_DURATIONS;
  return {
    lavagem: row.laneLavagemMinutes,
    aspiracao: row.laneAspiracaoMinutes,
    secagem: row.laneSecagemMinutes,
    finalizacao: row.laneFinalizacaoMinutes,
  };
}

export async function ensureShopSettings(prisma: PrismaClient) {
  return prisma.shopSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      laneLavagemMinutes: DEFAULT_DISPLAY_LANE_DURATIONS.lavagem,
      laneAspiracaoMinutes: DEFAULT_DISPLAY_LANE_DURATIONS.aspiracao,
      laneSecagemMinutes: DEFAULT_DISPLAY_LANE_DURATIONS.secagem,
      laneFinalizacaoMinutes: DEFAULT_DISPLAY_LANE_DURATIONS.finalizacao,
    },
    update: {},
  });
}

export function workflowTaskMinutes(
  label: string,
  durations: DisplayLaneDurations
): number {
  const n = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (n === "lavagem") return durations.lavagem;
  if (n === "aspiracao") return durations.aspiracao;
  if (n === "secagem") return durations.secagem;
  return durations.lavagem;
}
