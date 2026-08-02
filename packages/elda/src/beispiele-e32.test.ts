import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleMbgmPaket, VERRECHNUNGSGRUNDLAGE, type PaketOptionen } from './mbgm';
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
