// Spec 001 — login, auto-cadastro e revalidação do acesso a cada requisição.
// Limites por IP: login 10/15 min e auto-cadastro 5/h. Este arquivo usa 5 logins e 4 cadastros;
// os demais testes geram o token direto (helpers/contexto.js → tokenDe).

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, empresaPorCodigo, criarUsuario, criarEmpresa, criarCorretor, tokenDe, unico } = require('../helpers/contexto');

let nevitta;
before(async () => {
  nevitta = await empresaPorCodigo('NEVITTA');
});

test('a API responde na raiz', async () => {
  const r = await fetch(process.env.API_URL.replace(/\/api$/, '/'));
  assert.equal(r.status, 200);
});

test('001/CA-18: deploy cria o admin inicial, ativo, na empresa das variáveis ADMIN_*', async () => {
  assert.ok(nevitta, 'empresa NEVITTA existe');
  const admin = (await db.query('SELECT role, status, empresa_id FROM usuarios WHERE email = $1', [process.env.ADMIN_EMAIL]))
    .rows[0];
  assert.deepEqual(admin, { role: 'admin', status: 'ativo', empresa_id: nevitta.id });
});

test('001/CA-12: senha certa → token e usuário sem o hash da senha', async () => {
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

test('001/CA-12: senha errada e e-mail inexistente → 401 com a mesma mensagem', async () => {
  const errada = await api('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, senha: 'errada-errada' } });
  const inexistente = await api('POST', '/auth/login', { body: { email: 'ninguem@teste.local', senha: 'errada-errada' } });
  assert.equal(errada.status, 401);
  assert.equal(inexistente.status, 401);
  assert.equal(errada.body.error, inexistente.body.error);
});

test('001/CA-12: pendente com senha certa → 403', async () => {
  const u = await criarUsuario({ empresaId: nevitta.id, role: null, status: 'pendente' });
  const r = await api('POST', '/auth/login', { body: { email: u.email, senha: u.senha } });
  assert.equal(r.status, 403);
});

test('rota protegida sem token ou com token inválido → 401', async () => {
  assert.equal((await api('GET', '/clientes')).status, 401);
  assert.equal((await api('GET', '/clientes', { token: 'nao-e-um-jwt' })).status, 401);
});

test('001/CA-11: bloquear o usuário vale na hora, mesmo com token válido', async () => {
  const u = await criarUsuario({ empresaId: nevitta.id, role: 'gestor' });
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 200);
  await db.query(`UPDATE usuarios SET status = 'bloqueado' WHERE id = $1`, [u.id]);
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 401);
});

test('001/CA-11: desativar a empresa derruba o acesso dos seus usuários', async () => {
  const empresa = await criarEmpresa();
  const u = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 200);
  await db.query('UPDATE empresas SET ativa = false WHERE id = $1', [empresa.id]);
  assert.equal((await api('GET', '/auth/me', { token: tokenDe(u.id) })).status, 401);
});

test('001/CA-13: auto-cadastro válido cria usuário pendente sem perfil; e-mail repetido → 409', async () => {
  const email = `${unico('cad')}@teste.local`;
  const corpo = { nome: 'Pessoa Teste', email, senha: 'senha-longa-123', codigo_empresa: 'nevitta' };
  const r = await api('POST', '/auth/registrar', { body: corpo });
  assert.equal(r.status, 201);

  const u = (await db.query('SELECT role, status, empresa_id FROM usuarios WHERE email = $1', [email])).rows[0];
  assert.deepEqual(u, { role: null, status: 'pendente', empresa_id: nevitta.id });

  assert.equal((await api('POST', '/auth/registrar', { body: corpo })).status, 409);
});

test('001/CA-13: auto-cadastro com código de empresa inválido ou senha curta → 400', async () => {
  const base = { nome: 'Pessoa Teste', email: `${unico('cad')}@teste.local`, senha: 'senha-longa-123' };
  assert.equal((await api('POST', '/auth/registrar', { body: { ...base, codigo_empresa: 'NAO-EXISTE' } })).status, 400);
  assert.equal((await api('POST', '/auth/registrar', { body: { ...base, codigo_empresa: 'NEVITTA', senha: '1234567' } })).status, 400);
});

test('001/CA-20: corretor com cadastro inativo perde o acesso — login 403 e token 401', async () => {
  const cadastro = await criarCorretor({ empresaId: nevitta.id });
  const u = await criarUsuario({ empresaId: nevitta.id, role: 'corretor', corretorId: cadastro.id });
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 200);

  await db.query(`UPDATE corretores SET status = 'inativo' WHERE id = $1`, [cadastro.id]);
  assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 401);
  assert.equal((await api('POST', '/auth/login', { body: { email: u.email, senha: u.senha } })).status, 403);
});
