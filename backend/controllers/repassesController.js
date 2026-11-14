const pool = require('../config/database');

const repassesController = {
  // Listar repasses
  async index(req, res) {
    try {
      const { status, corretor_id } = req.query;
      let query = `
        SELECT r.*,
               cor.nome as corretor_nome,
               c.valor_comissao_bruto,
               c.competencia
        FROM repasses r
        LEFT JOIN corretores cor ON r.corretor_destino_id = cor.id
        LEFT JOIN comissoes c ON r.comissao_id = c.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND r.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (corretor_id) {
        query += ` AND r.corretor_destino_id = $${paramCount}`;
        params.push(corretor_id);
        paramCount++;
      }

      query += ' ORDER BY r.data_previsao_pagamento DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar repasses:', error);
      res.status(500).json({ error: 'Erro ao listar repasses' });
    }
  },

  // Gerar repasses automaticamente para comissões recebidas
  async gerarRepasses(req, res) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Buscar comissões recebidas sem repasse gerado
      const comissoes = await client.query(`
        SELECT c.*, cor.percentual_comissao
        FROM comissoes c
        LEFT JOIN corretores cor ON c.corretor_id = cor.id
        WHERE c.status = 'recebida'
        AND NOT EXISTS (
          SELECT 1 FROM repasses r WHERE r.comissao_id = c.id
        )
      `);

      let repassesGerados = 0;

      for (const comissao of comissoes.rows) {
        const valorRepasse = (comissao.valor_comissao_liquido * comissao.percentual_comissao) / 100;
        const dataPrevisao = new Date(comissao.data_recebimento_real);
        dataPrevisao.setDate(dataPrevisao.getDate() + 5); // 5 dias após recebimento

        await client.query(
          `INSERT INTO repasses (comissao_id, corretor_destino_id, valor_repasse, percentual_repasse,
                                 data_previsao_pagamento, status)
           VALUES ($1, $2, $3, $4, $5, 'pendente')`,
          [comissao.id, comissao.corretor_id, valorRepasse, comissao.percentual_comissao, 
           dataPrevisao.toISOString().split('T')[0]]
        );

        repassesGerados++;
      }

      await client.query('COMMIT');
      res.json({ 
        message: 'Repasses gerados com sucesso',
        repasses_gerados: repassesGerados
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao gerar repasses:', error);
      res.status(500).json({ error: 'Erro ao gerar repasses' });
    } finally {
      client.release();
    }
  },

  // Marcar repasse como pago
  async marcarPago(req, res) {
    try {
      const { id } = req.params;
      const { data_pagamento, forma_pagamento, comprovante_url } = req.body;

      const result = await pool.query(
        `UPDATE repasses 
         SET status = 'pago',
             data_pagamento_real = $1,
             forma_pagamento = $2,
             comprovante_url = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [data_pagamento || new Date().toISOString().split('T')[0], forma_pagamento, comprovante_url, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Repasse não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao marcar repasse como pago:', error);
      res.status(500).json({ error: 'Erro ao marcar repasse como pago' });
    }
  },

  // Relatório de repasses por corretor
  async relatorioPorCorretor(req, res) {
    try {
      const { corretor_id, data_inicio, data_fim } = req.query;

      let query = `
        SELECT 
          cor.nome as corretor_nome,
          COUNT(r.id) as total_repasses,
          SUM(CASE WHEN r.status = 'pago' THEN r.valor_repasse ELSE 0 END) as total_pago,
          SUM(CASE WHEN r.status = 'pendente' THEN r.valor_repasse ELSE 0 END) as total_pendente
        FROM repasses r
        LEFT JOIN corretores cor ON r.corretor_destino_id = cor.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (corretor_id) {
        query += ` AND r.corretor_destino_id = $${paramCount}`;
        params.push(corretor_id);
        paramCount++;
      }

      if (data_inicio) {
        query += ` AND r.data_previsao_pagamento >= $${paramCount}`;
        params.push(data_inicio);
        paramCount++;
      }

      if (data_fim) {
        query += ` AND r.data_previsao_pagamento <= $${paramCount}`;
        params.push(data_fim);
        paramCount++;
      }

      query += ' GROUP BY cor.nome ORDER BY total_pago DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
  }
};

module.exports = repassesController;