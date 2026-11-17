# 002 — Comissão por parcela e repasse ao corretor

- **Status:** implementada (spec retroativa revisada com o responsável em 2026-11-16)
- **Rigor:** completa (dinheiro)
- **Responsável pela aprovação:** responsável pelo produto (Nevitta)
- **Datas:** criada em 2026-11-16 · decisões D1–D5 em 2026-11-16

## Problema

A corretora recebe das operadoras uma comissão que varia a cada parcela do contrato: um
**agenciamento** alto nas primeiras parcelas (às vezes acima de 100% da mensalidade) e, depois, um
**vitalício** pequeno por um prazo ou enquanto o contrato estiver ativo. O dinheiro chega pela
**plataforma VIDA**, normalmente na data em que o cliente paga o boleto. O corretor da equipe recebe
um percentual **só sobre a 1ª parcela**. Sem controle por parcela, a corretora não sabe quanto vai
receber em cada mês nem quanto deve repassar.

## Objetivo

- Prever, mês a mês, a comissão de cada apólice com a regra da seguradora.
- Registrar o que foi efetivamente recebido.
- Calcular o repasse ao corretor sobre o valor recebido, sem cálculo manual.

## Quem usa

| Perfil        | O que faz |
|---------------|-----------|
| Administrador | Cadastra seguradoras e tabelas de comissão; tudo o que o Gestor faz. |
| Gestor        | Cria apólices, marca comissões recebidas, gera e paga repasses. Só lê seguradoras e tabelas. |
| Corretor      | Vê só os próprios repasses e apólices, **sem** dados de comissão da corretora. |
| Pós-venda     | Não vê comissões nem repasses; ajusta campos operacionais da apólice (ex.: dia de vencimento). |

## Histórias de usuário

- Como **gestor**, quero que a comissão de cada parcela seja gerada sozinha todo mês, para saber
  quanto a corretora vai receber e quando.
- Como **gestor**, quero marcar o que a plataforma pagou de fato (e corrigir, se errar), para que o
  repasse use o valor real.
- Como **corretor**, quero ver quanto vou receber da 1ª parcela das minhas vendas e quando.

## Regras de negócio

**Como a apólice comissiona**
- **RN-01** — A apólice usa uma **tabela de comissão** da mesma seguradora **ou** um **percentual
  fixo** (0 a 999,99%). Com tabela, a apólice guarda o percentual da 1ª parcela como referência.
- **RN-02** — Uma tabela tem: percentuais do agenciamento parcela a parcela (até 24 parcelas, cada um
  de 0 a 999,99%) e, opcionalmente, um percentual de vitalício (0 a 100%) por N meses ou enquanto a
  apólice estiver ativa. Precisa ter ao menos um dos dois.
- **RN-03** — Comissão da parcela *n*:
  - *n* dentro do agenciamento → tipo `agenciamento`, percentual da posição *n*;
  - depois, se houver vitalício e ainda dentro do prazo → tipo `vitalicio`;
  - depois do prazo do vitalício, ou se não houver vitalício → **não gera** comissão;
  - sem tabela → tipo `fixa`, o percentual fixo da apólice em **toda** parcela.
- **RN-04** — Prazo de estorno e vigência da tabela são **apenas registrados**; não entram no cálculo.

**Valores e datas**
- **RN-05** — Valor da comissão = mensalidade × percentual, arredondado ao **centavo**, com **meio
  centavo para cima** (ex.: 16,65 × 30% = 4,995 → **5,00**). O mesmo arredondamento vale para o
  repasse e para as simulações exibidas na tela.
- **RN-06** — Data prevista de recebimento = **dia de vencimento do boleto** da apólice no mês da
  competência (D2). Se o mês não tem esse dia (ex.: 31 em fevereiro), vale o **último dia** do mês.
- **RN-07** — O **dia de vencimento do boleto** (1 a 31) é **obrigatório** para criar e editar a
  apólice (não se inventa a data — constituição III.1). Apólice que ficar sem ele é **pulada** pelo
  job mensal. Dia de pagamento e prazo de repasse da **seguradora** são só informativos e não
  bloqueiam mais a criação de apólices.
- **RN-20** — "Hoje" e "competência atual" seguem o **horário de Brasília** (D1): o servidor roda em
  UTC, mas entre 21h e meia-noite em Brasília ainda é o dia (e o mês) de Brasília. Os jobs também
  rodam no horário de Brasília.

**Geração das comissões**
- **RN-08** — Criar uma apólice gera a comissão da **parcela 1** na **competência atual**, com status
  `prevista` e valor bruto = líquido. Apólice e comissão são gravadas juntas (tudo ou nada).
- **RN-09** — Todo dia 1 (00h de Brasília), o job mensal gera, para cada apólice **ativa**, a **próxima
  parcela** (última parcela gerada + 1) na competência do mês. Rodar de novo no mesmo mês **não
  duplica**. Quando a regra não gera mais comissão (RN-03), a apólice deixa de gerar.
- **RN-10** — Trocar a tabela ou o percentual de uma apólice vale para as **próximas** parcelas; as já
  geradas mantêm o percentual.
- **RN-19** — As comissões **ainda não recebidas** (`prevista`/`atrasada`) **acompanham a apólice**
  (D3): mudar a mensalidade recalcula o valor (com o percentual da própria parcela) e mudar o dia de
  vencimento recalcula a previsão. Comissões recebidas não mudam.
- **RN-11** — Diariamente (8h de Brasília), comissão `prevista` com data prevista há mais de 5 dias
  vira `atrasada`. Se um recálculo (RN-19) deixar a previsão em dia, ela volta a `prevista`.

**Recebimento**
- **RN-12** — Marcar uma comissão como recebida grava a data de recebimento (padrão: hoje em
  Brasília) e, opcionalmente, o **valor efetivamente recebido** (≥ 0), que passa a ser o valor
  líquido. Pode ser repetido para **corrigir** data e valor.

**Repasse ao corretor**
- **RN-13** — Só a **parcela 1** gera repasse. As demais parcelas (2ª, vitalício...) ficam com a
  corretora.
- **RN-14** — Repasse = percentual do **cadastro do corretor** × **valor líquido recebido** da parcela 1
  (arredondamento da RN-05). O percentual usado fica gravado no repasse; mudar o cadastro do corretor
  depois não altera repasses já gerados.
- **RN-15** — "Gerar repasses" cria um repasse `pendente` para cada parcela 1 **recebida**, com
  corretor, que ainda não tenha repasse. Previsão de pagamento = data de recebimento **+ 2 dias** (D4).
  Gerar de novo **não duplica**.
- **RN-16** — Marcar repasse como pago grava a data (padrão: hoje em Brasília), a forma de pagamento
  e o comprovante.
- **RN-22** — Corrigir o recebimento da parcela 1 (RN-12) atualiza o repasse **pendente** — valor (com
  o percentual gravado nele) e previsão. Repasse **já pago não muda** (D3).
- **RN-21** — Corretor **inativo** continua recebendo o repasse da parcela 1 que vendeu, mas **perde o
  acesso** ao sistema; a comissão e o repasse ficam visíveis só para Administrador e Gestor (D5;
  regra de acesso na spec 001/RN-21).

**Isolamento e perfis**
- **RN-17** — Tudo pertence a uma empresa (constituição I): comissões e repasses herdam a empresa da
  apólice; gerar repasses de uma empresa nunca toca outra.
- **RN-18** — Corretor vê só os próprios repasses e apólices, sem percentual nem tabela de comissão.

## Critérios de aceite

Exemplo padrão: tabela **T** = agenciamento {100%, 90%}, vitalício 2% por 12 meses; mensalidade
R$ 1.000,00; boleto vence no dia 15.

- **CA-01** — **Dado** a tabela T, **então** as parcelas 1 e 2 são agenciamento de 100% e 90%, as
  parcelas 3 a 14 são vitalício de 2%, e a 15 não gera comissão.
- **CA-02** — **Dado** uma tabela {100%, 90%} sem vitalício, **então** a parcela 3 não gera comissão.
- **CA-03** — **Dado** vitalício sem prazo, **então** a parcela 100 ainda é vitalício.
- **CA-04** — **Dado** uma apólice sem tabela com 5,5%, **então** toda parcela é `fixa` de 5,5%.
- **CA-05** — Arredondamento: 1.000,00 × 2,5% = 25,00; 16,65 × 30% = **5,00**; 12,87 × 150% = **19,31**;
  10,05 × 50% = 5,03; 199,99 × 33,33% = 66,66 — no backend e na simulação da tela.
- **CA-06** — Data prevista: competência jan/2027 com vencimento dia 15 → 15/01/2027; fev/2027 com
  dia 31 → 28/02/2027; fev/2028 com dia 30 → 29/02/2028; abr/2027 com dia 31 → 30/04/2027.
- **CA-07** — **Quando** o gestor cria uma apólice sem dia de vencimento (vazio, 0 ou 32), **então**
  recebe 400 e nada é gravado; **e** uma seguradora com dia de pagamento/prazo "a confirmar" não
  impede a criação.
- **CA-08** — **Quando** o gestor cria uma apólice com uma tabela de **outra** seguradora, **então**
  recebe 400.
- **CA-09** — **Quando** o gestor cria uma apólice com a tabela T, **então** a apólice guarda 100% como
  referência e existe uma comissão parcela 1, `agenciamento`, competência atual (Brasília),
  `prevista`, valor R$ 1.000,00, prevista para o dia 15 do mês.
- **CA-10** — **Dado** a apólice do CA-09, **quando** o job roda no mês seguinte, **então** gera a
  parcela 2 de R$ 900,00 prevista para o dia 15 desse mês; **quando** roda de novo no mesmo mês,
  **então** não gera outra.
- **CA-11** — **Dado** uma apólice cuja tabela acabou, **quando** o job roda, **então** não gera comissão.
- **CA-12** — **Dado** uma apólice que ficou sem dia de vencimento, **quando** o job roda, **então** ela
  é pulada.
- **CA-13** — **Dado** a apólice do CA-09, **quando** a tabela é trocada, **então** as parcelas já
  geradas mantêm percentual e valor.
- **CA-14** — **Dado** a parcela 1 recebida em 20/01/2027 com valor real R$ 800,00 e corretor com 30%,
  **quando** o gestor gera repasses, **então** é criado um repasse `pendente` de **R$ 240,00**, 30%,
  previsto para **22/01/2027**; **quando** gera de novo, **então** nada novo é criado.
- **CA-15** — **Dado** a parcela 2 recebida, **quando** o gestor gera repasses, **então** ela não gera repasse.
- **CA-16** — **Dado** um repasse gerado com 30%, **quando** o percentual do corretor muda para 50%,
  **então** o repasse continua com 30% e o mesmo valor.
- **CA-17** — **Dado** parcelas 1 recebidas nas empresas A e B, **quando** o gestor de A gera repasses,
  **então** só os de A são criados.
- **CA-18** — **Dado** repasses de dois corretores, **quando** um corretor lista repasses, **então** vê
  só os próprios; **e** ao listar apólices não recebe percentual nem tabela de comissão.
- **CA-19** — **Quando** o gestor marca um repasse como pago, **então** ele fica `pago` com a data
  informada.
- **CA-20** — **Dado** a parcela 1 recebida e a parcela 2 prevista (90%), **quando** a mensalidade
  muda para R$ 2.000,00 e o vencimento para o dia 20, **então** a parcela 2 passa a R$ 1.800,00
  prevista para o dia 20, e a parcela 1 e o repasse dela não mudam; **e** quando o pós-venda muda o
  vencimento para 31, a previsão pendente vai para o último dia do mês; vencimento vazio → 400.
- **CA-21** — **Dado** o repasse pendente de R$ 240,00 (30%), **quando** o recebimento é corrigido
  para R$ 1.000,00 em 21/01/2027, **então** o repasse passa a R$ 300,00 previsto para 23/01/2027;
  **dado** o repasse já pago, **quando** o recebimento é corrigido de novo, **então** o repasse não
  muda; valor negativo, não numérico ou data fora do formato → 400.
- **CA-22** — **Dado** 23h30 de 30/11/2026 em Brasília (02h30 UTC de 01/12), **então** hoje é
  30/11/2026 e a competência é 2026-11; à 00h de 01/12 em Brasília vira 2026-12; **e** o job disparado
  às 23h do último dia de um mês (Brasília) gera a competência desse mês.
- **CA-23** — **Dado** um corretor inativo com parcela 1 recebida, **quando** o gestor gera repasses,
  **então** o repasse é criado para ele; **e** ele não acessa mais o sistema (401), enquanto o gestor
  vê o repasse.

## Permissões e isolamento

- Permissões: `apolices.*`, `apolices.ver_comissao`, `comissoes.*`, `repasses.*`,
  `tabelas_comissao.*` (ver `backend/utils/permissoes.js`).
- Escopo do corretor: repasses em que é o destino; apólices em que é o responsável.
- Isolamento: comissão e repasse gravam a empresa da apólice; toda consulta filtra pela empresa.

## Dados sensíveis (LGPD)

Valores financeiros da corretora e do corretor. Não há dado de saúde nesta funcionalidade.

## Fora do escopo

- Estorno (devolução de comissão por cancelamento precoce) e vigência das tabelas no cálculo.
- Conciliação automática com o extrato da plataforma VIDA (`pagamentos_seguradora` existe e não é usada).
- Repasse de parcelas além da 1ª.
- Ajuste (diferença a pagar/descontar) de repasse já pago quando o recebimento é corrigido.

## Decisões

| Id | Data       | Decisão |
|----|------------|---------|
| D0 | 2026-11-16 | Arredondamento: meio centavo para cima, calculado em centavos inteiros. |
| D1 | 2026-11-16 | Datas e competências no horário de Brasília. |
| D2 | 2026-11-16 | A comissão é paga pela plataforma VIDA quando o cliente paga o boleto: previsão = vencimento do boleto. |
| D3 | 2026-11-16 | Mudanças de valor atualizam só comissões não recebidas e repasses pendentes; repasse pago não muda. |
| D4 | 2026-11-16 | Repasse vence 2 dias após o recebimento. |
| D5 | 2026-11-16 | Corretor inativo continua recebendo o repasse, sem acesso; só o Gestor (e o Admin) acompanha. |

## Perguntas em aberto

- [x] **P5** — Estorno: tratado na [spec 005](../005-estorno/spec.md).
- [ ] **P6** — O prazo de 2 dias do repasse deve ser configurável por empresa?
