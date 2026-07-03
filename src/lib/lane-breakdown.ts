import { buildOperationalColumns } from "@/lib/display-lanes";
import type { DisplayOrderInput } from "@/lib/display-lanes-types";

export type LaneBreakdownItem = {
  lane: string;
  label: string;
  count: number;
  fixed: boolean;
};

/** Contagem por etapa operacional (painel, telão, caixa). */
export function buildLaneBreakdown(orders: DisplayOrderInput[]): LaneBreakdownItem[] {
  const columns = buildOperationalColumns(orders);
  return columns.map((col) => ({
    lane: col.lane,
    label: col.label,
    count: col.entries.length,
    fixed: col.fixed,
  }));
}
