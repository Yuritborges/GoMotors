import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    AGUARDANDO: "bg-amber-100 text-amber-800 border-amber-200",
    EM_LAVAGEM: "bg-blue-100 text-blue-800 border-blue-200",
    FINALIZACAO: "bg-purple-100 text-purple-800 border-purple-200",
    PRONTO: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ENTREGUE: "bg-slate-100 text-slate-600 border-slate-200",
    CANCELADO: "bg-red-100 text-red-800 border-red-200",
  };

  const labels: Record<string, string> = {
    AGUARDANDO: "Aguardando",
    EM_LAVAGEM: "Em lavagem",
    FINALIZACAO: "Finalização",
    PRONTO: "Pronto",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado",
  };

  return (
    <Badge className={colors[status] ?? "bg-slate-100 text-slate-700"}>
      {labels[status] ?? status}
    </Badge>
  );
}
