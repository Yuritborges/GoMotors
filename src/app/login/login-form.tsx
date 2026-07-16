"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex justify-center">
        <Logo size="lg" href={undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entrar no sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="from" value={from} />

            <Field>
              <Label>E-mail</Label>
              <Input
                type="email"
                name="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="seu@email.com"
                required
                autoComplete="username"
                defaultValue=""
              />
            </Field>
            <Field>
              <Label>Senha</Label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </Field>

            {state.error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg border-2 border-red-500 bg-red-100 px-4 py-3 text-sm font-semibold text-red-900"
              >
                {state.error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
