import { PRIMARY_WORKFLOW_TASKS } from "./order-workflow";

export type FixedDisplayLaneKey =
  | "AGUARDANDO"
  | "LAVAGEM"
  | "ASPIRACAO"
  | "SECAGEM"
  | "PRONTO";

export const FIXED_DISPLAY_LANES: { key: FixedDisplayLaneKey; label: string }[] = [
  { key: "AGUARDANDO", label: "Aguardando" },
  { key: "LAVAGEM", label: "Lavagem" },
  { key: "ASPIRACAO", label: "Aspiração" },
  { key: "SECAGEM", label: "Secagem" },
  { key: "PRONTO", label: "Pronto" },
];

export type DisplayLaneEntry = {
  orderId: string;
  plate: string;
  clientName: string;
  serviceName: string;
  employeeName: string | null;
  queuePosition?: number;
};

export type DisplayColumn = {
  lane: string;
  label: string;
  fixed: boolean;
  entries: DisplayLaneEntry[];
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

const WORKFLOW_LABELS = new Set(
  PRIMARY_WORKFLOW_TASKS.map((t) => normalizeService(t.label))
);

function isWorkflowItem(serviceName: string): boolean {
  return WORKFLOW_LABELS.has(normalizeService(serviceName));
}

/** Lavagem simples/completa etc. entram na coluna Lavagem, não como extra dinâmico. */
function isLavagemColumnItem(serviceName: string): boolean {
  if (isWorkflowItem(serviceName)) {
    return normalizeService(serviceName) === "lavagem";
  }
  const n = normalizeService(serviceName);
  return (
    n.includes("lavagem") ||
    n.includes("ducha") ||
    n.includes("motor") ||
    n.includes("chassi")
  );
}

function isAspiracaoItem(serviceName: string): boolean {
  const n = normalizeService(serviceName);
  return n === "aspiracao" || n.startsWith("aspir");
}

function isSecagemItem(serviceName: string): boolean {
  const n = normalizeService(serviceName);
  return n === "secagem" || n.startsWith("secag");
}

/** Serviço extra (Polimento, Higienização…) — coluna dinâmica só se houver carro. */
function isDynamicExtraItem(serviceName: string): boolean {
  if (isAspiracaoItem(serviceName) || isSecagemItem(serviceName)) return false;
  if (isLavagemColumnItem(serviceName)) return false;
  return true;
}

function dynamicLaneKey(serviceName: string): string {
  return `extra:${normalizeService(serviceName)}`;
}

function displayLabel(serviceName: string): string {
  const trimmed = serviceName.trim();
  if (!trimmed) return "Serviço";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

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
          label: displayLabel(item.serviceName),
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
