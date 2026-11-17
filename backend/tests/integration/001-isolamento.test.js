// Spec 001 — isolamento entre empresas (constituição I).

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, criarEmpresa, criarUsuario, criarCorretor, unico } = require('../helpers/contexto');

let adminA;
let adminB;
let clienteB;

before(async () => {
  const empresaA = await criarEmpresa({ nome: 'Empresa A' });
  const empresaB = await criarEmpresa({ nome: 'Empresa B' });
  adminA = await criarUsuario({ empresaId: empresaA.id, role: 'admin' });
  adminB = await criarUsuario({ empresaId: empresaB.id, role: 'admin' });

  // empresa_id no corpo é ignorado (RN-02)
  const r = await api('POST', '/clientes', {
    token: adminB.token,
    body: { nome: 'Cliente da B', empresa_id: empresaA.id },
  });
  assert.equal(r.status, 201);
  clienteB = r.body;
});

test('001/CA-03: cliente criado pertence à empresa do usuário, mesmo enviando outra', async () => {
  assert.equal(clienteB.empresa_id, adminB.empresa_id);
});

test('001/CA-01: empresa A não lista clientes da empresa B', async () => {
  const r = await api('GET', '/clientes', { token: adminA.token });
  assert.equal(r.status, 200);
  assert.ok(!r.body.some((c) => c.id === clienteB.id));

  const paginado = await api('GET', '/clientes?page=1', { token: adminA.token });
  assert.ok(!paginado.body.data.some((c) => c.id === clienteB.id));
});

test('001/CA-02: empresa A não abre, altera nem exclui cliente da empresa B (404)', async () => {
  const rota = `/clientes/${clienteB.id}`;
  assert.equal((await api('GET', rota, { token: adminA.token })).status, 404);
  assert.equal((await api('PUT', rota, { token: adminA.token, body: { nome: 'Invadido' } })).status, 404);
  assert.equal((await api('DELETE', rota, { token: adminA.token })).status, 404);

  const aindaLa = await api('GET', rota, { token: adminB.token });
  assert.equal(aindaLa.status, 200);
  assert.equal(aindaLa.body.nome, 'Cliente da B');
});

test('001/CA-04: não aceita vincular cliente a corretor de outra empresa (400)', async () => {
  const corretorB = await criarCorretor({ empresaId: adminB.empresa_id });
  const r = await api('POST', '/clientes', {
    token: adminA.token,
    body: { nome: 'Cliente da A', corretor_id: corretorB.id },
  });
  assert.equal(r.status, 400);
});

test('001/CA-04: não aceita negociação com cliente de outra empresa (400)', async () => {
  const r = await api('POST', '/negociacoes', { token: adminA.token, body: { cliente_id: clienteB.id } });
  assert.equal(r.status, 400);
});

test('001/CA-05: mesmo CPF de corretor em empresas diferentes é aceito; repetido na mesma empresa, não', async () => {
  const cpf = unico('').slice(-11).padStart(11, '0');
  const corpo = { nome: 'Corretor CPF', cpf, tipo: 'comissionado', percentual_comissao: 30 };
  assert.equal((await api('POST', '/corretores', { token: adminA.token, body: corpo })).status, 201);
  assert.equal((await api('POST', '/corretores', { token: adminB.token, body: corpo })).status, 201);
  assert.equal((await api('POST', '/corretores', { token: adminA.token, body: corpo })).status, 400);
});
