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

// Corretor do cliente é opcional: vazio/ausente → null. Retorna undefined se for inválido.
const parseCorretorId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

const CORRETOR_INVALIDO = 'Corretor não encontrado';
const FK_VIOLATION = '23503';

// Lista clientes com o nome do corretor vinculado
const SELECT_CLIENTES = `
  SELECT c.*, co.nome AS corretor_nome
  FROM clientes c
  LEFT JOIN corretores co ON co.id = c.corretor_id`;

const clientesController = {
  // Listar clientes.
  // Filtros: busca (nome, CPF/CNPJ, email, telefone), status, corretor_id (id ou "sem").
  // Sem `page`, devolve o array completo (usado nos selects de outras telas).
  // Com `page`, devolve { data, total, page, pageSize, totalPages }.
  async index(req, res) {
    try {
      const { status, corretor_id, busca } = req.query;
      const conditions = [];
      const params = [];

      if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
      }

      if (corretor_id === 'sem') {
        conditions.push('c.corretor_id IS NULL');
      } else if (corretor_id) {
        const corretorId = parseCorretorId(corretor_id);
        if (!corretorId) {
          return res.status(400).json({ error: CORRETOR_INVALIDO });
        }
        params.push(corretorId);
        conditions.push(`c.corretor_id = $${params.length}`);
      }

      const termo = (busca || '').trim();
      if (termo) {
        const like = `%${termo.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like);
        const textMatch = `(c.nome ILIKE $${params.length} OR c.email ILIKE $${params.length})`;

        // Termo numérico (ex.: "123.456", "(11) 9876"): compara também os dígitos de
        // CPF/CNPJ e telefone, com ou sem máscara. Termos com letras buscam só nome/email.
        const digits = termo.replace(/\D/g, '');
        if (digits && /^[\d\s.\-/()+]+$/.test(termo)) {
          params.push(`%${digits}%`);
          const n = params.length;
          conditions.push(`(${textMatch}
            OR regexp_replace(c.cpf_cnpj, '\\D', '', 'g') LIKE $${n}
            OR regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g') LIKE $${n})`);
        } else {
          conditions.push(textMatch);
        }
      }

      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

      if (req.query.page === undefined) {
        const result = await pool.query(`${SELECT_CLIENTES}${where} ORDER BY c.nome`, params);
        return res.json(result.rows);
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

      const [countResult, dataResult] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM clientes c${where}`, params),
        pool.query(
          `${SELECT_CLIENTES}${where} ORDER BY c.nome, c.id
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, pageSize, (page - 1) * pageSize]
        ),
      ]);

      const total = countResult.rows[0].total;
      res.json({
        data: dataResult.rows,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      res.status(500).json({ error: 'Erro ao listar clientes' });
    }
  },

  // Buscar cliente por ID
  async show(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`${SELECT_CLIENTES} WHERE c.id = $1`, [id]);
      
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
      const corretorId = parseCorretorId(req.body.corretor_id);
      if (corretorId === undefined) {
        return res.status(400).json({ error: CORRETOR_INVALIDO });
      }

      const result = await pool.query(
        `INSERT INTO clientes (nome, cpf_cnpj, email, telefone, data_nascimento, idades, corretor_id, endereco, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [nome, cpf_cnpj, email, telefone, data_nascimento || null, idades, corretorId, endereco, status || 'ativo']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === FK_VIOLATION) {
        return res.status(400).json({ error: CORRETOR_INVALIDO });
      }
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
      const corretorId = parseCorretorId(req.body.corretor_id);
      if (corretorId === undefined) {
        return res.status(400).json({ error: CORRETOR_INVALIDO });
      }

      // data_nascimento não é mais editada pela tela; mantém o valor salvo se não vier no corpo
      const result = await pool.query(
        `UPDATE clientes
         SET nome = $1, cpf_cnpj = $2, email = $3, telefone = $4,
             data_nascimento = COALESCE($5, data_nascimento), idades = $6,
             corretor_id = $7, endereco = $8, status = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING *`,
        [nome, cpf_cnpj, email, telefone, data_nascimento || null, idades, corretorId, endereco, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === FK_VIOLATION) {
        return res.status(400).json({ error: CORRETOR_INVALIDO });
      }
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