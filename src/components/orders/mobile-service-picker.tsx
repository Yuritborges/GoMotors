"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  PRIMARY_WORKFLOW_TASKS,
  type ExtraServiceState,
  type WorkflowTaskKey,
  type WorkflowTaskState,
} from "@/lib/order-workflow";

type Service = {
  id: string;
  name: string;
  defaultPrice: number;
  vehiclePrices: { vehicleType: string; price: number }[];
};

type Employee = { id: string; name: string };

export type ServicePickerState = {
  workflow: Record<WorkflowTaskKey, WorkflowTaskState>;
  extras: Record<string, ExtraServiceState>;
  showMoreOptions: boolean;
};

type MobileServicePickerProps = {
  services: Service[];
  employees: Employee[];
  vehicleType?: string;
  workflow: Record<WorkflowTaskKey, WorkflowTaskState>;
  extras: Record<string, ExtraServiceState>;
  showMoreOptions: boolean;
  onWorkflowChange: (next: Record<WorkflowTaskKey, WorkflowTaskState>) => void;
  onExtrasChange: (next: Record<string, ExtraServiceState>) => void;
  onShowMoreOptionsChange: (open: boolean) => void;
};

function servicePrice(service: Service, vehicleType?: string) {
  if (!vehicleType) return service.defaultPrice;
  const vp = service.vehiclePrices.find((p) => p.vehicleType === vehicleType);
  return vp?.price ?? service.defaultPrice;
}

function EmployeePills({
  employees,
  selectedId,
  onSelect,
}: {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      {employees.map((emp) => (
        <button
          key={emp.id}
          type="button"
          onClick={() => onSelect(emp.id)}
          className={cn(
            "min-h-[44px] rounded-xl border px-2 py-2.5 text-sm font-semibold uppercase tracking-wide touch-manipulation transition-colors active:scale-[0.98]",
            selectedId === emp.id
              ? "border-sky-500 bg-sky-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 active:bg-slate-50"
          )}
        >
          {emp.name}
        </button>
      ))}
    </div>
  );
}

export function MobileServicePicker({
  services,
  employees,
  vehicleType,
  workflow,
  extras,
  showMoreOptions,
  onWorkflowChange,
  onExtrasChange,
  onShowMoreOptionsChange,
}: MobileServicePickerProps) {
  function toggleWorkflowRow(key: WorkflowTaskKey) {
    const current = workflow[key];
    onWorkflowChange({
      ...workflow,
      [key]: { ...current, open: !current.open },
    });
  }

  function setWorkflowEmployee(key: WorkflowTaskKey, employeeId: string) {
    onWorkflowChange({
      ...workflow,
      [key]: { employeeId, open: true },
    });
  }

  function toggleExtra(serviceId: string) {
    const current = extras[serviceId] ?? {
      selected: false,
      employeeId: null,
      open: false,
    };
    const nextSelected = !current.selected;
    onExtrasChange({
      ...extras,
      [serviceId]: {
        selected: nextSelected,
        employeeId: nextSelected ? current.employeeId : null,
        open: nextSelected,
      },
    });
  }

  function setExtraEmployee(serviceId: string, employeeId: string) {
    const current = extras[serviceId] ?? {
      selected: true,
      employeeId: null,
      open: true,
    };
    onExtrasChange({
      ...extras,
      [serviceId]: { selected: true, employeeId, open: true },
    });
  }

  const employeeName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? null;

  return (
    <div className="space-y-3">
      {PRIMARY_WORKFLOW_TASKS.map(({ key, label }) => {
        const task = workflow[key];
        const assigned = employeeName(task.employeeId);

        return (
          <div
            key={key}
            className={cn(
              "rounded-xl border bg-white transition-colors",
              task.employeeId ? "border-sky-300 ring-1 ring-sky-100" : "border-slate-200"
            )}
          >
            <button
              type="button"
              onClick={() => toggleWorkflowRow(key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left touch-manipulation"
            >
              <div className="min-w-0">
                <p className="text-base font-bold uppercase tracking-wide text-slate-900">
                  {label}
                </p>
                <p className="text-xs text-slate-500">
                  {assigned
                    ? `Responsável: ${assigned}`
                    : "Toque e escolha o funcionário"}
                </p>
              </div>
              {task.open ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
              )}
            </button>

            {task.open && (
              <div className="border-t border-slate-100 px-4 pb-4">
                <EmployeePills
                  employees={employees}
                  selectedId={task.employeeId}
                  onSelect={(id) => setWorkflowEmployee(key, id)}
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onShowMoreOptionsChange(!showMoreOptions)}
        className="flex w-full items-center justify-between rounded-xl border border-dashed border-sky-300 bg-sky-50/50 px-4 py-3.5 text-left touch-manipulation active:bg-sky-50"
      >
        <span className="text-sm font-semibold text-sky-800">
          {showMoreOptions ? "− Ocultar opções de lavagem" : "+ Opções de lavagem"}
        </span>
        {showMoreOptions ? (
          <ChevronUp className="h-5 w-5 text-sky-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-sky-600" />
        )}
      </button>

      {showMoreOptions && (
        <div className="space-y-2">
          {services.map((service) => {
            const state = extras[service.id] ?? {
              selected: false,
              employeeId: null,
              open: false,
            };
            const price = servicePrice(service, vehicleType);
            const assigned = employeeName(state.employeeId);

            return (
              <div
                key={service.id}
                className={cn(
                  "rounded-xl border bg-white transition-colors",
                  state.selected
                    ? "border-sky-300 ring-1 ring-sky-100"
                    : "border-slate-200"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleExtra(service.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left touch-manipulation"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                    {state.selected && assigned && (
                      <p className="text-xs text-sky-700">Responsável: {assigned}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-600">
                    {formatCurrency(price)}
                  </span>
                </button>

                {state.selected && (
                  <div className="border-t border-slate-100 px-4 pb-4">
                    <p className="pt-2 text-xs text-slate-500">Quem vai executar?</p>
                    <EmployeePills
                      employees={employees}
                      selectedId={state.employeeId}
                      onSelect={(id) => setExtraEmployee(service.id, id)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
