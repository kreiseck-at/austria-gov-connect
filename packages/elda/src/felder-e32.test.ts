import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeFeldtabelle, baueSatzText } from './festsatz';
import {
  FELDER_PAKET,
  FELDER_MBGM,
  FELDER_TARIFBLOCK,
  FELDER_TARIFBLOCK_FALLWEISE,
  FELDER_TARIFBLOCK_KURZ,
  FELDER_VERRECHNUNGSBASIS,
  FELDER_VERRECHNUNGSPOSITION,
  SATZLAENGE_PAKET,
  SATZLAENGE_MBGM,
  SATZLAENGE_TARIFBLOCK,
  SATZLAENGE_TARIFBLOCK_FALLWEISE,
  SATZLAENGE_TARIFBLOCK_KURZ,
  SATZLAENGE_VERRECHNUNGSBASIS,
  SATZLAENGE_VERRECHNUNGSPOSITION,
} from './felder-e32';

const TABELLEN = [
  ['mBGM-Paket', FELDER_PAKET, SATZLAENGE_PAKET],
  ['mBGM', FELDER_MBGM, SATZLAENGE_MBGM],
  ['Tarifblock', FELDER_TARIFBLOCK, SATZLAENGE_TARIFBLOCK],
  ['Tarifblock fallweise', FELDER_TARIFBLOCK_FALLWEISE, SATZLAENGE_TARIFBLOCK_FALLWEISE],
  ['Tarifblock kurz', FELDER_TARIFBLOCK_KURZ, SATZLAENGE_TARIFBLOCK_KURZ],
  ['Verrechnungsbasis', FELDER_VERRECHNUNGSBASIS, SATZLAENGE_VERRECHNUNGSBASIS],
  ['Verrechnungsposition', FELDER_VERRECHNUNGSPOSITION, SATZLAENGE_VERRECHNUNGSPOSITION],
] as const;

test('jede Feldtabelle ist lückenlos, überschneidungsfrei und trifft ihre Satzlänge', () => {
  for (const [name, felder, laenge] of TABELLEN) {
    assert.doesNotThrow(() => pruefeFeldtabelle(felder, laenge), `${name} ist nicht schlüssig`);
  }
});

// Die Lehre aus E.29: Dort hatte eine vertauschte Feldtabelle 204 Tests
// überlebt, weil nirgends ein ABSOLUTER Byte-Offset geprüft wurde. Die Tabelle
// unten ist unabhängig aus den Feldtabellen des Dokuments (Seiten 339–343)
// abgeschrieben. Vertauscht jemand zwei Felder in `felder-e32.ts`, muss hier
// etwas rot werden.
const OFFSETS: Record<string, ReadonlyArray<readonly [string, number, number]>> = {
  // [Feldname, 1-basierte Startposition, Länge]
  paket: [
    ['IDTEIL', 1, 20],
    ['REFP', 21, 40],
    ['BKNR', 61, 10],
    ['DGNA', 71, 70],
    ['MPKE', 141, 30],
    ['JAGB', 171, 1],
    ['DTEL', 172, 50],
    ['MAIL', 222, 60],
    ['BZRM', 282, 6],
    ['GSVZ', 288, 1],
    ['GSUM', 289, 11],
    ['ANZM', 300, 6],
  ],
  mbgm: [
    ['IDTEIL', 1, 20],
    ['REFW', 21, 40],
    ['REFU', 61, 40],
    ['REFV', 101, 40],
    ['VSNR', 141, 10],
    ['FANA', 151, 70],
    ['VONA', 221, 70],
    ['VSUM', 291, 11],
    ['VERG', 302, 1],
    ['INF1', 303, 12],
    ['INF2', 315, 12],
  ],
  tarifblock: [
    ['IDTEIL', 1, 20],
    ['BSGR', 21, 4],
    ['ERGB1', 25, 3],
    ['ERGB2', 28, 3],
    ['ERGB3', 31, 3],
    ['ERGB4', 34, 3],
    ['ERGB5', 37, 3],
    ['VVON', 40, 2],
    ['KEUE', 42, 1],
  ],
  tarifblockFallweise: [
    ['IDTEIL', 1, 20],
    ['BSGR', 21, 4],
    ['ERGB1', 25, 3],
    ['ERGB2', 28, 3],
    ['ERGB3', 31, 3],
    ['ERGB4', 34, 3],
    ['ERGB5', 37, 3],
    ['FTAG', 40, 2],
  ],
  tarifblockKurz: [
    ['IDTEIL', 1, 20],
    ['BSGR', 21, 4],
    ['ERGB1', 25, 3],
    ['ERGB2', 28, 3],
    ['ERGB3', 31, 3],
    ['ERGB4', 34, 3],
    ['ERGB5', 37, 3],
    ['BTAB', 40, 2],
    ['BTBS', 42, 2],
    ['KEUE', 44, 1],
  ],
  verrechnungsbasis: [
    ['IDTEIL', 1, 20],
    ['VBTY', 21, 2],
    ['VBBT', 23, 11],
  ],
  verrechnungsposition: [
    ['IDTEIL', 1, 20],
    ['VPTY', 21, 3],
    ['VPVZ', 24, 1],
    ['VPTA', 25, 6],
    ['RSVZ', 31, 1],
    ['RSUM', 32, 11],
  ],
};

const NACH_SCHLUESSEL = {
  paket: [FELDER_PAKET, SATZLAENGE_PAKET],
  mbgm: [FELDER_MBGM, SATZLAENGE_MBGM],
  tarifblock: [FELDER_TARIFBLOCK, SATZLAENGE_TARIFBLOCK],
  tarifblockFallweise: [FELDER_TARIFBLOCK_FALLWEISE, SATZLAENGE_TARIFBLOCK_FALLWEISE],
  tarifblockKurz: [FELDER_TARIFBLOCK_KURZ, SATZLAENGE_TARIFBLOCK_KURZ],
  verrechnungsbasis: [FELDER_VERRECHNUNGSBASIS, SATZLAENGE_VERRECHNUNGSBASIS],
  verrechnungsposition: [FELDER_VERRECHNUNGSPOSITION, SATZLAENGE_VERRECHNUNGSPOSITION],
} as const;

test('Position und Länge jedes Feldes stimmen mit dem Dokument überein', () => {
  for (const [schluessel, erwartet] of Object.entries(OFFSETS)) {
    const [felder] = NACH_SCHLUESSEL[schluessel as keyof typeof NACH_SCHLUESSEL];
    assert.equal(felder.length, erwartet.length, `${schluessel}: Feldanzahl weicht ab`);
    erwartet.forEach(([name, pos, laenge], i) => {
      const f = felder[i];
      assert.ok(f, `${schluessel}: Feld ${i} fehlt`);
      assert.equal(f.name, name, `${schluessel}: Feld ${i} heißt ${f.name}, erwartet ${name}`);
      assert.equal(f.pos, pos, `${schluessel}.${name}: Position ${f.pos}, erwartet ${pos}`);
      assert.equal(f.laenge, laenge, `${schluessel}.${name}: Länge ${f.laenge}, erwartet ${laenge}`);
    });
  }
});

// Die Offset-Tabelle allein genügt nicht: Sie prüft die Beschreibung, nicht das
// Ergebnis. Deshalb zusätzlich ein gebauter Satz, aus dem die Werte an ihren
// absoluten Stellen wieder herausgeschnitten werden.
test('ein gebauter Satz trägt jeden Wert an der Stelle, die das Dokument nennt', () => {
  const satz = baueSatzText(
    FELDER_MBGM,
    {
      IDTEIL: 'G1'.padEnd(20),
      REFW: 'REF-2026-07-0001',
      VSNR: '1234010180',
      FANA: 'Musterfrau',
      VONA: 'Oryna',
      VSUM: '53993',
      VERG: 'J',
    },
    SATZLAENGE_MBGM,
  );
  assert.equal(satz.length, 326);
  const stueck = (pos: number, laenge: number) => satz.slice(pos - 1, pos - 1 + laenge);
  assert.equal(stueck(1, 2), 'G1');
  assert.equal(stueck(21, 16), 'REF-2026-07-0001');
  assert.equal(stueck(61, 40), ' '.repeat(40), 'REFU muss Grundstellung blank sein');
  assert.equal(stueck(141, 10), '1234010180', 'VSNR an Position 141');
  assert.equal(stueck(151, 10), 'Musterfrau', 'FANA an Position 151');
  assert.equal(stueck(221, 5), 'Oryna', 'VONA an Position 221');
  assert.equal(stueck(291, 11), '00000053993', 'VSUM rechtsbündig mit führenden Nullen');
  assert.equal(stueck(302, 1), 'J');
});

test('der Beitragszeitraum wird nicht stillschweigend aufgefüllt', () => {
  // Ohne den MMJJJJ-Marker würde '12026' zu '012026' — Jänner 2026 statt eines
  // erkennbaren Fehlers.
  assert.throws(
    () => baueSatzText(FELDER_PAKET, { IDTEIL: 'PS'.padEnd(20), BZRM: '12026' }, SATZLAENGE_PAKET),
    /BZRM/,
  );
  const gut = baueSatzText(FELDER_PAKET, { IDTEIL: 'PS'.padEnd(20), BZRM: '072026' }, SATZLAENGE_PAKET);
  assert.equal(gut.slice(281, 287), '072026');
});

test('die Versicherungsnummer wird nicht stillschweigend aufgefüllt', () => {
  assert.throws(
    () => baueSatzText(FELDER_MBGM, { IDTEIL: 'G1'.padEnd(20), VSNR: '234010180' }, SATZLAENGE_MBGM),
    /VSNR/,
  );
});

test('die fünf Ergänzungen liegen lückenlos hintereinander', () => {
  const satz = baueSatzText(
    FELDER_TARIFBLOCK,
    { IDTEIL: 'T1'.padEnd(20), BSGR: 'B002', ERGB1: 'E01', ERGB3: 'E03', VVON: '1' },
    SATZLAENGE_TARIFBLOCK,
  );
  assert.equal(satz.length, 42);
  assert.equal(satz.slice(20, 24), 'B002');
  assert.equal(satz.slice(24, 39), 'E01' + '   ' + 'E03' + '   ' + '   ');
  assert.equal(satz.slice(39, 41), '01', 'VVON wird als Zahl aufgefüllt — ein Tag, keine Stellenkodierung');
});
