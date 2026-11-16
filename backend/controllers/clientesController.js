const pool = require('../config/database');
const { escopoCorretor } = require('../utils/permissoes');

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

const STATUS_VALIDOS = ['lead', 'ativo', 'inativo', 'cancelado'];
const TEXT_FIELDS = [
  'nome', 'cpf_cnpj', 'email', 'telefone', 'endereco',
  'plano_atual', 'custo_plano_atual', 'investimento_pretendido', 'hospitais_preferidos',
];
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

// Campos que a landing page (sem login) pode enviar
const LEAD_PUBLIC_FIELDS = [
  'nome', 'cpf_cnpj', 'email', 'telefone', 'data_nascimento', 'endereco', 'idades',
  'possui_plano', 'plano_atual', 'custo_plano_atual', 'investimento_pretendido', 'hospitais_preferidos',
  ...UTM_FIELDS,
];

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

// sim/não/indefinido → true/false/null
const parsePossuiPlano = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
};

// Valida e normaliza os campos editáveis do cliente.
// Retorna { fields } (colunas → valores) ou { error }.
const parseClienteBody = (body) => {
  const idades = parseIdades(body.idades);
  if (idades === null) return { error: IDADES_INVALIDAS };

  const corretorId = parseCorretorId(body.corretor_id);
  if (corretorId === undefined) return { error: CORRETOR_INVALIDO };

  if (body.status && !STATUS_VALIDOS.includes(body.status)) {
    return { error: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}` };
  }

  const fields = {};
  for (const field of TEXT_FIELDS) fields[field] = emptyToNull(body[field]);
  if (!fields.nome) return { error: 'Nome é obrigatório' };

  return {
    fields: {
      ...fields,
      idades,
      corretor_id: corretorId,
      possui_plano: parsePossuiPlano(body.possui_plano),
    },
  };
};

// O corretor informado precisa ser da mesma empresa (a FK sozinha aceitaria de outra empresa)
const corretorDaEmpresa = async (db, corretorId, empresaId) => {
  if (!corretorId) return true;
  const result = await db.query('SELECT 1 FROM corretores WHERE id = $1 AND empresa_id = $2', [corretorId, empresaId]);
  return result.rows.length > 0;
};

// Valida e insere um cliente da empresa. Retorna { cliente } ou { error } (erro de validação).
// `db` permite rodar dentro de uma transação (client do pool).
const insertCliente = async (body, db, empresaId) => {
  const parsed = parseClienteBody(body);
  if (parsed.error) return { error: parsed.error };
  if (!(await corretorDaEmpresa(db, parsed.fields.corretor_id, empresaId))) return { error: CORRETOR_INVALIDO };

  // data_cadastro pode ser informada (carga retroativa); senão, hoje
  const dataCadastro = body.data_cadastro || null;
  if (dataCadastro && !isIsoDate(dataCadastro)) {
    return { error: 'data_cadastro deve estar no formato AAAA-MM-DD' };
  }

  const values = {
    ...parsed.fields,
    status: body.status || 'ativo',
    data_nascimento: body.data_nascimento || null,
    ...Object.fromEntries(UTM_FIELDS.map((f) => [f, emptyToNull(body[f])])),
    empresa_id: empresaId,
  };
  const columns = Object.keys(values);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  try {
    const result = await db.query(
      `INSERT INTO clientes (${columns.join(', ')}, data_cadastro)
       VALUES (${placeholders.join(', ')}, COALESCE($${columns.length + 1}::date, CURRENT_DATE))
       RETURNING *`,
      [...Object.values(values), dataCadastro]
    );
    return { cliente: result.rows[0] };
  } catch (error) {
    if (error.code === FK_VIOLATION) return { error: CORRETOR_INVALIDO };
    throw error;
  }
};

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
  // Corretor só vê os próprios clientes (filtro de corretor é ignorado).
  async index(req, res) {
    try {
      const { status, corretor_id, busca } = req.query;
      const params = [req.user.empresa_id];
      const conditions = ['c.empresa_id = $1'];

      if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
      }

      const escopo = escopoCorretor(req);
      if (escopo !== null) {
        params.push(escopo);
        conditions.push(`c.corretor_id = $${params.length}`);
      } else if (corretor_id === 'sem') {
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

      const where = ` WHERE ${conditions.join(' AND ')}`;

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
      const escopo = escopoCorretor(req);
      const result = await pool.query(
        `${SELECT_CLIENTES} WHERE c.id = $1 AND c.empresa_id = $2 AND ($3::int IS NULL OR c.corretor_id = $3)`,
        [id, req.user.empresa_id, escopo]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
  },

  // Criar novo cliente (usuário logado). Cliente criado por corretor é sempre dele.
  async create(req, res) {
    try {
      const escopo = escopoCorretor(req);
      const body = escopo !== null ? { ...req.body, corretor_id: escopo } : req.body;
      const result = await insertCliente(body, pool, req.user.empresa_id);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result.cliente);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ error: 'Erro ao criar cliente' });
    }
  },

  // Recebe lead da landing page (rota pública, sem login).
  // Aceita só os campos do formulário; status é sempre 'lead', sem corretor nem data retroativa,
  // e a resposta não devolve os dados gravados.
  // O lead já entra no quadro de negociações, em "Sem contato" (cliente e negociação na mesma transação).
  // Empresa do lead: código em `empresa` (corpo ou query) ou LEADS_EMPRESA_CODIGO (padrão NEVITTA).
  async createLead(req, res) {
    const db = await pool.connect();
    try {
      const codigo = String(req.body.empresa || req.query.empresa || process.env.LEADS_EMPRESA_CODIGO || 'NEVITTA')
        .trim()
        .toUpperCase();
      const empresa = await db.query('SELECT id FROM empresas WHERE codigo = $1 AND ativa', [codigo]);
      if (empresa.rows.length === 0) {
        return res.status(400).json({ error: 'Empresa não encontrada' });
      }
      const empresaId = empresa.rows[0].id;

      const body = Object.fromEntries(
        LEAD_PUBLIC_FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]])
      );

      await db.query('BEGIN');
      const result = await insertCliente({ ...body, status: 'lead' }, db, empresaId);
      if (result.error) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: result.error });
      }
      await db.query(
        `INSERT INTO negociacoes (cliente_id, etapa, status, empresa_id)
         VALUES ($1, 'sem_contato', 'em_andamento', $2)`,
        [result.cliente.id, empresaId]
      );
      await db.query('COMMIT');

      res.status(201).json({ id: result.cliente.id, message: 'Lead recebido' });
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {});
      console.error('Erro ao receber lead:', error);
      res.status(500).json({ error: 'Erro ao receber lead' });
    } finally {
      db.release();
    }
  },

  // Atualizar cliente
  async update(req, res) {
    try {
      const { id } = req.params;
      // Corretor só edita os próprios clientes e não pode passá-los para outro corretor
      const escopo = escopoCorretor(req);
      const body = escopo !== null ? { ...req.body, corretor_id: escopo } : req.body;

      const parsed = parseClienteBody(body);
      if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
      }
      if (!(await corretorDaEmpresa(pool, parsed.fields.corretor_id, req.user.empresa_id))) {
        return res.status(400).json({ error: CORRETOR_INVALIDO });
      }

      const params = [];
      const sets = Object.entries(parsed.fields).map(([column, value]) => {
        params.push(value);
        return `${column} = $${params.length}`;
      });

      // Status, data de nascimento e UTM: mantém o valor salvo se não vierem no corpo
      for (const column of ['status', 'data_nascimento', ...UTM_FIELDS]) {
        params.push(req.body[column] || null);
        sets.push(`${column} = COALESCE($${params.length}, ${column})`);
      }

      params.push(id, req.user.empresa_id, escopo);
      const n = params.length;
      const result = await pool.query(
        `UPDATE clientes
         SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${n - 2} AND empresa_id = $${n - 1} AND ($${n}::int IS NULL OR corretor_id = $${n})
         RETURNING *`,
        params
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
      const apolices = await pool.query('SELECT id FROM apolices WHERE cliente_id = $1 AND empresa_id = $2', [
        id,
        req.user.empresa_id,
      ]);

      if (apolices.rows.length > 0) {
        return res.status(400).json({
          error: 'Não é possível excluir cliente com apólices vinculadas'
        });
      }

      const result = await pool.query('DELETE FROM clientes WHERE id = $1 AND empresa_id = $2 RETURNING id', [
        id,
        req.user.empresa_id,
      ]);

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