import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueSatz, baueSatzText } from './festsatz';
import {
  DKT_BEGINN,
  DKT_BEZUG,
  DKT_BLOCK_BEGRUENDUNG,
  DKT_BLOCK_DIAGNOSE,
  DKT_BLOCK_LEISTUNG,
  DKT_DATEIENDE,
  DKT_KOPF,
  DKT_LEISTUNG,
  DKT_PAUSCHALE,
  DKT_SCHLUSS,
  DKT_SUMME,
  DKT_TEXT,
  DKT_TRANSPORT,
  DKT_VERSICHERTER,
  DKT_VORLAUF,
  type DktFeld,
} from './dkt-felder';
import { liesDktBestand } from './dkt-lesen';

// Ein Retourdatenträger (BEST TR) nach der Abfolge E.2.2, Seite 50, mit
// erfundenen Daten: ein Fall mit eingeschränkter Leistung (SART 22, ABLG 76),
// eine Korrektur durch den Träger (41/11/60/62 mit Abzugsblock „A"), ein
// negativer Korrektursummensatz (64), ein Pauschalabzug (85) und ein Hinweis (39).
const TAXI = '123450';
const KRANKENHAUS = '543210';

const satz = (felder: readonly DktFeld[], werte: Record<string, string | undefined>): string =>
  baueSatz(felder, werte, 128).toString('latin1');
const block = (felder: readonly DktFeld[], werte: Record<string, string | undefined>): string =>
  baueSatzText(felder, werte, 43);
const kopf = (n: number): string =>
  baueSatzText(
    DKT_KOPF,
    { VSTRA: '17', BLNDA: '7', VPNR: TAXI, VPADR: '1', AJAHR: '26', ABZR: '10', SATNR: String(n) },
    20,
  );

/** Die Sätze zwischen Vorlauf und Schluss, noch ohne Satzkopf. */
function mitte(): [readonly DktFeld[], Record<string, string | undefined>][] {
  const versicherter = {
    VSTRL: '17',
    ZUNVS: 'Weinzierl',
    VONVS: 'Mirela',
    VSNRV: '1237010180',
    VPNUW: '600033',
    FACHU: '01',
    UEDAT: '011026',
    VORZ: '0',
  };
  const transport = {
    LDAT: '141026',
    EBEG: '0730',
    ANK: '0805',
    WZV: '9999',
    WZB: '9999',
    END: '0810',
    PLZV: 'AUT 5020',
    PLZN: KRANKENHAUS,
    GRU: '26',
    TART: '03',
    FART: '05',
    ZKR: '0',
    BEF: '1',
  };
  const leistung = (blokz: string, betr: string, ablg: string): string =>
    block(DKT_BLOCK_LEISTUNG, {
      BLOKZ: blokz,
      POSNR: '050',
      TAR: '186',
      ANZKM: '20',
      BETR: betr,
      UST: '10',
      ABLG: ablg,
    });
  return [
    [
      DKT_BEGINN,
      {
        SART: '00',
        DPNR: '01',
        ERDAT: '201126',
        VPADR: '1',
        FACHL: '65',
        BLLE: '7',
        VPADRL: '1',
        VPNRL: TAXI,
        VERSD: '16',
        ABRA: '1',
        VPNRU: TAXI,
      },
    ],
    [DKT_VERSICHERTER, { ...versicherter, SART: '01', BSNR: '1' }],
    [DKT_TRANSPORT, { ...transport, SART: '20' }],
    [
      DKT_LEISTUNG,
      {
        SART: '22',
        RNR: 'T2026-0815',
        BLO1: leistung('L', '3348', '76'),
        BLO2: block(DKT_BLOCK_DIAGNOSE, { BLOKZ: 'D', DIAKZ: '3', DIAGN: 'N185' }),
      },
    ],
    [
      DKT_SUMME,
      {
        SART: '24',
        RNR: 'R2026-0042',
        RDAT: '031126',
        UST: '10',
        ANZLB: '1',
        SUM: '3348',
        ZSUM: '3348',
        UBE: '335',
        REBE: '3683',
        ABST: '01',
      },
    ],
    [DKT_VERSICHERTER, { ...versicherter, SART: '41' }],
    [DKT_BEZUG, { SART: '11', AJAHR: '26', ABZR: '09', RNR: 'R2026-0031', BSNR: '17', ABLG: '084' }],
    [DKT_TRANSPORT, { ...transport, SART: '60', LDAT: '220926' }],
    [
      DKT_LEISTUNG,
      {
        SART: '62',
        RNR: 'T2026-0712',
        BLO1: leistung('A', '372', '80'),
        BLO2: block(DKT_BLOCK_BEGRUENDUNG, { BLOKZ: 'B', GRUN: 'Strecke laut Distanzanzeiger 18 km' }),
      },
    ],
    [
      DKT_SUMME,
      {
        SART: '64',
        UST: '10',
        ANZLB: '1',
        SUM: '372',
        ZSUM: '372',
        UBE: '37',
        REBE: '409',
        VZS: '1',
        VZZS: '1',
        VZR: '1',
      },
    ],
    [
      DKT_PAUSCHALE,
      {
        SART: '85',
        VPNRL: TAXI,
        FACHL: '65',
        VPADRL: '1',
        BLLE: '7',
        PART: 'A',
        PBETRN: '1000',
        PUST: '100',
        PBETRB: '1100',
        PBEGR: 'Abzug laut Pruefung',
      },
    ],
    [DKT_TEXT, { SART: '39', TXT: 'Ueberweisung erfolgt am 05.12.2026' }],
    [
      DKT_DATEIENDE,
      {
        SART: '99',
        ANZ01: '2',
        ANZ20: '2',
        ANZ21: '2',
        ANDP: '01',
        ANZ23: '2',
        ANZ11: '1',
        ANZ39: '1',
        ANZ85: '1',
      },
    ],
  ];
}

function datei(
  aendern: (m: ReturnType<typeof mitte>) => ReturnType<typeof mitte> = (m) => m,
  best = 'TR',
): string[] {
  const m = aendern(mitte());
  const umschlag = { VSTRU: '14', OBUS: TAXI, VSTR: '17' };
  return [
    satz(DKT_VORLAUF, {
      ...umschlag,
      SART: '00',
      PROJ: 'TK',
      BEST: best,
      DTNR: '3',
      EDAT: '20112026',
      EZEI: '120000',
      HRST: 'Oesterreichische Gesundheitskasse',
      HKFZ: 'AUT',
      HPLZ: '5020',
      VSTRA: '17',
      VERS: '16',
    }),
    ...m.map(([felder, werte], i) => satz(felder, { ...werte, KOPF: kopf(i + 1) })),
    satz(DKT_SCHLUSS, { ...umschlag, SART: '99', SANZ: String(m.length + 2) }),
  ];
}

test('E.2.2: Retourdatenträger mit Rückmeldung, SV-Korrektur, Pauschale und Hinweis', () => {
  const b = liesDktBestand(datei().join('\r\n'));
  assert.equal(b.rueckmeldung, true);

  const f = b.faelle[0]!;
  assert.equal(f.korrektur, false);
  assert.equal(f.versicherter.belegnummer, 1);
  assert.deepEqual(f.leistungen[0], {
    art: 'L',
    position: '050',
    tarifCent: 186,
    anzahl: 20,
    betragCent: 3348, // D.11: „Bei SART 22 anerkannter Betrag"
    ustProzent: 10,
    ablehnungsgrund: {
      code: '76',
      gruppe: 'Einschränkungsgrund',
      text: 'Kilometereinschränkung bzw. Erweiterung',
    },
    begruendungen: [],
  });
  assert.deepEqual(b.summen[0]!.status, { code: '01', text: 'Abrechnung korrigiert je Summensatz' });
  assert.equal(b.summen[0]!.rechnungsbetragCent, 3683);

  const k = b.korrekturen[0]!;
  assert.equal(k.korrektur, true);
  assert.equal(k.versicherter.belegnummer, undefined); // D.14: bei SART 41 nicht belegt
  assert.deepEqual(k.bezug, {
    abrechnungsjahr: '26',
    abrechnungszeitraum: '09',
    rechnungsnummer: 'R2026-0031',
    belegnummer: 17,
    ablehnungsgrund: { code: '084', gruppe: 'Einschränkungsgrund', text: 'Nachverrechnung' },
  });
  assert.equal(k.transport.datum, '220926');
  assert.equal(k.leistungen[0]!.art, 'A');
  assert.equal(k.leistungen[0]!.ablehnungsgrund?.text, 'Rechenfehler des Vertragspartners');
  assert.deepEqual(k.leistungen[0]!.begruendungen, ['Strecke laut Distanzanzeiger 18 km']);

  // D.65: Vorzeichen der SV-Korrektur werden in die Beträge übernommen.
  const ks = b.korrekturSummen[0]!;
  assert.equal(ks.rechnungsnummer, undefined); // D.43: bei SART 64 leer
  assert.equal(ks.rechnungsdatum, undefined); // D.16: bei SART 64 leer
  assert.deepEqual(
    [ks.summeCent, ks.ustBetragCent, ks.zwischensummeCent, ks.rechnungsbetragCent],
    [-372, -37, -372, -409],
  );
  assert.equal(ks.kostenbeteiligungCent, 0);

  assert.deepEqual(b.pauschalen, [
    {
      vpnrLeistungserbringer: TAXI,
      art: 'A',
      nettoCent: 1000,
      ustCent: 100,
      bruttoCent: 1100,
      begruendung: 'Abzug laut Pruefung',
    },
  ]);
  assert.deepEqual(b.hinweise, ['Ueberweisung erfolgt am 05.12.2026']);
});

test('Satztrennung: CRLF, LF oder gar keine', () => {
  const z = datei();
  assert.equal(liesDktBestand(z.join('\n')).faelle.length, 1);
  assert.equal(liesDktBestand(z.join('')).faelle.length, 1);
  assert.equal(liesDktBestand(Buffer.from(z.join('\r\n') + '\r\n', 'latin1')).faelle.length, 1);
});

test('F: Satzlänge 128', () => {
  const z = datei();
  z[3] = z[3]!.slice(0, 127);
  assert.throws(() => liesDktBestand(z.join('\r\n')), /Satz 4: 127 statt 128/);
  assert.throws(() => liesDktBestand(datei().join('').slice(1)), /Vielfaches/);
});

test('D.46: SATNR lückenlos ab 00001', () => {
  const z = datei();
  z[2] = z[2]!.slice(0, 15) + '00009' + z[2]!.slice(20);
  assert.throws(() => liesDktBestand(z.join('\r\n')), /D\.46/);
});

test('B.3: alle Sätze tragen denselben Satzkopf', () => {
  const z = datei();
  z[3] = z[3]!.slice(0, 3) + '123455' + z[3]!.slice(9);
  assert.throws(() => liesDktBestand(z.join('\r\n')), /B\.3/);
});

test('D.8 und D.44: Zähler im Dateiende und SANZ werden nachgerechnet', () => {
  const falscherZaehler = datei((m) =>
    m.map(([f, w]) => [f, f === DKT_DATEIENDE ? { ...w, ANZ39: '2' } : w] as [readonly DktFeld[], typeof w]),
  );
  assert.throws(() => liesDktBestand(falscherZaehler.join('\r\n')), /ANZ39.*D\.8/);
  const z = datei();
  z[z.length - 1] = z.at(-1)!.slice(0, 20) + '000099' + z.at(-1)!.slice(26);
  assert.throws(() => liesDktBestand(z.join('\r\n')), /D\.44/);
});

test('E.2.1/E.2.2: Satzarten an falscher Stelle werden abgewiesen', () => {
  // Leistung vor dem Transport
  const vertauscht = datei((m) => [m[0]!, m[1]!, m[3]!, m[2]!, ...m.slice(4)]);
  assert.throws(() => liesDktBestand(vertauscht.join('\r\n')), /Satz 5: SART 20 steht nach/);
  // Ebene 2 ohne Transport
  const ohneTransport = datei((m) => [m[0]!, m[1]!, m[3]!, ...m.slice(4)].map(anzahlAngepasst('ANZ20', '1')));
  assert.throws(() => liesDktBestand(ohneTransport.join('\r\n')), /ohne Transportsatz/);
  // Rückmeldesätze (SART 22) in einer eigenen Abrechnung (BEST TK)
  assert.throws(() => liesDktBestand(datei(undefined, 'TK').join('\r\n')), /SART 22 gehört nicht/);
});

test('F.10: Begründungsblock nur hinter einem Leistungsblock', () => {
  const z = datei((m) =>
    m.map(([f, w]) =>
      w['SART'] === '22'
        ? [f, { ...w, BLO1: block(DKT_BLOCK_BEGRUENDUNG, { BLOKZ: 'B', GRUN: 'zu frueh' }) }]
        : [f, w],
    ),
  );
  assert.throws(() => liesDktBestand(z.join('\r\n')), /F\.10/);
});

test('Vorlauf- und Schlusssatz stehen am Anfang und am Ende', () => {
  const z = datei();
  assert.throws(() => liesDktBestand(z.slice(1).join('\r\n')), /Vorlaufsatz/);
  assert.throws(() => liesDktBestand(z.slice(0, -1).join('\r\n')), /Schlusssatz/);
});

function anzahlAngepasst(feld: string, wert: string) {
  return ([f, w]: [readonly DktFeld[], Record<string, string | undefined>]): [
    readonly DktFeld[],
    Record<string, string | undefined>,
  ] => [f, f === DKT_DATEIENDE ? { ...w, [feld]: wert } : w];
}
