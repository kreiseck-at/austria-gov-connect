'use strict';

// V/M – Nachtrag KW42 nach Alis Liste N1–N4 (Di 13.10.2026).
//
// Quellen (DM-Org, 42. Ergänzung, auf der die SIT bis 01.11.2026 prüft):
//   D.22 Seite 94 Codeliste, Seite 96 Tabelle AGRD → EBSV/BVEN/KE-UE
//     (02, 04, 05, 06: EBSV Z, BVEN Z1, KE/UE Z1; 13: EBSV Z1, BVEN Z1, KE/UE –).
//   E.29.2 Seite 306: „Beim Feld ‚Betriebliche Vorsorge ENDE‘ (BVEN) ist jener
//     Zeitpunkt bekanntzugeben, bis zu dem der BV-Beitrag zu entrichten ist.“
//   E.29.2 Seite 316, Fußnote 63: Nicht-Angabe von BVEN = kein Ende der BV.
//   § 6 Abs 1 BMSVG: Beitrag nur, wenn das Arbeitsverhältnis länger als einen
//     Monat dauert; der erste Monat ist jedenfalls beitragsfrei.
//
// Personenbelegung (zusätzliche Beschäftigungen auf Konten, auf denen die
// Person in dieser Woche sonst nicht angemeldet ist – Mehrfachbeschäftigung):
//   DG A/15  arbeiter              V70 (N4/N2, Eintritt 01.02.2025, 38,5 h) → M50 → V71 (AGRD 02) → M51
//   DG A/15  arbeiterlehrling      V72 → V73 (AGRD 04 Zeitablauf)
//   DG A/15  angestelltenlehrling  V74 → V75 (AGRD 05 berechtigter vorzeitiger Austritt)
//   DG A/14  reserve_3             V76 → V77 (AGRD 06 fristlose Entlassung)
//   DG A/15  freier_dn             V78 → V79 (AGRD 13 Tod) – die übrigen Fälle dieser
//                                  Person laufen bis Montag; danach braucht sie niemand.
//   DG A/15  geringfuegig          V80 → V81 (N3a: Ende im ersten Monat, ohne BVEN)
//   DG A/14  reserve_2             V82 → V83 (N3b: Ende im ersten Monat, mit BVEN)
//
// Ablauf:
//   Di vormittags  (sim. 01.03.2025) V70, V72, V74, V76, V78, V80, V82; danach M50 (mBGM 02/2025)
//   Di nachmittags (sim. 01.04.2025) V71 (Abmeldung mit BVEN), danach M51 (mBGM 03/2025);
//                                    V73, V75, V77, V79 (Ende 31.03.), V81, V83 (Ende 20.03.)
//
// Einschränkung N4: Die Montag-Fenster waren schon vorbei. Damit das Dienstverhältnis
// zwei Monate hat, meldet V70 am simulierten 01.03.2025 rückwirkend zum 01.02.2025
// an – eine verspätete Anmeldung. Ein Meldeverstoß im Clearing hat mit der Frage
// (BV-Ende vor der letzten mBGM) nichts zu tun.

const { meldung } = require('../lib/bausteine');
const { plusTage } = require('../lib/fenster');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const DI_VM = ['di-vm'];
const DI_NM = ['di-nm'];

const D22 = 'DM-Org 42, D.22 Seite 94 (Codeliste) und Seite 96 (Tabelle AGRD → EBSV/BVEN/KE-UE)';
const BVEN_QUELLE = 'E.29.2 Seite 306 (BVEN = Ende der Beitragspflicht) und Seite 316 Fn. 63; § 6 Abs 1 BMSVG';

/** 38 h 30 min → 3850 (N2). */
const STUNDEN_38_5 = (ctx) => ctx.elda.wochenarbeitszeit(38, 30);

/** Anmeldung am simulierten Tag (Di vormittags = 01.03.2025), ohne BVAB. */
function anmeldungAm(id, { rolle, dg, traeger, bber = '01', adat, bvab }) {
  return (ctx) =>
    meldung(ctx, {
      fall: id,
      art: 'anmeldung',
      rolle,
      dg,
      traeger,
      felder: {
        ADAT: d(ctx, adat ? adat(ctx) : ctx.zr),
        BBER: bber,
        GERF: 'N',
        FRDV: 'N',
        VWAZ: STUNDEN_38_5(ctx),
        ...(bvab ? { BVAB: d(ctx, bvab(ctx)) } : {}),
      },
    });
}

/** Abmeldung; `ende` als ISO-Datum aus dem Kontext. */
function abmeldungMit(id, { rolle, dg, traeger, agrd, ende, bven }) {
  return (ctx) => {
    const e = d(ctx, ende(ctx));
    return meldung(ctx, {
      fall: id,
      art: 'abmeldung',
      rolle,
      dg,
      traeger,
      felder: { GERF: 'N', ADAT: e, EBSV: e, AGRD: agrd, ...(bven ? { BVEN: e } : {}) },
    });
  };
}

const ENDE_VORMONAT = (ctx) => plusTage(ctx.zr, -1); // Di nm: 31.03.2025
const ENDE_20_MAERZ = (ctx) => `${ctx.zrVon('V80').slice(0, 8)}20`; // 20. des Eintrittsmonats

// --- N4: mBGM über den Paket-Weg (wie a1Mbgm in v-kw42-zusatz.js) ------------------

const MONATSENTGELT = 300_000;
const T01_SATZ = 39.05; // für 2025 nicht belegt – BW1850 möglich
const BV_SATZ = 1.53;

function mbgmN4(id, { mitBv }) {
  return (ctx) => {
    const [j, m] = ctx.zr.split('-').map(Number);
    const bzr = new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 7);
    const konto = ctx.konto('A', { traeger: '15' });
    const p = ctx.rolle('arbeiter');
    const refw = ctx.referenzwert(`${id}-1`);
    const paketref = ctx.referenzwert(id);
    const basen = [
      {
        typ: 'AB',
        betragCent: MONATSENTGELT,
        positionen: [
          { typ: 'T01', prozentsatz: T01_SATZ, betragCent: ctx.elda.berechneBeitragCent(MONATSENTGELT, T01_SATZ) },
        ],
      },
    ];
    if (mitBv) {
      basen.push({
        typ: 'BV',
        betragCent: MONATSENTGELT,
        positionen: [
          { typ: 'V01', prozentsatz: BV_SATZ, betragCent: ctx.elda.berechneBeitragCent(MONATSENTGELT, BV_SATZ) },
        ],
      });
    }
    const saetze = ctx.elda.erstelleMbgmPaket(
      [
        {
          referenzwert: refw,
          versicherungsnummer: p.vsnr,
          familienname: p.familienname,
          vorname: p.vorname,
          // Erster Monat: BV-Zeit läuft, aber keine BV-Verrechnung → VERG 2 (D.54-Matrix,
          // wie M40); zweiter Monat mit BV-Verrechnung → VERG 1.
          verrechnungsgrundlage: mitBv
            ? ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT
            : ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
          tarifbloecke: [{ beschaeftigtengruppe: 'B001', beginnDerVerrechnung: 1, basen }],
        },
      ],
      {
        verfahren: 'selbstabrechnung',
        paketreferenzwert: paketref,
        beitragskontonummer: konto.bknr,
        dienstgebername: ctx.dienstgeber('A').name,
        beitragszeitraum: `${bzr.slice(5, 7)}${bzr.slice(0, 4)}`,
        jaehrlicheAbrechnungGeringfuegiger: false,
      },
    );
    const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
    if (befunde.length > 0) throw new Error(`mBGM-Paket ${id} hat Befunde: ${JSON.stringify(befunde).slice(0, 300)}`);
    return {
      inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'A', traeger: '15' })),
      dateiName: ctx.dateiName(id),
      referenzwerte: [paketref, refw],
    };
  };
}

/** Eintritt + 1 Monat als ISO-Datum. */
function monatSpaeter(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m, t)).toISOString().slice(0, 10);
}
const EINTRITT_N4 = (ctx) => plusTage(ctx.zr, -28); // Di vm: 01.03.2025 − 28 Tage = 01.02.2025

module.exports = [
  // --- N4 (mit N2 und Abmeldegrund 02) ---------------------------------------------
  fall({
    id: 'V70',
    titel: 'N4/N2: Anmeldung Arbeiter zum 01.02.2025, 38,5 h (3850), BVAB = Eintritt + 1 Monat (M3)',
    zweck:
      'Vorlauf für die Reihenfolge-Probe N4 (Abmeldung mit BVEN vor der mBGM des letzten Monats). ' +
      'Zugleich N2: Wochenarbeitszeit 38 h 30 min = 3850 gegen ELDA. Rückwirkend gemeldet (siehe Dateikopf).',
    quelle: 'E.29.2 Seite 310/311 (BVAB = Eintritt + 1 Monat), E.29 Feld VWAZ',
    erwartung: 'übernommen (ggf. Clearing zur verspäteten Anmeldung)',
    fenster: DI_VM,
    baue: anmeldungAm('V70', {
      rolle: 'arbeiter',
      dg: 'A',
      traeger: '15',
      adat: EINTRITT_N4,
      bvab: (ctx) => monatSpaeter(EINTRITT_N4(ctx)),
    }),
  }),
  fall({
    id: 'M50',
    titel: 'N4: mBGM Februar 2025 zu V70, erster Monat ohne BV (Paket-Weg)',
    zweck: 'Erster Monat beitragsfrei in der BV (§ 6 Abs 1 BMSVG): AB mit T01, keine BV, VERG 2.',
    quelle: 'E.32; D.54; § 6 Abs 1 BMSVG',
    erwartung: 'übernommen; BW1850 möglich (T01-Satz 2025 unbelegt)',
    fenster: DI_VM,
    abhaengig: ['V70'],
    rang: 30,
    baue: mbgmN4('M50', { mitBv: false }),
  }),
  fall({
    id: 'V71',
    titel: 'N4/N1: Abmeldung zu V70 mit BVEN VOR der mBGM März, Abmeldegrund 02 (M4)',
    zweck:
      'Reihenfolge wie im echten Betrieb: Ende 31.03.2025, Abmeldung am 01.04. mit BVEN; die mBGM 03/2025 ' +
      'mit BV kommt erst danach (M51). Kommt VW1942, und verschwindet es mit der mBGM? Zugleich N1: Code 02 ' +
      '„Kündigung durch den Dienstnehmer“ (EBSV Z, BVEN Z1).',
    quelle: `${D22}; ${BVEN_QUELLE}`,
    erwartung: 'übernommen; Clearing Mi lesen (VW1942 ja/nein, nach M51 noch offen?)',
    fenster: DI_NM,
    abhaengig: ['V70', 'M50'],
    rang: 20,
    baue: abmeldungMit('V71', {
      rolle: 'arbeiter',
      dg: 'A',
      traeger: '15',
      agrd: '02',
      ende: ENDE_VORMONAT,
      bven: true,
    }),
  }),
  fall({
    id: 'M51',
    titel: 'N4: mBGM März 2025 zu V70 mit BV, NACH der Abmeldung (Paket-Weg)',
    zweck: 'Letzter Monat, BV-pflichtig ab dem zweiten Monat: AB + BV, VERG 1. Bewusst nach V71 gesendet.',
    quelle: 'E.32; D.54; § 6 Abs 1 BMSVG',
    erwartung: 'übernommen; kein BW1871 – und ein VW1942 zu V71 sollte sich erledigen',
    fenster: DI_NM,
    abhaengig: ['V71'],
    rang: 30,
    baue: mbgmN4('M51', { mitBv: true }),
  }),

  // --- N1: weitere Abmeldegründe (Anmeldung Di vm, Abmeldung Di nm zum 31.03.) -------
  ...[
    ['V72', 'V73', 'arbeiterlehrling', 'A', '15', '01', '04', 'Zeitablauf'],
    ['V74', 'V75', 'angestelltenlehrling', 'A', '15', '02', '05', 'Berechtigter vorzeitiger Austritt'],
    ['V76', 'V77', 'reserve_3', 'A', '14', '01', '06', 'Fristlose Entlassung'],
    ['V78', 'V79', 'freier_dn', 'A', '15', '01', '13', 'Tod des Dienstnehmers'],
  ].flatMap(([anm, abm, rolle, dg, traeger, bber, agrd, text]) => [
    fall({
      id: anm,
      titel: `N1: Anmeldung für Abmeldegrund ${agrd} (M3)`,
      zweck: `Vorlauf für ${abm}. Zusätzliche Beschäftigung der Testperson auf Konto ${dg}/${traeger}.`,
      quelle: 'E.29.2 (M3)',
      erwartung: 'übernommen',
      fenster: DI_VM,
      baue: anmeldungAm(anm, { rolle, dg, traeger, bber }),
    }),
    fall({
      id: abm,
      titel: `N1: Abmeldung mit Abmeldegrund ${agrd} „${text}“ (M4)`,
      zweck:
        `Code ${agrd} aus der Codeliste D.22. Ende am 31.03.2025 nach genau einem Monat – BV-Beitrag fällt ` +
        'nicht an (§ 6 Abs 1 BMSVG), BVEN bleibt leer.' +
        (agrd === '13' ? ' Bei Tod: EBSV Z1, KE/UE nicht zulässig (Seite 96).' : ' EBSV zwingend (Seite 96).'),
      quelle: `${D22}; ${BVEN_QUELLE}`,
      erwartung: 'übernommen',
      fenster: DI_NM,
      abhaengig: [anm],
      baue: abmeldungMit(abm, { rolle, dg, traeger, agrd, ende: ENDE_VORMONAT, bven: false }),
    }),
  ]),

  // --- N3: Austritt im ersten Monat ---------------------------------------------------
  fall({
    id: 'V80',
    titel: 'N3a: Anmeldung, Austritt im ersten Monat folgt (M3)',
    zweck: 'Vorlauf für V81.',
    quelle: 'E.29.2 (M3)',
    erwartung: 'übernommen',
    fenster: DI_VM,
    baue: anmeldungAm('V80', { rolle: 'geringfuegig', dg: 'A', traeger: '15' }),
  }),
  fall({
    id: 'V81',
    titel: 'N3a: Abmeldung am 20. des ersten Monats OHNE BVEN (M4)',
    zweck:
      'Dienstverhältnis kürzer als ein Monat: kein BV-Beitrag (§ 6 Abs 1 BMSVG), BVEN „zwingend wenn ' +
      'zutreffend“ trifft nicht zu und bleibt leer.',
    quelle: `${D22}; ${BVEN_QUELLE}`,
    erwartung: 'übernommen, kein Clearing',
    fenster: DI_NM,
    abhaengig: ['V80'],
    baue: abmeldungMit('V81', {
      rolle: 'geringfuegig',
      dg: 'A',
      traeger: '15',
      agrd: '03',
      ende: ENDE_20_MAERZ,
      bven: false,
    }),
  }),
  fall({
    id: 'V82',
    titel: 'N3b: Anmeldung, Austritt im ersten Monat folgt (M3)',
    zweck: 'Vorlauf für V83.',
    quelle: 'E.29.2 (M3)',
    erwartung: 'übernommen',
    fenster: DI_VM,
    baue: anmeldungAm('V82', { rolle: 'reserve_2', dg: 'A', traeger: '14' }),
  }),
  fall({
    id: 'V83',
    titel: 'N3b: Abmeldung am 20. des ersten Monats MIT BVEN (M4)',
    zweck:
      'Gegenprobe zu V81: BVEN gesetzt, obwohl nie ein BV-Beitrag zu entrichten war. Erwartung laut Ali: ' +
      'VW1942 („keine Zeit der BV gespeichert“).',
    quelle: `${D22}; ${BVEN_QUELLE}`,
    erwartung: 'übernommen; Clearing VW1942',
    fenster: DI_NM,
    abhaengig: ['V82'],
    baue: abmeldungMit('V83', {
      rolle: 'reserve_2',
      dg: 'A',
      traeger: '14',
      agrd: '03',
      ende: (ctx) => `${ctx.zrVon('V82').slice(0, 8)}20`,
      bven: true,
    }),
  }),
];
