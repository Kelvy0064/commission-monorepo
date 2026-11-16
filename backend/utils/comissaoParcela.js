// Regras de comissão por parcela da apólice (usadas na criação da apólice e no job mensal).

// Comissão da parcela `n` (1, 2, 3...) de uma apólice.
// - Com tabela: agenciamento parcela a parcela; depois vitalício (pelo prazo da tabela).
// - Sem tabela: percentual fixo da apólice todo mês.
// Retorna { tipo, percentual } ou null quando a parcela não gera comissão (fim da tabela).
const regraDaParcela = (n, tabela, percentualFixo) => {
  if (!tabela) return { tipo: 'fixa', percentual: Number(percentualFixo) };

  const parcelas = (tabela.percentuais_parcelas || []).map(Number);
  if (n <= parcelas.length) return { tipo: 'agenciamento', percentual: parcelas[n - 1] };

  if (tabela.vitalicio_percentual == null) return null;
  const mesDeVitalicio = n - parcelas.length;
  if (tabela.vitalicio_meses && mesDeVitalicio > tabela.vitalicio_meses) return null;
  return { tipo: 'vitalicio', percentual: Number(tabela.vitalicio_percentual) };
};

// Data prevista de recebimento: dia de pagamento da seguradora no mês + prazo de repasse
const dataPrevisaoRecebimento = (referencia, seguradora) => {
  const data = new Date(referencia);
  data.setDate(seguradora.dia_pagamento);
  data.setDate(data.getDate() + seguradora.prazo_repasse_dias);
  return data.toISOString().split('T')[0];
};

const valorComissao = (mensalidade, percentual) => Math.round(Number(mensalidade) * Number(percentual)) / 100;

// Só a 1ª parcela gera repasse ao corretor
const PARCELA_COM_REPASSE = 1;

module.exports = { regraDaParcela, dataPrevisaoRecebimento, valorComissao, PARCELA_COM_REPASSE };
