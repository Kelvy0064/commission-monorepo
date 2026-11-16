const pool = require('../config/database');
const { escopoCorretor } = require('../utils/permissoes');

const competenciaAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
};

// Dashboard do corretor: só os próprios números (negociações e repasses)
const dashboardCorretor = async (empresaId, corretorId) => {
  const [negociacoes, repasses] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS em_andamento,
              COUNT(*) FILTER (WHERE status = 'em_andamento' AND proxima_acao_em < (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS atrasadas,
              COUNT(*) FILTER (WHERE status = 'em_andamento' AND proxima_acao_em IS NULL)::int AS sem_proxima_acao,
              COUNT(*) FILTER (WHERE status = 'vendida')::int AS vendidas
       FROM negociacoes WHERE empresa_id = $1 AND corretor_id = $2`,
      [empresaId, corretorId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(valor_repasse) FILTER (WHERE status = 'pendente'), 0) AS pendente,
              COALESCE(SUM(valor_repasse) FILTER (WHERE status = 'pago'), 0) AS pago
       FROM repasses WHERE empresa_id = $1 AND corretor_destino_id = $2`,
      [empresaId, corretorId]
    ),
  ]);
  return {
    tipo: 'corretor',
    negociacoes: negociacoes.rows[0],
    repasses_pendentes: parseFloat(repasses.rows[0].pendente),
    repasses_pagos: parseFloat(repasses.rows[0].pago),
  };
};

const comissoesController = {
  // GET /comissoes — da empresa (Admin/Gestor)
  async index(req, res) {
    try {
      const { status, competencia, corretor_id } = req.query;
      const params = [req.user.empresa_id];
      let query = `
        SELECT c.*,
               a.numero_apolice,
               cor.nome as corretor_nome,
               cl.nome as cliente_nome,
               s.nome as seguradora_nome
        FROM comissoes c
        LEFT JOIN apolices a ON c.apolice_id = a.id
        LEFT JOIN corretores cor ON c.corretor_id = cor.id
        LEFT JOIN clientes cl ON a.cliente_id = cl.id
        LEFT JOIN seguradoras s ON a.seguradora_id = s.id
        WHERE c.empresa_id = $1
      `;

      if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
      }

      if (competencia) {
        params.push(competencia);
        query += ` AND c.competencia = $${params.length}`;
      }

      if (corretor_id) {
        params.push(corretor_id);
        query += ` AND c.corretor_id = $${params.length}`;
      }

      query += ' ORDER BY c.data_previsao_recebimento DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar comissões:', error);
      res.status(500).json({ error: 'Erro ao listar comissões' });
    }
  },

  // PUT /comissoes/:id/recebida { data_recebimento, valor_real }
  async marcarRecebida(req, res) {
    try {
      const { id } = req.params;
      const { data_recebimento, valor_real } = req.body;

      const result = await pool.query(
        `UPDATE comissoes
         SET status = 'recebida',
             data_recebimento_real = $1,
             valor_comissao_liquido = COALESCE($2, valor_comissao_liquido),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND empresa_id = $4
         RETURNING *`,
        [data_recebimento || new Date().toISOString().split('T')[0], valor_real, id, req.user.empresa_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Comissão não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao marcar comissão:', error);
      res.status(500).json({ error: 'Erro ao marcar comissão como recebida' });
    }
  },

  // GET /dashboard — Admin/Gestor: números da empresa; Corretor: só os próprios
  async dashboard(req, res) {
    try {
      const empresaId = req.user.empresa_id;
      const escopo = escopoCorretor(req);
      if (escopo !== null) return res.json(await dashboardCorretor(empresaId, escopo));

      const mesAtual = competenciaAtual();
      const [totalPrevisto, totalRecebido, repassesPendentes, apolicesAtivas, proximasComissoes] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(valor_comissao_bruto), 0) as total
           FROM comissoes WHERE competencia = $1 AND empresa_id = $2`,
          [mesAtual, empresaId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(valor_comissao_liquido), 0) as total
           FROM comissoes WHERE competencia = $1 AND status = 'recebida' AND empresa_id = $2`,
          [mesAtual, empresaId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(valor_repasse), 0) as total
           FROM repasses WHERE status = 'pendente' AND empresa_id = $1`,
          [empresaId]
        ),
        pool.query(`SELECT COUNT(*) as total FROM apolices WHERE status = 'ativa' AND empresa_id = $1`, [empresaId]),
        pool.query(
          `SELECT c.*, a.numero_apolice, cor.nome as corretor_nome, cl.nome as cliente_nome
           FROM comissoes c
           LEFT JOIN apolices a ON c.apolice_id = a.id
           LEFT JOIN corretores cor ON c.corretor_id = cor.id
           LEFT JOIN clientes cl ON a.cliente_id = cl.id
           WHERE c.status = 'prevista' AND c.empresa_id = $1
           AND c.data_previsao_recebimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           ORDER BY c.data_previsao_recebimento
           LIMIT 10`,
          [empresaId]
        ),
      ]);

      res.json({
        tipo: 'empresa',
        total_previsto: parseFloat(totalPrevisto.rows[0].total),
        total_recebido: parseFloat(totalRecebido.rows[0].total),
        repasses_pendentes: parseFloat(repassesPendentes.rows[0].total),
        apolices_ativas: parseInt(apolicesAtivas.rows[0].total),
        proximas_comissoes: proximasComissoes.rows,
      });
    } catch (error) {
      console.error('Erro ao buscar dashboard:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    }
  },
};

module.exports = comissoesController;
