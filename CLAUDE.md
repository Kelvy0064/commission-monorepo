# CLAUDE.md — contexto do projeto para agentes de IA

Sistema de controle de comissões de uma corretora de planos de saúde: leads, clientes,
negociações (kanban), seguradoras e suas regras de comissão, apólices, comissões e repasses
aos corretores. Tudo em português (pt-BR): código de domínio, mensagens, UI e conversa com o usuário.

## Como trabalhar com o usuário

- Responda em **pt-BR**.
- **Commit, push e qualquer escrita em produção só com o OK explícito do usuário.** Push na `main`
  publica direto em produção (Railway). O usuário costuma pedir "faça o commit" e "faça o push"
  como passos separados, mas pode fazer o commit em seguida o push.
- Antes de gravar dados em produção (importações, cargas, exclusões): rode **simulação** primeiro,
  mostre o relatório e espere o OK. Antes de excluir, faça backup local (ver "Dados pessoais").
- **Nunca invente dados financeiros** (percentuais de comissão, prazos, dia de pagamento). Tabelas de
  comissão das operadoras não são públicas — vêm dos contratos/assessorias. Dados cadastrais públicos
  (CNPJ, registro ANS) vêm do cadastro de operadoras da ANS:
  `https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv`.
- Mudanças que alteram cálculo de dinheiro: confirme as regras de negócio com o usuário antes.

## Estrutura

```
backend/   API REST — Node.js (CommonJS), Express 4, pg (PostgreSQL), JWT, express-rate-limit
  server.js              app, CORS, trust proxy, crons
  routes/index.js        todas as rotas (públicas no topo; depois router.use(authMiddleware))
  controllers/           um por recurso
  migrations/*.sql       rodam TODAS a cada deploy (ver Migrations)
  migrations/run-migrations.js   executa os .sql em ordem + cria admin inicial
  jobs/gerarComissoesMes.js      job mensal de comissões (testável chamando a função)
  utils/comissaoParcela.js       regra de comissão por parcela (fonte única)
  utils/permissoes.js            matriz de permissões por perfil + escopoCorretor
  middleware/auth.js             valida token, carrega req.user do banco; permitir('perm')
  scripts/importar-leads.js      importação de leads (TSV) via API
frontend/  React 18 + Vite 5 + Tailwind 3 + react-router 6 + axios + lucide-react 0.294
  src/api/client.js      axios; interceptor devolve response.data; 401 → /login
  src/api/services/      um serviço por recurso
  src/context/           AuthContext (login/token, pode()), DataContext (listas carregadas após login)
  src/auth/permissoes.js cópia da matriz de permissões do backend
  src/features/<x>/      páginas por domínio (componentes, hooks, constantes locais)
  src/components/common/ Button, Modal, Card, Alert, Spinner, Pagination...
  src/components/forms/  formulários de cadastro
  src/utils/formatters.js formatDate, formatCurrency, maskTelefone...
```

## Deploy (Railway) e ambiente

- Repositório: `github.com/Kelvy0064/commission-monorepo`, branch `main` → deploy automático.
- Dois serviços no Railway, mesmo repo:
  - **backend** — Root Directory `/backend`, `npm start` = migrations + servidor.
    URL: `https://commission-backend-production-02e1.up.railway.app/api`
  - **frontend** — Root Directory `/frontend`, `npm run build` + `npm start` (`serve -s dist`, SPA).
    URL: `https://commission-monorepo-production.up.railway.app/`
- Variáveis do backend (no painel do Railway, nunca no Git): `DB_*`, `PORT`, `JWT_SECRET`,
  `JWT_EXPIRES_IN` (7d), `CORS_ORIGIN` (lista separada por vírgula, sem barra final),
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NOME`/`ADMIN_EMPRESA_CODIGO` (admin inicial),
  `LEADS_EMPRESA_CODIGO` (empresa padrão dos leads públicos). Ver `backend/.env.example`.
- Frontend: `VITE_API_URL` é embutida **no build** — mudar exige redeploy.
- O servidor do Railway roda em **UTC**.
- O agente não tem acesso ao painel nem ao CLI do Railway: o usuário configura variáveis. Para
  confirmar um deploy, compare o hash do bundle (`index-*.js` no HTML do front) e teste a API.

## Migrations

- `run-migrations.js` executa **todos** os `backend/migrations/*.sql` em ordem alfabética **a cada
  deploy**. Toda migration precisa ser **idempotente** (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
  + `ADD`, `UPDATE ... WHERE coluna IS NULL`...). Se uma falhar, o backend não sobe.
- Carga de dados que deve rodar **uma vez só**: registre na tabela `data_migrations` (padrão da
  `006_negociacoes_leads.sql`), senão ela se repete a cada deploy.
- Próximo número livre: **011**.
- Admin inicial: criado no deploy a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`, na empresa
  `ADMIN_EMPRESA_CODIGO` (padrão `NEVITTA`), se o e-mail não existir (nunca altera senha de usuário existente).

## Empresas (multiempresa) — REGRA DE OURO

- Tabela `empresas` (`nome`, `codigo` único, `ativa`). **Nevitta (`NEVITTA`) é a empresa piloto** e
  recebeu todos os dados que existiam antes da migration 010.
- `empresa_id NOT NULL` em `usuarios`, `corretores`, `seguradoras`, `clientes`, `negociacoes`,
  `apolices`, `comissoes`, `repasses`. `tabelas_comissao` pertence à empresa via `seguradora_id`.
- **Toda query de dados filtra por `req.user.empresa_id`** (SELECT, UPDATE, DELETE) e todo INSERT grava
  `empresa_id`. Ao receber ids de outras entidades (cliente, corretor, seguradora, tabela), **valide
  que pertencem à mesma empresa** — a FK sozinha aceitaria id de outra empresa.
- Unicidades são por empresa: `(empresa_id, cpf)` em corretores, `(empresa_id, cnpj)` em seguradoras,
  `(empresa_id, numero_apolice)` em apólices. E-mail de usuário é único global (um usuário, uma empresa).
- Não existe tela para criar empresas: hoje é via SQL/migration.

## Autenticação e perfis

- JWT (`POST /api/auth/login` → `{ token, user }`; `GET /api/auth/me` → `{ id, nome, email, role,
  empresa: { id, nome }, corretor_id }`). Token no `localStorage` (`auth_token`), payload só `{ id }`.
- `middleware/auth.js` busca o usuário no banco **a cada requisição** (`req.user`): bloquear um usuário,
  trocar o perfil ou desativar a empresa vale na hora (401). `permitir('perm')` → 403.
- Perfis (`usuarios.role`): `admin` (Administrador), `gestor` (Gestor do portal), `corretor`,
  `pos_venda`. `usuarios.status`: `pendente` | `ativo` | `bloqueado`. Ativo exige perfil.
- **Matriz de permissões**: `backend/utils/permissoes.js` (fonte) e cópia em
  `frontend/src/auth/permissoes.js` — **mantenha as duas iguais**. Resumo:
  - Admin: tudo. Gestor: operação completa, aprova usuários, **só lê** seguradoras e tabelas de
    comissão, **não** cria/promove/edita administradores.
  - Corretor: **só os próprios** clientes, negociações, apólices (sem dados de comissão) e repasses;
    dashboard próprio. Escopo aplicado nos controllers com `escopoCorretor(req)` (usa
    `usuarios.corretor_id`); o que ele cria fica sempre com ele.
  - Pós-venda: lê clientes, negociações e seguradoras; edita apólices **só nos campos operacionais**
    (número, status, vigência, vencimento, observações); **não vê comissões** (a API remove
    `percentual_comissao`/tabela das apólices para quem não tem `apolices.ver_comissao`).
- `GET /corretores/opcoes` (id, nome, status) é liberado a todos para selects; `GET /corretores`
  (com percentual) só Admin/Gestor.
- **Auto-cadastro**: `POST /api/auth/registrar { nome, email, senha (≥8), codigo_empresa }` cria usuário
  `pendente` (limite 5/h por IP). Admin/Gestor aprovam em **Usuários** (`GET/PUT/DELETE /api/usuarios`),
  escolhendo o perfil; perfil Corretor exige vincular um cadastro de corretor (sugerido pelo e-mail).
  DELETE só recusa pendentes; para tirar acesso, bloqueie. Ninguém altera o próprio perfil/status.
- Login de pendente/bloqueado → 403 com mensagem (só depois de acertar a senha).
- Rotas públicas: `POST /auth/login` (10/15 min), `POST /auth/registrar`, `POST /leads` (20/h) e
  `POST /clientes` **sem** Authorization (compatibilidade com a landing page `nevittaseguros.com`,
  cujo código não está neste repo) → tratado como lead. Empresa do lead: `empresa` no corpo/query
  ou `LEADS_EMPRESA_CODIGO` (padrão `NEVITTA`).
- Front: `App.jsx` só monta `DataProvider`/layout/rotas depois do login; `routes/index.jsx` só registra
  as páginas permitidas (`PAGINAS`) e o menu (`Sidebar`) filtra pelo mesmo critério. Use
  `const { pode } = useAuth()` para esconder ações; a regra de verdade é sempre a da API.

## Modelo de domínio e regras de negócio

**Clientes** (`clientes`)
- `status`: `lead` (ainda não fechou) | `ativo` | `inativo` | `cancelado`.
- `cpf_cnpj` opcional (leads chegam sem). `telefone` gravado com máscara `(00) 00000-0000`.
- `idades INTEGER[]` (idades das vidas do contrato). `data_nascimento` foi substituída na UI, mas a
  coluna existe e é preservada no update.
- `corretor_id` opcional. Campos de lead: `possui_plano`, `plano_atual`, `custo_plano_atual`,
  `investimento_pretendido`, `hospitais_preferidos`, `utm_*` (origem: `META ADS` = landing page;
  `META LEAD ADS` = formulário instantâneo do Meta).
- `data_cadastro` aceita data retroativa no create (cargas).
- `GET /clientes` **sem** `?page` devolve o array completo (usado por selects de outras telas);
  com `?page` devolve `{ data, total, page, pageSize, totalPages }` (pageSize ≤ 100).
  Busca: termo numérico compara dígitos de CPF/CNPJ e telefone; com letras, só nome/e-mail.

**Negociações** (`negociacoes`) — funil em kanban para a daily
- Etapas (ordem das colunas): `sem_contato`, `contato_feito`, `follow_up`,
  `identificacao_interesse`, `apresentacao`, `proposta_enviada`.
- `status`: `em_andamento` | `vendida` | `perdida` (`motivo_perda`).
- Próxima ação: `proxima_acao` + `proxima_acao_em` (TIMESTAMP **sem fuso, hora de Brasília**; a API
  devolve como texto `AAAA-MM-DDTHH:MM` via `to_char` para o navegador não converter).
- Lead que chega pela landing page cria cliente **e** negociação em `sem_contato` na mesma transação.
  Lead criado manualmente pelo sistema não gera negociação automática.
- `POST /negociacoes/distribuir`: divide negociações entre corretores em rodízio; cliente sem
  corretor recebe o mesmo.

**Seguradoras** (`seguradoras`) e **tabelas de comissão** (`tabelas_comissao`)
- Seguradora: dados cadastrais + `contrato_assinado`/`_em`, `regras_pagamento`, `pos_venda`.
  `dia_pagamento` e `prazo_repasse_dias` podem ser NULL ("a confirmar"); nesse caso **criar apólice
  é bloqueado** e o job mensal **pula** a apólice (data prevista sairia errada).
- Tabela de comissão (várias por seguradora): `modalidade`, `percentuais_parcelas NUMERIC[]`
  (agenciamento parcela a parcela, ex. `{100,90}`), `vitalicio_percentual` (a partir da parcela
  seguinte à última da lista) por `vitalicio_meses` (NULL = enquanto ativo), `estorno_meses`,
  vigência, `ativa`. Percentual máx. **999,99** (cabe em `DECIMAL(5,2)`).
- `estorno_meses` e a vigência são **apenas registrados** — ainda não entram em nenhum cálculo.

**Apólices, comissões e repasses** — regra central (`utils/comissaoParcela.js`)
- Apólice usa uma tabela de comissão (`tabela_comissao_id`) **ou** percentual fixo
  (`percentual_comissao`). Com tabela, `percentual_comissao` guarda o % da 1ª parcela (referência).
- Comissão tem `numero_parcela` e `tipo` (`agenciamento` | `vitalicio` | `fixa`).
  - Criar apólice gera a **parcela 1** na competência atual.
  - O job mensal (`jobs/gerarComissoesMes.js`, cron dia 1 00:00) gera a **próxima parcela** de cada
    apólice ativa (idempotente por competência). Quando a tabela acaba, para de gerar.
  - Sem tabela: percentual fixo todo mês.
  - Data prevista = dia de pagamento da seguradora no mês + prazo de repasse.
- **Repasse ao corretor só da 1ª parcela**: `percentual_comissao` do **cadastro do corretor** sobre o
  **valor efetivamente recebido** (`valor_comissao_liquido`). Demais parcelas ficam com a corretora.
  `POST /repasses/gerar` é idempotente.
- `pagamentos_seguradora` existe no schema mas não é usada.

## Convenções de código

- API: erros sempre `{ error: 'mensagem em pt-BR' }`; 400 para validação, 401 sem token, 404, 500.
  Validar e normalizar no controller (strings vazias → NULL). Queries sempre parametrizadas;
  em `LIKE`, escapar `%`, `_` e `\`.
- Transações com `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` + `release()` quando há mais de uma escrita.
- Datas `DATE` chegam ao front como `...T00:00:00.000Z`: use `formatDate` (usa a parte da data, sem
  converter fuso — senão aparece um dia antes no Brasil). Não use `new Date(data)` para exibir.
- Front: Tailwind direto nos componentes; ícones de `lucide-react` 0.294 (confira se o ícone existe
  nessa versão); inputs controlados recebem `''` em vez de `null`; telefone com `maskTelefone`.
- Commits em inglês, com corpo explicando o porquê.

## Importação de leads (cargas retroativas)

`backend/scripts/importar-leads.js` — reconhece pelo cabeçalho dois formatos: exportação da
landing page (TSV) e do Meta Lead Ads (TSV com campos entre aspas e quebras de linha).

```bash
cd backend
node scripts/importar-leads.js "<arquivo>" --offline                 # só lê e valida o arquivo
API_TOKEN=<token> node scripts/importar-leads.js "<arquivo>" --api <URL da API>             # simulação
API_TOKEN=<token> node scripts/importar-leads.js "<arquivo>" --api <URL da API> --executar   # grava
```

- Simulação por padrão. Descarta testes, unifica por telefone (dado mais recente, nome mais
  completo, data do 1º contato), **pula telefones já cadastrados** (pode rodar de novo), cria cada
  lead com negociação em "Sem contato" e lista idades em texto livre para conferência.
- Faixas como "60 anos ou mais" / "51+" entram sem idade (não são idades).
- Token: no navegador logado, `localStorage.getItem('auth_token')`. Nunca grave o token em arquivo.

## Dados pessoais

- Exportações de leads/clientes têm nome, telefone e dados de saúde: **nunca versionar**.
  O `.gitignore` cobre `*.tsv`, `*retroativo*.txt` e `backend/imports/` (use essa pasta para
  arquivos de carga e backups locais).
- Não coloque nomes, telefones, e-mails ou tokens em commits, logs, CLAUDE.md ou serviços externos.

## Como testar (não há suíte de testes automatizados)

- Front: `cd frontend && npm run build` (o ESLint do projeto está quebrado: `eslint.config.js` é do
  ESLint 9, mas o instalado é o 8 — problema pré-existente).
- Back: suba um **PostgreSQL descartável** e rode a API de verdade contra ele. No Windows deste
  projeto há PostgreSQL 18 em `C:\Program Files\PostgreSQL\18\bin`:
  ```bash
  initdb -D <pasta-temp> -U postgres -A trust -E UTF8
  pg_ctl -D <pasta-temp> -o "-p 5499" -w start && createdb -h localhost -p 5499 -U postgres commission_test
  # simular produção: aplicar as migrations do HEAD antes das novas
  git show HEAD:backend/migrations/001_create_tables.sql | psql -h localhost -p 5499 -U postgres -d commission_test
  TZ=UTC DB_HOST=localhost DB_PORT=5499 DB_NAME=commission_test DB_USER=postgres DB_PASSWORD=x \
    PORT=3999 JWT_SECRET=teste ADMIN_EMAIL=a@t.com ADMIN_PASSWORD=senha-forte-123 npm start
  ```
  Teste o fluxo completo com `curl` (login → token → chamadas) e o job mensal chamando
  `require('./jobs/gerarComissoesMes')(new Date('2027-01-01T12:00:00'))`. Ao final, pare e apague o cluster.
- Armadilhas no Git Bash do Windows:
  - acentos passados como argumento para binários Windows (`psql -c`, `curl -d`) chegam
    corrompidos → use arquivos (`psql -f`) ou um script Node;
  - saída de `psql -t -A` termina em `\r` → `| tr -d '\r'` antes de usar em URLs;
  - `fetch` do Node exige URL com `http://`.

## Pendências conhecidas

1. Sem tela para criar empresas, sem "esqueci minha senha" e sem troca de senha pelo usuário.
2. Preencher `dia_pagamento`, `prazo_repasse_dias` e tabelas de comissão das seguradoras a partir
   dos contratos (hoje só existem os dados públicos da ANS).
3. Estorno e vigência das tabelas não são aplicados no cálculo.
4. `repassesController.relatorioPorCorretor` não está roteado nem filtra por empresa.
5. CORS: se a landing page enviar leads direto do navegador, o domínio dela precisa estar em `CORS_ORIGIN`.
