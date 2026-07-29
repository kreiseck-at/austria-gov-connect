import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as elda from './index';

test('index exportiert die Betriebs-API', () => {
  assert.equal(typeof elda.createEldaTransfer, 'function');
  assert.equal(typeof elda.createEldaTransferRoh, 'function');
  assert.equal(typeof elda.findeRuecksendung, 'function');
  assert.ok(elda.ELDA_ENDPOINTS.produktion);
  assert.ok(elda.ELDA_STATUS['000']);
});

test('index exportiert die Fehlerklassen mit intakter Kette', () => {
  assert.equal(typeof elda.EldaError, 'function');
  assert.ok(elda.EldaProtocolError.prototype instanceof elda.EldaError);
  assert.ok(elda.EldaStatusError.prototype instanceof elda.EldaError);
});

test('index exportiert kein Innenleben mehr', () => {
  for (const name of ['baueSecurity', 'baueEldaEnvelope', 'ELDA_NAMESPACE', 'istOk', 'zuordnung']) {
    assert.equal((elda as Record<string, unknown>)[name], undefined, `sollte intern sein: ${name}`);
  }
});

test('index exportiert die Meldungs-Builder', () => {
  for (const name of [
    'anmeldung',
    'abmeldung',
    'aenderungsmeldung',
    'richtigstellungAnmeldung',
    'richtigstellungAbmeldung',
    'stornoAnmeldung',
    'stornoAbmeldung',
    'erstelleBestand',
    'wochenarbeitszeit',
  ]) {
    assert.equal(typeof (elda as Record<string, unknown>)[name], 'function', name);
  }
});

test('index exportiert die Satzart-Tabellen, aber kein Innenleben der Versichertenmeldung', () => {
  assert.ok(elda.PFLICHT_E29.M3);
  assert.ok(elda.SATZART_TEXT.M3);
  assert.ok(elda.ALTERNATIVGRUPPEN.length > 0);
  for (const intern of [
    'baueSatz',
    'nachIso885915',
    'pruefeVorrat',
    'FELDER_E29',
    'pruefeInhalt',
    'pruefePflicht',
  ]) {
    assert.equal((elda as Record<string, unknown>)[intern], undefined, `sollte intern sein: ${intern}`);
  }
});
