import { PRIMARY_WORKFLOW_TASKS } from "./order-workflow";

export type DisplayLaneKey =
  | "AGUARDANDO"
  | "LAVAGEM"
  | "ASPIRACAO"
  | "SECAGEM"
  | "EXTRAS"
  | "PRONTO";

export const DISPLAY_LANES: { key: DisplayLaneKey; label: string }[] = [
  { key: "AGUARDANDO", label: "Aguardando" },
  { key: "LAVAGEM", label: "Lavagem" },
  { key: "ASPIRACAO", label: "Aspiração" },
  { key: "SECAGEM", label: "Secagem" },
  { key: "EXTRAS", label: "Polimento / Extras" },
  { key: "PRONTO", label: "Pronto" },
];

export type DisplayLaneEntry = {
  orderId: string;
  plate: string;
  clientName: string;
  serviceName: string;
  employeeName: string | null;
  /** Só na fila de aguardando */
  queuePosition?: number;
};

export type DisplayOrderInput = {
  id: string;
  status: string;
  vehicle: { plate: string };
  client: { name: string };
  items: { serviceName: string; employee: { name: string } | null }[];
};

function normalizeService(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Classifica item da OS na coluna do telão. */
export function serviceToDisplayLane(serviceName: string): DisplayLaneKey {
  const n = normalizeService(serviceName);

  if (n === "aspiracao" || n.startsWith("aspir")) return "ASPIRACAO";
  if (n === "secagem" || n.startsWith("secag")) return "SECAGEM";

  if (
    n === "lavagem" ||
    n.includes("lavagem") ||
    n.includes("ducha") ||
    n.includes("motor") ||
    n.includes("chassi")
  ) {
    return "LAVAGEM";
  }

  return "EXTRAS";
}

const WORKFLOW_LABELS = new Set(
  PRIMARY_WORKFLOW_TASKS.map((t) => normalizeService(t.label))
);

function isWorkflowItem(serviceName: string): boolean {
  return WORKFLOW_LABELS.has(normalizeService(serviceName));
}

function isExtraItem(serviceName: string): boolean {
  return !isWorkflowItem(serviceName);
}

export function buildDisplayLanes(orders: DisplayOrderInput[]): Record<
  DisplayLaneKey,
  DisplayLaneEntry[]
> {
  const lanes: Record<DisplayLaneKey, DisplayLaneEntry[]> = {
    AGUARDANDO: [],
    LAVAGEM: [],
    ASPIRACAO: [],
    SECAGEM: [],
    EXTRAS: [],
    PRONTO: [],
  };

  const waiting = orders.filter((o) => o.status === "AGUARDANDO");
  waiting.forEach((order, index) => {
    lanes.AGUARDANDO.push({
      orderId: order.id,
      plate: order.vehicle.plate,
      clientName: order.client.name.split(" ")[0],
      serviceName: order.items.map((i) => i.serviceName).join(" · ") || "—",
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
        if (isExtraItem(item.serviceName) && serviceToDisplayLane(item.serviceName) === "EXTRAS") {
          continue;
        }
        const lane = serviceToDisplayLane(item.serviceName);
        if (lane === "EXTRAS") continue;
        lanes[lane].push({
          ...base,
          serviceName: item.serviceName,
          employeeName: item.employee?.name ?? null,
        });
      }
      continue;
    }

    if (order.status === "FINALIZACAO") {
      for (const item of order.items) {
        if (isWorkflowItem(item.serviceName)) continue;
        lanes.EXTRAS.push({
          ...base,
          serviceName: item.serviceName,
          employeeName: item.employee?.name ?? null,
        });
      }
      continue;
    }
  }

  for (const order of orders.filter((o) => o.status === "PRONTO")) {
    lanes.PRONTO.push({
      orderId: order.id,
      plate: order.vehicle.plate,
      clientName: order.client.name.split(" ")[0],
      serviceName: order.items.map((i) => i.serviceName).join(" · ") || "—",
      employeeName: order.items.find((i) => i.employee)?.employee?.name ?? null,
    });
  }

  return lanes;
}

export function displayLaneStats(lanes: Record<DisplayLaneKey, DisplayLaneEntry[]>) {
  const activePlates = new Set<string>();
  for (const key of ["LAVAGEM", "ASPIRACAO", "SECAGEM", "EXTRAS"] as DisplayLaneKey[]) {
    for (const entry of lanes[key]) activePlates.add(entry.plate);
  }

  return {
    aguardando: lanes.AGUARDANDO.length,
    emServico: activePlates.size,
    lavagem: lanes.LAVAGEM.length,
    aspiracao: lanes.ASPIRACAO.length,
    secagem: lanes.SECAGEM.length,
    extras: lanes.EXTRAS.length,
    prontos: lanes.PRONTO.length,
  };
}
