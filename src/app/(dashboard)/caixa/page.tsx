"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Banknote,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  PiggyBank,
  Lock,
  RefreshCw,
  TrendingUp,
  Unlock,
  Wallet,
  Wrench,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { businessDateKey, formatBusinessDateKey, isBusinessDateKey } from "@/lib/business-day";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

type CashData = {
  totalSold: number;
  totalDiscounts: number;
  pendingAmount: number;
  payLaterAmount: number;
  vehicleCount: number;
  paidCount: number;
  pendingPaymentCount: number;
  averageTicket: number;
  byPaymentMethod: Record<string, number>;
  totalExpenses: number;
  employeeExpenses: number;
  estimatedResult: number;
  statusBreakdown: {
    aguardando: number;
    emLavagem: number;
    finalizacao: number;
    prontos: number;
    entregues: number;
  };
  laneBreakdown: {
    lane: string;
    label: string;
    count: number;
    fixed: boolean;
  }[];
  hourlyRevenue: { hour: number; amount: number }[];
  pendingOrders: {
    id: string;
    total: number;
    status: string;
    paymentMethod: string;
    plate: string;
    clientName: string;
    entryAt: string;
  }[];
  todayOrders: {
    id: string;
    plate: string;
    clientName: string;
    total: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    services: string;
    entryAt: string;
  }[];
};

const METHOD_ICONS: Record<string, typeof Wallet> = {
  DINHEIRO: Banknote,
  PIX: Wallet,
  DEBITO: CreditCard,
  CREDITO: CreditCard,
};

const LANE_COLORS: Record<string, string> = {
  AGUARDANDO: "bg-amber-400",
  LAVAGEM: "bg-sky-500",
  ASPIRACAO: "bg-indigo-500",
  SECAGEM: "bg-cyan-500",
  FINALIZACAO: "bg-purple-500",
  PRONTO: "bg-emerald-500",
};

const DYNAMIC_LANE_COLOR = "bg-fuchsia-500";

const METHOD_COLORS: Record<string, string> = {
  DINHEIRO: "from-emerald-500 to-emerald-600",
  PIX: "from-sky-500 to-sky-600",
  DEBITO: "from-violet-500 to-violet-600",
  CREDITO: "from-indigo-500 to-indigo-600",
};

function shiftDate(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

type ClosingRow = {
  id: string;
  date: string;
  closedBy: string;
  createdAt: string;
};

export default function CaixaPage() {
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => businessDateKey());
  const [data, setData] = useState<CashData | null>(null);
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [closingLoading, setClosingLoading] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [closeError, setCloseError] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get("date");
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) {
      setDate(fromUrl);
    }
  }, [searchParams]);

  const todayKey = businessDateKey();
  const isViewingToday = date === todayKey;
  const dayLabel = isViewingToday ? "hoje" : formatBusinessDateKey(date);
  const novaOrdemHref =
    date === todayKey ? "/ordens/nova" : `/ordens/nova?operatingDate=${encodeURIComponent(date)}`;

  const load = useCallback(async () => {
    const [cashRes, closingsRes] = await Promise.all([
      fetch(`/api/cash?date=${encodeURIComponent(date)}`),
      fetch("/api/cash/closings"),
    ]);
    if (cashRes.ok) setData(await cashRes.json());
    if (closingsRes.ok) setClosings(await closingsRes.json());
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isViewingToday) return;
    const interval = setInterval(() => void load(), 20000);
    return () => clearInterval(interval);
  }, [isViewingToday, load]);

  async function manualRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function closeCashDay() {
    if (
      !confirm(
        `Fechar o caixa de ${dayLabel}?\n\nSerá gerado um relatório completo com todos os dados do dia.`
      )
    ) {
      return;
    }
    setClosingLoading(true);
    setCloseError("");
    const res = await fetch("/api/cash/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const json = await res.json();
    setClosingLoading(false);
    if (!res.ok) {
      setCloseError(json.error ?? "Erro ao fechar caixa.");
      return;
    }
    await load();
    window.location.href = `/caixa/fechamentos/${date}`;
  }

  async function reopenCashDay(targetDate = date) {
    const label =
      targetDate === todayKey
        ? "hoje"
        : formatBusinessDateKey(targetDate);
    if (
      !confirm(
        `Reabrir o caixa de ${label}?\n\nVocê poderá alterar lançamentos e fechar novamente quando terminar.`
      )
    ) {
      return;
    }
    setReopenLoading(true);
    setCloseError("");
    const res = await fetch("/api/cash/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: targetDate }),
    });
    const json = await res.json();
    setReopenLoading(false);
    if (!res.ok) {
      setCloseError(json.error ?? "Erro ao reabrir caixa.");
      return;
    }
    await load();
  }

  const isDayClosed = closings.some((c) => c.date === date);

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando caixa...</p>;
  }

  const methodTotal = Object.values(data.byPaymentMethod).reduce((a, b) => a + b, 0);
  const maxHourly = Math.max(...data.hourlyRevenue.map((h) => h.amount), 1);
  const inProgress = (data.laneBreakdown ?? [])
    .filter((l) => l.lane !== "PRONTO")
    .reduce((sum, l) => sum + l.count, 0);

  return (
    <div className="space-y-6">
      <Card className="border-sky-300 bg-gradient-to-r from-sky-50 to-white shadow-sm">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-900">Data do fechamento</p>
            <p className="text-xs text-sky-700">
              Inclui histórico importado das planilhas + ordens do sistema
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 bg-white"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                const value = e.target.value;
                if (isBusinessDateKey(value)) setDate(value);
              }}
              className="min-w-[160px] bg-white"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 bg-white"
              onClick={() => setDate((d) => shiftDate(d, 1))}
              aria-label="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isViewingToday && (
              <Button type="button" variant="secondary" onClick={() => setDate(todayKey)}>
                Hoje
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PageHeader
        title="Caixa"
        description={
          isViewingToday
            ? "Fechamento e movimentação do dia"
            : `Fechamento de ${dayLabel}`
        }
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href={novaOrdemHref} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Nova ordem</Button>
          </Link>
          <Link href="/painel">
            <Button variant="secondary" className="w-full gap-2 sm:w-auto">
              <Wrench className="h-4 w-4" />
              Painel operacional
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            disabled={refreshing}
            onClick={() => void manualRefresh()}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {isDayClosed ? (
            <Button
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 sm:w-auto"
              disabled={reopenLoading}
              onClick={() => void reopenCashDay()}
            >
              <Unlock className="h-4 w-4" />
              {reopenLoading ? "Reabrindo..." : "Reabrir caixa"}
            </Button>
          ) : (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
              disabled={closingLoading}
              onClick={() => void closeCashDay()}
            >
              <Lock className="h-4 w-4" />
              {closingLoading ? "Fechando..." : "Fechar caixa do dia"}
            </Button>
          )}
        </div>
      </PageHeader>

      {isDayClosed && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Caixa fechado para este dia. Use <strong>Reabrir caixa</strong> para corrigir lançamentos e
          fechar de novo.
        </p>
      )}

      {closeError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{closeError}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={TrendingUp}
          label={isViewingToday ? "Recebido hoje" : "Recebido no dia"}
          value={formatCurrency(data.totalSold)}
          accent="text-emerald-600 bg-emerald-50"
        />
        <Link href="/caixa/pendencias" className="block">
          <MetricCard
            icon={Clock}
            label="Pagar depois"
            value={formatCurrency(data.payLaterAmount)}
            sub={`${data.pendingPaymentCount} pendente(s) · ver devedores`}
            accent="text-amber-600 bg-amber-50"
          />
        </Link>
        <MetricCard
          icon={PiggyBank}
          label="Lucro estimado"
          value={formatCurrency(data.estimatedResult)}
          sub={`Despesas ${formatCurrency(data.totalExpenses)}`}
          accent="text-violet-600 bg-violet-50"
        />
        <MetricCard
          icon={Car}
          label="Veículos"
          value={String(data.vehicleCount)}
          sub={`${data.paidCount} pagos · ticket ${formatCurrency(data.averageTicket)}`}
          accent="text-sky-600 bg-sky-50"
        />
        <MetricCard
          icon={Wrench}
          label={isViewingToday ? "Na fila agora" : "Ficaram na fila"}
          value={String(inProgress)}
          sub={`${data.laneBreakdown.find((l) => l.lane === "PRONTO")?.count ?? 0} pronto(s)`}
          accent="text-orange-600 bg-orange-50"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Entregues"
          value={String(data.statusBreakdown.entregues)}
          sub={`Descontos ${formatCurrency(data.totalDiscounts)}`}
          accent="text-teal-600 bg-teal-50"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Receita por hora (pagos)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.hourlyRevenue.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum pagamento registrado {isViewingToday ? "hoje" : `em ${dayLabel}`}.
              </p>
            ) : (
              <div className="flex h-36 items-end gap-1.5">
                {data.hourlyRevenue.map(({ hour, amount }) => (
                  <div key={hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-sky-600 to-sky-400 transition-all"
                      style={{ height: `${Math.max((amount / maxHourly) * 100, 8)}%` }}
                      title={formatCurrency(amount)}
                    />
                    <span className="text-[10px] text-slate-500">{hour}h</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da fila {isViewingToday ? "hoje" : `em ${dayLabel}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.laneBreakdown ?? []).map((lane) => (
              <StatusRow
                key={lane.lane}
                label={lane.label}
                count={lane.count}
                color={LANE_COLORS[lane.lane] ?? DYNAMIC_LANE_COLOR}
              />
            ))}
            <StatusRow
              label="Entregues"
              count={data.statusBreakdown.entregues}
              color="bg-slate-400"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Formas de pagamento (recebido)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.byPaymentMethod).length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum pagamento recebido.</p>
            ) : (
              Object.entries(data.byPaymentMethod).map(([method, amount]) => {
                const Icon = METHOD_ICONS[method] ?? Wallet;
                const pct = methodTotal > 0 ? (amount / methodTotal) * 100 : 0;
                return (
                  <div key={method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={`inline-flex rounded-lg bg-gradient-to-br p-1.5 text-white ${METHOD_COLORS[method] ?? "from-slate-500 to-slate-600"}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {PAYMENT_METHOD_LABELS[method] ?? method}
                      </span>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${METHOD_COLORS[method] ?? "from-slate-400 to-slate-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SummaryRow label="Total recebido" value={formatCurrency(data.totalSold)} />
            <SummaryRow label="A receber (pagar depois)" value={formatCurrency(data.pendingAmount)} />
            <Link
              href="/caixa/pendencias"
              className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Abrir lista de devedores e quitações →
            </Link>
            <SummaryRow label="Descontos" value={formatCurrency(data.totalDiscounts)} />
            <SummaryRow label="Despesas do dia" value={formatCurrency(data.totalExpenses)} />
            {data.employeeExpenses > 0 && (
              <SummaryRow
                label="Vales / funcionários"
                value={formatCurrency(data.employeeExpenses)}
              />
            )}
            <SummaryRow
              label="Lucro estimado"
              value={formatCurrency(data.estimatedResult)}
              highlight
            />
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Lucro = recebido − despesas. Valores &quot;pagar depois&quot; não entram até a baixa.
            </p>
          </CardContent>
        </Card>
      </div>

      {data.pendingOrders.length === 0 && data.pendingPaymentCount === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 sm:flex-row sm:justify-between">
            <p className="text-sm text-slate-500">Nenhuma OS pendente {isViewingToday ? "hoje" : `em ${dayLabel}`}.</p>
            <Link href="/caixa/pendencias">
              <Button variant="outline">Ver pendências de todos os clientes</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.pendingOrders.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Pagamentos pendentes ({isViewingToday ? "hoje" : dayLabel})</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {data.pendingPaymentCount} OS · {formatCurrency(data.pendingAmount)}
              </p>
            </div>
            <Link href="/caixa/pendencias">
              <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 sm:w-auto">
                Ver todos os devedores
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"
                >
                  <p className="text-lg font-bold">{order.plate}</p>
                  <p className="text-sm text-slate-600">{order.clientName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ORDER_STATUS_LABELS[order.status]} ·{" "}
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                  </p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(order.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Movimentação {isViewingToday ? "do dia" : `de ${dayLabel}`} ({data.todayOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4 font-medium">Hora</th>
                <th className="pb-2 pr-4 font-medium">Placa</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Serviços</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Pagamento</th>
                <th className="pb-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.todayOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-slate-500">
                    {formatDateTime(order.entryAt).split(" ")[1]}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold">{order.plate}</td>
                  <td className="py-2.5 pr-4">{order.clientName}</td>
                  <td className="max-w-[160px] truncate py-2.5 pr-4 text-slate-600">
                    {order.services}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={
                        order.paymentStatus === "PENDENTE"
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }
                    >
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                      {order.paymentStatus === "PAGO" &&
                        ` · ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}`}
                    </span>
                  </td>
                  <td className="py-2.5 font-semibold">{formatCurrency(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.todayOrders.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma ordem {isViewingToday ? "hoje" : `em ${dayLabel}`}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fechamentos</CardTitle>
          <p className="text-sm text-slate-500">
            Histórico de caixas fechados — visualize ou exporte o relatório completo
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {closings.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum fechamento registrado ainda.</p>
          ) : (
            closings.map((closing) => {
              const label = formatBusinessDateKey(closing.date);
              return (
                <div
                  key={closing.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Fechamento do dia {label}</p>
                    <p className="text-xs text-slate-500">
                      Por {closing.closedBy} · {formatDateTime(closing.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/caixa/fechamentos/${closing.date}`}>
                      <Button size="sm" variant="secondary">
                        Visualizar relatório
                      </Button>
                    </Link>
                    <a href={`/api/cash/closings/${closing.date}/export?format=xlsx`}>
                      <Button size="sm" variant="outline">
                        Excel
                      </Button>
                    </a>
                    <Link href={`/caixa/fechamentos/${closing.date}?print=1`}>
                      <Button size="sm" variant="outline">
                        PDF
                      </Button>
                    </Link>
                    <a href={`/api/cash/closings/${closing.date}/export?format=csv`}>
                      <Button size="sm" variant="outline">
                        Exportar
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-800 hover:bg-amber-50"
                      disabled={reopenLoading}
                      onClick={() => void reopenCashDay(closing.date)}
                    >
                      Reabrir
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className={`mb-2 inline-flex rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold leading-tight xl:text-xl">{value}</p>
        {sub && <p className="mt-1 text-[10px] leading-snug text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${highlight ? "rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-900" : ""}`}
    >
      <span className={highlight ? "" : "text-slate-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-2 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-bold">{count}</span>
    </div>
  );
}
