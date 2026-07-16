"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, List } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { isOwner } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

type Service = {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  estimatedMinutes: number;
  active: boolean;
  vehiclePrices: { vehicleType: string; price: number }[];
};

type LaneDurations = {
  lavagem: number;
  aspiracao: number;
  secagem: number;
  finalizacao: number;
};

type ServiceTimeRow = {
  id: string;
  name: string;
  category: string;
  estimatedMinutes: number;
  active: boolean;
};

const DEFAULT_LANE_DURATIONS: LaneDurations = {
  lavagem: 20,
  aspiracao: 20,
  secagem: 20,
  finalizacao: 20,
};

const FIXED_STAGE_ROWS: { key: keyof LaneDurations; label: string }[] = [
  { key: "lavagem", label: "LAVAGEM" },
  { key: "aspiracao", label: "ASPIRAÇÃO" },
  { key: "secagem", label: "SECAGEM" },
  { key: "finalizacao", label: "FINALIZAÇÃO" },
];

const VEHICLE_TYPES = ["MOTO", "CARRO", "SUV", "CAMINHONETE", "OUTRO"];

const PREVIEW_COUNT = 4;

const emptyService = {
  name: "",
  category: "LAVAGEM",
  defaultPrice: "0",
  estimatedMinutes: "30",
  vehiclePrices: VEHICLE_TYPES.map((vt) => ({ vehicleType: vt, price: "0" })),
};

export default function ServicosPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyService);
  const [laneForm, setLaneForm] = useState(DEFAULT_LANE_DURATIONS);
  const [serviceTimes, setServiceTimes] = useState<ServiceTimeRow[]>([]);
  const [serviceTimeForm, setServiceTimeForm] = useState<Record<string, number>>({});
  const [timesSaving, setTimesSaving] = useState(false);
  const [timesSaved, setTimesSaved] = useState(false);
  const [timesExpanded, setTimesExpanded] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(false);

  const owner = user ? isOwner(user.role) : false;

  async function load() {
    const [meRes, servicesRes, timesRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/services"),
      fetch("/api/settings/display-times"),
    ]);
    if (meRes.ok) {
      const meData = await meRes.json();
      setUser(meData.user);
    }
    setServices(await servicesRes.json());
    if (timesRes.ok) {
      const data: { lanes: LaneDurations; services: ServiceTimeRow[] } = await timesRes.json();
      setLaneForm(data.lanes);
      setServiceTimes(data.services);
      setServiceTimeForm(
        Object.fromEntries(data.services.map((s) => [s.id, s.estimatedMinutes]))
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(service: Service) {
    setEditing(service);
    setCreating(false);
    setCatalogExpanded(true);
    setForm({
      name: service.name,
      category: service.category,
      defaultPrice: String(service.defaultPrice),
      estimatedMinutes: String(service.estimatedMinutes),
      vehiclePrices: VEHICLE_TYPES.map((vt) => {
        const vp = service.vehiclePrices.find((p) => p.vehicleType === vt);
        return { vehicleType: vt, price: String(vp?.price ?? service.defaultPrice) };
      }),
    });
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setForm(emptyService);
    setCatalogExpanded(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      defaultPrice: Number(form.defaultPrice),
      estimatedMinutes: Number(form.estimatedMinutes),
      active: editing?.active ?? true,
      vehiclePrices: form.vehiclePrices.map((vp) => ({
        vehicleType: vp.vehicleType,
        price: Number(vp.price),
      })),
    };

    if (editing) {
      await fetch(`/api/services/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setEditing(null);
    setCreating(false);
    load();
  }

  async function saveAllDisplayTimes(e: React.FormEvent) {
    e.preventDefault();
    setTimesSaving(true);
    setTimesSaved(false);
    const res = await fetch("/api/settings/display-times", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lanes: laneForm,
        services: serviceTimes.map((s) => ({
          id: s.id,
          estimatedMinutes: serviceTimeForm[s.id] ?? s.estimatedMinutes,
        })),
      }),
    });
    setTimesSaving(false);
    if (res.ok) {
      const data: { lanes: LaneDurations; services: ServiceTimeRow[] } = await res.json();
      setLaneForm(data.lanes);
      setServiceTimes(data.services);
      setServiceTimeForm(
        Object.fromEntries(data.services.map((s) => [s.id, s.estimatedMinutes]))
      );
      setTimesSaved(true);
      await load();
    }
  }

  function setServiceMinutes(id: string, value: number) {
    setServiceTimeForm((prev) => ({ ...prev, [id]: value }));
    setTimesSaved(false);
  }

  function setLaneMinutes(key: keyof LaneDurations, value: number) {
    setLaneForm((prev) => ({ ...prev, [key]: value }));
    setTimesSaved(false);
  }

  async function toggleActive(id: string, active: boolean) {
    const service = services.find((s) => s.id === id);
    if (!service) return;

    await fetch(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...service, active: !active }),
    });
    load();
  }

  const groupedServiceTimes = serviceTimes.reduce<Record<string, ServiceTimeRow[]>>(
    (acc, service) => {
      acc[service.category] = acc[service.category] ?? [];
      acc[service.category].push(service);
      return acc;
    },
    {}
  );

  const previewServices = services.slice(0, PREVIEW_COUNT);
  const hiddenServicesCount = Math.max(0, services.length - PREVIEW_COUNT);
  const previewServiceTimes = serviceTimes.slice(0, PREVIEW_COUNT);
  const hiddenServiceTimesCount = Math.max(0, serviceTimes.length - PREVIEW_COUNT);

  const grouped = services.reduce<Record<string, Service[]>>((acc, service) => {
    acc[service.category] = acc[service.category] ?? [];
    acc[service.category].push(service);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        description={
          owner
            ? "Preços, tempos no telão e catálogo de serviços"
            : "Consulta de serviços e preços"
        }
      >
        {owner && (
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            Novo serviço
          </Button>
        )}
      </PageHeader>

      {owner && (
        <Card className="border-sky-200 bg-gradient-to-r from-sky-50/80 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <CardTitle className="text-base">Tempos no telão</CardTitle>
                <p className="text-sm text-slate-600">
                  Limite por etapa e por serviço. Ao estourar, a placa pisca em vermelho na TV.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveAllDisplayTimes} className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">
                  Etapas operacionais (fila do lava-rápido)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {FIXED_STAGE_ROWS.map(({ key, label }) => (
                    <Field key={key}>
                      <Label>{label} (min)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="480"
                        value={laneForm[key]}
                        onChange={(e) => setLaneMinutes(key, Number(e.target.value))}
                        required
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">
                  Serviços do catálogo ({serviceTimes.length})
                </h3>
                {serviceTimes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum serviço cadastrado. Crie serviços abaixo para configurar o tempo.
                  </p>
                ) : timesExpanded ? (
                  <div className="space-y-4">
                    {Object.entries(groupedServiceTimes).map(([category, items]) => (
                      <div key={category} className="rounded-xl border border-slate-200 bg-white/80">
                        <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {category}
                        </p>
                        <div className="divide-y divide-slate-100">
                          {items.map((service) => (
                            <div
                              key={service.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-slate-900">{service.name}</p>
                                {!service.active && (
                                  <p className="text-xs text-slate-400">Inativo</p>
                                )}
                              </div>
                              <Field className="w-28 shrink-0">
                                <Label className="sr-only">Tempo {service.name}</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="480"
                                    className="text-center"
                                    value={serviceTimeForm[service.id] ?? service.estimatedMinutes}
                                    onChange={(e) =>
                                      setServiceMinutes(service.id, Number(e.target.value))
                                    }
                                    required
                                  />
                                  <span className="text-xs text-slate-500">min</span>
                                </div>
                              </Field>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white/80">
                    {previewServiceTimes.map((service) => (
                      <div
                        key={service.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{service.name}</p>
                          <p className="text-xs text-slate-500">{service.category}</p>
                        </div>
                        <Field className="w-28 shrink-0">
                          <Label className="sr-only">Tempo {service.name}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="480"
                              className="text-center"
                              value={serviceTimeForm[service.id] ?? service.estimatedMinutes}
                              onChange={(e) =>
                                setServiceMinutes(service.id, Number(e.target.value))
                              }
                              required
                            />
                            <span className="text-xs text-slate-500">min</span>
                          </div>
                        </Field>
                      </div>
                    ))}
                  </div>
                )}

                {hiddenServiceTimesCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 w-full text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                    onClick={() => setTimesExpanded((open) => !open)}
                  >
                    {timesExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Ver mais {hiddenServiceTimesCount} serviço
                        {hiddenServiceTimesCount === 1 ? "" : "s"}
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={timesSaving}>
                  {timesSaving ? "Salvando..." : "Salvar todos os tempos do telão"}
                </Button>
                {timesSaved && (
                  <span className="text-sm text-emerald-700">Tempos salvos com sucesso.</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {(creating || editing) && owner && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar serviço" : "Novo serviço"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <Label>Categoria</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <Label>Preço padrão (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.defaultPrice}
                    onChange={(e) =>
                      setForm({ ...form, defaultPrice: e.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <Label>Tempo no telão (min)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="480"
                    value={form.estimatedMinutes}
                    onChange={(e) =>
                      setForm({ ...form, estimatedMinutes: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Serviços extras (Polimento, etc.) usam este tempo no cronômetro da TV.
                  </p>
                </Field>
              </div>

              <div>
                <Label>Preços por tipo de veículo</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {form.vehiclePrices.map((vp, index) => (
                    <Field key={vp.vehicleType}>
                      <Label className="text-xs">
                        {VEHICLE_TYPE_LABELS[vp.vehicleType]}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={vp.price}
                        onChange={(e) => {
                          const next = [...form.vehiclePrices];
                          next[index] = { ...vp, price: e.target.value };
                          setForm({ ...form, vehiclePrices: next });
                        }}
                        required
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Salvar</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(null);
                    setCreating(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {owner ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <List className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <CardTitle>Catálogo ({services.length})</CardTitle>
                <p className="text-sm text-slate-600">Preços e serviços oferecidos na oficina.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(catalogExpanded ? Object.entries(grouped) : [["", previewServices] as const]).map(
              ([category, items]) => (
                <div key={category || "preview"} className="space-y-3">
                  {catalogExpanded && category && (
                    <p className="text-sm font-semibold text-slate-800">{category}</p>
                  )}
                  {items.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{service.name}</h3>
                            <Badge
                              className={
                                service.active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-500"
                              }
                            >
                              {service.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {service.category} · {formatCurrency(service.defaultPrice)} · Telão:{" "}
                            {service.estimatedMinutes} min
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(service)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(service.id, service.active)}
                          >
                            {service.active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </div>
                      {catalogExpanded && (
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                          {service.vehiclePrices.map((vp) => (
                            <div
                              key={vp.vehicleType}
                              className="rounded-lg bg-slate-50 px-3 py-2 text-center text-sm"
                            >
                              <p className="text-xs text-slate-500">
                                {VEHICLE_TYPE_LABELS[vp.vehicleType]}
                              </p>
                              <p className="font-medium">{formatCurrency(vp.price)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {hiddenServicesCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-700 hover:bg-slate-50"
                onClick={() => setCatalogExpanded((open) => !open)}
              >
                {catalogExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Ver todos os serviços ({services.length})
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((service) => (
                <div
                  key={service.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{service.name}</h3>
                        <Badge
                          className={
                            service.active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-500"
                          }
                        >
                          {service.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Preço padrão: {formatCurrency(service.defaultPrice)} · Telão:{" "}
                        {service.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {service.vehiclePrices.map((vp) => (
                      <div
                        key={vp.vehicleType}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-center text-sm"
                      >
                        <p className="text-xs text-slate-500">
                          {VEHICLE_TYPE_LABELS[vp.vehicleType]}
                        </p>
                        <p className="font-medium">{formatCurrency(vp.price)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
