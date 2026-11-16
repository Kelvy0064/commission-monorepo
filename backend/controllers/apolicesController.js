const pool = require('../config/database');
const { regraDaParcela, dataPrevisaoRecebimento, valorComissao } = require('../utils/comissaoParcela');

// Define como a apólice comissiona: pela tabela da seguradora (tabela_comissao_id) ou por
// percentual fixo. Com tabela, o percentual guardado na apólice é o da 1ª parcela (referência).
// Retorna { tabela, percentualApolice } ou { error }.
const resolverComissao = async (db, body, seguradoraId) => {
  const tabelaId = body.tabela_comissao_id ? Number(body.tabela_comissao_id) : null;

  if (!tabelaId) {
    const percentual = Number(body.percentual_comissao);
    if (body.percentual_comissao === '' || body.percentual_comissao == null || !Number.isFinite(percentual) || percentual < 0 || percentual > 999.99) {
      return { error: 'Informe o percentual de comissão ou escolha uma tabela de comissão' };
    }
    return { tabela: null, percentualApolice: percentual };
  }

  const result = await db.query('SELECT * FROM tabelas_comissao WHERE id = $1', [tabelaId]);
  const tabela = result.rows[0];
  if (!tabela || String(tabela.seguradora_id) !== String(seguradoraId)) {
    return { error: 'Tabela de comissão não pertence à seguradora escolhida' };
  }
  const primeira = regraDaParcela(1, tabela, null);
  return { tabela, percentualApolice: primeira ? primeira.percentual : 0 };
};

const apolicesController = {
  // Listar todas as apólices
  async index(req, res) {
    try {
      const { status, cliente_id, corretor_id } = req.query;
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
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (cliente_id) {
        query += ` AND a.cliente_id = $${paramCount}`;
        params.push(cliente_id);
        paramCount++;
      }

      if (corretor_id) {
        query += ` AND a.corretor_responsavel_id = $${paramCount}`;
        params.push(corretor_id);
        paramCount++;
      }

      query += ' ORDER BY a.created_at DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
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

      // Validações antes de gravar qualquer coisa
      const seguradora = await client.query('SELECT * FROM seguradoras WHERE id = $1', [seguradora_id]);
      const seg = seguradora.rows[0];
      if (!seg) return res.status(400).json({ error: 'Seguradora não encontrada' });
      // Sem dia de pagamento/prazo de repasse a data prevista sairia errada: exige o cadastro completo
      if (seg.dia_pagamento == null || seg.prazo_repasse_dias == null) {
        return res.status(400).json({
          error: `Cadastre o dia de pagamento e o prazo de repasse da seguradora ${seg.nome} antes de criar apólices`,
        });
      }

      const resolvida = await resolverComissao(client, req.body, seguradora_id);
      if (resolvida.error) return res.status(400).json({ error: resolvida.error });
      const { tabela, percentualApolice } = resolvida;

      const regra = regraDaParcela(1, tabela, percentualApolice);

      await client.query('BEGIN');
      const apoliceResult = await client.query(
        `INSERT INTO apolices (cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
                                tipo_seguro, valor_premio_mensal, percentual_comissao, tabela_comissao_id,
                                data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
         tipo_seguro, valor_premio_mensal, percentualApolice, tabela?.id ?? null,
         data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status || 'ativa', observacoes]
      );
      const apolice = apoliceResult.rows[0];

      // Comissão da 1ª parcela para o mês atual (se a regra gerar comissão)
      if (regra) {
        const hoje = new Date();
        const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const valor = valorComissao(valor_premio_mensal, regra.percentual);

        await client.query(
          `INSERT INTO comissoes (apolice_id, corretor_id, competencia, numero_parcela, tipo, valor_premio,
                                  percentual_comissao, valor_comissao_bruto, valor_comissao_liquido,
                                  data_previsao_recebimento, status)
           VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $7, $8, 'prevista')`,
          [apolice.id, corretor_responsavel_id, competencia, regra.tipo, valor_premio_mensal,
           regra.percentual, valor, dataPrevisaoRecebimento(hoje, seg)]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(apolice);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Erro ao criar apólice:', error);
      res.status(500).json({ error: 'Erro ao criar apólice' });
    } finally {
      client.release();
    }
  },

  // Atualizar apólice (trocar a tabela vale para as próximas parcelas; as já geradas não mudam)
  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
        tipo_seguro, valor_premio_mensal,
        data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes
      } = req.body;

      const resolvida = await resolverComissao(pool, req.body, seguradora_id);
      if (resolvida.error) return res.status(400).json({ error: resolvida.error });

      const result = await pool.query(
        `UPDATE apolices
         SET cliente_id = $1, seguradora_id = $2, corretor_responsavel_id = $3,
             numero_apolice = $4, tipo_seguro = $5, valor_premio_mensal = $6,
             percentual_comissao = $7, tabela_comissao_id = $8, data_inicio_vigencia = $9, data_fim_vigencia = $10,
             dia_vencimento = $11, status = $12, observacoes = $13, updated_at = CURRENT_TIMESTAMP
         WHERE id = $14
         RETURNING *`,
        [cliente_id, seguradora_id, corretor_responsavel_id, numero_apolice,
         tipo_seguro, valor_premio_mensal, resolvida.percentualApolice, resolvida.tabela?.id ?? null,
         data_inicio_vigencia, data_fim_vigencia, dia_vencimento, status, observacoes, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Apólice não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar apólice:', error);
      res.status(500).json({ error: 'Erro ao atualizar apólice' });
    }
  },

  // Deletar apólice
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM apolices WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Apólice não encontrada' });
      }

      res.json({ message: 'Apólice deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar apólice:', error);
      res.status(500).json({ error: 'Erro ao deletar apólice' });
    }
  }
};

module.exports = apolicesController