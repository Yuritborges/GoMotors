import { FIXED_DISPLAY_LANES } from "./display-lanes-constants";
import type {
  DisplayColumn,
  DisplayLaneEntry,
  DisplayOrderInput,
  FixedDisplayLaneKey,
} from "./display-lanes-types";
import {
  displayServiceLabel,
  dynamicLaneKey,
} from "./order-service-lanes";
import {
  getItemsForLane,
  resolveOrderLane,
} from "./order-lanes";

export type {
  DisplayColumn,
  DisplayLaneEntry,
  DisplayOrderInput,
  FixedDisplayLaneKey,
} from "./display-lanes-types";
export { FIXED_DISPLAY_LANES } from "./display-lanes-constants";

function entryForLane(
  order: DisplayOrderInput,
  lane: string
): DisplayLaneEntry {
  const base = {
    orderId: order.id,
    plate: order.vehicle.plate,
    clientName: order.client.name.split(" ")[0],
  };

  const laneItems = order.items.filter((item) =>
    getItemsForLane([item], lane).length > 0
  );
  const primary = laneItems[0];

  return {
    ...base,
    serviceName: primary?.serviceName ?? "—",
    employeeName: primary?.employee?.name ?? null,
  };
}

/** Monta colunas operacionais — uma OS aparece em uma única etapa por vez. */
export function buildOperationalColumns(orders: DisplayOrderInput[]): DisplayColumn[] {
  const fixed: Record<FixedDisplayLaneKey, DisplayLaneEntry[]> = {
    AGUARDANDO: [],
    LAVAGEM: [],
    ASPIRACAO: [],
    SECAGEM: [],
    FINALIZACAO: [],
    PRONTO: [],
  };
  const dynamic = new Map<string, { label: string; entries: DisplayLaneEntry[] }>();

  let queuePosition = 0;

  for (const order of orders) {
    const lane = resolveOrderLane(order);

    if (lane === "AGUARDANDO") {
      queuePosition += 1;
      fixed.AGUARDANDO.push({
        orderId: order.id,
        plate: order.vehicle.plate,
        clientName: order.client.name.split(" ")[0],
        serviceName: "—",
        employeeName: null,
        queuePosition,
      });
      continue;
    }

    if (lane === "PRONTO") {
      fixed.PRONTO.push({
        orderId: order.id,
        plate: order.vehicle.plate,
        clientName: order.client.name.split(" ")[0],
        serviceName: "—",
        employeeName: null,
      });
      continue;
    }

    if (lane === "FINALIZACAO") {
      fixed.FINALIZACAO.push({
        orderId: order.id,
        plate: order.vehicle.plate,
        clientName: order.client.name.split(" ")[0],
        serviceName: "—",
        employeeName: null,
      });
      continue;
    }

    const entry = entryForLane(order, lane);

    if (lane === "LAVAGEM") fixed.LAVAGEM.push(entry);
    else if (lane === "ASPIRACAO") fixed.ASPIRACAO.push(entry);
    else if (lane === "SECAGEM") fixed.SECAGEM.push(entry);
    else if (lane.startsWith("extra:")) {
      const label =
        entry.serviceName !== "—"
          ? displayServiceLabel(entry.serviceName)
          : getDynamicLabelFromLane(lane);
      const bucket = dynamic.get(lane) ?? { label, entries: [] };
      bucket.entries.push(entry);
      dynamic.set(lane, bucket);
    }
  }

  const columns: DisplayColumn[] = [];

  for (const { key, label } of FIXED_DISPLAY_LANES) {
    if (key === "FINALIZACAO" || key === "PRONTO") continue;
    columns.push({ lane: key, label, fixed: true, entries: fixed[key] });
  }

  const dynamicSorted = [...dynamic.entries()].sort((a, b) =>
    a[1].label.localeCompare(b[1].label, "pt-BR")
  );
  for (const [lane, { label, entries }] of dynamicSorted) {
    if (entries.length === 0) continue;
    columns.push({ lane, label, fixed: false, entries });
  }

  columns.push({
    lane: "FINALIZACAO",
    label: "Finalização",
    fixed: true,
    entries: fixed.FINALIZACAO,
  });

  columns.push({
    lane: "PRONTO",
    label: "Pronto",
    fixed: true,
    entries: fixed.PRONTO,
  });

  return columns;
}

function getDynamicLabelFromLane(lane: string): string {
  const name = lane.startsWith("extra:") ? lane.slice(6) : lane;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Telão e painel: fixas + extras dinâmicos + Finalização fixa. */
export function buildDisplayColumns(orders: DisplayOrderInput[]): DisplayColumn[] {
  return buildOperationalColumns(orders);
}

export function displayLaneStats(columns: DisplayColumn[]) {
  const byLane = Object.fromEntries(columns.map((c) => [c.lane, c.entries]));

  const activePlates = new Set<string>();
  for (const col of columns) {
    if (col.lane === "AGUARDANDO" || col.lane === "PRONTO") continue;
    for (const entry of col.entries) activePlates.add(entry.plate);
  }

  return {
    aguardando: byLane.AGUARDANDO?.length ?? 0,
    emServico: activePlates.size,
    lavagem: byLane.LAVAGEM?.length ?? 0,
    aspiracao: byLane.ASPIRACAO?.length ?? 0,
    secagem: byLane.SECAGEM?.length ?? 0,
    prontos: byLane.PRONTO?.length ?? 0,
  };
}

/** Colunas dinâmicas ativas entre os pedidos (para painel). */
export function collectActiveDynamicLanes(
  orders: DisplayOrderInput[]
): { lane: string; label: string }[] {
  const lanes = new Map<string, string>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = dynamicLaneKey(item.serviceName);
      if (!key.startsWith("extra:")) continue;
      lanes.set(key, displayServiceLabel(item.serviceName));
    }
  }

  return [...lanes.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .map(([lane, label]) => ({ lane, label }));
}
