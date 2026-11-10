'use strict';

// mBGM für KW46 (Zeitreise 2026/27): die Kette zur Höchstbeitragsgrundlage nach Q60
// (Anmeldung angestellte A/14 zum 01.02.2026, BVAB 01.03.2026). Sie ersetzt M85/M97
// aus KW45, deren Vorlauf Q34 nur Mo 07–09 lief.
//
//   M98  A/14  02/2026  Di 07–09 (01.03.): 9.000 €, erster Monat – SV bei 6.930 € gedeckelt, BV beitragsfrei
//   M99  A/14  03/2026  Di 12–14 (01.04.): 9.000 €, BV ab 01.03. vom vollen Entgelt (§ 6 Abs 1 BMSVG)
//   M100 A/15  03/2026  Di 12–14: Austritte im ersten Monat (V72/V74 31.03., V80 20.03.) über kasseneck
//   M101 A/14  03/2026  Di 12–14: Austritte im ersten Monat (V76 31.03., V82 20.03.) über kasseneck
//
// Nachgeholt Di 12–14: Die Anmeldungen vom Mo 12–14 fehlen im SIT-Bestand (M98 und M52 → BW1837 „kein
// Versicherter gemeldet“, V15/V43/V50/V56/V58 → VW1960 „keine Anmeldung“), während V70 → M50 aus demselben
// Fenster Di 07–09 sauber durchlief. Die Kette läuft deshalb noch einmal, ganz im Fenster Di 12–14, mit einer
// Person, die in KW46 bei DG B nirgends angemeldet ist (reserve_1; ihr S30 liegt bei DG A):
//   Q61  B/15  Anmeldung reserve_1 zum 01.02.2026, BVAB 01.03.2026 – zwei Monate rückwirkend
//   M102 B/15  02/2026  9.000 €, erster Monat – SV bei 6.930 € gedeckelt, BV beitragsfrei
//   M103 B/15  03/2026  9.000 €, BV ab 01.03. vom vollen Entgelt
//
// Lehrling über kasseneck (#673: AV-Minderung A04/A05 nach der AlV-Staffel) – seit dem Fix nie auf der SIT
// (M52/M90 waren handgebaut, M90 bekam nie ein Clearing):
//   Q64  A/15  Anmeldung angestellte als Angestelltenlehrling (BBER 04) zum 01.03.2026, BVAB 01.04.2026
//   M106 A/15  03/2026  2.300 € Lehrlingsentschädigung: B044, T01 28,45 %, A05 (Band 2.225–2.427 €), BV-frei
//
// Urlaubsersatzleistung über kasseneck (#869: KEUE J und VVON 1 im Verlängerungsblock, D.63/D.64) – nie auf der
// SIT. kasseneck kann sie nur bilden, wenn die UEL ganz in den Folgemonaten liegt (Austritt am Monatsletzten);
// mit einem Anteil im Austrittsmonat wirft baueMeldung („noch nicht bilden“). Person arbeiter auf A/14 (in KW46 dort
// frei; ihr V70 liegt auf A/15):
//   Q65  A/14  Anmeldung zum 01.01.2026, BVAB 01.02.2026
//   Q66  A/14  Abmeldung: EBSV 28.02., UEL 01.–05.03., ADAT und BVEN 05.03. (wie E.29.2 Seite 316)
//   M107 A/14  01/2026  2.400 €, erster Monat ohne BV
//   M108 A/14  02/2026  2.400 €, Austrittsmonat (UEL nicht darin → ohne KEUE), BV
//   M109 A/14  03/2026  nur die UEL 400 € (5 SV-Tage): KEUE J, VVON 1, BV auf die UEL – AV-Abschlag nach dem
//                       UEL-Betrag allein (A03)?
//
// Geringfügige über kasseneck – seit #869 trägt der Dienstgeber-Block Verrechnungspositionen je Basis und die
// Dienstgeberabgabe (Z01) ab dem 1,5-Fachen der Grenze; auf der SIT war das nie. Zwei bei DG B freie Personen:
//   Q62  B/15  Anmeldung reserve_2 geringfügig zum 01.02.2026 (10 h), BVAB 01.03.2026
//   Q63  B/15  Anmeldung reserve_3 geringfügig zum 01.03.2026 (8 h), BVAB 01.04.2026
//   M104 B/15  02/2026  reserve_2 mit 500 € allein: keine Dienstgeberabgabe, erster Monat ohne BV
//   M105 B/15  03/2026  reserve_2 500 € + reserve_3 400 €: Summe über 826,65 € → Dienstgeberabgabe 19,4 %, BV für
//                       reserve_2 ab 01.03.; beide sind im März zugleich auf A/14 vollversichert (V76/V82)

const { mbgmPaket, meldung } = require('../lib/bausteine');

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', braucht: 'kasseneck', ...mehr });
const QUELLE =
  'E.32; kasseneck main functions-lohn/mbgm-core.js, lohnabrechnung-core.js; § 45 Abs 1, § 108 Abs 3 ASVG ' +
  '(Höchstbeitragsgrundlage 6.930 € 2026); § 6 Abs 1 BMSVG; SIT-Portal Zeitreise 2026/27';

/** Monat `zurueck` Monate vor `iso` als JJJJ-MM. */
function monatVor(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 1)).toISOString().slice(0, 7);
}

/** Die Angestellte aus Q60: Vollzeit, 9.000 € im Monat, Eintritt am Anmeldetag. */
const q60Mitarbeiter = (ctx) => ({
  dienstnehmerGruppe: 'angestellter',
  beschaeftigungsart: 'fulltime',
  eintritt: ctx.zrVon('Q60'),
  austritt: null,
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: 900_000,
});

const paket = (id) => (ctx) =>
  mbgmPaket(ctx, {
    fall: id,
    dg: 'A',
    traeger: '14',
    monat: monatVor(ctx.zr, 1),
    bundesland: 'oberoesterreich',
    beschaeftigte: [{ rolle: 'angestellte', mitarbeiter: q60Mitarbeiter(ctx) }],
  });

/** Letzter Tag des Monats vor `iso` (JJJJ-MM-TT). */
function vormonatsende(iso) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, 0)).toISOString().slice(0, 10);
}

/**
 * Arbeiter wie in den Anmeldungen V72–V82 (BBER 01, vollversichert, 38,5 Stunden, ohne BVAB), Eintritt am
 * Anmeldetag, Austritt laut der Abmeldung derselben Woche: Monatsende (V73/V75/V77) oder der 20. (V81/V83).
 */
const arbeiterMaerz = (ctx, anmeldung, { am20 = false, monatsbezug = 260_000 } = {}) => {
  const ende = vormonatsende(ctx.zr);
  return {
    dienstnehmerGruppe: 'arbeiter',
    beschaeftigungsart: 'fulltime',
    eintritt: ctx.zrVon(anmeldung),
    austritt: am20 ? `${ende.slice(0, 8)}20` : ende,
    wochenstunden: 38.5,
    kvBasisStunden: 38.5,
    grossSalaryCents: monatsbezug,
  };
};

/** Q61: Eintritt am Ersten zwei Monate vor dem Fenster, in dem die Anmeldung lief (JJJJ-MM-TT). */
const q61Eintritt = (zr) => `${monatVor(zr, 2)}-01`;

const paketQ61 = (id, zurueck) => (ctx) => {
  const zrQ = ctx.zrVon('Q61');
  return mbgmPaket(ctx, {
    fall: id,
    dg: 'B',
    traeger: '15',
    monat: monatVor(zrQ, zurueck),
    bundesland: 'oberoesterreich',
    beschaeftigte: [
      { rolle: 'reserve_1', mitarbeiter: { ...q60Mitarbeiter(ctx), eintritt: q61Eintritt(zrQ) } },
    ],
  });
};

/** Geringfügig beschäftigte Arbeiterin von DG B; Eintritt am Ersten `zurueck` Monate vor dem Fenster von `anmeldung`. */
const geringfuegig = (ctx, anmeldung, zurueck, monatsbezug, stunden) => ({
  dienstnehmerGruppe: 'arbeiter',
  beschaeftigungsart: 'marginal',
  eintritt: `${monatVor(ctx.zrVon(anmeldung), zurueck)}-01`,
  austritt: null,
  wochenstunden: stunden,
  kvBasisStunden: 40,
  grossSalaryCents: monatsbezug,
});

const anmeldungGeringfuegig = (id, rolle, zurueck, stunden) => (ctx) =>
  meldung(ctx, {
    fall: id,
    art: 'anmeldung',
    rolle,
    dg: 'B',
    traeger: '15',
    felder: {
      ADAT: ctx.ttmmjjjj(`${monatVor(ctx.zr, zurueck)}-01`),
      BBER: '01',
      GERF: 'J',
      FRDV: 'N',
      VWAZ: ctx.elda.wochenarbeitszeit(stunden, 0),
      BVAB: ctx.ttmmjjjj(`${monatVor(ctx.zr, zurueck - 1)}-01`),
    },
  });

const QUELLE_GF =
  'E.32 (D.31 Verrechnungsbasis, Tarifgruppe geringfügig); kasseneck #869 lohnabrechnung-core.js ' +
  '(dienstgeberBlock, dienstgeberabgabePflichtig), mbgm-endpoints.js (Wächter KECK-DAG); § 1 DAG; § 5 Abs 2 ASVG';

/** Q65/Q66: Arbeiter von 01.01. bis 28.02.2026, UEL 400 € für 5 SV-Tage im März – vom Fenster von Q65 aus. */
function uel(ctx) {
  const zrQ = ctx.zrVon('Q65');
  const maerz = monatVor(zrQ, 1);
  return {
    jaenner: monatVor(zrQ, 3),
    februar: monatVor(zrQ, 2),
    maerz,
    mitarbeiter: {
      dienstnehmerGruppe: 'arbeiter',
      beschaeftigungsart: 'fulltime',
      eintritt: `${monatVor(zrQ, 3)}-01`,
      austritt: vormonatsende(`${maerz}-01`),
      wochenstunden: 38.5,
      kvBasisStunden: 38.5,
      grossSalaryCents: 240_000,
    },
    zeiten: { zeitkonto: { zeilen: [{ art: 'uel_laufend', cent: 40_000 }], steuerfrei68Cent: 0 } },
    endabrechnung: {
      uelLaufendCent: 40_000,
      uelVerlaengerung: [{ monat: maerz, tage: 5 }],
      rueckforderungUrlaubCent: 0,
    },
  };
}

const paketUel = (id, welcher) => (ctx) => {
  const u = uel(ctx);
  const b = { rolle: 'arbeiter', mitarbeiter: u.mitarbeiter };
  if (welcher !== 'jaenner') Object.assign(b, { zeiten: u.zeiten, endabrechnung: u.endabrechnung });
  if (welcher === 'maerz') b.verlaengerungVon = u.februar;
  return mbgmPaket(ctx, {
    fall: id,
    dg: 'A',
    traeger: '14',
    monat: u[welcher],
    bundesland: 'oberoesterreich',
    beschaeftigte: [b],
  });
};

const QUELLE_UEL =
  'E.32, D.63 (VVON), D.64 (KEUE); E.29.2 Seite 316 (M4 mit UEAB/UEBI/BVEN); § 11 Abs 2 ASVG; kasseneck #869 ' +
  'mbgm-core.js baueMeldungVerlaengerung, payslip-endpoints.js (uel_laufend, verlaengerungsMonate)';

const QUELLE_N =
  'E.32; kasseneck main mbgm-core.js, lohnabrechnung-core.js (Ein-/Austritt im Monat, BV-freier erster Monat); SIT KW42 N1/N3';

module.exports = [
  fall({
    id: 'M98',
    titel: 'mBGM 02/2026 A/14 – Q60 mit 9.000 € im Eintrittsmonat: SV bei 6.930 € gedeckelt, BV beitragsfrei',
    zweck:
      'Die Höchstbeitragsgrundlage kam im Katalog nie auf der SIT vor (M97 fiel in KW45 aus). kasseneck muss ' +
      'die allgemeine Beitragsgrundlage bei 6.930 € deckeln; im ersten Monat ist die BV beitragsfrei, die ' +
      'Anmeldung trug BVAB 01.03. Rechnet die ÖGK gleich (kein BW1850/BW1917)?',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing Di nm ohne BW1850/BW1917/BW1874',
    fenster: ['di-vm'],
    abhaengig: ['Q60'],
    rang: 14,
    baue: paket('M98'),
  }),
  fall({
    id: 'M99',
    titel: 'mBGM 03/2026 A/14 – Q60 mit 9.000 €: SV gedeckelt bei 6.930 €, BV vom vollen Entgelt',
    zweck:
      'Erster BV-Monat. § 6 Abs 1 BMSVG kennt keine Höchstbeitragsgrundlage: die BV-Grundlage ist das volle ' +
      'Entgelt (9.000 €), die SV-Grundlage bleibt gedeckelt. Nimmt die ÖGK beide Basen so an?',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing (Mi vm) ohne BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['Q60', 'M98'],
    rang: 14,
    baue: paket('M99'),
  }),
  fall({
    id: 'M100',
    titel: 'mBGM 03/2026 A/15 über kasseneck: Eintritt 01.03., Austritt 31.03. (V72, V74) bzw. 20.03. (V80)',
    zweck:
      'Endabrechnung im ersten Monat, wie kasseneck sie rechnet: voller Monat mit Austritt zum Monatsende und ' +
      'ein Teilmonat bis zum 20. (SV-Tage aliquot), BV beitragsfrei, weil das Dienstverhältnis im ersten Monat ' +
      'endet. Passen die SV-Tage und Beiträge zur Rechnung der ÖGK (kein BW1850/BW1917/BW1871)?',
    quelle: QUELLE_N,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['V72', 'V74', 'V80', 'V73', 'V75', 'V81'],
    rang: 25,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M100',
        dg: 'A',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'arbeiterlehrling', mitarbeiter: arbeiterMaerz(ctx, 'V72') },
          { rolle: 'angestelltenlehrling', mitarbeiter: arbeiterMaerz(ctx, 'V74') },
          { rolle: 'geringfuegig', mitarbeiter: arbeiterMaerz(ctx, 'V80', { am20: true }) },
        ],
      }),
  }),
  fall({
    id: 'M101',
    titel:
      'mBGM 03/2026 A/14 über kasseneck: Austritt 31.03. nach fristloser Entlassung (V76) und 20.03. (V82)',
    zweck:
      'Wie M100 auf dem zweiten Konto. V83 meldete das BV-Ende, obwohl nie BV-Zeit bestand (VW1942 erwartet) – ' +
      'kommt zur mBGM ohne BV dennoch kein BW1871?',
    quelle: QUELLE_N,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['V76', 'V82', 'V77', 'V83'],
    rang: 25,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M101',
        dg: 'A',
        traeger: '14',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_3', mitarbeiter: arbeiterMaerz(ctx, 'V76') },
          { rolle: 'reserve_2', mitarbeiter: arbeiterMaerz(ctx, 'V82', { am20: true }) },
        ],
      }),
  }),
  fall({
    id: 'Q61',
    titel: 'HBGL nachgeholt: Anmeldung reserve_1 auf B/15 zum 01.02.2026, BVAB 01.03.2026, rückwirkend (M3)',
    zweck:
      'Q60 (Mo 12–14) ist im SIT-Bestand nicht angekommen, M98 lief deshalb auf BW1837. Dieselbe Anmeldung wie ' +
      'Q60, aber im Fenster Di 12–14 (simuliert 01.04.) und für eine bei DG B freie Person: zwei Monate ' +
      'rückwirkend. Nebenbei: Meldet die ÖGK die verspätete Anmeldung im Clearing?',
    quelle: 'E.29.2 (M3, BVAB); SIT KW46 Clearing Di 12:00 (BW1837/VW1960 zu Mo-nm-Anmeldungen)',
    erwartung: 'übernommen; danach M102/M103 ohne BW1837',
    fenster: ['di-nm'],
    abhaengig: [],
    rang: 11,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'Q61',
        art: 'anmeldung',
        rolle: 'reserve_1',
        dg: 'B',
        traeger: '15',
        felder: {
          ADAT: ctx.ttmmjjjj(q61Eintritt(ctx.zr)),
          BBER: '02',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
          BVAB: ctx.ttmmjjjj(`${monatVor(ctx.zr, 1)}-01`),
        },
      }),
  }),
  fall({
    id: 'M102',
    titel: 'mBGM 02/2026 B/15 – Q61 mit 9.000 € im Eintrittsmonat: SV bei 6.930 € gedeckelt, BV beitragsfrei',
    zweck:
      'M98 noch einmal auf einer Anmeldung, die im Bestand ist: Deckelt die ÖGK die allgemeine Beitragsgrundlage ' +
      'wie kasseneck bei 6.930 € (kein BW1850/BW1917)? Gesendet im selben Fenster direkt nach Q61 – wie V70 → M50.',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1837/BW1850/BW1917/BW1874',
    fenster: ['di-nm'],
    abhaengig: ['Q61'],
    rang: 14,
    baue: paketQ61('M102', 2),
  }),
  fall({
    id: 'M103',
    titel: 'mBGM 03/2026 B/15 – Q61 mit 9.000 €: SV gedeckelt bei 6.930 €, BV vom vollen Entgelt',
    zweck:
      'M99 noch einmal auf Q61: erster BV-Monat, BV-Grundlage 9.000 € ohne Höchstbeitragsgrundlage ' +
      '(§ 6 Abs 1 BMSVG), SV-Grundlage gedeckelt.',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1837/BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['Q61', 'M102'],
    rang: 15,
    baue: paketQ61('M103', 1),
  }),
  fall({
    id: 'Q62',
    titel: 'Geringfügige über kasseneck: Anmeldung reserve_2 geringfügig auf B/15 zum 01.02.2026, 10 h (M3)',
    zweck: 'Vorlauf für M104/M105 – rückwirkend wie Q61, bei DG B in KW45/46 frei.',
    quelle: 'E.29.2 (M3, GERF J, VWAZ, BVAB)',
    erwartung: 'übernommen',
    fenster: ['di-nm'],
    abhaengig: [],
    rang: 11,
    baue: anmeldungGeringfuegig('Q62', 'reserve_2', 2, 10),
  }),
  fall({
    id: 'Q63',
    titel: 'Geringfügige über kasseneck: Anmeldung reserve_3 geringfügig auf B/15 zum 01.03.2026, 8 h (M3)',
    zweck: 'Zweite Geringfügige für M105 – erst die Summe beider überschreitet das 1,5-Fache der Grenze.',
    quelle: 'E.29.2 (M3, GERF J, VWAZ, BVAB)',
    erwartung: 'übernommen',
    fenster: ['di-nm'],
    abhaengig: [],
    rang: 11,
    baue: anmeldungGeringfuegig('Q63', 'reserve_3', 1, 8),
  }),
  fall({
    id: 'M104',
    titel:
      'mBGM 02/2026 B/15 über kasseneck: eine Geringfügige mit 500 € – keine Dienstgeberabgabe, BV beitragsfrei',
    zweck:
      'Erste mBGM mit einer Geringfügigen aus kasseneck (#869; vorher warf baueMeldung): Tarifgruppe und ' +
      'Verrechnungsposition für die UV, ohne Z01. Rechnet die ÖGK dieselben Beiträge (kein BW1850/BW1917)?',
    quelle: QUELLE_GF,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1837/BW1850/BW1917',
    fenster: ['di-nm'],
    abhaengig: ['Q62'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M104',
        dg: 'B',
        traeger: '15',
        monat: monatVor(ctx.zrVon('Q62'), 2),
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'reserve_2', mitarbeiter: geringfuegig(ctx, 'Q62', 2, 50_000, 10) }],
      }),
  }),
  fall({
    id: 'M105',
    titel:
      'mBGM 03/2026 B/15 über kasseneck: zwei Geringfügige (500 € + 400 €) – Dienstgeberabgabe fällig, BV ab März',
    zweck:
      'Die Summe der Entgelte aller Geringfügigen (900 €) übersteigt das 1,5-Fache der Grenze → Z01 19,4 % ' +
      'auf beide. reserve_2 ist im zweiten Monat (BV 1,53 %), reserve_3 im ersten (BV-frei). Nimmt die ÖGK ' +
      'Z01 und die BV so an – auch bei zugleich vollversicherter Beschäftigung auf A/14?',
    quelle: QUELLE_GF,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1837/BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['Q62', 'Q63', 'M104'],
    rang: 15,
    baue: (ctx) => {
      const r2 = geringfuegig(ctx, 'Q62', 2, 50_000, 10);
      const r3 = geringfuegig(ctx, 'Q63', 1, 40_000, 8);
      return mbgmPaket(ctx, {
        fall: 'M105',
        dg: 'B',
        traeger: '15',
        monat: monatVor(ctx.zrVon('Q63'), 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'reserve_2',
            mitarbeiter: r2,
            monatskontext: { andereGeringfuegige: [{ employeeId: 'reserve_3', entgeltLaufendCent: 40_000 }] },
          },
          {
            rolle: 'reserve_3',
            mitarbeiter: r3,
            monatskontext: { andereGeringfuegige: [{ employeeId: 'reserve_2', entgeltLaufendCent: 50_000 }] },
          },
        ],
      });
    },
  }),
  fall({
    id: 'Q64',
    titel:
      'Lehrling über kasseneck: Anmeldung angestellte als Angestelltenlehrling auf A/15 zum 01.03.2026 (M3)',
    zweck: 'Vorlauf für M106 – auf A/15 ist die Person in KW46 frei.',
    quelle: 'E.29.2 (M3, BBER 04, BVAB)',
    erwartung: 'übernommen',
    fenster: ['di-nm'],
    abhaengig: [],
    rang: 11,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'Q64',
        art: 'anmeldung',
        rolle: 'angestellte',
        dg: 'A',
        traeger: '15',
        felder: {
          ADAT: ctx.ttmmjjjj(`${monatVor(ctx.zr, 1)}-01`),
          BBER: '04',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
          BVAB: ctx.ttmmjjjj(`${ctx.zr.slice(0, 7)}-01`),
        },
      }),
  }),
  fall({
    id: 'M106',
    titel:
      'mBGM 03/2026 A/15 über kasseneck: Angestelltenlehrling mit 2.300 € – B044, A05, erster Monat ohne BV',
    zweck:
      'kasseneck rechnet Lehrlinge seit #673 mit A04/A05 nach der AlV-Staffel; die SIT sah bisher nur ' +
      'handgebaute Pakete (M52 A04 ohne Clearing-Befund, M90 A05 ohne Clearing). Nimmt die ÖGK den Abschlag ' +
      'A05 im Band 2.225–2.427 € aus kasseneck an (kein BW1838/BW1850)?',
    quelle:
      'E.32, D.60 (A04/A05 „Mind. AV (Lg.)“); kasseneck #673 mbgm-core.js; AlV-Staffel § 2a AMPFG 2026; SIT M52, M90',
    erwartung: 'übernommen; Clearing Mi vm ohne BW1838/BW1850/BW1917',
    fenster: ['di-nm'],
    abhaengig: ['Q64'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M106',
        dg: 'A',
        traeger: '15',
        monat: monatVor(ctx.zrVon('Q64'), 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'angestellte',
            mitarbeiter: {
              dienstnehmerGruppe: 'lehrling',
              lehrlingsArt: 'angestellter',
              beschaeftigungsart: 'fulltime',
              eintritt: `${monatVor(ctx.zrVon('Q64'), 1)}-01`,
              austritt: null,
              wochenstunden: 40,
              kvBasisStunden: 40,
              grossSalaryCents: 230_000,
            },
          },
        ],
      }),
  }),
  fall({
    id: 'Q65',
    titel: 'UEL über kasseneck: Anmeldung arbeiter auf A/14 zum 01.01.2026, BVAB 01.02.2026 (M3)',
    zweck: 'Vorlauf für Q66 und M107–M109 – drei Monate rückwirkend, auf A/14 in KW46 frei.',
    quelle: 'E.29.2 (M3, BVAB)',
    erwartung: 'übernommen',
    fenster: ['di-nm'],
    abhaengig: [],
    rang: 11,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'Q65',
        art: 'anmeldung',
        rolle: 'arbeiter',
        dg: 'A',
        traeger: '14',
        felder: {
          ADAT: ctx.ttmmjjjj(`${monatVor(ctx.zr, 3)}-01`),
          BBER: '01',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(38, 30),
          BVAB: ctx.ttmmjjjj(`${monatVor(ctx.zr, 2)}-01`),
        },
      }),
  }),
  fall({
    id: 'Q66',
    titel: 'UEL über kasseneck: Abmeldung arbeiter A/14, Ende 28.02.2026, UEL 01.–05.03., BVEN 05.03. (M4)',
    zweck:
      'Die Abmeldung, die die Pflichtversicherung um die UEL verlängert – aufgebaut wie das Beispiel E.29.2 ' +
      'Seite 316 (ADAT = Ende der Pflichtversicherung, EBSV = Ende der Beschäftigung, UEAB/UEBI, BVEN). Erst ' +
      'mit ihr gibt es für M109 im März einen Versicherten.',
    quelle: QUELLE_UEL,
    erwartung: 'übernommen; kein VW1942 (BV-Zeit ab 01.02.)',
    fenster: ['di-nm'],
    abhaengig: ['Q65'],
    rang: 12,
    baue: (ctx) => {
      const u = uel(ctx);
      return meldung(ctx, {
        fall: 'Q66',
        art: 'abmeldung',
        rolle: 'arbeiter',
        dg: 'A',
        traeger: '14',
        felder: {
          GERF: 'N',
          ADAT: ctx.ttmmjjjj(`${u.maerz}-05`),
          EBSV: ctx.ttmmjjjj(u.mitarbeiter.austritt),
          AGRD: '03',
          UEAB: ctx.ttmmjjjj(`${u.maerz}-01`),
          UEBI: ctx.ttmmjjjj(`${u.maerz}-05`),
          BVEN: ctx.ttmmjjjj(`${u.maerz}-05`),
        },
      });
    },
  }),
  fall({
    id: 'M107',
    titel: 'mBGM 01/2026 A/14 über kasseneck: UEL-Kette, erster Monat 2.400 € ohne BV',
    zweck: 'Erster Monat der UEL-Kette (Q65), damit 02 und 03 nicht allein stehen.',
    quelle: QUELLE_UEL,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1837/BW1850',
    fenster: ['di-nm'],
    abhaengig: ['Q65', 'Q66'],
    rang: 14,
    baue: paketUel('M107', 'jaenner'),
  }),
  fall({
    id: 'M108',
    titel:
      'mBGM 02/2026 A/14 über kasseneck: Austrittsmonat 28.02. – UEL liegt ganz im März, daher ohne KEUE',
    zweck:
      'D.64: KEUE J nur im Tarifblock, der einen Anteil der UEL enthält. Die UEL gehört lohnsteuerlich in den ' +
      'Februar, sozialversicherungsrechtlich in den März – im Februar also nur 2.400 € mit BV.',
    quelle: QUELLE_UEL,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['Q65', 'Q66', 'M107'],
    rang: 15,
    baue: paketUel('M108', 'februar'),
  }),
  fall({
    id: 'M109',
    titel: 'mBGM 03/2026 A/14 über kasseneck: Verlängerungsmonat nur mit UEL 400 € – KEUE J, VVON 1, BV, A03',
    zweck:
      'Der Monat, den nur die UEL verlängert (ÖGK: mBGM jedenfalls zu melden). kasseneck meldet KEUE J, ' +
      'VVON 1, AB und BV 400 € und den AV-Abschlag nach dem UEL-Betrag allein (A03 −2,95 %). Rechnet die ÖGK ' +
      'die AlV-Staffel für einen 5-Tage-Zeitraum genauso – oder aliquot (BW1850/BW1917)?',
    quelle: QUELLE_UEL,
    erwartung: 'übernommen; Clearing Mi vm ohne BW1837/BW1850/BW1917/BW1871',
    fenster: ['di-nm'],
    abhaengig: ['Q65', 'Q66', 'M108'],
    rang: 16,
    baue: paketUel('M109', 'maerz'),
  }),
];
