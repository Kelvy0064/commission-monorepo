const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
require('dotenv').config();

const routes = require('./routes');
const pool = require('./config/database');

const app = express();

// Middlewares
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rotas
app.use('/api', routes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    message: 'API Sistema de Comissões',
    version: '1.0.0',
    status: 'running'
  });
});

// Job agendado: Verificar comissões atrasadas (todo dia às 8h)
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('🔄 Verificando comissões atrasadas...');
    
    await pool.query(`
      UPDATE comissoes 
      SET status = 'atrasada'
      WHERE status = 'prevista' 
      AND data_previsao_recebimento < CURRENT_DATE - INTERVAL '5 days'
    `);
    
    console.log('✅ Comissões atrasadas atualizadas');
  } catch (error) {
    console.error('❌ Erro ao verificar comissões atrasadas:', error);
  }
});

// Job agendado: Gerar comissões do próximo mês (dia 1 às 00:00)
cron.schedule('0 0 1 * *', async () => {
  try {
    console.log('🔄 Gerando comissões do novo mês...');
    
    // Buscar todas as apólices ativas
    const apolices = await pool.query(`
      SELECT a.*, s.dia_pagamento, s.prazo_repasse_dias
      FROM apolices a
      JOIN seguradoras s ON a.seguradora_id = s.id
      WHERE a.status = 'ativa'
    `);

    const hoje = new Date();
    const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    for (const apolice of apolices.rows) {
      const dataPrevisao = new Date(hoje);
      dataPrevisao.setDate(apolice.dia_pagamento);
      dataPrevisao.setDate(dataPrevisao.getDate() + apolice.prazo_repasse_dias);

      const valorComissao = (apolice.valor_premio_mensal * apolice.percentual_comissao) / 100;

      // Verificar se já não existe comissão para esta competência
      const existe = await pool.query(
        'SELECT id FROM comissoes WHERE apolice_id = $1 AND competencia = $2',
        [apolice.id, competencia]
      );

      if (existe.rows.length === 0) {
        await pool.query(
          `INSERT INTO comissoes (apolice_id, corretor_id, competencia, valor_premio,
                                  percentual_comissao, valor_comissao_bruto, valor_comissao_liquido,
                                  data_previsao_recebimento, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'prevista')`,
          [apolice.id, apolice.corretor_responsavel_id, competencia, apolice.valor_premio_mensal,
           apolice.percentual_comissao, valorComissao, valorComissao, dataPrevisao.toISOString().split('T')[0]]
        );
      }
    }
    
    console.log('✅ Comissões do novo mês geradas');
  } catch (error) {
    console.error('❌ Erro ao gerar comissões:', error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Servidor Backend Iniciado com Sucesso!          ║
║                                                       ║
║   📍 URL: http://localhost:${PORT}                    ║
║   🌍 Ambiente: ${process.env.NODE_ENV || 'development'}                ║
║   📊 Database: ${process.env.DB_NAME}              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM recebido, encerrando...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT recebido, encerrando...');
  await pool.end();
  process.exit(0);
});

module.exports = app;