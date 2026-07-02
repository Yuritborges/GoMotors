import type { ExpenseCategory, PaymentMethod } from "../src/generated/prisma/client";

export type VehicleTypeImport = "MOTO" | "CARRO" | "SUV" | "CAMINHONETE" | "OUTRO";

export function normalizePlate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const plate = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plate.length < 6) return null;
  return plate;
}

export function parseExcelDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseAmount(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const SERVICE_CANONICAL: { key: string; category: string; patterns: RegExp[] }[] = [
  { key: "Lavagem simples", category: "Lavagem", patterns: [/^simples$/i, /simples/i] },
  { key: "Lavagem completa", category: "Lavagem", patterns: [/^completa?$/i, /completa/i, /completo/i] },
  { key: "Lavagem de chassi", category: "Lavagem", patterns: [/chassi/i] },
  { key: "Lavagem de motor", category: "Lavagem", patterns: [/^motor$/i, /motor/i] },
  { key: "Higienização", category: "Detalhamento", patterns: [/hig/i, /ench/i] },
  { key: "Polimento", category: "Detalhamento", patterns: [/poliment/i, /^pol$/i] },
  { key: "Ducha", category: "Lavagem", patterns: [/ducha/i] },
  { key: "Enceramento", category: "Detalhamento", patterns: [/cera/i] },
  { key: "Detalhamento interno", category: "Detalhamento", patterns: [/banco/i, /couro/i, /conserto/i, /coifa/i] },
];

export function canonicalService(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (!name) return "Serviços adicionais";
  for (const item of SERVICE_CANONICAL) {
    if (item.patterns.some((p) => p.test(name))) return item.key;
  }
  return "Serviços adicionais";
}

export function serviceCategory(canonical: string): string {
  return SERVICE_CANONICAL.find((s) => s.key === canonical)?.category ?? "Extras";
}

const SUV_MODELS =
  /DUSTER|TRACKER|COMPASS|RENEGADE|CRETA|TIGUAN|KICKS|HR-V|HRV|SPORTAGE|T-CROSS|T CROSS|COROLLA CROSS|SORENTO|CAPTUR|ASX|IX35|SPIN|DISCOVERY|AMAROK|HILUX|S10|TORO|RANGER|STRADA|SAVEIRO|FIORINO|OROCH|MASTER|SPRINTER|RAM|AMAROK|EDGE|VERA CRUZ|SANTA FÉ|TOUAREG|PORSCHE|VELAR|X1|X6|MINI|BMW|MERcedes|AMAROK|KWID/i;
const MOTO_MODELS = /MOTO|CG |BIZ|XRE|CB |FAN|YBR|Lander/i;
const CAMINHONETE_MODELS = /STRADA|SAVEIRO|TORO|RANGER|AMAROK|S10|HILUX|OROCH|FIORINO|MASTER|SPRINTER|RAM/i;

export function inferVehicleType(model: unknown): VehicleTypeImport {
  const m = String(model ?? "").trim();
  if (!m) return "CARRO";
  if (MOTO_MODELS.test(m)) return "MOTO";
  if (CAMINHONETE_MODELS.test(m)) return "CAMINHONETE";
  if (SUV_MODELS.test(m)) return "SUV";
  return "CARRO";
}

export function mapPayment(raw: unknown): PaymentMethod {
  const p = String(raw ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!p) return "PENDENTE";
  if (p.includes("PIX")) return "PIX";
  if (p.includes("DIN")) return "DINHEIRO";
  if (p.includes("CRED")) return "CREDITO";
  if (p.includes("DEB")) return "DEBITO";
  return "PENDENTE";
}

export function mapExpenseCategory(description: unknown): ExpenseCategory {
  const d = String(description ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (d.includes("LUZ") || d.includes("ENERGIA")) return "ENERGIA";
  if (d.includes("AGUA")) return "AGUA";
  if (d.includes("VALE") || d.includes("PAGAMENTO") || d.includes("SALARIO")) return "FUNCIONARIOS";
  if (d.includes("ALUGUEL") || d.includes("CONDOMINIO")) return "ALUGUEL";
  if (
    d.includes("BAU") ||
    d.includes("SOLUPAN") ||
    d.includes("SHAMPOO") ||
    d.includes("CERA") ||
    d.includes("PRODUTO") ||
    d.includes("INSUMO")
  )
    return "PRODUTOS_LIMPEZA";
  if (d.includes("MANUT") || d.includes("CORREIA") || d.includes("DIESEL")) return "MANUTENCAO";
  return "COMPRAS_DIVERSAS";
}

export function cleanModelName(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function clientDisplayName(model: string, plate: string): string {
  const m = cleanModelName(model);
  if (m && m.toLowerCase() !== "nan") return m;
  return `Cliente ${plate}`;
}
