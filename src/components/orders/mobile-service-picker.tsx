"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  isLavagemCatalogService,
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
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={cn(
          "min-h-[44px] rounded-xl border px-2 py-2.5 text-sm font-semibold touch-manipulation",
          !selectedId
            ? "border-slate-400 bg-slate-100 text-slate-600"
            : "border-slate-200 bg-white text-slate-400"
        )}
      >
        —
      </button>
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

function WorkflowTaskCard({
  label,
  employeeId,
  employees,
  onSelect,
}: {
  label: string;
  employeeId: string | null;
  employees: Employee[];
  onSelect: (id: string) => void;
}) {
  const assigned = employees.find((e) => e.id === employeeId)?.name;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 transition-colors",
        employeeId ? "border-sky-300 ring-1 ring-sky-100" : "border-slate-200"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-base font-bold uppercase tracking-wide text-slate-900">{label}</p>
        {assigned && (
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
            {assigned}
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-slate-500">Quem vai executar?</p>
      <EmployeePills
        employees={employees}
        selectedId={employeeId}
        onSelect={(id) => onSelect(id || "")}
      />
    </div>
  );
}

function ServiceRow({
  service,
  state,
  price,
  assigned,
  onToggle,
  onSelectEmployee,
  employees,
}: {
  service: Service;
  state: ExtraServiceState;
  price: number;
  assigned: string | null;
  onToggle: () => void;
  onSelectEmployee: (id: string) => void;
  employees: Employee[];
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white transition-colors",
        state.selected ? "border-sky-300 ring-1 ring-sky-100" : "border-slate-200"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
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
          <div className="pt-2">
            <EmployeePills
              employees={employees}
              selectedId={state.employeeId}
              onSelect={onSelectEmployee}
            />
          </div>
        </div>
      )}
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
  const washServices = services.filter((s) => isLavagemCatalogService(s.name));
  const otherServices = services.filter((s) => !isLavagemCatalogService(s.name));

  function setWorkflowEmployee(key: WorkflowTaskKey, employeeId: string) {
    onWorkflowChange({
      ...workflow,
      [key]: { employeeId: employeeId || null, open: true },
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
    if (!employeeId) {
      onExtrasChange({
        ...extras,
        [serviceId]: { selected: true, employeeId: null, open: true },
      });
      return;
    }
    onExtrasChange({
      ...extras,
      [serviceId]: { selected: true, employeeId, open: true },
    });
  }

  const employeeName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {PRIMARY_WORKFLOW_TASKS.map(({ key, label }) => (
          <WorkflowTaskCard
            key={key}
            label={label}
            employeeId={workflow[key].employeeId}
            employees={employees}
            onSelect={(id) => setWorkflowEmployee(key, id)}
          />
        ))}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
          Tipo de lavagem *
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Selecione o serviço e o responsável para calcular o valor.
        </p>
        <div className="space-y-2">
          {washServices.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Nenhum serviço de lavagem cadastrado.
            </p>
          ) : (
            washServices.map((service) => {
              const state = extras[service.id] ?? {
                selected: false,
                employeeId: null,
                open: false,
              };
              return (
                <ServiceRow
                  key={service.id}
                  service={service}
                  state={state}
                  price={servicePrice(service, vehicleType)}
                  assigned={employeeName(state.employeeId)}
                  onToggle={() => toggleExtra(service.id)}
                  onSelectEmployee={(id) => setExtraEmployee(service.id, id)}
                  employees={employees}
                />
              );
            })
          )}
        </div>
      </div>

      {otherServices.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => onShowMoreOptionsChange(!showMoreOptions)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-3.5 text-left touch-manipulation"
          >
            <span className="text-sm font-semibold text-slate-700">
              {showMoreOptions ? "− Ocultar serviços extras" : "+ Serviços extras"}
            </span>
            {showMoreOptions ? (
              <ChevronUp className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {showMoreOptions && (
            <div className="space-y-2">
              {otherServices.map((service) => {
                const state = extras[service.id] ?? {
                  selected: false,
                  employeeId: null,
                  open: false,
                };
                return (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    state={state}
                    price={servicePrice(service, vehicleType)}
                    assigned={employeeName(state.employeeId)}
                    onToggle={() => toggleExtra(service.id)}
                    onSelectEmployee={(id) => setExtraEmployee(service.id, id)}
                    employees={employees}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
