import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 max-lg:hidden">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          {children}
        </div>
      )}
    </div>
  );
}

export function MobileCardList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-3 md:hidden", className)}>{children}</div>;
}

export function DesktopTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hidden overflow-x-auto md:block", className)}>
      {children}
    </div>
  );
}
