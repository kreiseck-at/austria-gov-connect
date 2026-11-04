import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KENNZAHLEN, istKennzahl, istSatzKennzahl, kennzahlInfo, type KennzahlInfo } from './kennzahlen';

// Reihenfolge und Typen laut BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_07_2026.xsd (Stand 24.04.2026),
// Steuersätze laut Formular U 30-2026 (Version 13.03.2026).
const nummern = (block: KennzahlInfo['block']): string[] =>
  KENNZAHLEN.filter((k) => k.block === block).map((k) => k.nummer);

test('KENNZAHLEN hat 45 Einträge, keine Dubletten, nummer = kz ohne Präfix', () => {
  assert.equal(KENNZAHLEN.length, 45);
  assert.equal(new Set(KENNZAHLEN.map((k) => k.kz)).size, 45);
  for (const k of KENNZAHLEN) assert.equal(k.kz, `kz${k.nummer}`);
});

test('Reihenfolge je Block laut XSD', () => {
  assert.deepEqual(nummern('L'), ['000', '001', '021']);
  assert.deepEqual(nummern('STEUERFREI'), ['011', '012', '015', '017', '018', '019', '016', '020']);
  assert.deepEqual(nummern('VERSTEUERT'), [
    '022',
    '124',
    '029',
    '006',
    '037',
    '052',
    '007',
    '056',
    '057',
    '048',
    '044',
    '032',
  ]);
  assert.deepEqual(nummern('IGE'), ['070', '071']);
  assert.deepEqual(nummern('VERSTEUERT_IGE'), ['072', '125', '073', '008', '088', '076', '077']);
  assert.deepEqual(nummern('VORSTEUER'), [
    '060',
    '061',
    '083',
    '065',
    '066',
    '082',
    '087',
    '089',
    '064',
    '062',
    '063',
    '067',
    '090',
  ]);
});

test('Steuersätze in Promille', () => {
  assert.equal(kennzahlInfo('kz022').satzPromille, 200);
  assert.equal(kennzahlInfo('kz124').satzPromille, 49);
  assert.equal(kennzahlInfo('kz029').satzPromille, 100);
  assert.equal(kennzahlInfo('kz006').satzPromille, 130);
  assert.equal(kennzahlInfo('kz037').satzPromille, 190);
  assert.equal(kennzahlInfo('kz052').satzPromille, 100);
  assert.equal(kennzahlInfo('kz007').satzPromille, 70);
  assert.equal(kennzahlInfo('kz072').satzPromille, 200);
  assert.equal(kennzahlInfo('kz125').satzPromille, 49);
  assert.equal(kennzahlInfo('kz073').satzPromille, 100);
  assert.equal(kennzahlInfo('kz008').satzPromille, 130);
  assert.equal(kennzahlInfo('kz088').satzPromille, 190);
  assert.equal(kennzahlInfo('kz057').satzPromille, undefined);
  assert.equal(KENNZAHLEN.filter((k) => k.satzPromille !== undefined).length, 12);
});

test('Wertetypen laut XSD', () => {
  assert.equal(kennzahlInfo('kz000').typ, 'kznull');
  assert.equal(kennzahlInfo('kz070').typ, 'kznull');
  for (const kz of ['kz063', 'kz067', 'kz090'] as const) assert.equal(kennzahlInfo(kz).typ, 'kzvorz');
  const uebrige = KENNZAHLEN.filter((k) => !['000', '070', '063', '067', '090'].includes(k.nummer));
  for (const k of uebrige) assert.equal(k.typ, 'kz', k.kz);
});

test('124/125 erst ab 07/2026', () => {
  assert.equal(kennzahlInfo('kz124').abZeitraum, '2026-07');
  assert.equal(kennzahlInfo('kz125').abZeitraum, '2026-07');
  assert.equal(KENNZAHLEN.filter((k) => k.abZeitraum !== undefined).length, 2);
});

test('istKennzahl / istSatzKennzahl', () => {
  assert.equal(istKennzahl('kz022'), true);
  assert.equal(istKennzahl('kz009'), false); // nur 7/2020–12/2021
  assert.equal(istKennzahl('kz095'), false); // Zahllast, nicht im XML
  assert.equal(istKennzahl('KZ022'), false);
  assert.equal(istKennzahl('toString'), false);
  assert.equal(istSatzKennzahl('kz022'), true);
  assert.equal(istSatzKennzahl('kz057'), false);
});

test('KENNZAHLEN ist tief eingefroren: kein Aufrufer kann Sätze global verändern', () => {
  assert.ok(Object.isFrozen(KENNZAHLEN));
  for (const k of KENNZAHLEN) assert.ok(Object.isFrozen(k), `${k.kz} ist nicht eingefroren`);
  assert.equal(kennzahlInfo('kz022').satzPromille, 200);
});
