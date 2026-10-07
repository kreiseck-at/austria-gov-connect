import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeFeldtabelle } from './festsatz';
import { FELDER_I1, SATZLAENGE_I1 } from './felder-e13';
import { FELDER_L1, KINDFELDER, SATZLAENGE_L1, VORZEICHEN_L1, BETRAEGE_OHNE_VORZEICHEN } from './felder-e14';
import { PFLICHT_I1, PFLICHT_KIND, PFLICHT_L1 } from './pflicht-e14';

test('Informationssatz: lückenlos auf 1100 Zeichen (E.13)', () => {
  assert.doesNotThrow(() => pruefeFeldtabelle(FELDER_I1, SATZLAENGE_I1));
  const feld = (name: string) => FELDER_I1.find((f) => f.name === name);
  assert.deepEqual([feld('STNRA')?.pos, feld('JAHR')?.pos, feld('ANZA')?.pos], [51, 233, 244]);
});

test('Mitteilungssatz: beide Versionen lückenlos auf 3500 Zeichen (E.14)', () => {
  for (const version of ['28', '29'] as const) {
    assert.doesNotThrow(() => pruefeFeldtabelle(FELDER_L1[version], SATZLAENGE_L1), version);
    const namen = FELDER_L1[version].map((f) => f.name);
    assert.equal(new Set(namen).size, namen.length, `Feldnamen eindeutig in Version ${version}`);
  }
});

test('Mitteilungssatz: Positionen aus der Feldtabelle', () => {
  const pos = (version: '28' | '29', name: string) => FELDER_L1[version].find((f) => f.name === name)?.pos;
  // Seite 224/230: KZ 210 auf 298, Referenznummer Finanz auf 66, Steuernummer auf 639
  assert.equal(pos('28', 'B210'), 298);
  assert.equal(pos('28', 'REFN'), 66);
  assert.equal(pos('28', 'STNRA'), 639);
  // Feld 175: „Referenznummer", vom Softwarehersteller zu befüllen
  assert.equal(pos('28', 'REFN_175'), 1001);
  // Kinderblock ab 1501, je Kind 123 Zeichen
  assert.equal(pos('28', 'KFAM_K1'), 1501);
  assert.equal(pos('28', 'KFAM_K2'), 1624);
  assert.equal(pos('28', 'KFAM_K15'), 1501 + 14 * 123);
  assert.equal(pos('28', 'RESE_210'), 3346);
  // Version 29: neue Felder ab 1194, Kinderblock unverändert ab 1501
  assert.equal(pos('29', 'SBK37'), 1194);
  assert.equal(pos('29', 'AKFK'), 1216);
  assert.equal(pos('29', 'KVRFP_K1'), 1501 + 30 + 30 + 3 + 1 + 10 + 8 + 1 + 1 + 1 + 16);
  assert.equal(pos('29', 'RESE_222'), 3346);
});

test('Version 29 erlaubt „-" zusätzlich bei VIEL, VABL und V260', () => {
  for (const betrag of ['BIEL', 'BABL', 'B260']) {
    assert.deepEqual(VORZEICHEN_L1['28'][betrag]?.erlaubt, ['+'], betrag);
    assert.deepEqual(VORZEICHEN_L1['29'][betrag]?.erlaubt, ['+', '-'], betrag);
  }
  assert.equal(Object.keys(VORZEICHEN_L1['28']).length, 40);
});

test('Jedes Vorzeichen- und Betragsfeld steht in der Feldtabelle', () => {
  for (const version of ['28', '29'] as const) {
    const namen = new Set(FELDER_L1[version].map((f) => f.name));
    for (const [betrag, regel] of Object.entries(VORZEICHEN_L1[version])) {
      assert.ok(namen.has(betrag), betrag);
      assert.ok(namen.has(regel.vorzeichen), regel.vorzeichen);
    }
    for (const betrag of BETRAEGE_OHNE_VORZEICHEN[version]) assert.ok(namen.has(betrag), betrag);
  }
});

test('Pflichttabellen nennen nur Felder der Feldtabelle', () => {
  const i1 = new Set(FELDER_I1.map((f) => f.name));
  for (const name of Object.keys(PFLICHT_I1)) assert.ok(i1.has(name), name);
  for (const version of ['28', '29'] as const) {
    const l1 = new Set(FELDER_L1[version].map((f) => f.name));
    for (const name of Object.keys(PFLICHT_L1[version])) assert.ok(l1.has(name), `${version} ${name}`);
    assert.deepEqual(Object.keys(PFLICHT_KIND[version]).sort(), [...KINDFELDER[version]].sort());
  }
  // E.14.1 vergibt Nr. 164 doppelt; FSVB ist Feld 165
  assert.equal(PFLICHT_L1['28'].FSVB, 'Z1');
  assert.equal(PFLICHT_L1['28'].REFN, 'Z');
  assert.equal(PFLICHT_L1['28'].REFN_175, 'Z3');
});
