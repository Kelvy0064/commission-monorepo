const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Importar controllers (assumindo que todos foram criados)
const corretoresController = require('../controllers/corretoresController');
const apolicesController = require('../controllers/apolicesController');
const comissoesController = require('../controllers/comissoesController');
const clientesController = require('../controllers/clientesController');
const seguradorasController = require('../controllers/seguradorasController');
const repassesController = require('../controllers/repassesController')
// // ... outros controllers

// // Rotas públicas (sem autenticação para simplificar o MVP)
// router.get('/health', (req, res) => {
//   res.json({ status: 'ok', timestamp: new Date() });
// });

// // Rotas de Corretores
router.get('/corretores', corretoresController.index);
router.get('/corretores/:id', corretoresController.show);
router.post('/corretores', corretoresController.create);
router.put('/corretores/:id', corretoresController.update);
router.delete('/corretores/:id', corretoresController.delete);

// // Rotas de Apólices
router.get('/apolices', apolicesController.index);
router.post('/apolices', apolicesController.create);
router.put('/apolices/:id', apolicesController.update);
router.delete('/apolices/:id', apolicesController.delete);

// // Rotas de Comissões
router.get('/comissoes', comissoesController.index);
router.put('/comissoes/:id/recebida', comissoesController.marcarRecebida);
router.get('/dashboard', comissoesController.dashboard);


router.get('/clientes', clientesController.index);
router.post('/clientes', clientesController.create);
router.put('/clientes/:id', clientesController.update);
router.delete('/clientes/:id', clientesController.delete);

router.get('/seguradoras', seguradorasController.index);
router.post('/seguradoras', seguradorasController.create);
router.put('/seguradoras/:id', seguradorasController.update);
router.delete('/seguradoras/:id', seguradorasController.delete);

router.get('/repasses', repassesController.index);
router.post('/repasses/gerar', repassesController.gerarRepasses);
router.put('/repasses/:id/pago', repassesController.marcarPago);


// ... outras rotas seguem o mesmo padrão



module.exports = router;
