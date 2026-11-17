# 005 — Tarefas (v2)

- **Spec:** [spec.md](spec.md) · **Plano:** [plan.md](plan.md)
- **Branch:** `spec/005-estorno`

Cada tarefa indica os critérios que cumpre e só é marcada quando os testes deles passam.

**Backend**
- [ ] T01 — Migration `011_estorno.sql` (apólices, `estornos`, `saldos_corretor`, `saldo_movimentos`, desconto em `repasses`)
- [ ] T02 — Permissões novas (back + front) e rotas no teste de permissões · CA-12
- [ ] T03 — Tabela obrigatória e bloqueio de `cancelada` em `POST/PUT /apolices`; ajustar testes da 002 · CA-04, CA-18
- [ ] T04 — `utils/estorno.js` (período, houve estorno, desconto de saldo) + testes unitários · CA-01, CA-09, CA-10, CA-21
- [ ] T05 — Etapa 1: `POST /apolices/:id/cancelamento` · CA-05, CA-07, CA-08, CA-11, CA-15
- [ ] T06 — Etapa 2 e liquidação: `PUT /estornos/:id/concluir`, `PUT /estornos/:id/liquidar`, `GET /estornos` · CA-06, CA-13, CA-19, CA-20
- [ ] T07 — Desconto de saldo em `POST /repasses/gerar` + devolução ao saldo (cancelamento/recálculo) · CA-09, CA-10, CA-21, CA-24
- [ ] T08 — Saldos: listar, acordo, quitação manual · CA-22
- [ ] T09 — `GET /monitoramento-estorno` · CA-02, CA-03, CA-16, CA-17
- [ ] T10 — `GET /relatorios/plataforma` · CA-23
- [ ] T11 — `saldo_pendente` no painel do corretor; somatórios de repasse pelo valor a pagar · CA-14

**Frontend**
- [ ] T12 — Formulário de apólice (tabela obrigatória, sem percentual fixo, sem "cancelada")
- [ ] T13 — Página Monitoramento (em período, cancelamentos do mês, registrar cancelamento)
- [ ] T14 — Página Estornos (concluir, liquidar, relatório do financeiro)
- [ ] T15 — Repasses (desconto, a pagar, saldos: acordo e quitação) e cartão no painel do corretor

**Fechamento**
- [ ] T16 — Spec para `implementada`; `CLAUDE.md` (modelo de domínio; próxima migration 012)
- [ ] T17 — Pull request com o link da spec e CI verde
