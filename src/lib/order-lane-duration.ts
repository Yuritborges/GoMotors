import { BUSINESS_TIMEZONE } from "@/lib/business-day";
import { getItemsForLane } from "@/lib/order-lanes";
import type { DisplayLaneDurations } from "@/lib/shop-settings";

export type LaneTimingItem = {
  serviceName: string;
  estimatedMinutes?: number | null;
};

export function getLaneEstimatedMinutes(
  lane: string,
  items: LaneTimingItem[],
  durations: DisplayLaneDurations
): number {
  if (lane === "AGUARDANDO" || lane === "PRONTO") return 0;
  if (lane === "LAVAGEM") return durations.lavagem;
  if (lane === "ASPIRACAO") return durations.aspiracao;
  if (lane === "SECAGEM") return durations.secagem;
  if (lane === "FINALIZACAO") return durations.finalizacao;

  if (lane.startsWith("extra:")) {
    const laneItems = getItemsForLane(items, lane);
    if (laneItems.length === 0) return 30;
    return Math.max(...laneItems.map((i) => i.estimatedMinutes ?? 30));
  }

  return 30;
}

export function elapsedMs(laneEnteredAt: Date, now = new Date()): number {
  return Math.max(0, now.getTime() - laneEnteredAt.getTime());
}

export function isLaneOverdue(
  laneEnteredAt: Date,
  estimatedMinutes: number,
  now = new Date()
): boolean {
  if (estimatedMinutes <= 0) return false;
  return elapsedMs(laneEnteredAt, now) >= estimatedMinutes * 60_000;
}

export function formatElapsedTimer(laneEnteredAt: Date, now = new Date()): string {
  const totalSec = Math.floor(elapsedMs(laneEnteredAt, now) / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const laneClockFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function formatLaneClockTime(instant: Date): string {
  return laneClockFormatter.format(instant);
}

export function getLaneEstimatedEndAt(laneEnteredAt: Date, estimatedMinutes: number): Date {
  return new Date(laneEnteredAt.getTime() + estimatedMinutes * 60_000);
}
