import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleDktAbrechnung, type DktAbrechnung } from './dkt-abrechnung';
import { liesDktBestand } from './dkt-lesen';
import { vpnrPruefzifferGueltig, vsnrPruefzifferGueltig } from './pruefziffer';

/**
 * Die Beispiele der Organisationsbeschreibung DKT 2.2 (Stand 20.06.2025) als
 * Tests. Namen und Nummern stammen aus dem Dokument selbst.
 */

// E.3 „Praxisbezogenes Muster-Abrechnungsbeispiel", Seite 51. Das Beispiel steht
// im PDF nur als Bild (eingebettetes Bild 1563 × 314, die neue Fassung mit
// VERSD 16; die durchgestrichene alte mit VERSD 15 daneben ist nicht
// übernommen). Abgeschrieben Feld für Feld entlang der Tabellen aus Kapitel F und
// gegen eine Zeichenerkennung mit Spaltenraster abgeglichen; jede Zeile hat 128
// Zeichen.
const MUSTER_E3 = [
  '00       14285222 18TKTK00000103022024101530Mustermann-Vertragspartner                   AUT6300   1830020139977440    16       ',
  '188285222002401000010001030224ATU31726308   000                          006580002852221621109911285222ATU44766106   000000000  ',
  '188285222002401000020118800001  Mustermann                    Adam           1234567890000            833482LANDESKRAN851301240 ',
  '1882852220024010000306AUT6330     Hauptstrasse 123              Kufstein                                                        ',
  '188285222002401000042016012408150915091510151115        KU-A1234Kufstein        AUT 6330Innsbruck       833482  300605010000000 ',
  '18828522200240100005210000003629L8AE0007600700000532010000000000000        L8AM0005800900000522010000000000000                  ',
  '18828522200240100006210000003629D3R53                                                                                           ',
  '188285222002401000072300000002253101241000002000010540000000000000010540000001054000011594000000000000000000000000000           ',
  '1882852220024010000899000100000001000201000100010000000000000000000                                                             ',
  '99       14285222 18000010                                                                                                      ',
];

/** Ersetzt ab Position `pos` (1-basiert wie im Dokument) den Text. */
function setze(satz: string, pos: number, text: string): string {
  return satz.slice(0, pos - 1) + text + satz.slice(pos - 1 + text.length);
}

test('Muster E.3: jede Zeile hat 128 Zeichen', () => {
  assert.equal(MUSTER_E3.length, 10);
  for (const z of MUSTER_E3) assert.equal(z.length, 128);
});

test('Muster E.3: wird vollständig gelesen', () => {
  const b = liesDktBestand(MUSTER_E3.join('\r\n'));
  assert.equal(b.rueckmeldung, false);
  assert.equal(b.vorlauf['VSTRU'], '14');
  assert.equal(b.vorlauf['OBUS'], '285222 ');
  assert.equal(b.vorlauf['VSTR'], '18');
  assert.equal(b.vorlauf['PROJ'], 'TK');
  assert.equal(b.vorlauf['BEST'], 'TK');
  assert.equal(b.vorlauf['DTNR'], '000001');
  assert.equal(b.vorlauf['EDAT'], '03022024');
  assert.equal(b.vorlauf['EZEI'], '101530');
  assert.equal(b.vorlauf['HRST']!.trimEnd(), 'Mustermann-Vertragspartner');
  assert.equal(b.vorlauf['ELDAS'], '300201');
  assert.equal(b.vorlauf['ELDAÜ'], '39977440');
  assert.equal(b.vorlauf['VERS'], '16');
  assert.deepEqual(b.kopf, {
    abrechnungsstelle: '18',
    bundeslandAbrechnungsstelle: '8',
    vpnr: '285222',
    adresscode: '00',
    abrechnungsjahr: '24',
    abrechnungszeitraum: '01',
  });
  assert.equal(b.beginn['VERSD'], '16');
  assert.equal(b.beginn['FACHL'], '65');
  assert.equal(b.beginn['ABRA'], '1');
  assert.equal(b.beginn['VPNRU'], '285222');
  // Stellen 90–96: in der Fassung vom 15.11.2023 noch „RES DVR" (DVR-Nummer des
  // rechnungslegenden VP), heute Reservefeld — das Muster trägt die alte Belegung.
  assert.equal(b.beginn['RES14'], '2110991');

  assert.equal(b.faelle.length, 1);
  const f = b.faelle[0]!;
  assert.deepEqual(f.versicherter, {
    traeger: '18',
    bundesland: '8',
    belegnummer: 1,
    familienname: 'Mustermann',
    vorname: 'Adam',
    vsnr: '1234567890',
    verordnerVpnr: '833482',
    verordnerName: 'LANDESKRAN',
    fachgebiet: '85',
    antragsdatum: '130124',
    vorzeichen: '0',
  });
  assert.deepEqual(f.adresse, { staat: 'AUT', plz: '6330', strasse: 'Hauptstrasse 123', ort: 'Kufstein' });
  assert.deepEqual(f.transport, {
    datum: '160124',
    beginn: '0815',
    ankunft: '0915',
    warteVon: '0915',
    warteBis: '1015',
    ende: '1115',
    kennzeichen: 'KU-A1234',
    vonOrt: 'Kufstein',
    von: 'AUT 6330',
    nachOrt: 'Innsbruck',
    nach: '833482',
    grund: '30',
    art: '06',
    fahrzeug: '05',
    zeitkritisch: false,
    befoerderung: '1',
  });
  assert.equal(f.rechnungsnummer, '0000003629');
  assert.deepEqual(
    f.leistungen.map((l) => [l.art, l.position, l.tarifCent, l.anzahl, l.betragCent, l.ustProzent]),
    [
      ['L', '8AE', 76, 70, 5320, 10],
      ['L', '8AM', 58, 90, 5220, 10],
    ],
  );
  assert.deepEqual(f.diagnose, { kennzeichen: '3', inhalt: 'R53' });

  assert.equal(b.summen.length, 1);
  const s = b.summen[0]!;
  assert.equal(s.rechnungsnummer, '0000000225');
  assert.equal(s.rechnungsdatum, '310124');
  assert.equal(s.ustProzent, 10);
  assert.equal(s.anzahlLeistungsbloecke, 2);
  assert.equal(s.summeCent, 10540);
  assert.equal(s.zwischensummeCent, 10540);
  assert.equal(s.ustBetragCent, 1054);
  assert.equal(s.rechnungsbetragCent, 11594);
  assert.deepEqual(b.dateiende, {
    ANZ01: 1,
    ANZ02: 0,
    ANZ20: 1,
    ANZ21: 2,
    ANDP: 1,
    ANZ06: 1,
    ANZ23: 1,
    ANZ07: 0,
    ANZ11: 0,
    ANZ39: 0,
    ANZ85: 0,
  });
  assert.equal(b.schluss['SANZ'], '000010');
});

test('Muster E.3: die Beträge folgen den Formeln aus Kapitel D', () => {
  const b = liesDktBestand(MUSTER_E3.join('\r\n'));
  const l = b.faelle[0]!.leistungen;
  // D.11: BETR = TAR * ANZKM
  for (const x of l) assert.equal(x.betragCent, x.tarifCent * x.anzahl);
  const s = b.summen[0]!;
  assert.equal(s.summeCent, l[0]!.betragCent + l[1]!.betragCent); // D.50 SUM = Netto-Summe
  assert.equal(s.zwischensummeCent, s.summeCent - s.kostenbeteiligungCent); // D.50 ZSUM = SUM - KOBE
  assert.equal(s.ustBetragCent, (s.summeCent * s.ustProzent) / 100); // D.50 UBE von SUM
  assert.equal(s.rechnungsbetragCent, s.zwischensummeCent + s.ustBetragCent - s.kostenbeteiligungUstCent); // D.41
});

/** Die Eingabe, aus der der Satzbau das Muster E.3 nachbaut. */
const E3_EINGABE: DktAbrechnung = {
  traeger: '18',
  abrechnungsstelle: '18',
  bundeslandAbrechnungsstelle: '8',
  datentraegernummer: 1,
  // 03.02.2024 10:15:30 Wiener Ortszeit (MEZ, UTC+1)
  erstellt: new Date('2024-02-03T09:15:30Z'),
  testdaten: false,
  uebermittler: { name: 'Mustermann-Vertragspartner', staat: 'AUT', plz: '6300', vpnr: '285222' },
  vertragspartner: { vpnr: '285222', adresscode: 0, bundesland: '8', uid: 'ATU44766106' },
  abrechnungsjahr: 2024,
  abrechnungsmonat: 1,
  abrechnungsart: 'normal',
  rechnungsnummer: '0000000225',
  rechnungsdatum: '2024-01-31',
  faelle: [
    {
      versicherter: {
        traeger: '18',
        bundesland: '8',
        familienname: 'Mustermann',
        vorname: 'Adam',
        // Das Muster trägt 1234567890 — ein Platzhalter mit falscher Prüfziffer
        // (D.61: Rest 5, Prüfziffer 4). Der Satzbau weist ihn ab; hier steht eine
        // erfundene gültige Nummer, der Vergleich unten setzt sie ein.
        vsnr: '1237010180',
      },
      belegnummer: 1,
      verordner: { vpnr: '833482', familienname: 'LANDESKRAN', fachgebiet: '85' },
      antragsdatum: '2024-01-13',
      adresse: { staat: 'AUT', plz: '6330', strasse: 'Hauptstrasse 123', ort: 'Kufstein' },
      transport: {
        datum: '2024-01-16',
        beginn: '08:15',
        ankunft: '09:15',
        warteVon: '09:15',
        warteBis: '10:15',
        ende: '11:15',
        kennzeichen: 'KU-A1234',
        vonOrt: 'Kufstein',
        von: { staat: 'AUT', plz: '6330' },
        nachOrt: 'Innsbruck',
        nach: { vpnr: '833482' },
        grund: '30',
        art: '06',
        fahrzeug: '05',
        zeitkritisch: false,
        befoerderung: '1',
      },
      rechnungsnummer: '0000003629',
      leistungen: [
        { position: '8AE', tarifCent: 76, anzahl: 70, ustProzent: 10 },
        { position: '8AM', tarifCent: 58, anzahl: 90, ustProzent: 10 },
      ],
      diagnose: { icd10: [{ code: 'R53' }] },
    },
  ],
};

test('Muster E.3: der Satzbau erzeugt das Muster — bis auf vier begründete Stellen', () => {
  const erwartet = [...MUSTER_E3];
  // 1. ELDAS/ELDAÜ „werden von ELDA befüllt" (D.23) — die übermittelnde Stelle lässt sie leer.
  erwartet[0] = setze(erwartet[0]!, 102, ' '.repeat(14));
  // 2. UIDV: Das Muster trägt die frühere UID der Tiroler Gebietskrankenkasse; heute
  //    gilt für die ÖGK ATU74552637 (D.56). Stellen 90–96: alte DVR-Nummer → blank (D.42).
  erwartet[1] = setze(erwartet[1]!, 31, 'ATU74552637   ');
  erwartet[1] = setze(erwartet[1]!, 90, ' '.repeat(7));
  // 3. VSNRV: gültige erfundene Nummer statt des Platzhalters.
  erwartet[2] = setze(erwartet[2]!, 78, '1237010180');
  // 4. PLZL: D.38 verlangt „rechtsbündig mit führenden blank", das Muster schreibt
  //    linksbündig. Offener Punkt; der Satzbau folgt dem Text von D.38.
  erwartet[3] = setze(erwartet[3]!, 26, '     6330');

  const gebaut = erstelleDktAbrechnung(E3_EINGABE).toString('latin1').split('\r\n');
  assert.deepEqual(gebaut, erwartet);
});

test('D.63: Prüfziffer der Vertragspartnernummer — die Beispiele des Dokuments', () => {
  // „Vertragspartnernummer: 7 4 1 2 5 … = 86 : 11 = 7, Rest 9 = Prüfziffer"
  assert.equal(vpnrPruefzifferGueltig('741259'), true);
  // Regel 2: Rest + 5, Zehnerstelle entfernt → 4
  assert.equal(vpnrPruefzifferGueltig('741254'), true);
  // „Die Laufnummer 28902 ergibt … die zwei Vertragspartnernummern 289029 und 289024."
  assert.equal(vpnrPruefzifferGueltig('289029'), true);
  assert.equal(vpnrPruefzifferGueltig('289024'), true);
  // „Die Laufnummer 10540 ergibt, aufgrund des Divisionsrests von 10, eine Vertragspartnernummer 105405."
  assert.equal(vpnrPruefzifferGueltig('105405'), true);
  assert.equal(vpnrPruefzifferGueltig('105400'), false);
  for (const falsch of ['741250', '741258', '289020', '28902', '2890290', 'A89029']) {
    assert.equal(vpnrPruefzifferGueltig(falsch), false, falsch);
  }
  // Die Nummern aus dem Muster E.3 und die Sammelnummern aus D.63 sind gültig.
  for (const gueltig of ['285222', '833482', '401988', '401993', '402000', '402016']) {
    assert.equal(vpnrPruefzifferGueltig(gueltig), true, gueltig);
  }
});

test('D.61: Prüfziffer der Versicherungsnummer — das Beispiel des Dokuments', () => {
  // „Die Versicherungsnummer lautet 168 0 25 02 50 … Die Produktsumme ist 176,
  // dividiert durch 11, verbleibt ein Rest von 0 (= Prüfziffer)."
  assert.equal(vsnrPruefzifferGueltig('1680250250'), true);
  assert.equal(vsnrPruefzifferGueltig('1681250250'), false);
});

test('D.4: Transport nach dem Abrechnungszeitraum — das Beispiel des Dokuments', () => {
  // „Abrechnung für März 2012 … Transport am 01.04.2012 … frühestens in der
  // Abrechnung für April 2012 in Rechnung zu stellen."
  const fall = E3_EINGABE.faelle[0]!;
  const maerz = {
    ...E3_EINGABE,
    erstellt: new Date('2012-04-10T08:00:00Z'),
    abrechnungsjahr: 2012,
    abrechnungsmonat: 3,
    rechnungsdatum: '2012-04-10',
    faelle: [{ ...fall, antragsdatum: '2012-03-30', transport: { ...fall.transport, datum: '2012-04-01' } }],
  };
  assert.throws(() => erstelleDktAbrechnung(maerz), /D\.4/);
  assert.doesNotThrow(() => erstelleDktAbrechnung({ ...maerz, abrechnungsmonat: 4 }));
});

test("D.38: Postleitzahl mit Länderkennzeichen — 'AUT 2500' für Baden bei Wien", () => {
  const fall = E3_EINGABE.faelle[0]!;
  const b = erstelleDktAbrechnung({
    ...E3_EINGABE,
    faelle: [{ ...fall, transport: { ...fall.transport, von: { staat: 'AUT', plz: '2500' } } }],
  });
  const transport = b.toString('latin1').split('\r\n')[4]!;
  assert.equal(transport.slice(80, 88), 'AUT 2500');
});

test('F.10.1: Pauschale über 999,99 € — TAR 00000, ANZKM 1, BETR der Tarifwert', () => {
  const fall = E3_EINGABE.faelle[0]!;
  const b = erstelleDktAbrechnung({
    ...E3_EINGABE,
    faelle: [{ ...fall, leistungen: [{ position: '8AP', tarifCent: 123450, anzahl: 1, ustProzent: 10 }] }],
  });
  const leistung = b.toString('latin1').split('\r\n')[5]!;
  const block = leistung.slice(32, 75);
  assert.equal(block.slice(0, 4), 'L8AP');
  assert.equal(block.slice(4, 9), '00000'); // TAR
  assert.equal(block.slice(9, 13), '0001'); // ANZKM
  assert.equal(block.slice(13, 21), '00123450'); // BETR
});

test('D.58: UV-Aktenzeichen — das Beispiel 1011190342001 landet in SART 06, Stellen 90–102', () => {
  const fall = E3_EINGABE.faelle[0]!;
  const b = erstelleDktAbrechnung({
    ...E3_EINGABE,
    faelle: [{ ...fall, adresse: { ...fall.adresse!, uvAktenzeichen: '1011190342001' } }],
  });
  const adresse = b.toString('latin1').split('\r\n')[3]!;
  assert.equal(adresse.slice(89, 102), '1011190342001');
});

test('D.17: ICD-10-Diagnosen als 6 × (3+1+1) Stellen', () => {
  const fall = E3_EINGABE.faelle[0]!;
  const b = erstelleDktAbrechnung({
    ...E3_EINGABE,
    faelle: [
      {
        ...fall,
        diagnose: {
          icd10: [
            { code: 'N18', untergliederung1: '5' },
            { code: 'Z99', untergliederung1: '2' },
          ],
        },
      },
    ],
  });
  const diagnose = b.toString('latin1').split('\r\n')[6]!;
  const block = diagnose.slice(32, 75);
  assert.equal(block[0], 'D');
  assert.equal(block[1], '3'); // DIAKZ: ICD-10-Code
  // DIAG Stellen 3–5, DIAGU1 6, DIAGU2 7, DIAG1 8–10, DIAG1U1 11, DIAG1U2 12
  assert.equal(block.slice(2, 12), 'N185 Z992 ');
});
