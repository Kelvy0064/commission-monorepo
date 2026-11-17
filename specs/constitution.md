# Constituição do projeto

Princípios **inegociáveis** do sistema de comissões. Toda spec, plano e implementação precisa
respeitá-los. Se uma funcionalidade exigir quebrar um deles, a constituição muda **primeiro**, com o
OK explícito do responsável pelo produto, e a mudança fica registrada no histórico deste arquivo.

O `CLAUDE.md` da raiz guarda o contexto (negócio, stack, deploy, armadilhas). Este arquivo guarda as
regras. Em caso de conflito, vale este arquivo.

## I. Isolamento entre empresas

1. Todo dado de negócio pertence a uma empresa (`empresa_id NOT NULL`).
2. Toda leitura, alteração e exclusão filtra por `req.user.empresa_id`, e toda inserção grava o
   `empresa_id` do usuário (ou da empresa do lead, nas rotas públicas).
3. Todo id recebido de outra entidade (cliente, corretor, seguradora, tabela, apólice) é validado
   como sendo **da mesma empresa**. A chave estrangeira sozinha não basta.
4. Unicidades de negócio são por empresa (CPF de corretor, CNPJ de seguradora, número de apólice).

## II. Permissões

1. A matriz de permissões tem **uma fonte**: `backend/utils/permissoes.js`. A cópia do front
   (`frontend/src/auth/permissoes.js`) precisa ser idêntica; um teste automatizado garante isso.
2. A regra de verdade é sempre a da API. O front só esconde o que o perfil não pode usar.
3. O perfil Corretor só enxerga os próprios registros (`escopoCorretor`). O Pós-venda não vê
   valores nem percentuais de comissão.

## III. Dinheiro

1. **Nunca inventar dados financeiros** (percentuais de comissão, prazos, dia de pagamento).
   Eles vêm dos contratos e das assessorias. Dado ausente fica `NULL` ("a confirmar") e bloqueia o
   cálculo que dependeria dele.
2. A regra de comissão por parcela tem uma fonte única: `backend/utils/comissaoParcela.js`.
3. Mudança que altera cálculo de dinheiro exige spec completa, critérios de aceite com valores
   exemplificados e testes automatizados antes do merge.
4. Valores são arredondados em centavos no momento do cálculo.

## IV. Dados pessoais (LGPD)

1. Idade, plano atual e hospitais preferidos são **dados de saúde** (sensíveis).
2. Exportações e cargas com dados pessoais **nunca** entram no Git (`*.tsv`, `*retroativo*.txt`,
   `backend/imports/`).
3. Nomes, telefones, e-mails e tokens não aparecem em commits, logs, specs, testes, CLAUDE.md ou
   serviços externos. Testes usam dados fictícios.

## V. Banco de dados e produção

1. Toda migration é **idempotente**: todas rodam a cada deploy. Carga que deve rodar uma vez é
   registrada em `data_migrations`.
2. Escrita em produção (importação, carga, exclusão) só depois de **simulação**, relatório e OK
   explícito. Antes de excluir, backup local em `backend/imports/`.
3. Commit, push, merge e qualquer escrita em produção só com o OK explícito do responsável.

## VI. Processo (Spec-Driven Development)

1. Toda mudança nasce de uma spec, no nível de rigor adequado (ver `specs/README.md`).
2. A spec descreve **comportamento** (o quê e por quê), não código. Se a regra muda durante a
   implementação, a spec é atualizada **antes** do código.
3. Cada critério de aceite (`CA-xx`) tem pelo menos um teste automatizado que leva o id no nome.
4. Mudanças entram na `main` por pull request com CI verde e aprovação do responsável.

## VII. Convenções

1. Português (pt-BR) no domínio, nas mensagens, na UI e nas specs. Commits em inglês.
2. Erros da API sempre no formato `{ error: 'mensagem em pt-BR' }`; 400 validação, 401 sem login,
   403 sem permissão, 404 não encontrado, 500 erro interno.
3. Queries sempre parametrizadas.

---

## Histórico

| Data       | Mudança                                     |
|------------|---------------------------------------------|
| 2026-11-16 | Versão inicial, extraída do `CLAUDE.md`.    |
