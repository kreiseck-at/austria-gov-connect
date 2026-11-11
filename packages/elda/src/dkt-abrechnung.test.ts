import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleDktAbrechnung, type DktAbrechnung, type DktFall, type DktLeistung } from './dkt-abrechnung';
import { liesDktBestand } from './dkt-lesen';

// Erfundene Testdaten. Vertragspartnernummern mit Prüfziffer nach D.63:
// 123450 (Laufnummer 12345, Rest 0), 543210 (54321, Rest 0), 600033 (60003, Rest 3).
// Versicherungsnummern mit Prüfziffer nach D.61: 1237010180, 7890030990.
const TAXI = '123450';
const KRANKENHAUS = '543210';
const VERORDNER = '600033';
const IBAN = 'AT611904300234573201';

const FALL: DktFall = {
  versicherter: { traeger: '17', familienname: 'Weinzierl', vorname: 'Mirela', vsnr: '1237010180' },
  belegnummer: 1,
  verordner: { vpnr: VERORDNER, familienname: 'Grabner', fachgebiet: '01' },
  antragsdatum: '2026-10-01',
  transport: {
    datum: '2026-10-14',
    beginn: '07:30',
    ankunft: '08:05',
    ende: '08:10',
    vonOrt: 'Salzburg',
    von: { staat: 'AUT', plz: '5020' },
    nachOrt: 'Salzburg',
    nach: { vpnr: KRANKENHAUS },
    grund: '26',
    art: '03',
    fahrzeug: '05',
    zeitkritisch: false,
    befoerderung: '1',
  },
  rechnungsnummer: 'T2026-0815',
  leistungen: [{ position: '050', tarifCent: 186, anzahl: 20, ustProzent: 10 }],
  diagnose: { icd10: [{ code: 'N18', untergliederung1: '5' }] },
};

const BASIS: DktAbrechnung = {
  traeger: '17',
  abrechnungsstelle: '17',
  bundeslandAbrechnungsstelle: '7',
  datentraegernummer: 7,
  erstellt: new Date('2026-11-03T08:00:00Z'),
  testdaten: true,
  uebermittler: { name: 'Max Hollerer GmbH', staat: 'AUT', plz: '5020', vpnr: TAXI },
  vertragspartner: {
    vpnr: TAXI,
    adresscode: 1,
    bundesland: '7',
    fachgebietUnterteilung: '57',
    uid: 'ATU12345675',
  },
  abrechnungsjahr: 2026,
  abrechnungsmonat: 10,
  abrechnungsart: 'normal',
  rechnungsnummer: 'R2026-0042',
  rechnungsdatum: '2026-11-03',
  iban: IBAN,
  faelle: [FALL],
};

const zeilen = (e: DktAbrechnung): string[] => erstelleDktAbrechnung(e).toString('latin1').split('\r\n');
const mitFall = (f: Partial<DktFall>, e: Partial<DktAbrechnung> = {}): DktAbrechnung => ({
  ...BASIS,
  ...e,
  faelle: [{ ...FALL, ...f }],
});
const mitTransport = (t: Partial<DktFall['transport']>): DktAbrechnung =>
  mitFall({ transport: { ...FALL.transport, ...t } });
const sarten = (z: string[]): string[] =>
  z.map((s, i) => (i === 0 ? 'V' : i === z.length - 1 ? 'S' : s.slice(20, 22)));

test('E.2.1: Abfolge, Satzlänge, CRLF, SATNR und Zähler einer einfachen Abrechnung', () => {
  const roh = erstelleDktAbrechnung(BASIS);
  const z = roh.toString('latin1').split('\r\n');
  for (const s of z) assert.equal(s.length, 128);
  assert.ok(!roh.toString('latin1').endsWith('\r\n'));
  assert.deepEqual(sarten(z), ['V', '00', '01', '20', '21', '23', '39', '99', 'S']);
  z.slice(1, -1).forEach((s, i) => assert.equal(s.slice(15, 20), String(i + 1).padStart(5, '0')));
  assert.equal(z.at(-1)!.slice(20, 26), '000009'); // SANZ inklusive Vorlauf und Schluss (D.44)
  const b = liesDktBestand(roh);
  assert.equal(b.dateiende['ANZ39'], 1);
  assert.equal(b.dateiende['ANZ21'], 1);
});

test('F.2/F.3/F.3.1: Vorlauf, Satzkopf und Datensatzbeginn', () => {
  const z = zeilen(BASIS);
  const v = z[0]!;
  assert.equal(v.slice(9, 11), '14'); // VSTRU
  assert.equal(v.slice(11, 18), '123450 '); // OBUS = VPNR des Senders, linksbündig
  assert.equal(v.slice(18, 24), '17TKT1'); // VSTR, PROJ, BEST Testdaten
  assert.equal(v.slice(24, 30), '000007'); // DTNR
  assert.equal(v.slice(30, 44), '03112026090000'); // EDAT/EZEI in Wiener Ortszeit (UTC+1)
  assert.equal(v.slice(99, 101), '17'); // VSTRA
  assert.equal(v.slice(119, 121), '16'); // VERS = VERSD
  assert.equal(z[1]!.slice(0, 15), '177123450012610'); // VSTRA, BLNDA, VPNR, VPADR, AJAHR, ABZR
  const beginn = liesDktBestand(erstelleDktAbrechnung(BASIS)).beginn;
  assert.equal(beginn['UIDV']!.trim(), 'ATU74552637'); // D.56 für die ÖGK
  assert.equal(beginn['VPNRL'], TAXI);
  assert.equal(beginn['VPNRU'], TAXI);
  assert.equal(beginn['UFACHL'], '57');
  assert.equal(beginn['ABRA'], '1');
  assert.equal(beginn['ERDAT'], '031126');
  assert.equal(zeilen({ ...BASIS, testdaten: false })[0]!.slice(22, 24), 'TK');
  assert.equal(zeilen({ ...BASIS, abrechnungsart: 'nachverrechnung' })[1]!.slice(96, 97), '2');
});

test('D.11, D.50, D.41: Beträge der Leistung und des Summensatzes', () => {
  const b = liesDktBestand(erstelleDktAbrechnung(BASIS));
  const l = b.faelle[0]!.leistungen[0]!;
  assert.deepEqual(
    [l.position, l.tarifCent, l.anzahl, l.betragCent, l.ustProzent],
    ['050', 186, 20, 3720, 10],
  );
  const s = b.summen[0]!;
  assert.deepEqual(
    [s.summeCent, s.kostenbeteiligungCent, s.zwischensummeCent, s.ustBetragCent, s.rechnungsbetragCent],
    [3720, 0, 3720, 372, 4092],
  );
  assert.equal(s.rechnungsnummer, 'R2026-0042');
  assert.equal(s.rechnungsdatum, '031126');
});

test('F.11: je USt-Satz ein Summensatz, aufsteigend, mit ANZLB', () => {
  const leistungen: DktLeistung[] = [
    { position: '050', tarifCent: 186, anzahl: 20, ustProzent: 10 },
    { position: '054', tarifCent: 1035, anzahl: 1, ustProzent: 20 },
    { position: '050', tarifCent: 186, anzahl: 10, ustProzent: 10 },
  ];
  const b = liesDktBestand(erstelleDktAbrechnung(mitFall({ leistungen })));
  assert.deepEqual(
    b.summen.map((s) => [s.ustProzent, s.anzahlLeistungsbloecke, s.summeCent, s.ustBetragCent]),
    [
      [10, 2, 5580, 558],
      [20, 1, 1035, 207],
    ],
  );
});

test('D.50: UBE wird kaufmännisch auf ganze Cent gerundet', () => {
  const ube = (anzahl: number): number => {
    const leistungen = [{ position: '050', tarifCent: 186, anzahl, ustProzent: 10 }];
    return liesDktBestand(erstelleDktAbrechnung(mitFall({ leistungen }))).summen[0]!.ustBetragCent;
  };
  assert.equal(ube(21), 391); // 3906 → 390,6 → 391
  assert.equal(ube(22), 409); // 4092 → 409,2 → 409
  // halber Cent wird aufgerundet: 5 Cent × 1 bei 10 % = 0,5 → 1
  const halb = [{ position: '050', tarifCent: 5, anzahl: 1, ustProzent: 10 }];
  const s = liesDktBestand(erstelleDktAbrechnung(mitFall({ leistungen: halb }))).summen[0]!;
  assert.equal(s.ustBetragCent, 1);
  assert.equal(s.rechnungsbetragCent, 6);
});

test('F.10: zwei Blöcke je Leistungssatz; Begründung direkt hinter ihrer Leistung, Diagnose zuletzt', () => {
  const leistungen: DktLeistung[] = [
    { position: '050', tarifCent: 186, anzahl: 20, ustProzent: 10, begruendungen: ['Umfahrung Baustelle'] },
    { position: '050', tarifCent: 186, anzahl: 10, ustProzent: 10 },
  ];
  const z = zeilen(mitFall({ leistungen }));
  const leistungssaetze = z.filter((s, i) => i > 0 && s.slice(20, 22) === '21');
  assert.equal(leistungssaetze.length, 2);
  const bloecke = leistungssaetze.flatMap((s) => [s.slice(32, 75), s.slice(75, 118)]).map((b) => b[0]);
  assert.deepEqual(bloecke, ['L', 'B', 'L', 'D']);
  const f = liesDktBestand(erstelleDktAbrechnung(mitFall({ leistungen }))).faelle[0]!;
  assert.deepEqual(f.leistungen[0]!.begruendungen, ['Umfahrung Baustelle']);
  assert.equal(f.rechnungsnummer, 'T2026-0815');
});

test('F.10: ein einzelner Block lässt BLO2 leer', () => {
  const ohneLeistung = zeilen(BASIS).find((s, i) => i > 0 && s.slice(20, 22) === '21')!;
  assert.equal(ohneLeistung.slice(32, 33), 'L');
  // Leistung und Diagnose passen in einen Satz; erst ein dritter Block braucht einen zweiten.
  assert.equal(ohneLeistung.slice(75, 76), 'D');
  const zwei = zeilen(mitFall({ leistungen: [...FALL.leistungen, ...FALL.leistungen] }));
  const letzter = zwei.filter((s, i) => i > 0 && s.slice(20, 22) === '21').at(-1)!;
  assert.equal(letzter.slice(32, 33), 'D');
  assert.equal(letzter.slice(75, 118), ' '.repeat(43));
});

test('D.63: Vertragspartnernummern mit falscher Prüfziffer werden abgewiesen', () => {
  assert.throws(
    () => erstelleDktAbrechnung({ ...BASIS, vertragspartner: { ...BASIS.vertragspartner, vpnr: '123451' } }),
    /VPNR.*D\.63/,
  );
  assert.throws(
    () => erstelleDktAbrechnung({ ...BASIS, uebermittler: { ...BASIS.uebermittler, vpnr: '123451' } }),
    /VPNRU/,
  );
  assert.throws(
    () => erstelleDktAbrechnung(mitFall({ verordner: { ...FALL.verordner, vpnr: '600030' } })),
    /VPNUW/,
  );
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ nach: { vpnr: '543211' } })), /PLZN/);
});

test('D.61: Versicherungsnummer mit Prüfziffer oder in der Form 0000TTMMJJ', () => {
  const falsch = { ...FALL.versicherter, vsnr: '1234010180' };
  assert.throws(() => erstelleDktAbrechnung(mitFall({ versicherter: falsch })), /D\.61/);
  const ohneInlaendische = { ...FALL.versicherter, vsnr: '0000010180' };
  assert.doesNotThrow(() => erstelleDktAbrechnung(mitFall({ versicherter: ohneInlaendische })));
});

test('D.62: Trägercodes aus der Tabelle; 05 nur noch als VSTRL', () => {
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, traeger: '20' }), /VSTR '20'/);
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, abrechnungsstelle: '05' }), /nur noch im Feld VSTRL/);
  const bvaebEb = { ...FALL.versicherter, traeger: '05' };
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung({
      ...mitFall({ versicherter: bvaebEb }),
      traeger: '07',
      abrechnungsstelle: '07',
    }),
  );
});

test('B.3/D.15: bei der AUVA ein Transport je Bestand, BLNDL zwingend', () => {
  const auva = { ...BASIS, traeger: '08', abrechnungsstelle: '08' };
  const mitBl = { ...FALL, versicherter: { ...FALL.versicherter, bundesland: '7' as const } };
  assert.doesNotThrow(() => erstelleDktAbrechnung({ ...auva, faelle: [mitBl] }));
  assert.throws(() => erstelleDktAbrechnung({ ...auva, faelle: [mitBl, mitBl] }), /B\.3/);
  assert.throws(() => erstelleDktAbrechnung({ ...auva, faelle: [FALL] }), /BLNDL.*D\.15/);
});

test('ÖGK 16.12.2024: Abrechnungszeitraum nur als Kalendermonat', () => {
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, abrechnungsmonat: 21 }), /Abrechnungsmonat/);
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, abrechnungsmonat: 0 }), /Abrechnungsmonat/);
});

test('D.4 und D.1 Code 42: Transport weder nach dem Zeitraum noch nach dem Erstellungstag', () => {
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ datum: '2026-11-01' })), /D\.4/);
  const imZeitraum = { ...BASIS, abrechnungsmonat: 11, erstellt: new Date('2026-11-10T08:00:00Z') };
  assert.throws(
    () =>
      erstelleDktAbrechnung({
        ...imZeitraum,
        faelle: [{ ...FALL, transport: { ...FALL.transport, datum: '2026-11-11' } }],
      }),
    /Code 42/,
  );
  // Ein Transport vor dem Zeitraum ist zulässig (Nachzügler).
  assert.doesNotThrow(() => erstelleDktAbrechnung(mitTransport({ datum: '2026-09-30' })));
});

test('ÖGK-Jahresabgrenzung: keine zwei Transportjahre in einem ÖGK-Bestand', () => {
  const jaenner = {
    ...BASIS,
    abrechnungsjahr: 2027,
    abrechnungsmonat: 1,
    erstellt: new Date('2027-02-03T08:00:00Z'),
  };
  const vorjahr = { ...FALL, transport: { ...FALL.transport, datum: '2026-12-30' } };
  const laufend = { ...FALL, belegnummer: 2, transport: { ...FALL.transport, datum: '2027-01-05' } };
  assert.throws(() => erstelleDktAbrechnung({ ...jaenner, faelle: [vorjahr, laufend] }), /Jahresabgrenzung/);
  assert.doesNotThrow(() => erstelleDktAbrechnung({ ...jaenner, faelle: [vorjahr] }));
  // Die Regel stammt aus einem ÖGK-Schreiben; für die BVAEB gilt sie nicht.
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung({ ...jaenner, traeger: '07', abrechnungsstelle: '07', faelle: [vorjahr, laufend] }),
  );
});

test('D.25: FACHU zwingend, außer VPNUW ist eine Sammelnummer', () => {
  const ohneFach = { vpnr: VERORDNER, familienname: 'Grabner' };
  assert.throws(() => erstelleDktAbrechnung(mitFall({ verordner: ohneFach })), /FACHU.*D\.25/);
  const sammel = { vpnr: '402000' };
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung({
      ...mitFall({ verordner: sammel, texte: ['Dr. Grabner, Salzburg'] }),
      traeger: '07',
      abrechnungsstelle: '07',
    }),
  );
});

test('ÖGK 16.12.2024: Sammelnummer verlangt eine Begründung mit Ort und Name', () => {
  const sammel = { vpnr: '402000' };
  assert.throws(() => erstelleDktAbrechnung(mitFall({ verordner: sammel })), /Sammelnummer/);
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung(mitFall({ verordner: sammel, texte: ['Dr. Grabner, Salzburg'] })),
  );
});

test('ÖGK/WKO: Mehrfachtransport braucht „MF" und die Versicherungsnummern aller Patienten', () => {
  const mf = { vsnr: ['1237010180', '7890030990'] };
  assert.throws(() => erstelleDktAbrechnung(mitFall({ mehrfachtransport: mf })), /MF/);
  assert.throws(
    () => erstelleDktAbrechnung(mitFall({ mehrfachtransport: mf, texte: ['MF 1237010180'] })),
    /mindestens eine Angabe/,
  );
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung(mitFall({ mehrfachtransport: mf, texte: ['MF 1237010180 7890030990'] })),
  );
  const imGrun = [{ ...FALL.leistungen[0]!, begruendungen: ['MF 1237010180 7890030990'] }];
  assert.doesNotThrow(() => erstelleDktAbrechnung(mitFall({ mehrfachtransport: mf, leistungen: imGrun })));
  assert.throws(
    () => erstelleDktAbrechnung(mitFall({ mehrfachtransport: { vsnr: ['1237010180', '1234010180'] } })),
    /D\.61/,
  );
});

test('D.53: Transportnummer darf nur beim Taxi leer bleiben', () => {
  assert.doesNotThrow(() => erstelleDktAbrechnung(BASIS));
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ fahrzeug: '04' })), /D\.53/);
  assert.doesNotThrow(() => erstelleDktAbrechnung(mitTransport({ fahrzeug: '04', nummer: 'F-4711' })));
});

test('D.52: Transportart 99 verlangt einen Begründungsblock', () => {
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ art: '99' })), /D\.52/);
  const begruendet = [{ ...FALL.leistungen[0]!, begruendungen: ['Fahrt zur Hilfsmittelanpassung'] }];
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung(mitFall({ leistungen: begruendet, transport: { ...FALL.transport, art: '99' } })),
  );
});

test('D.32: NACA beim NAW-Einsatz mit Verlegung, Belassung oder Erste-Hilfe-Einsatz', () => {
  const naw = { fahrzeug: '02' as const, nummer: 'N-1', art: '07' as const, von: { vpnr: KRANKENHAUS } };
  assert.throws(() => erstelleDktAbrechnung(mitTransport(naw)), /NACA/);
  assert.doesNotThrow(() => erstelleDktAbrechnung(mitTransport({ ...naw, naca: '3' })));
});

test('D.38: PLZV/PLZN je Transportart', () => {
  // Hintransport: Ziel ist eine Vertragspartnernummer.
  assert.throws(
    () => erstelleDktAbrechnung(mitTransport({ nach: { staat: 'AUT', plz: '5020' } })),
    /Hintransport/,
  );
  // Heimtransport: Start ist eine Vertragspartnernummer, Ziel eine Postleitzahl.
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ art: '04' })), /Heimtransport/);
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung(
      mitTransport({ art: '04', von: { vpnr: KRANKENHAUS }, nach: { staat: 'AUT', plz: '5020' } }),
    ),
  );
  // Hin- und Rücktransport: Start ist eine Postleitzahl.
  assert.throws(
    () => erstelleDktAbrechnung(mitTransport({ art: '06', von: { vpnr: KRANKENHAUS } })),
    /Hin- und Rück/,
  );
  assert.throws(
    () => erstelleDktAbrechnung(mitTransport({ von: { staat: 'AT', plz: '5020' } })),
    /ISO 3166 A3/,
  );
  assert.throws(
    () => erstelleDktAbrechnung(mitTransport({ von: { staat: 'AUT', plz: '50 20' } })),
    /Postleitzahl/,
  );
});

test('D.66: Uhrzeiten, Grundstellung 9999 und Einsatz über 24 Stunden', () => {
  const t = zeilen(BASIS).find((s, i) => i > 0 && s.slice(20, 22) === '20')!;
  assert.equal(t.slice(28, 48), '07300805999999990810'); // EBEG, ANK, WZV/WZB Grundstellung, END
  const lang = zeilen(mitTransport({ ende: 'ueber24h' })).find((s, i) => i > 0 && s.slice(20, 22) === '20')!;
  assert.equal(lang.slice(44, 48), '9999');
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ beginn: '24:00' })), /HH:MM/);
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ beginn: '7:30' })), /HH:MM/);
  assert.doesNotThrow(() => erstelleDktAbrechnung(mitTransport({ beginn: '00:00' })));
});

test('Codes aus Kapitel D werden geprüft', () => {
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ grund: '02' as never })), /GRU.*D\.27/);
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ art: '17' as never })), /TART.*D\.52/);
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ fahrzeug: '07' as never })), /FART.*D\.26/);
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ befoerderung: '4' as never })), /BEF.*D\.10/);
  assert.throws(
    () => erstelleDktAbrechnung({ ...BASIS, bundeslandAbrechnungsstelle: '0' as never }),
    /BLNDA/,
  );
  assert.throws(
    () =>
      erstelleDktAbrechnung({
        ...BASIS,
        vertragspartner: { ...BASIS.vertragspartner, fachgebietUnterteilung: '48' as never },
      }),
    /UFACHL/,
  );
  assert.throws(
    () => erstelleDktAbrechnung(mitFall({ versicherter: { ...FALL.versicherter, kategorie: '001' } })),
    /KAT/,
  );
});

test('F.10.1: Positionsnummer dreistellig, Anzahl mindestens 1, Pauschale über 999,99 € nur einzeln', () => {
  const mit = (l: Partial<DktLeistung>): DktAbrechnung =>
    mitFall({ leistungen: [{ ...FALL.leistungen[0]!, ...l }] });
  assert.throws(() => erstelleDktAbrechnung(mit({ position: '50' })), /POSNR/);
  assert.throws(() => erstelleDktAbrechnung(mit({ anzahl: 0 })), /ANZKM/);
  assert.throws(() => erstelleDktAbrechnung(mit({ tarifCent: 1.5 })), /Tarif/);
  assert.throws(() => erstelleDktAbrechnung(mit({ tarifCent: 100000, anzahl: 2 })), /F\.10\.1/);
});

test('D.29/D.31: Kostenbeteiligung — SUMKB brutto je Leistung, KOBE/KOBEUST im Summensatz', () => {
  const leistungen = [
    { ...FALL.leistungen[0]!, kostenbeteiligung: { satz: '02' as const, nettoCent: 500, ustCent: 50 } },
  ];
  const b = liesDktBestand(erstelleDktAbrechnung(mitFall({ leistungen })));
  assert.deepEqual(b.faelle[0]!.leistungen[0]!.kostenbeteiligung, { satz: '02', bruttoCent: 550 });
  const s = b.summen[0]!;
  assert.deepEqual(
    [s.summeCent, s.kostenbeteiligungCent, s.zwischensummeCent, s.ustBetragCent, s.kostenbeteiligungUstCent],
    [3720, 500, 3220, 372, 50],
  );
  assert.equal(s.rechnungsbetragCent, 3220 + 372 - 50);
  const falscherSatz = [
    { ...leistungen[0]!, kostenbeteiligung: { satz: '04' as never, nettoCent: 1, ustCent: 0 } },
  ];
  assert.throws(() => erstelleDktAbrechnung(mitFall({ leistungen: falscherSatz })), /KBS/);
});

test('D.56: UID zwingend, sobald Umsatzsteuer verrechnet wird; UIDV aus der Tabelle', () => {
  const ohneUid = { ...BASIS.vertragspartner };
  delete ohneUid.uid;
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, vertragspartner: ohneUid }), /UID.*D\.56/);
  const steuerfrei = [{ ...FALL.leistungen[0]!, ustProzent: 0 }];
  assert.doesNotThrow(() =>
    erstelleDktAbrechnung({ ...mitFall({ leistungen: steuerfrei }), vertragspartner: ohneUid }),
  );
  const svs = liesDktBestand(erstelleDktAbrechnung({ ...BASIS, traeger: '45', abrechnungsstelle: '45' }));
  assert.equal(svs.beginn['UIDV']!.trim(), 'ATU74620109');
});

test('F.12: IBAN als SART 39 nach den Summensätzen, ab 2026 zwingend, mit gültiger Prüfsumme', () => {
  const z = zeilen({ ...BASIS, hinweise: ['Rechnung enthaelt Nachzuegler aus September'] });
  const texte = z.filter((s, i) => i > 0 && s.slice(20, 22) === '39');
  assert.equal(texte[0]!.slice(22, 122).trimEnd(), `IBAN:${IBAN}`);
  assert.equal(texte[1]!.slice(22, 122).trimEnd(), 'Rechnung enthaelt Nachzuegler aus September');
  assert.deepEqual(sarten(z).slice(-5), ['23', '39', '39', '99', 'S']);
  const ohneIban = { ...BASIS };
  delete ohneIban.iban;
  assert.throws(() => erstelleDktAbrechnung(ohneIban), /F\.12/);
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, iban: 'AT611904300234573202' }), /ISO 13616/);
  assert.throws(
    () => erstelleDktAbrechnung({ ...BASIS, iban: 'AT61 1904 3002 3457 3201' }),
    /ohne Leerzeichen/,
  );
});

test('F.14: mehr Sätze einer Art als Stellen im Zähler → Abrechnung teilen', () => {
  const viele = Array.from({ length: 19999 }, () => FALL.leistungen[0]!);
  assert.throws(() => erstelleDktAbrechnung(mitFall({ leistungen: viele })), /F\.14/);
});

test('F.8/D.14: Bezugsdaten in SART 11 direkt nach SART 01', () => {
  const bezug = {
    abrechnungsjahr: 2026,
    abrechnungsmonat: 8,
    rechnungsnummer: 'R2026-0031',
    belegnummer: 17,
  };
  const z = zeilen(mitFall({ bezug }, { abrechnungsart: 'nachverrechnung' }));
  assert.deepEqual(sarten(z).slice(2, 5), ['01', '11', '20']);
  const b = liesDktBestand(erstelleDktAbrechnung(mitFall({ bezug })));
  assert.deepEqual(b.faelle[0]!.bezug, {
    abrechnungsjahr: '26',
    abrechnungszeitraum: '08',
    rechnungsnummer: 'R2026-0031',
    belegnummer: 17,
  });
  assert.throws(() => erstelleDktAbrechnung(mitFall({ bezug: { ...bezug, rechnungsnummer: ' ' } })), /F\.8/);
});

test('E.2.1: Reihenfolge 01, 11, 39, 02, 06, 07, 20, 21 innerhalb der Ebene 2', () => {
  const z = zeilen(
    mitFall({
      bezug: { abrechnungsjahr: 2026, abrechnungsmonat: 8, rechnungsnummer: 'R2026-0031', belegnummer: 17 },
      texte: ['Patientin im eigenen Rollstuhl'],
      angehoeriger: { vsnr: '7890030990', familienname: 'Lindmayr', vorname: 'Livia' },
      adresse: { staat: 'AUT', plz: '5020', strasse: 'Hauptstrasse 1', ort: 'Salzburg' },
    }),
  );
  assert.deepEqual(sarten(z), ['V', '00', '01', '11', '39', '02', '06', '20', '21', '23', '39', '99', 'S']);
  const adresse = z[6]!;
  assert.equal(adresse.slice(25, 34), '     5020'); // PLZL rechtsbündig (D.38)
});

test('F.7.1: EKVK-Datensatz — VSNRV als 0000TTMMJJ, Blöcke P und E', () => {
  const ekvk = {
    patient: {
      staat: 'DE',
      versicherungsnummer: 'X123456789',
      familienname: 'Weinzierl',
      vorname: 'Mirela',
      geburtsdatum: '1980-01-01',
    },
    weitere: { geschlecht: 'W' as const, institutionscode: '1234', form: 'EKVK' as const },
  };
  assert.throws(() => erstelleDktAbrechnung(mitFall({ ekvk })), /0000TTMMJJ/);
  const versicherter = { ...FALL.versicherter, vsnr: '0000010180', kategorie: '070' };
  const z = zeilen(mitFall({ ekvk, versicherter }));
  const ekvkSaetze = z.filter((s, i) => i > 0 && s.slice(20, 22) === '07');
  assert.deepEqual(
    ekvkSaetze.map((s) => s.slice(22, 23)),
    ['P', 'E'],
  );
  assert.equal(ekvkSaetze[0]!.slice(120, 128), '01011980'); // EGEBD
  const b = liesDktBestand(erstelleDktAbrechnung(mitFall({ ekvk, versicherter })));
  assert.equal(b.faelle[0]!.ekvk.patient!['ESTAAT'], 'DE');
  assert.equal(b.faelle[0]!.ekvk.weitere!['EFORM'], 'EKVK');
  assert.equal(b.dateiende['ANZ07'], 2);
});

test('F.1: Namen nur Buchstaben, Adressen und Kennungen ohne diakritische Zeichen', () => {
  assert.throws(
    () => erstelleDktAbrechnung(mitFall({ versicherter: { ...FALL.versicherter, familienname: 'Müller' } })),
    /alphabetische Felder/,
  );
  assert.throws(
    () =>
      erstelleDktAbrechnung(
        mitFall({ versicherter: { ...FALL.versicherter, familienname: 'Gruber-Lindner' } }),
      ),
    /alphabetische Felder/,
  );
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ vonOrt: 'Mödling' })), /druckbares ASCII/);
  assert.throws(
    () =>
      erstelleDktAbrechnung({ ...BASIS, uebermittler: { ...BASIS.uebermittler, name: 'Müller Taxi GmbH' } }),
    /druckbares ASCII/,
  );
});

test('ELDA-Auskunft: Freitext in ISO-8859-15 — Umlaute und Euro-Zeichen als ein Byte, beim Lesen zurück', () => {
  const leistungen = [{ ...FALL.leistungen[0]!, begruendungen: ['Umfahrung wegen Straßensperre'] }];
  const eingabe = mitFall({
    texte: ['Rückfahrt über Mödling, Maut 3 €'],
    leistungen,
    diagnose: { text: 'Schwäche' },
  });
  const roh = erstelleDktAbrechnung({ ...eingabe, hinweise: ['Größere Abweichung laut Distanzanzeiger'] });
  // Jeder Satz bleibt 128 Bytes lang: ein Umlaut ist ein Byte.
  for (const satz of roh.toString('latin1').split('\r\n')) assert.equal(satz.length, 128);
  assert.ok(roh.includes(Buffer.from([0xfc, 0x63, 0x6b]))); // „ück"
  assert.ok(roh.includes(Buffer.from([0x33, 0x20, 0xa4]))); // „3 €" — Euro auf 0xA4 (ISO-8859-15)
  const b = liesDktBestand(roh);
  assert.deepEqual(b.faelle[0]!.texte, ['Rückfahrt über Mödling, Maut 3 €']);
  assert.deepEqual(b.faelle[0]!.leistungen[0]!.begruendungen, ['Umfahrung wegen Straßensperre']);
  assert.deepEqual(b.faelle[0]!.diagnose, { kennzeichen: '2', inhalt: 'Schwäche' });
  assert.equal(b.hinweise[1], 'Größere Abweichung laut Distanzanzeiger');
  // Außerhalb von ISO-8859-15 bleibt abgewiesen.
  assert.throws(() => erstelleDktAbrechnung(mitFall({ texte: ['Ağrı'] })), /ISO-8859-15/);
});

test('ELDA-Auskunft: VSTRU ist immer 14', () => {
  const z = zeilen({ ...BASIS, traeger: '45', abrechnungsstelle: '45' });
  assert.equal(z[0]!.slice(9, 11), '14');
  assert.equal(z.at(-1)!.slice(9, 11), '14');
});

test('F.7.1/E.3: Namen in SART 01 werden auf Feldlänge gekürzt, andere Felder nie', () => {
  const lang = { ...FALL.versicherter, familienname: 'Weinzierl'.repeat(4), vorname: 'Mirela'.repeat(3) };
  const b = liesDktBestand(
    erstelleDktAbrechnung(
      mitFall({ versicherter: lang, verordner: { ...FALL.verordner, familienname: 'Landeskrankenhaus' } }),
    ),
  );
  assert.equal(b.faelle[0]!.versicherter.familienname, 'Weinzierl'.repeat(4).slice(0, 30));
  assert.equal(b.faelle[0]!.versicherter.vorname, 'Mirela'.repeat(3).slice(0, 15));
  assert.equal(b.faelle[0]!.versicherter.verordnerName, 'Landeskran');
  assert.throws(() => erstelleDktAbrechnung(mitTransport({ vonOrt: 'Salzburg Hauptbahnhof' })), /ORTV/);
});

test('D.17/D.18: Diagnose als Text oder ein bis sechs ICD-10-Codes', () => {
  const text = liesDktBestand(erstelleDktAbrechnung(mitFall({ diagnose: { text: 'Dialysepflichtig' } })));
  assert.deepEqual(text.faelle[0]!.diagnose, { kennzeichen: '2', inhalt: 'Dialysepflichtig' });
  const sieben = Array.from({ length: 7 }, () => ({ code: 'N18' }));
  assert.throws(() => erstelleDktAbrechnung(mitFall({ diagnose: { icd10: sieben } })), /sechs/);
  assert.throws(() => erstelleDktAbrechnung(mitFall({ diagnose: { icd10: [{ code: 'N1' }] } })), /DIAG/);
  assert.throws(() => erstelleDktAbrechnung(mitFall({ diagnose: { text: ' ' } })), /leer/);
});

test('Eingaben ohne Fall oder ohne Leistung werden abgewiesen (E.2.1)', () => {
  assert.throws(() => erstelleDktAbrechnung({ ...BASIS, faelle: [] }), /mindestens einen Fall/);
  assert.throws(() => erstelleDktAbrechnung(mitFall({ leistungen: [] })), /mindestens eine Leistung/);
  assert.throws(() => erstelleDktAbrechnung(mitFall({ rechnungsnummer: '' })), /RNR/);
});
