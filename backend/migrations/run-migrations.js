const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// Cria o usuário administrador inicial a partir de ADMIN_EMAIL / ADMIN_PASSWORD (e ADMIN_NOME).
// Só cria se o email ainda não existir — nunca altera a senha de um usuário existente.
async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD || '';
  if (!email || !senha) return;

  const existe = await pool.query('SELECT id FROM usuarios WHERE LOWER(email) = $1', [email]);
  if (existe.rows.length > 0) return;

  if (senha.length < 8) {
    console.warn('⚠️  ADMIN_PASSWORD precisa ter pelo menos 8 caracteres — usuário admin não criado');
    return;
  }

  const hash = await bcrypt.hash(senha, 10);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES ($1, $2, $3, 'admin')`,
    [process.env.ADMIN_NOME || 'Administrador', email, hash]
  );
  console.log(`✅ Usuário admin criado: ${email}`);
}

// Executa todos os arquivos .sql desta pasta em ordem alfabética (001_, 002_, ...).
// Cada migration deve ser idempotente (IF NOT EXISTS), pois todas rodam a cada deploy.
async function runMigrations() {
  try {
    const files = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await pool.query(sql);
      console.log(`✅ Migration ${file} executada`);
    }

    console.log('✅ Migrations executadas com sucesso!');

    await ensureAdmin();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    process.exit(1);
  }
}

runMigrations();
