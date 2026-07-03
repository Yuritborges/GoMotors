"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

type AuditEntry = {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  productName: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  ORDER_CREATE: "OS criada",
  ORDER_RETROACTIVE: "OS retroativa",
  ORDER_DELETE: "OS excluída",
  PRODUCT_CREATE: "Produto cadastrado",
  STOCK_COMPRA: "Compra estoque",
  STOCK_AJUSTE: "Ajuste estoque",
  STOCK_SAIDA: "Saída estoque",
  STOCK_ENTRADA: "Entrada estoque",
  STOCK_INVENTARIO: "Inventário",
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/audit?limit=200");
    if (res.ok) setLogs(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Registro de ações importantes no sistema"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-slate-200 bg-white text-xs text-slate-700">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                  {log.productName && (
                    <span className="text-sm font-semibold text-slate-900">{log.productName}</span>
                  )}
                  <span className="text-sm text-slate-500">{log.userName}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{log.summary}</p>
              </div>
              <p className="shrink-0 text-xs text-slate-400 sm:text-right">
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Nenhum registro ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
