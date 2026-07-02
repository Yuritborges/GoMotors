/** Etapas operacionais fixas do lava-rápido (sempre no topo do mobile). */
export const PRIMARY_WORKFLOW_TASKS = [
  { key: "lavagem", label: "Lavagem" },
  { key: "aspiracao", label: "Aspiração" },
  { key: "secagem", label: "Secagem" },
] as const;

export type WorkflowTaskKey = (typeof PRIMARY_WORKFLOW_TASKS)[number]["key"];

export type WorkflowTaskState = {
  employeeId: string | null;
  /** Linha expandida para escolher funcionário */
  open: boolean;
};

export type ExtraServiceState = {
  selected: boolean;
  employeeId: string | null;
  open: boolean;
};

export function isLavagemCatalogService(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("lavagem") ||
    n.includes("ducha") ||
    n.includes("enceramento") ||
    n.includes("higien") ||
    n.includes("poliment") ||
    n.includes("detalhamento") ||
    n.includes("motor") ||
    n.includes("chassi") ||
    n.includes("servi")
  );
}

export function findDefaultLavagemServiceId(
  services: { id: string; name: string }[]
): string | null {
  const completa = services.find((s) => /lavagem completa/i.test(s.name));
  if (completa) return completa.id;
  const simples = services.find((s) => /lavagem simples/i.test(s.name));
  if (simples) return simples.id;
  const any = services.find((s) => /lavagem/i.test(s.name));
  return any?.id ?? null;
}

export function countAssignments(
  workflow: Record<WorkflowTaskKey, WorkflowTaskState>,
  extras: Record<string, ExtraServiceState>
): number {
  let n = 0;
  for (const task of Object.values(workflow)) {
    if (task.employeeId) n += 1;
  }
  for (const extra of Object.values(extras)) {
    if (extra.selected && extra.employeeId) n += 1;
  }
  return n;
}
