// Spec 002 — regra de comissão por parcela (utils/comissaoParcela.js). Sem banco: roda também
// com `npm run test:unit`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  regraDaParcela,
  dataPrevisaoRecebimento,
  valorComissao,
  diaVencimentoValido,
  PARCELA_COM_REPASSE,
  DIAS_PARA_REPASSE,
} = require('../../utils/comissaoParcela');

// Tabela T da spec: agenciamento {100%, 90%}, vitalício 2% por 12 meses (valores como vêm do banco)
const T = { percentuais_parcelas: ['100', '90'], vitalicio_percentual: '2', vitalicio_meses: 12 };

test('002/CA-01: tabela T — agenciamento 100% e 90%, vitalício 2% da 3ª à 14ª, nada na 15ª', () => {
  assert.deepEqual(regraDaParcela(1, T), { tipo: 'agenciamento', percentual: 100 });
  assert.deepEqual(regraDaParcela(2, T), { tipo: 'agenciamento', percentual: 90 });
  assert.deepEqual(regraDaParcela(3, T), { tipo: 'vitalicio', percentual: 2 });
  assert.deepEqual(regraDaParcela(14, T), { tipo: 'vitalicio', percentual: 2 });
  assert.equal(regraDaParcela(15, T), null);
});

test('002/CA-02: tabela sem vitalício para de gerar depois do agenciamento', () => {
  assert.equal(regraDaParcela(3, { percentuais_parcelas: [100, 90], vitalicio_percentual: null }), null);
});

test('002/CA-03: vitalício sem prazo continua enquanto a apólice estiver ativa', () => {
  assert.deepEqual(regraDaParcela(100, { ...T, vitalicio_meses: null }), { tipo: 'vitalicio', percentual: 2 });
});

test('002/CA-04: sem tabela, toda parcela é fixa com o percentual da apólice', () => {
  assert.deepEqual(regraDaParcela(1, null, '5.5'), { tipo: 'fixa', percentual: 5.5 });
  assert.deepEqual(regraDaParcela(37, null, '5.5'), { tipo: 'fixa', percentual: 5.5 });
});

test('002/CA-05: valor arredondado ao centavo, meio centavo para cima', () => {
  assert.equal(valorComissao(1000, 2.5), 25);
  assert.equal(valorComissao(16.65, 30), 5); // 4,995 → 5,00
  assert.equal(valorComissao(12.87, 150), 19.31); // 19,305 → 19,31
  assert.equal(valorComissao(10.05, 50), 5.03); // 5,025 → 5,03
  assert.equal(valorComissao(199.99, 33.33), 66.66); // 66,6567 → 66,66
  // como o PostgreSQL devolve DECIMAL (texto)
  assert.equal(valorComissao('16.65', '30.00'), 5);
});

test('002/CA-05: arredondamento exato numa varredura de mensalidades e percentuais', () => {
  for (let centavos = 0; centavos <= 300000; centavos += 7) {
    for (const p of [0, 2, 2.5, 5, 10, 30, 33.33, 50, 90, 99.99, 100, 150, 999.99]) {
      const esperado = Math.floor((centavos * Math.round(p * 100) + 5000) / 10000) / 100;
      assert.equal(valorComissao(centavos / 100, p), esperado, `${centavos / 100} × ${p}%`);
    }
  }
});

test('002/CA-06: data prevista = dia de vencimento do boleto no mês da competência', () => {
  assert.equal(dataPrevisaoRecebimento('2027-01', 15), '2027-01-15');
  assert.equal(dataPrevisaoRecebimento('2027-01', '5'), '2027-01-05');
});

test('002/CA-06: vencimento além do fim do mês cai no último dia', () => {
  assert.equal(dataPrevisaoRecebimento('2027-02', 31), '2027-02-28');
  assert.equal(dataPrevisaoRecebimento('2028-02', 30), '2028-02-29'); // bissexto
  assert.equal(dataPrevisaoRecebimento('2027-04', 31), '2027-04-30');
});

test('002/RN-07: dia de vencimento válido é inteiro de 1 a 31', () => {
  assert.equal(diaVencimentoValido(1), 1);
  assert.equal(diaVencimentoValido('31'), 31);
  for (const invalido of [0, 32, 1.5, '', null, undefined, 'x']) assert.equal(diaVencimentoValido(invalido), null);
});

test('002/RN-15: repasse vence 2 dias depois do recebimento', () => {
  assert.equal(DIAS_PARA_REPASSE, 2);
});

test('002/RN-13: só a 1ª parcela gera repasse ao corretor', () => {
  assert.equal(PARCELA_COM_REPASSE, 1);
});
