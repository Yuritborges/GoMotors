# Deploy GoMotors — Vercel + Neon

Guia passo a passo para publicar e manter o sistema em produção.

---

## Parte 1 — Neon (banco de dados)

1. Acesse [https://neon.tech](https://neon.tech) e crie uma conta (GitHub ou Google).
2. Clique em **New Project**.
3. Nome sugerido: `gomotors-prod`.
4. Região: escolha a mais próxima (ex.: **São Paulo** se disponível, ou **US East**).
5. Clique em **Create project**.

### Copiar as URLs de conexão

No painel do Neon, vá em **Connection Details**:

| Variável | Qual URL usar |
|----------|----------------|
| `DATABASE_URL` | **Pooled connection** (contém `-pooler` no host) |
| `DIRECT_URL` | **Direct connection** (sem `-pooler`) |

Exemplo:
```env
DATABASE_URL="postgresql://user:pass@ep-abc-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-abc.sa-east-1.aws.neon.tech/neondb?sslmode=require"
```

6. Gere um `AUTH_SECRET` (string aleatória longa). Exemplo no PowerShell:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## Parte 2 — GitHub (código)

1. Acesse [https://github.com](https://github.com) e crie um repositório **privado** (recomendado): `gomotors`.
2. Na pasta do projeto, envie o código:

```bash
git init
git add .
git commit -m "GoMotors MVP — Vercel + Neon"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gomotors.git
git push -u origin main
```

> **Não** commite o arquivo `.env` — ele já está no `.gitignore`.

---

## Parte 3 — Vercel (hospedagem)

1. Acesse [https://vercel.com](https://vercel.com) e entre com **GitHub**.
2. Clique em **Add New → Project**.
3. Importe o repositório `gomotors`.
4. Em **Environment Variables**, adicione **antes** do deploy:

| Nome | Valor |
|------|-------|
| `DATABASE_URL` | URL pooled do Neon |
| `DIRECT_URL` | URL direta do Neon |
| `AUTH_SECRET` | Sua chave secreta gerada |

Marque as três para **Production**, **Preview** e **Development**.

5. Clique em **Deploy** e aguarde (2–5 min).

### O que roda no build

```text
prisma generate → next build
```

As **migrations não rodam automaticamente** no deploy (evita falhas de conexão com o Neon durante o build). Veja a seção **Migrations** abaixo.

---

## Parte 4 — Dados iniciais

### Produção com dados reais (Go Motors)

Use **importação** — nunca o seed:

```bash
npm install
npm run db:migrate:deploy
# Defina SEED_OWNER_PASSWORD no .env antes do import (cria usuários)
npm run db:import
npm run db:sync-employees
```

Depois troque a senha do admin:

```bash
# .env: ADMIN_PASSWORD="senha-forte-min-8-chars"
npm run db:set-password
```

### Demo vazia (somente ambiente de teste)

O seed **apaga todo o banco**. Em banco remoto (Neon), exige confirmação explícita:

```bash
SEED_FORCE=1 SEED_OWNER_PASSWORD="..." SEED_ATTENDANT_PASSWORD="..." npm run db:seed
```

> **Nunca** rode `db:seed` em produção com dados do cliente — ele apaga tudo.

---

## Parte 5 — Acessar o sistema

URL gerada pela Vercel:
```text
https://gomotors-xxxxx.vercel.app
```

Login com o e-mail configurado no import/seed. Senha definida via `SEED_OWNER_PASSWORD` ou alterada em **Usuários**.

### Tela TV (clientes)
```text
https://gomotors-xxxxx.vercel.app/display
```

---

## Migrations (schema do banco)

Sempre que um deploy incluir **migration nova** no Prisma:

```bash
# Com .env apontando para o Neon de produção
npm run db:migrate:deploy
```

Opcional — rodar migrate no build da Vercel (variável de ambiente):

| Variável | Valor |
|----------|-------|
| `RUN_MIGRATE` | `1` |

Requer `DIRECT_URL` válida. Se o build falhar com `P1001`, mantenha o padrão (migrate manual) e rode `db:migrate:deploy` localmente após o deploy.

---

## Segurança antes do go-live

| Item | Ação |
|------|------|
| Senha admin | `npm run db:set-password` com senha forte |
| `AUTH_SECRET` | Gerar novo e redeploy se necessário |
| Credenciais | Não publicar senhas no README nem em issues públicas |
| Seed | Bloqueado em Neon sem `SEED_FORCE=1` |
| APIs financeiras | Caixa, pendências e PATCH de ordens — só proprietário |

---

## Deploy automático (GitHub → Vercel)

Cada **`git push` na branch `main`** publica a versão nova em produção.

```
Código local  →  git push  →  GitHub  →  Vercel (build)  →  go-motors-ten.vercel.app
```

### CI (GitHub Actions)

A cada push/PR na `main`, roda **lint** e **testes** (`.github/workflows/ci.yml`).

### Publicar uma atualização

```bash
git add .
git commit -m "Descrição da mudança"
git push origin main
npm run db:migrate:deploy   # só se houver migration nova
```

Em ~2–5 minutos:

| Ambiente | URL |
|----------|-----|
| Sistema | https://go-motors-ten.vercel.app |
| Tela TV | https://go-motors-ten.vercel.app/display |

> Atualizações de código **não** apagam dados do banco. O seed também **não** roda no deploy.

---

## Domínio customizado

1. Registre o domínio (ex.: `app.gomotors.com.br`).
2. Vercel → Project → **Settings → Domains** → Add.
3. Configure CNAME/A no registrador conforme instruções da Vercel.
4. SSL é automático.

---

## Desenvolvimento local (com Neon)

```bash
cp .env.example .env
# Cole as URLs do Neon, AUTH_SECRET e SEED_OWNER_PASSWORD

npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## Problemas comuns

| Erro | Solução |
|------|---------|
| `AUTH_SECRET não configurado` | Adicionar variável na Vercel e redeploy |
| Schema desatualizado | `npm run db:migrate:deploy` |
| `P1001: Can't reach database` no build com `RUN_MIGRATE=1` | Remover `RUN_MIGRATE` e rodar migrate manualmente |
| Login não persiste | Verificar `AUTH_SECRET` em Production |
| Seed bloqueado em Neon | Normal — use `db:import` ou `SEED_FORCE=1` só para demo |
| Seed apaga tudo | Esperado — nunca em produção com dados reais |

---

## Limites do plano grátis

- **Neon:** ~512 MB, suficiente para operação inicial
- **Vercel:** tráfego moderado
- Para crescimento, considere planos pagos depois
