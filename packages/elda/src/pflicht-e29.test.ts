import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PFLICHT_E29, pruefePflicht, type Satzart } from './pflicht-e29';
import { FELDER_E29 } from './felder-e29';
import { EldaError } from './errors';

const SATZARTEN: Satzart[] = ['M3', 'M4', 'M6', 'M8', 'M9', 'S3', 'S4'];

test('jede Satzart deckt jedes Feld ab (außer dem Identifikationsteil)', () => {
  const felder = FELDER_E29.filter((f) => f.name !== 'IDTEIL').map((f) => f.name);
  for (const sa of SATZARTEN) {
    for (const name of felder) {
      assert.ok(PFLICHT_E29[sa][name], `${sa}/${name} fehlt in der Matrix`);
    }
  }
});

test('Stichproben gegen das Dokument', () => {
  assert.equal(PFLICHT_E29.M3.REFW, 'Z');
  assert.equal(PFLICHT_E29.M3.REFU, '-');
  assert.equal(PFLICHT_E29.M8.REFU, 'Z');
  assert.equal(PFLICHT_E29.M3.BBER, 'Z');
  assert.equal(PFLICHT_E29.M4.BBER, '-');
  assert.equal(PFLICHT_E29.M6.GERF, 'V');
  assert.equal(PFLICHT_E29.M3.VWAZ, 'Z1');
  assert.equal(PFLICHT_E29.M8.VWAZ, 'Z1');
  assert.equal(PFLICHT_E29.M4.VWAZ, '-');
  assert.equal(PFLICHT_E29.S4.RWUM, 'Z1');
});

test('fehlendes Z-Feld wirft und nennt Satzart und Feld', () => {
  assert.throws(
    () => pruefePflicht('M3', { REFW: '', BKNR: '1234567', DGNA: 'Muster' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /M3/);
      assert.match((err as Error).message, /REFW/);
      return true;
    },
  );
});

test('belegtes Feld in Grundstellung wirft', () => {
  assert.throws(() => pruefePflicht('M3', vollstaendigM3({ REFU: 'X' })), EldaError);
});

test('Z1, Z3 und V werden nicht erzwungen', () => {
  assert.doesNotThrow(() => pruefePflicht('M3', vollstaendigM3({})));
  assert.doesNotThrow(() =>
    pruefePflicht('M6', { REFW: 'R', BKNR: '1', DGNA: 'M', FANA: 'M', VONA: 'A', ADAT: '01012026' }),
  );
});

/** Minimal vollständige M3-Werte für die Pflichtprüfung. */
function vollstaendigM3(extra: Record<string, string>): Record<string, string> {
  return {
    REFW: 'REF-1',
    BKNR: '1234567',
    DGNA: 'Muster GmbH',
    FANA: 'Maier',
    VONA: 'Anna',
    ADAT: '01022026',
    BBER: '01',
    GERF: 'N',
    FRDV: 'N',
    ...extra,
  };
}
