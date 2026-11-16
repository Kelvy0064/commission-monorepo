// Autenticação: login, token e situação do usuário.
// O login tem limite de 10 tentativas por IP a cada 15 min — este arquivo usa poucas.
// Os demais testes geram o token direto (helpers/contexto.js → tokenDe).

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, empresaPorCodigo, criarUsuario, criarEmpresa, tokenDe } = require('../helpers/contexto');

let nevitta;
before(async () => {
  nevitta = await empresaPorCodigo('NEVITTA');
});

test('a API responde na raiz', async () => {
  const r = await fetch(process.env.API_URL.replace(/\/api$/, '/'));
  assert.equal(r.status, 200);
});

test('migrations criam a empresa piloto e o admin inicial a partir das variáveis ADMIN_*', async () => {
  assert.ok(nevitta, 'empresa NEVITTA existe');
  const admin = (await db.query('SELECT role, status, empresa_id FROM usuarios WHERE email = $1', [process.env.ADMIN_EMAIL]))
    .rows[0];
  assert.deepEqual(admin, { role: 'admin', status: 'ativo', empresa_id: nevitta.id });
});

test('login com senha correta devolve token e usuário sem o hash da senha', async () => {
  const r = await api('POST', '/auth/login', {
    body: { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_PASSWORD },
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.user.role, 'admin');
  assert.equal(r.body.user.senha_hash, undefined);

  const me = await api('GET', '/auth/me', { token: r.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.empresa.id, nevitta.id);
});

test('login com senha errada → 401 com mensagem genérica', async () => {
  const r = await api('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, senha: 'errada-errada' } });
  assert.equal(r.status, 401);
  assert.ok(r.body.error);
});

test('login de usuário pendente → 403 (só depois de acertar a senha)', async () => {
  const u = await criarUsuario({ empresaId: nevitta.id, role: null, status: 'pendente' });
  const r = await api('POST', '/auth/login', { body: { email: u.email, senha: u.senha } });
  assert.equal(r.status, 403);
});

test('rota protegida sem token → 401; com token inválido → 401', async () => {
  assert.equal((await api('GET', '/clientes')).status, 401);
  assert.equal((await api('GET', '/clientes', { token: 'nao-e-um-jwt' })).status, 401);
});

test('bloquear o usuário vale na hora, mesmo com token ainda válido', async () => {
  const u = await criarUsuario({ empresaId: nevitta.id, role: 'gestor' });
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 200);
  await db.query(`UPDATE usuarios SET status = 'bloqueado' WHERE id = $1`, [u.id]);
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 401);
});

test('empresa desativada derruba o acesso dos seus usuários', async () => {
  const empresa = await criarEmpresa({ ativa: true });
  const u = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 200);
  await db.query('UPDATE empresas SET ativa = false WHERE id = $1', [empresa.id]);
  assert.equal((await api('GET', '/auth/me', { token: tokenDe(u.id) })).status, 401);
});
