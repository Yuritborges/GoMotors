# GoMotors

Sistema de gestão para lava-jato e estética automotiva.

## Usuários e permissões

| Perfil | Acesso |
|--------|--------|
| **Proprietário** | Tudo: serviços, estoque, caixa, despesas, relatórios, usuários |
| **Atendente** | Painel, ordens, clientes, consulta de serviços |

### Credenciais demo (seed)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Proprietário | `admin@gomotors.local` | `admin123` |
| Atendente | `atendente@gomotors.local` | `atendente123` |

## Stack

- Next.js 16 (App Router)
- TypeScript
- Prisma 7 + **PostgreSQL** (Neon)
- Tailwind CSS
- Deploy: **Vercel**

## Desenvolvimento local

1. Crie um projeto grátis em [Neon](https://neon.tech)
2. Copie `.env.example` para `.env` e preencha as URLs
3. Rode:

```bash
npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Deploy online (Vercel + Neon)

Guia completo: **[DEPLOY.md](./DEPLOY.md)**

Resumo:
1. Banco no **Neon** (PostgreSQL grátis)
2. Código no **GitHub**
3. Deploy na **Vercel** com variáveis `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`
4. Rodar `npm run db:seed` uma vez após o primeiro deploy

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor local |
| `npm run build` | Build produção (migrate + Next.js) |
| `npm run db:migrate:deploy` | Aplicar migrations no Postgres |
| `npm run db:seed` | Popular dados demo |
| `npm run db:reset` | Resetar banco e re-seed |
