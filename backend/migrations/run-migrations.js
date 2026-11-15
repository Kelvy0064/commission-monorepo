const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

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
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    process.exit(1);
  }
}

runMigrations();
