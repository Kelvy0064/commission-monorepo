const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { permitir } = require('../middleware/auth');

const corretoresController = require('../controllers/corretoresController');
const apolicesController = require('../controllers/apolicesController');
const comissoesController = require('../controllers/comissoesController');
const clientesController = require('../controllers/clientesController');
const seguradorasController = require('../controllers/seguradorasController');
const repassesController = require('../controllers/repassesController');
const authController = require('../controllers/authController');
const negociacoesController = require('../controllers/negociacoesController');
const tabelasComissaoController = require('../controllers/tabelasComissaoController');
const usuariosController = require('../controllers/usuariosController');
const { loginLimiter, leadLimiter, registroLimiter } = require('../middleware/rateLimits');

// ---------- Rotas públicas ----------

router.post('/auth/login', loginLimiter, authController.login);
router.post('/auth/registrar', registroLimiter, authController.registrar);

// Leads da landing page
router.post('/leads', leadLimiter, clientesController.createLead);

// Compatibilidade: a landing page envia para POST /clientes sem login.
// Sem token → tratado como lead (mesmas restrições de /leads). Com token → segue para a rota autenticada.
router.post('/clientes', (req, res, next) => {
  if (req.headers.authorization) return next();
  return leadLimiter(req, res, () => clientesController.createLead(req, res));
});

// ---------- Daqui para baixo, todas as rotas exigem login ----------
// Permissões por perfil: utils/permissoes.js. Escopo "próprio" do corretor: nos controllers.
router.use(authMiddleware);

router.get('/auth/me', authController.me);

// Usuários da empresa (aprovar cadastros, perfis, bloqueio)
router.get('/usuarios', permitir('usuarios.gerenciar'), usuariosController.index);
router.put('/usuarios/:id', permitir('usuarios.gerenciar'), usuariosController.update);
router.delete('/usuarios/:id', permitir('usuarios.gerenciar'), usuariosController.delete);

// Corretores
router.get('/corretores/opcoes', corretoresController.opcoes); // id/nome/status para selects (todos)
router.get('/corretores', permitir('corretores.ver'), corretoresController.index);
router.get('/corretores/:id', permitir('corretores.ver'), corretoresController.show);
router.post('/corretores', permitir('corretores.editar'), corretoresController.create);
router.put('/corretores/:id', permitir('corretores.editar'), corretoresController.update);
router.delete('/corretores/:id', permitir('corretores.editar'), corretoresController.delete);

// Apólices
router.get('/apolices', permitir('apolices.ver'), apolicesController.index);
router.post('/apolices', permitir('apolices.criar'), apolicesController.create);
router.put('/apolices/:id', permitir('apolices.editar'), apolicesController.update);
router.delete('/apolices/:id', permitir('apolices.excluir'), apolicesController.delete);

// Comissões e dashboard
router.get('/comissoes', permitir('comissoes.ver'), comissoesController.index);
router.put('/comissoes/:id/recebida', permitir('comissoes.editar'), comissoesController.marcarRecebida);
router.get('/dashboard', permitir('dashboard.ver'), comissoesController.dashboard);

// Clientes
router.get('/clientes', permitir('clientes.ver'), clientesController.index);
router.get('/clientes/:id', permitir('clientes.ver'), clientesController.show);
router.post('/clientes', permitir('clientes.criar'), clientesController.create);
router.put('/clientes/:id', permitir('clientes.editar'), clientesController.update);
router.delete('/clientes/:id', permitir('clientes.excluir'), clientesController.delete);

// Seguradoras e tabelas de comissão
router.get('/seguradoras', permitir('seguradoras.ver'), seguradorasController.index);
router.get('/seguradoras/:id', permitir('seguradoras.ver'), seguradorasController.show);
router.post('/seguradoras', permitir('seguradoras.editar'), seguradorasController.create);
router.put('/seguradoras/:id', permitir('seguradoras.editar'), seguradorasController.update);
router.delete('/seguradoras/:id', permitir('seguradoras.editar'), seguradorasController.delete);

router.get('/seguradoras/:seguradoraId/tabelas-comissao', permitir('tabelas_comissao.ver'), tabelasComissaoController.index);
router.post('/seguradoras/:seguradoraId/tabelas-comissao', permitir('tabelas_comissao.editar'), tabelasComissaoController.create);
router.put('/tabelas-comissao/:id', permitir('tabelas_comissao.editar'), tabelasComissaoController.update);
router.delete('/tabelas-comissao/:id', permitir('tabelas_comissao.editar'), tabelasComissaoController.delete);

// Negociações
router.get('/negociacoes', permitir('negociacoes.ver'), negociacoesController.index);
router.post('/negociacoes', permitir('negociacoes.criar'), negociacoesController.create);
router.post('/negociacoes/distribuir', permitir('negociacoes.distribuir'), negociacoesController.distribuir);
router.put('/negociacoes/:id', permitir('negociacoes.editar'), negociacoesController.update);
router.patch('/negociacoes/:id/etapa', permitir('negociacoes.editar'), negociacoesController.moverEtapa);
router.delete('/negociacoes/:id', permitir('negociacoes.excluir'), negociacoesController.delete);

// Repasses
router.get('/repasses', permitir('repasses.ver'), repassesController.index);
router.post('/repasses/gerar', permitir('repasses.editar'), repassesController.gerarRepasses);
router.put('/repasses/:id/pago', permitir('repasses.editar'), repassesController.marcarPago);

module.exports = router;
