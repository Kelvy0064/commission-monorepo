// Resumo e cronograma das tabelas de comissão exibidos na tela de seguradoras.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cronograma, resumoTabela, valorComissao } from '../src/features/seguradoras/comissao.js';

const require = createRequire(import.meta.url);
const backend = require('../../backend/utils/comissaoParcela.js');

test('002/CA-05: simulação da tela arredonda igual ao backend (meio centavo para cima)', () => {
  assert.equal(valorComissao(16.65, 30), 5);
  for (let centavos = 0; centavos <= 200000; centavos += 11) {
    for (const p of [2, 2.5, 30, 33.33, 90, 100, 150]) {
      assert.equal(valorComissao(centavos / 100, p), backend.valorComissao(centavos / 100, p));
    }
  }
});

test('002/CA-05: cronograma usa o valor arredondado', () => {
  assert.equal(cronograma({ percentuais_parcelas: [30] }, 16.65)[0].valor, 5);
});

const tabela = { percentuais_parcelas: ['100', '90'], vitalicio_percentual: '2', vitalicio_meses: 12 };

test('cronograma lista o agenciamento e as primeiras parcelas de vitalício', () => {
  assert.deepEqual(cronograma(tabela, 1000), [
    { parcela: 1, tipo: 'Agenciamento', percentual: 100, valor: 1000 },
    { parcela: 2, tipo: 'Agenciamento', percentual: 90, valor: 900 },
    { parcela: 3, tipo: 'Vitalício', percentual: 2, valor: 20 },
    { parcela: 4, tipo: 'Vitalício', percentual: 2, valor: 20 },
    { parcela: 5, tipo: 'Vitalício', percentual: 2, valor: 20 },
  ]);
});

test('cronograma respeita vitalício mais curto que o padrão exibido', () => {
  assert.equal(cronograma({ ...tabela, vitalicio_meses: 1 }, 1000).length, 3);
});

test('resumo da tabela descreve agenciamento total e vitalício', () => {
  const r = resumoTabela(tabela);
  assert.match(r, /agenciamento 190%/);
  assert.match(r, /vitalício 2% a partir da 3ª, por 12 meses/);
  assert.match(resumoTabela({ ...tabela, vitalicio_meses: null }), /enquanto ativo/);
});
