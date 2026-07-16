/**
 * Padronização: todo texto livre gravado no banco vai em MAIÚSCULA.
 * E-mail, senha e campos técnicos (json, ids, enums internos) ficam de fora.
 */

/** Campos de texto livre que devem ser gravados em maiúscula. */
const UPPER_KEYS = new Set([
  "name",
  "notes",
  "description",
  "brand",
  "model",
  "color",
  "plate",
  "serviceName",
  "userName",
  "closedBy",
  "installment",
  "summary",
  "category",
]);

/** Campos que nunca devem ser tocados nem percorridos. */
const SKIP_KEYS = new Set(["email", "passwordHash", "metadata", "snapshot"]);

export function toUpperText(value: string): string {
  return value.toLocaleUpperCase("pt-BR");
}

/**
 * Percorre o payload de escrita do Prisma (incluindo nested create/update)
 * e converte os campos da allowlist para maiúscula, in place.
 */
export function uppercaseWriteData(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) uppercaseWriteData(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  const obj = value as Record<string, unknown>;
  for (const [key, v] of Object.entries(obj)) {
    if (SKIP_KEYS.has(key)) continue;

    if (UPPER_KEYS.has(key)) {
      if (typeof v === "string") {
        obj[key] = toUpperText(v);
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        // Formato { set: "valor" } usado em updates
        const setter = v as { set?: unknown };
        if (typeof setter.set === "string") {
          setter.set = toUpperText(setter.set);
        }
      }
      continue;
    }

    if (v && typeof v === "object") uppercaseWriteData(v);
  }
}
