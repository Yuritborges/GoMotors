import type { PrismaClient } from "@/generated/prisma/client";

/** Normaliza parâmetro ou hoje para YYYY-MM-DD (calendário local do usuário). */
export function normalizeCashDateKey(dateParam?: string | null): string {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Data canônica gravada no banco (meio-dia UTC evita virada de dia). */
export function cashClosingStorageDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

/** Chave exibida na UI a partir do valor gravado. */
export function cashClosingDisplayKey(stored: Date): string {
  return stored.toISOString().slice(0, 10);
}

/** Intervalo UTC do dia civil para achar fechamentos legados com fuso diferente. */
export function cashClosingUtcDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function findCashClosingByDateKey(
  prisma: PrismaClient,
  dateKey: string
) {
  const canonical = cashClosingStorageDate(dateKey);
  const byCanonical = await prisma.cashClosing.findUnique({ where: { date: canonical } });
  if (byCanonical) return byCanonical;

  const { start, end } = cashClosingUtcDayRange(dateKey);
  return prisma.cashClosing.findFirst({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
  });
}
