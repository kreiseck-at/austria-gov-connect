import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EldaError, EldaProtocolError, EldaStatusError } from './errors';

test('EldaStatusError trägt Code, Meldung und das vollständige Ergebnis', () => {
  const ergebnis = { statusCode: '405', ok: false, meldung: 'Original 155764331', protokollnummer: '9' };
  const err = new EldaStatusError('405', ergebnis, 'Original 155764331');
  assert.ok(err instanceof EldaError);
  assert.equal(err.name, 'EldaStatusError');
  assert.equal(err.statusCode, '405');
  assert.equal(err.meldung, 'Original 155764331');
  assert.equal(err.ergebnis, ergebnis);
  assert.match(err.message, /405/);
  assert.match(err.message, /Duplikat/); // Klartext aus ELDA_STATUS
  assert.match(err.message, /Original 155764331/); // ELDA-Meldung
});

test('EldaStatusError bleibt bei unbekanntem Code aussagekräftig', () => {
  const err = new EldaStatusError('999', { statusCode: '999' });
  assert.match(err.message, /999/);
  assert.equal(err.meldung, undefined);
});

test('EldaProtocolError bleibt unverändert eine EldaError', () => {
  assert.ok(new EldaProtocolError('x') instanceof EldaError);
});
