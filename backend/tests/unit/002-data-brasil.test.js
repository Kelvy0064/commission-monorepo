// Spec 002/RN-20 — "hoje" e competência no horário de Brasília (o servidor roda em UTC).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dataBrasil, competenciaBrasil, somarDias } = require('../../utils/dataBrasil');

test('002/CA-22: às 23h30 de 30/11 em Brasília (02h30 UTC de 01/12) ainda é 30/11, competência 2026-11', () => {
  const instante = new Date('2026-12-01T02:30:00Z');
  assert.equal(dataBrasil(instante), '2026-11-30');
  assert.equal(competenciaBrasil(instante), '2026-11');
});

test('002/CA-22: à meia-noite de 01/12 em Brasília (03h UTC) vira o mês', () => {
  const instante = new Date('2026-12-01T03:00:00Z');
  assert.equal(dataBrasil(instante), '2026-12-01');
  assert.equal(competenciaBrasil(instante), '2026-12');
});

test('002/CA-22: virada do ano', () => {
  assert.equal(competenciaBrasil(new Date('2027-01-01T01:00:00Z')), '2026-12');
});

test('somarDias atravessa mês e ano sem depender de fuso', () => {
  assert.equal(somarDias('2027-01-30', 2), '2027-02-01');
  assert.equal(somarDias('2026-12-31', 2), '2027-01-02');
  assert.equal(somarDias('2028-02-28', 1), '2028-02-29');
});
