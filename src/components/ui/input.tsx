import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const SKIP_UPPERCASE_TYPES = new Set([
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "file",
  "checkbox",
  "radio",
  "range",
  "color",
  "hidden",
]);

function shouldUppercaseInput(
  type: string | undefined,
  noUppercase: boolean | undefined
): boolean {
  if (noUppercase) return false;
  if (type && SKIP_UPPERCASE_TYPES.has(type)) return false;
  return true;
}

function uppercaseEventValue<
  T extends HTMLInputElement | HTMLTextAreaElement,
>(e: React.ChangeEvent<T>): React.ChangeEvent<T> {
  const next = e.target.value.toLocaleUpperCase("pt-BR");
  if (next === e.target.value) return e;
  e.target.value = next;
  return e;
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { "data-no-uppercase"?: boolean }
>(function Input({ className, onChange, type, autoCapitalize, ...props }, ref) {
  const noUpper = Boolean(props["data-no-uppercase"]);
  const forceUpper = shouldUppercaseInput(type, noUpper);

  return (
    <input
      ref={ref}
      type={type}
      autoCapitalize={forceUpper ? (autoCapitalize ?? "characters") : autoCapitalize}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 sm:text-sm",
        className
      )}
      {...props}
      onChange={
        forceUpper && onChange
          ? (e) => onChange(uppercaseEventValue(e))
          : forceUpper
            ? (e) => {
                uppercaseEventValue(e);
              }
            : onChange
      }
    />
  );
});

export function Textarea({
  className,
  onChange,
  autoCapitalize,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  "data-no-uppercase"?: boolean;
}) {
  const noUpper = Boolean(props["data-no-uppercase"]);
  const forceUpper = !noUpper;

  return (
    <textarea
      autoCapitalize={forceUpper ? (autoCapitalize ?? "characters") : autoCapitalize}
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 sm:text-sm",
        className
      )}
      {...props}
      onChange={
        forceUpper && onChange
          ? (e) => onChange(uppercaseEventValue(e))
          : forceUpper
            ? (e) => {
                uppercaseEventValue(e);
              }
            : onChange
      }
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-slate-700", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}
