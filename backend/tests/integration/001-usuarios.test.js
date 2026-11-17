// Spec 001 — aprovação e gestão de usuários (Administrador e Gestor).

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, unico, criarEmpresa, criarUsuario, criarCorretor } = require('../helpers/contexto');

let empresa;
let admin;
let gestor;

before(async () => {
  empresa = await criarEmpresa();
  admin = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  gestor = await criarUsuario({ empresaId: empresa.id, role: 'gestor' });
});

const pendente = () => criarUsuario({ empresaId: empresa.id, role: null, status: 'pendente' });
const aprovar = (quem, alvo, body) => api('PUT', `/usuarios/${alvo.id}`, { token: quem.token, body });

test('001/CA-14: ativar sem perfil → 400', async () => {
  assert.equal((await aprovar(gestor, await pendente(), { status: 'ativo' })).status, 400);
});

test('001/CA-14: perfil Corretor exige cadastro de corretor da mesma empresa e livre', async () => {
  const p = await pendente();
  assert.equal((await aprovar(gestor, p, { status: 'ativo', role: 'corretor' })).status, 400);

  const outraEmpresa = await criarEmpresa();
  const deFora = await criarCorretor({ empresaId: outraEmpresa.id });
  assert.equal((await aprovar(gestor, p, { status: 'ativo', role: 'corretor', corretor_id: deFora.id })).status, 400);

  const jaVinculado = await criarCorretor({ empresaId: empresa.id });
  await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: jaVinculado.id });
  assert.equal((await aprovar(gestor, p, { status: 'ativo', role: 'corretor', corretor_id: jaVinculado.id })).status, 400);
});

test('001/CA-14: aprovação válida ativa o usuário e ele acessa o sistema', async () => {
  const p = await pendente();
  const livre = await criarCorretor({ empresaId: empresa.id });
  const r = await aprovar(gestor, p, { status: 'ativo', role: 'corretor', corretor_id: livre.id });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.status, r.body.role, r.body.corretor_id], ['ativo', 'corretor', livre.id]);
  assert.equal((await api('GET', '/auth/me', { token: p.token })).status, 200);
});

test('001/CA-15: gestor não atribui os perfis Administrador nem Gestor (403); admin consegue', async () => {
  const p = await pendente();
  assert.equal((await aprovar(gestor, p, { status: 'ativo', role: 'admin' })).status, 403);
  assert.equal((await aprovar(gestor, p, { status: 'ativo', role: 'gestor' })).status, 403);
  assert.equal((await aprovar(admin, p, { status: 'ativo', role: 'gestor' })).status, 200);
});

test('001/CA-15: gestor não bloqueia nem altera administrador ou outro gestor (403); admin consegue', async () => {
  const outroAdmin = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  const outroGestor = await criarUsuario({ empresaId: empresa.id, role: 'gestor' });
  assert.equal((await aprovar(gestor, outroAdmin, { status: 'bloqueado', role: 'admin' })).status, 403);
  assert.equal((await aprovar(gestor, outroGestor, { status: 'bloqueado', role: 'gestor' })).status, 403);
  assert.equal((await aprovar(gestor, outroGestor, { status: 'ativo', role: 'pos_venda' })).status, 403);
  assert.equal((await aprovar(admin, outroGestor, { status: 'bloqueado', role: 'gestor' })).status, 200);
});

test('001/CA-15: gestor bloqueia corretor e pós-venda', async () => {
  const cadastro = await criarCorretor({ empresaId: empresa.id });
  const corretor = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cadastro.id });
  const posVenda = await criarUsuario({ empresaId: empresa.id, role: 'pos_venda' });
  assert.equal((await aprovar(gestor, corretor, { status: 'bloqueado', role: 'corretor', corretor_id: cadastro.id })).status, 200);
  assert.equal((await aprovar(gestor, posVenda, { status: 'bloqueado', role: 'pos_venda' })).status, 200);
  assert.equal((await api('GET', '/auth/me', { token: posVenda.token })).status, 401);
});

test('001/CA-16: ninguém altera o próprio perfil ou situação (400)', async () => {
  assert.equal((await aprovar(gestor, gestor, { status: 'ativo', role: 'admin' })).status, 400);
  assert.equal((await aprovar(admin, admin, { status: 'bloqueado', role: 'admin' })).status, 400);
});

test('001/CA-16 (RN-16): não é possível voltar alguém para pendente', async () => {
  const u = await criarUsuario({ empresaId: empresa.id, role: 'pos_venda' });
  assert.equal((await aprovar(gestor, u, { status: 'pendente', role: 'pos_venda' })).status, 400);
});

test('001/CA-17: excluir só recusa pendentes', async () => {
  const ativo = await criarUsuario({ empresaId: empresa.id, role: 'pos_venda' });
  assert.equal((await api('DELETE', `/usuarios/${ativo.id}`, { token: gestor.token })).status, 400);

  const p = await pendente();
  assert.equal((await api('DELETE', `/usuarios/${p.id}`, { token: gestor.token })).status, 200);
  assert.equal((await db.query('SELECT 1 FROM usuarios WHERE id = $1', [p.id])).rows.length, 0);
});

test('001/CA-19: lista só usuários da própria empresa e sugere o corretor com o mesmo e-mail', async () => {
  const email = `${unico('sug')}@teste.local`;
  const corretor = (
    await db.query(
      `INSERT INTO corretores (nome, cpf, email, tipo, percentual_comissao, empresa_id)
       VALUES ('Corretor Sugerido', $1, $2, 'comissionado', 30, $3) RETURNING id`,
      [unico('').slice(-11).padStart(11, '0'), email.toUpperCase(), empresa.id]
    )
  ).rows[0];
  const p = await criarUsuario({ empresaId: empresa.id, role: null, status: 'pendente', email });
  const outraEmpresa = await criarEmpresa();
  const deFora = await criarUsuario({ empresaId: outraEmpresa.id, role: 'admin' });

  const r = await api('GET', '/usuarios', { token: gestor.token });
  assert.equal(r.status, 200);
  const daEmpresa = (await db.query('SELECT id FROM usuarios WHERE empresa_id = $1', [empresa.id])).rows.map((u) => u.id);
  assert.deepEqual(r.body.map((u) => u.id).sort((a, b) => a - b), daEmpresa.sort((a, b) => a - b));
  assert.ok(!r.body.some((u) => u.id === deFora.id));
  assert.equal(r.body.find((u) => u.id === p.id).corretor_sugerido_id, corretor.id);
});
