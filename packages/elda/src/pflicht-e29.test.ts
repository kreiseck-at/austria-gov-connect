import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALTERNATIVGRUPPEN, PFLICHT_E29, pruefePflicht, type Satzart } from './pflicht-e29';
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

  // Seite 303, Felder 18/19/20: BBER, GERF und FRDV teilen sich bei M6 eine
  // verbundene Zelle mit einem einzelnen "V" (per Rahmenanalyse der Render-
  // grafik verifiziert, keine Trennlinien zwischen den drei Feldzeilen in der
  // M6-Spalte). "-" wäre hier ein Transkriptionsfehler, siehe ALTERNATIVGRUPPEN.
  assert.equal(PFLICHT_E29.M6.BBER, 'V');
  assert.equal(PFLICHT_E29.M6.FRDV, 'V');

  // Seite 303, Felder 10/11: VSNR und GEBD stehen im Dokument in keiner
  // Satzart einzeln, sondern immer in einer verbundenen Zelle mit einem
  // einzigen "Z". Da sich diese Gruppe nicht ohne Raten in Einzelwerte pro
  // Feld zerlegen lässt, ist hier bewusst Z1 (nicht erzwungen) statt des
  // gedruckten Z eingetragen — siehe ALTERNATIVGRUPPEN.
  for (const sa of SATZARTEN) {
    assert.equal(PFLICHT_E29[sa].VSNR, 'Z1', `VSNR bei ${sa}`);
    assert.equal(PFLICHT_E29[sa].GEBD, 'Z1', `GEBD bei ${sa}`);
  }
});

test('ALTERNATIVGRUPPEN hält die im Dokument verbundenen Zellen fest', () => {
  assert.deepEqual(
    ALTERNATIVGRUPPEN.map((g) => g.felder),
    [
      ['VSNR', 'GEBD', 'REFV'],
      ['VSNR', 'GEBD'],
      ['BBER', 'GERF', 'FRDV'],
    ],
  );
  assert.deepEqual(
    ALTERNATIVGRUPPEN.map((g) => g.satzarten),
    [['M3', 'M4', 'M6'], ['M8', 'M9', 'S3', 'S4'], ['M6']],
  );
});

test('M6: eine Änderung des Beschäftigungsbereichs wird nicht abgewiesen (Beispiel Kapitel E.29.2)', () => {
  // Die Brief-Fassung mit BBER=M6:'-' hätte genau diesen Fall abgewiesen.
  assert.doesNotThrow(() =>
    pruefePflicht('M6', {
      REFW: 'R',
      BKNR: '1',
      DGNA: 'M',
      FANA: 'M',
      VONA: 'A',
      ADAT: '01012026',
      BBER: '01',
    }),
  );
});

test('M3: bekannte VSNR ohne Geburtsdatum wird nicht abgewiesen', () => {
  // Mit VSNR=M3:'Z' (statt Z1) hätte pruefePflicht dies fälschlich abgelehnt,
  // sofern GEBD nicht ebenfalls angegeben wird.
  assert.doesNotThrow(() => pruefePflicht('M3', vollstaendigM3({ VSNR: '1234567890' })));
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
