---
description: Escreve o plano técnico de uma spec aprovada — banco, API, telas, testes por critério, riscos e rollout
argument-hint: "<NNN>"
---

# /plan — como vamos construir

Spec: **$ARGUMENTS**

## Pré-condições
- `specs/$ARGUMENTS-*/spec.md` existe e está **aprovada**. Se não estiver, pare e diga o que falta
  (use `/spec $ARGUMENTS`).
- Trabalhe na branch `spec/NNN-...` da spec.

## O que fazer
1. Leia a spec inteira, a constituição e o código que será tocado (controllers, rotas, migrations,
   telas). Para cada regra, ache onde ela vai morar.
2. Copie `specs/_templates/plan.md` para a pasta da spec e preencha:
   - **Banco:** migration com o **próximo número livre** (ver `CLAUDE.md` → Migrations), sempre
     **idempotente**; carga única registrada em `data_migrations`; unicidades por empresa.
   - **API:** tabela método · rota · **permissão** · RN/CA atendidos. Toda rota nova entra na matriz
     (`backend/utils/permissoes.js` + cópia do front) e na tabela do teste `001-permissoes-rotas`.
     Toda consulta filtra por `empresa_id`; ids de outras entidades validados na mesma empresa.
   - **Regras centrais** numa fonte única (`backend/utils/...`), não espalhadas nos controllers.
   - **Frontend:** telas, componentes, `pode(...)` usados.
   - **Testes:** tabela critério → tipo → arquivo. **Todo CA da spec aparece.** Se "hoje" importa,
     diga como o teste lida com isso (datas relativas ao hoje real).
   - **Riscos:** procure ativamente **caminhos que contornam a regra nova** (ex.: uma edição comum que
     faz o que só o fluxo novo deveria fazer), interação com regras de outras specs e casos de
     fim de mês, fuso (horário de Brasília) e arredondamento (centavos inteiros).
   - **Rollout:** ordem do deploy, cargas (simulação → relatório → OK), backup antes de excluir,
     variáveis novas, como verificar depois.
3. Se o plano exigir uma regra que a spec não tem, **pare e volte à spec** (pergunte e registre a
   decisão lá) — o plano nunca decide regra de negócio.
4. Mostre um resumo com os pontos que precisam de decisão e peça a aprovação. Com o OK: status
   `aprovado` com data.

Próximo passo após aprovar: `/tasks $ARGUMENTS`.
