---
description: Quebra o plano aprovado em tarefas ligadas aos critérios de aceite, conferindo que nenhum critério ficou de fora
argument-hint: "<NNN>"
---

# /tasks — checklist de implementação

Spec: **$ARGUMENTS**

## Pré-condições
- Spec `aprovada` e `plan.md` `aprovado` em `specs/$ARGUMENTS-*/`. Se faltar, pare e diga qual
  comando rodar.

## O que fazer
1. Copie `specs/_templates/tasks.md` e escreva as tarefas `T01, T02...` na ordem:
   **backend** (migration → permissões → regras centrais → rotas) → **frontend** → **fechamento**
   (spec `implementada`, `CLAUDE.md`, próxima migration livre, pull request).
2. Cada tarefa: uma frase com o resultado verificável e os critérios que cumpre (`· CA-01, CA-03`).
   Tarefas pequenas o bastante para terminar com testes passando.
3. **Confira a cobertura:** liste todos os `CA-xx` da spec e mostre a tarefa de cada um. Critério sem
   tarefa → acrescente a tarefa. Tarefa sem critério → só se for infraestrutura (migration,
   permissão, documentação); diga isso.
4. Mostre a tabela de cobertura e peça o OK para começar `/implementar $ARGUMENTS`.
