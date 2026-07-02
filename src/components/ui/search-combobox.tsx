"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn, formatPlate } from "@/lib/utils";
import { Input, Label } from "@/components/ui/input";

export type SearchComboboxOption = {
  value: string;
  label: string;
  description?: string;
  /** Texto extra usado na busca (placa, telefone, etc.) */
  searchText?: string;
};

type SearchComboboxProps = {
  label: string;
  options: SearchComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  /** Rótulo exibido quando value está definido mas a opção ainda não carregou */
  fallbackLabel?: string;
  className?: string;
};

function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function optionMatches(query: string, option: SearchComboboxOption) {
  if (!query.trim()) return true;
  const q = normalizeSearch(query);
  const plateQ = formatPlate(query);
  const haystack = normalizeSearch(
    [option.label, option.description, option.searchText].filter(Boolean).join(" ")
  );
  const plateHaystack = formatPlate(
    [option.label, option.description, option.searchText].filter(Boolean).join(" ")
  );
  return haystack.includes(q) || (plateQ.length >= 2 && plateHaystack.includes(plateQ));
}

export function SearchCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Digite para buscar...",
  disabled = false,
  emptyMessage = "Nenhum resultado",
  fallbackLabel,
  className,
}: SearchComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(
    () => options.filter((o) => optionMatches(query, o)),
    [options, query]
  );

  useEffect(() => {
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  function selectOption(option: SearchComboboxOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleFocus() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
  }

  const inputValue = open ? query : selected?.label ?? fallbackLabel ?? "";

  return (
    <div ref={rootRef} className={cn("relative space-y-1", className)}>
      <Label>{label}</Label>
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={selected || fallbackLabel ? undefined : placeholder}
        value={inputValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={handleFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
          if (e.key === "Enter" && open && filtered[0]) {
            e.preventDefault();
            selectOption(filtered[0]);
          }
        }}
      />

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-slate-500">{emptyMessage}</li>
          ) : (
            filtered.map((option) => (
              <li key={option.value} role="option" aria-selected={option.value === value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col px-3 py-2.5 text-left text-sm hover:bg-sky-50",
                    option.value === value && "bg-sky-50 font-medium"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <span className="text-slate-900">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-slate-500">{option.description}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
