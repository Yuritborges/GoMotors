"use client";

import { useEffect, useState } from "react";
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

const DEFAULT_LANE_DURATIONS: LaneDurations = {
  lavagem: 20,
  aspiracao: 20,
  secagem: 20,
  finalizacao: 20,
};

const VEHICLE_TYPES = ["MOTO", "CARRO", "SUV", "CAMINHONETE", "OUTRO"];

const emptyService = {
  name: "",
  category: "Lavagem",
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
  const [laneDurations, setLaneDurations] = useState<LaneDurations>(DEFAULT_LANE_DURATIONS);
  const [laneForm, setLaneForm] = useState(DEFAULT_LANE_DURATIONS);
  const [laneSaving, setLaneSaving] = useState(false);

  const owner = user ? isOwner(user.role) : false;

  async function load() {
    const [meRes, servicesRes, lanesRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/services"),
      fetch("/api/settings/display-lanes"),
    ]);
    if (meRes.ok) {
      const meData = await meRes.json();
      setUser(meData.user);
    }
    setServices(await servicesRes.json());
    if (lanesRes.ok) {
      const lanes: LaneDurations = await lanesRes.json();
      setLaneDurations(lanes);
      setLaneForm(lanes);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(service: Service) {
    setEditing(service);
    setCreating(false);
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

  async function saveLaneDurations(e: React.FormEvent) {
    e.preventDefault();
    setLaneSaving(true);
    const res = await fetch("/api/settings/display-lanes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(laneForm),
    });
    setLaneSaving(false);
    if (res.ok) {
      const data: LaneDurations = await res.json();
      setLaneDurations(data);
      setLaneForm(data);
    }
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
          <CardHeader>
            <CardTitle className="text-base">Tempos no telão — etapas fixas</CardTitle>
            <p className="text-sm text-slate-600">
              Lavagem, Aspiração, Secagem e Finalização. Quando o tempo estourar, a placa
              pisca em vermelho no painel da TV.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveLaneDurations} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <Label>Lavagem (min)</Label>
                <Input
                  type="number"
                  min="1"
                  max="480"
                  value={laneForm.lavagem}
                  onChange={(e) => setLaneForm({ ...laneForm, lavagem: Number(e.target.value) })}
                  required
                />
              </Field>
              <Field>
                <Label>Aspiração (min)</Label>
                <Input
                  type="number"
                  min="1"
                  max="480"
                  value={laneForm.aspiracao}
                  onChange={(e) => setLaneForm({ ...laneForm, aspiracao: Number(e.target.value) })}
                  required
                />
              </Field>
              <Field>
                <Label>Secagem (min)</Label>
                <Input
                  type="number"
                  min="1"
                  max="480"
                  value={laneForm.secagem}
                  onChange={(e) => setLaneForm({ ...laneForm, secagem: Number(e.target.value) })}
                  required
                />
              </Field>
              <Field>
                <Label>Finalização (min)</Label>
                <Input
                  type="number"
                  min="1"
                  max="480"
                  value={laneForm.finalizacao}
                  onChange={(e) =>
                    setLaneForm({ ...laneForm, finalizacao: Number(e.target.value) })
                  }
                  required
                />
              </Field>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={laneSaving}>
                  {laneSaving ? "Salvando..." : "Salvar tempos do telão"}
                </Button>
                <p className="mt-2 text-xs text-slate-500">
                  Atual: Lavagem {laneDurations.lavagem} · Aspiração {laneDurations.aspiracao} ·
                  Secagem {laneDurations.secagem} · Finalização {laneDurations.finalizacao} min
                </p>
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

      {Object.entries(grouped).map(([category, items]) => (
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
                  {owner && (
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
                  )}
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
      ))}
    </div>
  );
}
