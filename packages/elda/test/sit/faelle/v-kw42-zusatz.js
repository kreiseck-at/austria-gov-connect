'use strict';

// V/M – Zusatzfälle KW42 (12.–14.10.2026): BV-Beginn in der Anmeldung, saubere
// BV-Kette (Anmeldung → mBGM ohne BV → mBGM mit BV → Abmeldung mit BVEN),
// weitere Abmeldegründe, Korrekturen und Negativfälle.
//
// Personenbelegung (eine Beschäftigung je Person und Konto; DG B/15 ist das
// Konto, auf dem montags B03/B11/B12 die Reservepersonen anmelden):
//   DG B/15  arbeiter            V40 (A1a) → M40/M41 → V44
//   DG B/15  angestellte         V41 (A1b) → M40/M41 → V45
//   DG B/15  arbeiterlehrling    V42 (A1c, als Arbeiter) → M40/M41 → V46; V43 (M8)
//   DG B/15  geringfuegig        V55 (geringfügig) → V56 (M6 vollversichert)
//   DG B/15  angestelltenlehrling V57 → V58 (M8 Beginn verschoben)
//   DG B/15  reserve_1/2/3       aus B03/B12/B11 → V47/V48/V49 (Abmeldegründe 00/16/22)
//   DG B/15  erfundene Personen  V52 (ß/ö), V53 (é), V54 (ş als UTF-8) – ohne VSNR
//   DG B/15F freier_dn           V06 → V34 (Doppelanmeldung)
//   DG A/14  angestelltenlehrling V04 → V50 (Abmeldegrund 34)
//   DG A/14  arbeiterlehrling    V15 (Abmeldung) → V51 (Wiedereintritt)
//   DG A/14  geringfuegig        V05 → V11 (Storno) → V59 (neue Anmeldung)
//   DG A/14  freier_dn           nie angemeldet: V35, V36, V60, V61–V66 (Negativfälle)
//   DG A/15  reserve_2           V33 (verspätete Anmeldung, Mittwoch)
//
// Ablauf:
//   Mo nachmittags (sim. 01.02.2025) V40–V42, V52–V55, V57, V34–V36, V60–V66
//   Di vormittags  (sim. 01.03.2025) M40 (mBGM 02/2025), V43, V56, V58, V47–V50
//   Di nachmittags (sim. 01.04.2025) M41 (mBGM 03/2025), danach V44–V46; V51, V59
//   Mi vormittags  (sim. 01.04.2026) V33
//
// Nicht in KW42 (Kandidaten für KW45, neue Zeitreise):
//   C2 Änderungsmeldung nach gesendeter mBGM für denselben Monat (ÖGK-FAK mBGM
//      5.39) – braucht eine Person mit mBGM im selben Monat; die A1-Kette soll
//      davon unberührt bleiben.
//   D1/D3/D5 laufen über den eigenen Versandweg von kasseneck (Referenzwerte
//      KE-VR-…, Zuordnung der Rücksendungen, Rückmeldungskarte). Die Brücke zu
//      kasseneck kennt bisher nur die mBGM (lib/kasseneck.js); für An- und
//      Abmeldungen müsste sie den VR-Builder von kasseneck einbinden.
//   A5 (Urlaubsersatzleistung) ist V13.

const { meldung, setzeFeld } = require('../lib/bausteine');
const { plusTage } = require('../lib/fenster');
const { FELDER_E29 } = require('../../../dist/felder-e29.js');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const feldE29 = (name) => FELDER_E29.find((f) => f.name === name);
const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });

const MO_NM = ['mo-nm'];
const DI_VM = ['di-vm'];
const DI_NM = ['di-nm'];

/** Eintritt am 07. des simulierten Monats (mitten im Monat). */
const eintritt = (zr) => `${zr.slice(0, 8)}07`;

const VOLLZEIT = (ctx) => ctx.elda.wochenarbeitszeit(38, 30);

// --- A1: BV-Beginn in der Anmeldung -----------------------------------------

const A1 = {
  V40: { rolle: 'arbeiter', variante: 'a', bvab: (ein) => monatSpaeter(ein) },
  V41: { rolle: 'angestellte', variante: 'b', bvab: () => undefined },
  V42: { rolle: 'arbeiterlehrling', variante: 'c', bvab: (ein) => ein },
};

/** Eintritt + 1 Monat (§ 6 Abs 1 BMSVG: „Der erste Monat ist jedenfalls beitragsfrei“). */
function monatSpaeter(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  const neu = new Date(Date.UTC(j, m, t));
  return neu.toISOString().slice(0, 10);
}

const A1_QUELLE =
  'E.29.2 Seite 310/311 (Beispiel: Anmeldung per 01.01.2019 „mit BV ab 01.02.2019“, BVAB = 01.02.2019); ' +
  'E.29.2 Seite 306 („Anmeldung zur BV ohne SV-Zeit“: dort BVAB und ADAT in Grundstellung); ' +
  '§ 6 Abs 1 BMSVG; laut Alis Liste ÖGK-FAK mBGM 5.38 (hier nicht nachgelesen)';

function a1Anmeldung(id) {
  const { rolle, bvab } = A1[id];
  return (ctx) => {
    const ein = eintritt(ctx.zr);
    const bv = bvab(ein);
    return meldung(ctx, {
      fall: id,
      art: 'anmeldung',
      rolle,
      dg: 'B',
      traeger: '15',
      felder: {
        ADAT: d(ctx, ein),
        BBER: '01',
        GERF: 'N',
        FRDV: 'N',
        VWAZ: VOLLZEIT(ctx),
        ...(bv ? { BVAB: d(ctx, bv) } : {}),
      },
    });
  };
}

// --- mBGM über den Paket-Weg ---------------------------------------------------

// Arbeiter, 3.000,00 € im Monat – über jeder AV-Minderungsgrenze, damit kein
// Abschlag nötig ist. T01 mit 39,05 %: der Satz, den die mBGM eines Arbeiters
// (B001) bei kasseneck für 2026 trägt. Für 2025 ist er hier NICHT belegt –
// weicht die ÖGK ab, kommt BW1850 (Kontrollfall, Meldung wird verarbeitet).
const MONATSENTGELT = 300_000;
const T01_SATZ = 39.05;
const BV_SATZ = 1.53;

/**
 * mBGM eines Monats für die drei A1-Personen auf Konto B/15.
 *
 * Eintrittsmonat (Eintritt 07.): SV-Zeit ab dem 07. → Beginn der Verrechnung 07,
 * Beitragsgrundlage für 24 von 30 SV-Tagen; BV-Zeit läuft, aber der erste Monat
 * ist beitragsfrei (§ 6 Abs 1 BMSVG) → keine BV-Verrechnung → VERG 2 (D.54,
 * Matrixzeile „Zeit SV ja, Abrechnung SV ja, Zeit BV ja, Abrechnung BV nein“).
 *
 * Folgemonat: Beginn der Verrechnung 01; BV pflichtig ab dem 07. → Tageswert
 * (Entgelt/30) × restliche Kalendertage (ÖGK-FAK BMSVG 3.4, wie kasseneck
 * rechnet) → VERG 1.
 */
function a1Mbgm(id, { folgemonat }) {
  return (ctx) => {
    const zr = ctx.zr; // 01. des Monats NACH dem Beitragszeitraum
    const [j, m] = zr.split('-').map(Number);
    const bzr = new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 7); // JJJJ-MM
    const konto = ctx.konto('B', { traeger: '15' });
    const referenzwerte = [];
    const eintraege = Object.keys(A1).map((anm, i) => {
      const person = ctx.rolle(A1[anm].rolle);
      const refw = ctx.referenzwert(`${id}-${i + 1}`);
      referenzwerte.push(refw);
      let tarifblock;
      if (!folgemonat) {
        const ab = Math.round((MONATSENTGELT * 24) / 30);
        tarifblock = {
          beschaeftigtengruppe: 'B001',
          beginnDerVerrechnung: 7,
          basen: [
            {
              typ: 'AB',
              betragCent: ab,
              positionen: [
                { typ: 'T01', prozentsatz: T01_SATZ, betragCent: ctx.elda.berechneBeitragCent(ab, T01_SATZ) },
              ],
            },
          ],
        };
      } else {
        const tageImMonat = new Date(
          Date.UTC(Number(bzr.slice(0, 4)), Number(bzr.slice(5, 7)), 0),
        ).getUTCDate();
        const resttage = Math.min(30, tageImMonat - 6);
        const bvBasis = Math.round((MONATSENTGELT / 30) * resttage);
        tarifblock = {
          beschaeftigtengruppe: 'B001',
          beginnDerVerrechnung: 1,
          basen: [
            {
              typ: 'AB',
              betragCent: MONATSENTGELT,
              positionen: [
                {
                  typ: 'T01',
                  prozentsatz: T01_SATZ,
                  betragCent: ctx.elda.berechneBeitragCent(MONATSENTGELT, T01_SATZ),
                },
              ],
            },
            {
              typ: 'BV',
              betragCent: bvBasis,
              positionen: [
                {
                  typ: 'V01',
                  prozentsatz: BV_SATZ,
                  betragCent: ctx.elda.berechneBeitragCent(bvBasis, BV_SATZ),
                },
              ],
            },
          ],
        };
      }
      return {
        referenzwert: refw,
        versicherungsnummer: person.vsnr,
        familienname: person.familienname,
        vorname: person.vorname,
        verrechnungsgrundlage: folgemonat
          ? ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT
          : ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
        tarifbloecke: [tarifblock],
      };
    });
    const paketref = ctx.referenzwert(id);
    const saetze = ctx.elda.erstelleMbgmPaket(eintraege, {
      verfahren: 'selbstabrechnung',
      paketreferenzwert: paketref,
      beitragskontonummer: konto.bknr,
      dienstgebername: ctx.dienstgeber('B').name,
      beitragszeitraum: `${bzr.slice(5, 7)}${bzr.slice(0, 4)}`,
      jaehrlicheAbrechnungGeringfuegiger: false,
    });
    const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
    if (befunde.length > 0) {
      throw new Error(`mBGM-Paket ${id} hat Befunde: ${JSON.stringify(befunde).slice(0, 500)}`);
    }
    return {
      inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'B', traeger: '15' })),
      dateiName: ctx.dateiName(id),
      referenzwerte: [paketref, ...referenzwerte],
    };
  };
}

function a3Abmeldung(id, anm) {
  return (ctx) => {
    const ende = d(ctx, plusTage(ctx.zr, -1));
    return meldung(ctx, {
      fall: id,
      art: 'abmeldung',
      rolle: A1[anm].rolle,
      dg: 'B',
      traeger: '15',
      felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '03', BVEN: ende },
    });
  };
}

// --- erfundene Personen ohne VSNR --------------------------------------------

/** Anmeldung einer erfundenen Person nur mit Geburtsdatum (M3 ohne REFV, E.29.2 Seite 305). */
function anmeldungOhneVsnr(ctx, id, { FANA, VONA, GEBD }) {
  const konto = ctx.konto('B', { traeger: '15' });
  const refw = ctx.referenzwert(id);
  const satz = ctx.elda.anmeldung({
    REFW: refw,
    BKNR: konto.bknr,
    DGNA: ctx.dienstgeber('B').name,
    GEBD,
    FANA,
    VONA,
    ADAT: d(ctx, ctx.zr),
    BBER: '02',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: VOLLZEIT(ctx),
  });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg: 'B', traeger: '15' })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [refw],
  };
}

// --- Negativfälle: gültige Anmeldung bauen, dann ein Feld verfälschen ------------

function freierDnAnmeldungA14(ctx, id) {
  return meldung(ctx, {
    fall: id,
    art: 'anmeldung',
    rolle: 'freier_dn',
    dg: 'A',
    traeger: '14',
    felder: { ADAT: d(ctx, ctx.zr), BBER: '01', GERF: 'N', FRDV: 'N', VWAZ: VOLLZEIT(ctx) },
  });
}

function freierDnAbmeldungA14(ctx, id, felder = {}) {
  const ende = d(ctx, plusTage(ctx.zr, -1));
  return meldung(ctx, {
    fall: id,
    art: 'abmeldung',
    rolle: 'freier_dn',
    dg: 'A',
    traeger: '14',
    felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '01', BVEN: ende, ...felder },
  });
}

function verfaelscht(b, felder) {
  let inhalt = b.inhalt;
  for (const [name, wert] of Object.entries(felder)) inhalt = setzeFeld(inhalt, 2, feldE29(name), wert);
  return { ...b, inhalt };
}

module.exports = [
  // --- A1 ---------------------------------------------------------------------
  fall({
    id: 'V40',
    titel: 'A1a: Anmeldung Eintritt am 07., BVAB = Eintritt + 1 Monat (M3)',
    zweck:
      'Variante a der BV-Probe: Beginn der BV einen Monat nach dem Eintritt, wie im DM-Org-Beispiel. ' +
      'Folgen: M40/M41 (mBGM ohne/mit BV), V44 (Abmeldung mit BVEN).',
    quelle: A1_QUELLE,
    erwartung: 'übernommen; zur mBGM des Folgemonats kein BW1871/BW1879',
    fenster: MO_NM,
    baue: a1Anmeldung('V40'),
  }),
  fall({
    id: 'V41',
    titel: 'A1b: Anmeldung Eintritt am 07., ohne BVAB (M3)',
    zweck: 'Variante b: kein BVAB (so wie kasseneck und die bisherigen SIT-Fälle anmelden).',
    quelle: A1_QUELLE,
    erwartung: 'übernommen; offen, ob zur mBGM des Folgemonats BW1871/BW1879 kommt',
    fenster: MO_NM,
    baue: a1Anmeldung('V41'),
  }),
  fall({
    id: 'V42',
    titel: 'A1c: Anmeldung Eintritt am 07., BVAB = Eintrittstag (M3)',
    zweck: 'Variante c (Gegenprobe): BV ab dem ersten Tag, obwohl kein Wiedereintritt vorliegt.',
    quelle: A1_QUELLE,
    erwartung: 'übernommen; Hinweis oder Clearing zur BV möglich',
    fenster: MO_NM,
    baue: a1Anmeldung('V42'),
  }),
  fall({
    id: 'M40',
    titel: 'mBGM 02/2025 (Eintrittsmonat, ohne BV) für die drei A1-Personen (Paket-Weg)',
    zweck:
      'Eintrittsmonat: SV ab dem 07. (Beginn der Verrechnung 07), keine BV-Verrechnung, VERG 2. ' +
      'Gebaut direkt mit dem Paket, Beiträge mit berechneBeitragCent.',
    quelle: 'E.32; D.54 (Matrix); D.63 VVON; § 6 Abs 1 BMSVG',
    erwartung: 'übernommen; BW1850 möglich (T01-Satz für 2025 unbelegt)',
    fenster: DI_VM,
    abhaengig: ['V40', 'V41', 'V42'],
    baue: a1Mbgm('M40', { folgemonat: false }),
  }),
  fall({
    id: 'M41',
    titel: 'mBGM 03/2025 (Folgemonat, mit BV) für die drei A1-Personen (Paket-Weg)',
    zweck:
      'Folgemonat: Beginn der Verrechnung 01, BV-Basis = Entgelt/30 × Resttage ab dem 07., VERG 1. ' +
      'Die Kernfrage von A1: Kommt je nach BVAB-Variante BW1871/BW1879?',
    quelle: 'E.32; D.54; ÖGK-FAK BMSVG 3.4 (Resttagezählung, wie kasseneck); § 6 Abs 1 BMSVG',
    erwartung: 'übernommen; Clearing je Variante beobachten (BW1871/BW1879)',
    fenster: DI_NM,
    abhaengig: ['M40'],
    baue: a1Mbgm('M41', { folgemonat: true }),
  }),
  // --- A2 ---------------------------------------------------------------------
  fall({
    id: 'V43',
    titel: 'A2: Richtigstellung Anmeldung A1a, nur Wochenstunden (15 h 40 min), BVAB mitgeschickt (M8)',
    zweck:
      'BVAB bleibt in der Richtigstellung belegt – ein leeres BVAB storniert laut DM-Org die BV-Zeit. ' +
      'Zugleich B6: 15 h 40 min ergibt VWAZ 1567 (Rundung an der Grenze).',
    quelle:
      'E.29.2 Seite 312/313 („Wenn das Feld BVAB bei der Richtigstellung unbelegt bleibt, wird die Zeit der BV storniert“); E.29.2 Seite 305 (15 h 40 min = 1567)',
    erwartung: 'übernommen; BV-Zeit bleibt (M41 ohne BW1871)',
    fenster: DI_VM,
    abhaengig: ['V40'],
    baue: (ctx) => {
      const beginn = d(ctx, eintritt(ctx.zrVon('V40')));
      return meldung(ctx, {
        fall: 'V43',
        art: 'richtigstellungAnmeldung',
        rolle: 'arbeiter',
        dg: 'B',
        traeger: '15',
        felder: {
          REFU: ctx.referenzwertVon('V40'),
          ADAT: beginn,
          RDAT: beginn,
          VWAZ: ctx.elda.wochenarbeitszeit(15, 40),
          BVAB: d(ctx, monatSpaeter(eintritt(ctx.zrVon('V40')))),
        },
      });
    },
  }),
  // --- A3 ---------------------------------------------------------------------
  fall({
    id: 'V44',
    titel: 'A3a: Abmeldung A1a nach zwei mBGM, mit BVEN (M4)',
    zweck: 'Saubere BV-Kette: Anmeldung, mBGM ohne und mit BV, dann Abmeldung mit BV-Ende.',
    quelle: 'E.29.2 (M4), D.22; SIT-Befunde B008/VW1942',
    erwartung: 'übernommen; kein VW1942',
    fenster: DI_NM,
    abhaengig: ['M41'],
    rang: 25,
    baue: a3Abmeldung('V44', 'V40'),
  }),
  fall({
    id: 'V45',
    titel: 'A3b: Abmeldung A1b (ohne BVAB) nach zwei mBGM, mit BVEN (M4)',
    zweck: 'Wie V44, Variante ohne BVAB.',
    quelle: 'E.29.2 (M4), D.22; SIT-Befunde B008/VW1942',
    erwartung: 'übernommen; VW1942 möglich, wenn ohne BVAB keine BV-Zeit entstand',
    fenster: DI_NM,
    abhaengig: ['M41'],
    rang: 25,
    baue: a3Abmeldung('V45', 'V41'),
  }),
  fall({
    id: 'V46',
    titel: 'A3c: Abmeldung A1c (BVAB = Eintritt) nach zwei mBGM, mit BVEN (M4)',
    zweck: 'Wie V44, Variante BVAB = Eintrittstag.',
    quelle: 'E.29.2 (M4), D.22',
    erwartung: 'übernommen',
    fenster: DI_NM,
    abhaengig: ['M41'],
    rang: 25,
    baue: a3Abmeldung('V46', 'V42'),
  }),
  // --- A4: weitere Abmeldegründe -------------------------------------------------
  fall({
    id: 'V47',
    titel: 'A4: Abmeldung mit Abmeldegrund 00 und Text (M4)',
    zweck: 'Code 00 „sonstiger Grund mit Ende des Beschäftigungsverhältnisses“, Text in SAGR.',
    quelle: 'D.22 Seite 94/95 (Code 00 nur mit SAGR)',
    erwartung: 'übernommen; VW1942 möglich (keine mBGM für diese Person)',
    fenster: DI_VM,
    abhaengig: ['B03'],
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'V47',
        art: 'abmeldung',
        rolle: 'reserve_1',
        dg: 'B',
        traeger: '15',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '00', SAGR: 'Tod des Dienstgebers', BVEN: ende },
      });
    },
  }),
  fall({
    id: 'V48',
    titel: 'A4: Abmeldung mit Abmeldegrund 16 Pensionierung (M4)',
    zweck:
      'Code 16 bei einer Person, die nach den Testdaten noch weit vom Pensionsalter ist – prüft ELDA das?',
    quelle: 'D.22 Seite 94 (Code 16)',
    erwartung: 'übernommen oder Clearing zur Plausibilität',
    fenster: DI_VM,
    abhaengig: ['B12'],
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'V48',
        art: 'abmeldung',
        rolle: 'reserve_3',
        dg: 'B',
        traeger: '15',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '16', BVEN: ende },
      });
    },
  }),
  fall({
    id: 'V49',
    titel: 'A4: Abmeldung mit Abmeldegrund 22 unberechtigter vorzeitiger Austritt (M4)',
    zweck: 'Code 22, den kasseneck für einen unberechtigten Austritt erzeugt.',
    quelle: 'D.22 Seite 94 (Code 22)',
    erwartung: 'übernommen',
    fenster: DI_VM,
    abhaengig: ['B11'],
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'V49',
        art: 'abmeldung',
        rolle: 'reserve_2',
        dg: 'B',
        traeger: '15',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '22', BVEN: ende },
      });
    },
  }),
  fall({
    id: 'V50',
    titel: 'A4: Abmeldung mit Abmeldegrund 34 Lösung in der Probezeit durch den Dienstnehmer (M4)',
    zweck: 'Code 34 direkt in einer Abmeldung (bisher nur über die Richtigstellung V19).',
    quelle: 'D.22 Seite 94/95 (Code 34 bei M4/M9)',
    erwartung: 'übernommen',
    fenster: DI_VM,
    abhaengig: ['V04'],
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'V50',
        art: 'abmeldung',
        rolle: 'angestelltenlehrling',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '34', BVEN: ende },
      });
    },
  }),
  // --- B7: Wiedereintritt ---------------------------------------------------------
  fall({
    id: 'V51',
    titel: 'B7: Wiedereintritt binnen 12 Monaten, BV ab dem Eintrittstag (M3)',
    zweck:
      'Dieselbe Person wie V15 beim selben Konto, einen Monat nach dem Ende. Bei Wiedereintritt binnen ' +
      '12 Monaten entfällt der beitragsfreie Monat – BVAB = Eintrittstag.',
    quelle: '§ 6 Abs 1 BMSVG; E.29.2 Seite 310/311 (BVAB)',
    erwartung: 'übernommen',
    fenster: DI_NM,
    abhaengig: ['V15'],
    baue: (ctx) => {
      const ein = d(ctx, ctx.zr);
      return meldung(ctx, {
        fall: 'V51',
        art: 'anmeldung',
        rolle: 'arbeiterlehrling',
        dg: 'A',
        traeger: '14',
        felder: { ADAT: ein, BBER: '03', GERF: 'N', FRDV: 'N', VWAZ: VOLLZEIT(ctx), BVAB: ein },
      });
    },
  }),
  // --- B8/B9: Zeichen in Namen ----------------------------------------------------
  fall({
    id: 'V52',
    titel: 'B8: Anmeldung einer erfundenen Person mit ß und ö im Namen, ohne VSNR (M3)',
    zweck: 'Umlaut und ß stehen im Zeichenvorrat für Personennamen; geht das durch?',
    quelle: 'Zeichensatz-Dokument (Personennamen, ISO-8859-15); E.29.2 Seite 305 (M3 mit GEBD ohne VSNR)',
    erwartung: 'übernommen',
    fenster: MO_NM,
    baue: (ctx) => anmeldungOhneVsnr(ctx, 'V52', { FANA: 'Weißenböck', VONA: 'Livia', GEBD: '19081996' }),
  }),
  fall({
    id: 'V53',
    titel: 'B9: Name mit é am Builder vorbei (M3)',
    zweck:
      'Das Paket sperrt é im Personennamen. Was sagt ELDA (F7036/F7038 oder nichts)? Zeigt, ob die Sperre zu streng ist.',
    quelle: 'Zeichensatz-Dokument; Prüfkatalog Blatt VR (F7036, F7038)',
    erwartung: 'F7036/F7038 (Warnung oder Abweisung) – oder übernommen',
    fenster: MO_NM,
    baue: (ctx) =>
      verfaelscht(anmeldungOhneVsnr(ctx, 'V53', { FANA: 'Lindmayr', VONA: 'Renee', GEBD: '03051997' }), {
        VONA: 'Renée',
      }),
  }),
  fall({
    id: 'V54',
    titel: 'B9: Name mit ş als UTF-8-Bytes am Builder vorbei (M3)',
    zweck:
      'ş gibt es in ISO-8859-15 nicht; ein Programm, das UTF-8 schickt, erzeugt die Bytes C5 9F. Wie reagiert ELDA?',
    quelle: 'Zeichensatz-Dokument; Prüfkatalog Blatt VR (F7036, F7038)',
    erwartung: 'F7036/F7038 oder Abweisung',
    fenster: MO_NM,
    baue: (ctx) =>
      verfaelscht(anmeldungOhneVsnr(ctx, 'V54', { FANA: 'Grabner', VONA: 'Ayse', GEBD: '11121995' }), {
        VONA: 'AyÅ\u009fe',
      }),
  }),
  // --- C1: geringfügig → vollversichert ----------------------------------------------
  fall({
    id: 'V55',
    titel: 'C1: Anmeldung geringfügig (M3)',
    zweck: 'Vorlauf für V56.',
    quelle: 'E.29, Feld GERF',
    erwartung: 'übernommen',
    fenster: MO_NM,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V55',
        art: 'anmeldung',
        rolle: 'geringfuegig',
        dg: 'B',
        traeger: '15',
        felder: {
          ADAT: d(ctx, ctx.zr),
          BBER: '01',
          GERF: 'J',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(10, 0),
        },
      }),
  }),
  fall({
    id: 'V56',
    titel: 'C1: Änderungsmeldung geringfügig → vollversichert zum Monatsersten (M6)',
    zweck: 'M6 mit GERF N ab dem simulierten Monatsersten.',
    quelle: 'E.29.2 (M6), Beispiel Seite 309',
    erwartung: 'übernommen',
    fenster: DI_VM,
    abhaengig: ['V55'],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V56',
        art: 'aenderungsmeldung',
        rolle: 'geringfuegig',
        dg: 'B',
        traeger: '15',
        felder: { ADAT: d(ctx, ctx.zr), BBER: '01', GERF: 'N', FRDV: 'N' },
      }),
  }),
  // --- C3: Richtigstellung mit verschobenem Beginn --------------------------------------
  fall({
    id: 'V57',
    titel: 'C3: Anmeldung zum Monatsersten (M3)',
    zweck: 'Vorlauf für V58.',
    quelle: 'E.29.2 (M3)',
    erwartung: 'übernommen',
    fenster: MO_NM,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V57',
        art: 'anmeldung',
        rolle: 'angestelltenlehrling',
        dg: 'B',
        traeger: '15',
        felder: { ADAT: d(ctx, ctx.zr), BBER: '02', GERF: 'N', FRDV: 'N', VWAZ: VOLLZEIT(ctx) },
      }),
  }),
  fall({
    id: 'V58',
    titel: 'C3: Richtigstellung Anmeldung, Beginn zwei Tage später (M8)',
    zweck: 'ADAT = ursprüngliches Datum, RDAT = richtiges Datum (E.29.2 Seite 312).',
    quelle: 'E.29.2 Seite 312/313 (Fall 2)',
    erwartung: 'übernommen',
    fenster: DI_VM,
    abhaengig: ['V57'],
    baue: (ctx) => {
      const alt = ctx.zrVon('V57');
      return meldung(ctx, {
        fall: 'V58',
        art: 'richtigstellungAnmeldung',
        rolle: 'angestelltenlehrling',
        dg: 'B',
        traeger: '15',
        felder: {
          REFU: ctx.referenzwertVon('V57'),
          ADAT: d(ctx, alt),
          RDAT: d(ctx, plusTage(alt, 2)),
          VWAZ: VOLLZEIT(ctx),
        },
      });
    },
  }),
  // --- C4: neue Anmeldung nach Storno ----------------------------------------------------
  fall({
    id: 'V59',
    titel: 'C4: Neue Anmeldung derselben Person nach Storno der ersten (M3)',
    zweck: 'Nach V11 (Storno von V05) dieselbe Person neu anmelden, mit neuem Referenzwert.',
    quelle: 'E.29.1 (S3, M3), D.43',
    erwartung: 'übernommen',
    fenster: DI_NM,
    abhaengig: ['V11'],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V59',
        art: 'anmeldung',
        rolle: 'geringfuegig',
        dg: 'A',
        traeger: '14',
        felder: {
          ADAT: d(ctx, ctx.zr),
          BBER: '01',
          GERF: 'J',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(10, 0),
        },
      }),
  }),
  // --- D4/E: Negativfälle ----------------------------------------------------------------
  fall({
    id: 'V60',
    titel: 'D4: Anmeldung mit nicht vorhandener Beitragskontonummer (M3)',
    zweck: 'Absichtlich abgewiesene Datei: Kommt nicht_uebernommen mit einem Grund, den man anzeigen kann?',
    quelle: 'Prüfkatalog Blatt VR (BKNR); elda_mitteilung-3.0.xsd',
    erwartung: 'nicht_uebernommen mit Fehlercode',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAnmeldungA14(ctx, 'V60'), { BKNR: '9999999' }),
  }),
  fall({
    id: 'V34',
    titel: 'E1: Doppelanmeldung derselben Person beim selben Dienstgeber (M3)',
    zweck: 'Zweite Anmeldung zu V06 auf demselben Konto. Abweisung oder Clearing?',
    quelle: 'E.29.2 (M3)',
    erwartung: 'Abweisung oder Clearing',
    fenster: MO_NM,
    abhaengig: ['V06'],
    rang: 15,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V34',
        art: 'anmeldung',
        rolle: 'freier_dn',
        dg: 'B',
        traeger: '15',
        freieDN: true,
        felder: { ADAT: d(ctx, ctx.zr), BBER: '02', GERF: 'N', FRDV: 'J' },
      }),
  }),
  fall({
    id: 'V35',
    titel: 'E2: Abmeldung ohne vorherige Anmeldung (M4)',
    zweck: 'Die Person war bei diesem Konto nie angemeldet.',
    quelle: 'E.29.2 (M4)',
    erwartung: 'Clearing oder Abweisung',
    fenster: MO_NM,
    baue: (ctx) => freierDnAbmeldungA14(ctx, 'V35'),
  }),
  fall({
    id: 'V36',
    titel: 'E3: Storno auf einen Referenzwert, den es nicht gibt (S3)',
    zweck: 'REFU zeigt ins Leere.',
    quelle: 'E.29.1 (S3), D.44',
    erwartung: 'Clearing oder Abweisung',
    fenster: MO_NM,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V36',
        art: 'stornoAnmeldung',
        rolle: 'freier_dn',
        dg: 'A',
        traeger: '14',
        felder: { REFU: 'SIT-V36-GIBT-ES-NICHT', ADAT: d(ctx, ctx.zr) },
      }),
  }),
  fall({
    id: 'V33',
    titel: 'E4: Verspätete Anmeldung, Beginn einen Monat vor dem simulierten Datum (M3)',
    zweck: 'Meldefrist (vor Arbeitsantritt) deutlich verfehlt. Meldeverstoß als Clearing?',
    quelle: 'E.29.2 (M3); § 33 ASVG',
    erwartung: 'übernommen, Clearing zum Meldeverstoß möglich',
    fenster: ['mi-vm'],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V33',
        art: 'anmeldung',
        rolle: 'reserve_2',
        dg: 'A',
        traeger: '15',
        felder: {
          ADAT: d(ctx, plusTage(ctx.zr, -30)),
          BBER: '01',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: VOLLZEIT(ctx),
        },
      }),
  }),
  // --- E5: lokale Prüfregeln am Builder vorbei ---------------------------------------------
  fall({
    id: 'V61',
    titel: 'E5: ungültiges Anmeldedatum 31.02. (F7061)',
    zweck: 'Bestätigt, dass ELDA denselben Code vergibt wie das Paket.',
    quelle: 'Prüfkatalog Blatt VR (F7061)',
    erwartung: 'F7061, Abweisung',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAnmeldungA14(ctx, 'V61'), { ADAT: '31022025' }),
  }),
  fall({
    id: 'V62',
    titel: 'E5: Anmeldedatum vor 2019 (F7062)',
    zweck: 'Bestätigt den Code für ein Datum vor dem 01.01.2019.',
    quelle: 'Prüfkatalog Blatt VR (F7062)',
    erwartung: 'F7062, Abweisung',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAnmeldungA14(ctx, 'V62'), { ADAT: '01012018' }),
  }),
  fall({
    id: 'V63',
    titel: 'E5: Beschäftigungsbereich 99 (F7069)',
    zweck: 'Bestätigt den Code für einen BBER außerhalb von D.39.',
    quelle: 'Prüfkatalog Blatt VR (F7069); D.39',
    erwartung: 'F7069, Abweisung',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAnmeldungA14(ctx, 'V63'), { BBER: '99' }),
  }),
  fall({
    id: 'V64',
    titel: 'E5: Wochenarbeitszeit leer bei der Anmeldung (F7115)',
    zweck: 'Seit 01.01.2026 Pflicht – prüft der SIT sie im simulierten 2025?',
    quelle: 'Prüfkatalog Blatt VR (F7115)',
    erwartung: 'F7115 oder übernommen (2025 simuliert)',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAnmeldungA14(ctx, 'V64'), { VWAZ: '0000' }),
  }),
  fall({
    id: 'V65',
    titel: 'E5: Abmeldegrund 26, den es nicht gibt (F7096)',
    zweck: 'Bestätigt den Code für einen AGRD außerhalb von D.22.',
    quelle: 'Prüfkatalog Blatt VR (F7096); D.22 Seite 94',
    erwartung: 'F7096, Abweisung',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAbmeldungA14(ctx, 'V65'), { AGRD: '26' }),
  }),
  fall({
    id: 'V66',
    titel: 'E5: Ende des Beschäftigungsverhältnisses bei Karenz (F7111)',
    zweck: 'AGRD 07 (Karenz) verlangt ein leeres EBSV.',
    quelle: 'Prüfkatalog Blatt VR (F7111); D.22 Seite 96',
    erwartung: 'F7111, Abweisung',
    fenster: MO_NM,
    baue: (ctx) => verfaelscht(freierDnAbmeldungA14(ctx, 'V66'), { AGRD: '07' }),
  }),
];
