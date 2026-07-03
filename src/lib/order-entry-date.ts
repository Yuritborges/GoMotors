const MAX_BACKDATE_DAYS = 90;
/** Diferença mínima em ms para considerar lançamento retroativo (não fila de hoje). */
const RETROACTIVE_THRESHOLD_MS = 15 * 60 * 1000;

export class OrderEntryDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderEntryDateError";
  }
}

export function parseOrderEntryAt(raw: unknown): {
  entryAt: Date;
  retroactive: boolean;
} {
  if (raw === undefined || raw === null || raw === "") {
    const now = new Date();
    return { entryAt: now, retroactive: false };
  }

  if (typeof raw !== "string") {
    throw new OrderEntryDateError("Data/hora inválida.");
  }

  const entryAt = new Date(raw);
  if (Number.isNaN(entryAt.getTime())) {
    throw new OrderEntryDateError("Data/hora inválida.");
  }

  const now = new Date();
  if (entryAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new OrderEntryDateError("A data do serviço não pode ser no futuro.");
  }

  const min = new Date();
  min.setDate(min.getDate() - MAX_BACKDATE_DAYS);
  min.setHours(0, 0, 0, 0);
  if (entryAt < min) {
    throw new OrderEntryDateError(
      `Só é possível lançar com até ${MAX_BACKDATE_DAYS} dias de atraso.`
    );
  }

  const retroactive = now.getTime() - entryAt.getTime() > RETROACTIVE_THRESHOLD_MS;
  return { entryAt, retroactive };
}

/** Valor para input datetime-local no fuso local do navegador. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultRetroactiveEntryValue(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return toDatetimeLocalValue(d);
}
