const pool = require('../config/database');

// Campos de relacionamento (contrato, pagamento, pós-venda)
const relacionamento = (body) => {
  const assinado = body.contrato_assinado === true || body.contrato_assinado === 'true';
  return {
    contrato_assinado: assinado,
    contrato_assinado_em: assinado && body.contrato_assinado_em ? String(body.contrato_assinado_em).slice(0, 10) : null,
    regras_pagamento: body.regras_pagamento?.trim() || null,
    pos_venda: body.pos_venda?.trim() || null,
  };
};

const seguradorasController = {
  // Listar todas as seguradoras (com a quantidade de tabelas de comissão ativas)
  async index(req, res) {
    try {
      const result = await pool.query(
        `SELECT s.*,
                (SELECT COUNT(*)::int FROM tabelas_comissao t WHERE t.seguradora_id = s.id AND t.ativa) AS tabelas_ativas
         FROM seguradoras s
         ORDER BY s.nome`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar seguradoras:', error);
      res.status(500).json({ error: 'Erro ao listar seguradoras' });
    }
  },

  // Buscar seguradora por ID
  async show(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM seguradoras WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Seguradora não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar seguradora:', error);
      res.status(500).json({ error: 'Erro ao buscar seguradora' });
    }
  },

  // Criar nova seguradora
  async create(req, res) {
    try {
      const { nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes } = req.body;
      const r = relacionamento(req.body);

      const result = await pool.query(
        `INSERT INTO seguradoras (nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes,
                                  contrato_assinado, contrato_assinado_em, regras_pagamento, pos_venda)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes,
         r.contrato_assinado, r.contrato_assinado_em, r.regras_pagamento, r.pos_venda]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao criar seguradora:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'CNPJ já cadastrado' });
      }
      res.status(500).json({ error: 'Erro ao criar seguradora' });
    }
  },

  // Atualizar seguradora
  async update(req, res) {
    try {
      const { id } = req.params;
      const { nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes } = req.body;
      const r = relacionamento(req.body);

      const result = await pool.query(
        `UPDATE seguradoras
         SET nome = $1, cnpj = $2, contato = $3, email = $4,
             dia_pagamento = $5, prazo_repasse_dias = $6, observacoes = $7,
             contrato_assinado = $8, contrato_assinado_em = $9, regras_pagamento = $10, pos_venda = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12
         RETURNING *`,
        [nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes,
         r.contrato_assinado, r.contrato_assinado_em, r.regras_pagamento, r.pos_venda, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Seguradora não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar seguradora:', error);
      res.status(500).json({ error: 'Erro ao atualizar seguradora' });
    }
  },

  // Deletar seguradora
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM seguradoras WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Seguradora não encontrada' });
      }

      res.json({ message: 'Seguradora deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar seguradora:', error);
      res.status(500).json({ error: 'Erro ao deletar seguradora' });
    }
  }
};

module.exports = seguradorasController;