import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berechneBeitragCent, pruefeBeitraege } from './beitrag-e32';
import { pruefeMbgmPaket } from './pruefung-e32';
import {
  erstelleMbgmPaket,
  VERRECHNUNGSGRUNDLAGE,
  type PaketOptionen,
  type Beitragsgrundlagenmeldung,
} from './mbgm';

const OPT: PaketOptionen = {
  verfahren: 'selbstabrechnung',
  paketreferenzwert: 'P-1',
  beitragskontonummer: '1234567',
  dienstgebername: 'Musterbetrieb',
  beitragszeitraum: '072026',
  jaehrlicheAbrechnungGeringfuegiger: false,
};

function meldung(basisCent: number, prozentsatz: number, betragCent: number): Beitragsgrundlagenmeldung {
  return {
    referenzwert: 'M-1',
    versicherungsnummer: '1234010180',
    familienname: 'Muster',
    vorname: 'Max',
    verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
    tarifbloecke: [
      {
        beschaeftigtengruppe: 'B002',
        beginnDerVerrechnung: 1,
        basen: [{ typ: 'AB', betragCent: basisCent, positionen: [{ typ: 'T01', prozentsatz, betragCent }] }],
      },
    ],
  };
}

test('berechneBeitragCent: der Halbcent-Fall der SIT (BW1917) wird aufgerundet', () => {
  // 950,00 € × 28,45 % = 270,275 € — die ÖGK buchte 270,28 €.
  assert.equal(0.2845 * 95_000, 27_027.499999999996, 'Gleitkomma liegt knapp unter dem halben Cent');
  assert.equal(berechneBeitragCent(95_000, 28.45), 27_028);
});

test('berechneBeitragCent: Beispiel 01a des Kapitels E.32.2 (2.000,00 € × 39,60 % = 792,00 €)', () => {
  assert.equal(berechneBeitragCent(200_000, 39.6), 79_200);
});

test('berechneBeitragCent: kleine Basis, Rest knapp über einem halben Cent', () => {
  // 0,33 € × 1,53 % = 0,5049 Cent → 1 Cent (Spezialfall in E.32.2.15).
  assert.equal(berechneBeitragCent(33, 1.53), 1);
  // 0,32 € × 1,53 % = 0,4896 Cent → 0 Cent.
  assert.equal(berechneBeitragCent(32, 1.53), 0);
});

test('berechneBeitragCent: negativer Prozentsatz rundet den Betrag, dann kommt das Vorzeichen', () => {
  // 950,00 € × -0,125 % = -1,1875 € → -1,19 €
  assert.equal(berechneBeitragCent(95_000, -0.125), -119);
  assert.equal(berechneBeitragCent(95_000, -0.0001), 0, 'kein „-0"');
});

test('berechneBeitragCent: lehnt Bruchteile von Cent und negative Basen ab', () => {
  assert.throws(() => berechneBeitragCent(100.5, 10), /Cent-Betrag/);
  assert.throws(() => berechneBeitragCent(-1, 10), /Cent-Betrag/);
  assert.throws(() => berechneBeitragCent(100, Number.NaN), /Prozentsatz/);
});

test('pruefeBeitraege: der abgerundete Beitrag der SIT wird als DM-D.62 gemeldet', () => {
  const saetze = erstelleMbgmPaket([meldung(95_000, 28.45, 27_027)], OPT);
  const befunde = pruefeMbgmPaket(saetze).filter((b) => b.code === 'DM-D.62');
  assert.equal(befunde.length, 1);
  assert.equal(befunde[0]?.schwere, 'warnung');
  assert.match(
    befunde[0]?.meldung ?? '',
    /T01 meldet 270,27 €, 950,00 € × 28,450 % ergibt kaufmännisch gerundet 270,28 €/,
  );
});

test('pruefeBeitraege: der richtig gerundete Beitrag bleibt ohne Befund', () => {
  const saetze = erstelleMbgmPaket([meldung(95_000, 28.45, berechneBeitragCent(95_000, 28.45))], OPT);
  assert.deepEqual(pruefeMbgmPaket(saetze), []);
});

test('pruefeBeitraege: rechnet gegen die jeweils vorangehende Verrechnungsbasis', () => {
  const basis = meldung(200_000, 39.6, 79_200);
  const block = basis.tarifbloecke[0]!;
  const m: Beitragsgrundlagenmeldung = {
    ...basis,
    tarifbloecke: [
      {
        ...block,
        basen: [
          ...block.basen,
          {
            typ: 'SZ',
            betragCent: 100_000,
            // Gegen die erste Basis (2.000,00 €) gerechnet wären das 792,00 €.
            positionen: [{ typ: 'T02', prozentsatz: 39.6, betragCent: 39_600 }],
          },
        ],
      },
    ],
  };
  assert.deepEqual(pruefeBeitraege(erstelleMbgmPaket([m], OPT)), []);
});

test('pruefeBeitraege: Beitrag 0,00 € braucht das Vorzeichen „+" (D.62)', () => {
  const saetze = erstelleMbgmPaket([meldung(32, 1.53, 0)], OPT);
  assert.deepEqual(pruefeBeitraege(saetze), []);
  const v1 = saetze.find((s) => s.satzart === 'V1')!;
  const falsch = saetze.map((s) => (s === v1 ? { ...s, werte: { ...s.werte, RSVZ: '-' } } : s));
  const befunde = pruefeBeitraege(falsch);
  assert.equal(befunde.length, 1);
  assert.match(befunde[0]?.meldung ?? '', /Vorzeichen/);
});

test('pruefeBeitraege: beim Vorschreiber wird nichts nachgerechnet', () => {
  const saetze = erstelleMbgmPaket([meldung(95_000, 28.45, 27_027)], { ...OPT, verfahren: 'vorschreibung' });
  assert.deepEqual(
    pruefeMbgmPaket(saetze).filter((b) => b.code === 'DM-D.62'),
    [],
  );
});
