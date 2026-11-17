const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
require('dotenv').config();

const routes = require('./routes');
const pool = require('./config/database');
const gerarComissoesMes = require('./jobs/gerarComissoesMes');
const { FUSO, SQL_HOJE_BRASIL } = require('./utils/dataBrasil');

const app = express();

// Atrás do proxy do Railway: usa o IP real do cliente (necessário para o limite de requisições)
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET não configurado — login e rotas autenticadas não vão funcionar');
}

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

// Os jobs rodam no horário de Brasília (o servidor está em UTC) — spec 002/RN-20

// Job agendado: Verificar comissões atrasadas (todo dia às 8h)
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('🔄 Verificando comissões atrasadas...');
    
    await pool.query(`
      UPDATE comissoes 
      SET status = 'atrasada'
      WHERE status = 'prevista' 
      AND data_previsao_recebimento < ${SQL_HOJE_BRASIL} - 5
    `);
    
    console.log('✅ Comissões atrasadas atualizadas');
  } catch (error) {
    console.error('❌ Erro ao verificar comissões atrasadas:', error);
  }
}, { timezone: FUSO });

// Job agendado: Gerar comissões do próximo mês (dia 1 às 00:00)
cron.schedule('0 0 1 * *', async () => {
  try {
    console.log('🔄 Gerando comissões do novo mês...');
    const { geradas, encerradas, puladas } = await gerarComissoesMes(new Date());
    console.log(`✅ Comissões do novo mês geradas: ${geradas} (tabela encerrada: ${encerradas}; sem vencimento: ${puladas})`);
  } catch (error) {
    console.error('❌ Erro ao gerar comissões:', error);
  }
}, { timezone: FUSO });

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