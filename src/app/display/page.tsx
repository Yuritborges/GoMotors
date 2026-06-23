"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

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

export default function DisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null);
  const [clock, setClock] = useState("");

  async function load() {
    const res = await fetch("/api/display/orders");
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

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
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-6">
        <div className="flex items-center gap-6">
          <Image src="/logo.png" alt="GO MOTORS" width={140} height={56} unoptimized className="h-14 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide">FILA DE ATENDIMENTO</h1>
            <p className="text-sm text-zinc-400">Acompanhe seu veículo em tempo real</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums">{clock}</p>
          <p className="text-xs text-zinc-500">Atualiza automaticamente</p>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 px-8 py-4">
        {[
          { label: "Aguardando", value: data.stats.aguardando, color: "text-amber-400" },
          { label: "Em lavagem", value: data.stats.emLavagem, color: "text-sky-400" },
          { label: "Finalização", value: data.stats.finalizacao, color: "text-purple-400" },
          { label: "Prontos", value: data.stats.prontos, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-zinc-900 px-6 py-4 text-center">
            <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-4 gap-4 px-8 pb-8">
        {data.columns.map((col) => (
          <section
            key={col.status}
            className={`rounded-2xl border-2 p-4 ${COLUMN_COLORS[col.status]}`}
          >
            <h2 className="mb-4 text-center text-xl font-bold uppercase tracking-wider">
              {col.label}
            </h2>
            <div className="space-y-3">
              {col.orders.length === 0 ? (
                <p className="py-8 text-center text-zinc-500">—</p>
              ) : (
                col.orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl bg-zinc-900/80 px-4 py-5 text-center shadow-lg"
                  >
                    {col.status === "AGUARDANDO" && (
                      <p className="text-sm font-medium text-amber-400">
                        #{order.position} na fila
                      </p>
                    )}
                    <p className="mt-1 text-3xl font-black tracking-widest">
                      {order.plate}
                    </p>
                    <p className="mt-1 text-lg text-zinc-300">{order.clientName}</p>
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
