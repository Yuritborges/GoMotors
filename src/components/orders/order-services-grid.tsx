import { cn } from "@/lib/utils";

export type OrderServiceLine = {
  serviceName: string;
  employeeName: string | null;
};

type OrderServicesGridProps = {
  items: OrderServiceLine[];
  compact?: boolean;
  dark?: boolean;
  className?: string;
};

export function OrderServicesGrid({
  items,
  compact = false,
  dark = false,
  className,
}: OrderServicesGridProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "divide-y rounded-lg border",
        dark
          ? "divide-zinc-700 border-zinc-700 bg-zinc-950/40"
          : "divide-slate-100 border-slate-200 bg-slate-50/80",
        className
      )}
    >
      {items.map((item, index) => (
        <div
          key={`${item.serviceName}-${index}`}
          className={cn(
            "grid grid-cols-[1fr_auto] items-center gap-2",
            compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs sm:text-sm"
          )}
        >
          <span
            className={cn(
              "font-medium",
              dark ? "text-zinc-200" : "text-slate-800"
            )}
          >
            {item.serviceName}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 font-semibold",
              dark
                ? "bg-zinc-800 text-sky-300"
                : "bg-white text-sky-800 ring-1 ring-slate-200"
            )}
          >
            {item.employeeName ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
