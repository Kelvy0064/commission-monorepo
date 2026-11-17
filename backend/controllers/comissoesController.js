const pool = require('../config/database');
const { escopoCorretor } = require('../utils/permissoes');
const { valorComissao, DIAS_PARA_REPASSE } = require('../utils/comissaoParcela');
const { competenciaBrasil, dataBrasil, somarDias, SQL_HOJE_BRASIL } = require('../utils/dataBrasil');
const { devolverDescontos } = require('../utils/estorno');

const competenciaAtual = () => competenciaBrasil();
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Dashboard do corretor: só os próprios números (negociações e repasses)
const dashboardCorretor = async (empresaId, corretorId) => {
  const [negociacoes, repasses, saldo] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS em_andamento,
              COUNT(*) FILTER (WHERE status = 'em_andamento' AND proxima_acao_em < (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS atrasadas,
              COUNT(*) FILTER (WHERE status = 'em_andamento' AND proxima_acao_em IS NULL)::int AS sem_proxima_acao,
              COUNT(*) FILTER (WHERE status = 'vendida')::int AS vendidas
       FROM negociacoes WHERE empresa_id = $1 AND corretor_id = $2`,
      [empresaId, corretorId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(valor_repasse - valor_desconto_saldo) FILTER (WHERE status = 'pendente'), 0) AS pendente,
              COALESCE(SUM(valor_repasse - valor_desconto_saldo) FILTER (WHERE status = 'pago'), 0) AS pago
       FROM repasses WHERE empresa_id = $1 AND corretor_destino_id = $2`,
      [empresaId, corretorId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(valor_restante), 0) AS total FROM saldos_corretor
       WHERE empresa_id = $1 AND corretor_id = $2 AND status = 'pendente'`,
      [empresaId, corretorId]
    ),
  ]);
  return {
    tipo: 'corretor',
    negociacoes: negociacoes.rows[0],
    repasses_pendentes: parseFloat(repasses.rows[0].pendente),
    repasses_pagos: parseFloat(repasses.rows[0].pago),
    saldo_pendente: parseFloat(saldo.rows[0].total),
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
  // PUT /comissoes/:id/recebida { data_recebimento?, valor_real? } (spec 002/RN-12).
  // Pode ser repetido para corrigir data/valor: o repasse ainda PENDENTE da comissão acompanha
  // (RN-19); repasse já pago não muda.
  async marcarRecebida(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const dataRecebimento = req.body.data_recebimento ? String(req.body.data_recebimento).slice(0, 10) : dataBrasil();
      if (!DATA_ISO.test(dataRecebimento)) return res.status(400).json({ error: 'Data de recebimento inválida' });
      const informado = req.body.valor_real;
      const valorReal = informado === undefined || informado === null || informado === '' ? null : Number(informado);
      if (valorReal !== null && !(Number.isFinite(valorReal) && valorReal >= 0)) {
        return res.status(400).json({ error: 'Valor recebido inválido' });
      }

      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE comissoes
         SET status = 'recebida',
             data_recebimento_real = $1,
             valor_comissao_liquido = COALESCE($2, valor_comissao_liquido),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND empresa_id = $4
         RETURNING *`,
        [dataRecebimento, valorReal, id, req.user.empresa_id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Comissão não encontrada' });
      }
      const comissao = result.rows[0];

      // Repasse pendente acompanha o valor e a data do recebimento (com o percentual gravado nele)
      const pendentes = await client.query(
        `SELECT id, percentual_repasse FROM repasses WHERE comissao_id = $1 AND status = 'pendente'`,
        [comissao.id]
      );
      for (const r of pendentes.rows) {
        const novoValor = valorComissao(comissao.valor_comissao_liquido, r.percentual_repasse);
        // Desconto de saldo maior que o novo valor volta ao saldo (spec 005)
        await devolverDescontos(client, { repasseId: r.id, novoMaximo: novoValor, data: dataRecebimento, usuarioId: req.user.id });
        await client.query(
          `UPDATE repasses SET valor_repasse = $1, data_previsao_pagamento = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [novoValor, somarDias(dataRecebimento, DIAS_PARA_REPASSE), r.id]
        );
      }

      await client.query('COMMIT');
      res.json(comissao);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Erro ao marcar comissão:', error);
      res.status(500).json({ error: 'Erro ao marcar comissão como recebida' });
    } finally {
      client.release();
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
          `SELECT COALESCE(SUM(valor_repasse - valor_desconto_saldo), 0) as total
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
           AND c.data_previsao_recebimento BETWEEN ${SQL_HOJE_BRASIL} AND ${SQL_HOJE_BRASIL} + 7
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
