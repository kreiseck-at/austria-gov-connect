import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viesUserErrorAusgang } from './ergebnis';

test('VALID -> gueltig', () => assert.equal(viesUserErrorAusgang('VALID').ergebnis, 'gueltig'));
test('INVALID -> ungueltig', () => assert.equal(viesUserErrorAusgang('INVALID').ergebnis, 'ungueltig'));
test('MS_UNAVAILABLE -> keine_antwort, wiederholbar', () => {
  const a = viesUserErrorAusgang('MS_UNAVAILABLE');
  assert.equal(a.ergebnis, 'keine_antwort');
  assert.equal(a.grund, 'ms_nicht_erreichbar');
  assert.equal(a.wiederholbar, true);
});
test('MS_MAX_CONCURRENT_REQ -> keine_antwort/ueberlast, wiederholbar', () => {
  assert.equal(viesUserErrorAusgang('MS_MAX_CONCURRENT_REQ').grund, 'ueberlast');
});
test('IP_BLOCKED -> keine_antwort/gesperrt, NICHT wiederholbar', () => {
  const a = viesUserErrorAusgang('IP_BLOCKED');
  assert.equal(a.grund, 'gesperrt');
  assert.equal(a.wiederholbar, false);
});
