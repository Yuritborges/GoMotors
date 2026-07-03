"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Mail,
  Package,
  Plus,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number | null;
  minStock: number;
  description: string | null;
  active: boolean;
};

type Movement = {
  id: string;
  productId: string;
  type: string;
  quantityBefore: number;
  quantityAfter: number;
  delta: number;
  unitCost: number | null;
  notes: string | null;
  userName: string;
  createdAt: string;
  product: { id: string; name: string; category: string };
};

const CATEGORIES = [
  "Limpeza",
  "Acabamento",
  "Consumíveis",
  "Químicos",
  "Equipamentos",
  "Geral",
];

const MOVEMENT_LABELS: Record<string, string> = {
  COMPRA: "Compra",
  AJUSTE: "Ajuste",
  SAIDA: "Saída",
  ENTRADA: "Entrada",
  INVENTARIO: "Inventário",
};

const emptyForm = {
  name: "",
  category: "Limpeza",
  price: "",
  stock: "",
  minStock: "5",
  description: "",
};

type MovementModal = {
  product: Product;
  type: "COMPRA" | "SAIDA" | "INVENTARIO";
};

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState<"produtos" | "historico">("produtos");
  const [filterProduct, setFilterProduct] = useState("");
  const [movementModal, setMovementModal] = useState<MovementModal | null>(null);
  const [movementQty, setMovementQty] = useState("");
  const [movementCost, setMovementCost] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }, []);

  const loadMovements = useCallback(async () => {
    const q = filterProduct ? `?productId=${filterProduct}&limit=100` : "?limit=100";
    const res = await fetch(`/api/stock/movements${q}`);
    if (res.ok) setMovements(await res.json());
  }, [filterProduct]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active),
    [products]
  );

  const lowStock = useMemo(
    () =>
      activeProducts.filter(
        (p) => p.stock !== null && p.stock <= p.minStock
      ),
    [activeProducts]
  );

  const stockValue = useMemo(
    () =>
      activeProducts.reduce(
        (sum, p) => sum + (p.stock ?? 0) * p.price,
        0
      ),
    [activeProducts]
  );

  function openCreate() {
    setEditing(null);
    setShowForm(true);
    setForm(emptyForm);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setShowForm(true);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: product.stock !== null ? String(product.stock) : "",
      minStock: String(product.minStock),
      description: product.description ?? "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: form.stock !== "" ? Number(form.stock) : null,
      minStock: Number(form.minStock || 5),
      description: form.description || null,
      active: editing?.active ?? true,
    };

    if (editing) {
      await fetch(`/api/products/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    setShowForm(false);
    setEditing(null);
    await loadProducts();
    await loadMovements();
  }

  async function submitMovement() {
    if (!movementModal) return;
    setSaving(true);

    const { product, type } = movementModal;
    let body: Record<string, unknown>;

    if (type === "INVENTARIO") {
      body = {
        type,
        quantityAfter: Number(movementQty),
        notes: movementNotes || null,
      };
    } else if (type === "COMPRA") {
      body = {
        type,
        quantity: Number(movementQty),
        unitCost: movementCost ? Number(movementCost) : null,
        notes: movementNotes || null,
      };
    } else {
      body = {
        type,
        delta: -Math.abs(Number(movementQty)),
        notes: movementNotes || null,
      };
    }

    const res = await fetch(`/api/products/${product.id}/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erro ao registrar movimentação.");
      return;
    }

    setMovementModal(null);
    setMovementQty("");
    setMovementCost("");
    setMovementNotes("");
    await loadProducts();
    await loadMovements();
  }

  async function sendEmailAlert() {
    setEmailStatus("Enviando...");
    const res = await fetch("/api/stock/notify", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setEmailStatus(data.error ?? "Falha ao enviar.");
      return;
    }
    setEmailStatus(data.message ?? `Alerta enviado (${data.sent ?? 0} produtos).`);
    setTimeout(() => setEmailStatus(null), 5000);
  }

  function stockLevel(product: Product) {
    if (product.stock === null) return 100;
    if (product.minStock <= 0) return product.stock > 0 ? 100 : 0;
    return Math.min(100, Math.round((product.stock / (product.minStock * 2)) * 100));
  }

  function stockColor(product: Product) {
    if (product.stock === null) return "bg-slate-300";
    if (product.stock <= 0) return "bg-red-500";
    if (product.stock <= product.minStock) return "bg-amber-500";
    return "bg-emerald-500";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Produtos, compras e histórico de movimentações"
      >
        <Button
          variant="outline"
          className="w-full gap-2 sm:w-auto"
          onClick={() => void sendEmailAlert()}
        >
          <Mail className="h-4 w-4" />
          Alerta por e-mail
        </Button>
        <Button className="w-full gap-2 sm:w-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </PageHeader>

      {emailStatus && (
        <p className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">{emailStatus}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Produtos ativos</p>
              <p className="text-xl font-bold">{activeProducts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Estoque baixo</p>
              <p className="text-xl font-bold text-amber-700">{lowStock.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Valor estimado em estoque</p>
              <p className="text-xl font-bold">{formatCurrency(stockValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="font-semibold">
              {lowStock.length} produto(s) precisam de reposição:{" "}
              {lowStock.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("produtos")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "produtos"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Produtos
        </button>
        <button
          type="button"
          onClick={() => setTab("historico")}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "historico"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History className="h-4 w-4" />
          Histórico
        </button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar produto" : "Novo produto"}</CardTitle>
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
                <Label>Categoria</Label>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <Label>Preço de venda (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </Field>
              <Field>
                <Label>Estoque inicial / atual</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Estoque mínimo (alerta)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  required
                />
              </Field>
              <Field className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {movementModal && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              {MOVEMENT_LABELS[movementModal.type]} — {movementModal.product.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>
                {movementModal.type === "INVENTARIO"
                  ? "Quantidade contada"
                  : movementModal.type === "COMPRA"
                    ? "Quantidade comprada"
                    : "Quantidade de saída"}
              </Label>
              <Input
                type="number"
                min="0"
                value={movementQty}
                onChange={(e) => setMovementQty(e.target.value)}
                required
              />
            </Field>
            {movementModal.type === "COMPRA" && (
              <Field>
                <Label>Custo unitário (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={movementCost}
                  onChange={(e) => setMovementCost(e.target.value)}
                />
              </Field>
            )}
            <Field className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Fornecedor, nota fiscal, motivo..."
                value={movementNotes}
                onChange={(e) => setMovementNotes(e.target.value)}
              />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={() => void submitMovement()} disabled={saving}>
                {saving ? "Registrando..." : "Confirmar"}
              </Button>
              <Button variant="secondary" onClick={() => setMovementModal(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "produtos" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeProducts.map((product) => {
            const isLow =
              product.stock !== null && product.stock <= product.minStock;
            const level = stockLevel(product);

            return (
              <Card
                key={product.id}
                className={isLow ? "border-amber-200 shadow-amber-100/50" : ""}
              >
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                    {isLow && (
                      <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                        Repor
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold tabular-nums">
                        {product.stock ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        mín. {product.minStock} · {formatCurrency(product.price)}
                      </p>
                    </div>
                  </div>

                  {product.stock !== null && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${stockColor(product)}`}
                        style={{ width: `${level}%` }}
                      />
                    </div>
                  )}

                  {product.stock !== null && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => {
                          setMovementModal({ product, type: "COMPRA" });
                          setMovementQty("");
                          setMovementCost("");
                          setMovementNotes("");
                        }}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Compra
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => {
                          setMovementModal({ product, type: "SAIDA" });
                          setMovementQty("1");
                          setMovementNotes("");
                        }}
                      >
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        Saída
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMovementModal({ product, type: "INVENTARIO" });
                          setMovementQty(String(product.stock ?? 0));
                          setMovementNotes("");
                        }}
                      >
                        Contagem
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(product)}>
                        Editar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "historico" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Auditoria de movimentações</CardTitle>
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
            >
              <option value="">Todos os produtos</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-slate-100">
            {movements.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-slate-200 bg-white text-slate-700">
                      {MOVEMENT_LABELS[m.type] ?? m.type}
                    </Badge>
                    <span className="font-medium text-slate-900">{m.product.name}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-mono tabular-nums">
                      {m.quantityBefore}
                    </span>
                    {" → "}
                    <span className="font-mono font-semibold tabular-nums">
                      {m.quantityAfter}
                    </span>
                    {m.delta !== 0 && (
                      <span
                        className={
                          m.delta > 0 ? " text-emerald-600" : " text-red-600"
                        }
                      >
                        {" "}
                        ({m.delta > 0 ? "+" : ""}
                        {m.delta})
                      </span>
                    )}
                  </p>
                  {m.unitCost != null && (
                    <p className="text-xs text-slate-500">
                      Custo unit.: {formatCurrency(m.unitCost)}
                    </p>
                  )}
                  {m.notes && (
                    <p className="mt-1 text-xs text-slate-500">{m.notes}</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-slate-500">
                  <p className="font-medium text-slate-700">{m.userName}</p>
                  <p>{formatDateTime(m.createdAt)}</p>
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                Nenhuma movimentação registrada ainda.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
