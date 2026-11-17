# 004 — Negociações: quadro kanban, follow-up e distribuição de leads

- **Status:** rascunho (problema, objetivo e perfis definidos pelo responsável; regras e critérios a
  escrever a partir do comportamento atual — Fase 1)
- **Rigor:** completa
- **Responsável pela aprovação:** responsável pelo produto (Nevitta)
- **Datas:** criada em 2026-11-16

## Problema

Leads estão sendo **perdidos por falta de acompanhamento** depois de enviados aos corretores. Até
agora foram encontrados **296 leads** na base, sem um processo que garanta que cada um seja
contatado e acompanhado até a venda ou a perda.

## Objetivo

O **Gestor** da corretora acompanha os leads num **quadro kanban** durante as reuniões **diárias
(daily)**, evitando perder apólices por falta do processo de **follow-up**.

Como saberemos que deu certo: todo lead em andamento tem um responsável e uma próxima ação, e nenhum
fica parado em "Sem contato" sem que a daily veja (indicadores de acompanhamento: ver o painel da
operação, prioridade 1 das ideias registradas no `CLAUDE.md`).

## Quem usa

| Perfil        | O que faz com a funcionalidade |
|---------------|--------------------------------|
| Administrador | Suporte de TI; tudo o que o Gestor faz. |
| Gestor        | Conduz a daily pelo quadro; distribui leads entre os corretores; acompanha follow-ups. |
| Corretor      | Trabalha só as **próprias** negociações: move etapas, registra a próxima ação. |
| Pós-venda     | Consulta as negociações (somente leitura). |

## Histórias de usuário

- Como **gestor**, quero ver todas as negociações num quadro por etapa durante a daily, para saber o
  que está parado e cobrar o follow-up.
- Como **gestor**, quero distribuir vários leads entre os corretores de uma vez.
- Como **corretor**, quero ver só as minhas negociações e registrar a próxima ação com data e hora.

## Regras de negócio

_A escrever a partir do comportamento atual (etapas, status, próxima ação em horário de Brasília,
criação automática pelo lead da landing page, distribuição em rodízio) — ver `CLAUDE.md`, seção
"Negociações"._

## Critérios de aceite

_A escrever junto com as regras; cada critério vira teste._

## Permissões e isolamento

- `negociacoes.ver/criar/editar/excluir/distribuir` (ver `backend/utils/permissoes.js`).
- Corretor: só as próprias (`escopoCorretor`); o que ele cria fica com ele.

## Dados sensíveis (LGPD)

Os cartões mostram dados do lead (nome, telefone, idades, plano atual) — dados de saúde.

## Fora do escopo

- Painel de indicadores da operação (spec própria, prioridade 1 das ideias).
- Distribuição automática no momento em que o lead chega (ideia 2).

## Perguntas em aberto

- [ ]
