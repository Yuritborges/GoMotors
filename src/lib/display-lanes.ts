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
  isAspiracaoItem,
  isDynamicExtraItem,
  isLavagemColumnItem,
  isSecagemItem,
} from "./order-service-lanes";

export type {
  DisplayColumn,
  DisplayLaneEntry,
  DisplayOrderInput,
  FixedDisplayLaneKey,
} from "./display-lanes-types";
export { FIXED_DISPLAY_LANES } from "./display-lanes-constants";

export function buildDisplayColumns(orders: DisplayOrderInput[]): DisplayColumn[] {
  const fixed: Record<FixedDisplayLaneKey, DisplayLaneEntry[]> = {
    AGUARDANDO: [],
    LAVAGEM: [],
    ASPIRACAO: [],
    SECAGEM: [],
    PRONTO: [],
  };
  const dynamic = new Map<string, { label: string; entries: DisplayLaneEntry[] }>();

  const waiting = orders.filter((o) => o.status === "AGUARDANDO");
  waiting.forEach((order, index) => {
    fixed.AGUARDANDO.push({
      orderId: order.id,
      plate: order.vehicle.plate,
      clientName: order.client.name.split(" ")[0],
      serviceName: "—",
      employeeName: null,
      queuePosition: index + 1,
    });
  });

  for (const order of orders) {
    if (order.status === "AGUARDANDO" || order.status === "PRONTO") continue;

    const base = {
      orderId: order.id,
      plate: order.vehicle.plate,
      clientName: order.client.name.split(" ")[0],
    };

    if (order.status === "EM_LAVAGEM") {
      for (const item of order.items) {
        const entry: DisplayLaneEntry = {
          ...base,
          serviceName: item.serviceName,
          employeeName: item.employee?.name ?? null,
        };
        if (isAspiracaoItem(item.serviceName)) {
          fixed.ASPIRACAO.push(entry);
        } else if (isSecagemItem(item.serviceName)) {
          fixed.SECAGEM.push(entry);
        } else if (isLavagemColumnItem(item.serviceName)) {
          fixed.LAVAGEM.push(entry);
        }
      }
      continue;
    }

    if (order.status === "FINALIZACAO") {
      for (const item of order.items) {
        if (!isDynamicExtraItem(item.serviceName)) continue;
        const key = dynamicLaneKey(item.serviceName);
        const bucket = dynamic.get(key) ?? {
          label: displayServiceLabel(item.serviceName),
          entries: [],
        };
        bucket.entries.push({
          ...base,
          serviceName: item.serviceName,
          employeeName: item.employee?.name ?? null,
        });
        dynamic.set(key, bucket);
      }
    }
  }

  for (const order of orders.filter((o) => o.status === "PRONTO")) {
    fixed.PRONTO.push({
      orderId: order.id,
      plate: order.vehicle.plate,
      clientName: order.client.name.split(" ")[0],
      serviceName: "—",
      employeeName: null,
    });
  }

  const columns: DisplayColumn[] = [];

  for (const { key, label } of FIXED_DISPLAY_LANES) {
    if (key === "PRONTO") continue;
    columns.push({
      lane: key,
      label,
      fixed: true,
      entries: fixed[key],
    });
  }

  const dynamicSorted = [...dynamic.entries()].sort((a, b) =>
    a[1].label.localeCompare(b[1].label, "pt-BR")
  );
  for (const [lane, { label, entries }] of dynamicSorted) {
    if (entries.length === 0) continue;
    columns.push({ lane, label, fixed: false, entries });
  }

  columns.push({
    lane: "PRONTO",
    label: "Pronto",
    fixed: true,
    entries: fixed.PRONTO,
  });

  return columns;
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
