// Resumo e cronograma das tabelas de comissão exibidos na tela de seguradoras.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronograma, resumoTabela } from '../src/features/seguradoras/comissao.js';

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
