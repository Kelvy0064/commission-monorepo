const pool = require('../config/database');

const seguradorasController = {
  // Listar todas as seguradoras
  async index(req, res) {
    try {
      const result = await pool.query('SELECT * FROM seguradoras ORDER BY nome');
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

      const result = await pool.query(
        `INSERT INTO seguradoras (nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes]
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

      const result = await pool.query(
        `UPDATE seguradoras 
         SET nome = $1, cnpj = $2, contato = $3, email = $4,
             dia_pagamento = $5, prazo_repasse_dias = $6, observacoes = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [nome, cnpj, contato, email, dia_pagamento, prazo_repasse_dias, observacoes, id]
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