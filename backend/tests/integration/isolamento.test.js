// Isolamento entre empresas (constituição I). Teste de fumaça da Fase 0; a cobertura completa
// por recurso vem com a spec 001 (multiempresa e perfis) na Fase 1.

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, criarEmpresa, criarUsuario, criarCorretor } = require('../helpers/contexto');

let adminA;
let adminB;
let clienteB;

before(async () => {
  const empresaA = await criarEmpresa({ nome: 'Empresa A' });
  const empresaB = await criarEmpresa({ nome: 'Empresa B' });
  adminA = await criarUsuario({ empresaId: empresaA.id, role: 'admin' });
  adminB = await criarUsuario({ empresaId: empresaB.id, role: 'admin' });

  const r = await api('POST', '/clientes', { token: adminB.token, body: { nome: 'Cliente da B' } });
  assert.equal(r.status, 201);
  clienteB = r.body;
});

test('cliente criado grava a empresa do usuário', async () => {
  assert.equal(clienteB.empresa_id, adminB.empresa_id);
});

test('empresa A não lista clientes da empresa B', async () => {
  const r = await api('GET', '/clientes', { token: adminA.token });
  assert.equal(r.status, 200);
  assert.ok(!r.body.some((c) => c.id === clienteB.id));
});

test('empresa A não abre, altera nem exclui cliente da empresa B (404)', async () => {
  const rota = `/clientes/${clienteB.id}`;
  assert.equal((await api('GET', rota, { token: adminA.token })).status, 404);
  assert.equal((await api('PUT', rota, { token: adminA.token, body: { nome: 'Invadido' } })).status, 404);
  assert.equal((await api('DELETE', rota, { token: adminA.token })).status, 404);

  const aindaLa = await api('GET', rota, { token: adminB.token });
  assert.equal(aindaLa.status, 200);
  assert.equal(aindaLa.body.nome, 'Cliente da B');
});

test('não aceita vincular cliente a corretor de outra empresa (400)', async () => {
  const corretorB = await criarCorretor({ empresaId: adminB.empresa_id });
  const r = await api('POST', '/clientes', {
    token: adminA.token,
    body: { nome: 'Cliente da A', corretor_id: corretorB.id },
  });
  assert.equal(r.status, 400);
});
