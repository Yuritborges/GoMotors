"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { QuickClientForm } from "@/components/clients/quick-client-form";
import { ClientesTabs } from "@/components/clients/clientes-tabs";

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
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setShowForm(true);
    }
  }, [searchParams]);

  async function loadClients(q = "") {
    const res = await fetch(`/api/clients${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    setClients(await res.json());
  }

  useEffect(() => {
    loadClients();
  }, []);

  function handleSaved() {
    setShowForm(false);
    loadClients(search);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cadastro rápido para o dia a dia"
      >
        <Button
          className="w-full sm:w-auto"
          size="lg"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Fechar" : "+ Cadastro rápido"}
        </Button>
      </PageHeader>

      <ClientesTabs />

      {showForm && (
        <Card className="border-sky-200 bg-sky-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Novo cliente em 30 segundos</CardTitle>
            <p className="text-sm text-slate-600">
              Placa, nome e tipo do veículo — pronto para abrir a ordem.
            </p>
          </CardHeader>
          <CardContent>
            <QuickClientForm
              initialPlate={searchParams.get("placa") ?? ""}
              onSuccess={handleSaved}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      <Field>
        <Label>Buscar cliente</Label>
        <Input
          placeholder="Nome, telefone ou placa..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            loadClients(e.target.value);
          }}
        />
      </Field>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-slate-600">
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </p>
            {!showForm && (
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                + Cadastro rápido
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardContent className="pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{client.name}</h3>
                    {client.phone !== "—" && (
                      <p className="text-sm text-slate-500">{client.phone}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Link
                      href={`/ordens/nova?clientId=${client.id}${
                        client.vehicles[0] ? `&vehicleId=${client.vehicles[0].id}` : ""
                      }`}
                    >
                      <Button size="sm" className="w-full sm:w-auto">
                        Nova ordem
                      </Button>
                    </Link>
                    <Link href={`/clientes/${client.id}`}>
                      <Button size="sm" variant="outline" className="w-full sm:w-auto">
                        Histórico
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  {client.vehicles.map((v) => (
                    <p key={v.id} className="text-sm text-slate-600">
                      <span className="font-medium tracking-wide">{v.plate}</span>
                      {" · "}
                      {VEHICLE_TYPE_LABELS[v.vehicleType]}
                      {v.brand || v.model
                        ? ` — ${[v.brand, v.model].filter(Boolean).join(" ")}`
                        : ""}
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
      )}
    </div>
  );
}
