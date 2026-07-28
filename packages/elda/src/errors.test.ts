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

test('EldaStatusError: Status-Code aus der Prototyp-Kette liefert "unbekannter Status-Code"', () => {
  // Ohne Object.hasOwn-Absicherung würde `ELDA_STATUS['constructor']` die eingebaute
  // Function liefern und in die Nachricht interpoliert werden (z. B. "function constructor() { [native code] }").
  for (const code of ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty']) {
    const err = new EldaStatusError(code, {});
    assert.match(err.message, /unbekannter Status-Code/, `sollte "unbekannter Status-Code" liefern: ${code}`);
  }
});

test('EldaProtocolError bleibt unverändert eine EldaError, ergebnis bleibt optional', () => {
  const err = new EldaProtocolError('x');
  assert.ok(err instanceof EldaError);
  assert.equal(err.ergebnis, undefined);
});

test('EldaProtocolError kann das rohe Ergebnis mitführen', () => {
  const ergebnis = { statusCode: '408', ok: false, datei: { inhalt: Buffer.from('x') } };
  const err = new EldaProtocolError('y', ergebnis);
  assert.equal(err.ergebnis, ergebnis);
});
