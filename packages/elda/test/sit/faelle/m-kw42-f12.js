'use strict';

// Folgefragen kasseneck F1/F2 (Mi 14.10.2026, Fenster mi-vm, sim. 01.04.2026).
//
// F1 – Lehrlinge 2026 mit den Lehrlings-Abschlägen nach Entgelt:
//   V90/V91 Anmeldung Arbeiter- bzw. Angestelltenlehrling auf A/14 zum 01.03.2026
//           (verspätet gegenüber dem simulierten 01.04.2026), BVAB 01.04.2026.
//   M90     mBGM 03/2026 (Paket-Weg) für beide:
//           - Arbeiterlehrling 2.300,00 € → AlV-Staffel 1 % → A05 −0,15 % auf AB
//           - Angestelltenlehrling 950,00 € + Sonderzahlung 950,00 € → A04 −1,15 %
//             auf AB und auf SZ (T02)
// F2 – freier Dienstnehmer MIT BVAB:
//   V92     Anmeldung reserve_2 als freier DN auf B/15F zum 02.02.2026 (verspätet),
//           BBER 02, FRDV J, BVAB 02.03.2026 (Eintritt + 1 Monat).
//   M91     mBGM 02/2026: B053, 27 SV-Tage (2.700,00 €), ohne BV, VERG 2, VVON 02.
//   M92     mBGM 03/2026: B053, 3.000,00 €, BV ab 02.03. (Resttage 30 → voll), VERG 1.
//
// Gegenprobe F1 (Fenster mi-nm, sim. 01.05.2026):
//   M90 kam mit BW1862 zurück („keine Versicherungszeit SV“ 03/2026, beide Lehrlinge). V90/V91 waren formal
//   übernommen, ohne Clearing. Beide Personen hatten auf A/14 noch ein offenes Dienstverhältnis aus 2025
//   (Abmeldungen V15/V50 mit VW1942 nicht verarbeitet); V97/V99 haben es erst zwei Minuten NACH V90/V91
//   geschlossen. Vermutung: Eine Anmeldung bei offenem Dienstverhältnis auf demselben Konto wird ohne
//   Rückmeldung nicht gespeichert (vgl. V34). V93/V94 melden jetzt – nach V97/V99 – erneut an, M94 wiederholt M90.
//
// Quellen der Sätze und Grenzen (kasseneck lohnparameter/2026.json, dort belegt):
//   Lehrling T01 = DN 13,07 % + DG 15,38 % = 28,45 % (ÖGK 10008.802672); Sonderzahlungen
//   Lehrling ebenso 13,07 % + 15,38 % = 28,45 % (T02). AlV-Anteil Lehrling 1,15 %.
//   AlV-Staffel § 2a AMPFG (WKO, Beitragswesen 2026): bis 2.225,00 € 0 %, bis
//   2.427,00 € 1 % → Lehrling: bis 2.225 € A04 (−1,15 %), bis 2.427 € A05 (−0,15 %).
//   Freier DN Ang. T01 38,05 % (ÖGK-Tarifsystem 10008.807381), Gruppe B053 – auf der
//   SIT am 13.10.2026 (M56) ohne Beanstandung verbucht.
// Personen: arbeiterlehrling/angestelltenlehrling waren 2025 auf A/14 (V03/V04, beendet);
// reserve_2 war 2025 auf A/14 (V82/V83, beendet), auf B/15F nie beschäftigt. freier_dn
// selbst ist auf B/15F seit V06 (2025) nicht abgemeldet – deshalb reserve_2.

const { meldung } = require('../lib/bausteine');

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const MI_VM = ['mi-vm'];
const MI_NM = ['mi-nm'];
const d = (ctx, iso) => ctx.ttmmjjjj(iso);

const T_LEHRLING = 28.45;
const A04 = -1.15;
const A05 = -0.15;
const T01_FR_DN = 38.05;
const BV = 1.53;

function pos(ctx, typ, satz, basis) {
  return { typ, prozentsatz: satz, betragCent: ctx.elda.berechneBeitragCent(basis, satz) };
}

function eintrag(ctx, refw, rolle, verg, tarifblock) {
  const p = ctx.rolle(rolle);
  return {
    referenzwert: refw,
    versicherungsnummer: p.vsnr,
    familienname: p.familienname,
    vorname: p.vorname,
    verrechnungsgrundlage: ctx.elda.VERRECHNUNGSGRUNDLAGE[verg],
    tarifbloecke: [tarifblock],
  };
}

function paket(ctx, id, eintraege, { dg, traeger, freieDN = false, bzr, referenzwerte }) {
  const paketref = ctx.referenzwert(id);
  const saetze = ctx.elda.erstelleMbgmPaket(eintraege, {
    verfahren: 'selbstabrechnung',
    paketreferenzwert: paketref,
    beitragskontonummer: ctx.konto(dg, { traeger, freieDN }).bknr,
    dienstgebername: ctx.dienstgeber(dg).name,
    beitragszeitraum: bzr,
    jaehrlicheAbrechnungGeringfuegiger: false,
  });
  const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
  if (befunde.length > 0)
    throw new Error(`mBGM-Paket ${id} hat Befunde: ${JSON.stringify(befunde).slice(0, 400)}`);
  return {
    inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg, traeger })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [...referenzwerte, paketref],
  };
}

function lehrlingsAnmeldung(id, rolle, bber) {
  return (ctx) =>
    meldung(ctx, {
      fall: id,
      art: 'anmeldung',
      rolle,
      dg: 'A',
      traeger: '14',
      felder: {
        ADAT: '01032026',
        BBER: bber,
        GERF: 'N',
        FRDV: 'N',
        VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
        BVAB: '01042026',
      },
    });
}

function lehrlingsMbgm(id) {
  return (ctx) => {
    const r1 = ctx.referenzwert(`${id}-1`);
    const r2 = ctx.referenzwert(`${id}-2`);
    const ab1 = 230_000;
    const ab2 = 95_000;
    const sz2 = 95_000;
    return paket(
      ctx,
      id,
      [
        eintrag(ctx, r1, 'arbeiterlehrling', 'SV_MIT_ZEIT', {
          beschaeftigtengruppe: 'B045',
          beginnDerVerrechnung: 1,
          basen: [
            {
              typ: 'AB',
              betragCent: ab1,
              positionen: [pos(ctx, 'T01', T_LEHRLING, ab1), pos(ctx, 'A05', A05, ab1)],
            },
          ],
        }),
        eintrag(ctx, r2, 'angestelltenlehrling', 'SV_MIT_ZEIT', {
          beschaeftigtengruppe: 'B044',
          beginnDerVerrechnung: 1,
          basen: [
            {
              typ: 'AB',
              betragCent: ab2,
              positionen: [pos(ctx, 'T01', T_LEHRLING, ab2), pos(ctx, 'A04', A04, ab2)],
            },
            {
              typ: 'SZ',
              betragCent: sz2,
              positionen: [pos(ctx, 'T02', T_LEHRLING, sz2), pos(ctx, 'A04', A04, sz2)],
            },
          ],
        }),
      ],
      { dg: 'A', traeger: '14', bzr: '032026', referenzwerte: [r1, r2] },
    );
  };
}

module.exports = [
  fall({
    id: 'V90',
    titel: 'F1: Anmeldung Arbeiterlehrling zum 01.03.2026 mit BVAB (A/14)',
    zweck: 'Vorlauf für M90 (Lehrling mit A05). Verspätet gegenüber dem simulierten 01.04.2026.',
    quelle: 'E.29.2; § 6 Abs 1 BMSVG; SIT A1 (BVAB = Eintritt + 1 Monat sauber)',
    erwartung: 'übernommen',
    fenster: MI_VM,
    rang: 20,
    baue: lehrlingsAnmeldung('V90', 'arbeiterlehrling', '03'),
  }),
  fall({
    id: 'V91',
    titel: 'F1: Anmeldung Angestelltenlehrling zum 01.03.2026 mit BVAB (A/14)',
    zweck: 'Vorlauf für M90 (Lehrling mit A04 auf AB und SZ).',
    quelle: 'E.29.2; § 6 Abs 1 BMSVG',
    erwartung: 'übernommen',
    fenster: MI_VM,
    rang: 20,
    baue: lehrlingsAnmeldung('V91', 'angestelltenlehrling', '04'),
  }),
  fall({
    id: 'M90',
    titel: 'F1: mBGM 03/2026 Lehrlinge – A05 bei 2.300 €, A04 auf AB und SZ (Paket-Weg)',
    zweck:
      'Bestätigt die Lehrlings-Abschläge nach der AlV-Staffel: Arbeiterlehrling 2.300,00 € (Band ' +
      '2.225,00–2.427,00 €) mit A05 −0,15 %; Angestelltenlehrling 950,00 € mit A04 auf AB und auf der ' +
      'Sonderzahlung (T02). Erster Monat → keine BV, VERG 2.',
    quelle:
      'D.60 (A04/A05 „Mind. AV … (Lg.)“); AlV-Staffel § 2a AMPFG 2026 (WKO); Lehrlingssätze ÖGK 10008.802672; ' +
      'SIT M52 (A04 ohne BW1838/BW1850)',
    erwartung: 'übernommen; Clearing: kein BW1838, kein BW1850',
    fenster: MI_VM,
    abhaengig: ['V90', 'V91'],
    rang: 30,
    baue: lehrlingsMbgm('M90'),
  }),
  fall({
    id: 'V92',
    titel: 'F2: Anmeldung freier Dienstnehmer MIT BVAB (reserve_2, B/15F, zum 02.02.2026)',
    zweck:
      'M56 (freier DN ohne BVAB) bekam nur BW1871. Hier mit BVAB = Eintritt + 1 Monat. Verspätet gegenüber ' +
      'dem simulierten 01.04.2026.',
    quelle: 'E.29.2 (FRDV, BVAB); § 6 Abs 1 BMSVG; SIT M56 (13.10.2026)',
    erwartung: 'übernommen',
    fenster: MI_VM,
    rang: 20,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V92',
        art: 'anmeldung',
        rolle: 'reserve_2',
        dg: 'B',
        traeger: '15',
        freieDN: true,
        felder: { ADAT: '02022026', BBER: '02', GERF: 'N', FRDV: 'J', BVAB: '02032026' },
      }),
  }),
  fall({
    id: 'M91',
    titel: 'F2: mBGM 02/2026 freier DN (B053, 27 SV-Tage, ohne BV)',
    zweck: 'Erster Monat des freien DN mit BVAB: SV ab 02.02. (VVON 02), BV beitragsfrei, VERG 2.',
    quelle: 'E.32, D.63 VVON, D.54; ÖGK-Tarifsystem „Fr. DN Ang.“ (10008.807381); SIT M56',
    erwartung: 'übernommen; kein Clearing',
    fenster: MI_VM,
    abhaengig: ['V92'],
    rang: 30,
    baue: (ctx) => {
      const r = ctx.referenzwert('M91-1');
      const ab = 270_000;
      return paket(
        ctx,
        'M91',
        [
          eintrag(ctx, r, 'reserve_2', 'SV_MIT_ZEIT', {
            beschaeftigtengruppe: 'B053',
            beginnDerVerrechnung: 2,
            basen: [{ typ: 'AB', betragCent: ab, positionen: [pos(ctx, 'T01', T01_FR_DN, ab)] }],
          }),
        ],
        { dg: 'B', traeger: '15', freieDN: true, bzr: '022026', referenzwerte: [r] },
      );
    },
  }),
  fall({
    id: 'M92',
    titel: 'F2: mBGM 03/2026 freier DN (B053, 3.000 €, mit BV)',
    zweck:
      'Zweiter Monat: BV ab 02.03. – Resttage 31 − 1 = 30, gedeckelt auf 30 → volle Basis. VERG 1. ' +
      'Erwartung: ganz ohne Clearing (anders als M56 ohne BVAB).',
    quelle: 'E.32, D.54; § 6 Abs 1 BMSVG; ÖGK-FAK BMSVG 3.4; SIT M56',
    erwartung: 'übernommen; kein Clearing (insbesondere kein BW1871)',
    fenster: MI_VM,
    abhaengig: ['M91'],
    rang: 31,
    baue: (ctx) => {
      const r = ctx.referenzwert('M92-1');
      const ab = 300_000;
      return paket(
        ctx,
        'M92',
        [
          eintrag(ctx, r, 'reserve_2', 'SV_UND_BV_MIT_ZEIT', {
            beschaeftigtengruppe: 'B053',
            beginnDerVerrechnung: 1,
            basen: [
              { typ: 'AB', betragCent: ab, positionen: [pos(ctx, 'T01', T01_FR_DN, ab)] },
              { typ: 'BV', betragCent: ab, positionen: [pos(ctx, 'V01', BV, ab)] },
            ],
          }),
        ],
        { dg: 'B', traeger: '15', freieDN: true, bzr: '032026', referenzwerte: [r] },
      );
    },
  }),
  fall({
    id: 'V93',
    titel: 'F1-Gegenprobe: Anmeldung Arbeiterlehrling zum 01.03.2026 nach dem Abschluss V97 (A/14)',
    zweck:
      'Wie V90, jetzt nachdem V97 das alte Dienstverhältnis geschlossen hat. Kommt zu M94 kein BW1862, war das ' +
      'offene Dienstverhältnis der Grund, warum V90 nicht gespeichert wurde.',
    quelle: 'E.29.2; SIT V90/M90 (BW1862), V97',
    erwartung: 'übernommen',
    fenster: MI_NM,
    abhaengig: ['V97'],
    rang: 20,
    baue: lehrlingsAnmeldung('V93', 'arbeiterlehrling', '03'),
  }),
  fall({
    id: 'V94',
    titel: 'F1-Gegenprobe: Anmeldung Angestelltenlehrling zum 01.03.2026 nach dem Abschluss V99 (A/14)',
    zweck: 'Wie V91, jetzt nachdem V98/V99 das alte Dienstverhältnis geschlossen haben.',
    quelle: 'E.29.2; SIT V91/M90 (BW1862), V99',
    erwartung: 'übernommen',
    fenster: MI_NM,
    abhaengig: ['V99'],
    rang: 20,
    baue: lehrlingsAnmeldung('V94', 'angestelltenlehrling', '04'),
  }),
  fall({
    id: 'M94',
    titel: 'F1-Gegenprobe: mBGM 03/2026 Lehrlinge wie M90 (A05 bei 2.300 €, A04 auf AB und SZ)',
    zweck:
      'Gleiches Paket wie M90. Kein BW1862 → V93/V94 gespeichert; dann zeigt das Clearing auch die eigentliche ' +
      'F1-Frage (BW1838/BW1850 zu A05 und zur Sonderzahlung).',
    quelle: 'wie M90',
    erwartung: 'übernommen; Clearing: kein BW1862, kein BW1838, kein BW1850',
    fenster: MI_NM,
    abhaengig: ['V93', 'V94'],
    rang: 30,
    baue: lehrlingsMbgm('M94'),
  }),
];
