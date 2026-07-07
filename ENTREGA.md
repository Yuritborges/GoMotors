# Checklist de entrega — Go Motors

Documento de vistoria antes de entregar o sistema ao Matheus.

**Versão de referência:** tag `v1.0-entrega`  
**Produção:** https://go-motors-ten.vercel.app  
**Telão:** https://go-motors-ten.vercel.app/display

---

## 1. Infraestrutura

| Item | Status |
|------|--------|
| Neon PostgreSQL (São Paulo) | Configurado |
| Vercel (deploy automático na `main`) | Configurado |
| Variáveis `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` | Conferir na Vercel |
| Senhas alteradas pelo admin na plataforma | Feito pelo cliente/dev |
| Domínio próprio | Opcional — `.vercel.app` funciona |

---

## 2. Segurança

| Item | Status |
|------|--------|
| Senhas demo removidas do código e docs | OK |
| `PATCH /api/orders/[id]` — só proprietário | OK |
| `DELETE /api/clients/[id]` — só proprietário | OK |
| `/api/pending-payments` — só proprietário | OK |
| Seed bloqueado em Neon sem `SEED_FORCE=1` | OK |
| `.env` e planilhas em `dados/` no `.gitignore` | OK |
| JWT + cookie httpOnly + roles | OK |

---

## 3. Perfis de acesso

| Perfil | Acesso |
|--------|--------|
| **Administrador** | Tudo: caixa, financeiro, relatórios, usuários, estoque |
| **Atendente** | Painel, nova OS, clientes, ordens, comprovante — **sem** relatórios/caixa |

---

## 4. Teste operacional (rodar na produção)

- [ ] Login administrador
- [ ] Login atendente (sem acesso a caixa/relatórios)
- [ ] Nova OS — serviço único (ex.: só chassi)
- [ ] Nova OS — lavagem completa
- [ ] Painel — avançar etapas por serviço
- [ ] Receber pagamento no painel
- [ ] Liberar veículo pronto
- [ ] Mensalidade — lançar e liberar
- [ ] Caixa → Pendências → quitar fechamento
- [ ] Comprovante + WhatsApp
- [ ] Telão `/display` na TV ou celular
- [ ] Nova OS no celular (layout mobile)

---

## 5. Dados

| Item | Ação |
|------|------|
| Dados reais importados | `npm run db:import` se ainda não rodou |
| Funcionários | `npm run db:sync-employees` |
| **Nunca** `db:seed` em produção com dados reais | Apaga tudo |

---

## 6. Desenvolvimento futuro (sem afetar o cliente)

| Regra | Detalhe |
|-------|---------|
| Branch `dev` | Alterações e testes |
| Branch `main` | Só o que o Matheus usa |
| Publicar | `npm run promote:prod` |
| Rollback | Vercel → Deployments → Promote to Production |

Ver **[WORKFLOW.md](./WORKFLOW.md)**.

---

## 7. Limitações conhecidas (informar o cliente)

| Item | Situação |
|------|----------|
| **Offline** | Não implementado — requer internet (4G de backup recomendado) |
| **NF fiscal** | Não implementado |
| **WhatsApp automático** | Só link manual no comprovante |
| **Domínio** | Opcional |
| **Migrations** | Rodar `db:migrate:deploy` manualmente após mudança de schema |
| **Telão público** | Mostra placa e nome do cliente |

---

## 8. O que entregar ao Matheus

1. Link do sistema: https://go-motors-ten.vercel.app  
2. Link da TV: https://go-motors-ten.vercel.app/display  
3. Login e senha do administrador (definidos por ele)  
4. Logins dos atendentes (criar em **Usuários**)  
5. Atalho no celular (adicionar à tela inicial)  
6. TV em tela cheia (F11 no navegador)

---

## 9. Suporte pós-entrega

| Situação | Solução |
|----------|---------|
| Sistema lento / 500 | Verificar Neon e Vercel; rede local |
| Deploy com bug | Rollback na Vercel |
| Alteração no sistema | Fluxo `dev` → teste → `promote:prod` |
| Internet cai | 4G / hotspot; operação manual temporária |

---

<p align="center"><em>GoMotors — entrega v1.0</em></p>
