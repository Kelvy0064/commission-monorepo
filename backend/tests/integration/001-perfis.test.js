// Spec 001 — escopo do Corretor e restrições do Pós-venda.

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  db,
  unico,
  criarEmpresa,
  criarUsuario,
  criarCorretor,
  criarCliente,
  criarSeguradora,
  criarTabelaComissao,
} = require('../helpers/contexto');

let admin;
let posVenda;
let corretor1;
let corretor2;
let cad1;
let cad2;
let cliente1;
let cliente2;
let apolice1;

before(async () => {
  const empresa = await criarEmpresa();
  cad1 = await criarCorretor({ empresaId: empresa.id, nome: 'Corretor Um' });
  cad2 = await criarCorretor({ empresaId: empresa.id, nome: 'Corretor Dois' });
  admin = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  posVenda = await criarUsuario({ empresaId: empresa.id, role: 'pos_venda' });
  corretor1 = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cad1.id });
  corretor2 = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cad2.id });

  cliente1 = await criarCliente({ empresaId: empresa.id, corretorId: cad1.id, nome: 'Cliente do Um' });
  cliente2 = await criarCliente({ empresaId: empresa.id, corretorId: cad2.id, nome: 'Cliente do Dois' });
  for (const [cliente, cad] of [[cliente1, cad1], [cliente2, cad2]]) {
    const r = await api('POST', '/negociacoes', {
      token: admin.token,
      body: { cliente_id: cliente.id, corretor_id: cad.id },
    });
    assert.equal(r.status, 201);
  }

  const seguradora = await criarSeguradora({ empresaId: empresa.id });
  const tabela = await criarTabelaComissao({ seguradoraId: seguradora.id, percentuais: [10] });
  const r = await api('POST', '/apolices', {
    token: admin.token,
    body: {
      cliente_id: cliente1.id,
      seguradora_id: seguradora.id,
      corretor_responsavel_id: cad1.id,
      numero_apolice: unico('AP'),
      tipo_seguro: 'saude',
      valor_premio_mensal: 1000,
      tabela_comissao_id: tabela.id,
      dia_vencimento: 10,
      data_inicio_vigencia: '2026-01-01',
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  apolice1 = r.body;
});

test('001/CA-07: corretor lista só os próprios clientes e negociações', async () => {
  const clientes = await api('GET', '/clientes', { token: corretor1.token });
  assert.deepEqual(clientes.body.map((c) => c.id), [cliente1.id]);

  const negociacoes = await api('GET', '/negociacoes', { token: corretor1.token });
  assert.equal(negociacoes.status, 200);
  assert.deepEqual([...new Set(negociacoes.body.map((n) => n.corretor_id))], [cad1.id]);
  assert.ok(negociacoes.body.every((n) => n.cliente_id === cliente1.id));
});

test('001/CA-07: corretor não abre cliente do colega (404)', async () => {
  assert.equal((await api('GET', `/clientes/${cliente2.id}`, { token: corretor1.token })).status, 404);
  assert.equal((await api('GET', `/clientes/${cliente1.id}`, { token: corretor1.token })).status, 200);
});

test('001/CA-07: filtro por outro corretor é ignorado para o perfil corretor', async () => {
  const r = await api('GET', `/negociacoes?corretor_id=${cad2.id}`, { token: corretor1.token });
  assert.ok(r.body.every((n) => n.corretor_id === cad1.id));
});

test('001/CA-08: cliente criado por corretor fica com ele, mesmo indicando o colega', async () => {
  const r = await api('POST', '/clientes', {
    token: corretor1.token,
    body: { nome: 'Novo do Um', corretor_id: cad2.id },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.corretor_id, cad1.id);
});

test('001/CA-09: corretor e pós-venda recebem apólices sem dados de comissão; admin recebe', async () => {
  for (const u of [corretor1, posVenda]) {
    const r = await api('GET', '/apolices', { token: u.token });
    assert.equal(r.status, 200);
    const ap = r.body.find((a) => a.id === apolice1.id);
    assert.ok(ap, 'apólice visível');
    assert.equal('percentual_comissao' in ap, false);
    assert.equal('tabela_comissao_id' in ap, false);
  }
  const r = await api('GET', '/apolices', { token: admin.token });
  assert.equal(Number(r.body.find((a) => a.id === apolice1.id).percentual_comissao), 10);
});

test('001/CA-07: corretor não vê apólice do colega', async () => {
  const r = await api('GET', '/apolices', { token: corretor2.token });
  assert.ok(!r.body.some((a) => a.id === apolice1.id));
});

test('001/CA-10: pós-venda altera só campos operacionais da apólice', async () => {
  const r = await api('PUT', `/apolices/${apolice1.id}`, {
    token: posVenda.token,
    body: { status: 'suspensa', valor_premio_mensal: 1, percentual_comissao: 99 },
  });
  assert.equal(r.status, 200);
  const ap = (await db.query('SELECT status, valor_premio_mensal, percentual_comissao FROM apolices WHERE id = $1', [apolice1.id]))
    .rows[0];
  assert.deepEqual(ap, { status: 'suspensa', valor_premio_mensal: '1000.00', percentual_comissao: '10.00' });
});
