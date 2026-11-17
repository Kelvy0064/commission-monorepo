// Regras de comissão por parcela da apólice (usadas na criação da apólice e no job mensal).
// Especificação: specs/002-comissao-por-parcela/spec.md

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

// Data prevista de recebimento (spec 002/RN-06): o dinheiro chega pela plataforma VIDA quando o
// cliente paga o boleto, então a previsão é o dia de vencimento do boleto da apólice no mês da
// competência. Se o mês não tem esse dia (31 em fevereiro), usa o último dia do mês.
// competencia = 'AAAA-MM'; retorna 'AAAA-MM-DD'.
const dataPrevisaoRecebimento = (competencia, diaVencimento) => {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(Number(diaVencimento), ultimoDia);
  return `${competencia}-${String(dia).padStart(2, '0')}`;
};

// O repasse ao corretor vence 2 dias depois de a corretora receber a comissão (spec 002/RN-15)
const DIAS_PARA_REPASSE = 2;

// Valor = base × percentual, arredondado ao centavo com meio centavo para cima (spec 002/RN-05).
// Calcula em inteiros (centavos × centésimos de ponto percentual) para não sofrer erro de ponto
// flutuante: 16,65 × 30% = 4,995 → 5,00 (com Math.round sobre float daria 4,99).
// Base e percentual chegam com até 2 casas (colunas DECIMAL(10,2) e DECIMAL(5,2)).
const valorComissao = (base, percentual) => {
  const centavos = Math.round(Number(base) * 100);
  const centesimos = Math.round(Number(percentual) * 100);
  const produto = centavos * centesimos; // em 1/10000 de centavo
  const sinal = produto < 0 ? -1 : 1;
  return (sinal * Math.floor((Math.abs(produto) + 5000) / 10000)) / 100;
};

// Só a 1ª parcela gera repasse ao corretor
const PARCELA_COM_REPASSE = 1;

// Dia de vencimento válido (1 a 31) ou null
const diaVencimentoValido = (valor) => {
  const n = Number(valor);
  return valor !== '' && valor != null && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

module.exports = {
  regraDaParcela,
  dataPrevisaoRecebimento,
  valorComissao,
  diaVencimentoValido,
  PARCELA_COM_REPASSE,
  DIAS_PARA_REPASSE,
};
