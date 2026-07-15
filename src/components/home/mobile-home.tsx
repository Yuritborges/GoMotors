import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  HardHat,
  History,
  Kanban,
  Package,
  Plus,
  Receipt,
  Store,
  Tv,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type ModuleItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  external?: boolean;
};

const OPERATION_ITEMS: ModuleItem[] = [
  { href: "/ordens/nova", label: "Nova ordem", icon: Plus, color: "bg-sky-100 text-sky-700" },
  { href: "/painel", label: "Painel", icon: Kanban, color: "bg-indigo-100 text-indigo-700" },
  { href: "/ordens", label: "Ordens", icon: ClipboardList, color: "bg-violet-100 text-violet-700" },
  { href: "/clientes", label: "Clientes", icon: Users, color: "bg-emerald-100 text-emerald-700" },
  { href: "/servicos", label: "Serviços", icon: Wrench, color: "bg-amber-100 text-amber-700" },
  { href: "/display", label: "Telão (TV)", icon: Tv, color: "bg-cyan-100 text-cyan-700", external: true },
];

const MANAGEMENT_ITEMS: ModuleItem[] = [
  { href: "/caixa", label: "Caixa", icon: Wallet, color: "bg-emerald-100 text-emerald-700" },
  { href: "/financeiro", label: "Financeiro", icon: BarChart3, color: "bg-sky-100 text-sky-700" },
  { href: "/despesas", label: "Despesas", icon: Receipt, color: "bg-red-100 text-red-700" },
  { href: "/clientes/lojas", label: "Lojas", icon: Store, color: "bg-orange-100 text-orange-700" },
  { href: "/estoque", label: "Estoque", icon: Package, color: "bg-amber-100 text-amber-700" },
  { href: "/funcionarios", label: "Funcionários", icon: HardHat, color: "bg-lime-100 text-lime-700" },
  { href: "/relatorios", label: "Relatórios", icon: FileSpreadsheet, color: "bg-indigo-100 text-indigo-700" },
  { href: "/auditoria", label: "Auditoria", icon: History, color: "bg-slate-200 text-slate-700" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, color: "bg-zinc-200 text-zinc-700" },
];

function ModuleButton({ item }: { item: ModuleItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-sm transition-colors active:bg-slate-50 touch-manipulation"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-center text-xs font-medium text-slate-700">{item.label}</span>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: ModuleItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((item) => (
          <ModuleButton key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}

export function MobileHome({
  owner,
  userName,
  dailyRevenue,
  vehiclesToday,
  statusCounts,
}: {
  owner: boolean;
  userName: string;
  dailyRevenue: number;
  vehiclesToday: number;
  statusCounts: { aguardando: number; emLavagem: number; pronto: number };
}) {
  return (
    <div className="space-y-4 lg:hidden">
      <section className="rounded-2xl bg-zinc-950 p-4 text-white shadow-sm">
        <p className="text-xs text-zinc-400">Olá, {userName.split(" ")[0]}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          {owner ? (
            <div>
              <p className="text-xs text-zinc-400">Recebido hoje</p>
              <p className="text-2xl font-bold">{formatCurrency(dailyRevenue)}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-zinc-400">Veículos hoje</p>
              <p className="text-2xl font-bold">{vehiclesToday}</p>
            </div>
          )}
          <div className="text-right">
            {owner && (
              <p className="text-xs text-zinc-400">
                {vehiclesToday} veículo{vehiclesToday === 1 ? "" : "s"} hoje
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 text-center">
          <div>
            <p className="text-lg font-bold text-amber-400">{statusCounts.aguardando}</p>
            <p className="text-[11px] text-zinc-400">Aguardando</p>
          </div>
          <div>
            <p className="text-lg font-bold text-sky-400">{statusCounts.emLavagem}</p>
            <p className="text-[11px] text-zinc-400">Em lavagem</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-400">{statusCounts.pronto}</p>
            <p className="text-[11px] text-zinc-400">Prontos</p>
          </div>
        </div>
      </section>

      <Section title="Operação" items={OPERATION_ITEMS} />
      {owner && <Section title="Gestão" items={MANAGEMENT_ITEMS} />}
    </div>
  );
}
