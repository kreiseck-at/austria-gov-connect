import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_PAKET } from './index';

test('smoke: Paket lädt', () => {
  assert.equal(ELDA_PAKET, '@kreiseck/elda');
});
