---
description: Implementa as tarefas de uma spec com testes por critério de aceite, até o PR com CI verde
argument-hint: "<NNN> [Txx — para começar de uma tarefa específica]"
---

# /implementar — código guiado pela spec

Spec e tarefa: **$ARGUMENTS**

## Pré-condições
- Spec `aprovada`, plano `aprovado` e `tasks.md` escrito. Se faltar algo, pare.
- Branch `spec/NNN-...` (nunca na `main`).

## Para cada tarefa, na ordem
1. Escreva/ajuste os testes primeiro, com o id no nome: `test('NNN/CA-07: ...')`.
   - Integração em `backend/tests/integration/NNN-*.test.js` (helpers em `tests/helpers/contexto.js`;
     tokens com `tokenDe`, nunca pelo login — ele tem limite por IP).
   - Regras puras em `backend/tests/unit/NNN-*.test.js`; front em `frontend/tests/`.
   - Dados **sempre fictícios** (`@teste.local`).
2. Implemente seguindo a constituição: filtro por `empresa_id`, permissão na matriz (back + front),
   horário de Brasília (`utils/dataBrasil.js`), dinheiro em centavos inteiros (`valorComissao`),
   migration idempotente, erros `{ error }` em pt-BR.
3. Rode `cd backend && npm test` (e `cd frontend && npm test && npm run build` se mexeu no front).
   A tarefa só é marcada `[x]` em `tasks.md` quando os testes dos critérios dela passam.

## Regra descoberta no meio do caminho
Se aparecer um caso que a spec não cobre (ou que a contradiz): **pare**, explique o caso, proponha a
regra e pergunte. Com a resposta, **registre na spec** (RN nova ou decisão `D-xx`) e só então continue.
Regra de negócio nunca fica só no código ou nas notas de `tasks.md`.

## Antes de entregar
1. Suíte completa verde (backend e frontend + build).
2. Mudou dinheiro, permissão ou isolamento? Faça a **prova reversa**: quebre de propósito a regra
   (ex.: remova o filtro por empresa), rode os testes, confirme que falham e **restaure** — confira a
   restauração.
3. Telas novas: diga claramente que **não foram vistas no navegador** e ofereça a demonstração local
   com dados fictícios: PostgreSQL descartável, migrations, API local, carga fictícia **pela API** e
   front com `VITE_API_URL` apontando para a API local (**sem essa variável o front usa a API de
   produção**). Ao final, desligue tudo e apague o banco.
4. Fechamento: spec `implementada`, tarefas marcadas, `CLAUDE.md` atualizado (modelo de domínio,
   próxima migration livre), índice do README.
5. Resumo para o responsável: o que muda por perfil, mudanças de comportamento em produção, regras
   decididas durante a implementação, o que não foi verificado.

## Commit, push e PR
Só com OK explícito, como passos que o responsável pede. Commit em inglês com o porquê no corpo. PR
para a `main` com título e descrição em pt-BR (resumo, ⚠️ o que muda em produção, banco, testes,
checklist pós-deploy). Sem `gh`, gere o link `compare/main...<branch>?quick_pull=1&title=...&body=...`
a partir de um arquivo (crases no shell viram comando). O merge é do responsável e publica em produção.
