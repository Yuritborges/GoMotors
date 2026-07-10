import { buildOperationalColumns } from "@/lib/display-lanes";
import type { DisplayOrderInput } from "@/lib/display-lanes-types";
import { DEFAULT_DISPLAY_LANE_DURATIONS } from "@/lib/shop-settings";

export type LaneBreakdownItem = {
  lane: string;
  label: string;
  count: number;
  fixed: boolean;
};

/** Contagem por etapa operacional (painel, telão, caixa). */
export function buildLaneBreakdown(orders: DisplayOrderInput[]): LaneBreakdownItem[] {
  const columns = buildOperationalColumns(orders, DEFAULT_DISPLAY_LANE_DURATIONS);
  return columns.map((col) => ({
    lane: col.lane,
    label: col.label,
    count: col.entries.length,
    fixed: col.fixed,
  }));
}
