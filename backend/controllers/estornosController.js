// Estorno (spec 005): aviso de cancelamento (etapa 1), conclusão (etapa 2), dívida com a plataforma,
// saldos dos corretores, monitoramento do período e relatório do financeiro.
const pool = require('../config/database');
const { escopoCorretor } = require('../utils/permissoes');
const { dataBrasil, competenciaBrasil, SQL_HOJE_BRASIL } = require('../utils/dataBrasil');
const {
  MOTIVOS_CANCELAMENTO,
  FORMAS_COBRANCA,
  DIAS_DESTAQUE,
  sqlFimPeriodo,
  devolverDescontos,
} = require('../utils/estorno');

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const COMPETENCIA = /^\d{4}-\d{2}$/;
const valorPositivo = (v) => {
  const n = Number(v);
  return v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const lerData = (v) => {
  const d = v ? String(v).slice(0, 10) : dataBrasil();
  return DATA_ISO.test(d) ? d : null;
};

// Transação com rollback garantido; `fn` devolve { status, body }
const emTransacao = async (res, mensagemErro, fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { status, body, rollback } = await fn(client);
    await client.query(rollback ? 'ROLLBACK' : 'COMMIT');
    res.status(status).json(body);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${mensagemErro}:`, error);
    res.status(500).json({ error: mensagemErro });
  } finally {
    client.release();
  }
};
const falha = (status, error) => ({ status, body: { error }, rollback: true });

const estornosController = {
  // POST /apolices/:id/cancelamento { data_cancelamento?, motivo, motivo_descricao? } — etapa 1 (RN-04/05/13)
  async avisarCancelamento(req, res) {
    const motivo = req.body.motivo;
    const descricao = String(req.body.motivo_descricao || '').trim() || null;
    const data = lerData(req.body.data_cancelamento);
    if (!MOTIVOS_CANCELAMENTO.includes(motivo)) {
      return res.status(400).json({ error: 'Informe o motivo do cancelamento' });
    }
    if (motivo === 'outro' && !descricao) {
      return res.status(400).json({ error: 'Descreva o motivo do cancelamento' });
    }
    if (!data) return res.status(400).json({ error: 'Data do cancelamento inválida' });

    return emTransacao(res, 'Erro ao registrar cancelamento', async (db) => {
      const ap = await db.query(
        `SELECT a.*, to_char(${sqlFimPeriodo()}, 'YYYY-MM-DD') AS fim_periodo
         FROM apolices a
         LEFT JOIN tabelas_comissao t ON t.id = a.tabela_comissao_id
         WHERE a.id = $1 AND a.empresa_id = $2
         FOR UPDATE OF a`,
        [req.params.id, req.user.empresa_id]
      );
      const apolice = ap.rows[0];
      if (!apolice) return falha(404, 'Apólice não encontrada');
      if (apolice.status === 'cancelada') return falha(400, 'Esta apólice já foi cancelada');

      const fim = apolice.fim_periodo;
      const houveEstorno = Boolean(fim) && data <= fim;

      const atualizada = await db.query(
        `UPDATE apolices
         SET status = 'cancelada', data_cancelamento = $1, motivo_cancelamento = $2,
             motivo_cancelamento_descricao = $3, cancelamento_registrado_por = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, numero_apolice, status, data_cancelamento, motivo_cancelamento, motivo_cancelamento_descricao`,
        [data, motivo, descricao, req.user.id, apolice.id]
      );

      // Comissões ainda não recebidas não vão mais chegar (RN-13)
      await db.query(
        `UPDATE comissoes SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP
         WHERE apolice_id = $1 AND status IN ('prevista', 'atrasada')`,
        [apolice.id]
      );

      let repasseCancelado = false;
      let estornoId = null;
      if (houveEstorno) {
        // Repasse ainda não pago da parcela 1 não pode mais ser pago (D5)
        const pendentes = await db.query(
          `SELECT r.id FROM repasses r JOIN comissoes c ON c.id = r.comissao_id
           WHERE c.apolice_id = $1 AND c.numero_parcela = 1 AND r.status = 'pendente'
           FOR UPDATE OF r`,
          [apolice.id]
        );
        for (const r of pendentes.rows) {
          await devolverDescontos(db, { repasseId: r.id, novoMaximo: 0, data, usuarioId: req.user.id });
          await db.query(`UPDATE repasses SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [r.id]);
          repasseCancelado = true;
        }

        // Corretor que recebeu (ou receberia) a parcela 1; sem comissão, o responsável pela apólice
        const p1 = await db.query('SELECT corretor_id FROM comissoes WHERE apolice_id = $1 AND numero_parcela = 1', [
          apolice.id,
        ]);
        const estorno = await db.query(
          `INSERT INTO estornos (empresa_id, apolice_id, seguradora_id, corretor_id, data_cancelamento, fim_periodo_estorno)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [apolice.empresa_id, apolice.id, apolice.seguradora_id, p1.rows[0]?.corretor_id ?? apolice.corretor_responsavel_id, data, fim]
        );
        estornoId = estorno.rows[0].id;
      }

      return {
        status: 200,
        body: {
          apolice: atualizada.rows[0],
          houve_estorno: houveEstorno,
          fim_periodo_estorno: fim,
          repasse_cancelado: repasseCancelado,
          estorno_id: estornoId,
        },
      };
    });
  },

  // PUT /estornos/:id/concluir { valor_estornado, forma_cobranca } — etapa 2 (RN-06/10/17)
  async concluir(req, res) {
    const valor = valorPositivo(req.body.valor_estornado);
    const forma = req.body.forma_cobranca;
    if (!valor) return res.status(400).json({ error: 'Informe o valor estornado pela plataforma' });
    if (!FORMAS_COBRANCA.includes(forma)) {
      return res.status(400).json({ error: 'Informe como a plataforma vai cobrar (desconto ou PIX/boleto)' });
    }

    return emTransacao(res, 'Erro ao concluir estorno', async (db) => {
      const e = await db.query('SELECT * FROM estornos WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [
        req.params.id,
        req.user.empresa_id,
      ]);
      const estorno = e.rows[0];
      if (!estorno) return falha(404, 'Estorno não encontrado');
      if (estorno.status !== 'aguardando_conclusao') return falha(400, 'Este estorno já foi concluído');

      // Repasse da parcela 1 já pago: 100% do que o corretor ganhou naquela apólice volta (D3)
      const pago = await db.query(
        `SELECT r.id, r.valor_repasse, r.corretor_destino_id, cor.status AS corretor_status
         FROM repasses r
         JOIN comissoes c ON c.id = r.comissao_id
         JOIN corretores cor ON cor.id = r.corretor_destino_id
         WHERE c.apolice_id = $1 AND c.numero_parcela = 1 AND r.status = 'pago'`,
        [estorno.apolice_id]
      );
      const repasse = pago.rows[0];
      // Estorno depois do desligamento: a corretora assume (D12)
      const assumido = Boolean(repasse) && repasse.corretor_status === 'inativo';

      let saldo = null;
      if (repasse && !assumido) {
        const s = await db.query(
          `INSERT INTO saldos_corretor (empresa_id, corretor_id, estorno_id, valor_original, valor_restante)
           VALUES ($1, $2, $3, $4, $4) RETURNING *`,
          [estorno.empresa_id, repasse.corretor_destino_id, estorno.id, repasse.valor_repasse]
        );
        saldo = s.rows[0];
      }

      const atualizado = await db.query(
        `UPDATE estornos
         SET status = $1, valor_estornado = $2, forma_cobranca = $3, assumido_pela_corretora = $4,
             concluido_por = $5, concluido_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 RETURNING *`,
        [forma === 'desconto_plataforma' ? 'a_descontar' : 'a_pagar', valor, forma, assumido, req.user.id, estorno.id]
      );
      return { status: 200, body: { estorno: atualizado.rows[0], saldo } };
    });
  },

  // PUT /estornos/:id/liquidar { data? } — plataforma descontou / corretora pagou (RN-18)
  async liquidar(req, res) {
    const data = lerData(req.body.data);
    if (!data) return res.status(400).json({ error: 'Data inválida' });
    try {
      const r = await pool.query(
        `UPDATE estornos
         SET status = CASE status WHEN 'a_descontar' THEN 'descontado' ELSE 'pago' END,
             data_liquidacao = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND empresa_id = $3 AND status IN ('a_descontar', 'a_pagar')
         RETURNING *`,
        [data, req.params.id, req.user.empresa_id]
      );
      if (r.rows.length === 0) {
        const existe = await pool.query('SELECT status FROM estornos WHERE id = $1 AND empresa_id = $2', [
          req.params.id,
          req.user.empresa_id,
        ]);
        if (existe.rows.length === 0) return res.status(404).json({ error: 'Estorno não encontrado' });
        return res.status(400).json({ error: 'Só estornos a descontar ou a pagar podem ser liquidados' });
      }
      res.json(r.rows[0]);
    } catch (error) {
      console.error('Erro ao liquidar estorno:', error);
      res.status(500).json({ error: 'Erro ao liquidar estorno' });
    }
  },

  // GET /estornos?status=
  async index(req, res) {
    try {
      const params = [req.user.empresa_id];
      let filtro = '';
      if (req.query.status) {
        params.push(req.query.status);
        filtro = ` AND e.status = $${params.length}`;
      }
      const r = await pool.query(
        `SELECT e.*, to_char(e.data_cancelamento, 'YYYY-MM-DD') AS data_cancelamento,
                to_char(e.fim_periodo_estorno, 'YYYY-MM-DD') AS fim_periodo_estorno,
                to_char(e.data_liquidacao, 'YYYY-MM-DD') AS data_liquidacao,
                a.numero_apolice, a.motivo_cancelamento, a.motivo_cancelamento_descricao,
                cl.nome AS cliente_nome, s.nome AS seguradora_nome, cor.nome AS corretor_nome,
                sc.id AS saldo_id, sc.valor_original AS saldo_valor
         FROM estornos e
         JOIN apolices a ON a.id = e.apolice_id
         LEFT JOIN clientes cl ON cl.id = a.cliente_id
         LEFT JOIN seguradoras s ON s.id = e.seguradora_id
         LEFT JOIN corretores cor ON cor.id = e.corretor_id
         LEFT JOIN saldos_corretor sc ON sc.estorno_id = e.id
         WHERE e.empresa_id = $1${filtro}
         ORDER BY (e.status = 'aguardando_conclusao') DESC, e.data_cancelamento DESC`,
        params
      );
      res.json(r.rows);
    } catch (error) {
      console.error('Erro ao listar estornos:', error);
      res.status(500).json({ error: 'Erro ao listar estornos' });
    }
  },

  // GET /monitoramento-estorno → { em_periodo, cancelamentos_mes } — sem valores (RN-02/15/16)
  async monitoramento(req, res) {
    try {
      const params = [req.user.empresa_id];
      let escopo = '';
      const corretor = escopoCorretor(req);
      if (corretor !== null) {
        params.push(corretor);
        escopo = ` AND a.corretor_responsavel_id = $${params.length}`;
      }
      const fim = sqlFimPeriodo();
      const [emPeriodo, cancelamentos] = await Promise.all([
        pool.query(
          `SELECT a.id AS apolice_id, a.numero_apolice, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone,
                  s.nome AS seguradora_nome, cor.nome AS corretor_nome,
                  to_char(a.data_inicio_vigencia, 'YYYY-MM-DD') AS inicio_vigencia,
                  to_char(${fim}, 'YYYY-MM-DD') AS fim_periodo,
                  (${fim} - ${SQL_HOJE_BRASIL}) AS dias_restantes,
                  (${fim} - ${SQL_HOJE_BRASIL}) <= ${DIAS_DESTAQUE} AS destaque
           FROM apolices a
           JOIN tabelas_comissao t ON t.id = a.tabela_comissao_id
           LEFT JOIN clientes cl ON cl.id = a.cliente_id
           LEFT JOIN seguradoras s ON s.id = a.seguradora_id
           LEFT JOIN corretores cor ON cor.id = a.corretor_responsavel_id
           WHERE a.empresa_id = $1 AND a.status = 'ativa' AND t.estorno_meses IS NOT NULL
             AND ${fim} >= ${SQL_HOJE_BRASIL}${escopo}
           ORDER BY ${fim}, a.id`,
          params
        ),
        pool.query(
          `SELECT a.id AS apolice_id, a.numero_apolice, cl.nome AS cliente_nome, s.nome AS seguradora_nome,
                  cor.nome AS corretor_nome, to_char(a.data_cancelamento, 'YYYY-MM-DD') AS data_cancelamento,
                  a.motivo_cancelamento, a.motivo_cancelamento_descricao,
                  EXISTS (SELECT 1 FROM estornos e WHERE e.apolice_id = a.id) AS houve_estorno
           FROM apolices a
           LEFT JOIN clientes cl ON cl.id = a.cliente_id
           LEFT JOIN seguradoras s ON s.id = a.seguradora_id
           LEFT JOIN corretores cor ON cor.id = a.corretor_responsavel_id
           WHERE a.empresa_id = $1 AND a.status = 'cancelada' AND a.data_cancelamento IS NOT NULL
             AND date_trunc('month', a.data_cancelamento) = date_trunc('month', ${SQL_HOJE_BRASIL})${escopo}
           ORDER BY a.data_cancelamento DESC, a.id`,
          params
        ),
      ]);
      res.json({ em_periodo: emPeriodo.rows, cancelamentos_mes: cancelamentos.rows });
    } catch (error) {
      console.error('Erro ao montar o monitoramento:', error);
      res.status(500).json({ error: 'Erro ao montar o monitoramento' });
    }
  },

  // GET /saldos-corretor?status=&corretor_id= — com o histórico de movimentos (RN-08)
  async saldos(req, res) {
    try {
      const params = [req.user.empresa_id];
      let filtro = '';
      if (req.query.status) {
        params.push(req.query.status);
        filtro += ` AND sc.status = $${params.length}`;
      }
      if (req.query.corretor_id) {
        params.push(req.query.corretor_id);
        filtro += ` AND sc.corretor_id = $${params.length}`;
      }
      const r = await pool.query(
        `SELECT sc.*, cor.nome AS corretor_nome, a.numero_apolice, cl.nome AS cliente_nome,
                COALESCE((SELECT json_agg(json_build_object(
                    'id', m.id, 'tipo', m.tipo, 'valor', m.valor, 'data', to_char(m.data, 'YYYY-MM-DD'),
                    'repasse_id', m.repasse_id, 'observacao', m.observacao) ORDER BY m.id)
                  FROM saldo_movimentos m WHERE m.saldo_id = sc.id), '[]') AS movimentos
         FROM saldos_corretor sc
         JOIN estornos e ON e.id = sc.estorno_id
         JOIN apolices a ON a.id = e.apolice_id
         LEFT JOIN clientes cl ON cl.id = a.cliente_id
         LEFT JOIN corretores cor ON cor.id = sc.corretor_id
         WHERE sc.empresa_id = $1${filtro}
         ORDER BY (sc.status = 'pendente') DESC, sc.created_at`,
        params
      );
      res.json(r.rows);
    } catch (error) {
      console.error('Erro ao listar saldos:', error);
      res.status(500).json({ error: 'Erro ao listar saldos' });
    }
  },

  // PUT /saldos-corretor/:id/acordo { desconto_maximo_por_repasse | null } (RN-09)
  async acordo(req, res) {
    const bruto = req.body.desconto_maximo_por_repasse;
    const teto = bruto === null || bruto === '' || bruto === undefined ? null : valorPositivo(bruto);
    if (bruto !== null && bruto !== '' && bruto !== undefined && teto === null) {
      return res.status(400).json({ error: 'Valor do acordo inválido' });
    }
    try {
      const r = await pool.query(
        `UPDATE saldos_corretor SET desconto_maximo_por_repasse = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND empresa_id = $3 RETURNING *`,
        [teto, req.params.id, req.user.empresa_id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Saldo não encontrado' });
      res.json(r.rows[0]);
    } catch (error) {
      console.error('Erro ao registrar acordo:', error);
      res.status(500).json({ error: 'Erro ao registrar acordo' });
    }
  },

  // POST /saldos-corretor/:id/quitacoes { valor, data?, observacao } — total ou parcial (RN-09)
  async quitar(req, res) {
    const valor = valorPositivo(req.body.valor);
    const data = lerData(req.body.data);
    const observacao = String(req.body.observacao || '').trim() || null;
    if (!valor) return res.status(400).json({ error: 'Informe o valor quitado' });
    if (!data) return res.status(400).json({ error: 'Data inválida' });

    return emTransacao(res, 'Erro ao registrar quitação', async (db) => {
      const s = await db.query('SELECT * FROM saldos_corretor WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [
        req.params.id,
        req.user.empresa_id,
      ]);
      const saldo = s.rows[0];
      if (!saldo) return falha(404, 'Saldo não encontrado');
      if (saldo.status !== 'pendente') return falha(400, 'Este saldo já está quitado');
      if (Math.round(valor * 100) > Math.round(Number(saldo.valor_restante) * 100)) {
        return falha(400, `O valor passa do restante do saldo (R$ ${saldo.valor_restante})`);
      }
      await db.query(
        `INSERT INTO saldo_movimentos (saldo_id, tipo, valor, data, observacao, usuario_id)
         VALUES ($1, 'quitacao_manual', $2, $3, $4, $5)`,
        [saldo.id, valor, data, observacao, req.user.id]
      );
      const r = await db.query(
        `UPDATE saldos_corretor
         SET valor_restante = valor_restante - $1,
             status = CASE WHEN valor_restante - $1 <= 0 THEN 'quitado' ELSE 'pendente' END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [valor, saldo.id]
      );
      return { status: 200, body: r.rows[0] };
    });
  },

  // GET /relatorios/plataforma?competencia=AAAA-MM — por operadora (RN-20)
  async relatorioPlataforma(req, res) {
    const competencia = req.query.competencia || competenciaBrasil();
    if (!COMPETENCIA.test(competencia)) return res.status(400).json({ error: 'Competência inválida (AAAA-MM)' });
    try {
      const r = await pool.query(
        `WITH com AS (
           SELECT a.seguradora_id,
                  SUM(c.valor_comissao_bruto) FILTER (WHERE c.status IN ('prevista', 'atrasada')) AS a_receber,
                  SUM(c.valor_comissao_liquido) FILTER (WHERE c.status = 'recebida') AS recebido
           FROM comissoes c JOIN apolices a ON a.id = c.apolice_id
           WHERE c.empresa_id = $1 AND c.competencia = $2
           GROUP BY a.seguradora_id
         ), est AS (
           SELECT seguradora_id,
                  SUM(valor_estornado) FILTER (WHERE status = 'a_descontar') AS a_descontar,
                  SUM(valor_estornado) FILTER (WHERE status = 'a_pagar') AS a_pagar,
                  COUNT(*) FILTER (WHERE status = 'aguardando_conclusao') AS aguardando
           FROM estornos WHERE empresa_id = $1
           GROUP BY seguradora_id
         )
         SELECT s.id AS seguradora_id, s.nome AS seguradora_nome,
                COALESCE(com.a_receber, 0)::numeric(12,2) AS a_receber,
                COALESCE(com.recebido, 0)::numeric(12,2) AS recebido,
                COALESCE(est.a_descontar, 0)::numeric(12,2) AS estornos_a_descontar,
                (COALESCE(com.a_receber, 0) - COALESCE(est.a_descontar, 0))::numeric(12,2) AS liquido_esperado,
                COALESCE(est.a_pagar, 0)::numeric(12,2) AS estornos_a_pagar,
                COALESCE(est.aguardando, 0)::int AS estornos_aguardando_conclusao
         FROM seguradoras s
         LEFT JOIN com ON com.seguradora_id = s.id
         LEFT JOIN est ON est.seguradora_id = s.id
         WHERE s.empresa_id = $1 AND (com.seguradora_id IS NOT NULL OR est.seguradora_id IS NOT NULL)
         ORDER BY s.nome`,
        [req.user.empresa_id, competencia]
      );
      res.json({ competencia, operadoras: r.rows });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
  },
};

module.exports = estornosController;
