// Regra de comissão por parcela (fonte única: utils/comissaoParcela.js — constituição III.2).
// Testes sem banco: rodam também com `npm run test:unit`.
// Os ids de critério (NNN/CA-xx) entram quando a spec 002 (comissão por parcela) for escrita na Fase 1.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  regraDaParcela,
  dataPrevisaoRecebimento,
  valorComissao,
  PARCELA_COM_REPASSE,
} = require('../../utils/comissaoParcela');

const tabela = { percentuais_parcelas: ['100', '90'], vitalicio_percentual: '2', vitalicio_meses: 12 };

test('agenciamento segue a tabela parcela a parcela', () => {
  assert.deepEqual(regraDaParcela(1, tabela), { tipo: 'agenciamento', percentual: 100 });
  assert.deepEqual(regraDaParcela(2, tabela), { tipo: 'agenciamento', percentual: 90 });
});

test('vitalício começa na parcela seguinte à última do agenciamento e dura vitalicio_meses', () => {
  assert.deepEqual(regraDaParcela(3, tabela), { tipo: 'vitalicio', percentual: 2 });
  assert.deepEqual(regraDaParcela(14, tabela), { tipo: 'vitalicio', percentual: 2 });
  assert.equal(regraDaParcela(15, tabela), null);
});

test('vitalício sem prazo (vitalicio_meses nulo) continua enquanto a apólice estiver ativa', () => {
  assert.deepEqual(regraDaParcela(100, { ...tabela, vitalicio_meses: null }), { tipo: 'vitalicio', percentual: 2 });
});

test('tabela sem vitalício para de gerar depois do agenciamento', () => {
  assert.equal(regraDaParcela(3, { percentuais_parcelas: [100, 90], vitalicio_percentual: null }), null);
});

test('sem tabela usa o percentual fixo da apólice em toda parcela', () => {
  assert.deepEqual(regraDaParcela(1, null, '5.5'), { tipo: 'fixa', percentual: 5.5 });
  assert.deepEqual(regraDaParcela(37, null, '5.5'), { tipo: 'fixa', percentual: 5.5 });
});

test('valor da comissão é arredondado em centavos', () => {
  assert.equal(valorComissao(1000, 2.5), 25);
  assert.equal(valorComissao('333.33', '100'), 333.33);
  assert.equal(valorComissao(199.99, 33.33), 66.66); // 66,656667 → 66,66
  assert.equal(valorComissao(10.05, 50), 5.03); // 5,025 → 5,03
});

// Achado na Fase 0: Math.round sobre ponto flutuante erra 1 centavo em casos de meio centavo
// (16,65 × 30% = 4,995 → 4,99). Correção depende de decisão do responsável (constituição III.3).
test('meio centavo arredonda para cima mesmo com erro de ponto flutuante', { todo: 'aguarda decisão sobre o arredondamento' }, () => {
  assert.equal(valorComissao(16.65, 30), 5);
  assert.equal(valorComissao(12.87, 150), 19.31);
});

test('data prevista = dia de pagamento da seguradora no mês + prazo de repasse', () => {
  const seguradora = { dia_pagamento: 10, prazo_repasse_dias: 5 };
  assert.equal(dataPrevisaoRecebimento(new Date(2027, 0, 1, 12), seguradora), '2027-01-15');
});

test('data prevista atravessa o fim do mês quando o prazo passa dele', () => {
  const seguradora = { dia_pagamento: 28, prazo_repasse_dias: 5 };
  assert.equal(dataPrevisaoRecebimento(new Date(2027, 1, 1, 12), seguradora), '2027-03-05');
});

test('só a 1ª parcela gera repasse ao corretor', () => {
  assert.equal(PARCELA_COM_REPASSE, 1);
});
