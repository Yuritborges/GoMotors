"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { usePolling } from "@/lib/use-polling";

type DisplayEntry = {
  orderId: string;
  plate: string;
  clientName: string;
  serviceName: string;
  employeeName: string | null;
  queuePosition?: number;
};

type DisplayColumn = {
  lane: string;
  label: string;
  fixed: boolean;
  entries: DisplayEntry[];
};

type DisplayData = {
  updatedAt: string;
  columns: DisplayColumn[];
  stats: {
    aguardando: number;
    emServico: number;
    lavagem: number;
    aspiracao: number;
    secagem: number;
    prontos: number;
  };
};

const FIXED_COLUMN_COLORS: Record<string, string> = {
  AGUARDANDO: "border-amber-500 bg-amber-500/10",
  LAVAGEM: "border-sky-500 bg-sky-500/10",
  ASPIRACAO: "border-indigo-500 bg-indigo-500/10",
  SECAGEM: "border-cyan-500 bg-cyan-500/10",
  FINALIZACAO: "border-purple-500 bg-purple-500/10",
  PRONTO: "border-emerald-500 bg-emerald-500/10",
};

const DYNAMIC_COLUMN_COLOR = "border-purple-500 bg-purple-500/10";

const STAT_ITEMS = [
  { key: "aguardando" as const, label: "Aguardando", color: "text-amber-400" },
  { key: "emServico" as const, label: "Em serviço", color: "text-sky-400" },
  { key: "prontos" as const, label: "Prontos", color: "text-emerald-400" },
];

function columnColor(col: DisplayColumn): string {
  if (!col.fixed) return DYNAMIC_COLUMN_COLOR;
  return FIXED_COLUMN_COLORS[col.lane] ?? "border-zinc-600 bg-zinc-800/30";
}

function LaneCard({
  entry,
  lane,
  compact,
}: {
  entry: DisplayEntry;
  lane: string;
  compact?: boolean;
}) {
  const isQueue = lane === "AGUARDANDO";
  const isReady = lane === "PRONTO";
  const showEmployee = !isQueue && !isReady;

  return (
    <div
      className={`rounded-xl bg-zinc-900/90 shadow-lg ${
        compact ? "px-2.5 py-2.5" : "px-3 py-3 sm:px-4 sm:py-4"
      }`}
    >
      {isQueue && entry.queuePosition != null && (
        <p className="text-center text-[10px] font-semibold text-amber-400 sm:text-sm">
          #{entry.queuePosition} na fila
        </p>
      )}
      <p
        className={`text-center font-black leading-tight ${
          compact
            ? "text-base tracking-[0.12em]"
            : "text-xl tracking-[0.15em] sm:text-2xl lg:text-3xl"
        }`}
      >
        {entry.plate}
      </p>
      <p
        className={`mt-0.5 truncate text-center text-zinc-400 ${
          compact ? "text-[11px]" : "text-sm sm:text-base"
        }`}
        title={entry.clientName}
      >
        {entry.clientName}
      </p>
      {showEmployee && entry.employeeName && (
        <p className="mt-1.5 text-center sm:mt-2">
          <span
            className={`inline-block max-w-full truncate rounded-md bg-zinc-800 font-bold text-sky-300 ${
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs sm:text-sm"
            }`}
            title={entry.employeeName}
          >
            {entry.employeeName}
          </span>
        </p>
      )}
      {isReady && (
        <p
          className={`mt-1.5 text-center font-semibold text-emerald-400 sm:mt-2 ${
            compact ? "text-[10px]" : "text-xs sm:text-sm"
          }`}
        >
          Retirada liberada
        </p>
      )}
    </div>
  );
}

function ColumnSection({
  col,
  compact,
  className,
}: {
  col: DisplayColumn;
  compact?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border-2 ${columnColor(col)} ${
        compact ? "min-h-[11rem] p-2" : "min-h-[12rem] p-2 sm:min-h-[16rem] sm:p-3"
      } ${className ?? ""}`}
    >
      <h2
        className={`mb-2 shrink-0 text-center font-bold uppercase leading-tight ${
          compact
            ? "text-[10px] tracking-wide"
            : "text-xs tracking-wide sm:text-sm lg:text-base"
        }`}
      >
        {col.label}
      </h2>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {col.entries.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-4 text-zinc-600">—</p>
        ) : (
          col.entries.map((entry, index) => (
            <LaneCard
              key={`${entry.orderId}-${col.lane}-${index}`}
              entry={entry}
              lane={col.lane}
              compact={compact}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function DisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null);
  const [clock, setClock] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/display/orders");
    setData(await res.json());
  }, []);

  usePolling(load, 5000);

  useEffect(() => {
    function tick() {
      setClock(
        new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Carregando painel...
      </div>
    );
  }

  const columnCount = data.columns.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-5">
            <Image
              src="/logo.png"
              alt="GO MOTORS"
              width={140}
              height={56}
              unoptimized
              className="h-9 w-auto shrink-0 sm:h-12 lg:h-14"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-wide sm:text-xl lg:text-2xl">
                FILA DE ATENDIMENTO
              </h1>
              <p className="hidden text-xs text-zinc-400 sm:block sm:text-sm">
                Acompanhe seu veículo por serviço em tempo real
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
            <p className="text-xl font-bold tabular-nums sm:text-3xl lg:text-4xl">{clock}</p>
            <p className="text-[10px] text-zinc-500 sm:mt-0.5 sm:text-xs">Atualiza automaticamente</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:px-8">
        {STAT_ITEMS.map((s) => (
          <div
            key={s.key}
            className="rounded-xl bg-zinc-900 px-2 py-2.5 text-center sm:px-6 sm:py-4"
          >
            <p className={`text-xl font-bold sm:text-3xl lg:text-4xl ${s.color}`}>
              {data.stats[s.key]}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-400 sm:mt-1 sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mobile / tablet: colunas com largura fixa + scroll horizontal */}
      <div className="xl:hidden">
        <p className="px-4 pb-2 text-center text-[10px] text-zinc-500 sm:text-xs">
          Deslize para ver todas as etapas →
        </p>
        <div className="overflow-x-auto overscroll-x-contain pb-6 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
          <div className="flex w-max snap-x snap-mandatory gap-3 px-4">
            {data.columns.map((col) => (
              <ColumnSection
                key={col.lane}
                col={col}
                compact
                className="w-[42vw] min-w-[152px] max-w-[176px] shrink-0 snap-start"
              />
            ))}
          </div>
        </div>
      </div>

      {/* TV / desktop largo: grid com todas as colunas */}
      <div
        className="hidden gap-4 px-8 pb-8 xl:grid"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {data.columns.map((col) => (
          <ColumnSection key={col.lane} col={col} />
        ))}
      </div>
    </div>
  );
}
