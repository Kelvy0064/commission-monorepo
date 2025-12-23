const pool = require('../config/database');

const apolicesController = {
  // Listar todas as apólices
  async index(req, res) {
    try {
      const { status, cliente_id, corretor_id } = req.query;
      let query = `
        SELECT a.*, 
               c.nome as cliente_nome,
               s.nome as seguradora_nome,
               cor.nome as corretor_nome
        FROM apolices a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN seguradoras s ON a.seguradora_id = s.id
        LEFT JOIN corretores cor ON a.corretor_responsavel_id = cor.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (cliente_id) {
        query += ` AND a.cliente_id = $${paramCount}`;
        params.push(cliente_id);
        paramCount++;
      }

      if (corretor_id) {
        query += ` AND a.corretor_responsavel_id = $${paramCount}`;
        params.push(corretor_id);
        paramCount++;
      }

      query += ' ORDER BY a.created_at DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar apólices:', error);
      res.status(500).json({ error: 'Erro ao listar apólices' });
    }
  },

  // Criar nova apólice
  async create(req, res) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
        tipo_seguro, valor_premio_mensal, percentual_comissao,
        data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes
      } = req.body;

      // Criar apólice
      const apoliceResult = await client.query(
        `INSERT INTO apolices (cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
                                tipo_seguro, valor_premio_mensal, percentual_comissao,
                                data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
         tipo_seguro, valor_premio_mensal, percentual_comissao,
         data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status || 'ativa', observacoes]
      );

      const apolice = apoliceResult.rows[0];

      // Gerar comissão automática para o mês atual
      const hoje = new Date();
      const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      
      const seguradora = await client.query('SELECT * FROM seguradoras WHERE id = $1', [seguradora_id]);
      const dataPrevisao = new Date(hoje);
      dataPrevisao.setDate(seguradora.rows[0].dia_pagamento);
      dataPrevisao.setDate(dataPrevisao.getDate() + seguradora.rows[0].prazo_repasse_dias);

      const valorComissao = (valor_premio_mensal * percentual_comissao) / 100;

      await client.query(
        `INSERT INTO comissoes (apolice_id, corretor_id, competencia, valor_premio,
                                percentual_comissao, valor_comissao_bruto, valor_comissao_liquido,
                                data_previsao_recebimento, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'prevista')`,
        [apolice.id, corretor_responsavel_id, competencia, valor_premio_mensal,
         percentual_comissao, valorComissao, valorComissao, dataPrevisao.toISOString().split('T')[0]]
      );

      await client.query('COMMIT');
      res.status(201).json(apolice);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao criar apólice:', error);
      res.status(500).json({ error: 'Erro ao criar apólice' });
    } finally {
      client.release();
    }
  },

  // Atualizar apólice
  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
        tipo_seguro, valor_premio_mensal, percentual_comissao,
        data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes
      } = req.body;

      const result = await pool.query(
        `UPDATE apolices 
         SET cliente_id = $1, seguradora_id = $2, corretor_responsavel_id = $3,
             numero_apolice = $4, tipo_seguro = $5, valor_premio_mensal = $6,
             percentual_comissao = $7, data_inicio_vigencia = $8, data_fim_vigencia = $9,
             dia_vencimento = $10, status = $11, observacoes = $12, updated_at = CURRENT_TIMESTAMP
         WHERE id = $13
         RETURNING *`,
        [cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
         tipo_seguro, valor_premio_mensal, percentual_comissao,
         data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Apólice não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar apólice:', error);
      res.status(500).json({ error: 'Erro ao atualizar apólice' });
    }
  },

  // Deletar apólice
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM apolices WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Apólice não encontrada' });
      }

      res.json({ message: 'Apólice deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar apólice:', error);
      res.status(500).json({ error: 'Erro ao deletar apólice' });
    }
  }
};

module.exports = apolicesController