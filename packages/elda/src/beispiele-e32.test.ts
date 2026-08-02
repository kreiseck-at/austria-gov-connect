import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  erstelleMbgmPaket,
  VERRECHNUNGSGRUNDLAGE,
  type PaketOptionen,
  type MbgmEintrag,
  type Verfahren,
} from './mbgm';
import { pruefeAbfolge } from './abfolge-e32';
import { pruefeMbgmPaket } from './pruefung-e32';

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
            beginnDerVerrechnung: 1, // VVON = 01
            basen: [
              {
                typ: 'AB', // allgemeine Beitragsgrundlage
                betragCent: 200_000, // VBBT = 2.000,00
                positionen: [{ typ: 'T01', prozentsatz: 39.6, betragCent: 79_200 }],
              },
            ],
          },
        ],
      },
    ],
    { ...BASIS, verfahren: 'selbstabrechnung' },
  );

  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PS', 'G1', 'T1', 'BS', 'V1', 'PE'],
  );

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

  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PV', 'G2', 'T1', 'BV', 'V2', 'PE'],
  );

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

test('Beispiel 19: beim Vorschreiber bleiben alle Betragsfelder leer', () => {
  // Das abgedruckte Beispiel zeigt auf PV nur ANZM, auf G2 gar nichts und auf
  // V2 allein VPTY. Pflichtstufe Z4 heisst: darf mitgegeben werden, wird aber
  // NICHT uebernommen. Der Pruefkatalog fuehrt fuer PV keine Summenpruefung.
  // Deshalb schreibt dieses Paket dort nichts -- ein uebertragener Wert haette
  // keinen Nutzen, aber das Risiko, dass jemand den gedeckelten statt des
  // unbegrenzten Betrags schickt (D.59).
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
            ergaenzungen: ['E01'],
            beginnDerVerrechnung: 1,
            // Weder Prozentsatz noch Betrag: im Vorschreibeverfahren rechnet
            // die OeGK, der Aufrufer hat die Zahlen gar nicht.
            basen: [{ typ: 'AB', betragCent: 200_000, positionen: [{ typ: 'T01' }] }],
          },
        ],
      },
    ],
    { ...BASIS, verfahren: 'vorschreibung' },
  );

  const [pv, g2, , bv, v2] = saetze;
  assert.equal(pv?.werte.ANZM, '1', 'die Anzahl bleibt zwingend');
  assert.equal(pv?.werte.GSVZ, undefined);
  assert.equal(pv?.werte.GSUM, undefined);
  assert.equal(g2?.werte.VSUM, undefined);
  assert.equal(bv?.werte.VBBT, '200000', 'die Beitragsgrundlage selbst wird sehr wohl gemeldet');
  assert.equal(v2?.werte.VPTY, 'T01');
  assert.equal(v2?.werte.VPVZ, undefined);
  assert.equal(v2?.werte.VPTA, undefined);
  assert.equal(v2?.werte.RSVZ, undefined);
  assert.equal(v2?.werte.RSUM, undefined);
});

test('bei der Selbstabrechnung sind Prozentsatz und Betrag zwingend', () => {
  assert.throws(
    () =>
      erstelleMbgmPaket(
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
                beginnDerVerrechnung: 1,
                basen: [{ typ: 'AB', betragCent: 200_000, positionen: [{ typ: 'T01' }] }],
              },
            ],
          },
        ],
        { ...BASIS, verfahren: 'selbstabrechnung' },
      ),
    /zwingend/,
  );
});

// --- E.32.2.9 ff., Vorschreibung -------------------------------------------

/** Gemeinsamer Rumpf der Vorschreibungs-Beispiele. */
const vorschreiber = (tarifbloecke: unknown) =>
  erstelleMbgmPaket(
    [
      {
        referenzwert: 'M-1',
        versicherungsnummer: '1234010180',
        familienname: 'Muster',
        vorname: 'Max',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: tarifbloecke as never,
      },
    ],
    { ...BASIS, verfahren: 'vorschreibung' },
  );

test('Beispiel 20: Neugruendungsfoerderung — drei Positionen zu einer Basis', () => {
  // "Arbeiter mit durchgehender Versicherungszeit SV (ohne BV) mit einem
  // Einkommen von EUR 1.400,00 und Neugruendungsfoerderung."
  const saetze = vorschreiber([
    {
      beschaeftigtengruppe: 'B001',
      beginnDerVerrechnung: 1,
      basen: [
        {
          typ: 'AB',
          betragCent: 140_000,
          // T01 Standardverrechnung, A07 WF-Entfall, A08 UV-Entfall.
          positionen: [{ typ: 'T01' }, { typ: 'A07' }, { typ: 'A08' }],
        },
      ],
    },
  ]);
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PV', 'G2', 'T1', 'BV', 'V2', 'V2', 'V2', 'PE'],
  );
  assert.deepEqual(
    saetze.filter((s) => s.satzart === 'V2').map((s) => s.werte.VPTY),
    ['T01', 'A07', 'A08'],
  );
  assert.equal(saetze.find((s) => s.satzart === 'BV')?.werte.VBBT, '140000');
});

test('Beispiel 21: zwei Verrechnungsbasen, Betrag ueber der Hoechstbeitragsgrundlage', () => {
  // "Arbeiter ueber 60 und unter 63 Jahre mit bestehendem Anspruch auf eine
  // Alterspension [...] mit einem Einkommen von EUR 6.200,00."
  //
  // Anmerkung des Dokuments: "Wie nachfolgend ersichtlich ist hier auch fuer die
  // allgemeine Beitragsgrundlage das Einkommen OHNE Beruecksichtigung der
  // Hoechstbeitragsgrundlage zu uebergeben, die Begrenzung erfolgt im Rahmen
  // der Vorschreibung." Genau deshalb steht hier der volle Betrag.
  const saetze = vorschreiber([
    {
      beschaeftigtengruppe: 'B001',
      beginnDerVerrechnung: 1,
      basen: [
        { typ: 'AB', betragCent: 620_000, positionen: [{ typ: 'T01' }, { typ: 'A10' }] },
        { typ: 'BV', betragCent: 620_000, positionen: [{ typ: 'V01' }] },
      ],
    },
  ]);
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PV', 'G2', 'T1', 'BV', 'V2', 'V2', 'BV', 'V2', 'PE'],
  );
  const basen = saetze.filter((s) => s.satzart === 'BV');
  assert.deepEqual(
    basen.map((s) => s.werte.VBTY),
    ['AB', 'BV'],
  );
  assert.deepEqual(
    basen.map((s) => s.werte.VBBT),
    ['620000', '620000'],
  );
});

test('Beispiel 23: zwei Beschaeftigungen im Monat — zwei Tarifbloecke', () => {
  // "Ein Angestellter [...] beendet am 10ten des Kalendermonats die
  // Beschaeftigung [...] und nimmt am 11ten [...] eine neuerliche Beschaeftigung
  // beim selben Dienstgeber auf."
  //
  // E.32.2.2.2, Grundsatz 2c: Mehr als ein Tarifblock ist bei mehreren
  // Beschaeftigungen im Beitragszeitraum ZWINGEND. Beide gehoeren aber in
  // dieselbe mBGM (Grundsatz 1).
  const saetze = vorschreiber([
    {
      beschaeftigtengruppe: 'B002',
      beginnDerVerrechnung: 1,
      basen: [
        { typ: 'AB', betragCent: 200_000, positionen: [{ typ: 'T01' }] },
        { typ: 'BV', betragCent: 200_000, positionen: [{ typ: 'V01' }] },
      ],
    },
    {
      beschaeftigtengruppe: 'B002',
      beginnDerVerrechnung: 11,
      basen: [
        { typ: 'AB', betragCent: 700_000, positionen: [{ typ: 'T01' }] },
        { typ: 'BV', betragCent: 700_000, positionen: [{ typ: 'V01' }] },
      ],
    },
  ]);
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PV', 'G2', 'T1', 'BV', 'V2', 'BV', 'V2', 'T1', 'BV', 'V2', 'BV', 'V2', 'PE'],
  );
  const bloecke = saetze.filter((s) => s.satzart === 'T1');
  assert.deepEqual(
    bloecke.map((s) => s.werte.VVON),
    ['1', '11'],
  );
  // Die Betraege sind tageweise aliquotiert, nicht die vollen Monatsbezuege.
  assert.deepEqual(
    saetze.filter((s) => s.satzart === 'BV' && s.werte.VBTY === 'AB').map((s) => s.werte.VBBT),
    ['200000', '700000'],
  );
});

// --- E.32.2.6, Beispiel 10: drei Beschaeftigungsfolgen in einem Paket ------

test('Beispiel 10: drei mBGM fuer denselben Versicherten, Summen gehen auf', () => {
  // "Fallweise geringfuegig beschaeftigter Arbeiter am Zweiten des Monats
  // (EUR 100,00), anschliessend kuerzer als ein Monat vereinbarte, geringfuegige
  // Beschaeftigung als Angestellter vom Fuenften bis zum Zehnten (EUR 333,33),
  // abschliessend regelmaessige Beschaeftigung als Angestellter ab dem
  // Fuenfundzwanzigsten (aliquoter Monatslohn EUR 400,00)."
  //
  // Der Fall ist aus zwei Gruenden wertvoll: Er ist das einzige Beispiel mit
  // ANZM=3, und er zeigt, dass drei mBGM fuer DENSELBEN Versicherten zulaessig
  // sind, solange sie zu verschiedenen Beschaeftigungsfolgen gehoeren
  // (E.32.2.2.2, Grundsatz 1).
  //
  // G3 und G5 baut erstelleMbgmPaket noch nicht (siehe TODO dort), deshalb hier
  // die Satzfolge von Hand — geprueft wird die Auswertung.
  const s = (satzart: string, werte: Record<string, string | undefined>) => ({
    satzart,
    werte,
    felder: [],
    satzlaenge: 0,
  });
  const saetze = [
    s('PS', {
      REFP: 'P',
      BKNR: '1234567',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '16325',
      ANZM: '3',
    }),
    s('G3', { REFW: 'M1', VSNR: '1234010180', VSUM: '130' }),
    s('T2', { BSGR: 'B010', FTAG: '2' }),
    s('BS', { VBTY: 'AB', VBBT: '10000' }),
    s('V1', { VPTY: 'T01', VPVZ: '+', VPTA: '1300', RSVZ: '+', RSUM: '130' }),
    s('G5', { REFW: 'M2', VSNR: '1234010180', VSUM: '943' }),
    s('T3', { BSGR: 'B030', BTAB: '5', BTBS: '10' }),
    s('BS', { VBTY: 'AB', VBBT: '33333' }),
    s('V1', { VPTY: 'T01', VPVZ: '+', VPTA: '1300', RSVZ: '+', RSUM: '433' }),
    s('BS', { VBTY: 'BV', VBBT: '33333' }),
    s('V1', { VPTY: 'V01', VPVZ: '+', VPTA: '1530', RSVZ: '+', RSUM: '510' }),
    s('G1', { REFW: 'M3', VSNR: '1234010180', VSUM: '15252' }),
    s('T1', { BSGR: 'B002', VVON: '25' }),
    s('BS', { VBTY: 'AB', VBBT: '40000' }),
    s('V1', { VPTY: 'T01', VPVZ: '+', VPTA: '39600', RSVZ: '+', RSUM: '15840' }),
    s('V1', { VPTY: 'A03', VPVZ: '-', VPTA: '3000', RSVZ: '-', RSUM: '1200' }),
    s('BS', { VBTY: 'BV', VBBT: '40000' }),
    s('V1', { VPTY: 'V01', VPVZ: '+', VPTA: '1530', RSVZ: '+', RSUM: '612' }),
    s('PE', { REFP: 'P', ANZM: '3' }),
  ];

  // Weder die Abfolge noch die Paketpruefungen duerfen etwas beanstanden.
  assert.deepEqual(pruefeAbfolge(saetze), []);
  assert.deepEqual(pruefeMbgmPaket(saetze), []);

  // Die Rechnung des Dokuments, Stelle fuer Stelle nachvollzogen:
  assert.equal(130 + 943 + 15252, 16325, 'GSUM = Summe der drei VSUM');
  assert.equal(433 + 510, 943, 'VSUM der G5-Meldung');
  assert.equal(15840 - 1200 + 612, 15252, 'VSUM der G1-Meldung, Abschlag abgezogen');
  assert.equal(Math.round(40000 * 0.396), 15840, '400,00 x 39,60 %');
  assert.equal(Math.round(33333 * 0.0153), 510, '333,33 x 1,53 % kaufmaennisch gerundet');
});

test('Beispiel 10: dieselbe Beschaeftigungsfolge zweimal waere unzulaessig', () => {
  // Die Gegenprobe zu Grundsatz 1: Drei mBGM sind erlaubt, weil es drei
  // VERSCHIEDENE Folgen sind. Zweimal dieselbe waere es nicht.
  const s = (satzart: string, werte: Record<string, string | undefined>) => ({
    satzart,
    werte,
    felder: [],
    satzlaenge: 0,
  });
  const zweimalFallweise = [
    s('PS', {
      REFP: 'P',
      BKNR: '1',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '260',
      ANZM: '2',
    }),
    s('G3', { REFW: 'M1', VSNR: '1234010180', VSUM: '130' }),
    s('T2', { BSGR: 'B010', FTAG: '2' }),
    s('BS', { VBTY: 'AB', VBBT: '10000' }),
    s('V1', { VPTY: 'T01', VPVZ: '+', VPTA: '1300', RSVZ: '+', RSUM: '130' }),
    s('G3', { REFW: 'M2', VSNR: '1234010180', VSUM: '130' }),
    s('T2', { BSGR: 'B010', FTAG: '3' }),
    s('BS', { VBTY: 'AB', VBBT: '10000' }),
    s('V1', { VPTY: 'T01', VPVZ: '+', VPTA: '1300', RSVZ: '+', RSUM: '130' }),
    s('PE', { REFP: 'P', ANZM: '2' }),
  ];
  // Die Abfolge selbst ist zulaessig -- der Verstoss liegt eine Ebene hoeher.
  assert.deepEqual(pruefeAbfolge(zweimalFallweise), []);
  assert.equal(
    pruefeMbgmPaket(zweimalFallweise).some((b) => /Beschäftigungsfolge/.test(b.meldung)),
    true,
    'zwei fallweise mBGM fuer denselben Versicherten sind unzulaessig — die Tage gehoeren in EINE mBGM, dort als mehrere Tarifbloecke',
  );
});

test('Beispiel 10: gebaut statt nur geprueft — die Satzfolge des Dokuments Zeichen fuer Zeichen', () => {
  // Derselbe Fall wie oben, diesmal ueber erstelleMbgmPaket. Erst mit den
  // Beschaeftigungsfolgen G3/G5 ist das moeglich; vorher liess sich nur die
  // fertige Folge pruefen. Damit deckt der Test jetzt auch den Bau ab.
  const saetze = erstelleMbgmPaket(
    [
      {
        referenzwert: 'M1',
        versicherungsnummer: '1234010180',
        familienname: 'Muster',
        vorname: 'Max',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        folge: 'fallweise',
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 2,
            basen: [
              {
                typ: 'AB',
                betragCent: 10_000,
                positionen: [{ typ: 'T01', prozentsatz: 1.3, betragCent: 130 }],
              },
            ],
          },
        ],
      },
      {
        referenzwert: 'M2',
        versicherungsnummer: '1234010180',
        familienname: 'Muster',
        vorname: 'Max',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        folge: 'kuerzerAlsEinMonat',
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B030',
            ersterTag: 5,
            letzterTag: 10,
            basen: [
              {
                typ: 'AB',
                betragCent: 33_333,
                positionen: [{ typ: 'T01', prozentsatz: 1.3, betragCent: 433 }],
              },
              {
                typ: 'BV',
                betragCent: 33_333,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 510 }],
              },
            ],
          },
        ],
      },
      {
        referenzwert: 'M3',
        versicherungsnummer: '1234010180',
        familienname: 'Muster',
        vorname: 'Max',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B002',
            beginnDerVerrechnung: 25,
            basen: [
              {
                typ: 'AB',
                betragCent: 40_000,
                positionen: [
                  { typ: 'T01', prozentsatz: 39.6, betragCent: 15_840 },
                  { typ: 'A03', prozentsatz: -3, betragCent: -1_200 },
                ],
              },
              {
                typ: 'BV',
                betragCent: 40_000,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 612 }],
              },
            ],
          },
        ],
      },
    ],
    { ...BASIS, verfahren: 'selbstabrechnung' },
  );

  // Die Satzfolge des abgedruckten Diagramms, Position fuer Position.
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    [
      'PS',
      'G3',
      'T2',
      'BS',
      'V1',
      'G5',
      'T3',
      'BS',
      'V1',
      'BS',
      'V1',
      'G1',
      'T1',
      'BS',
      'V1',
      'V1',
      'BS',
      'V1',
      'PE',
    ],
  );

  const [ps] = saetze;
  assert.equal(ps?.werte.GSUM, '16325', 'GSUM = 163,25');
  assert.equal(ps?.werte.ANZM, '3');
  assert.deepEqual(
    saetze.filter((s) => /^G\d$/.test(s.satzart)).map((s) => s.werte.VSUM),
    ['130', '943', '15252'],
  );
  // Die Zeitfelder je Beschaeftigungsfolge.
  assert.equal(saetze.find((s) => s.satzart === 'T2')?.werte.FTAG, '2');
  const t3 = saetze.find((s) => s.satzart === 'T3');
  assert.equal(t3?.werte.BTAB, '5');
  assert.equal(t3?.werte.BTBS, '10');
  assert.equal(saetze.find((s) => s.satzart === 'T1')?.werte.VVON, '25');

  // Und das Ganze ist strukturell zulaessig.
  assert.deepEqual(pruefeAbfolge(saetze), []);
  assert.deepEqual(pruefeMbgmPaket(saetze), []);
});

/*
 * Die uebrigen Beispiele des Kapitels, tabellengetrieben.
 *
 * Oben stehen die Faelle, an denen etwas Eigenes zu zeigen war -- ausfuehrlich,
 * mit der Rechnung des Dokuments daneben. Was folgt, sind die restlichen
 * Diagramme: Jedes ist eine geschlossene Aussage darueber, welche Satzfolge und
 * welche Feldwerte bei einem gegebenen Sachverhalt herauskommen muessen. Der
 * Wert liegt in der Menge -- 24 unabhaengig entstandene Sollwerte gegen eine
 * Umsetzung, die aus derselben Lesart entstanden ist wie ihre eigenen Tests.
 *
 * `erwartet` bildet die Diagrammkaesten der Reihe nach ab. Geprueft werden nur
 * die Felder, die das Dokument abdruckt; `undefined` heisst "im Diagramm
 * ausdruecklich unbelegt".
 */

/** Ein Diagrammkasten: Satzart und die abgedruckten Felder. */
type Kasten = { satzart: string } & Record<string, string | undefined>;

interface Beispiel {
  /** Nummer laut Dokument, zur Wiederauffindbarkeit. */
  nr: string;
  /** Kapitel und Seite. */
  fundstelle: string;
  /** Sachverhalt, gekuerzt aus dem Wortlaut des Dokuments. */
  sachverhalt: string;
  verfahren: Verfahren;
  eintraege: readonly MbgmEintrag[];
  erwartet: readonly Kasten[];
}

/** Versicherter, der in allen folgenden Beispielen derselbe ist. */
const DN = {
  versicherungsnummer: '1234010180',
  familienname: 'Muster',
  vorname: 'Max',
} as const;

/** Standard-Tarifgruppenverrechnung mit Prozentsatz und Betrag (Selbstabrechnung). */
const t01 = (prozentsatz: number, betragCent: number) => ({ typ: 'T01', prozentsatz, betragCent }) as const;

const BEISPIELE: readonly Beispiel[] = [
  {
    nr: '01b',
    fundstelle: 'E.32.2.3.1, Seite 366',
    sachverhalt:
      'Arbeiter unter 60 mit beendeter Versicherungszeit SV (ohne BV) und Verrechnung einer Kuendigungsentschaedigung, 2.000,00 EUR',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B001',
            beginnDerVerrechnung: 1,
            // Der einzige Unterschied zu 01a: KEUE = J.
            enthaeltKuendigungsentschaedigungOderUrlaubsersatz: true,
            basen: [{ typ: 'AB', betragCent: 200_000, positionen: [t01(39.6, 79_200)] }],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '79200', ANZM: '1' },
      { satzart: 'G1', VSUM: '79200' },
      { satzart: 'T1', BSGR: 'B001', ERGB1: undefined, VVON: '1', KEUE: 'J' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '200000' },
      { satzart: 'V1', VPTY: 'T01', VPVZ: '+', VPTA: '39600', RSVZ: '+', RSUM: '79200' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '02',
    fundstelle: 'E.32.2.3.2, Seite 367',
    sachverhalt: 'Arbeiter unter 60, SV ohne BV, 1.000,00 EUR mit AV-Reduktion um 3,00 %',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B001',
            beginnDerVerrechnung: 1,
            basen: [
              {
                typ: 'AB',
                betragCent: 100_000,
                // Zwei Positionen zu einer Basis: Verrechnung und Abschlag.
                positionen: [t01(39.6, 39_600), { typ: 'A03', prozentsatz: -3, betragCent: -3_000 }],
              },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '36600', ANZM: '1' },
      { satzart: 'G1', VSUM: '36600' },
      { satzart: 'T1', BSGR: 'B001', VVON: '1' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '100000' },
      { satzart: 'V1', VPTY: 'T01', VPVZ: '+', VPTA: '39600', RSVZ: '+', RSUM: '39600' },
      { satzart: 'V1', VPTY: 'A03', VPVZ: '-', VPTA: '3000', RSVZ: '-', RSUM: '3000' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '03',
    fundstelle: 'E.32.2.3.3, Seiten 367-368',
    sachverhalt: 'Arbeiter ueber 63 (AV+IE Entfall Pensionsanspruch), SV und BV, 2.500,00 EUR',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B001',
            beginnDerVerrechnung: 1,
            basen: [
              {
                typ: 'AB',
                betragCent: 250_000,
                positionen: [
                  t01(39.6, 99_000),
                  { typ: 'A09', prozentsatz: -1.3, betragCent: -3_250 },
                  { typ: 'A10', prozentsatz: -6.35, betragCent: -15_875 },
                ],
              },
              // Zweite Basis desselben Tarifblocks: die betriebliche Vorsorge.
              {
                typ: 'BV',
                betragCent: 250_000,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 3_825 }],
              },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '83700', ANZM: '1' },
      { satzart: 'G1', VSUM: '83700' },
      { satzart: 'T1', BSGR: 'B001', VVON: '1' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '250000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '39600', RSUM: '99000' },
      { satzart: 'V1', VPTY: 'A09', VPVZ: '-', VPTA: '1300', RSVZ: '-', RSUM: '3250' },
      { satzart: 'V1', VPTY: 'A10', VPVZ: '-', VPTA: '6350', RSVZ: '-', RSUM: '15875' },
      { satzart: 'BS', VBTY: 'BV', VBBT: '250000' },
      { satzart: 'V1', VPTY: 'V01', VPTA: '1530', RSUM: '3825' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '04',
    fundstelle: 'E.32.2.4.1, Seiten 369-370',
    sachverhalt:
      'Untermonatiger Wechsel am Fuenfzehnten von Arbeiterlehrling auf Arbeiter, SV und BV, 500,00 + 700,00 EUR',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        // Zwei Tarifbloecke: "Der untermonatige Wechsel der Beschaeftigtengruppe
        // wird durch die Angabe des Beginns der Verrechnung im Tarifblock
        // automatisch in den Versicherungsverlauf uebertragen."
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B045', // Arbeiterlehrling
            beginnDerVerrechnung: 1,
            basen: [
              {
                typ: 'AB',
                betragCent: 50_000,
                positionen: [t01(28.55, 14_275), { typ: 'A04', prozentsatz: -1.2, betragCent: -600 }],
              },
              {
                typ: 'BV',
                betragCent: 50_000,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 765 }],
              },
            ],
          },
          {
            beschaeftigtengruppe: 'B001', // Arbeiter
            beginnDerVerrechnung: 15,
            basen: [
              {
                typ: 'AB',
                betragCent: 70_000,
                positionen: [t01(39.6, 27_720), { typ: 'A03', prozentsatz: -3, betragCent: -2_100 }],
              },
              {
                typ: 'BV',
                betragCent: 70_000,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 1_071 }],
              },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '41131', ANZM: '1' },
      { satzart: 'G1', VSUM: '41131' },
      { satzart: 'T1', BSGR: 'B045', VVON: '1' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '50000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '28550', RSUM: '14275' },
      { satzart: 'V1', VPTY: 'A04', VPVZ: '-', VPTA: '1200', RSVZ: '-', RSUM: '600' },
      { satzart: 'BS', VBTY: 'BV', VBBT: '50000' },
      { satzart: 'V1', VPTY: 'V01', VPTA: '1530', RSUM: '765' },
      { satzart: 'T1', BSGR: 'B001', VVON: '15' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '70000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '39600', RSUM: '27720' },
      { satzart: 'V1', VPTY: 'A03', VPVZ: '-', VPTA: '3000', RSVZ: '-', RSUM: '2100' },
      { satzart: 'BS', VBTY: 'BV', VBBT: '70000' },
      { satzart: 'V1', VPTY: 'V01', VPTA: '1530', RSUM: '1071' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '05',
    fundstelle: 'E.32.2.4.2, Seite 371',
    sachverhalt:
      'Neuerliche Anmeldung am Vierten waehrend laufender Urlaubsersatzleistung, mit Aufloesungsabgabe 121,00 EUR',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B002', // Angestellter
            beginnDerVerrechnung: 1,
            // "Fuer den Tarifblock fuer die bereits beendete Beschaeftigung
            // (Abrechnung der UE) ist das Kennzeichen KEUE zu belegen."
            enthaeltKuendigungsentschaedigungOderUrlaubsersatz: true,
            basen: [
              { typ: 'AB', betragCent: 300_000, positionen: [t01(39.6, 118_800)] },
              // Die Aufloesungsabgabe hat eine eigene Basis: AA.
              {
                typ: 'AA',
                betragCent: 12_100,
                positionen: [{ typ: 'Z03', prozentsatz: 100, betragCent: 12_100 }],
              },
            ],
          },
          {
            beschaeftigtengruppe: 'B002',
            beginnDerVerrechnung: 4,
            basen: [{ typ: 'AB', betragCent: 400_000, positionen: [t01(39.6, 158_400)] }],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '289300', ANZM: '1' },
      { satzart: 'G1', VSUM: '289300' },
      { satzart: 'T1', BSGR: 'B002', VVON: '1', KEUE: 'J' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '300000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '39600', RSUM: '118800' },
      { satzart: 'BS', VBTY: 'AA', VBBT: '12100' },
      { satzart: 'V1', VPTY: 'Z03', VPTA: '100000', RSUM: '12100' },
      { satzart: 'T1', BSGR: 'B002', VVON: '4' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '400000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '39600', RSUM: '158400' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '06',
    fundstelle: 'E.32.2.5.1, Seiten 372-373',
    sachverhalt: 'Fallweise Beschaeftigung am Zehnten (200,00 EUR) und am Zwanzigsten (150,00 EUR)',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'fallweise',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            // Kein VVON: Bei fallweiser Beschaeftigung stellt FTAG den Bezug her.
            beschaeftigungstag: 10,
            // "Das Einkommen je Kalendertag ist im Bereich der Selbstabrechnung
            // mit der taeglichen Hoechstbeitragsgrundlage zu begrenzen" -- aus
            // 200,00 werden deshalb 162,00.
            basen: [{ typ: 'AB', betragCent: 16_200, positionen: [t01(1.3, 211)] }],
          },
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 20,
            basen: [
              { typ: 'AB', betragCent: 15_000, positionen: [t01(1.3, 195)] },
              {
                typ: 'BV',
                betragCent: 15_000,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 230 }],
              },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '636', ANZM: '1' },
      { satzart: 'G3', VSUM: '636' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '10', VVON: undefined },
      { satzart: 'BS', VBTY: 'AB', VBBT: '16200' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '1300', RSUM: '211' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '20' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '15000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '1300', RSUM: '195' },
      { satzart: 'BS', VBTY: 'BV', VBBT: '15000' },
      { satzart: 'V1', VPTY: 'V01', VPTA: '1530', RSUM: '230' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '07',
    fundstelle: 'E.32.2.5.2, Seiten 373-375',
    sachverhalt: 'Fallweise Beschaeftigung am Ersten und Zweiten mit Anfall der Dienstgeberabgabe',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'fallweise',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 1,
            basen: [
              { typ: 'AB', betragCent: 16_200, positionen: [t01(1.3, 211)] },
              // Die Dienstgeberabgabe laeuft ueber eine eigene Basis (SO) und
              // ist NICHT gedeckelt: 300,00 statt 162,00.
              {
                typ: 'SO',
                betragCent: 30_000,
                positionen: [{ typ: 'Z01', prozentsatz: 16.4, betragCent: 4_920 }],
              },
            ],
          },
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 2,
            basen: [
              { typ: 'AB', betragCent: 10_000, positionen: [t01(1.3, 130)] },
              {
                typ: 'SO',
                betragCent: 10_000,
                positionen: [{ typ: 'Z01', prozentsatz: 16.4, betragCent: 1_640 }],
              },
              {
                typ: 'BV',
                betragCent: 10_000,
                positionen: [{ typ: 'V01', prozentsatz: 1.53, betragCent: 153 }],
              },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '7054', ANZM: '1' },
      { satzart: 'G3', VSUM: '7054' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '1' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '16200' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '1300', RSUM: '211' },
      { satzart: 'BS', VBTY: 'SO', VBBT: '30000' },
      { satzart: 'V1', VPTY: 'Z01', VPTA: '16400', RSUM: '4920' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '2' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '10000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '1300', RSUM: '130' },
      { satzart: 'BS', VBTY: 'SO', VBBT: '10000' },
      { satzart: 'V1', VPTY: 'Z01', VPTA: '16400', RSUM: '1640' },
      { satzart: 'BS', VBTY: 'BV', VBBT: '10000' },
      { satzart: 'V1', VPTY: 'V01', VPTA: '1530', RSUM: '153' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '08',
    fundstelle: 'E.32.2.6.1, Seite 376',
    sachverhalt:
      'Kuerzer als ein Monat vereinbarte Beschaeftigung vom Dritten bis zum Fuenfundzwanzigsten, 400,00 EUR',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'kuerzerAlsEinMonat',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            // Kein VVON und kein FTAG: hier stellen BTAB und BTBS den Bezug her.
            ersterTag: 3,
            letzterTag: 25,
            basen: [{ typ: 'AB', betragCent: 40_000, positionen: [t01(1.3, 520)] }],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '520', ANZM: '1' },
      { satzart: 'G5', VSUM: '520' },
      { satzart: 'T3', BSGR: 'B010', BTAB: '3', BTBS: '25', VVON: undefined, FTAG: undefined },
      { satzart: 'BS', VBTY: 'AB', VBBT: '40000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '1300', RSUM: '520' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '09',
    fundstelle: 'E.32.2.6.2, Seiten 376-377',
    sachverhalt:
      'Geringfuegiger Arbeiter ueber 60, kuerzer als ein Monat vom Zwoelften bis Achtzehnten, 350,00 EUR -- Abzug des UV-Beitrags hebt die Verrechnung genau auf',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'kuerzerAlsEinMonat',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            ersterTag: 12,
            letzterTag: 18,
            basen: [
              {
                typ: 'AB',
                betragCent: 35_000,
                positionen: [t01(1.3, 455), { typ: 'A09', prozentsatz: -1.3, betragCent: -455 }],
              },
            ],
          },
        ],
      },
    ],
    // Summe null, Vorzeichen trotzdem '+' -- so steht es im Diagramm.
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '0', ANZM: '1' },
      { satzart: 'G5', VSUM: '0' },
      { satzart: 'T3', BSGR: 'B010', BTAB: '12', BTBS: '18' },
      { satzart: 'BS', VBTY: 'AB', VBBT: '35000' },
      { satzart: 'V1', VPTY: 'T01', VPTA: '1300', RSVZ: '+', RSUM: '455' },
      { satzart: 'V1', VPTY: 'A09', VPVZ: '-', VPTA: '1300', RSVZ: '-', RSUM: '455' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '11',
    fundstelle: 'E.32.2.7.1, Seiten 379-380',
    sachverhalt: 'Freier Dienstnehmer, noch keine Honorarnote gelegt -- mBGM ohne Verrechnung',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B053',
            beginnDerVerrechnung: 1,
            // "Angabe der Tarifgruppe ohne Folgedatensaetze zur Verrechnung."
            ohneVerrechnung: true,
            basen: [],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '0', ANZM: '1' },
      { satzart: 'G1', VSUM: '0' },
      { satzart: 'T4', BSGR: 'B053', VVON: '1' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '12',
    fundstelle: 'E.32.2.7.2, Seite 380',
    sachverhalt:
      'Fallweise an drei Tagen, Einkommen steht am Siebenten noch nicht fest -- drei T5 ohne Verrechnung',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'fallweise',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [12, 13, 22].map((tag) => ({
          beschaeftigtengruppe: 'B030',
          beschaeftigungstag: tag,
          ohneVerrechnung: true,
          basen: [],
        })),
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '0', ANZM: '1' },
      { satzart: 'G3', VSUM: '0' },
      { satzart: 'T5', BSGR: 'B030', FTAG: '12' },
      { satzart: 'T5', BSGR: 'B030', FTAG: '13' },
      { satzart: 'T5', BSGR: 'B030', FTAG: '22' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '13',
    fundstelle: 'E.32.2.7.3, Seiten 380-381',
    sachverhalt:
      'Freier Dienstnehmer, kuerzer als ein Monat ab dem 27. bis zum Monatsletzten, noch keine Honorarnote',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'kuerzerAlsEinMonat',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B053',
            ersterTag: 27,
            letzterTag: 31,
            ohneVerrechnung: true,
            basen: [],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '0', ANZM: '1' },
      { satzart: 'G5', VSUM: '0' },
      { satzart: 'T6', BSGR: 'B053', BTAB: '27', BTBS: '31' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '14',
    fundstelle: 'E.32.2.8.1, Seite 381',
    sachverhalt: 'Storno fuer die mBGM aus Beispiel 01 -- GSVZ kippt auf Minus',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        summeCent: 79_200,
      },
    ],
    erwartet: [
      // Der Betrag steht positiv in VSUM, wird aber von GSUM abgezogen -- ein
      // reines Stornopaket bekommt daher GSVZ = '-'.
      { satzart: 'PS', GSVZ: '-', GSUM: '79200', ANZM: '1' },
      { satzart: 'R1', VSUM: '79200', REFU: 'M-1' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '15',
    fundstelle: 'E.32.2.8.2, Seiten 381-382',
    sachverhalt: 'Storno fuer die mBGM aus Beispiel 06 (fallweise)',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        folge: 'fallweise',
        summeCent: 636,
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '-', GSUM: '636', ANZM: '1' },
      { satzart: 'R3', VSUM: '636' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '16',
    fundstelle: 'E.32.2.8.3, Seite 382',
    sachverhalt: 'Storno fuer die mBGM aus Beispiel 08 (kuerzer als ein Monat)',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        folge: 'kuerzerAlsEinMonat',
        summeCent: 520,
      },
    ],
    erwartet: [
      { satzart: 'PS', GSVZ: '-', GSUM: '520', ANZM: '1' },
      { satzart: 'R5', VSUM: '520' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '17',
    fundstelle: 'E.32.2.8.4, Seiten 382-383',
    sachverhalt:
      'Storno fuer Beispiel 10, aber nur zwei der drei mBGM -- die regelmaessige Beschaeftigung bleibt bestehen',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        folge: 'fallweise',
        summeCent: 130,
      },
      {
        referenzwert: 'S-2',
        referenzUrspruenglicheMeldung: 'M-2',
        versicherungsnummer: DN.versicherungsnummer,
        folge: 'kuerzerAlsEinMonat',
        summeCent: 943,
      },
    ],
    // 1,30 + 9,43 = 10,73 -- und die dritte mBGM aus Beispiel 10 fehlt hier
    // absichtlich: Storniert wird je mBGM, nicht je Paket.
    erwartet: [
      { satzart: 'PS', GSVZ: '-', GSUM: '1073', ANZM: '2' },
      { satzart: 'R3', VSUM: '130' },
      { satzart: 'R5', VSUM: '943' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '18',
    fundstelle: 'E.32.2.8.5, Seite 383',
    sachverhalt: 'Storno fuer die mBGM ohne Verrechnung aus Beispiel 11 -- Summe null',
    verfahren: 'selbstabrechnung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        summeCent: 0,
      },
    ],
    // Der einzige Storno im Kapitel mit GSVZ = '+': Bei einer Summe von null
    // gibt es nichts abzuziehen, und -0 ist kein negativer Betrag.
    erwartet: [
      { satzart: 'PS', GSVZ: '+', GSUM: '0', ANZM: '1' },
      { satzart: 'R1', VSUM: '0' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '22',
    fundstelle: 'E.32.2.9.3, Seiten 386-387',
    sachverhalt:
      'Vorschreiber: untermonatiger Wechsel am Dreizehnten von Angestelltenlehrling auf Angestellter',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B044',
            beginnDerVerrechnung: 1,
            basen: [
              { typ: 'AB', betragCent: 50_000, positionen: [{ typ: 'T01' }] },
              { typ: 'BV', betragCent: 50_000, positionen: [{ typ: 'V01' }] },
            ],
          },
          {
            beschaeftigtengruppe: 'B002',
            beginnDerVerrechnung: 13,
            basen: [
              { typ: 'AB', betragCent: 100_000, positionen: [{ typ: 'T01' }] },
              { typ: 'BV', betragCent: 100_000, positionen: [{ typ: 'V01' }] },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PV', ANZM: '1' },
      { satzart: 'G2' },
      { satzart: 'T1', BSGR: 'B044', VVON: '1' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '50000' },
      // Beim Vorschreiber bleiben Prozentsatz und Betrag leer -- die OeGK rechnet.
      { satzart: 'V2', VPTY: 'T01', VPTA: undefined, RSUM: undefined },
      { satzart: 'BV', VBTY: 'BV', VBBT: '50000' },
      { satzart: 'V2', VPTY: 'V01' },
      { satzart: 'T1', BSGR: 'B002', VVON: '13' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '100000' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'BV', VBTY: 'BV', VBBT: '100000' },
      { satzart: 'V2', VPTY: 'V01' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '24',
    fundstelle: 'E.32.2.11.1, Seiten 389-390',
    sachverhalt: 'Vorschreiber, fallweise am Zweiten (400,00 EUR) und am Zwanzigsten (150,00 EUR)',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'fallweise',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 2,
            // "Das Einkommen je Kalendertag ist im Bereich der Vorschreibung
            // NICHT mit der taeglichen Hoechstbeitragsgrundlage zu begrenzen" --
            // deshalb steht hier 400,00 und nicht 162,00 wie in Beispiel 06.
            basen: [{ typ: 'AB', betragCent: 40_000, positionen: [{ typ: 'T01' }] }],
          },
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 20,
            basen: [
              { typ: 'AB', betragCent: 15_000, positionen: [{ typ: 'T01' }] },
              { typ: 'BV', betragCent: 15_000, positionen: [{ typ: 'V01' }] },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PV', ANZM: '1' },
      { satzart: 'G4' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '2' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '40000' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '20' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '15000' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'BV', VBTY: 'BV', VBBT: '15000' },
      { satzart: 'V2', VPTY: 'V01' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '25',
    fundstelle: 'E.32.2.11.2, Seiten 390-392',
    sachverhalt: 'Vorschreiber, fallweise am Dreizehnten und Vierzehnten mit Dienstgeberabgabe',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'fallweise',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 13,
            basen: [
              { typ: 'AB', betragCent: 30_000, positionen: [{ typ: 'T01' }] },
              { typ: 'SO', betragCent: 30_000, positionen: [{ typ: 'Z01' }] },
            ],
          },
          {
            beschaeftigtengruppe: 'B010',
            beschaeftigungstag: 14,
            basen: [
              { typ: 'AB', betragCent: 14_000, positionen: [{ typ: 'T01' }] },
              { typ: 'SO', betragCent: 14_000, positionen: [{ typ: 'Z01' }] },
              { typ: 'BV', betragCent: 14_000, positionen: [{ typ: 'V01' }] },
            ],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PV', ANZM: '1' },
      { satzart: 'G4' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '13' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '30000' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'BV', VBTY: 'SO', VBBT: '30000' },
      { satzart: 'V2', VPTY: 'Z01' },
      { satzart: 'T2', BSGR: 'B010', FTAG: '14' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '14000' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'BV', VBTY: 'SO', VBBT: '14000' },
      { satzart: 'V2', VPTY: 'Z01' },
      { satzart: 'BV', VBTY: 'BV', VBBT: '14000' },
      { satzart: 'V2', VPTY: 'V01' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '26',
    fundstelle: 'E.32.2.12.1, Seite 393',
    sachverhalt: 'Vorschreiber, kuerzer als ein Monat vom Zweiten bis zum Monatsletzten, 380,00 EUR',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'kuerzerAlsEinMonat',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            ersterTag: 2,
            letzterTag: 31,
            basen: [{ typ: 'AB', betragCent: 38_000, positionen: [{ typ: 'T01' }] }],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PV', ANZM: '1' },
      { satzart: 'G6' },
      { satzart: 'T3', BSGR: 'B010', BTAB: '2', BTBS: '31' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '38000' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '27',
    fundstelle: 'E.32.2.12.2, Seiten 393-394',
    sachverhalt:
      'Vorschreiber, kuerzer als ein Monat vom Zehnten bis Zwanzigsten mit Neugruendungsfoerderung',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        ...DN,
        referenzwert: 'M-1',
        folge: 'kuerzerAlsEinMonat',
        verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [
          {
            beschaeftigtengruppe: 'B010',
            ersterTag: 10,
            letzterTag: 20,
            // A08 ist beim Vorschreiber ein blosser "Hinweis" auf die
            // Neugruendungsfoerderung -- gerechnet wird er von der OeGK.
            basen: [{ typ: 'AB', betragCent: 39_900, positionen: [{ typ: 'T01' }, { typ: 'A08' }] }],
          },
        ],
      },
    ],
    erwartet: [
      { satzart: 'PV', ANZM: '1' },
      { satzart: 'G6' },
      { satzart: 'T3', BSGR: 'B010', BTAB: '10', BTBS: '20' },
      { satzart: 'BV', VBTY: 'AB', VBBT: '39900' },
      { satzart: 'V2', VPTY: 'T01' },
      { satzart: 'V2', VPTY: 'A08' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '28',
    fundstelle: 'E.32.2.14.1, Seite 395',
    sachverhalt:
      'Vorschreiber: Storno fuer die mBGM aus Beispiel 22 -- "Weitere Satzarten sind nicht erforderlich"',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        summeCent: 0,
      },
    ],
    // Kein GSVZ und kein GSUM: Beim Vorschreiber traegt das Paket keine Summen.
    erwartet: [
      { satzart: 'PV', ANZM: '1', GSUM: undefined, GSVZ: undefined },
      { satzart: 'R2' },
      { satzart: 'PE' },
    ],
  },
  {
    nr: '29',
    fundstelle: 'E.32.2.14.2, Seite 395',
    sachverhalt: 'Vorschreiber: Storno fuer die fallweise mBGM aus Beispiel 24',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        folge: 'fallweise',
        summeCent: 0,
      },
    ],
    erwartet: [{ satzart: 'PV', ANZM: '1' }, { satzart: 'R4' }, { satzart: 'PE' }],
  },
  {
    nr: '30',
    fundstelle: 'E.32.2.14.3, Seite 396',
    sachverhalt: 'Vorschreiber: Storno fuer die kuerzer als ein Monat vereinbarte mBGM aus Beispiel 26',
    verfahren: 'vorschreibung',
    eintraege: [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: DN.versicherungsnummer,
        folge: 'kuerzerAlsEinMonat',
        summeCent: 0,
      },
    ],
    erwartet: [{ satzart: 'PV', ANZM: '1' }, { satzart: 'R6' }, { satzart: 'PE' }],
  },
];

for (const b of BEISPIELE) {
  test(`Beispiel ${b.nr} (${b.fundstelle}): ${b.sachverhalt}`, () => {
    const saetze = erstelleMbgmPaket(b.eintraege, { ...BASIS, verfahren: b.verfahren });

    assert.deepEqual(
      saetze.map((s) => s.satzart),
      b.erwartet.map((k) => k.satzart),
      'Satzfolge weicht vom Diagramm ab',
    );

    b.erwartet.forEach((kasten, i) => {
      const satz = saetze[i];
      for (const [feld, soll] of Object.entries(kasten)) {
        if (feld === 'satzart') continue;
        assert.equal(satz?.werte[feld], soll, `Satz ${i + 1} (${kasten.satzart}), Feld ${feld}`);
      }
    });

    // Jedes abgedruckte Beispiel muss die eigenen Regeln des Kapitels erfuellen.
    assert.deepEqual(pruefeAbfolge(saetze), [], 'Abfolge nach E.32.2.2.6');
    assert.deepEqual(
      pruefeMbgmPaket(saetze).filter((x) => x.schwere === 'fehler'),
      [],
      'Paketpruefungen des Pruefkatalogs',
    );
  });
}

test('alle Beispiele des Kapitels sind kodiert', () => {
  // 01a, 10, 19, 20, 21 und 23 stehen ausfuehrlich weiter oben, der Rest hier.
  const ausfuehrlich = ['01a', '10', '19', '20', '21', '23'];
  const kodiert = new Set([...ausfuehrlich, ...BEISPIELE.map((b) => b.nr)]);
  const alle = ['01a', '01b', ...Array.from({ length: 29 }, (_, i) => String(i + 2).padStart(2, '0'))];
  assert.deepEqual(
    alle.filter((nr) => !kodiert.has(nr)),
    [],
    'Es fehlt ein Beispiel aus E.32.2',
  );
});
