---
description: Escreve (ou revisa) a spec de uma funcionalidade — o quê e por quê, com regras, critérios de aceite e decisões do responsável
argument-hint: "<pedido em texto livre> | <NNN para revisar uma spec existente>"
---

# /spec — especificar antes de codar

Pedido: **$ARGUMENTS**

Você vai produzir `specs/NNN-nome-curto/spec.md`. **Não escreva código nesta etapa.**
Converse em pt-BR. Commit, push e qualquer escrita em produção só com OK explícito.

## 1. Entender antes de escrever
1. Leia `specs/constitution.md` (regras inegociáveis), `specs/README.md` (processo, personas, níveis
   de rigor), `CLAUDE.md` (contexto do negócio) e as specs relacionadas em `specs/`.
2. Se o pedido mexe em algo que já existe, leia o código atual e descreva o **comportamento real**
   (não o que se supõe). Diferenças entre o que o usuário pensa e o que o código faz viram perguntas.
3. Escolha o **nível de rigor** (tabela do README). Dinheiro, permissão ou dado pessoal → spec completa.
4. Se `$ARGUMENTS` é um número, revise a spec existente em vez de criar outra.

## 2. Rascunho
1. Número: o próximo livre em `specs/` (não reutilize números reservados no índice do README).
2. Crie a branch `spec/NNN-nome-curto` a partir da `main` atualizada.
3. Copie `specs/_templates/spec.md` e preencha. Regras:
   - comportamento, **não código** (nada de nomes de arquivos, funções ou tabelas);
   - regras numeradas `RN-xx`; critérios `CA-xx` em "Dado / quando / então" com **valores concretos**
     (ex.: "R$ 800,00 × 30% = R$ 240,00", "início 10/01/2027 → fim 09/04/2027");
   - "Quem usa" segue as personas do README;
   - dúvidas vão para **Perguntas em aberto** — nunca para suposições;
   - **nunca invente dado financeiro** (percentual, prazo, dia de pagamento): pergunte ou marque "a confirmar".
4. Status `rascunho`. Atualize o índice em `specs/README.md`.

## 3. Ouvir quem executa o processo (persona)
Se a funcionalidade muda um processo que alguém faz hoje (pós-venda, financeiro, corretor...):
1. Pergunte ao responsável **quem** executa esse processo hoje.
2. Escreva um **questionário para essa pessoa**, em linguagem simples, sem termos técnicos, agrupado
   por tema (como fica sabendo, o que faz, exceções, quem é afetado, o que gostaria de ver). Peça
   exemplos genéricos — **nenhum nome, telefone ou dado de cliente**. Comece a mensagem com uma linha
   dizendo para quem o texto foi escrito.
3. Com as respostas: mostre o que **confirma** a spec, o que **contradiz** decisões anteriores (tabela
   antes → agora → proposta) e as perguntas que sobraram.
4. Se a pessoa nunca viveu o caso (ex.: "nunca tivemos estorno"), registre na spec que as regras vêm
   da descrição do processo e devem ser revistas no primeiro caso real.

## 4. Decisões e aprovação
1. Use AskUserQuestion para escolhas de negócio (até 4 por vez), com a opção recomendada primeiro.
2. Registre cada decisão na tabela **Decisões** (`D-xx`, data, situação `vigente` | `substituída por D-yy`).
   Decisão nova que contradiz uma aprovada: marque a antiga como substituída — nunca apague.
3. Mostre um resumo curto (o que a spec define + perguntas que faltam) e peça a aprovação.
4. Só com o OK explícito: status `aprovada` com data. Se a spec já aprovada mudar, ela volta para
   "em revisão" e precisa de nova aprovação.

Próximo passo após aprovar: `/plan NNN`.
