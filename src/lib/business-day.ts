/** Fuso da operação (Go Motors — Brasil). */
export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

/** YYYY-MM-DD no calendário da operação. */
export function businessDateKey(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function partsInBusinessTz(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Converte horário civil em São Paulo para instante UTC. */
export function businessZonedTimeToUtc(
  dateKey: string,
  time = "12:00:00.000"
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm, rest] = time.split(":");
  const [ss, ms = "0"] = (rest ?? "0").split(".");

  let guess = Date.UTC(y, m - 1, d, Number(hh), Number(mm), Number(ss), Number(ms));

  for (let i = 0; i < 4; i++) {
    const p = partsInBusinessTz(new Date(guess));
    const displayed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const wanted = Date.UTC(y, m - 1, d, Number(hh), Number(mm), Number(ss));
    guess += wanted - displayed;
  }

  return new Date(guess);
}

/** Início e fim do dia civil em São Paulo (para filtros no banco). */
export function businessDayBounds(dateKey: string) {
  return {
    start: businessZonedTimeToUtc(dateKey, "00:00:00.000"),
    end: businessZonedTimeToUtc(dateKey, "23:59:59.999"),
  };
}

/** Grava lançamento na data escolhida (meio-dia em SP). */
export function parseBusinessDateInput(dateInput?: string | null): Date {
  if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return businessZonedTimeToUtc(dateInput, "12:00:00.000");
  }
  return new Date();
}

/** O dia civil (SP) em que um instante UTC cai. */
export function businessDateKeyFromInstant(instant: Date): string {
  return businessDateKey(instant);
}
