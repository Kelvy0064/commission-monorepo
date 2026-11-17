# 001 — Multiempresa, perfis de acesso e auto-cadastro

- **Status:** implementada (spec retroativa revisada com o responsável em 2026-11-16)
- **Rigor:** completa (permissões e dados pessoais)
- **Responsável pela aprovação:** responsável pelo produto (Nevitta)
- **Datas:** criada em 2026-11-16 (funcionalidade publicada antes, no commit `a2db28d`)

## Problema

O sistema guarda leads com dados de saúde, contratos e valores de comissão. Sem separação, qualquer
usuário veria tudo — inclusive corretores vendo a base de leads inteira e os números da corretora — e
não seria possível atender outra corretora no mesmo sistema.

## Objetivo

- Cada empresa (corretora) vê **só os próprios dados**. A Nevitta é a empresa piloto.
- Cada pessoa vê e faz só o que o **perfil** permite.
- Novos usuários se cadastram sozinhos e só entram depois de aprovados.

## Quem usa

| Perfil                | O que pode |
|-----------------------|------------|
| Administrador         | Tudo na própria empresa, inclusive seguradoras, tabelas de comissão e administradores. |
| Gestor do portal      | Operação completa; aprova e bloqueia **só** usuários Corretor e Pós-venda; **só lê** seguradoras e tabelas. |
| Corretor              | Só os **próprios** clientes, negociações, apólices (sem dados de comissão) e repasses; painel próprio. |
| Pós-venda             | Lê clientes, negociações e seguradoras; edita só os **campos operacionais** das apólices; não vê comissões. |

A matriz completa, permissão por permissão, está em `backend/utils/permissoes.js` (fonte única).

## Histórias de usuário

- Como **administrador**, quero que outra corretora no sistema nunca veja meus leads e números.
- Como **gestor**, quero aprovar quem pede acesso e escolher o perfil de cada um.
- Como **corretor**, quero ver só a minha carteira, sem a dos colegas.
- Como **pós-venda**, quero atualizar a situação das apólices sem ver quanto a corretora ganha.

## Regras de negócio

**Empresas**
- **RN-01** — Todo dado de negócio pertence a uma empresa. O usuário só lista, abre, altera e exclui
  dados da própria empresa; registro de outra empresa responde como **inexistente** (404).
- **RN-02** — Ao criar um registro, a empresa é sempre a do usuário (nunca a enviada pelo cliente).
- **RN-03** — Ids de outras entidades informados num cadastro (corretor, cliente, seguradora, tabela)
  precisam ser da mesma empresa; senão, 400.
- **RN-04** — Unicidades são por empresa: o mesmo CPF de corretor, CNPJ de seguradora ou número de
  apólice pode existir em empresas diferentes. O e-mail de usuário é único no sistema todo.
- **RN-05** — Empresa desativada: nenhum usuário dela acessa o sistema.

**Perfis**
- **RN-06** — Cada rota exige uma permissão da matriz; sem ela, **403**.
- **RN-07** — Corretor só vê os registros ligados ao **próprio** cadastro de corretor; registro de
  outro corretor responde como inexistente (404). O que ele cria fica sempre com ele, mesmo que
  indique outro corretor.
- **RN-08** — Corretor e pós-venda recebem apólices **sem** percentual e tabela de comissão.
- **RN-09** — Pós-venda altera só número, status, vigência, dia de vencimento e observações da
  apólice; os demais campos enviados são ignorados.
- **RN-10** — O perfil e a situação do usuário são conferidos a **cada requisição**: bloquear, trocar
  o perfil ou desativar a empresa vale na hora, mesmo com token válido (401).

**Login e auto-cadastro**
- **RN-11** — Senha errada ou e-mail inexistente → 401 com a mesma mensagem genérica. A resposta
  nunca traz o hash da senha.
- **RN-12** — Cadastro pendente ou bloqueado → 403 com mensagem explicativa, **só depois** de a senha
  estar certa (não revela a situação a quem não sabe a senha).
- **RN-13** — Auto-cadastro pede nome, e-mail válido, senha com 8+ caracteres e o **código da empresa**
  (ativa). Nasce `pendente`, sem perfil. E-mail já usado → 409.
- **RN-14** — Limites por IP: login 10 tentativas a cada 15 min; auto-cadastro 5 por hora.
- **RN-15** — No deploy, o administrador inicial é criado a partir das variáveis de ambiente, se o
  e-mail ainda não existir (nunca altera usuário existente).

**Aprovação de usuários** (Administrador e Gestor)
- **RN-16** — Ativar exige escolher um perfil. Não é possível voltar alguém para `pendente`.
- **RN-17** — Perfil Corretor exige vincular um cadastro de corretor **da mesma empresa** e que não
  esteja ligado a outro usuário. A lista de usuários sugere o cadastro de corretor com o mesmo e-mail.
- **RN-18** — Ninguém altera o próprio perfil ou situação.
- **RN-19** — Gestor só gerencia usuários **Corretor e Pós-venda** (D1): só atribui esses perfis e só
  aprova, altera ou bloqueia quem é pendente, Corretor ou Pós-venda. Administradores e gestores são
  geridos só pelo Administrador (403 para o Gestor).
- **RN-20** — Excluir serve só para **recusar** cadastros pendentes; para tirar o acesso de quem já
  foi aprovado, bloqueia-se.
- **RN-21** — Usuário Corretor cujo **cadastro de corretor está inativo** perde o acesso na hora (401;
  no login, 403). Os repasses dele continuam (spec 002/RN-21) e ficam com Administrador e Gestor (D2).

## Critérios de aceite

- **CA-01** — **Dado** um cliente da empresa B, **quando** um usuário da empresa A lista clientes,
  **então** o cliente de B não aparece.
- **CA-02** — **Dado** um cliente da empresa B, **quando** um usuário de A tenta abrir, alterar ou
  excluir, **então** recebe 404 e o cliente continua intacto.
- **CA-03** — **Quando** um usuário cria um cliente, **então** o cliente pertence à empresa do usuário.
- **CA-04** — **Quando** um usuário de A vincula um cliente a um corretor de B, **então** recebe 400.
- **CA-05** — **Quando** duas empresas cadastram um corretor com o mesmo CPF, **então** os dois são
  aceitos; **quando** a mesma empresa repete o CPF, **então** recebe erro.
- **CA-06** — **Para cada** rota autenticada, perfis sem a permissão recebem 403; e toda rota do
  sistema tem a permissão declarada no teste.
- **CA-07** — **Dado** clientes e negociações de dois corretores, **quando** um corretor lista,
  **então** vê só os próprios; **quando** abre um cliente do colega, **então** recebe 404.
- **CA-08** — **Quando** um corretor cria um cliente indicando o colega como corretor, **então** o
  cliente fica com ele mesmo.
- **CA-09** — **Quando** corretor e pós-venda listam apólices, **então** não recebem percentual nem
  tabela de comissão; **e** o administrador recebe.
- **CA-10** — **Quando** o pós-venda altera o status e o valor de uma apólice, **então** só o status muda.
- **CA-11** — **Dado** um usuário com token válido, **quando** ele é bloqueado ou a empresa é
  desativada, **então** a próxima requisição recebe 401.
- **CA-12** — Login: senha certa → token e usuário sem hash; senha errada → 401; pendente com senha
  certa → 403.
- **CA-13** — Auto-cadastro: dados válidos → 201 e usuário `pendente` sem perfil; código de empresa
  inválido → 400; senha com menos de 8 → 400; e-mail repetido → 409.
- **CA-14** — Aprovação: ativar sem perfil → 400; perfil Corretor sem cadastro de corretor → 400;
  com corretor de outra empresa → 400; com corretor já vinculado a outro usuário → 400; válido →
  ativo e acessa o sistema.
- **CA-15** — **Quando** um gestor tenta atribuir o perfil Administrador ou Gestor, ou alterar/bloquear
  um administrador ou outro gestor, **então** recebe 403; **e** um administrador consegue; **e** o
  gestor bloqueia corretores e pós-venda normalmente.
- **CA-16** — **Quando** alguém tenta alterar o próprio perfil ou situação, **então** recebe 400.
- **CA-17** — **Quando** se tenta excluir um usuário ativo, **então** recebe 400; **e** excluir um
  pendente funciona.
- **CA-18** — **Dado** o deploy com as variáveis do administrador inicial, **então** existe um admin
  ativo na empresa indicada.
- **CA-20** — **Dado** um corretor com acesso, **quando** o cadastro de corretor dele fica inativo,
  **então** o token dele passa a receber 401 e o login, 403.
- **CA-19** — **Quando** a lista de usuários é aberta, **então** só aparecem usuários da própria empresa
  e o pendente com e-mail igual ao de um corretor livre vem com a sugestão desse corretor.

## Permissões e isolamento

É o assunto desta spec. Fonte: `backend/utils/permissoes.js`; cópia no front verificada por teste.

## Dados sensíveis (LGPD)

Usuários: nome, e-mail e hash de senha. O isolamento protege os dados de saúde dos leads (spec 003).

## Fora do escopo

- Tela para criar empresas (hoje via SQL/migration).
- "Esqueci minha senha" e troca de senha pelo usuário.
- Um usuário em mais de uma empresa.

## Decisões

| Id | Data       | Decisão |
|----|------------|---------|
| D1 | 2026-11-16 | Gestor gerencia só usuários Corretor e Pós-venda (antes podia gerir outros gestores). |
| D2 | 2026-11-16 | Corretor inativo perde o acesso; o Gestor passa a acompanhar as comissões e repasses dele. |

## Perguntas em aberto

- [ ] **P2** — Avisar os administradores (e-mail, notificação) quando há cadastro pendente?
