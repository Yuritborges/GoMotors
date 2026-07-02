"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatCurrency, formatPlate } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { PageHeader } from "@/components/layout/page-header";
import { PlateScanner } from "@/components/vehicles/plate-scanner";
import Link from "next/link";

type PlateLookup = {
  found: boolean;
  plate?: string;
  client?: { id: string; name: string; phone: string };
  vehicle?: { id: string; plate: string; model: string | null; vehicleType: string };
  activeOrder?: {
    id: string;
    status: string;
    statusLabel: string;
    total: number;
    items: string[];
  };
};

type Client = {
  id: string;
  name: string;
  phone: string;
  vehicles: { id: string; plate: string; vehicleType: string }[];
};

type Service = {
  id: string;
  name: string;
  defaultPrice: number;
  vehiclePrices: { vehicleType: string; price: number }[];
};

type Employee = { id: string; name: string };

export default function NovaOrdemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("PENDENTE");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [plateQuery, setPlateQuery] = useState("");
  const [plateLookup, setPlateLookup] = useState<PlateLookup | null>(null);
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateOcrError, setPlateOcrError] = useState("");

  const lookupPlate = useCallback(async (raw: string) => {
    const plate = formatPlate(raw);
    if (plate.length < 6) {
      setPlateLookup(null);
      return;
    }
    setPlateLoading(true);
    try {
      const res = await fetch(`/api/vehicles/lookup?plate=${encodeURIComponent(plate)}`);
      const data: PlateLookup = await res.json();
      setPlateLookup(data);
      if (data.found && data.client && data.vehicle) {
        const foundClient = data.client;
        const foundVehicle = data.vehicle;
        setClientId(foundClient.id);
        setVehicleId(foundVehicle.id);
        setClients((prev) => {
          const existing = prev.find((c) => c.id === foundClient.id);
          const vehicleEntry = {
            id: foundVehicle.id,
            plate: foundVehicle.plate,
            vehicleType: foundVehicle.vehicleType,
          };
          if (existing) {
            const hasVehicle = existing.vehicles.some((v) => v.id === vehicleEntry.id);
            if (hasVehicle) return prev;
            return prev.map((c) =>
              c.id === foundClient.id
                ? { ...c, vehicles: [...c.vehicles, vehicleEntry] }
                : c
            );
          }
          return [
            ...prev,
            {
              id: foundClient.id,
              name: foundClient.name,
              phone: foundClient.phone,
              vehicles: [vehicleEntry],
            },
          ];
        });
      }
    } finally {
      setPlateLoading(false);
    }
  }, []);

  function applyLookupToForm(data: PlateLookup) {
    if (!data.client || !data.vehicle) return;
    const foundClient = data.client;
    const foundVehicle = data.vehicle;
    setClientId(foundClient.id);
    setVehicleId(foundVehicle.id);
    setClients((prev) => {
      const existing = prev.find((c) => c.id === foundClient.id);
      const vehicleEntry = {
        id: foundVehicle.id,
        plate: foundVehicle.plate,
        vehicleType: foundVehicle.vehicleType,
      };
      if (existing) {
        const hasVehicle = existing.vehicles.some((v) => v.id === vehicleEntry.id);
        if (hasVehicle) return prev;
        return prev.map((c) =>
          c.id === foundClient.id
            ? { ...c, vehicles: [...c.vehicles, vehicleEntry] }
            : c
        );
      }
      return [
        ...prev,
        {
          id: foundClient.id,
          name: foundClient.name,
          phone: foundClient.phone,
          vehicles: [vehicleEntry],
        },
      ];
    });
  }

  function mergeClientIntoList(client: Client) {
    setClients((prev) => {
      if (prev.some((c) => c.id === client.id)) {
        return prev.map((c) =>
          c.id === client.id
            ? {
                ...c,
                vehicles: [
                  ...c.vehicles,
                  ...client.vehicles.filter(
                    (v) => !c.vehicles.some((ev) => ev.id === v.id)
                  ),
                ],
              }
            : c
        );
      }
      return [...prev, client];
    });
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([c, s, e]) => {
      setClients(c);
      setServices(s.filter((svc: Service & { active: boolean }) => svc.active !== false));
      setEmployees(e);
    });
  }, []);

  useEffect(() => {
    const preClientId = searchParams.get("clientId");
    const preVehicleId = searchParams.get("vehicleId");
    if (preClientId) setClientId(preClientId);
    if (preVehicleId) setVehicleId(preVehicleId);

    if (preClientId) {
      fetch(`/api/clients/${preClientId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          mergeClientIntoList({
            id: data.id,
            name: data.name,
            phone: data.phone,
            vehicles: data.vehicles.map(
              (v: { id: string; plate: string; vehicleType: string }) => ({
                id: v.id,
                plate: v.plate,
                vehicleType: v.vehicleType,
              })
            ),
          });
        });
    }
  }, [searchParams]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedVehicle = selectedClient?.vehicles.find((v) => v.id === vehicleId);

  const subtotal = useMemo(() => {
    if (!selectedVehicle) return 0;
    return selectedServices.reduce((sum, serviceId) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return sum;
      const vp = service.vehiclePrices.find(
        (p) => p.vehicleType === selectedVehicle.vehicleType
      );
      return sum + (vp?.price ?? service.defaultPrice);
    }, 0);
  }, [selectedServices, selectedVehicle, services]);

  const total = Math.max(subtotal - Number(discount || 0), 0);

  const plateReady = Boolean(clientId && vehicleId && !plateLookup?.activeOrder);
  const canSubmit =
    plateReady && selectedServices.length > 0 && !saving && !plateLookup?.activeOrder;

  const showMobileSummary = plateReady && plateLookup?.found;

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.name,
        description: c.phone,
        searchText: c.vehicles.map((v) => v.plate).join(" "),
      })),
    [clients]
  );

  const vehicleOptions = useMemo(() => {
    if (clientId && selectedClient) {
      return selectedClient.vehicles.map((v) => ({
        value: v.id,
        label: v.plate,
        description: VEHICLE_TYPE_LABELS[v.vehicleType] ?? v.vehicleType,
        searchText: v.plate,
      }));
    }
    return clients.flatMap((c) =>
      c.vehicles.map((v) => ({
        value: `${c.id}:${v.id}`,
        label: v.plate,
        description: `${c.name} · ${VEHICLE_TYPE_LABELS[v.vehicleType] ?? v.vehicleType}`,
        searchText: `${v.plate} ${c.name} ${c.phone}`,
      }))
    );
  }, [clients, clientId, selectedClient]);

  function handleClientChange(id: string) {
    setClientId(id);
    setVehicleId("");
  }

  function handleVehicleChange(id: string) {
    const colon = id.indexOf(":");
    if (colon !== -1) {
      setClientId(id.slice(0, colon));
      setVehicleId(id.slice(colon + 1));
      return;
    }
    setVehicleId(id);
  }

  const vehicleComboboxValue = useMemo(() => {

    if (!vehicleId) return "";
    if (clientId) return vehicleId;
    const client = clients.find((c) => c.vehicles.some((v) => v.id === vehicleId));
    return client ? `${client.id}:${vehicleId}` : vehicleId;
  }, [clientId, vehicleId, clients]);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !vehicleId || selectedServices.length === 0) return;
    if (plateLookup?.activeOrder) return;

    setSaving(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        vehicleId,
        employeeId: employeeId || null,
        serviceIds: selectedServices,
        discount: Number(discount || 0),
        paymentMethod,
        notes,
      }),
    });
    const order = await res.json();
    setSaving(false);
    if (res.ok && order.id) {
      router.push(`/ordens/${order.id}/comprovante`);
    } else {
      router.push("/painel");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-28 sm:space-y-6 sm:pb-0">
      <PageHeader
        title="Nova ordem"
        description="Placa → serviços → registrar"
      />

      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm">
        <CardHeader className="pb-2 pt-4 sm:pt-6">
          <CardTitle className="text-lg sm:text-xl">Placa do veículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4 sm:pb-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={plateQuery}
              onChange={(e) => {
                const v = formatPlate(e.target.value);
                setPlateQuery(v);
                if (v.length >= 7) lookupPlate(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookupPlate(plateQuery);
                }
              }}
              placeholder="ABC1D23"
              className="h-14 text-center text-2xl font-bold uppercase tracking-[0.2em] sm:h-11 sm:text-left sm:text-xl sm:tracking-widest"
              autoComplete="off"
              autoFocus
              inputMode="text"
              maxLength={7}
            />
            <Button
              type="button"
              className="hidden h-11 shrink-0 sm:inline-flex"
              disabled={plateLoading || plateQuery.length < 6}
              onClick={() => lookupPlate(plateQuery)}
            >
              {plateLoading ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          <PlateScanner
            disabled={plateLoading}
            onPlateDetected={(plate) => {
              setPlateOcrError("");
              setPlateQuery(plate);
              void lookupPlate(plate);
            }}
            onError={setPlateOcrError}
          />

          {plateOcrError && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {plateOcrError}
            </p>
          )}

          {plateLoading && (
            <p className="text-center text-sm text-sky-700 sm:text-left">Buscando placa...</p>
          )}

          {plateLookup?.found && (
            <button
              type="button"
              onClick={() => applyLookupToForm(plateLookup)}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-left text-sm transition-colors hover:bg-emerald-100/80 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400 touch-manipulation"
            >
              <p className="font-semibold text-emerald-900">
                {plateLookup.client?.name}
                {plateLookup.vehicle?.model ? ` · ${plateLookup.vehicle.model}` : ""}
              </p>
              <p className="text-emerald-800">
                Placa {plateLookup.vehicle?.plate} ·{" "}
                {VEHICLE_TYPE_LABELS[plateLookup.vehicle?.vehicleType ?? ""] ??
                  plateLookup.vehicle?.vehicleType}
              </p>
              {plateLookup.activeOrder ? (
                <div className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-amber-900">
                  <p className="font-medium">
                    Já na fila hoje: {plateLookup.activeOrder.statusLabel}
                  </p>
                  <p className="text-xs">
                    {plateLookup.activeOrder.items.join(", ")} —{" "}
                    {formatCurrency(plateLookup.activeOrder.total)}
                  </p>
                  <Link
                    href="/painel"
                    className="mt-1 inline-block text-xs font-semibold underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ver no painel →
                  </Link>
                </div>
              ) : (
                <p className="mt-1 text-emerald-700">
                  {clientId === plateLookup.client?.id
                    ? "Selecionado — escolha os serviços abaixo."
                    : "Toque para confirmar e escolher serviços."}
                </p>
              )}
            </button>
          )}

          {plateLookup && !plateLookup.found && plateQuery.length >= 6 && !plateLoading && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Placa não cadastrada.{" "}
              <Link
                href={`/clientes?novo=1&placa=${encodeURIComponent(plateQuery)}`}
                className="font-semibold underline"
              >
                Cadastro rápido
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <form id="nova-ordem-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {showMobileSummary && selectedClient && selectedVehicle && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 lg:hidden">
            <p className="font-semibold text-slate-900">{selectedClient.name}</p>
            <p className="text-sm text-slate-600">
              {selectedVehicle.plate} ·{" "}
              {VEHICLE_TYPE_LABELS[selectedVehicle.vehicleType] ?? selectedVehicle.vehicleType}
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setEmployeeId("")}
                className={cn(
                  "min-h-[48px] rounded-xl border px-2 py-3 text-sm font-medium transition-colors touch-manipulation",
                  !employeeId
                    ? "border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-200"
                    : "border-slate-200 bg-white text-slate-600 active:bg-slate-50"
                )}
              >
                —
              </button>
              {employees.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEmployeeId(e.id)}
                  className={cn(
                    "min-h-[48px] rounded-xl border px-2 py-3 text-sm font-semibold uppercase tracking-wide transition-colors touch-manipulation",
                    employeeId === e.id
                      ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-800 active:bg-slate-50"
                  )}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="hidden lg:block">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Cliente e veículo</CardTitle>
            <Link
              href="/clientes?novo=1"
              className="text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              + Cadastro rápido
            </Link>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SearchCombobox
              label="Cliente"
              options={clientOptions}
              value={clientId}
              onChange={handleClientChange}
              placeholder="Nome, telefone ou placa..."
              emptyMessage="Nenhum cliente encontrado"
              fallbackLabel={
                plateLookup?.found && clientId === plateLookup.client?.id
                  ? plateLookup.client.name
                  : undefined
              }
            />
            <SearchCombobox
              label="Veículo"
              options={vehicleOptions}
              value={vehicleComboboxValue}
              onChange={handleVehicleChange}
              placeholder={clientId ? "Digite a placa..." : "Placa ou nome do cliente..."}
              disabled={clients.length === 0}
              emptyMessage="Nenhum veículo encontrado"
              fallbackLabel={
                plateLookup?.found && vehicleId === plateLookup.vehicle?.id
                  ? `${plateLookup.vehicle.plate} · ${VEHICLE_TYPE_LABELS[plateLookup.vehicle.vehicleType] ?? plateLookup.vehicle.vehicleType}`
                  : undefined
              }
            />
            <Field className="sm:col-span-2">
              <Label>Funcionário responsável</Label>
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Não definido</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Serviços</CardTitle>
            {!selectedVehicle && (
              <p className="text-sm text-slate-500">Busque a placa para ver os preços corretos.</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {services.map((service) => {
                const price =
                  selectedVehicle
                    ? service.vehiclePrices.find(
                        (p) => p.vehicleType === selectedVehicle.vehicleType
                      )?.price ?? service.defaultPrice
                    : service.defaultPrice;
                const selected = selectedServices.includes(service.id);

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={cn(
                      "flex min-h-[56px] items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors touch-manipulation active:scale-[0.99]",
                      selected
                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <span className="text-sm font-medium leading-snug text-slate-900">
                      {service.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold",
                        selected ? "text-sky-700" : "text-slate-600"
                      )}
                    >
                      {formatCurrency(price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key)}
                  className={cn(
                    "min-h-[44px] rounded-xl border px-2 py-2.5 text-xs font-medium touch-manipulation",
                    paymentMethod === key
                      ? "border-sky-500 bg-sky-600 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <details className="group sm:hidden">
              <summary className="cursor-pointer list-none text-sm font-medium text-sky-700 touch-manipulation">
                Desconto e observações
              </summary>
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                <Field>
                  <Label>Desconto (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </Field>
                <Field>
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
            </details>

            <div className="hidden gap-4 sm:grid sm:grid-cols-2">
              <Field>
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Forma de pagamento</Label>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="hidden flex-col gap-3 sm:flex sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
            {saving ? "Salvando..." : "Registrar ordem"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
        </div>
      </form>

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">
              {selectedServices.length === 0
                ? "Escolha os serviços"
                : `${selectedServices.length} serviço(s)`}
            </p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(total)}</p>
          </div>
          <Button
            type="submit"
            form="nova-ordem-form"
            className="h-12 min-w-[140px] shrink-0 px-6 text-base"
            disabled={!canSubmit}
          >
            {saving ? "..." : "Registrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
