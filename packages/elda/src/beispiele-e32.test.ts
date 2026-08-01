import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleMbgmPaket, VERRECHNUNGSGRUNDLAGE, type PaketOptionen } from './mbgm';

/**
 * Die durchgerechneten Beispiele aus Kapitel E.32.2 der
 * Organisationsbeschreibung, als Tests kodiert.
 *
 * Der Grund fuer diesen Aufwand: Code und Tests entstehen aus derselben Lesart
 * der Spezifikation. Eine Fehldeutung waere in beiden gleichermassen enthalten
 * und bliebe unentdeckt. Die Beispiele des Dokuments sind die einzige
 * unabhaengige Instanz -- bei E.29 haben genau sie drei Lesefehler aufgedeckt,
 * die 200 selbst geschriebene Tests ueberlebt hatten.
 */

const BASIS: Omit<PaketOptionen, 'verfahren'> = {
  paketreferenzwert: 'P-1',
  beitragskontonummer: '1234567890',
  dienstgebername: 'Musterbetrieb',
  beitragszeitraum: '072026',
  jaehrlicheAbrechnungGeringfuegiger: false,
};

// --- E.32.2.3.1, Seite 365 -------------------------------------------------

test('Beispiel 01a: Arbeiter unter 60, SV-Zeit ohne BV, 2.000,00 EUR', () => {
  // Wortlaut: "Arbeiter unter 60 Jahre mit durchgehender Versicherungszeit SV
  // (ohne BV) mit einem Einkommen von EUR 2.000,00 (keine AV-Reduktion)"
  const saetze = erstelleMbgmPaket(
    [
      {
        referenzwert: 'M-1',
        versicherungsnummer: '1234010180',
        familienname: 'Muster',
        vorname: 'Max',
        // "durchgehende Versicherungszeit SV (ohne BV)" -> SV-Verrechnung mit
        // Zeit in der SV.
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B001', // Arbeiter
            beginnDerVerrechnung: 1,      // VVON = 01
            basen: [
              {
                typ: 'AB',                 // allgemeine Beitragsgrundlage
                betragCent: 200_000,       // VBBT = 2.000,00
                positionen: [{ typ: 'T01', prozentsatz: 39.6, betragCent: 79_200 }],
              },
            ],
          },
        ],
      },
    ],
    { ...BASIS, verfahren: 'selbstabrechnung' },
  );

  assert.deepEqual(saetze.map((s) => s.satzart), ['PS', 'G1', 'T1', 'BS', 'V1', 'PE']);

  const [ps, g1, t1, bs, v1, pe] = saetze;
  // PS: GSVZ = +   GSUM = 792,00   ANZM = 1
  assert.equal(ps?.werte.GSVZ, '+');
  assert.equal(ps?.werte.GSUM, '79200');
  assert.equal(ps?.werte.ANZM, '1');
  // G1: VSUM = 792,00
  assert.equal(g1?.werte.VSUM, '79200');
  // T1: BSGR = B001   ERGB = unbelegt   VVON = 01
  assert.equal(t1?.werte.BSGR, 'B001');
  assert.equal(t1?.werte.ERGB1, undefined, 'ERGB ist im Beispiel ausdruecklich unbelegt');
  assert.equal(t1?.werte.VVON, '1');
  // BS: VBTY = AB   VBBT = 2.000,00
  assert.equal(bs?.werte.VBTY, 'AB');
  assert.equal(bs?.werte.VBBT, '200000');
  // V1: VPTY = T01  VPVZ = +  VPTA = 39,60%  RSVZ = +  RSUM = 792,00
  assert.equal(v1?.werte.VPTY, 'T01');
  assert.equal(v1?.werte.VPVZ, '+');
  assert.equal(v1?.werte.VPTA, '39600', '39,60 % sind 39600 Tausendstel');
  assert.equal(v1?.werte.RSVZ, '+');
  assert.equal(v1?.werte.RSUM, '79200');
  assert.equal(pe?.satzart, 'PE');

  // Die Rechnung des Dokuments geht auf: 2.000,00 x 39,60 % = 792,00
  assert.equal(Math.round(200_000 * 0.396), 79_200);
});

// --- E.32.2.9, Seite 384 ---------------------------------------------------

test('Beispiel 19: Vorschreiber, Arbeiter mit Nachtschwerarbeitsbeitrag', () => {
  // Wortlaut: "Arbeiter mit Nachtschwerarbeitsbeitrag (also mit entsprechender
  // Ergaenzung zur Beschaeftigtengruppe) mit durchgehender Versicherungszeit SV
  // (ohne BV) mit einem Einkommen von EUR 2.000,00."
  const saetze = erstelleMbgmPaket(
    [
      {
        referenzwert: 'M-1',
        versicherungsnummer: '1234010180',
        familienname: 'Muster',
        vorname: 'Max',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B001',
            ergaenzungen: ['E01'], // Nachtschwerarbeitsbeitrag
            beginnDerVerrechnung: 1,
            basen: [
              {
                typ: 'AB',
                // Beim Vorschreiber der UNBEGRENZTE Wert (D.59, Seite 141).
                betragCent: 200_000,
                positionen: [{ typ: 'T01', prozentsatz: 0, betragCent: 0 }],
              },
            ],
          },
        ],
      },
    ],
    { ...BASIS, verfahren: 'vorschreibung' },
  );

  assert.deepEqual(saetze.map((s) => s.satzart), ['PV', 'G2', 'T1', 'BV', 'V2', 'PE']);

  const [, , t1, bv, v2] = saetze;
  // T1: BSGR = B001   ERGB = E01   VVON = 01
  assert.equal(t1?.werte.BSGR, 'B001');
  assert.equal(t1?.werte.ERGB1, 'E01');
  assert.equal(t1?.werte.VVON, '1');
  // BV: VBTY = AB   VBBT = 2.000,00
  assert.equal(bv?.werte.VBTY, 'AB');
  assert.equal(bv?.werte.VBBT, '200000');
  // V2: VPTY = T01 -- mehr druckt das Dokument nicht ab.
  assert.equal(v2?.werte.VPTY, 'T01');
});
