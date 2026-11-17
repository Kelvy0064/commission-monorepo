# NNN — Plano técnico

- **Spec:** [spec.md](spec.md) (precisa estar `aprovada`)
- **Status:** rascunho | aprovado

## Resumo da abordagem

Em poucas linhas: como a spec será atendida.

## Banco de dados

- Migration `NNN_nome.sql` (idempotente — roda a cada deploy):
- Carga única? Registrar em `data_migrations`.
- Índices e unicidades (sempre por empresa):

## API

| Método | Rota | Permissão | Regras atendidas | Observações |
|--------|------|-----------|------------------|-------------|
|        |      |           |                  |             |

- Erros: `{ error }` em pt-BR (400/401/403/404).
- Filtro por `empresa_id` e validação de ids de outras entidades:

## Frontend

- Telas e componentes:
- Permissões usadas (`pode(...)`):

## Testes

| Critério | Tipo (integração / unitário / front) | Arquivo |
|----------|--------------------------------------|---------|
| CA-01    |                                      |         |

## Riscos e alternativas

-

## Rollout em produção

- Ordem do deploy, cargas de dados (simulação → relatório → OK), backup antes de excluir.
- Variáveis de ambiente novas (o responsável configura no Railway):
- Como verificar depois do deploy:
