"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

type Client = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  vehicles: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    vehicleType: string;
  }[];
  _count: { orders: number };
};

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
    plate: "",
    brand: "",
    model: "",
    color: "",
    vehicleType: "CARRO",
  });

  async function loadClients(q = "") {
    const res = await fetch(`/api/clients${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    setClients(await res.json());
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        notes: form.notes,
        vehicle: form.plate
          ? {
              plate: form.plate,
              brand: form.brand,
              model: form.model,
              color: form.color,
              vehicleType: form.vehicleType,
            }
          : undefined,
      }),
    });
    setForm({
      name: "",
      phone: "",
      notes: "",
      plate: "",
      brand: "",
      model: "",
      color: "",
      vehicleType: "CARRO",
    });
    setShowForm(false);
    loadClients(search);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes e veículos"
      >
        <Button className="w-full sm:w-auto" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Fechar formulário" : "Novo cliente"}
        </Button>
      </PageHeader>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field>
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </Field>
              <Field>
                <Label>Placa</Label>
                <Input
                  value={form.plate}
                  onChange={(e) => setForm({ ...form, plate: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Tipo de veículo</Label>
                <Select
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                >
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>Marca</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Modelo</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </Field>
              <Field className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit">Salvar cliente</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Field>
        <Label>Buscar</Label>
        <Input
          placeholder="Nome, telefone ou placa..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            loadClients(e.target.value);
          }}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardContent className="pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold">{client.name}</h3>
                  <p className="text-sm text-slate-500">{client.phone}</p>
                </div>
                <Link href={`/clientes/${client.id}`} className="shrink-0">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto">
                    Ver histórico
                  </Button>
                </Link>
              </div>
              <div className="mt-4 space-y-1">
                {client.vehicles.map((v) => (
                  <p key={v.id} className="text-sm text-slate-600">
                    {v.plate} — {v.brand} {v.model} ({VEHICLE_TYPE_LABELS[v.vehicleType]})
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {client._count.orders} ordens de serviço
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
