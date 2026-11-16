const pool = require('../config/database');

const MODALIDADES = ['todas', 'pf', 'adesao', 'pme', 'empresarial'];
const FK_VIOLATION = '23503';

const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Inteiro opcional >= minimo; '' / null → null; inválido → undefined
const optionalInt = (value, minimo) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= minimo ? n : undefined;
};

// Percentual opcional (0 a limite, até 2 casas); '' / null → null; inválido → undefined
const optionalPercent = (value, limite) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= limite ? Math.round(n * 100) / 100 : undefined;
};

// Valida o corpo. Retorna { fields } ou { error }.
const parseBody = (body) => {
  const nome = String(body.nome || '').trim();
  if (!nome) return { error: 'Nome da tabela é obrigatório' };

  const modalidade = body.modalidade || 'todas';
  if (!MODALIDADES.includes(modalidade)) return { error: 'Modalidade inválida' };

  if (!Array.isArray(body.percentuais_parcelas)) return { error: 'Informe os percentuais por parcela (lista)' };
  if (body.percentuais_parcelas.length > 24) return { error: 'Máximo de 24 parcelas de agenciamento' };
  // Limite = maior valor que cabe em DECIMAL(5,2) nas apólices/comissões
  const percentuais = body.percentuais_parcelas.map((p) => optionalPercent(p, 999.99));
  if (percentuais.some((p) => p === null || p === undefined)) {
    return { error: 'Percentual por parcela deve ser um número entre 0 e 999,99' };
  }

  const vitalicio = optionalPercent(body.vitalicio_percentual, 100);
  if (vitalicio === undefined) return { error: 'Vitalício deve ser um percentual entre 0 e 100' };

  const vitalicioMeses = optionalInt(body.vitalicio_meses, 1);
  if (vitalicioMeses === undefined) return { error: 'Duração do vitalício deve ser um número de meses maior que zero' };

  const estornoMeses = optionalInt(body.estorno_meses, 0);
  if (estornoMeses === undefined) return { error: 'Prazo de estorno deve ser um número de meses' };

  const inicio = body.vigencia_inicio ? String(body.vigencia_inicio).slice(0, 10) : null;
  const fim = body.vigencia_fim ? String(body.vigencia_fim).slice(0, 10) : null;
  if ((inicio && !isIsoDate(inicio)) || (fim && !isIsoDate(fim))) return { error: 'Vigência inválida' };
  if (inicio && fim && fim < inicio) return { error: 'Fim da vigência é anterior ao início' };

  if (percentuais.length === 0 && vitalicio === null) {
    return { error: 'Informe ao menos uma parcela de agenciamento ou o vitalício' };
  }

  return {
    fields: {
      nome,
      modalidade,
      percentuais_parcelas: percentuais,
      vitalicio_percentual: vitalicio,
      vitalicio_meses: vitalicio === null ? null : vitalicioMeses,
      estorno_meses: estornoMeses,
      vigencia_inicio: inicio,
      vigencia_fim: fim,
      ativa: body.ativa === undefined ? true : body.ativa === true || body.ativa === 'true',
      observacoes: String(body.observacoes || '').trim() || null,
    },
  };
};

// NUMERIC vem do pg como texto; devolve números para o front
const SELECT = `
  SELECT id, seguradora_id, nome, modalidade,
         percentuais_parcelas::float8[] AS percentuais_parcelas,
         vitalicio_percentual::float8 AS vitalicio_percentual,
         vitalicio_meses, estorno_meses,
         to_char(vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
         to_char(vigencia_fim, 'YYYY-MM-DD') AS vigencia_fim,
         ativa, observacoes, created_at, updated_at
  FROM tabelas_comissao`;

// A tabela pertence à empresa da seguradora dona dela
const DA_EMPRESA = (param) => `seguradora_id IN (SELECT id FROM seguradoras WHERE empresa_id = ${param})`;

const tabelasComissaoController = {
  // GET /seguradoras/:seguradoraId/tabelas-comissao
  async index(req, res) {
    try {
      const result = await pool.query(
        `${SELECT} WHERE seguradora_id = $1 AND ${DA_EMPRESA('$2')} ORDER BY ativa DESC, nome`,
        [req.params.seguradoraId, req.user.empresa_id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar tabelas de comissão:', error);
      res.status(500).json({ error: 'Erro ao listar tabelas de comissão' });
    }
  },

  // POST /seguradoras/:seguradoraId/tabelas-comissao
  async create(req, res) {
    try {
      const parsed = parseBody(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const seguradora = await pool.query('SELECT id FROM seguradoras WHERE id = $1 AND empresa_id = $2', [
        req.params.seguradoraId,
        req.user.empresa_id,
      ]);
      if (seguradora.rows.length === 0) return res.status(404).json({ error: 'Seguradora não encontrada' });

      const values = { seguradora_id: req.params.seguradoraId, ...parsed.fields };
      const columns = Object.keys(values);
      const inserted = await pool.query(
        `INSERT INTO tabelas_comissao (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING id`,
        Object.values(values)
      );
      const result = await pool.query(`${SELECT} WHERE id = $1`, [inserted.rows[0].id]);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === FK_VIOLATION) return res.status(404).json({ error: 'Seguradora não encontrada' });
      console.error('Erro ao criar tabela de comissão:', error);
      res.status(500).json({ error: 'Erro ao criar tabela de comissão' });
    }
  },

  // PUT /tabelas-comissao/:id
  async update(req, res) {
    try {
      const parsed = parseBody(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const entries = Object.entries(parsed.fields);
      const updated = await pool.query(
        `UPDATE tabelas_comissao
         SET ${entries.map(([c], i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${entries.length + 1} AND ${DA_EMPRESA(`$${entries.length + 2}`)}
         RETURNING id`,
        [...entries.map(([, v]) => v), req.params.id, req.user.empresa_id]
      );
      if (updated.rows.length === 0) return res.status(404).json({ error: 'Tabela não encontrada' });

      const result = await pool.query(`${SELECT} WHERE id = $1`, [req.params.id]);
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar tabela de comissão:', error);
      res.status(500).json({ error: 'Erro ao atualizar tabela de comissão' });
    }
  },

  // DELETE /tabelas-comissao/:id
  async delete(req, res) {
    try {
      const result = await pool.query(
        `DELETE FROM tabelas_comissao WHERE id = $1 AND ${DA_EMPRESA('$2')} RETURNING id`,
        [req.params.id, req.user.empresa_id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Tabela não encontrada' });
      res.json({ message: 'Tabela de comissão excluída' });
    } catch (error) {
      console.error('Erro ao excluir tabela de comissão:', error);
      res.status(500).json({ error: 'Erro ao excluir tabela de comissão' });
    }
  },
};

module.exports = tabelasComissaoController;
