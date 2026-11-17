// Matriz de permissões por perfil. Fonte única no backend; o front tem uma cópia em
// frontend/src/auth/permissoes.js — mantenha as duas iguais.
//
// Escopo "próprio" do corretor (só os próprios clientes, negociações, apólices e repasses)
// é aplicado nos controllers via escopoCorretor(req).

const PERFIS = {
  admin: 'Administrador',
  gestor: 'Gestor do portal',
  corretor: 'Corretor',
  pos_venda: 'Pós-venda',
};

const TODOS = Object.keys(PERFIS);

const PERMISSOES = {
  'dashboard.ver': ['admin', 'gestor', 'corretor'], // corretor: só os próprios números

  'clientes.ver': TODOS, // corretor: só os próprios
  'clientes.criar': ['admin', 'gestor', 'corretor'],
  'clientes.editar': ['admin', 'gestor', 'corretor'],
  'clientes.excluir': ['admin', 'gestor'],

  'negociacoes.ver': TODOS, // corretor: só as próprias
  'negociacoes.criar': ['admin', 'gestor', 'corretor'],
  'negociacoes.editar': ['admin', 'gestor', 'corretor'],
  'negociacoes.excluir': ['admin', 'gestor'],
  'negociacoes.distribuir': ['admin', 'gestor'],

  'corretores.ver': ['admin', 'gestor'],
  'corretores.editar': ['admin', 'gestor'],

  'seguradoras.ver': ['admin', 'gestor', 'pos_venda'],
  'seguradoras.editar': ['admin'],
  'tabelas_comissao.ver': ['admin', 'gestor'],
  'tabelas_comissao.editar': ['admin'],

  'apolices.ver': TODOS, // corretor: só as próprias
  'apolices.criar': ['admin', 'gestor'],
  'apolices.editar': ['admin', 'gestor', 'pos_venda'], // pós-venda: só campos operacionais
  'apolices.excluir': ['admin', 'gestor'],
  'apolices.ver_comissao': ['admin', 'gestor'],

  'comissoes.ver': ['admin', 'gestor'],
  'comissoes.editar': ['admin', 'gestor'],

  'repasses.ver': ['admin', 'gestor', 'corretor'], // corretor: só os próprios
  'repasses.editar': ['admin', 'gestor'],

  // Estorno (spec 005): monitoramento do período; aviso de cancelamento (etapa 1);
  // conclusão, saldos dos corretores e relatório do financeiro (etapa 2)
  'monitoramento.ver': TODOS, // corretor: só os próprios; ninguém vê valores aqui
  'estornos.avisar': ['admin', 'gestor', 'pos_venda'],
  'estornos.ver': ['admin', 'gestor'],
  'estornos.editar': ['admin', 'gestor'],

  'usuarios.gerenciar': ['admin', 'gestor'], // gestor não cria/promove/edita administradores
};

// Perfis que o Gestor pode atribuir e gerenciar (aprovar, trocar perfil, bloquear).
// Administradores e outros gestores são geridos só pelo Administrador (spec 001/RN-19).
const PERFIS_DO_GESTOR = ['corretor', 'pos_venda'];

const pode = (role, permissao) => Boolean(role && PERMISSOES[permissao]?.includes(role));

// Para corretores: id do cadastro de corretor do usuário (escopo "próprio").
// Para os demais perfis: null (sem restrição por corretor).
// Corretor sem vínculo recebe -1, que não casa com nenhum registro.
const escopoCorretor = (req) => (req.user.role === 'corretor' ? req.user.corretor_id ?? -1 : null);

module.exports = { PERFIS, PERMISSOES, PERFIS_DO_GESTOR, pode, escopoCorretor };
