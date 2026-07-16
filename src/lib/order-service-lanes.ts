import { PRIMARY_WORKFLOW_TASKS } from "./order-workflow";

export type OrderItemLike = { serviceName: string; estimatedMinutes?: number | null };

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
export function isLavagemColumnItem(serviceName: string): boolean {
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

export function isAspiracaoItem(serviceName: string): boolean {
  const n = normalizeService(serviceName);
  return n === "aspiracao" || n.startsWith("aspir");
}

export function isSecagemItem(serviceName: string): boolean {
  const n = normalizeService(serviceName);
  return n === "secagem" || n.startsWith("secag");
}

/** Serviço extra (Polimento, Higienização…) — coluna dinâmica no telão. */
export function isDynamicExtraItem(serviceName: string): boolean {
  if (isAspiracaoItem(serviceName) || isSecagemItem(serviceName)) return false;
  if (isLavagemColumnItem(serviceName)) return false;
  return true;
}

/** Etapas que aparecem nas colunas Lavagem / Aspiração / Secagem (status EM_LAVAGEM). */
export function isWashPipelineItem(serviceName: string): boolean {
  return (
    isLavagemColumnItem(serviceName) ||
    isAspiracaoItem(serviceName) ||
    isSecagemItem(serviceName)
  );
}

export function orderHasWashPipeline(items: OrderItemLike[]): boolean {
  return items.some((i) => isWashPipelineItem(i.serviceName));
}

export function orderHasDynamicExtras(items: OrderItemLike[]): boolean {
  return items.some((i) => isDynamicExtraItem(i.serviceName));
}

export function dynamicLaneKey(serviceName: string): string {
  return `extra:${normalizeService(serviceName)}`;
}

export function displayServiceLabel(serviceName: string): string {
  const trimmed = serviceName.trim();
  if (!trimmed) return "SERVIÇO";
  return trimmed.toLocaleUpperCase("pt-BR");
}
