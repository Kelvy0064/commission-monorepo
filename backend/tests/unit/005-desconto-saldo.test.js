// Spec 005/RN-09 — divisão do desconto de saldos num repasse (sem banco).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planejarDescontos, MOTIVOS_CANCELAMENTO, DIAS_DESTAQUE } = require('../../utils/estorno');

const saldo = (id, restante, teto = null) => ({ id, valor_restante: String(restante), desconto_maximo_por_repasse: teto });

test('005/CA-09: saldo de R$ 240,00 num repasse de R$ 300,00 → desconta 240', () => {
  assert.deepEqual(planejarDescontos(300, [saldo(1, 240)]), [{ saldo_id: 1, valor: 240 }]);
});

test('005/CA-10: saldo de R$ 240,00 num repasse de R$ 100,00 → desconta 100 (restam 140 para o próximo)', () => {
  assert.deepEqual(planejarDescontos(100, [saldo(1, 240)]), [{ saldo_id: 1, valor: 100 }]);
  assert.deepEqual(planejarDescontos(300, [saldo(1, 140)]), [{ saldo_id: 1, valor: 140 }]);
});

test('005/CA-21: acordo limita o desconto por repasse', () => {
  assert.deepEqual(planejarDescontos(300, [saldo(1, 240, '50.00')]), [{ saldo_id: 1, valor: 50 }]);
});

test('005/RN-09: vários saldos são cobrados na ordem, até acabar o repasse', () => {
  assert.deepEqual(planejarDescontos(100, [saldo(1, 30), saldo(2, 50, 20), saldo(3, 500)]), [
    { saldo_id: 1, valor: 30 },
    { saldo_id: 2, valor: 20 },
    { saldo_id: 3, valor: 50 },
  ]);
});

test('005/RN-09: centavos exatos (sem erro de ponto flutuante)', () => {
  assert.deepEqual(planejarDescontos('0.30', [saldo(1, '0.10'), saldo(2, '0.20')]), [
    { saldo_id: 1, valor: 0.1 },
    { saldo_id: 2, valor: 0.2 },
  ]);
});

test('005/RN-09: sem saldo ou repasse zerado, nada é descontado', () => {
  assert.deepEqual(planejarDescontos(300, []), []);
  assert.deepEqual(planejarDescontos(0, [saldo(1, 240)]), []);
});

test('005/D10 e D15: motivos com "financeiro" e destaque a 30 dias', () => {
  assert.deepEqual(MOTIVOS_CANCELAMENTO, ['pedido_cliente', 'inadimplencia', 'troca_plano', 'financeiro', 'outro']);
  assert.equal(DIAS_DESTAQUE, 30);
});
