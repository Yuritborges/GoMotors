"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { AlertTriangle } from "lucide-react";

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

const emptyForm = {
  name: "",
  category: "Geral",
  price: "",
  stock: "",
  minStock: "5",
  description: "",
};

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const lowStock = products.filter(
    (p) => p.active && p.stock !== null && p.stock <= p.minStock
  );

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

  function openCreate() {
    setEditing(null);
    setShowForm(true);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    setShowForm(false);
    setEditing(null);
    load();
  }

  async function adjustStock(id: string, delta: number) {
    const product = products.find((p) => p.id === id);
    if (!product || product.stock === null) return;
    await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...product,
        stock: Math.max(0, product.stock + delta),
      }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Controle de produtos com alertas de reposição"
      >
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          Novo produto
        </Button>
      </PageHeader>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold">
              {lowStock.length} produto(s) com estoque baixo ou zerado
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar produto" : "Novo produto"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field>
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
              </Field>
              <Field>
                <Label>Preço (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </Field>
              <Field>
                <Label>Estoque atual</Label>
                <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </Field>
              <Field>
                <Label>Estoque mínimo (alerta)</Label>
                <Input type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} required />
              </Field>
              <Field className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 md:hidden">
        {products.filter((p) => p.active).map((product) => {
          const isLow = product.stock !== null && product.stock <= product.minStock;
          return (
            <div
              key={product.id}
              className={`rounded-xl border p-4 ${isLow ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-slate-500">{product.category}</p>
                </div>
                {isLow && (
                  <Badge className="border-red-200 bg-red-100 text-red-700">Baixo</Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-xs text-slate-500">Estoque</p>
                  <p className="font-bold">{product.stock ?? "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-xs text-slate-500">Mínimo</p>
                  <p className="font-bold">{product.minStock}</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-xs text-slate-500">Preço</p>
                  <p className="font-bold">{formatCurrency(product.price)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.stock !== null && (
                  <>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => adjustStock(product.id, -1)}>−</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => adjustStock(product.id, 1)}>+</Button>
                  </>
                )}
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(product)}>Editar</Button>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Produto</th>
                <th className="pb-3 pr-4 font-medium">Categoria</th>
                <th className="pb-3 pr-4 font-medium">Estoque</th>
                <th className="pb-3 pr-4 font-medium">Mínimo</th>
                <th className="pb-3 pr-4 font-medium">Preço</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.filter((p) => p.active).map((product) => {
                const isLow = product.stock !== null && product.stock <= product.minStock;
                return (
                  <tr key={product.id} className={`border-b border-slate-100 ${isLow ? "bg-red-50/50" : ""}`}>
                    <td className="py-3 pr-4 font-medium">
                      {product.name}
                      {isLow && (
                        <Badge className="ml-2 border-red-200 bg-red-100 text-red-700">Baixo</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4">{product.category}</td>
                    <td className="py-3 pr-4 font-semibold">{product.stock ?? "—"}</td>
                    <td className="py-3 pr-4">{product.minStock}</td>
                    <td className="py-3 pr-4">{formatCurrency(product.price)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {product.stock !== null && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => adjustStock(product.id, -1)}>−</Button>
                            <Button size="sm" variant="outline" onClick={() => adjustStock(product.id, 1)}>+</Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(product)}>Editar</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
