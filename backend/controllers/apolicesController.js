const pool = require('../config/database');
const { regraDaParcela, dataPrevisaoRecebimento, valorComissao, diaVencimentoValido } = require('../utils/comissaoParcela');
const { pode, escopoCorretor } = require('../utils/permissoes');
const { competenciaBrasil, dataBrasil } = require('../utils/dataBrasil');

const DIA_VENCIMENTO_OBRIGATORIO = 'Informe o dia de vencimento do boleto (1 a 31): ele define a previsão de recebimento';

// Comissões ainda não recebidas acompanham a apólice (spec 002/RN-19): mudar a mensalidade ou o dia
// de vencimento recalcula valor e previsão. Comissões recebidas não mudam (o dinheiro já entrou).
const recalcularPendentes = async (db, apolice) => {
  if (!diaVencimentoValido(apolice.dia_vencimento)) return;
  const pendentes = await db.query(
    `SELECT id, competencia, percentual_comissao FROM comissoes
     WHERE apolice_id = $1 AND status IN ('prevista', 'atrasada')`,
    [apolice.id]
  );
  const hoje = dataBrasil();
  for (const c of pendentes.rows) {
    const valor = valorComissao(apolice.valor_premio_mensal, c.percentual_comissao);
    const previsao = dataPrevisaoRecebimento(c.competencia, apolice.dia_vencimento);
    // Se a nova previsão não está mais atrasada (RN-11), volta para prevista
    await db.query(
      `UPDATE comissoes
       SET valor_premio = $1, valor_comissao_bruto = $2, valor_comissao_liquido = $2,
           data_previsao_recebimento = $3,
           status = CASE WHEN status = 'atrasada' AND $3::date >= $4::date - 5 THEN 'prevista' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [apolice.valor_premio_mensal, valor, previsao, hoje, c.id]
    );
  }
};

// Define como a apólice comissiona: sempre pela tabela de comissão da seguradora — a tabela é o
// retorno da seguradora e traz também o prazo de estorno (spec 005/RN-03, D6). O percentual guardado
// na apólice é o da 1ª parcela (referência). Retorna { tabela, percentualApolice } ou { error }.
const resolverComissao = async (db, body, seguradoraId) => {
  const tabelaId = body.tabela_comissao_id ? Number(body.tabela_comissao_id) : null;
  if (!tabelaId) return { error: 'Escolha a tabela de comissão da seguradora' };

  const result = await db.query('SELECT * FROM tabelas_comissao WHERE id = $1', [tabelaId]);
  const tabela = result.rows[0];
  if (!tabela || String(tabela.seguradora_id) !== String(seguradoraId)) {
    return { error: 'Tabela de comissão não pertence à seguradora escolhida' };
  }
  const primeira = regraDaParcela(1, tabela, null);
  return { tabela, percentualApolice: primeira ? primeira.percentual : 0 };
};

// Cliente, seguradora e corretor precisam ser da empresa. Retorna { seguradora } ou { error }.
const validarVinculos = async (db, body, empresaId) => {
  const [cliente, seguradora, corretor] = await Promise.all([
    db.query('SELECT 1 FROM clientes WHERE id = $1 AND empresa_id = $2', [body.cliente_id, empresaId]),
    db.query('SELECT * FROM seguradoras WHERE id = $1 AND empresa_id = $2', [body.seguradora_id, empresaId]),
    db.query('SELECT 1 FROM corretores WHERE id = $1 AND empresa_id = $2', [body.corretor_responsavel_id, empresaId]),
  ]);
  if (cliente.rows.length === 0) return { error: 'Cliente não encontrado' };
  if (seguradora.rows.length === 0) return { error: 'Seguradora não encontrada' };
  if (corretor.rows.length === 0) return { error: 'Corretor não encontrado' };
  return { seguradora: seguradora.rows[0] };
};

// Quem não vê comissões (corretor, pós-venda) recebe a apólice sem os dados de comissão
const CAMPOS_COMISSAO = ['percentual_comissao', 'tabela_comissao_id', 'tabela_comissao_nome'];
const semComissao = (apolice) =>
  Object.fromEntries(Object.entries(apolice).filter(([campo]) => !CAMPOS_COMISSAO.includes(campo)));

// Cancelar só pelo fluxo próprio (spec 005/CA-18): ele registra motivo, estorno e saldos.
// Apólice cancelada não volta a ativa pela edição. Retorna mensagem de erro ou null.
const STATUS_DE_EDICAO = ['ativa', 'suspensa'];
const erroDeStatus = (atual, novo) => {
  if (novo === undefined || novo === null || novo === '') return null;
  if (atual === 'cancelada') return novo === 'cancelada' ? null : 'Apólice cancelada não pode ser reativada';
  if (!STATUS_DE_EDICAO.includes(novo)) {
    return novo === 'cancelada'
      ? 'Para cancelar a apólice, use "Registrar cancelamento" (motivo e estorno ficam registrados)'
      : 'Status inválido';
  }
  return null;
};

// Campos que o pós-venda pode alterar (operacionais, sem impacto em comissão)
const CAMPOS_POS_VENDA = ['numero_apolice', 'status', 'data_inicio_vigencia', 'data_fim_vigencia', 'dia_vencimento', 'observacoes'];

const apolicesController = {
  // GET /apolices — da empresa; corretor vê só as próprias
  async index(req, res) {
    try {
      const { status, cliente_id, corretor_id } = req.query;
      const params = [req.user.empresa_id];
      let query = `
        SELECT a.*,
               c.nome as cliente_nome,
               s.nome as seguradora_nome,
               cor.nome as corretor_nome,
               t.nome as tabela_comissao_nome
        FROM apolices a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN seguradoras s ON a.seguradora_id = s.id
        LEFT JOIN corretores cor ON a.corretor_responsavel_id = cor.id
        LEFT JOIN tabelas_comissao t ON a.tabela_comissao_id = t.id
        WHERE a.empresa_id = $1
      `;

      if (status) {
        params.push(status);
        query += ` AND a.status = $${params.length}`;
      }

      if (cliente_id) {
        params.push(cliente_id);
        query += ` AND a.cliente_id = $${params.length}`;
      }

      const escopo = escopoCorretor(req);
      if (escopo !== null) {
        params.push(escopo);
        query += ` AND a.corretor_responsavel_id = $${params.length}`;
      } else if (corretor_id) {
        params.push(corretor_id);
        query += ` AND a.corretor_responsavel_id = $${params.length}`;
      }

      query += ' ORDER BY a.created_at DESC';
      const result = await pool.query(query, params);
      const verComissao = pode(req.user.role, 'apolices.ver_comissao');
      res.json(verComissao ? result.rows : result.rows.map(semComissao));
    } catch (error) {
      console.error('Erro ao listar apólices:', error);
      res.status(500).json({ error: 'Erro ao listar apólices' });
    }
  },

  // Criar nova apólice e gerar a comissão da 1ª parcela (competência atual)
  async create(req, res) {
    const client = await pool.connect();
    try {
      const {
        cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
        tipo_seguro, valor_premio_mensal,
        data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes
      } = req.body;
      const empresaId = req.user.empresa_id;

      // Validações antes de gravar qualquer coisa
      const erroStatus = erroDeStatus(null, status);
      if (erroStatus) return res.status(400).json({ error: erroStatus });

      const vinculos = await validarVinculos(client, req.body, empresaId);
      if (vinculos.error) return res.status(400).json({ error: vinculos.error });
      // A previsão de recebimento vem do vencimento do boleto: sem ele a data sairia errada (RN-07)
      if (!diaVencimentoValido(dia_vencimento)) return res.status(400).json({ error: DIA_VENCIMENTO_OBRIGATORIO });

      const resolvida = await resolverComissao(client, req.body, seguradora_id);
      if (resolvida.error) return res.status(400).json({ error: resolvida.error });
      const { tabela, percentualApolice } = resolvida;

      const regra = regraDaParcela(1, tabela, percentualApolice);

      await client.query('BEGIN');
      const apoliceResult = await client.query(
        `INSERT INTO apolices (cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
                                tipo_seguro, valor_premio_mensal, percentual_comissao, tabela_comissao_id,
                                data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes, empresa_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
         tipo_seguro, valor_premio_mensal, percentualApolice, tabela?.id ?? null,
         data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status || 'ativa', observacoes, empresaId]
      );
      const apolice = apoliceResult.rows[0];

      // Comissão da 1ª parcela no mês atual em Brasília (se a regra gerar comissão)
      if (regra) {
        const competencia = competenciaBrasil();
        const valor = valorComissao(valor_premio_mensal, regra.percentual);

        await client.query(
          `INSERT INTO comissoes (apolice_id, corretor_id, competencia, numero_parcela, tipo, valor_premio,
                                  percentual_comissao, valor_comissao_bruto, valor_comissao_liquido,
                                  data_previsao_recebimento, status, empresa_id)
           VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $7, $8, 'prevista', $9)`,
          [apolice.id, corretor_responsavel_id, competencia, regra.tipo, valor_premio_mensal,
           regra.percentual, valor, dataPrevisaoRecebimento(competencia, dia_vencimento), empresaId]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(apolice);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Já existe uma apólice com este número' });
      }
      console.error('Erro ao criar apólice:', error);
      res.status(500).json({ error: 'Erro ao criar apólice' });
    } finally {
      client.release();
    }
  },

  // Atualizar apólice (trocar a tabela vale para as próximas parcelas; as já geradas não mudam).
  // Pós-venda altera só campos operacionais.
  // Comissões ainda não recebidas são recalculadas com a nova mensalidade/vencimento (RN-19).
  async update(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      if (req.body.dia_vencimento !== undefined && !diaVencimentoValido(req.body.dia_vencimento)) {
        return res.status(400).json({ error: DIA_VENCIMENTO_OBRIGATORIO });
      }

      const atual = await client.query('SELECT status FROM apolices WHERE id = $1 AND empresa_id = $2', [
        id,
        req.user.empresa_id,
      ]);
      if (atual.rows.length === 0) return res.status(404).json({ error: 'Apólice não encontrada' });
      const statusAtual = atual.rows[0].status;
      const erroStatus = erroDeStatus(statusAtual, req.body.status);
      if (erroStatus) return res.status(400).json({ error: erroStatus });

      if (req.user.role === 'pos_venda') {
        const campos = CAMPOS_POS_VENDA.filter((c) => req.body[c] !== undefined);
        if (campos.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE apolices SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $${campos.length + 1} AND empresa_id = $${campos.length + 2}
           RETURNING *`,
          [...campos.map((c) => (req.body[c] === '' ? null : req.body[c])), id, req.user.empresa_id]
        );
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Apólice não encontrada' });
        }
        await recalcularPendentes(client, result.rows[0]);
        await client.query('COMMIT');
        return res.json(semComissao(result.rows[0]));
      }

      const {
        cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
        tipo_seguro, valor_premio_mensal,
        data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes
      } = req.body;

      if (!diaVencimentoValido(dia_vencimento)) return res.status(400).json({ error: DIA_VENCIMENTO_OBRIGATORIO });

      const vinculos = await validarVinculos(client, req.body, req.user.empresa_id);
      if (vinculos.error) return res.status(400).json({ error: vinculos.error });

      const resolvida = await resolverComissao(client, req.body, seguradora_id);
      if (resolvida.error) return res.status(400).json({ error: resolvida.error });

      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE apolices
         SET cliente_id = $1, seguradora_id = $2, corretor_responsavel_id = $3,
             numero_apolice = $4, tipo_seguro = $5, valor_premio_mensal = $6,
             percentual_comissao = $7, tabela_comissao_id = $8, data_inicio_vigencia = $9, data_fim_vigencia = $10,
             dia_vencimento = $11, status = $12, observacoes = $13, updated_at = CURRENT_TIMESTAMP
         WHERE id = $14 AND empresa_id = $15
         RETURNING *`,
        [cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
         tipo_seguro, valor_premio_mensal, resolvida.percentualApolice, resolvida.tabela?.id ?? null,
         data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status || statusAtual, observacoes, id, req.user.empresa_id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Apólice não encontrada' });
      }

      await recalcularPendentes(client, result.rows[0]);
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Já existe uma apólice com este número' });
      }
      console.error('Erro ao atualizar apólice:', error);
      res.status(500).json({ error: 'Erro ao atualizar apólice' });
    } finally {
      client.release();
    }
  },

  async delete(req, res) {
    try {
      const result = await pool.query('DELETE FROM apolices WHERE id = $1 AND empresa_id = $2 RETURNING id', [
        req.params.id,
        req.user.empresa_id,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Apólice não encontrada' });
      }

      res.json({ message: 'Apólice deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar apólice:', error);
      res.status(500).json({ error: 'Erro ao deletar apólice' });
    }
  },
};

module.exports = apolicesController;
