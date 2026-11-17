# 005 — Estorno: monitoramento e saldo pendente do corretor

- **Status:** aprovada
- **Rigor:** completa (dinheiro)
- **Responsável pela aprovação:** responsável pelo produto (Nevitta)
- **Datas:** criada em 2026-11-16 · aprovada em 2026-11-16

## Problema

Quando um cliente cancela o plano pouco tempo depois da venda, a operadora cobra de volta
(**estorna**) a comissão que pagou à corretora. Esse prazo de estorno já é registrado em cada tabela
de comissão, mas hoje não tem efeito nenhum: ninguém é avisado de que o cliente ainda está no
período de risco, e o repasse que o corretor recebeu daquela venda fica como prejuízo da corretora.

## Objetivo

- O corretor e o pós-venda acompanham cada cliente **até o fim do período de estorno**.
- Se houver estorno, o repasse que o corretor recebeu daquela venda vira **saldo pendente** dele,
  quitado depois pelo Gestor.

## Quem usa

| Perfil        | O que faz |
|---------------|-----------|
| Administrador | Tudo o que o Gestor faz. |
| Gestor        | Registra o cancelamento da apólice; vê e quita os saldos pendentes dos corretores. |
| Corretor      | Acompanha os **próprios** clientes em período de estorno; vê o próprio saldo pendente no painel. |
| Pós-venda     | Acompanha **todos** os clientes em período de estorno, **sem** valores de comissão. |

## Histórias de usuário

- Como **corretor** e como **pós-venda**, quero ver quais clientes ainda estão no período de estorno e
  até quando, para cuidar deles e evitar o cancelamento.
- Como **gestor**, quero registrar o cancelamento de uma apólice e que o sistema diga se houve estorno
  e quanto o corretor passa a dever.
- Como **gestor**, quero ver os saldos pendentes de cada corretor e marcá-los como quitados.

## Regras de negócio

**Período de estorno (monitoramento)**
- **RN-01** — O período de estorno de uma apólice começa no **início da vigência** e dura o
  **prazo de estorno** (em meses) da tabela de comissão dela. Termina no dia anterior ao mesmo dia,
  N meses depois (ex.: início 10/01/2027, prazo 3 meses → período até 09/04/2027).
- **RN-02** — Apólice **ativa** dentro do período está **em monitoramento**. A lista de monitoramento
  mostra cliente, apólice, corretor responsável, início da vigência e **fim do período**, ordenada
  pelo fim mais próximo.
- **RN-03** — Os percentuais da apólice vêm sempre de uma **tabela de comissão** — a tabela é o retorno
  da seguradora (D6). Por isso toda apólice nova exige tabela, e o prazo de estorno vem dela. Tabela
  sem prazo de estorno informado → apólice **sem** período de estorno.

**Cancelamento e estorno**
- **RN-04** — O Gestor registra o **cancelamento** da apólice com a **data do cancelamento** (padrão:
  hoje em Brasília). A apólice fica `cancelada` e deixa de gerar comissões. Quando houver estorno
  (RN-05), o **valor estornado pela operadora** é **obrigatório** (D9) e fica registrado na apólice.
- **RN-14** — O **motivo do cancelamento** é obrigatório (D10): pedido do cliente, inadimplência,
  troca de plano/operadora ou outro (com descrição). Serve para entender por que os clientes cancelam.
- **RN-13** — Ao cancelar, as comissões da apólice **ainda não recebidas** (`prevista`/`atrasada`)
  passam a `cancelada` (D7), com ou sem estorno. Comissões recebidas não mudam.
- **RN-05** — Há **estorno** quando a data do cancelamento está **dentro** do período de estorno.
  Cancelamento depois do período não gera estorno nem saldo.
- **RN-06** — No estorno, o repasse da parcela 1 daquela apólice:
  - **pendente** (ainda não pago) → é **cancelado**; não gera saldo;
  - **pago** → o **valor pago** vira **saldo pendente** do corretor que o recebeu;
  - inexistente (parcela 1 ainda não recebida) → nada a fazer.
- **RN-07** — O cancelamento é registrado **uma vez**; registrar de novo não duplica o saldo.

**Saldo pendente do corretor**
- **RN-08** — Cada saldo pendente guarda: corretor, apólice/cliente de origem, valor, data do estorno
  e situação (`pendente` | `quitado`).
- **RN-09** — O saldo é quitado **manualmente** pelo Gestor (data e observação). Ele **não** é
  descontado automaticamente dos próximos repasses.
- **RN-10** — Corretor inativo continua com o saldo pendente (spec 002/RN-21).

**Isolamento e perfis**
- **RN-11** — Tudo pertence à empresa da apólice (constituição I).
- **RN-12** — Corretor vê só os próprios clientes em monitoramento e o **próprio saldo pendente** no
  painel (D8). Pós-venda vê o monitoramento da empresa toda, sem valores. Cancelamento e quitação:
  Administrador e Gestor.

## Critérios de aceite

Exemplo padrão: tabela T com prazo de estorno de **3 meses**; apólice com início de vigência em
**10/01/2027**; parcela 1 recebida; corretor com repasse de **R$ 240,00**.

- **CA-01** — **Dado** a apólice padrão, **então** o fim do período de estorno é **09/04/2027**.
- **CA-02** — **Dado** hoje = 15/03/2027, **quando** o corretor abre o monitoramento, **então** a apólice
  aparece com fim em 09/04/2027; **dado** hoje = 10/04/2027, **então** ela não aparece mais.
- **CA-03** — **Dado** apólices de dois corretores em monitoramento, **quando** um corretor abre a lista,
  **então** vê só as próprias; **quando** o pós-venda abre, **então** vê todas, sem valores de comissão.
- **CA-04** — **Quando** o gestor cria uma apólice sem tabela de comissão, **então** recebe 400; **dado**
  uma tabela sem prazo de estorno, **então** a apólice dela não entra no monitoramento.
- **CA-05** — **Dado** o repasse de R$ 240,00 **pago** e a parcela 2 `prevista`, **quando** o gestor
  registra o cancelamento em 01/03/2027 com valor estornado de R$ 1.000,00, **então** a apólice fica
  `cancelada` com o valor estornado registrado, a parcela 2 fica `cancelada`, a parcela 1 (recebida)
  não muda, e o corretor passa a ter um saldo pendente de **R$ 240,00** com origem nessa apólice.
- **CA-13** — **Quando** o cancelamento dentro do período é registrado **sem** o valor estornado,
  **então** recebe 400 e nada muda; **fora** do período, o valor não é exigido.
- **CA-06** — **Dado** o repasse de R$ 240,00 **pendente**, **quando** o gestor registra o cancelamento
  em 01/03/2027, **então** o repasse fica `cancelado` e **não** há saldo pendente.
- **CA-07** — **Dado** o repasse pago, **quando** o cancelamento é em **10/04/2027** (fora do período),
  **então** não há estorno nem saldo.
- **CA-08** — **Quando** o gestor registra o cancelamento duas vezes, **então** existe um único saldo.
- **CA-09** — **Dado** um saldo pendente, **quando** o gestor marca como quitado, **então** ele fica
  `quitado` com data e observação, e deixa de somar no total pendente do corretor.
- **CA-15** — **Quando** o cancelamento é registrado sem motivo, ou com "outro" sem descrição,
  **então** recebe 400 e nada muda.
- **CA-14** — **Dado** saldos de dois corretores, **quando** um corretor abre o painel, **então** vê o
  total do **próprio** saldo pendente e não o do colega.
- **CA-10** — **Dado** saldo pendente e um novo repasse do corretor, **quando** o gestor gera repasses,
  **então** o valor do repasse **não** é descontado.
- **CA-11** — **Dado** a apólice cancelada, **quando** o job mensal roda, **então** não gera comissão.
- **CA-12** — Corretor e pós-venda **não** conseguem registrar cancelamento nem quitar saldo (403);
  empresa A não vê nem quita saldo da empresa B (404).

## Permissões e isolamento

- Permissões novas propostas: `estornos.ver` (admin, gestor), `estornos.editar` (admin, gestor),
  `monitoramento.ver` (admin, gestor, corretor — só os próprios —, pós-venda). A matriz e a cópia do
  front mudam juntas (teste de paridade).
- Toda consulta filtra pela empresa; corretor via `escopoCorretor`.

## Dados sensíveis (LGPD)

Nome do cliente na lista de monitoramento (já visível hoje para esses perfis). Valores financeiros
do corretor ficam restritos a Administrador, Gestor e ao próprio corretor.

## Fora do escopo

- Desconto automático do saldo nos repasses (decidido: quitação manual).
- Estorno parcial por parcela ou regras diferentes por operadora.
- Alertas automáticos (e-mail/WhatsApp) de fim do período — o monitoramento é uma lista.
- Reativar apólice cancelada.

## Decisões

| Id | Data       | Decisão |
|----|------------|---------|
| D1 | 2026-11-16 | Corretor e pós-venda monitoram o cliente até o fim do período de estorno. |
| D2 | 2026-11-16 | Estorno = cancelamento dentro do prazo da tabela, contado do início da vigência. |
| D3 | 2026-11-16 | Saldo pendente = o repasse que o corretor recebeu daquela venda. |
| D4 | 2026-11-16 | Quitação manual pelo Gestor. |
| D5 | 2026-11-16 | Repasse ainda não pago é cancelado (não vira saldo). |
| D6 | 2026-11-16 | Percentuais da apólice vêm sempre da tabela de comissão (retorno da seguradora): tabela obrigatória. |
| D7 | 2026-11-16 | Cancelar a apólice cancela as comissões ainda não recebidas. |
| D8 | 2026-11-16 | Corretor vê o próprio saldo pendente no painel. |
| D9 | 2026-11-16 | Valor estornado pela operadora é obrigatório quando há estorno. |
| D10 | 2026-11-16 | Motivo do cancelamento é obrigatório. |

## Impacto em outras specs

- **002/RN-01** deixa de aceitar **percentual fixo** em apólices novas (D6): a apólice passa a exigir
  tabela de comissão. Em produção não há apólices, então nada a migrar. A regra `fixa` (RN-03 da 002)
  continua no cálculo só para apólices antigas que existam sem tabela.

## Perguntas em aberto

Nenhuma.
