import type { ExpenseCategory, PaymentMethod } from "../src/generated/prisma/client";

export type VehicleTypeImport = "MOTO" | "CARRO" | "SUV" | "CAMINHONETE" | "OUTRO";

export function normalizePlate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const plate = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plate.length < 6) return null;
  return plate;
}

const SHEET_MONTH_INDEX: Record<string, number> = {
  JANEIRO: 0,
  FEVEREIRO: 1,
  MARCO: 2,
  MARÇO: 2,
  ABRIL: 3,
  MAIO: 4,
  JUNHO: 5,
  JULHO: 6,
  AGOSTO: 7,
  SETEMBRO: 8,
  OUTUBRO: 9,
  NOVEMBRO: 10,
  DEZEMBRO: 11,
};

function normalizeSheetKey(name: string) {
  return name
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fixLegacyYear(date: Date, fileYear = 2026): Date {
  const year = date.getFullYear();
  if (year >= 2001 && year <= 2005) {
    return new Date(fileYear, date.getMonth(), date.getDate());
  }
  if (year > fileYear + 1 || year < fileYear - 1) {
    return new Date(fileYear, date.getMonth(), date.getDate());
  }
  return date;
}

/** Planilhas ROTATIVO usam M/D/YY (Excel US) e abas por mês — força mês da aba. */
export function parseRotativoDate(
  value: unknown,
  sheetName: string,
  fileYear = 2026
): Date | null {
  const sheetMonth = SHEET_MONTH_INDEX[normalizeSheetKey(sheetName)];

  if (typeof value === "string") {
    const s = value.trim();
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slash) {
      const monthPart = parseInt(slash[1], 10);
      const dayPart = parseInt(slash[2], 10);
      let year = parseInt(slash[3], 10);
      if (year < 100) year += year >= 50 ? 1900 : 2000;

      if (sheetMonth !== undefined) {
        return new Date(fileYear, sheetMonth, dayPart);
      }

      // Formato US M/D/YY das planilhas Go Motors
      return new Date(year, monthPart - 1, dayPart);
    }
  }

  const parsed = parseExcelDate(value, fileYear);
  if (!parsed) return null;

  if (sheetMonth !== undefined) {
    return new Date(fileYear, sheetMonth, parsed.getDate());
  }

  return parsed;
}

export function parseExcelDate(value: unknown, fileYear = 2026): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return fixLegacyYear(new Date(value), fileYear);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(1899, 11, 30);
    const parsed = new Date(excelEpoch.getTime() + value * 86_400_000);
    return Number.isNaN(parsed.getTime()) ? null : fixLegacyYear(parsed, fileYear);
  }

  const s = String(value).trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const monthPart = parseInt(slash[1], 10);
    const dayPart = parseInt(slash[2], 10);
    let year = parseInt(slash[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return new Date(year, monthPart - 1, dayPart);
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return fixLegacyYear(parsed, fileYear);
}

export function parseAmount(value: unknown): number {
  if (value == null || value === "") return 0;
  let s = String(value).trim().replace(/R\$\s?/gi, "").trim();
  if (s.includes(",") && s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastDot > lastComma) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(",", ".");
    }
  } else if (s.includes(",") && !s.includes(".")) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1]!.length === 3 && !parts[1]!.includes(".")) {
      s = parts.join("");
    } else {
      s = s.replace(",", ".");
    }
  }
  const n = Number(s);
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

export function resolveImportPaymentStatus(row: {
  isPartner?: boolean;
  partnerPaid?: boolean;
  payment: PaymentMethod;
  amount: number;
}): "PAGO" | "PENDENTE" {
  if (row.amount <= 0) return "PENDENTE";
  if (row.partnerPaid) return "PAGO";
  if (row.isPartner) return "PENDENTE";
  if (row.payment === "PENDENTE" || row.payment === "PAGAR_DEPOIS") return "PENDENTE";
  return "PAGO";
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

import { TEAM_EMPLOYEES } from "../src/lib/constants";

/** Mapeia descrição "VALE GABRIEL" etc. para nome da equipe fixa, ou null. */
export function matchEmployeeFromVale(description: string): string | null {
  const u = description
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!u.includes("VALE")) return null;

  for (const name of TEAM_EMPLOYEES) {
    if (u.includes(`VALE ${name}`) || u.includes(`VALE${name}`)) return name;
  }
  for (const name of TEAM_EMPLOYEES) {
    if (u.includes(name)) return name;
  }
  return null;
}

export function isTeamValeExpense(description: string): boolean {
  return matchEmployeeFromVale(description) !== null;
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
