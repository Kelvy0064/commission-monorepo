import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, maskTelefone } from '../src/utils/formatters.js';

test('formatDate usa a parte da data, sem converter fuso (não mostra o dia anterior no Brasil)', () => {
  assert.equal(formatDate('2026-11-01T00:00:00.000Z'), '01/11/2026');
  assert.equal(formatDate('2026-11-01'), '01/11/2026');
});

test('formatDate sem valor mostra traço', () => {
  assert.equal(formatDate(null), '-');
  assert.equal(formatDate(''), '-');
});

test('maskTelefone formata celular e fixo progressivamente', () => {
  assert.equal(maskTelefone(''), '');
  assert.equal(maskTelefone('1'), '(1');
  assert.equal(maskTelefone('199'), '(19) 9');
  assert.equal(maskTelefone('1933334444'), '(19) 3333-4444');
  assert.equal(maskTelefone('19999998888'), '(19) 99999-8888');
});

test('maskTelefone ignora o que não é dígito e corta em 11 dígitos', () => {
  assert.equal(maskTelefone('+55 (19) 99999-8888'), '(55) 19999-9988');
  assert.equal(maskTelefone('(19) 99999-88889999'), '(19) 99999-8888');
});
