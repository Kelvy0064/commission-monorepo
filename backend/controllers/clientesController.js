const pool = require('../config/database');

// Normaliza a lista de idades do contrato. Retorna null se for inválida.
// Ausente → [] (cliente sem idades informadas).
const parseIdades = (idades) => {
  if (idades === undefined || idades === null) return [];
  if (!Array.isArray(idades)) return null;
  const parsed = idades.map((idade) => Number(idade));
  const valid = parsed.every((idade) => Number.isInteger(idade) && idade >= 0 && idade <= 130);
  return valid ? parsed : null;
};

const IDADES_INVALIDAS = 'Idades devem ser uma lista de números inteiros entre 0 e 130';

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
      const idades = parseIdades(req.body.idades);
      if (idades === null) {
        return res.status(400).json({ error: IDADES_INVALIDAS });
      }

      const result = await pool.query(
        `INSERT INTO clientes (nome, cpf_cnpj, email, telefone, data_nascimento, idades, endereco, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [nome, cpf_cnpj, email, telefone, data_nascimento || null, idades, endereco, status || 'ativo']
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
      const idades = parseIdades(req.body.idades);
      if (idades === null) {
        return res.status(400).json({ error: IDADES_INVALIDAS });
      }

      // data_nascimento não é mais editada pela tela; mantém o valor salvo se não vier no corpo
      const result = await pool.query(
        `UPDATE clientes
         SET nome = $1, cpf_cnpj = $2, email = $3, telefone = $4,
             data_nascimento = COALESCE($5, data_nascimento), idades = $6,
             endereco = $7, status = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [nome, cpf_cnpj, email, telefone, data_nascimento || null, idades, endereco, status, id]
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