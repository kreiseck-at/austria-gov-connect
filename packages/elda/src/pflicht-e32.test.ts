import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PFLICHT_PAKET,
  PFLICHT_MBGM,
  PFLICHT_TARIFBLOCK,
  PFLICHT_TARIFBLOCK_KURZ,
  PFLICHT_VERRECHNUNGSPOSITION,
  ALTERNATIVGRUPPEN_E32,
  SELBSTABRECHNER,
  VORSCHREIBER,
  E32_SATZART_TEXT,
} from './pflicht-e32';
import { FELDER_PAKET, FELDER_MBGM } from './felder-e32';

// Die Matrix bildet das Dokument ab. Diese Tests halten einzelne Zellen fest,
// die beim Abschreiben leicht verrutschen — jede ist am Seitenbild abgelesen.

test('mBGM-Paket: das Ende-Paket trägt nur Referenzwert und Anzahl', () => {
  const besetzt = Object.entries(PFLICHT_PAKET)
    .filter(([, z]) => z.PE !== '-')
    .map(([f]) => f)
    .sort();
  assert.deepEqual(besetzt, ['ANZM', 'REFP']);
});

test('mBGM-Paket: Gesamtsumme ist beim Vorschreiber Z4, nicht Z1', () => {
  // Z4 heißt: darf mitgegeben werden, Inhalt wird NICHT übernommen.
  assert.equal(PFLICHT_PAKET.GSUM?.PS, 'Z1');
  assert.equal(PFLICHT_PAKET.GSUM?.PV, 'Z4');
  assert.equal(PFLICHT_PAKET.GSVZ?.PS, 'Z1');
  assert.equal(PFLICHT_PAKET.GSVZ?.PV, 'Z4');
});

test('mBGM: die Alternativgruppe VSNR/REFV gilt nur für die G-Satzarten', () => {
  for (const art of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const) {
    assert.equal(PFLICHT_MBGM.VSNR?.[art], 'Z1', `${art}: VSNR`);
    assert.equal(PFLICHT_MBGM.REFV?.[art], 'Z1', `${art}: REFV`);
  }
  // Beim Storno ist VSNR einzeln zwingend und REFV gesperrt — nicht verbunden.
  for (const art of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'] as const) {
    assert.equal(PFLICHT_MBGM.VSNR?.[art], 'Z', `${art}: VSNR muss einzeln zwingend sein`);
    assert.equal(PFLICHT_MBGM.REFV?.[art], '-', `${art}: REFV muss gesperrt sein`);
  }
  const gruppe = ALTERNATIVGRUPPEN_E32[0];
  assert.ok(gruppe);
  assert.deepEqual([...gruppe.satzarten].sort(), ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
  assert.deepEqual([...gruppe.felder].sort(), ['REFV', 'VSNR']);
});

test('mBGM ohne Versicherten: VSUM ist Z, nicht Z1', () => {
  // G7/R7 weichen von allen anderen Satzarten ab.
  assert.equal(PFLICHT_MBGM.VSUM?.G7, 'Z');
  assert.equal(PFLICHT_MBGM.VSUM?.R7, 'Z');
  assert.equal(PFLICHT_MBGM.VSUM?.G1, 'Z1');
  for (const feld of ['VSNR', 'REFV', 'FANA', 'VONA', 'VERG'] as const) {
    assert.equal(PFLICHT_MBGM[feld]?.G7, '-', `G7: ${feld} muss Grundstellung sein`);
  }
  // Nur das Storno kennt den Verweis auf die ursprüngliche Meldung.
  assert.equal(PFLICHT_MBGM.REFU?.G7, '-');
  assert.equal(PFLICHT_MBGM.REFU?.R7, 'Z');
});

test('Verrechnungsposition: beim Vorschreiber wird kein Betrag übernommen', () => {
  for (const feld of ['VPVZ', 'VPTA', 'RSVZ', 'RSUM'] as const) {
    assert.equal(PFLICHT_VERRECHNUNGSPOSITION[feld]?.V2, 'Z4', `${feld} beim Vorschreiber`);
  }
  assert.equal(PFLICHT_VERRECHNUNGSPOSITION.VPTY?.V2, 'Z', 'nur der Positionstyp zählt');
  assert.equal(PFLICHT_VERRECHNUNGSPOSITION.RSUM?.V1, 'Z1', 'beim Selbstabrechner Z1');
});

test('KEUE entfällt in den Tarifblöcken ohne Verrechnung', () => {
  assert.equal(PFLICHT_TARIFBLOCK.KEUE?.T1, 'Z1');
  assert.equal(PFLICHT_TARIFBLOCK.KEUE?.T4, '-');
  assert.equal(PFLICHT_TARIFBLOCK_KURZ.KEUE?.T3, 'Z1');
  assert.equal(PFLICHT_TARIFBLOCK_KURZ.KEUE?.T6, '-');
});

test('die Matrizen decken genau die Felder ihrer Feldtabelle ab', () => {
  const ohneIdteil = (namen: readonly string[]) => namen.filter((n) => n !== 'IDTEIL');
  assert.deepEqual(Object.keys(PFLICHT_PAKET).sort(), ohneIdteil(FELDER_PAKET.map((f) => f.name)).sort());
  assert.deepEqual(Object.keys(PFLICHT_MBGM).sort(), ohneIdteil(FELDER_MBGM.map((f) => f.name)).sort());
});

test('jede Satzart ist genau einem Verfahren zugeordnet — oder bewusst keinem', () => {
  const beide = [...SELBSTABRECHNER].filter((a) => VORSCHREIBER.has(a));
  assert.deepEqual(beide, [], 'keine Satzart darf zu beiden Verfahren gehören');
  // G7/R7 und die Tarifblöcke sind verfahrensneutral.
  for (const art of ['G7', 'R7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const) {
    assert.equal(SELBSTABRECHNER.has(art), false, `${art} ist verfahrensneutral`);
    assert.equal(VORSCHREIBER.has(art), false, `${art} ist verfahrensneutral`);
  }
});

test('die Matrizen sind eingefroren', () => {
  assert.throws(() => {
    (PFLICHT_MBGM as Record<string, unknown>).VSUM = {};
  });
  assert.equal(Object.isFrozen(PFLICHT_MBGM.VSUM), true);
});

test('jede Satzart hat einen Klartext', () => {
  // 3 Paket + 7 Meldung + 7 Storno + 6 Tarifbloecke + 2 Basis + 2 Position
  assert.equal(Object.keys(E32_SATZART_TEXT).length, 27);
  for (const [art, text] of Object.entries(E32_SATZART_TEXT)) {
    assert.ok(text.length > 0, `${art} ohne Klartext`);
  }
});
