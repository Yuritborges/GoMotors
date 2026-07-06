# Fluxo de trabalho — dev → produção

Guia rápido para **alterar o GoMotors sem quebrar o sistema do Matheus**.

---

## Branches

| Branch | Quem usa | URL |
|--------|----------|-----|
| `main` | Matheus + equipe (produção) | https://go-motors-ten.vercel.app |
| `dev` | Você (desenvolvimento) | Preview automática na Vercel após `git push origin dev` |

Tag de referência da entrega: **`v1.0-entrega`**

---

## Dia a dia — fazer alterações

```bash
# 1. Sempre começar na dev
git checkout dev
git pull origin dev

# 2. Alterar código, testar local
npm run dev
# → http://localhost:3000

# 3. Commit na dev
git add .
git commit -m "Descrição da mudança"
git push origin dev
```

A Vercel gera um **link de preview** (não compartilhe com o cliente). Teste no celular se precisar.

### Checklist antes de ir para produção

- [ ] Login admin e atendente
- [ ] Nova OS + painel (avançar / liberar)
- [ ] Telão `/display`
- [ ] Caixa / pendências (se mexeu nisso)
- [ ] `npm test` passou

---

## Publicar para o Matheus (produção)

### Opção A — script guiado (recomendado)

```bash
npm run promote:prod
```

O script roda testes, faz merge `dev` → `main`, push e volta para `dev`.

### Opção B — manual

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
git checkout dev
```

Se houve **migration nova** no Prisma:

```bash
npm run db:migrate:deploy
```

Aguarde ~2–5 min e confira em https://go-motors-ten.vercel.app

---

## Emergência — algo quebrou em produção

1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard) → projeto **GoMotors**
2. **Deployments** → encontre o deploy anterior com **Ready**
3. **⋯** → **Promote to Production** (rollback)

O link do Matheus continua o mesmo; volta a versão anterior.

Para voltar o código no Git:

```bash
git checkout main
git reset --hard v1.0-entrega   # ou outro tag/commit estável
git push origin main --force    # só em emergência; avise antes
```

---

## Avisos automáticos

| Quando | O quê |
|--------|--------|
| `npm run dev` na `main` | Script avisa no terminal |
| Chat / Cursor | Regra `.cursor/rules/dev-before-main.mdc` lembra o fluxo |
| `git push` direto na `main` | Hook opcional bloqueia (veja abaixo) |

### Ativar proteção extra no Git (opcional)

```bash
git config core.hooksPath .githooks
```

Depois disso, push na `main` exige confirmação explícita (`ALLOW_MAIN_PUSH=1`).

---

## Banco de dados

| Ambiente | Neon |
|----------|------|
| Produção (Matheus) | `gomotors-prod` — variáveis **Production** na Vercel |
| Testes seus (opcional) | Segundo projeto Neon free — variáveis **Preview** na Vercel |

**Nunca** `npm run db:seed` no banco de produção com dados reais.
