"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { usePolling } from "@/lib/use-polling";
import type { DisplayLaneKey } from "@/lib/display-lanes";

type DisplayEntry = {
  orderId: string;
  plate: string;
  clientName: string;
  serviceName: string;
  employeeName: string | null;
  queuePosition?: number;
};

type DisplayData = {
  updatedAt: string;
  columns: {
    lane: DisplayLaneKey;
    label: string;
    entries: DisplayEntry[];
  }[];
  stats: {
    aguardando: number;
    emServico: number;
    lavagem: number;
    aspiracao: number;
    secagem: number;
    extras: number;
    prontos: number;
  };
};

const COLUMN_COLORS: Record<DisplayLaneKey, string> = {
  AGUARDANDO: "border-amber-500 bg-amber-500/10",
  LAVAGEM: "border-sky-500 bg-sky-500/10",
  ASPIRACAO: "border-indigo-500 bg-indigo-500/10",
  SECAGEM: "border-cyan-500 bg-cyan-500/10",
  EXTRAS: "border-purple-500 bg-purple-500/10",
  PRONTO: "border-emerald-500 bg-emerald-500/10",
};

const STAT_ITEMS = [
  { key: "aguardando" as const, label: "Aguardando", color: "text-amber-400" },
  { key: "emServico" as const, label: "Em serviço", color: "text-sky-400" },
  { key: "prontos" as const, label: "Prontos", color: "text-emerald-400" },
];

function LaneCard({
  entry,
  lane,
}: {
  entry: DisplayEntry;
  lane: DisplayLaneKey;
}) {
  const showServiceLine = lane !== "AGUARDANDO" && lane !== "PRONTO";

  return (
    <div className="rounded-xl bg-zinc-900/90 px-3 py-3 shadow-lg sm:px-4 sm:py-4">
      {lane === "AGUARDANDO" && entry.queuePosition != null && (
        <p className="text-center text-xs font-semibold text-amber-400 sm:text-sm">
          #{entry.queuePosition} na fila
        </p>
      )}
      <p className="text-center text-xl font-black tracking-[0.15em] sm:text-2xl lg:text-3xl">
        {entry.plate}
      </p>
      <p className="mt-0.5 text-center text-sm text-zinc-400 sm:text-base">
        {entry.clientName}
      </p>
      {showServiceLine && (
        <div className="mt-2 border-t border-zinc-800 pt-2 text-center">
          <p className="text-xs font-medium text-zinc-300 sm:text-sm">
            {entry.serviceName}
          </p>
          {entry.employeeName && (
            <p className="mt-1 inline-block rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-bold text-sky-300 sm:text-sm">
              {entry.employeeName}
            </p>
          )}
        </div>
      )}
      {lane === "PRONTO" && (
        <p className="mt-2 text-center text-xs font-semibold text-emerald-400">
          Retirada liberada
        </p>
      )}
    </div>
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Image
              src="/logo.png"
              alt="GO MOTORS"
              width={140}
              height={56}
              unoptimized
              className="h-10 w-auto sm:h-12 lg:h-14"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-base font-bold tracking-wide sm:text-xl lg:text-2xl">
                FILA DE ATENDIMENTO
              </h1>
              <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
                Acompanhe seu veículo por serviço em tempo real
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-2xl font-bold tabular-nums sm:text-3xl lg:text-4xl">
              {clock}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Atualiza automaticamente</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 px-4 py-4 sm:gap-4 lg:px-8">
        {STAT_ITEMS.map((s) => (
          <div
            key={s.key}
            className="rounded-xl bg-zinc-900 px-3 py-3 text-center sm:px-6 sm:py-4"
          >
            <p className={`text-2xl font-bold sm:text-3xl lg:text-4xl ${s.color}`}>
              {data.stats[s.key]}
            </p>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-8 sm:gap-4 md:grid-cols-3 xl:grid-cols-6 lg:px-8">
        {data.columns.map((col) => (
          <section
            key={col.lane}
            className={`flex min-h-[12rem] min-w-0 flex-col rounded-2xl border-2 p-2 sm:min-h-[16rem] sm:p-3 ${COLUMN_COLORS[col.lane]}`}
          >
            <h2 className="mb-2 shrink-0 text-center text-xs font-bold uppercase tracking-wide sm:text-sm lg:text-base">
              {col.label}
            </h2>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {col.entries.length === 0 ? (
                <p className="flex flex-1 items-center justify-center py-4 text-zinc-600">
                  —
                </p>
              ) : (
                col.entries.map((entry, index) => (
                  <LaneCard
                    key={`${entry.orderId}-${col.lane}-${index}`}
                    entry={entry}
                    lane={col.lane}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
