// Paridade da matriz de permissões (constituição II.1): a cópia do front precisa ser idêntica à
// fonte no backend. Se este teste falhar, alguém mudou uma das duas sem mudar a outra.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PERFIS, PERMISSOES, pode } from '../src/auth/permissoes.js';

const require = createRequire(import.meta.url);
const backend = require('../../backend/utils/permissoes.js');

test('perfis do front são os mesmos do backend', () => {
  assert.deepEqual(PERFIS, backend.PERFIS);
});

test('matriz de permissões do front é idêntica à do backend', () => {
  assert.deepEqual(PERMISSOES, backend.PERMISSOES);
});

test('pode() do front responde igual ao do backend para todo perfil e permissão', () => {
  for (const perm of Object.keys(backend.PERMISSOES)) {
    for (const role of [...Object.keys(backend.PERFIS), null, undefined, 'inexistente']) {
      assert.equal(pode(role, perm), backend.pode(role, perm), `${role} / ${perm}`);
    }
  }
});
