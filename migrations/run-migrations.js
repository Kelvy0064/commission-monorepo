const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  try {
    const sqlFile = fs.readFileSync(
      path.join(__dirname, '001_create_tables.sql'),
      'utf8'
    );
    
    await pool.query(sqlFile);
    console.log('✅ Migrations executadas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    process.exit(1);
  }
}

runMigrations();