import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisiereUid } from './normalisieren';
import { UidEingabeError } from './ergebnis';

test('normalisiert Leerzeichen/Kleinschreibung und splittet Land/Nummer', () => {
  const r = normalisiereUid(' de 136695976 ');
  assert.equal(r.land, 'DE');
  assert.equal(r.nummer, '136695976');
  assert.equal(r.voll, 'DE136695976');
});
test('AT-UID', () => {
  assert.deepEqual(normalisiereUid('ATU12345678'), { land: 'AT', nummer: 'U12345678', voll: 'ATU12345678' });
});
test('RO mit kurzer Ziffernnummer erlaubt', () => {
  assert.equal(normalisiereUid('RO1234').voll, 'RO1234');
});
test('unbekanntes Land wirft', () => {
  assert.throws(() => normalisiereUid('ZZ12345678'), UidEingabeError);
});
test('zu kurz wirft', () => {
  assert.throws(() => normalisiereUid('DE12'), UidEingabeError);
});
