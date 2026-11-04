import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonError } from '@kreiseck/finanzonline-core';
import { berechneU30, steuerFuerSatz } from './berechne';

// Pilotfälle (Beträge echt, Namen/Kennungen ersetzt: Melisse Nails e.U.), in Cent.
const Q1 = {
  kz000: 98417,
  kz022: 98417,
  kz057: 21444,
  kz070: 197538,
  kz072: 197538,
  kz060: 119597,
  kz065: 39508,
  kz066: 21444,
};
const Q2 = {
  kz000: 584750,
  kz022: 584750,
  kz057: 20510,
  kz070: 138262,
  kz072: 138262,
  kz060: 116104,
  kz065: 27652,
  kz066: 20510,
};
const Q3 = {
  kz000: 1489092,
  kz022: 1489092,
  kz057: 35227,
  kz070: 643490,
  kz072: 643490,
  kz060: 79284,
  kz065: 128698,
  kz066: 35227,
};

test('Pilot Q1/2026: Gutschrift 999,14', () => {
  const b = berechneU30(Q1);
  assert.deepEqual(b.steuerJeSatz, [
    { kennzahl: 'kz022', bemessungsgrundlage: 98417, satzProzent: 20, steuer: 19683 },
    { kennzahl: 'kz072', bemessungsgrundlage: 197538, satzProzent: 20, steuer: 39508 },
  ]);
  assert.equal(b.umsatzsteuer, 80635);
  assert.equal(b.vorsteuer, 180549);
  assert.equal(b.sonstigeBerichtigungen, 0);
  assert.equal(b.ergebnis, -99914);
  assert.equal(b.art, 'gutschrift');
});

test('Pilot Q2/2026: Zahllast 8,46', () => {
  const b = berechneU30(Q2);
  assert.equal(b.umsatzsteuer, 165112);
  assert.equal(b.vorsteuer, 164266);
  assert.equal(b.ergebnis, 846);
  assert.equal(b.art, 'zahllast');
});

test('Gutschrift knapp: wie Pilot Q2, nur KZ 060 um 19,40 höher → Gutschrift 10,94', () => {
  const b = berechneU30({ ...Q2, kz060: 118044 });
  assert.equal(b.ergebnis, -1094);
  assert.equal(b.art, 'gutschrift');
});

test('Pilot Q3/2026: Zahllast 2.185,34', () => {
  const b = berechneU30(Q3);
  assert.equal(b.ergebnis, 218534);
  assert.equal(b.art, 'zahllast');
});

test('Nullmeldung', () => {
  const b = berechneU30({ kz000: 0 });
  assert.deepEqual(b, {
    steuerJeSatz: [],
    umsatzsteuer: 0,
    vorsteuer: 0,
    sonstigeBerichtigungen: 0,
    ergebnis: 0,
    art: 'null',
  });
});

test('halbe Cent werden aufgerundet (§ 204 BAO, BMF-Formular)', () => {
  assert.equal(steuerFuerSatz(5, 100), 1); // 0,05 × 10 % = 0,005
  assert.equal(steuerFuerSatz(50, 130), 7); // 0,50 × 13 % = 0,065
  assert.equal(steuerFuerSatz(500, 49), 25); // 5,00 × 4,9 % = 0,245
  assert.equal(steuerFuerSatz(50, 190), 10); // 0,50 × 19 % = 0,095
  assert.equal(steuerFuerSatz(50, 70), 4); // 0,50 × 7 % = 0,035
  assert.equal(steuerFuerSatz(4, 100), 0); // 0,004 → 0
  assert.equal(steuerFuerSatz(0, 200), 0);
});

test('je Zeile gerundet, nicht auf die Summe', () => {
  // je Zeile: 0,01 + 0,07 = 0,08; auf die Summe wären es 0,07
  assert.equal(berechneU30({ kz000: 55, kz029: 5, kz006: 50 }).umsatzsteuer, 8);
});

test('Steuer aus der Netto-Summe je Satz (Beispiel FreeFinance: 452,01 × 20 %)', () => {
  assert.equal(berechneU30({ kz000: 45201, kz022: 45201 }).umsatzsteuer, 9040);
});

test('größter zulässiger Betrag ohne Genauigkeitsverlust', () => {
  assert.equal(steuerFuerSatz(999999999999999, 200), 200000000000000);
  assert.equal(steuerFuerSatz(999999999999999, 49), 49000000000000);
});

test('062 mindert die Vorsteuer, 063/067 mit Vorzeichen, 090 als sonstige Berichtigung', () => {
  const b = berechneU30({ kz060: 10000, kz062: 2000, kz063: -500, kz067: 300, kz090: -100 });
  assert.equal(b.vorsteuer, 7800);
  assert.equal(b.sonstigeBerichtigungen, -100);
  assert.equal(b.ergebnis, -7900);
});

test('Steuerschuld-Kennzahlen gehen ohne Satz in die Umsatzsteuer', () => {
  const b = berechneU30({ kz056: 100, kz057: 200, kz048: 300, kz044: 400, kz032: 500 });
  assert.equal(b.umsatzsteuer, 1500);
  assert.deepEqual(b.steuerJeSatz, []);
});

test('alle Satz-Kennzahlen in Katalog-Reihenfolge', () => {
  const b = berechneU30({
    kz088: 1000,
    kz022: 1000,
    kz124: 1000,
    kz029: 1000,
    kz006: 1000,
    kz037: 1000,
    kz052: 1000,
    kz007: 1000,
    kz072: 1000,
    kz125: 1000,
    kz073: 1000,
    kz008: 1000,
  });
  assert.deepEqual(
    b.steuerJeSatz.map((s) => [s.kennzahl, s.satzProzent, s.steuer]),
    [
      ['kz022', 20, 200],
      ['kz124', 4.9, 49],
      ['kz029', 10, 100],
      ['kz006', 13, 130],
      ['kz037', 19, 190],
      ['kz052', 10, 100],
      ['kz007', 7, 70],
      ['kz072', 20, 200],
      ['kz125', 4.9, 49],
      ['kz073', 10, 100],
      ['kz008', 13, 130],
      ['kz088', 19, 190],
    ],
  );
});

test('berechneU30 wirft FonError bei ungültiger Eingabe statt still falsch zu rechnen', () => {
  const ist = (re: RegExp) => (e: unknown) => e instanceof FonError && re.test(e.message);
  const roh = (x: unknown): Parameters<typeof berechneU30>[0] => x as Parameters<typeof berechneU30>[0];
  assert.throws(() => berechneU30(roh({ kz000: 150, kz022: 1.5 })), ist(/KZ 022.*ganze Zahl in Cent/));
  assert.throws(() => berechneU30(roh({ kz000: 0, kz060: null })), ist(/KZ 060.*ganze Zahl in Cent/));
  assert.throws(() => berechneU30(roh({ kz000: 100, kz060: '100' })), ist(/KZ 060.*ganze Zahl in Cent/));
  assert.throws(() => berechneU30(roh({ kz000: 0, kz060: 2 ** 60 })), ist(/KZ 060.*ganze Zahl in Cent/));
  assert.throws(() => berechneU30(roh({ kz000: 100, kz22: 100 })), ist(/Unbekannte Kennzahl „kz22"/));
  assert.throws(() => berechneU30(roh(null)), ist(/Kennzahlen/));
  assert.deepEqual(berechneU30({ kz000: 0, kz022: undefined }).ergebnis, 0);
});
