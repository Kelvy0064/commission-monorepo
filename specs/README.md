# Specs — como trabalhamos (Spec-Driven Development)

Toda mudança nasce de uma **especificação aprovada**. A spec é o contrato que o código e os testes
precisam cumprir. Regras inegociáveis: [`constitution.md`](constitution.md).

## Estrutura

```
specs/
  constitution.md          princípios inegociáveis
  README.md                este arquivo
  _templates/              spec.md, plan.md, tasks.md
  NNN-nome-curto/          uma pasta por funcionalidade
    spec.md                o quê e por quê (aprovada pelo responsável)
    plan.md                como (aprovado antes de implementar)
    tasks.md               checklist de implementação
```

A numeração é sequencial (`001`, `002`...) e independente da numeração das migrations.

## Índice

| Spec | Assunto | Status |
|------|---------|--------|
| [001](001-multiempresa-perfis/spec.md) | Multiempresa, perfis de acesso e auto-cadastro | implementada (retroativa, revisada em 2026-11-16) |
| [002](002-comissao-por-parcela/spec.md) | Comissão por parcela e repasse ao corretor | implementada (retroativa, revisada em 2026-11-16) |
| 003 | Entrada de leads (landing page, Meta) e importação | a escrever (Fase 1) |
| [004](004-negociacoes-kanban/spec.md) | Negociações: kanban, follow-up e distribuição | rascunho (regras a escrever — Fase 1) |
| [005](005-estorno/spec.md) | Estorno: monitoramento, cancelamento e saldos | implementada (v2) |

## Personas (perfis do sistema)

Use estas descrições na seção "Quem usa" de cada spec.

| Perfil        | Quem é | Acesso (resumo — matriz em `backend/utils/permissoes.js`) |
|---------------|--------|-----------------------------------------------------------|
| Administrador | Suporte de TI da empresa. | Tudo na própria empresa. |
| Gestor        | COO e cargos de gestão: financeiro, gestor, coordenador. | Operação completa; gerencia só usuários Corretor e Pós-venda; só lê seguradoras e tabelas. |
| Corretor      | Vendedores. | Só os **próprios** resultados: clientes, negociações, apólices (sem comissão), repasses e saldo. |
| Pós-venda     | Acompanha o cliente depois da venda. **Funcionalidades próprias ainda a criar.** | Lê clientes e negociações; campos operacionais da apólice; monitoramento do período de estorno (spec 005); não vê comissões. |

## Fluxo

1. **Spec** — o pedido vira `spec.md` a partir do template. Dúvidas viram perguntas na seção
   "Perguntas em aberto", nunca suposições. Status `rascunho` → `aprovada` com o OK do responsável.
2. **Plano** — `plan.md`: migrations, rotas, telas, riscos, rollout. Aprovado antes do código.
3. **Tarefas** — `tasks.md`: cada tarefa aponta os `CA-xx` que cumpre.
4. **Implementação** — numa branch; a tarefa só fecha quando os testes dos `CA-xx` dela passam.
5. **Pull request** — link da spec, CI verde e aprovação do responsável antes do merge na `main`
   (o merge publica em produção).

## Níveis de rigor

| Tipo de mudança                                                      | O que é exigido                          |
|----------------------------------------------------------------------|------------------------------------------|
| Funcionalidade nova, ou mudança em dinheiro, permissão ou dado pessoal | spec completa + plano + tarefas + testes |
| Ajuste de tela ou de texto                                           | spec curta (problema, regra, critério)   |
| Correção de bug                                                      | teste que reproduz o bug + correção      |

## Rastreabilidade

- Regras de negócio: `RN-01`, `RN-02`... Critérios de aceite: `CA-01`, `CA-02`...
- Os ids são locais à spec. Fora dela, cite com o número da spec: `001/CA-07`.
- Todo teste de um critério leva o id no nome:
  `test('001/CA-07: corretor não vê cliente de outro corretor', ...)`.
- Para achar o teste de um critério: `grep -r "001/CA-07" backend/tests frontend/tests`.

## Definição de pronto

- [ ] Spec atualizada com o comportamento final (status `implementada`).
- [ ] Todos os `CA-xx` com teste automatizado passando.
- [ ] CI verde (`backend: npm test`, `frontend: npm test` e `npm run build`).
- [ ] `CLAUDE.md` atualizado se mudou contexto, deploy ou armadilha conhecida.
- [ ] Aprovação do responsável no pull request.

## Testes

- **Backend** (`cd backend && npm test`): sobe um PostgreSQL descartável, aplica as migrations duas
  vezes (garante idempotência), sobe a API e roda `backend/tests/**/*.test.js` com `node:test`.
  - Localmente usa o `initdb` do PostgreSQL instalado (`PG_BIN` para indicar a pasta, se não
    estiver no `PATH`).
  - No CI usa o serviço PostgreSQL do GitHub Actions (variáveis `TEST_DB_*`).
  - `npm run test:unit` roda só os testes que não precisam de banco.
- **Frontend** (`cd frontend && npm test`): funções puras e a paridade da matriz de permissões.
