// Spec 001/CA-06 — permissões por rota (constituição II). Para cada rota autenticada, os perfis que NÃO têm a
// permissão recebem 403 — o `permitir()` roda antes do controller, então nada é alterado.
// O teste também falha se aparecer uma rota nova que não esteja nesta tabela: ao criar uma rota,
// declare aqui a permissão dela.

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, empresaPorCodigo, criarUsuario } = require('../helpers/contexto');
const { PERFIS, PERMISSOES } = require('../../utils/permissoes');
const router = require('../../routes');

// [método, rota, permissão] — null = qualquer usuário logado
const ROTAS = [
  ['get', '/auth/me', null],
  ['get', '/usuarios', 'usuarios.gerenciar'],
  ['put', '/usuarios/:id', 'usuarios.gerenciar'],
  ['delete', '/usuarios/:id', 'usuarios.gerenciar'],
  ['get', '/corretores/opcoes', null],
  ['get', '/corretores', 'corretores.ver'],
  ['get', '/corretores/:id', 'corretores.ver'],
  ['post', '/corretores', 'corretores.editar'],
  ['put', '/corretores/:id', 'corretores.editar'],
  ['delete', '/corretores/:id', 'corretores.editar'],
  ['get', '/apolices', 'apolices.ver'],
  ['post', '/apolices', 'apolices.criar'],
  ['put', '/apolices/:id', 'apolices.editar'],
  ['delete', '/apolices/:id', 'apolices.excluir'],
  ['get', '/comissoes', 'comissoes.ver'],
  ['put', '/comissoes/:id/recebida', 'comissoes.editar'],
  ['get', '/dashboard', 'dashboard.ver'],
  ['get', '/clientes', 'clientes.ver'],
  ['get', '/clientes/:id', 'clientes.ver'],
  ['post', '/clientes', 'clientes.criar'],
  ['put', '/clientes/:id', 'clientes.editar'],
  ['delete', '/clientes/:id', 'clientes.excluir'],
  ['get', '/seguradoras', 'seguradoras.ver'],
  ['get', '/seguradoras/:id', 'seguradoras.ver'],
  ['post', '/seguradoras', 'seguradoras.editar'],
  ['put', '/seguradoras/:id', 'seguradoras.editar'],
  ['delete', '/seguradoras/:id', 'seguradoras.editar'],
  ['get', '/seguradoras/:seguradoraId/tabelas-comissao', 'tabelas_comissao.ver'],
  ['post', '/seguradoras/:seguradoraId/tabelas-comissao', 'tabelas_comissao.editar'],
  ['put', '/tabelas-comissao/:id', 'tabelas_comissao.editar'],
  ['delete', '/tabelas-comissao/:id', 'tabelas_comissao.editar'],
  ['get', '/negociacoes', 'negociacoes.ver'],
  ['post', '/negociacoes', 'negociacoes.criar'],
  ['post', '/negociacoes/distribuir', 'negociacoes.distribuir'],
  ['put', '/negociacoes/:id', 'negociacoes.editar'],
  ['patch', '/negociacoes/:id/etapa', 'negociacoes.editar'],
  ['delete', '/negociacoes/:id', 'negociacoes.excluir'],
  ['get', '/repasses', 'repasses.ver'],
  ['post', '/repasses/gerar', 'repasses.editar'],
  ['put', '/repasses/:id/pago', 'repasses.editar'],
];

// Rotas públicas (antes do login) — não entram na checagem de 403
const PUBLICAS = ['post /auth/login', 'post /auth/registrar', 'post /leads', 'post /clientes'];

const rotasDoRouter = () =>
  router.stack
    .filter((l) => l.route)
    .flatMap((l) => Object.keys(l.route.methods).map((m) => `${m} ${l.route.path}`));

test('001/CA-06: toda rota do router está declarada nesta tabela (ou é pública)', () => {
  const declaradas = new Set([...ROTAS.map(([m, p]) => `${m} ${p}`), ...PUBLICAS]);
  const faltando = rotasDoRouter().filter((r) => !declaradas.has(r));
  assert.deepEqual(faltando, [], 'declare a permissão das rotas novas em ROTAS');
});

test('001/CA-06: toda permissão citada existe na matriz', () => {
  for (const [, , perm] of ROTAS) if (perm) assert.ok(PERMISSOES[perm], `permissão ${perm} não existe`);
});

let tokens;
before(async () => {
  const nevitta = await empresaPorCodigo('NEVITTA');
  tokens = {};
  for (const role of Object.keys(PERFIS)) {
    tokens[role] = (await criarUsuario({ empresaId: nevitta.id, role })).token;
  }
});

for (const [metodo, rota, perm] of ROTAS) {
  if (!perm) continue;
  const negados = Object.keys(PERFIS).filter((role) => !PERMISSOES[perm].includes(role));
  if (negados.length === 0) continue;

  test(`001/CA-06: ${metodo.toUpperCase()} ${rota} → 403 para ${negados.join(', ')}`, async () => {
    const url = rota.replace(/:\w+/g, '999999');
    for (const role of negados) {
      const r = await api(metodo.toUpperCase(), url, {
        token: tokens[role],
        body: ['post', 'put', 'patch'].includes(metodo) ? {} : undefined,
      });
      assert.equal(r.status, 403, `${role} deveria receber 403 em ${metodo.toUpperCase()} ${url}`);
    }
  });
}
