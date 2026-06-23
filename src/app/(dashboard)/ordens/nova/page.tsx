"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

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

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !vehicleId || selectedServices.length === 0) return;

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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Nova ordem de serviço"
        description="Registre a chegada do veículo e os serviços solicitados"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente e veículo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>Cliente</Label>
              <Select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setVehicleId("");
                }}
                required
              >
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Veículo</Label>
              <Select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
                disabled={!clientId}
              >
                <option value="">Selecione...</option>
                {selectedClient?.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} ({VEHICLE_TYPE_LABELS[v.vehicleType]})
                  </option>
                ))}
              </Select>
            </Field>
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
          <CardHeader>
            <CardTitle>Serviços</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {services.map((service) => {
              const price =
                selectedVehicle
                  ? service.vehiclePrices.find(
                      (p) => p.vehicleType === selectedVehicle.vehicleType
                    )?.price ?? service.defaultPrice
                  : service.defaultPrice;

              return (
                <label
                  key={service.id}
                  className="flex cursor-pointer flex-col gap-2 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                    />
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                  <span className="text-sm text-slate-600">
                    {formatCurrency(price)}
                  </span>
                </label>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
            <div className="sm:col-span-2 rounded-lg bg-slate-50 p-4">
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

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
            {saving ? "Salvando..." : "Registrar ordem"}
          </Button>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
