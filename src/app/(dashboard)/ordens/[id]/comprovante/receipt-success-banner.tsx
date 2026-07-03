"use client";

import { useSearchParams } from "next/navigation";

export function ReceiptSuccessBanner() {
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const plate = searchParams.get("plate");

  if (!registered) return null;

  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      <p className="font-semibold">Ordem registrada com sucesso!</p>
      <p className="mt-1 text-emerald-800">
        {plate
          ? `Placa ${plate} entrou na fila. Acompanhe no painel operacional.`
          : "O veículo entrou na fila. Acompanhe no painel operacional."}
      </p>
    </div>
  );
}
