import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as paket from '../index';

test('öffentliche API des Pakets', () => {
  for (const name of [
    'createU30',
    'pruefeU30',
    'berechneU30',
    'steuerFuerSatz',
    'baueU30Xml',
    'parseU30Protokoll',
    'paketNrAusFilebez',
    'zrVonBis',
    'istKennzahl',
    'istSatzKennzahl',
    'kennzahlInfo',
    'U30PruefError',
    'createFileUpload',
    'createDatabox',
  ] as const) {
    assert.equal(typeof (paket as Record<string, unknown>)[name], 'function', name);
  }
  assert.ok(Array.isArray(paket.KENNZAHLEN));
  assert.equal(paket.KENNZAHLEN.length, 45);
  assert.ok(Array.isArray(paket.ANBRINGEN));
});
