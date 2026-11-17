// "Hoje" e "competência" no horário de Brasília (spec 002/RN-20).
// O servidor (Railway) roda em UTC: entre 21h e meia-noite em Brasília ele já está no dia seguinte.
// Toda regra de negócio que depende da data de hoje usa estas funções, não new Date() direto.

const FUSO = 'America/Sao_Paulo';

const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Data (AAAA-MM-DD) de um instante no horário de Brasília
const dataBrasil = (instante = new Date()) => {
  const p = Object.fromEntries(formato.formatToParts(instante).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
};

// Competência (AAAA-MM) de um instante no horário de Brasília
const competenciaBrasil = (instante = new Date()) => dataBrasil(instante).slice(0, 7);

// Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso)
const somarDias = (dataIso, dias) => {
  const [a, m, d] = String(dataIso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

// Expressão SQL para a data de hoje em Brasília (o banco também roda em UTC)
const SQL_HOJE_BRASIL = `(now() AT TIME ZONE '${FUSO}')::date`;

module.exports = { FUSO, dataBrasil, competenciaBrasil, somarDias, SQL_HOJE_BRASIL };
