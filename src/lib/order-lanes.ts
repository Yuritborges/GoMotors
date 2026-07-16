import {
  displayServiceLabel,
  dynamicLaneKey,
  isAspiracaoItem,
  isDynamicExtraItem,
  isLavagemColumnItem,
  isSecagemItem,
  type OrderItemLike,
} from "./order-service-lanes";

export const FIXED_LANE_LABELS: Record<string, string> = {
  AGUARDANDO: "AGUARDANDO",
  LAVAGEM: "LAVAGEM",
  ASPIRACAO: "ASPIRAÇÃO",
  SECAGEM: "SECAGEM",
  FINALIZACAO: "FINALIZAÇÃO",
  PRONTO: "PRONTO",
};

export type OrderLaneInput = {
  status: string;
  currentLane?: string | null;
  items: OrderItemLike[];
};

/** Sequência de etapas da OS — pula serviços que não foram contratados. */
export function buildOrderLaneSequence(items: OrderItemLike[]): string[] {
  const lanes: string[] = ["AGUARDANDO"];

  if (items.some((i) => isLavagemColumnItem(i.serviceName))) lanes.push("LAVAGEM");
  if (items.some((i) => isAspiracaoItem(i.serviceName))) lanes.push("ASPIRACAO");
  if (items.some((i) => isSecagemItem(i.serviceName))) lanes.push("SECAGEM");

  const dynamicLabels = new Map<string, string>();
  for (const item of items) {
    if (!isDynamicExtraItem(item.serviceName)) continue;
    const key = dynamicLaneKey(item.serviceName);
    dynamicLabels.set(key, displayServiceLabel(item.serviceName));
  }

  const dynamicSorted = [...dynamicLabels.entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "pt-BR")
  );
  lanes.push(...dynamicSorted.map(([key]) => key));

  lanes.push("FINALIZACAO", "PRONTO");
  return lanes;
}

export function getLaneLabel(lane: string): string {
  if (FIXED_LANE_LABELS[lane]) return FIXED_LANE_LABELS[lane];
  if (lane.startsWith("extra:")) {
    return lane.slice(6).toLocaleUpperCase("pt-BR");
  }
  return lane.toLocaleUpperCase("pt-BR");
}

export function getItemsForLane(
  items: OrderItemLike[],
  lane: string
): OrderItemLike[] {
  if (lane === "LAVAGEM") {
    return items.filter((i) => isLavagemColumnItem(i.serviceName));
  }
  if (lane === "ASPIRACAO") {
    return items.filter((i) => isAspiracaoItem(i.serviceName));
  }
  if (lane === "SECAGEM") {
    return items.filter((i) => isSecagemItem(i.serviceName));
  }
  if (lane.startsWith("extra:")) {
    return items.filter((i) => dynamicLaneKey(i.serviceName) === lane);
  }
  return [];
}

export function inferLaneFromLegacyStatus(
  status: string,
  items: OrderItemLike[]
): string {
  if (status === "AGUARDANDO") return "AGUARDANDO";
  if (status === "PRONTO" || status === "ENTREGUE") return "PRONTO";
  if (status === "FINALIZACAO") return "FINALIZACAO";

  const seq = buildOrderLaneSequence(items);
  const serviceLanes = seq.filter(
    (l) => !["AGUARDANDO", "FINALIZACAO", "PRONTO"].includes(l)
  );
  return serviceLanes[0] ?? "FINALIZACAO";
}

export function resolveOrderLane(order: OrderLaneInput): string {
  if (order.currentLane) return order.currentLane;
  return inferLaneFromLegacyStatus(order.status, order.items);
}

export function getNextLane(
  currentLane: string,
  items: OrderItemLike[]
): string | null {
  const seq = buildOrderLaneSequence(items);
  let idx = seq.indexOf(currentLane);
  if (idx === -1) {
    idx = 0;
  }
  if (idx >= seq.length - 1) return null;
  return seq[idx + 1];
}

export function getNextLaneLabel(
  currentLane: string,
  items: OrderItemLike[]
): string | null {
  const next = getNextLane(currentLane, items);
  return next ? getLaneLabel(next) : null;
}

export function laneToStatus(lane: string): string {
  if (lane === "AGUARDANDO") return "AGUARDANDO";
  if (lane === "PRONTO") return "PRONTO";
  if (lane === "FINALIZACAO") return "FINALIZACAO";
  return "EM_LAVAGEM";
}

export function isOrderInService(order: OrderLaneInput): boolean {
  const lane = resolveOrderLane(order);
  return lane !== "AGUARDANDO" && lane !== "PRONTO";
}
