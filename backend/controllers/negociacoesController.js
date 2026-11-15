const pool = require('../config/database');

const ETAPAS = [
  'sem_contato',
  'contato_feito',
  'follow_up',
  'identificacao_interesse',
  'apresentacao',
  'proposta_enviada',
];
const STATUS = ['em_andamento', 'vendida', 'perdida'];
const FK_VIOLATION = '23503';

// proxima_acao_em é hora local (sem fuso). Devolve como texto "AAAA-MM-DDTHH:MM" para o
// navegador não converter de UTC e mostrar a hora errada.
const SELECT_NEGOCIACOES = `
  SELECT n.id, n.cliente_id, n.corretor_id, n.titulo, n.etapa, n.status, n.motivo_perda,
         n.proxima_acao,
         to_char(n.proxima_acao_em, 'YYYY-MM-DD"T"HH24:MI') AS proxima_acao_em,
         n.observacoes, n.created_at, n.updated_at,
         c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.idades AS cliente_idades,
         co.nome AS corretor_nome
  FROM negociacoes n
  JOIN clientes c ON c.id = n.cliente_id
  LEFT JOIN corretores co ON co.id = n.corretor_id`;

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const parseId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

// "AAAA-MM-DDTHH:MM" (input datetime-local) ou vazio
const parseDataHora = (value) => {
  const text = emptyToNull(value);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text) ? text : undefined;
};

// Valida o corpo de criação/edição. Retorna { fields } ou { error }.
const parseBody = (body) => {
  const clienteId = parseId(body.cliente_id);
  if (!clienteId) return { error: 'Cliente é obrigatório' };

  const corretorId = parseId(body.corretor_id);
  if (corretorId === undefined) return { error: 'Corretor inválido' };

  const etapa = body.etapa || 'sem_contato';
  if (!ETAPAS.includes(etapa)) return { error: 'Etapa inválida' };

  const status = body.status || 'em_andamento';
  if (!STATUS.includes(status)) return { error: 'Status inválido' };

  const proximaAcaoEm = parseDataHora(body.proxima_acao_em);
  if (proximaAcaoEm === undefined) return { error: 'Data da próxima ação inválida' };

  return {
    fields: {
      cliente_id: clienteId,
      corretor_id: corretorId,
      titulo: emptyToNull(body.titulo),
      etapa,
      status,
      motivo_perda: status === 'perdida' ? emptyToNull(body.motivo_perda) : null,
      proxima_acao: emptyToNull(body.proxima_acao),
      proxima_acao_em: proximaAcaoEm,
      observacoes: emptyToNull(body.observacoes),
    },
  };
};

const fetchById = async (id) => {
  const result = await pool.query(`${SELECT_NEGOCIACOES} WHERE n.id = $1`, [id]);
  return result.rows[0];
};

const negociacoesController = {
  // GET /negociacoes?status=em_andamento&corretor_id=1|sem&busca=texto
  // Ordena pela próxima ação (atrasadas primeiro); sem próxima ação vão para o fim.
  async index(req, res) {
    try {
      const { status, corretor_id, busca } = req.query;
      const conditions = [];
      const params = [];

      if (status) {
        if (!STATUS.includes(status)) return res.status(400).json({ error: 'Status inválido' });
        params.push(status);
        conditions.push(`n.status = $${params.length}`);
      }

      if (corretor_id === 'sem') {
        conditions.push('n.corretor_id IS NULL');
      } else if (corretor_id) {
        const id = parseId(corretor_id);
        if (!id) return res.status(400).json({ error: 'Corretor inválido' });
        params.push(id);
        conditions.push(`n.corretor_id = $${params.length}`);
      }

      const termo = (busca || '').trim();
      if (termo) {
        params.push(`%${termo.replace(/[\\%_]/g, '\\$&')}%`);
        const p = `$${params.length}`;
        conditions.push(`(c.nome ILIKE ${p} OR n.titulo ILIKE ${p} OR n.proxima_acao ILIKE ${p})`);
      }

      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `${SELECT_NEGOCIACOES}${where}
         ORDER BY n.proxima_acao_em ASC NULLS LAST, n.created_at ASC`,
        params
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar negociações:', error);
      res.status(500).json({ error: 'Erro ao listar negociações' });
    }
  },

  async create(req, res) {
    try {
      const parsed = parseBody(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const columns = Object.keys(parsed.fields);
      const result = await pool.query(
        `INSERT INTO negociacoes (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING id`,
        Object.values(parsed.fields)
      );
      res.status(201).json(await fetchById(result.rows[0].id));
    } catch (error) {
      if (error.code === FK_VIOLATION) {
        return res.status(400).json({ error: 'Cliente ou corretor não encontrado' });
      }
      console.error('Erro ao criar negociação:', error);
      res.status(500).json({ error: 'Erro ao criar negociação' });
    }
  },

  async update(req, res) {
    try {
      const parsed = parseBody(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const entries = Object.entries(parsed.fields);
      const sets = entries.map(([column], i) => `${column} = $${i + 1}`);
      const result = await pool.query(
        `UPDATE negociacoes
         SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${entries.length + 1}
         RETURNING id`,
        [...entries.map(([, value]) => value), req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }
      res.json(await fetchById(result.rows[0].id));
    } catch (error) {
      if (error.code === FK_VIOLATION) {
        return res.status(400).json({ error: 'Cliente ou corretor não encontrado' });
      }
      console.error('Erro ao atualizar negociação:', error);
      res.status(500).json({ error: 'Erro ao atualizar negociação' });
    }
  },

  // PATCH /negociacoes/:id/etapa { etapa } — usado ao arrastar o cartão no quadro
  async moverEtapa(req, res) {
    try {
      const { etapa } = req.body;
      if (!ETAPAS.includes(etapa)) return res.status(400).json({ error: 'Etapa inválida' });

      const result = await pool.query(
        `UPDATE negociacoes SET etapa = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING id`,
        [etapa, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }
      res.json(await fetchById(result.rows[0].id));
    } catch (error) {
      console.error('Erro ao mover negociação:', error);
      res.status(500).json({ error: 'Erro ao mover negociação' });
    }
  },

  // POST /negociacoes/distribuir { negociacao_ids: [...], corretor_ids: [...] }
  // Divide as negociações igualmente entre os corretores (rodízio, na ordem enviada).
  // O cliente de cada negociação também recebe o corretor, se ainda não tiver um.
  async distribuir(req, res) {
    const negociacaoIds = [...new Set((req.body.negociacao_ids || []).map(parseId))];
    const corretorIds = [...new Set((req.body.corretor_ids || []).map(parseId))];

    if (negociacaoIds.length === 0 || negociacaoIds.some((id) => !id)) {
      return res.status(400).json({ error: 'Selecione ao menos uma negociação' });
    }
    if (corretorIds.length === 0 || corretorIds.some((id) => !id)) {
      return res.status(400).json({ error: 'Selecione ao menos um corretor' });
    }
    if (negociacaoIds.length > 1000) {
      return res.status(400).json({ error: 'Máximo de 1000 negociações por vez' });
    }

    const db = await pool.connect();
    try {
      const corretores = await db.query('SELECT id FROM corretores WHERE id = ANY($1)', [corretorIds]);
      if (corretores.rows.length !== corretorIds.length) {
        return res.status(400).json({ error: 'Corretor não encontrado' });
      }

      // Pares (negociação, corretor) em rodízio
      const atribuicoes = negociacaoIds.map((id, i) => [id, corretorIds[i % corretorIds.length]]);

      await db.query('BEGIN');
      const atualizadas = await db.query(
        `UPDATE negociacoes n
         SET corretor_id = a.corretor_id, updated_at = CURRENT_TIMESTAMP
         FROM unnest($1::int[], $2::int[]) AS a(negociacao_id, corretor_id)
         WHERE n.id = a.negociacao_id
         RETURNING n.id, n.cliente_id, n.corretor_id`,
        [atribuicoes.map(([n]) => n), atribuicoes.map(([, c]) => c)]
      );

      // Clientes sem corretor recebem o corretor da negociação
      await db.query(
        `UPDATE clientes c
         SET corretor_id = a.corretor_id, updated_at = CURRENT_TIMESTAMP
         FROM unnest($1::int[], $2::int[]) AS a(cliente_id, corretor_id)
         WHERE c.id = a.cliente_id AND c.corretor_id IS NULL`,
        [atualizadas.rows.map((r) => r.cliente_id), atualizadas.rows.map((r) => r.corretor_id)]
      );
      await db.query('COMMIT');

      const porCorretor = {};
      for (const row of atualizadas.rows) porCorretor[row.corretor_id] = (porCorretor[row.corretor_id] || 0) + 1;

      res.json({ total: atualizadas.rows.length, por_corretor: porCorretor });
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {});
      console.error('Erro ao distribuir negociações:', error);
      res.status(500).json({ error: 'Erro ao distribuir negociações' });
    } finally {
      db.release();
    }
  },

  async delete(req, res) {
    try {
      const result = await pool.query('DELETE FROM negociacoes WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Negociação não encontrada' });
      }
      res.json({ message: 'Negociação excluída' });
    } catch (error) {
      console.error('Erro ao excluir negociação:', error);
      res.status(500).json({ error: 'Erro ao excluir negociação' });
    }
  },
};

module.exports = negociacoesController;
