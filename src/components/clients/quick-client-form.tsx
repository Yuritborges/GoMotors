"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { formatPlate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlateScanner } from "@/components/vehicles/plate-scanner";

const QUICK_VEHICLE_TYPES = ["CARRO", "SUV", "MOTO", "CAMINHONETE"] as const;

type QuickClientFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Após salvar, redireciona para nova ordem com cliente/veículo selecionados */
  redirectToOrder?: boolean;
  /** Placa pré-preenchida (ex.: vinda do OCR ou link) */
  initialPlate?: string;
  className?: string;
};

const emptyForm = {
  plate: "",
  name: "",
  phone: "",
  vehicleType: "CARRO" as string,
  brand: "",
  model: "",
  notes: "",
};

export function QuickClientForm({
  onSuccess,
  onCancel,
  redirectToOrder = false,
  initialPlate = "",
  className,
}: QuickClientFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...emptyForm,
    plate: formatPlate(initialPlate),
  });
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(openOrder: boolean) {
    setError("");
    const plate = formatPlate(form.plate);
    const name = form.name.trim();

    if (!plate) {
      setError("Informe a placa do veículo.");
      return;
    }
    if (!name) {
      setError("Informe o nome do cliente.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: form.phone.trim() || "—",
          notes: form.notes.trim() || null,
          vehicle: {
            plate,
            brand: form.brand.trim() || null,
            model: form.model.trim() || null,
            vehicleType: form.vehicleType,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(data.error ?? "Esta placa já está cadastrada.");
        } else {
          setError(data.error ?? "Não foi possível salvar. Tente novamente.");
        }
        return;
      }

      setForm(emptyForm);
      setShowDetails(false);
      onSuccess?.();

      if (openOrder || redirectToOrder) {
        const vehicleId = data.vehicles?.[0]?.id;
        if (vehicleId) {
          router.push(
            `/ordens/nova?clientId=${data.id}&vehicleId=${vehicleId}`
          );
          return;
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("space-y-5", className)}>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Field>
        <Label>Placa do veículo *</Label>
        <Input
          value={form.plate}
          onChange={(e) =>
            setForm({ ...form, plate: formatPlate(e.target.value) })
          }
          placeholder="Ex: ABC1D23"
          className="text-lg font-semibold uppercase tracking-widest"
          autoComplete="off"
          autoFocus
          inputMode="text"
          maxLength={7}
        />
      </Field>

      <PlateScanner
        disabled={saving}
        onPlateDetected={(plate) => {
          setForm((prev) => ({ ...prev, plate }));
        }}
      />

      <Field>
        <Label>Nome do cliente *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: João Silva"
          autoComplete="name"
        />
      </Field>

      <Field>
        <Label>Telefone</Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Opcional — (11) 99999-9999"
          type="tel"
          autoComplete="tel"
        />
      </Field>

      <Field>
        <Label>Tipo de veículo</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_VEHICLE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm({ ...form, vehicleType: type })}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                form.vehicleType === type
                  ? "border-sky-600 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {VEHICLE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </Field>

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="text-sm font-medium text-sky-600 hover:text-sky-700"
      >
        {showDetails ? "− Ocultar detalhes" : "+ Marca, modelo e observações"}
      </button>

      {showDetails && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label>Marca</Label>
            <Input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Ex: Fiat"
            />
          </Field>
          <Field>
            <Label>Modelo</Label>
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Ex: Argo"
            />
          </Field>
          <Field className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Preferências, alertas..."
              rows={2}
            />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className="w-full sm:flex-1"
          disabled={saving}
          onClick={() => handleSubmit(true)}
        >
          {saving ? "Salvando..." : "Salvar e abrir ordem"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={saving}
          onClick={() => handleSubmit(false)}
        >
          Só salvar
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            disabled={saving}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        * Placa e nome são suficientes para começar. O restante pode completar depois.
      </p>
    </div>
  );
}
