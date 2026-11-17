const pool = require('../config/database');
const { regraDaParcela, dataPrevisaoRecebimento, valorComissao, diaVencimentoValido } = require('../utils/comissaoParcela');
const { competenciaBrasil } = require('../utils/dataBrasil');

// Gera a comissão da competência de `referencia` (mês em Brasília) para cada apólice ativa
// (spec 002/RN-09). A parcela é a próxima da apólice (última numerada + 1) e segue a tabela de
// comissão; sem tabela, usa o percentual fixo. Idempotente por competência.
// Apólice sem dia de vencimento do boleto é pulada: a previsão de recebimento sairia errada (RN-07).
// Retorna { geradas, encerradas, puladas }.
async function gerarComissoesMes(referencia = new Date()) {
  const competencia = competenciaBrasil(referencia);

  const apolices = await pool.query(`
    SELECT a.*,
           t.id AS t_id, t.percentuais_parcelas, t.vitalicio_percentual, t.vitalicio_meses,
           (SELECT COALESCE(MAX(c.numero_parcela), 0) FROM comissoes c WHERE c.apolice_id = a.id) AS ultima_parcela,
           EXISTS (SELECT 1 FROM comissoes c WHERE c.apolice_id = a.id AND c.competencia = $1) AS ja_gerada
    FROM apolices a
    LEFT JOIN tabelas_comissao t ON a.tabela_comissao_id = t.id
    WHERE a.status = 'ativa'
  `, [competencia]);

  const semVencimento = apolices.rows.filter((a) => !a.ja_gerada && !diaVencimentoValido(a.dia_vencimento));
  if (semVencimento.length) {
    const numeros = semVencimento.map((a) => a.numero_apolice).join(', ');
    console.warn(`⚠️  ${semVencimento.length} apólice(s) sem comissão gerada — sem dia de vencimento do boleto: ${numeros}`);
  }

  let geradas = 0;
  let encerradas = 0;
  for (const apolice of apolices.rows) {
    if (apolice.ja_gerada || !diaVencimentoValido(apolice.dia_vencimento)) continue;

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
                              data_previsao_recebimento, status, empresa_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'prevista', $10)`,
      [apolice.id, apolice.corretor_responsavel_id, competencia, parcela, regra.tipo,
       apolice.valor_premio_mensal, regra.percentual, valor,
       dataPrevisaoRecebimento(competencia, apolice.dia_vencimento), apolice.empresa_id]
    );
    geradas++;
  }

  return { geradas, encerradas, puladas: semVencimento.length };
}

module.exports = gerarComissoesMes;
