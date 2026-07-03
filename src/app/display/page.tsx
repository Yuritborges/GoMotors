"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { usePolling } from "@/lib/use-polling";

type DisplayData = {
  updatedAt: string;
  columns: {
    status: string;
    label: string;
    orders: {
      id: string;
      plate: string;
      clientName: string;
      services: string;
      position: number;
    }[];
  }[];
  stats: {
    aguardando: number;
    emLavagem: number;
    finalizacao: number;
    prontos: number;
  };
};

const COLUMN_COLORS: Record<string, string> = {
  AGUARDANDO: "border-amber-500 bg-amber-500/10",
  EM_LAVAGEM: "border-sky-500 bg-sky-500/10",
  FINALIZACAO: "border-purple-500 bg-purple-500/10",
  PRONTO: "border-emerald-500 bg-emerald-500/10",
};

const STAT_ITEMS = [
  { key: "aguardando", label: "Aguardando", color: "text-amber-400" },
  { key: "emLavagem", label: "Em lavagem", color: "text-sky-400" },
  { key: "finalizacao", label: "Finalização", color: "text-purple-400" },
  { key: "prontos", label: "Prontos", color: "text-emerald-400" },
] as const;

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
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
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
                Acompanhe seu veículo em tempo real
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

      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:gap-4 lg:grid-cols-4 lg:px-8">
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

      <div className="grid grid-cols-1 gap-4 px-4 pb-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8 lg:pb-8">
        {data.columns.map((col) => (
          <section
            key={col.status}
            className={`min-w-0 rounded-2xl border-2 p-3 sm:p-4 ${COLUMN_COLORS[col.status]}`}
          >
            <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wider sm:text-base lg:text-xl">
              {col.label}
            </h2>
            <div className="space-y-3">
              {col.orders.length === 0 ? (
                <p className="py-6 text-center text-zinc-500 sm:py-8">—</p>
              ) : (
                col.orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl bg-zinc-900/80 px-3 py-4 text-center shadow-lg sm:px-4 sm:py-5"
                  >
                    {col.status === "AGUARDANDO" && (
                      <p className="text-xs font-medium text-amber-400 sm:text-sm">
                        #{order.position} na fila
                      </p>
                    )}
                    <p className="mt-1 text-2xl font-black tracking-widest sm:text-3xl">
                      {order.plate}
                    </p>
                    <p className="mt-1 text-base text-zinc-300 sm:text-lg">
                      {order.clientName}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">{order.services}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
