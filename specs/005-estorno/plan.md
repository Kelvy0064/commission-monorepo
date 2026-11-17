# 005 — Plano técnico: estorno (v2)

- **Spec:** [spec.md](spec.md) — versão 2 (aprovada em 2026-11-17)
- **Status:** aprovado em 2026-11-17
- **Branch:** `spec/005-estorno`

## Resumo da abordagem

1. **Etapa 1 — aviso** (`POST /apolices/:id/cancelamento`, pós-venda/gestor/admin): cancela a apólice,
   as comissões não recebidas e, se houve estorno, o repasse ainda não pago; abre um **estorno**
   aguardando conclusão.
2. **Etapa 2 — conclusão** (`PUT /estornos/:id/concluir`, gestor/admin): valor estornado + forma de
   cobrança; cria o **saldo do corretor** (ou registra que a corretora assume, se ele foi desligado).
3. **Gerar repasses** passa a **descontar saldos** automaticamente (com teto do acordo, se houver).
4. **Monitoramento** (em período + cancelamentos do mês) e **relatório do financeiro** por operadora.
5. A edição comum da apólice deixa de aceitar `cancelada`; **tabela de comissão obrigatória**.

## Banco de dados — migration `011_estorno.sql` (idempotente)

**`apolices`** (novas colunas, anuláveis): `data_cancelamento DATE`, `motivo_cancelamento VARCHAR(30)`
CHECK (`pedido_cliente`, `inadimplencia`, `troca_plano`, `financeiro`, `outro`),
`motivo_cancelamento_descricao TEXT`, `cancelamento_registrado_por INTEGER → usuarios`.

**`estornos`** (um por apólice cancelada **com** estorno):

| Coluna | Tipo / regra |
|--------|--------------|
| `id`, `empresa_id`, `apolice_id` **UNIQUE**, `seguradora_id`, `corretor_id` | chaves |
| `data_cancelamento`, `fim_periodo_estorno` | `DATE` — fim usado na decisão (histórico) |
| `status` | `aguardando_conclusao` → `a_descontar` \| `a_pagar` → `descontado` \| `pago` |
| `forma_cobranca` | `desconto_plataforma` \| `pix_boleto` |
| `valor_estornado` | `DECIMAL(10,2)`, obrigatório na conclusão |
| `assumido_pela_corretora` | `BOOLEAN` — corretor desligado (RN-10) |
| `data_liquidacao`, `concluido_por`, `concluido_em`, timestamps | |

**`saldos_corretor`**: `id`, `empresa_id`, `corretor_id`, `estorno_id` **UNIQUE**, `valor_original`,
`valor_restante` (CHECK ≥ 0), `desconto_maximo_por_repasse` (acordo, anulável), `status`
(`pendente` | `quitado`), timestamps.

**`saldo_movimentos`** (histórico): `id`, `saldo_id`, `tipo` (`desconto_repasse` | `quitacao_manual` |
`estorno_de_desconto`), `repasse_id`, `valor`, `data`, `observacao`, `usuario_id`.

**`repasses`**: nova coluna `valor_desconto_saldo DECIMAL(10,2) NOT NULL DEFAULT 0`.
`valor_repasse` continua sendo o valor calculado (bruto); **a pagar = valor_repasse − desconto**.

Sem carga de dados (produção não tem apólices). Próxima migration livre passa a ser 012.

## Regras centrais (fonte única: `backend/utils/estorno.js`)

- **Fim do período:** `(data_inicio_vigencia + estorno_meses meses) − 1 dia` (aritmética de meses do
  PostgreSQL); prazo da tabela **atual** da apólice no momento do aviso; gravado no estorno.
- **Houve estorno:** `data_cancelamento ≤ fim do período`.
- **Desconto de saldo num repasse:** para cada saldo pendente do corretor (mais antigo primeiro):
  `desconto = min(valor ainda livre no repasse, valor_restante, desconto_maximo_por_repasse)`.
  Arredondamento da spec 002/RN-05. Cada desconto vira um movimento.
- **Desfazer desconto:** se um repasse com desconto for **cancelado** (etapa 1) ou **recalculado para
  menos** (spec 002/RN-22), o que não couber volta ao saldo (movimento `estorno_de_desconto`).

## API

| Método | Rota | Permissão | Atende |
|--------|------|-----------|--------|
| `POST` | `/apolices/:id/cancelamento` | `estornos.avisar` | RN-04, 05, 07, 13 · CA-05, 07, 08, 15, 18 |
| `PUT`  | `/estornos/:id/concluir` | `estornos.editar` | RN-06, 10, 17 · CA-06, 13, 19 |
| `PUT`  | `/estornos/:id/liquidar` | `estornos.editar` | RN-18 · CA-20 |
| `GET`  | `/estornos` | `estornos.ver` | lista para o gestor |
| `GET`  | `/monitoramento-estorno` | `monitoramento.ver` | RN-02, 15, 16 · CA-01..04, 16, 17 |
| `GET`  | `/saldos-corretor` | `estornos.ver` | RN-08 |
| `PUT`  | `/saldos-corretor/:id/acordo` | `estornos.editar` | RN-09 · CA-21 |
| `POST` | `/saldos-corretor/:id/quitacoes` | `estornos.editar` | RN-09 · CA-22 |
| `GET`  | `/relatorios/plataforma?competencia=` | `estornos.ver` | RN-20 · CA-23 |
| `POST` | `/repasses/gerar` (alterada) | `repasses.editar` | RN-09 · CA-09, 10, 21 |
| `GET`  | `/dashboard` (corretor, alterada) | `dashboard.ver` | `saldo_pendente` · CA-14 |

- **Aviso** `{ data_cancelamento?, motivo, motivo_descricao? }` → `{ apolice, houve_estorno, fim_periodo_estorno, repasse_cancelado, estorno_id }`.
  Apólice precisa estar `ativa` (senão 400, CA-08). Transação única.
- **Concluir** `{ valor_estornado, forma_cobranca }` — só `aguardando_conclusao`. Corretor inativo →
  `assumido_pela_corretora = true`, sem saldo. Repasse da parcela 1 `pago` → saldo com o **valor
  efetivamente pago** (valor_repasse − desconto já aplicado nele).
- **Monitoramento** → `{ em_periodo: [...], cancelamentos_mes: [...] }`, **sem valores**; corretor só os
  próprios. `destaque = dias_restantes ≤ 30`.
- **Relatório** por seguradora na competência: `a_receber` (comissões previstas/atrasadas),
  `recebido`, `estornos_a_descontar` (todos em aberto), `liquido_esperado = a_receber − a_descontar`,
  `estornos_a_pagar` (PIX/boleto em aberto).
- **Mudanças em rotas existentes:** `POST/PUT /apolices` exigem tabela (D6) e recusam status
  `cancelada`; apólice cancelada não volta a `ativa` pela edição; `GET /repasses` passa a trazer
  `valor_desconto_saldo` e `valor_a_pagar`; somatórios de "a pagar" (Repasses e painéis) usam o líquido.

**Permissões novas:** `monitoramento.ver` (admin, gestor, corretor, pos_venda), `estornos.avisar`
(admin, gestor, pos_venda), `estornos.ver` e `estornos.editar` (admin, gestor). Back + front + tabela
de rotas do teste `001-permissoes-rotas`.

## Frontend

- **Monitoramento** (menu novo): aba **Em período** (destaque ≤ 30 dias) e quadro **Cancelamentos do
  mês**; botão **Registrar cancelamento** (pós-venda/gestor/admin) → modal data + motivo + descrição.
- **Estornos** (menu novo, admin/gestor): aguardando conclusão (concluir: valor + forma), a descontar
  / a pagar (liquidar), histórico; **relatório do financeiro** por competência.
- **Repasses:** colunas "desconto de saldo" e "a pagar"; seção **Saldos dos corretores** (acordo,
  quitação manual, histórico de movimentos).
- **Apólices:** tabela de comissão obrigatória no formulário; sem percentual fixo; sem opção
  "cancelada" no status; canceladas mostram motivo e se houve estorno.
- **Painel do corretor:** cartão **Saldo pendente**.

## Testes

Arquivo novo `backend/tests/integration/005-estorno.test.js`, um teste por critério (`005/CA-xx`):
CA-01 a CA-24. "Hoje" não é controlável: datas de início calculadas a partir do hoje real (ex.: início
= hoje − 1 mês com prazo 3 → dentro; início = hoje − 3 meses → fim ontem → fora). Unitários para o
desconto de saldo (`tests/unit/005-desconto-saldo.test.js`). Paridade de permissões no front.
Os testes da spec 002 que criam apólice com percentual fixo passam a usar tabela.

## Riscos e alternativas

- **Cancelamento por fora do fluxo** (edição comum): bloqueado e testado (CA-18).
- **Repasse zerado pelo desconto:** fica `pendente` com R$ 0,00 a pagar; o gestor marca como pago
  (mantém o fluxo de pagamento igual). Alternativa: marcar pago automaticamente — não adotada para não
  esconder o desconto.
- **Interação com a correção de recebimento (002/RN-22):** desconto é recalculado e o excedente volta
  ao saldo — teste dedicado.
- **Tabela editada depois da venda** muda o prazo de um aviso futuro; o fim usado fica gravado.
- **Primeiro caso real** pode revelar regra diferente (a corretora nunca teve estorno): spec marcada
  para revisão.

## Rollout em produção

1. PR `spec/005-estorno` → `main` com CI verde e aprovação.
2. Deploy roda a migration 011 (só estrutura).
3. Verificação: menus Monitoramento/Estornos por perfil; apólice sem tabela → recusada; fluxo
   completo numa apólice de teste (com OK do responsável), depois removida.
