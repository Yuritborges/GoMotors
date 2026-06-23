# Deploy GoMotors — Vercel + Neon

Guia passo a passo para publicar a demo online.

---

## Parte 1 — Neon (banco de dados grátis)

1. Acesse [https://neon.tech](https://neon.tech) e crie uma conta (GitHub ou Google).
2. Clique em **New Project**.
3. Nome sugerido: `gomotors-demo`.
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
git commit -m "GoMotors MVP — demo Vercel + Neon"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gomotors.git
git push -u origin main
```

> **Não** commite o arquivo `.env` — ele já está no `.gitignore`.

---

## Parte 3 — Vercel (hospedagem grátis)

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

O build roda automaticamente:
```text
prisma generate → prisma migrate deploy → next build
```

---

## Parte 4 — Popular dados demo (seed)

O seed **não** roda no deploy (para não apagar dados a cada atualização). Rode **uma vez** após o primeiro deploy.

### Opção A — Pelo seu PC (mais fácil)

1. Copie as URLs do Neon para um `.env` local:
```env
DATABASE_URL="..."
DIRECT_URL="..."
AUTH_SECRET="..."
```

2. Rode:
```bash
npm install
npm run db:migrate:deploy
npm run db:seed
```

3. Acesse a URL da Vercel e faça login.

### Opção B — Pelo terminal da Vercel

No painel Vercel → Project → **Settings → Functions**, ou use a CLI:

```bash
npx vercel env pull .env.local
npm run db:seed
```

---

## Parte 5 — Acessar a demo

URL gerada pela Vercel:
```text
https://gomotors-xxxxx.vercel.app
```

### Login demo

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | `admin@gomotors.local` | `admin123` |
| Atendente | `atendente@gomotors.local` | `atendente123` |

Funciona no **celular e desktop** — mesmo link, de qualquer lugar.

### Tela TV (clientes)
```text
https://gomotors-xxxxx.vercel.app/display
```

---

## Manutenção (você como desenvolvedor)

1. Edite o código localmente.
2. Teste com as URLs do Neon no `.env`.
3. Commit e push:
```bash
git add .
git commit -m "Descrição da mudança"
git push
```
4. A Vercel **atualiza sozinha** em ~2 min.

O cliente só precisa da URL — não precisa instalar Node nem rodar comandos.

---

## Desenvolvimento local (com Neon)

```bash
cp .env.example .env
# Cole as URLs do Neon e o AUTH_SECRET

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
| Build falha no `migrate deploy` | Conferir `DATABASE_URL` e `DIRECT_URL` |
| Login não persiste | Verificar se `AUTH_SECRET` está definido em Production |
| Página 500 no banco | Rodar `npm run db:migrate:deploy` e depois `npm run db:seed` |
| Seed apaga tudo | Normal — só rode seed quando quiser resetar a demo |

---

## Limites do plano grátis

- **Neon:** ~512 MB, suficiente para demo
- **Vercel:** tráfego moderado, ideal para apresentação ao cliente
- Para produção real com muitos acessos, considere planos pagos depois
