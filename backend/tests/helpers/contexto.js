// Utilitários dos testes de integração. Só funcionam dentro de `npm test` (tests/run.js), que
// define API_URL, DB_* e JWT_SECRET apontando para o banco e a API descartáveis.
//
// Dados sempre fictícios (constituição IV.3): e-mails @teste.local, nomes genéricos.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

if (!process.env.API_URL) {
  throw new Error('Rode os testes de integração com `npm test` (tests/run.js prepara banco e API).');
}

const db = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 3,
  allowExitOnIdle: true,
});

let seq = 0;
const unico = (prefixo) => `${prefixo}${Date.now().toString(36)}${(seq++).toString(36)}`;

// Chamada à API: devolve { status, body }
const api = async (metodo, rota, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${process.env.API_URL}${rota}`, {
    method: metodo,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  return { status: res.status, body: json };
};

// Token de um usuário sem passar pelo login (o login tem limite de tentativas por IP)
const tokenDe = (usuarioId) => jwt.sign({ id: usuarioId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const empresaPorCodigo = async (codigo) =>
  (await db.query('SELECT * FROM empresas WHERE codigo = $1', [codigo])).rows[0];

const criarEmpresa = async ({ nome = 'Empresa Teste', codigo = unico('EMP').toUpperCase(), ativa = true } = {}) =>
  (await db.query('INSERT INTO empresas (nome, codigo, ativa) VALUES ($1, $2, $3) RETURNING *', [nome, codigo, ativa]))
    .rows[0];

const criarCorretor = async ({ empresaId, nome = 'Corretor Teste', percentual = 30 } = {}) =>
  (
    await db.query(
      `INSERT INTO corretores (nome, cpf, tipo, percentual_comissao, empresa_id)
       VALUES ($1, $2, 'comissionado', $3, $4) RETURNING *`,
      [nome, unico('').slice(-11).padStart(11, '0'), percentual, empresaId]
    )
  ).rows[0];

// Cria um usuário direto no banco e devolve { ...usuario, senha, token }
const criarUsuario = async ({
  empresaId,
  role = 'admin',
  status = 'ativo',
  corretorId = null,
  senha = 'senha-de-teste-123',
  nome = 'Usuário Teste',
  email = `${unico('u')}@teste.local`,
} = {}) => {
  const hash = await bcrypt.hash(senha, 4);
  const u = (
    await db.query(
      `INSERT INTO usuarios (nome, email, senha_hash, role, status, empresa_id, corretor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nome, email, role, status, empresa_id, corretor_id`,
      [nome, email, hash, role, status, empresaId, corretorId]
    )
  ).rows[0];
  return { ...u, senha, token: tokenDe(u.id) };
};

const criarCliente = async ({ empresaId, corretorId = null, nome = 'Cliente Teste' } = {}) =>
  (
    await db.query('INSERT INTO clientes (nome, corretor_id, empresa_id) VALUES ($1, $2, $3) RETURNING *', [
      nome,
      corretorId,
      empresaId,
    ])
  ).rows[0];

const criarSeguradora = async ({ empresaId, nome = 'Seguradora Teste', diaPagamento = 10, prazoRepasse = 5 } = {}) =>
  (
    await db.query(
      `INSERT INTO seguradoras (nome, cnpj, dia_pagamento, prazo_repasse_dias, empresa_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, unico('').slice(-14).padStart(14, '0'), diaPagamento, prazoRepasse, empresaId]
    )
  ).rows[0];

// Tabela de comissão direto no banco (a apólice sempre usa uma — spec 005/D6)
const criarTabelaComissao = async ({
  seguradoraId,
  nome = 'Tabela Teste',
  percentuais = [10],
  vitalicio = null,
  vitalicioMeses = null,
  estornoMeses = null,
} = {}) =>
  (
    await db.query(
      `INSERT INTO tabelas_comissao (seguradora_id, nome, percentuais_parcelas, vitalicio_percentual, vitalicio_meses, estorno_meses)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [seguradoraId, nome, percentuais, vitalicio, vitalicioMeses, estornoMeses]
    )
  ).rows[0];

// Competência (AAAA-MM) e data (AAAA-MM-DD) no fuso do processo (UTC nos testes, como no Railway)
const competenciaDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

module.exports = {
  db,
  api,
  tokenDe,
  unico,
  empresaPorCodigo,
  criarEmpresa,
  criarCorretor,
  criarUsuario,
  criarCliente,
  criarSeguradora,
  criarTabelaComissao,
  competenciaDe,
};
