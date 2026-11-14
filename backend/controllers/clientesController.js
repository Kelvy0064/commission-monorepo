const pool = require('../config/database');

const clientesController = {
  // Listar todos os clientes
  async index(req, res) {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM clientes';
      const params = [];

      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }

      query += ' ORDER BY nome';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      res.status(500).json({ error: 'Erro ao listar clientes' });
    }
  },

  // Buscar cliente por ID
  async show(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
  },

  // Criar novo cliente
  async create(req, res) {
    try {
      const { nome, cpf_cnpj, email, telefone, data_nascimento, endereco, status } = req.body;

      const result = await pool.query(
        `INSERT INTO clientes (nome, cpf_cnpj, email, telefone, data_nascimento, endereco, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [nome, cpf_cnpj, email, telefone, data_nascimento, endereco, status || 'ativo']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ error: 'Erro ao criar cliente' });
    }
  },

  // Atualizar cliente
  async update(req, res) {
    try {
      const { id } = req.params;
      const { nome, cpf_cnpj, email, telefone, data_nascimento, endereco, status } = req.body;

      const result = await pool.query(
        `UPDATE clientes 
         SET nome = $1, cpf_cnpj = $2, email = $3, telefone = $4,
             data_nascimento = $5, endereco = $6, status = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [nome, cpf_cnpj, email, telefone, data_nascimento, endereco, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
  },

  // Deletar cliente
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar se há apólices vinculadas
      const apolices = await pool.query('SELECT id FROM apolices WHERE cliente_id = $1', [id]);
      
      if (apolices.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Não é possível excluir cliente com apólices vinculadas' 
        });
      }

      const result = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      res.json({ message: 'Cliente deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      res.status(500).json({ error: 'Erro ao deletar cliente' });
    }
  }
};

module.exports = clientesController;