const pool = require('../config/database');

// Todas as consultas são restritas à empresa do usuário logado (req.user.empresa_id)
const corretoresController = {
  // GET /corretores — cadastro completo (Admin/Gestor)
  async index(req, res) {
    try {
      const { status } = req.query;
      const params = [req.user.empresa_id];
      let query = 'SELECT * FROM corretores WHERE empresa_id = $1';

      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      query += ' ORDER BY nome';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar corretores:', error);
      res.status(500).json({ error: 'Erro ao listar corretores' });
    }
  },

  // GET /corretores/opcoes — só id, nome e status, para selects (qualquer perfil).
  // Não expõe percentual de comissão, CPF nem contato.
  async opcoes(req, res) {
    try {
      const result = await pool.query(
        'SELECT id, nome, status FROM corretores WHERE empresa_id = $1 ORDER BY nome',
        [req.user.empresa_id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar corretores:', error);
      res.status(500).json({ error: 'Erro ao listar corretores' });
    }
  },

  async show(req, res) {
    try {
      const result = await pool.query('SELECT * FROM corretores WHERE id = $1 AND empresa_id = $2', [
        req.params.id,
        req.user.empresa_id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Corretor não encontrado' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar corretor:', error);
      res.status(500).json({ error: 'Erro ao buscar corretor' });
    }
  },

  async create(req, res) {
    try {
      const { nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes } = req.body;

      const result = await pool.query(
        `INSERT INTO corretores (nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes, empresa_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status || 'ativo', observacoes, req.user.empresa_id]
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

  async update(req, res) {
    try {
      const { nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes } = req.body;

      const result = await pool.query(
        `UPDATE corretores
         SET nome = $1, cpf = $2, email = $3, telefone = $4, tipo = $5,
             percentual_comissao = $6, data_admissao = $7, status = $8, observacoes = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 AND empresa_id = $11
         RETURNING *`,
        [nome, cpf, email, telefone, tipo, percentual_comissao, data_admissao, status, observacoes, req.params.id, req.user.empresa_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Corretor não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'CPF já cadastrado' });
      }
      console.error('Erro ao atualizar corretor:', error);
      res.status(500).json({ error: 'Erro ao atualizar corretor' });
    }
  },

  async delete(req, res) {
    try {
      const result = await pool.query('DELETE FROM corretores WHERE id = $1 AND empresa_id = $2 RETURNING id', [
        req.params.id,
        req.user.empresa_id,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Corretor não encontrado' });
      }

      res.json({ message: 'Corretor deletado com sucesso' });
    } catch (error) {
      if (error.code === '23503') {
        return res.status(400).json({ error: 'Corretor tem apólices, comissões ou repasses vinculados' });
      }
      console.error('Erro ao deletar corretor:', error);
      res.status(500).json({ error: 'Erro ao deletar corretor' });
    }
  },
};

module.exports = corretoresController;
