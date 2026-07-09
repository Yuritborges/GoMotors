"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatCurrency, formatPlate } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/lib/constants";
import { ORDER_PAYMENT_METHODS } from "@/lib/payments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { PageHeader } from "@/components/layout/page-header";
import { MobileServicePicker } from "@/components/orders/mobile-service-picker";
import { buildOrderItems, orderItemsSubtotal } from "@/lib/build-order-items";
import {
  countAssignments,
  hasAnyAssignedService,
  type ExtraServiceState,
  type WorkflowTaskKey,
  type WorkflowTaskState,
} from "@/lib/order-workflow";
import { PlateScanner } from "@/components/vehicles/plate-scanner";
import {
  defaultRetroactiveEntryValue,
  toDatetimeLocalValue,
} from "@/lib/order-entry-date";
import {
  businessDateKey,
  formatBusinessDateKey,
  isBusinessDateKey,
} from "@/lib/business-day";
import Link from "next/link";

const INITIAL_WORKFLOW: Record<WorkflowTaskKey, WorkflowTaskState> = {
  lavagem: { employeeId: null, open: false },
  aspiracao: { employeeId: null, open: false },
  secagem: { employeeId: null, open: false },
};

type PlateLookup = {
  found: boolean;
  plate?: string;
  client?: { id: string; name: string; phone: string };
  vehicle?: { id: string; plate: string; model: string | null; vehicleType: string };
  /** Só bloqueia se em andamento (aguardando/lavagem/finalização) */
  activeOrder?: {
    id: string;
    status: string;
    statusLabel: string;
    total: number;
    items: string[];
  } | null;
  /** Informativo — pronto para retirada, NÃO bloqueia nova OS */
  readyOrder?: {
    id: string;
    status: string;
    statusLabel: string;
    total: number;
    items: string[];
  } | null;
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
  estimatedMinutes: number;
  vehiclePrices: { vehicleType: string; price: number }[];
};

type Employee = { id: string; name: string };

type PartnerStore = { id: string; name: string; active: boolean };

export default function NovaOrdemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const operatingDateParam = searchParams.get("operatingDate");
  const operatingDate =
    operatingDateParam && isBusinessDateKey(operatingDateParam) ? operatingDateParam : null;
  const isOperatingPastDay = operatingDate !== null && operatingDate !== businessDateKey();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [workflow, setWorkflow] =
    useState<Record<WorkflowTaskKey, WorkflowTaskState>>(INITIAL_WORKFLOW);
  const [extras, setExtras] = useState<Record<string, ExtraServiceState>>({});
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("PAGAR_DEPOIS");
  const [orderType, setOrderType] = useState<"AVULSO" | "PARCEIRO">("AVULSO");
  const [partnerStores, setPartnerStores] = useState<PartnerStore[]>([]);
  const [partnerStoreId, setPartnerStoreId] = useState("");
  const [showNewStore, setShowNewStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const [storeError, setStoreError] = useState("");
  const [retroactive, setRetroactive] = useState(false);
  const [entryAtLocal, setEntryAtLocal] = useState(defaultRetroactiveEntryValue);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [plateQuery, setPlateQuery] = useState("");
  const [plateLookup, setPlateLookup] = useState<PlateLookup | null>(null);
  const [plateLoading, setPlateLoading] = useState(false);

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

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partners");
      if (!res.ok) return;
      const data = (await res.json()) as PartnerStore[];
      setPartnerStores(data.filter((s) => s.active));
    } catch {
      /* silencioso — parceiro é opcional */
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([c, s, e]) => {
      setClients(c);
      const activeServices = s.filter(
        (svc: Service & { active: boolean }) => svc.active !== false
      );
      setServices(activeServices);
      setEmployees(e);
      setExtras((prev) => {
        const next = { ...prev };
        for (const svc of activeServices) {
          if (!next[svc.id]) {
            next[svc.id] = { selected: false, employeeId: null, open: false };
          }
        }
        return next;
      });
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

  const orderItems = useMemo(() => {
    if (!selectedVehicle) return [];
    return buildOrderItems({
      services,
      vehicleType: selectedVehicle.vehicleType,
      workflow,
      extras,
    });
  }, [services, selectedVehicle, workflow, extras]);

  const subtotal = useMemo(() => orderItemsSubtotal(orderItems), [orderItems]);

  const total = Math.max(subtotal - Number(discount || 0), 0);

  const extrasMissingEmployee = Object.values(extras).some(
    (e) => e.selected && !e.employeeId
  );
  const plateReady = Boolean(clientId && vehicleId && !plateLookup?.activeOrder);

  const assignmentCount = countAssignments(workflow, extras);
  const servicesReady = assignmentCount > 0 && !extrasMissingEmployee;
  const partnerReady = orderType === "AVULSO" || Boolean(partnerStoreId);
  const paymentOptions: string[] =
    orderType === "PARCEIRO"
      ? [...ORDER_PAYMENT_METHODS, "FECHAMENTO_MENSAL"]
      : [...ORDER_PAYMENT_METHODS];
  const canSubmit =
    plateReady &&
    servicesReady &&
    orderItems.length > 0 &&
    !saving &&
    partnerReady &&
    !plateLookup?.activeOrder;

  const showMobileSummary = plateReady && plateLookup?.found;
  const showPaymentSection = plateReady && servicesReady;

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

  function handleOrderTypeChange(type: "AVULSO" | "PARCEIRO") {
    setOrderType(type);
    setStoreError("");
    if (type === "PARCEIRO") {
      setPaymentMethod("FECHAMENTO_MENSAL");
    } else {
      setPartnerStoreId("");
      setShowNewStore(false);
      if (paymentMethod === "FECHAMENTO_MENSAL") setPaymentMethod("PAGAR_DEPOIS");
    }
  }

  async function createStore() {
    const name = newStoreName.trim();
    if (!name) {
      setStoreError("Informe o nome da loja.");
      return;
    }
    setSavingStore(true);
    setStoreError("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStoreError(data.error ?? "Não foi possível criar a loja.");
        return;
      }
      await loadPartners();
      setPartnerStoreId(data.id);
      setNewStoreName("");
      setShowNewStore(false);
    } finally {
      setSavingStore(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !vehicleId || orderItems.length === 0) return;
    if (orderType === "PARCEIRO" && !partnerStoreId) return;
    if (!hasAnyAssignedService(workflow, extras)) return;
    if (plateLookup?.activeOrder) return;

    const workflowTasks = (
      Object.entries(workflow) as [WorkflowTaskKey, WorkflowTaskState][]
    )
      .filter(([, task]) => task.employeeId)
      .map(([key, task]) => ({ key, employeeId: task.employeeId! }));

    const serviceItems = Object.entries(extras)
      .filter(([, state]) => state.selected && state.employeeId)
      .map(([serviceId, state]) => ({
        serviceId,
        employeeId: state.employeeId!,
      }));

    setSaving(true);
    let redirecting = false;
    const plateForRedirect =
      selectedVehicle?.plate ??
      plateLookup?.vehicle?.plate ??
      formatPlate(plateQuery);

    async function recoverCreatedOrder(): Promise<boolean> {
      if (plateForRedirect.length < 6) return false;
      try {
        const lookupRes = await fetch(
          `/api/vehicles/lookup?plate=${encodeURIComponent(plateForRedirect)}`
        );
        if (!lookupRes.ok) return false;
        const lookup = (await lookupRes.json()) as PlateLookup;
        const orderId = lookup.activeOrder?.id;
        if (!orderId) return false;
        redirecting = true;
        window.location.assign(
          `/ordens/${orderId}/comprovante?registered=1&plate=${encodeURIComponent(plateForRedirect)}`
        );
        return true;
      } catch {
        return false;
      }
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          vehicleId,
          workflowTasks,
          serviceItems,
          discount: Number(discount || 0),
          paymentMethod,
          notes,
          partnerStoreId: orderType === "PARCEIRO" ? partnerStoreId : null,
          ...(operatingDate ? { operatingDate } : {}),
          ...(retroactive ? { entryAt: new Date(entryAtLocal).toISOString() } : {}),
        }),
      });

      const raw = await res.text();
      let order: { id?: string; error?: string } = {};
      try {
        order = raw ? JSON.parse(raw) : {};
      } catch {
        if (await recoverCreatedOrder()) return;
        alert("Resposta inválida do servidor. Verifique o painel.");
        return;
      }

      if (res.ok && order.id) {
        redirecting = true;
        window.location.assign(
          `/ordens/${order.id}/comprovante?registered=1&plate=${encodeURIComponent(plateForRedirect)}`
        );
        return;
      }

      if (await recoverCreatedOrder()) return;
      alert(order.error ?? "Erro ao registrar ordem.");
    } catch {
      if (await recoverCreatedOrder()) return;
      alert(
        "Não foi possível confirmar o registro. Verifique o painel — se o veículo aparecer na fila, a ordem foi criada."
      );
    } finally {
      if (!redirecting) setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-28 sm:space-y-6 sm:pb-0">
      <PageHeader
        title="Nova ordem"
        description="Placa → serviços → registrar"
      />

      {isOperatingPastDay && operatingDate && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta ordem será registrada no dia{" "}
          <strong>{formatBusinessDateKey(operatingDate)}</strong> (caixa reaberto). Ela entra na
          fila operacional desse dia, não no dia de hoje.
        </p>
      )}

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
            onPlateDetected={(plate) => {
              setPlateQuery(plate);
              void lookupPlate(plate);
            }}
          />

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
                    Em andamento na fila: {plateLookup.activeOrder.statusLabel}
                  </p>
                  <p className="text-xs">
                    {plateLookup.activeOrder.items.join(", ")} —{" "}
                    {formatCurrency(plateLookup.activeOrder.total)}
                  </p>
                  <p className="mt-1 text-xs">Finalize no painel antes de abrir nova ordem.</p>
                  <Link
                    href="/painel"
                    className="mt-1 inline-block text-xs font-semibold underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ver no painel →
                  </Link>
                </div>
              ) : plateLookup.readyOrder ? (
                <div className="mt-2 rounded-md bg-sky-100 px-3 py-2 text-sky-900">
                  <p className="font-medium">
                    Último serviço hoje: {plateLookup.readyOrder.statusLabel}
                  </p>
                  <p className="text-xs">
                    {plateLookup.readyOrder.items.join(", ")} —{" "}
                    {formatCurrency(plateLookup.readyOrder.total)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-sky-800">
                    Pode registrar nova lavagem normalmente.
                  </p>
                  <Link
                    href="/painel"
                    className="mt-1 inline-block text-xs font-semibold underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Liberar / receber no painel →
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
              <p>Placa não encontrada no cadastro.</p>
              <p className="mt-1 text-xs">
                Se você fotografou a placa, confira se os caracteres estão corretos (O/0, I/1) e
                tente buscar de novo.
              </p>
              <Link
                href={`/clientes?novo=1&placa=${encodeURIComponent(plateQuery)}`}
                className="mt-2 inline-block font-semibold underline"
              >
                Cadastro rápido
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <form id="nova-ordem-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Tipo de atendimento</CardTitle>
            <p className="text-sm text-slate-500">
              Cliente avulso ou carro de uma loja/parceiro (cobrança no fechamento).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleOrderTypeChange("AVULSO")}
                className={cn(
                  "min-h-[44px] rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation",
                  orderType === "AVULSO"
                    ? "border-sky-600 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                Cliente avulso
              </button>
              <button
                type="button"
                onClick={() => handleOrderTypeChange("PARCEIRO")}
                className={cn(
                  "min-h-[44px] rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation",
                  orderType === "PARCEIRO"
                    ? "border-sky-600 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                Loja / Parceiro
              </button>
            </div>

            {orderType === "PARCEIRO" && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <Field>
                  <Label>Loja parceira</Label>
                  <Select
                    value={partnerStoreId}
                    onChange={(e) => setPartnerStoreId(e.target.value)}
                  >
                    <option value="">Selecione a loja...</option>
                    {partnerStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {partnerStores.length === 0 && !showNewStore && (
                  <p className="text-xs text-slate-500">
                    Nenhuma loja cadastrada ainda. Cadastre a primeira abaixo.
                  </p>
                )}

                {!showNewStore ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewStore(true);
                      setStoreError("");
                    }}
                    className="text-sm font-medium text-sky-600 hover:text-sky-700"
                  >
                    + Cadastrar nova loja
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
                    <Field>
                      <Label>Nome da nova loja</Label>
                      <Input
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        placeholder="Ex: Renato Taxi"
                        autoFocus
                      />
                    </Field>
                    {storeError && (
                      <p className="text-xs text-red-600" role="alert">
                        {storeError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingStore}
                        onClick={createStore}
                      >
                        {savingStore ? "Salvando..." : "Salvar loja"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={savingStore}
                        onClick={() => {
                          setShowNewStore(false);
                          setNewStoreName("");
                          setStoreError("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  A ordem fica vinculada à loja — aparece na ficha dela e nas pendências
                  para o fechamento mensal.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
            <CardTitle className="text-base sm:text-lg">Equipe e serviços</CardTitle>
            <p className="text-sm text-slate-500">
              Etapas de lavagem, aspiração e secagem são opcionais. Escolha os serviços que o
              cliente contratou.
            </p>
          </CardHeader>
          <CardContent>
            <MobileServicePicker
              services={services}
              employees={employees}
              vehicleType={selectedVehicle?.vehicleType}
              workflow={workflow}
              extras={extras}
              showMoreOptions={showMoreOptions}
              onWorkflowChange={setWorkflow}
              onExtrasChange={setExtras}
              onShowMoreOptionsChange={setShowMoreOptions}
            />
            {plateReady && !servicesReady && (
              <p className="mt-3 text-sm text-amber-800">
                {extrasMissingEmployee
                  ? "Escolha o funcionário para cada serviço marcado."
                  : "Selecione ao menos um serviço ou etapa e atribua um funcionário."}
              </p>
            )}
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
          </CardContent>
        </Card>

        {showPaymentSection && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label className="flex cursor-pointer items-start gap-3 touch-manipulation">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  checked={retroactive}
                  onChange={(e) => {
                    setRetroactive(e.target.checked);
                    if (e.target.checked && !entryAtLocal) {
                      setEntryAtLocal(defaultRetroactiveEntryValue());
                    }
                  }}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    Lançamento retroativo
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Esqueceu de registrar ontem? Informe a data/hora real do serviço para
                    relatórios e financeiro.
                  </span>
                </span>
              </label>

              {retroactive && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <Field>
                    <Label>Data e hora do serviço</Label>
                    <Input
                      type="datetime-local"
                      value={entryAtLocal}
                      max={toDatetimeLocalValue(new Date())}
                      onChange={(e) => setEntryAtLocal(e.target.value)}
                      className="text-base"
                    />
                  </Field>
                  <p className="text-xs text-amber-800">
                    A ordem será salva como <strong>já entregue</strong> na data escolhida e não
                    entra na fila de hoje.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {paymentOptions.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key)}
                  className={cn(
                    "min-h-[44px] rounded-xl border px-2 py-2.5 text-xs font-medium touch-manipulation",
                    paymentMethod === key
                      ? key === "PAGAR_DEPOIS"
                        ? "border-amber-500 bg-amber-600 text-white"
                        : "border-sky-500 bg-sky-600 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  {PAYMENT_METHOD_LABELS[key]}
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
                  {paymentOptions.map((key) => (
                    <option key={key} value={key}>
                      {PAYMENT_METHOD_LABELS[key]}
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
              {paymentMethod === "PAGAR_DEPOIS" && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  O valor entra nos relatórios como &quot;pagar depois&quot; e só contará como
                  lucro após a baixa no painel.
                </p>
              )}
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
        )}

        {showPaymentSection && (
        <div className="hidden flex-col gap-2 sm:flex">
          {!partnerReady && (
            <p className="text-sm text-amber-800">
              Selecione a loja parceira para registrar a ordem.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
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
        </div>
        )}
      </form>

      {showPaymentSection && (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">
              {!servicesReady
                ? extrasMissingEmployee
                  ? "Escolha o responsável"
                  : "Selecione um serviço"
                : !partnerReady
                  ? "Escolha a loja parceira"
                  : `${assignmentCount} serviço(s) na ordem`}
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
      )}
    </div>
  );
}
