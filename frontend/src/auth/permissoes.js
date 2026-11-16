// Cópia da matriz de permissões do backend (backend/utils/permissoes.js) — mantenha as duas iguais.
// No front ela só esconde o que o perfil não pode usar; quem garante a regra é a API.

export const PERFIS = {
  admin: 'Administrador',
  gestor: 'Gestor do portal',
  corretor: 'Corretor',
  pos_venda: 'Pós-venda',
};

const TODOS = Object.keys(PERFIS);

const PERMISSOES = {
  'dashboard.ver': ['admin', 'gestor', 'corretor'],

  'clientes.ver': TODOS,
  'clientes.criar': ['admin', 'gestor', 'corretor'],
  'clientes.editar': ['admin', 'gestor', 'corretor'],
  'clientes.excluir': ['admin', 'gestor'],

  'negociacoes.ver': TODOS,
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

  'apolices.ver': TODOS,
  'apolices.criar': ['admin', 'gestor'],
  'apolices.editar': ['admin', 'gestor', 'pos_venda'],
  'apolices.excluir': ['admin', 'gestor'],
  'apolices.ver_comissao': ['admin', 'gestor'],

  'comissoes.ver': ['admin', 'gestor'],
  'comissoes.editar': ['admin', 'gestor'],

  'repasses.ver': ['admin', 'gestor', 'corretor'],
  'repasses.editar': ['admin', 'gestor'],

  'usuarios.gerenciar': ['admin', 'gestor'],
};

export const pode = (role, permissao) => Boolean(role && PERMISSOES[permissao]?.includes(role));
