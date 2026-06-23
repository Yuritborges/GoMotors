"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

type User = {
  id: string;
  name: string;
  email: string;
  role: "PROPRIETARIO" | "ATENDENTE";
  active: boolean;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "ATENDENTE",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      ...(form.password ? { password: form.password } : {}),
    };

    const res = editing
      ? await fetch(`/api/users/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, password: form.password }),
        });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar usuário");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    load();
  }

  async function deleteUser(user: User) {
    if (!confirm(`Excluir permanentemente o usuário ${user.name}?`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Erro ao excluir");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Apenas o administrador gerencia acessos, e-mails e senhas"
      >
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          Novo usuário
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>).map((role) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="text-base">{ROLE_LABELS[role]}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                {ROLE_PERMISSIONS[role].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar usuário" : "Novo usuário"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field>
                <Label>{editing ? "Nova senha (opcional)" : "Senha"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={editing ? undefined : 6}
                  required={!editing}
                />
              </Field>
              <Field>
                <Label>Função no sistema</Label>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="ATENDENTE">Atendente — operação do dia</option>
                  <option value="PROPRIETARIO">Administrador — acesso total</option>
                </Select>
              </Field>
              {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">{editing ? "Salvar alterações" : "Criar usuário"}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{user.name}</p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
              <Badge className={user.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}>
                {user.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">{ROLE_LABELS[user.role]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(user)}>Editar</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleActive(user)}>
                {user.active ? "Desativar" : "Ativar"}
              </Button>
              <Button size="sm" variant="danger" className="flex-1" onClick={() => deleteUser(user)}>Excluir</Button>
            </div>
          </div>
        ))}
      </div>

      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Nome</th>
                <th className="pb-3 pr-4 font-medium">E-mail</th>
                <th className="pb-3 pr-4 font-medium">Função</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium">{user.name}</td>
                  <td className="py-3 pr-4">{user.email}</td>
                  <td className="py-3 pr-4">{ROLE_LABELS[user.role]}</td>
                  <td className="py-3 pr-4">
                    <Badge className={user.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}>
                      {user.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(user)}>Editar</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(user)}>
                        {user.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteUser(user)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
