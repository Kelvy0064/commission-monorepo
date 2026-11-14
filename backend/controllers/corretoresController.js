const pool = require('../config/database');

const corretoresController = {
  // Listar todos os corretores
  async index(req, res) {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM corretores';
      const params = [];

      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }

      query += ' ORDER BY nome';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar corretores:', error);
      res.status(500).json({ error: 'Erro ao listar corretores' });
    }
  },

  // Buscar corretor por ID
  async show(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM corretores WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Corretor não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar corretor:', error);
      res.status(500).json({ error: 'Erro ao buscar corretor' });
    }
  },

  // Criar novo corretor
  async create(req, res) {
    try {
      const { nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes } = req.body;

      const result = await pool.query(
        `INSERT INTO corretores (nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status || 'ativo', observacoes]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao criar corretor:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'CPF já cadastrado' });
      }
      res.status(500).json({ error: 'Erro ao criar corretor' });
    }
  },

  // Atualizar corretor
  async update(req, res) {
    try {
      const { id } = req.params;
      const { nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes } = req.body;

      const result = await pool.query(
        `UPDATE corretores 
         SET nome = $1, cpf = $2, email = $3, telefone = $4, tipo = $5, 
             percentual_comissao = $6, data_admissao = $7, status = $8, observacoes = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING *`,
        [nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Corretor não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar corretor:', error);
      res.status(500).json({ error: 'Erro ao atualizar corretor' });
    }
  },

  // Deletar corretor
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM corretores WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Corretor não encontrado' });
      }

      res.json({ message: 'Corretor deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar corretor:', error);
      res.status(500).json({ error: 'Erro ao deletar corretor' });
    }
  }
};

module.exports = corretoresController