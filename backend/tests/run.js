#!/usr/bin/env node
// Executor dos testes do backend (`npm test`).
//
// 1. Prepara um PostgreSQL descartável:
//    - CI: usa o servidor indicado em TEST_DB_HOST/TEST_DB_PORT/TEST_DB_USER/TEST_DB_PASSWORD
//      e cria nele um banco novo, apagado no final;
//    - local: cria um cluster temporário com o `initdb` do PostgreSQL instalado (PG_BIN, PATH ou
//      a pasta padrão do Windows) numa porta livre, apagado no final.
// 2. Aplica as migrations DUAS vezes (garante que são idempotentes, como no deploy).
// 3. Sobe a API (server.js) numa porta livre, em UTC como o Railway.
// 4. Roda `node --test` nos arquivos de tests/ (ou nos passados como argumento).
//
// Uso: npm test                      → todos os testes
//      npm test -- tests/integration/auth.test.js
//      KEEP_DB=1 npm test            → não apaga o banco (para investigar)

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { Client } = require('pg');

const BACKEND = path.resolve(__dirname, '..');

const portaLivre = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const arquivosDeTeste = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosDeTeste(p);
    return e.name.endsWith('.test.js') ? [p] : [];
  });

// Procura a pasta bin do PostgreSQL (initdb/pg_ctl)
const acharPgBin = () => {
  const exe = process.platform === 'win32' ? 'initdb.exe' : 'initdb';
  const candidatos = [];
  if (process.env.PG_BIN) candidatos.push(process.env.PG_BIN);
  for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir) candidatos.push(dir);
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(base)) {
      fs.readdirSync(base)
        .sort((a, b) => Number(b) - Number(a))
        .forEach((v) => candidatos.push(path.join(base, v, 'bin')));
    }
  } else {
    const base = '/usr/lib/postgresql';
    if (fs.existsSync(base)) {
      fs.readdirSync(base)
        .sort((a, b) => Number(b) - Number(a))
        .forEach((v) => candidatos.push(path.join(base, v, 'bin')));
    }
  }
  return candidatos.find((dir) => fs.existsSync(path.join(dir, exe)));
};

const rodar = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(`Falhou: ${path.basename(cmd)} ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}`);
  }
  return r;
};

// ---------- Banco ----------

async function prepararBanco() {
  const nomeBanco = `commission_test_${Date.now()}`;

  if (process.env.TEST_DB_HOST) {
    const conn = {
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT || 5432),
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || '',
    };
    const admin = new Client({ ...conn, database: process.env.TEST_DB_ADMIN_DB || 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${nomeBanco}`);
    await admin.end();
    return {
      conn: { ...conn, database: nomeBanco },
      encerrar: async () => {
        const c = new Client({ ...conn, database: process.env.TEST_DB_ADMIN_DB || 'postgres' });
        await c.connect();
        await c.query(`DROP DATABASE IF EXISTS ${nomeBanco} WITH (FORCE)`);
        await c.end();
      },
    };
  }

  const bin = acharPgBin();
  if (!bin) {
    throw new Error(
      'PostgreSQL não encontrado. Instale-o, coloque a pasta bin no PATH ou defina PG_BIN ' +
        '(ex.: PG_BIN="C:\\Program Files\\PostgreSQL\\18\\bin"), ou use TEST_DB_HOST.'
    );
  }
  const exe = (nome) => path.join(bin, process.platform === 'win32' ? `${nome}.exe` : nome);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commission-pg-'));
  const port = await portaLivre();

  rodar(exe('initdb'), ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C']);
  // stdio 'ignore': o postgres herda os pipes do pg_ctl e, capturando a saída, o spawnSync
  // ficaria esperando o servidor encerrar (trava no Windows)
  const start = spawnSync(
    exe('pg_ctl'),
    ['-D', dataDir, '-o', `-p ${port} -c listen_addresses=localhost`, '-l', path.join(dataDir, 'postgres.log'), '-w', 'start'],
    { stdio: 'ignore' }
  );
  if (start.status !== 0) throw new Error(`pg_ctl start falhou — veja ${path.join(dataDir, 'postgres.log')}`);

  const conn = { host: 'localhost', port, user: 'postgres', password: 'x' };
  const admin = new Client({ ...conn, database: 'postgres' });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nomeBanco}`);
  await admin.end();

  return {
    conn: { ...conn, database: nomeBanco },
    encerrar: async () => {
      spawnSync(exe('pg_ctl'), ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { encoding: 'utf8' });
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
    dataDir,
  };
}

// ---------- API ----------

async function subirApi(env) {
  const log = fs.openSync(path.join(os.tmpdir(), `commission-api-${process.pid}.log`), 'w');
  const proc = spawn(process.execPath, ['server.js'], { cwd: BACKEND, env, stdio: ['ignore', log, log] });
  let saiu = null;
  proc.on('exit', (code) => (saiu = code));

  for (let i = 0; i < 100; i++) {
    if (saiu !== null) throw new Error(`A API encerrou ao subir (código ${saiu}). Log: ${os.tmpdir()}`);
    try {
      const r = await fetch(`http://localhost:${env.PORT}/`);
      if (r.ok) return proc;
    } catch {
      // ainda subindo
    }
    await esperar(150);
  }
  proc.kill();
  throw new Error('A API não respondeu em 15 s');
}

// ---------- Principal ----------

async function main() {
  const filtros = process.argv.slice(2);
  const arquivos = filtros.length
    ? filtros.map((f) => path.resolve(f))
    : arquivosDeTeste(path.join(__dirname)).sort();

  let banco;
  let api;
  let codigo = 1;
  try {
    banco = await prepararBanco();
    const apiPort = await portaLivre();

    const env = {
      ...process.env,
      TZ: 'UTC', // o Railway roda em UTC
      NODE_ENV: 'test',
      DB_HOST: banco.conn.host,
      DB_PORT: String(banco.conn.port),
      DB_NAME: banco.conn.database,
      DB_USER: banco.conn.user,
      DB_PASSWORD: banco.conn.password,
      PORT: String(apiPort),
      JWT_SECRET: 'segredo-somente-para-testes',
      JWT_EXPIRES_IN: '1h',
      ADMIN_NOME: 'Admin Teste',
      ADMIN_EMAIL: 'admin@teste.local',
      ADMIN_PASSWORD: 'senha-admin-teste',
      ADMIN_EMPRESA_CODIGO: 'NEVITTA',
      LEADS_EMPRESA_CODIGO: 'NEVITTA',
      CORS_ORIGIN: 'http://localhost:5173',
      API_URL: `http://localhost:${apiPort}/api`,
    };

    // Migrations duas vezes: no deploy todas rodam sempre, então precisam ser idempotentes
    for (const rodada of [1, 2]) {
      const r = spawnSync(process.execPath, ['migrations/run-migrations.js'], { cwd: BACKEND, env, encoding: 'utf8' });
      if (r.status !== 0) {
        throw new Error(`Migrations falharam na ${rodada}ª execução (não são idempotentes?)\n${r.stdout}${r.stderr}`);
      }
    }
    console.log('✔ migrations aplicadas duas vezes (idempotentes)');

    api = await subirApi(env);
    console.log(`✔ API de teste em ${env.API_URL}\n`);

    const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...arquivos], {
      cwd: BACKEND,
      env,
      stdio: 'inherit',
    });
    codigo = r.status ?? 1;
  } catch (err) {
    console.error(`\n✖ ${err.message}`);
    codigo = 1;
  } finally {
    if (api) api.kill();
    if (banco && !process.env.KEEP_DB) await banco.encerrar().catch((e) => console.error(e.message));
    if (banco && process.env.KEEP_DB) console.log(`Banco mantido: ${JSON.stringify(banco.conn)} ${banco.dataDir || ''}`);
  }
  process.exit(codigo);
}

main();
