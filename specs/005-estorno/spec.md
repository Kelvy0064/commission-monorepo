# 005 — Estorno: monitoramento, cancelamento e saldos

- **Status:** aprovada (versão 2, aprovada em 2026-11-17). A versão 1 foi aprovada em 2026-11-16;
  a v2 incorpora o processo descrito pela responsável pelo estorno manual (persona Carla, pós-venda/
  financeiro) e substitui as decisões marcadas na tabela de Decisões.
- **Rigor:** completa (dinheiro)
- **Responsável pela aprovação:** responsável pelo produto (Nevitta)
- **Datas:** criada em 2026-11-16 · v1 aprovada em 2026-11-16 · v2 aprovada em 2026-11-17
- **Atenção:** a corretora **ainda não teve nenhum estorno**. As regras vêm da descrição do processo;
  revisar esta spec no primeiro caso real.

## Problema

Quando um cliente cancela o plano dentro do **prazo de estorno** da operadora, a plataforma VIDA cobra
de volta a comissão paga à corretora. **Nenhum sistema avisa** desse cancelamento: a corretora só sabe
pelo próprio cliente, por isso o **pós-venda** acompanha os clientes com mensagens periódicas. Hoje
nada disso é registrado: não se sabe quem está no período de risco, quanto a plataforma vai descontar
nem quanto cada corretor deve.

## Objetivo

- Corretor e pós-venda acompanham cada cliente **até o fim do período de estorno**, com aviso quando
  faltar pouco.
- O cancelamento informado pelo cliente é registrado na hora, e o sistema calcula o efeito: o que a
  corretora deve à plataforma e o que o corretor devolve.
- O financeiro sabe, por operadora, quanto a plataforma deve pagar já descontados os estornos.

## Quem usa

| Perfil        | O que faz |
|---------------|-----------|
| Administrador | Tudo o que o Gestor faz. |
| Gestor        | Completa o estorno (valor e forma de cobrança), acompanha saldos, registra acordos e quitações, emite o relatório do financeiro. |
| Corretor      | Acompanha os **próprios** clientes no período; vê o próprio saldo pendente no painel. |
| Pós-venda     | Acompanha **todos** os clientes no período (sem valores); **registra o aviso de cancelamento** informado pelo cliente. |

## Histórias de usuário

- Como **pós-venda**, quero ver quem está no período de estorno e quanto falta, para manter o
  contato e evitar o cancelamento.
- Como **pós-venda**, quero registrar na hora que um cliente avisou que cancelou.
- Como **gestor**, quero completar o estorno com o valor cobrado pela plataforma e ver o desconto
  acontecer sozinho nos próximos repasses do corretor.
- Como **financeiro**, quero um relatório por operadora do que a plataforma deve pagar, já
  descontados os estornos.
- Como **gestor**, quero ver os cancelamentos do mês na daily.

## Regras de negócio

**Período de estorno e monitoramento**
- **RN-01** — O período de estorno começa no **início da vigência** da apólice e dura o **prazo de
  estorno** (meses) da tabela de comissão dela; termina no dia anterior ao mesmo dia, N meses depois
  (início 10/01/2027 + 3 meses → até 09/04/2027).
- **RN-02** — Apólice **ativa** dentro do período está **em monitoramento**: lista com cliente,
  apólice, operadora, corretor, início, fim e **dias restantes**, ordenada pelo fim mais próximo.
- **RN-03** — Os percentuais da apólice vêm sempre de uma **tabela de comissão** (retorno da
  seguradora): toda apólice nova exige tabela. O prazo varia por operadora e por tipo/categoria de
  plano, por isso fica na tabela. Tabela sem prazo de estorno → apólice sem período.
- **RN-15** — Apólices a **30 dias ou menos** do fim do período aparecem **destacadas** ("faltam X dias").
- **RN-16** — O monitoramento tem o quadro **Cancelamentos do mês** (com e sem estorno), para a daily.

**Cancelamento em duas etapas**
- **RN-04** — **Etapa 1 — aviso (pós-venda, gestor ou admin):** registra a **data do cancelamento**
  (padrão: hoje em Brasília) e o **motivo** (obrigatório: pedido do cliente, inadimplência, troca de
  plano/operadora, financeiro, outro — "outro" exige descrição). A apólice fica `cancelada`, deixa de
  gerar comissões e o sistema registra se **houve estorno** (data dentro do período, RN-05).
- **RN-13** — Na etapa 1, as comissões **ainda não recebidas** viram `cancelada`; havendo estorno, o
  **repasse ainda não pago** da parcela 1 vira `cancelado` (não pode mais ser pago).
- **RN-05** — Há estorno quando a data do cancelamento está **dentro** do período. Fora dele, o
  processo termina na etapa 1.
- **RN-17** — **Etapa 2 — conclusão do estorno (gestor ou admin):** informa o **valor estornado** pela
  plataforma (obrigatório) e a **forma de cobrança**: descontado do próximo pagamento de uma venda
  da **mesma operadora**, ou **PIX/boleto** enviado pela plataforma quando não há venda. Só então o
  saldo do corretor é gerado (RN-06).
- **RN-07** — Cada apólice tem no máximo um cancelamento e um estorno; repetir não duplica nada.
- Inadimplência (cancelamento pela operadora após 1 a 3 meses sem pagamento, conforme a operadora) e
  saída de vida que deixa o contrato abaixo do mínimo da operadora são **cancelamentos** comuns,
  registrados com o motivo correspondente. Troca de plano **não** é cancelamento.

**Dívida da corretora com a plataforma**
- **RN-18** — O estorno fica `a descontar` (forma "próximo pagamento") ou `a pagar` (PIX/boleto) até o
  gestor marcar como `descontado`/`pago`, com a data.
- **RN-19** — O desconto feito pela plataforma no pagamento de **outra** venda **não** reduz o valor
  recebido daquela venda no sistema: a comissão dela é registrada pelo valor cheio, e o estorno é
  marcado como descontado. (Senão o repasse de outro corretor diminuiria.)
- **RN-20** — **Relatório do financeiro** por operadora e competência: comissões a receber, recebidas,
  estornos a descontar, valor líquido esperado da plataforma, e estornos a pagar por PIX/boleto.

**Saldo do corretor**
- **RN-06** — Na etapa 2, se o repasse da parcela 1 já foi **pago**, **100% do que o corretor recebeu
  daquela apólice** vira **saldo pendente** dele. A diferença entre o estorno e esse valor é prejuízo
  da corretora. Sem repasse pago, não há saldo.
- **RN-09** — O saldo é **descontado automaticamente** dos **próximos repasses** do corretor ao gerá-los,
  até zerar; se um repasse for menor que o saldo, o restante passa para os seguintes. O gestor pode
  registrar um **acordo** (valor máximo descontado por repasse) e **quitações manuais** (totais ou
  parciais).
- **RN-10** — Estorno concluído quando o corretor **já foi desligado** (cadastro inativo) **não gera
  saldo**: a corretora assume. Saldo que já existia antes do desligamento continua com o corretor.
- **RN-08** — O saldo guarda corretor, apólice/cliente, valor original, valor restante, situação
  (`pendente` | `quitado`) e o histórico de descontos e quitações.

**Isolamento e perfis**
- **RN-11** — Tudo pertence à empresa da apólice (constituição I).
- **RN-12** — Corretor: só os próprios clientes no monitoramento e o próprio saldo no painel.
  Pós-venda: monitoramento da empresa toda **sem valores** e registro do aviso. Etapa 2, saldos,
  acordos, quitações e relatório: Administrador e Gestor.

## Critérios de aceite

Exemplo padrão: tabela T da operadora X com prazo de estorno de **3 meses**; apólice com início em
**10/01/2027**; parcela 1 recebida; repasse do corretor de **R$ 240,00**.

**Monitoramento**
- **CA-01** — Fim do período da apólice padrão = **09/04/2027**.
- **CA-02** — Apólice dentro do período aparece no monitoramento; com o fim ontem, não aparece.
- **CA-03** — Corretor vê só as próprias; pós-venda vê todas, sem valores de comissão.
- **CA-04** — Apólice sem tabela → 400; tabela sem prazo de estorno → apólice fora do monitoramento.
- **CA-16** — Apólice a 30 dias ou menos do fim vem marcada como destaque, com os dias restantes.
- **CA-17** — Cancelamentos do mês aparecem no quadro do monitoramento, com motivo e se houve estorno.

**Etapa 1 — aviso**
- **CA-05** — **Dado** o repasse de R$ 240,00 **pendente** e a parcela 2 prevista, **quando** o
  pós-venda registra o aviso em 01/03/2027 (motivo "pedido do cliente"), **então** a apólice fica
  `cancelada` com estorno, a parcela 2 fica `cancelada`, a parcela 1 recebida não muda, o repasse fica
  `cancelado` e o estorno fica aguardando a etapa 2.
- **CA-07** — Aviso em **10/04/2027** (fora do período) → apólice cancelada **sem** estorno.
- **CA-15** — Aviso sem motivo, ou "outro" sem descrição → 400 e nada muda.
- **CA-08** — Registrar o aviso duas vezes → 400; nada é duplicado.
- **CA-11** — Apólice cancelada não gera comissão no job mensal.
- **CA-18** — A edição comum da apólice não aceita o status `cancelada` (nem pelo pós-venda).

**Etapa 2 — conclusão**
- **CA-06** — **Dado** o repasse de R$ 240,00 **pago**, **quando** o gestor conclui com R$ 1.000,00
  "descontado do próximo pagamento", **então** o estorno fica `a descontar` e o corretor ganha um
  saldo pendente de **R$ 240,00**.
- **CA-13** — Concluir sem valor estornado → 400; pós-venda concluindo → 403.
- **CA-19** — **Dado** o corretor desligado, **quando** o gestor conclui, **então** não há saldo e o
  estorno fica registrado como assumido pela corretora.
- **CA-20** — **Quando** o gestor marca o estorno `a descontar` como descontado (ou `a pagar` como
  pago) com a data, **então** ele sai do "a descontar" do relatório.

**Saldo e repasses**
- **CA-09** — **Dado** saldo de R$ 240,00 e um novo repasse de R$ 300,00, **quando** o gestor gera
  repasses, **então** o repasse sai com R$ 60,00 a pagar (R$ 240,00 descontados) e o saldo fica quitado.
- **CA-10** — **Dado** saldo de R$ 240,00 e repasse de R$ 100,00, **então** o repasse fica R$ 0,00 e o
  saldo restante, R$ 140,00, desconta do seguinte.
- **CA-21** — **Dado** acordo de R$ 50,00 por repasse, **então** cada repasse desconta no máximo R$ 50,00.
- **CA-22** — Quitação manual parcial reduz o restante; total quita o saldo.
- **CA-14** — O corretor vê o total do **próprio** saldo pendente no painel, não o do colega.

**Relatório e acesso**
- **CA-23** — **Dado** na competência comissões da operadora X de R$ 2.000,00 a receber e um estorno de
  R$ 1.000,00 a descontar, **então** o relatório mostra para X líquido esperado de **R$ 1.000,00**.
- **CA-24** — Registrar o recebimento de outra venda da operadora X pelo valor cheio não altera o
  repasse do corretor dela por causa do estorno (RN-19).
- **CA-12** — Corretor não registra aviso nem vê saldos de outros (403); empresa A não vê nada da B (404).

## Permissões e isolamento

- `monitoramento.ver`: admin, gestor, corretor (próprios), pós-venda.
- `estornos.avisar` (etapa 1): admin, gestor, pós-venda.
- `estornos.ver` / `estornos.editar` (etapa 2, saldos, acordos, quitações, relatório): admin, gestor.
- Matriz no back e cópia no front (teste de paridade).

## Dados sensíveis (LGPD)

Nome e telefone do cliente no monitoramento (o pós-venda já usa para o contato). Valores restritos a
Administrador, Gestor e ao próprio corretor.

## Fora do escopo

- Detectar cancelamentos automaticamente (não há fonte de dados: só o cliente informa).
- Reversão de cancelamento (não se sabe se existe; a pesquisar).
- Registro das mensagens periódicas do pós-venda (só a lista de acompanhamento).
- Estorno parcial por vida; troca de plano.

## Decisões

| Id | Data | Decisão | Situação |
|----|------|---------|----------|
| D1 | 2026-11-16 | Corretor e pós-venda monitoram até o fim do período. | vigente |
| D2 | 2026-11-16 | Estorno = cancelamento dentro do prazo da tabela, contado do início da vigência (confirmado pela Carla). | vigente |
| D3 | 2026-11-16 | Saldo do corretor = 100% do que ele recebeu daquela apólice; o resto é prejuízo da corretora. | vigente |
| D4 | 2026-11-16 | Quitação só manual. | **substituída por D11** |
| D5 | 2026-11-16 | Repasse ainda não pago é cancelado. | vigente |
| D6 | 2026-11-16 | Tabela de comissão obrigatória na apólice. | vigente |
| D7 | 2026-11-16 | Cancelar cancela as comissões não recebidas. | vigente |
| D8 | 2026-11-16 | Corretor vê o próprio saldo no painel. | vigente |
| D9 | 2026-11-16 | Valor estornado obrigatório (agora na etapa 2). | vigente |
| D10 | 2026-11-16 | Motivo obrigatório; lista ganha "Financeiro". | vigente |
| D11 | 2026-11-16 | Saldo descontado automaticamente dos próximos repasses; acordo e quitação manual possíveis. | vigente |
| D12 | 2026-11-16 | Estorno depois do desligamento: a corretora assume. Saldo anterior continua com o corretor. | vigente |
| D13 | 2026-11-16 | Duas etapas: pós-venda registra o aviso; gestor conclui com valor e forma de cobrança. | vigente |
| D14 | 2026-11-16 | Dívida com a plataforma: descontada da próxima venda da mesma operadora ou paga por PIX/boleto. | vigente |
| D15 | 2026-11-16 | Destaque a 30 dias do fim do período. | vigente |
| D16 | 2026-11-16 | Relatório do financeiro por operadora (a receber, estornos a descontar, líquido). | vigente |
| D17 | 2026-11-16 | Cancelamentos do mês no monitoramento para a daily (cancelamento não é detectável automaticamente). | vigente |

## Perguntas em aberto

- [ ] **P6** — Reversão de cancelamento existe? (Carla vai pesquisar.)
