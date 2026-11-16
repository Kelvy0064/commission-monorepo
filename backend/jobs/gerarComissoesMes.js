const pool = require('../config/database');
const { regraDaParcela, dataPrevisaoRecebimento, valorComissao } = require('../utils/comissaoParcela');

// Gera a comissão da competência de `referencia` para cada apólice ativa.
// A parcela é a próxima da apólice (última numerada + 1) e segue a tabela de comissão;
// sem tabela, usa o percentual fixo. Idempotente por competência.
// Retorna { geradas, encerradas, puladas }.
async function gerarComissoesMes(referencia = new Date()) {
  const competencia = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`;

  const apolices = await pool.query(`
    SELECT a.*, s.nome AS seguradora_nome, s.dia_pagamento, s.prazo_repasse_dias,
           t.id AS t_id, t.percentuais_parcelas, t.vitalicio_percentual, t.vitalicio_meses,
           (SELECT COALESCE(MAX(c.numero_parcela), 0) FROM comissoes c WHERE c.apolice_id = a.id) AS ultima_parcela,
           EXISTS (SELECT 1 FROM comissoes c WHERE c.apolice_id = a.id AND c.competencia = $1) AS ja_gerada
    FROM apolices a
    JOIN seguradoras s ON a.seguradora_id = s.id
    LEFT JOIN tabelas_comissao t ON a.tabela_comissao_id = t.id
    WHERE a.status = 'ativa'
  `, [competencia]);

  // Seguradoras sem dia de pagamento/prazo de repasse gerariam data prevista errada: pula e avisa
  const incompletas = apolices.rows.filter((a) => a.dia_pagamento == null || a.prazo_repasse_dias == null);
  if (incompletas.length) {
    const nomes = [...new Set(incompletas.map((a) => a.seguradora_nome))].join(', ');
    console.warn(`⚠️  ${incompletas.length} apólice(s) sem comissão gerada — cadastro incompleto: ${nomes}`);
  }

  let geradas = 0;
  let encerradas = 0;
  for (const apolice of apolices.rows) {
    if (apolice.ja_gerada || apolice.dia_pagamento == null || apolice.prazo_repasse_dias == null) continue;

    const tabela = apolice.t_id
      ? {
          percentuais_parcelas: apolice.percentuais_parcelas,
          vitalicio_percentual: apolice.vitalicio_percentual,
          vitalicio_meses: apolice.vitalicio_meses,
        }
      : null;
    const parcela = Number(apolice.ultima_parcela) + 1;
    const regra = regraDaParcela(parcela, tabela, apolice.percentual_comissao);
    if (!regra) {
      encerradas++; // tabela não paga mais nada a partir desta parcela
      continue;
    }

    const valor = valorComissao(apolice.valor_premio_mensal, regra.percentual);
    await pool.query(
      `INSERT INTO comissoes (apolice_id, corretor_id, competencia, numero_parcela, tipo, valor_premio,
                              percentual_comissao, valor_comissao_bruto, valor_comissao_liquido,
                              data_previsao_recebimento, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'prevista')`,
      [apolice.id, apolice.corretor_responsavel_id, competencia, parcela, regra.tipo,
       apolice.valor_premio_mensal, regra.percentual, valor, dataPrevisaoRecebimento(referencia, apolice)]
    );
    geradas++;
  }

  return { geradas, encerradas, puladas: incompletas.length };
}

module.exports = gerarComissoesMes;
