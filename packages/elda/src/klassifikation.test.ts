import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_STATUS } from './status';
import {
  SENDEN_ZUSTAENDE,
  EMPFANGEN_ZUSTAENDE,
  AUFLISTEN_ZUSTAENDE,
  zustandOderWurf,
} from './klassifikation';
import { EldaStatusError } from './errors';

test('senden: 000/404/405 sind Zustände, alles andere wirft', () => {
  assert.equal(zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: '000' }), 'angenommen');
  assert.equal(zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: '404' }), 'nochInArbeit');
  assert.equal(zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: '405' }), 'duplikat');
  for (const code of [
    '500',
    '551',
    '552',
    '553',
    '554',
    '555',
    '557',
    '558',
    '559',
    '401',
    '402',
    '403',
    '406',
    '407',
    '408',
  ]) {
    assert.throws(
      () => zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: code }),
      EldaStatusError,
      `sollte werfen: ${code}`,
    );
  }
});

test('empfangen: 000/404/406/408 sind Zustände, alles andere wirft', () => {
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '000' }), 'datei');
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '404' }), 'nochInArbeit');
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '406' }), 'nichtVorhanden');
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '408' }), 'bereitsEmpfangen');
  for (const code of [
    '500',
    '551',
    '552',
    '553',
    '554',
    '555',
    '557',
    '558',
    '559',
    '401',
    '402',
    '403',
    '405',
    '407',
  ]) {
    assert.throws(
      () => zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: code }),
      EldaStatusError,
      `sollte werfen: ${code}`,
    );
  }
});

test('auflisten: nur 000 ist ein Zustand', () => {
  assert.equal(zustandOderWurf(AUFLISTEN_ZUSTAENDE, { statusCode: '000' }), 'liste');
  for (const code of Object.keys(ELDA_STATUS).filter((c) => c !== '000')) {
    assert.throws(
      () => zustandOderWurf(AUFLISTEN_ZUSTAENDE, { statusCode: code }),
      EldaStatusError,
      `sollte werfen: ${code}`,
    );
  }
});

test('unbekannter Code wirft überall (sichere Vorgabe)', () => {
  for (const karte of [SENDEN_ZUSTAENDE, EMPFANGEN_ZUSTAENDE, AUFLISTEN_ZUSTAENDE]) {
    assert.throws(() => zustandOderWurf(karte, { statusCode: '999' }), EldaStatusError);
  }
});

test('der Wurf trägt Meldung und Ergebnis weiter', () => {
  const ergebnis = { statusCode: '558', ok: false, meldung: 'Passwort falsch' };
  try {
    zustandOderWurf(SENDEN_ZUSTAENDE, ergebnis);
    assert.fail('hätte werfen müssen');
  } catch (err) {
    assert.ok(err instanceof EldaStatusError);
    assert.equal(err.statusCode, '558');
    assert.equal(err.meldung, 'Passwort falsch');
    assert.equal(err.ergebnis, ergebnis);
  }
});

test('jeder Code der Tabelle ist je Methode entweder Zustand oder Wurf', () => {
  // Vollständigkeitsprobe: keine Lücke, kein Code ohne definiertes Verhalten.
  for (const code of Object.keys(ELDA_STATUS)) {
    for (const karte of [SENDEN_ZUSTAENDE, EMPFANGEN_ZUSTAENDE, AUFLISTEN_ZUSTAENDE]) {
      const inKarte = Object.prototype.hasOwnProperty.call(karte, code);
      if (inKarte) {
        assert.equal(typeof zustandOderWurf(karte, { statusCode: code }), 'string');
      } else {
        assert.throws(() => zustandOderWurf(karte, { statusCode: code }), EldaStatusError);
      }
    }
  }
});
