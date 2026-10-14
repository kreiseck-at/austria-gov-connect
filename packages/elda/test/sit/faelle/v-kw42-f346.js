'use strict';

// Folgefragen kasseneck (Stand Mi 14.10.2026 vormittags), Fenster mi-vm (sim. 01.04.2026):
//
// F3 – Anmeldung ohne BVAB nachträglich heilen (danach mBGM mit BV, kommt BW1871 noch?)
//   V95  M8 zu V41 (angestellte, B/15, Eintritt 07.02.2025, ohne BVAB), nur BVAB = 07.03.2025 nachgetragen,
//        MIT REFU = Referenzwert von V41.
//   V96  M8 zur B03-Anmeldung (reserve_1, B/15, Eintritt 01.01.2025, ohne BVAB), BVAB = 01.02.2025,
//        OHNE REFU (am Builder vorbei geleert – die Pflichtmatrix E.29.1 führt REFU bei M8 als „Z“).
//   M93  mBGM 04/2025 auf B/15 für beide Personen mit BV (Paket-Weg wie M41).
//   Beide Dienstverhältnisse laufen noch: ihre Abmeldungen V45/V47 kamen mit VW1942 und
//   wurden nicht verarbeitet.
//
// F4 – nicht verarbeitete Abmeldung reparieren
//   V97  arbeiterlehrling A/14 (V15 mit VW1942 nicht verarbeitet): neue Abmeldung M4 ohne BVEN,
//        Ende und Grund wie V15 (AGRD 30).
//   V98  angestelltenlehrling A/14 (V50 mit VW1942 nicht verarbeitet): zuerst Storno S4 auf V50,
//   V99  danach M4 ohne BVEN, Ende und Grund wie V50 (AGRD 34).
//
// F6 – Abmeldegrund 21 über den kasseneck-Weg (Brücke Stand 8908f6b8)
//   K20  Anmeldung arbeiter auf A/14 über kasseneck (V01 dort am 31.03.2025 abgemeldet, V12 ohne
//        Clearing), Eintritt 02.02.2026 – verspätet zum sim. 01.04.2026 (bewusste Einschränkung).
//   K21  Abmeldung zum 31.03.2026 mit Beendigungsart dn_kuendigung_elternteilzeit → AGRD 21 aus der
//        AGRD-Tabelle von kasseneck (beendigung-core.AGRD, wie endabrechnung-core). Elternteilzeit
//        selbst ist am kasseneck-Mitarbeiter nicht hinterlegt: AGRD hängt allein an der Beendigungsart;
//        die Endabrechnung (Pflicht-Zugangsdatum, ARTEN_MIT_DATUM_PFLICHT) wird hier nicht durchlaufen.
//
// Gegenprobe F6 (Fenster mi-nm, sim. 01.05.2026):
//   K21 kam mit VW1942 zurück, K20 ohne Clearing. Der arbeiter hatte auf A/14 noch das Dienstverhältnis
//   aus V01 (01.01.2025, ohne BVAB) offen: V12 hatte es beendet, V20 hat V12 wieder storniert. Die
//   amtswegigen mBGM (BW1916) für A/14 laufen bis 02/2026 weiter. Vermutung: K20 wurde wegen des offenen
//   Dienstverhältnisses nicht gespeichert, K21 traf das alte ohne BV-Zeit.
//   V101 beendet das alte Dienstverhältnis zum 31.01.2026 (ohne BVEN – es hatte nie BV-Zeit), danach
//   K22/K23 = K20/K21 noch einmal über die kasseneck-Brücke.

const path = require('node:path');
const { meldung, setzeFeld } = require('../lib/bausteine');
const { kasseneckVr } = require('../lib/kasseneck');
const { plusTage } = require('../lib/fenster');
const { FELDER_E29 } = require('../../../dist/felder-e29.js');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const feldE29 = (name) => FELDER_E29.find((f) => f.name === name);
const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const MI_VM = ['mi-vm'];
const MI_NM = ['mi-nm'];

/** Eintritt + 1 Monat (§ 6 Abs 1 BMSVG). */
function monatSpaeter(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m, t)).toISOString().slice(0, 10);
}
const eintritt07 = (zr) => `${zr.slice(0, 8)}07`;

// --- F3 ----------------------------------------------------------------------------

const F3_QUELLE =
  'E.29.1 (M8: REFU „Z“, BVAB „Z1“), E.29.2 Seite 312/313 (BVAB in der Richtigstellung); SIT 13./14.10.2026 ' +
  '(BW1871/VW1942 ohne BVAB)';

const MONATSENTGELT = 300_000;
const T01_SATZ = 39.05;
const BV_SATZ = 1.53;

function mbgmEintrag(ctx, refw, rolle) {
  const p = ctx.rolle(rolle);
  return {
    referenzwert: refw,
    versicherungsnummer: p.vsnr,
    familienname: p.familienname,
    vorname: p.vorname,
    verrechnungsgrundlage: ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
    tarifbloecke: [
      {
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
            betragCent: MONATSENTGELT,
            positionen: [
              {
                typ: 'V01',
                prozentsatz: BV_SATZ,
                betragCent: ctx.elda.berechneBeitragCent(MONATSENTGELT, BV_SATZ),
              },
            ],
          },
        ],
      },
    ],
  };
}

// --- F6: kasseneck-Brücke ------------------------------------------------------------

const F6_EMPLOYEE = 'sitF6arb';
const F6_START = '2026-02-02';
const F6_ENDE = '2026-03-31';

function nutzerA14(ctx) {
  return {
    elda: { beitragskontonummer: ctx.konto('A', { traeger: '14' }).bknr },
    company_name: ctx.dienstgeber('A').name,
  };
}

function f6Mitarbeiter(ctx, mehr = {}) {
  const p = ctx.rolle('arbeiter');
  return {
    firstName: p.vorname,
    lastName: p.familienname,
    svnr: p.vsnr,
    startDate: F6_START,
    workerGroup: 'angestellter',
    employmentType: 'parttime',
    weeklyHours: 20,
    ...mehr,
  };
}

function kBestand(ctx, id, art, ergebnis, n) {
  const { vr, rueck } = kasseneckVr();
  if (ergebnis.fehlend && ergebnis.fehlend.length) {
    throw new Error(
      `${id}: kasseneck meldet fehlende Angaben: ${ergebnis.fehlend.map((f) => f.text).join(' | ')}`,
    );
  }
  if (ergebnis.sperre) throw new Error(`${id}: kasseneck sperrt: ${ergebnis.sperre.text}`);
  const befunde = vr.pruefeSatz(art, ergebnis.felder);
  if (befunde.length) throw new Error(`${id}: kasseneck-Prüfung: ${befunde.map((b) => b.text).join(' | ')}`);
  const referenzwert = rueck.referenzwertVr({
    tag: rueck.wienerTagKurz(Date.now()),
    employeeId: F6_EMPLOYEE,
    n,
  });
  const satz = vr.baueSatz(art, { ...ergebnis.felder, REFW: referenzwert });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg: 'A', traeger: '14' })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [referenzwert],
  };
}

/** AGRD-Tabelle von kasseneck (beendigung-core.AGRD), wie die Endabrechnung sie nutzt. */
function agrdVonKasseneck(art) {
  const wurzel = process.env.KASSENECK_VR_PFAD;
  const { AGRD } = require(path.join(wurzel, 'functions-lohn', 'beendigung-core'));
  return AGRD[art];
}

function f6Anmeldung(id, n) {
  return (ctx) => {
    const { vr } = kasseneckVr();
    return kBestand(
      ctx,
      id,
      'M3',
      vr.felderAnmeldung({ nutzer: nutzerA14(ctx), emp: f6Mitarbeiter(ctx), historie: [] }),
      n,
    );
  };
}

function f6Abmeldung(id, n) {
  return (ctx) => {
    const { vr } = kasseneckVr();
    const agrd = agrdVonKasseneck('dn_kuendigung_elternteilzeit');
    if (agrd !== '21')
      throw new Error(`${id}: kasseneck bildet Elternteilzeit-Kündigung auf ${agrd} ab, nicht 21.`);
    const n = nutzerA14(ctx);
    const angemeldet = vr.felderAnmeldung({ nutzer: n, emp: f6Mitarbeiter(ctx), historie: [] });
    const emp = f6Mitarbeiter(ctx, {
      endDate: F6_ENDE,
      beendigung: { art: 'dn_kuendigung_elternteilzeit' },
    });
    const bvab = vr.bvBeginnDesDv({
      dv: { angemeldet: { felder: angemeldet.felder } },
      nutzer: n,
      emp,
      historie: [],
    });
    const ergebnis = vr.felderAbmeldung({
      nutzer: n,
      emp,
      endabrechnung: {
        status: 'vollstaendig',
        elda: { EBSV: F6_ENDE, ADAT: F6_ENDE, BVEN: F6_ENDE, AGRD: agrd },
      },
      bvab,
    });
    if (ergebnis.felder.AGRD !== '21')
      throw new Error(`${id}: AGRD im Satz ist ${ergebnis.felder.AGRD}, nicht 21.`);
    return kBestand(ctx, id, 'M4', ergebnis, n);
  };
}

module.exports = [
  // --- F3 ------------------------------------------------------------------------------
  fall({
    id: 'V95',
    titel: 'F3a: Richtigstellung Anmeldung V41 – nur BVAB nachgetragen, mit REFU (M8)',
    zweck:
      'Heilt eine Anmeldung ohne BVAB die BV-Zeit nachträglich? V41 (ohne BVAB) bekam BW1871 zur mBGM 03/2025 ' +
      'und VW1942 zur Abmeldung V45. Danach M93 (mBGM 04/2025 mit BV).',
    quelle: F3_QUELLE,
    erwartung:
      'übernommen; danach M93 für diese Person ohne BW1871 – oder BW1871 bleibt (Heilung wirkt nicht)',
    fenster: MI_VM,
    abhaengig: ['V41'],
    rang: 40,
    baue: (ctx) => {
      const ein = eintritt07(ctx.zrVon('V41'));
      return meldung(ctx, {
        fall: 'V95',
        art: 'richtigstellungAnmeldung',
        rolle: 'angestellte',
        dg: 'B',
        traeger: '15',
        felder: {
          REFU: ctx.referenzwertVon('V41'),
          ADAT: d(ctx, ein),
          RDAT: d(ctx, ein),
          VWAZ: ctx.elda.wochenarbeitszeit(38, 30),
          BVAB: d(ctx, monatSpaeter(ein)),
        },
      });
    },
  }),
  fall({
    id: 'V96',
    titel: 'F3b: Richtigstellung der B03-Anmeldung – nur BVAB nachgetragen, OHNE REFU (M8)',
    zweck:
      'Wie bei einer Anmeldung, die nicht von uns kam: kein Referenzwert der Originalmeldung. Die Pflichtmatrix ' +
      'verlangt REFU bei M8 („Z“) – deshalb am Builder vorbei geleert. Wird die M8 abgewiesen oder über VSNR und ' +
      'Datum zugeordnet? Danach M93 mit BV für diese Person.',
    quelle: F3_QUELLE,
    erwartung:
      'Abweisung wegen fehlendem REFU (Pflichtfeld) – oder übernommen und BV-Zeit geheilt (M93 ohne BW1871)',
    fenster: MI_VM,
    abhaengig: ['B03'],
    rang: 40,
    baue: (ctx) => {
      const ein = ctx.zrVon('B03');
      const b = meldung(ctx, {
        fall: 'V96',
        art: 'richtigstellungAnmeldung',
        rolle: 'reserve_1',
        dg: 'B',
        traeger: '15',
        felder: {
          REFU: ctx.referenzwertVon('B03'),
          ADAT: d(ctx, ein),
          RDAT: d(ctx, ein),
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
          BVAB: d(ctx, monatSpaeter(ein)),
        },
      });
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, feldE29('REFU'), '') };
    },
  }),
  fall({
    id: 'M93',
    titel: 'F3: mBGM 04/2025 mit BV für die Personen aus V95 und V96 (B/15, Paket-Weg)',
    zweck:
      'Gegenprobe zur Heilung: Ohne BV-Zeit käme BW1871 (wie M41 für V41). Kommt es für eine der beiden ' +
      'Personen nicht mehr, hat die M8 mit BVAB die BV-Zeit nachträglich angelegt.',
    quelle: 'E.32; D.54 (VERG 1); SIT M41/M66 (BW1871 ohne BVAB); T01-Satz 2025 unbelegt (BW1850 möglich)',
    erwartung: 'übernommen; Clearing je Person: kein BW1871 = geheilt, BW1871 = nicht geheilt',
    fenster: MI_VM,
    abhaengig: ['V95', 'V96'],
    rang: 45,
    baue: (ctx) => {
      const konto = ctx.konto('B', { traeger: '15' });
      const refA = ctx.referenzwert('M93-1');
      const refB = ctx.referenzwert('M93-2');
      const paketref = ctx.referenzwert('M93');
      const saetze = ctx.elda.erstelleMbgmPaket(
        [mbgmEintrag(ctx, refA, 'angestellte'), mbgmEintrag(ctx, refB, 'reserve_1')],
        {
          verfahren: 'selbstabrechnung',
          paketreferenzwert: paketref,
          beitragskontonummer: konto.bknr,
          dienstgebername: ctx.dienstgeber('B').name,
          beitragszeitraum: '042025',
          jaehrlicheAbrechnungGeringfuegiger: false,
        },
      );
      const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
      if (befunde.length > 0) throw new Error(`M93 hat Befunde: ${JSON.stringify(befunde).slice(0, 300)}`);
      return {
        inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'B', traeger: '15' })),
        dateiName: ctx.dateiName('M93'),
        referenzwerte: [paketref, refA, refB],
      };
    },
  }),
  // --- F4 ------------------------------------------------------------------------------
  fall({
    id: 'V97',
    titel: 'F4a: neue Abmeldung (M4) ohne BVEN für die nicht verarbeitete Abmeldung V15',
    zweck:
      'V15 (Probezeit, AGRD 30, mit BVEN) kam mit VW1942 zurück und wurde nicht verarbeitet. Reicht eine neue ' +
      'M4 ohne BVEN, oder braucht es vorher einen Storno?',
    quelle: 'E.29.2 (M4), D.22; SIT V15 (VW1942), V19 (VW1560)',
    erwartung:
      'übernommen und verarbeitet (kein Clearing) – oder Clearing, dass eine Abmeldung schon vorliegt',
    fenster: MI_VM,
    abhaengig: ['V15'],
    rang: 40,
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zrVon('V15'), -1));
      return meldung(ctx, {
        fall: 'V97',
        art: 'abmeldung',
        rolle: 'arbeiterlehrling',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '30' },
      });
    },
  }),
  fall({
    id: 'V98',
    titel: 'F4b: Storno (S4) der nicht verarbeiteten Abmeldung V50',
    zweck: 'Erst Storno der mit VW1942 liegengebliebenen Abmeldung V50, danach V99 (neue M4 ohne BVEN).',
    quelle: 'E.29.1 (S4), E.29.2; SIT V50 (VW1942)',
    erwartung: 'übernommen – oder Clearing, weil die stornierte Abmeldung nie verarbeitet war',
    fenster: MI_VM,
    abhaengig: ['V50'],
    rang: 40,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V98',
        art: 'stornoAbmeldung',
        rolle: 'angestelltenlehrling',
        dg: 'A',
        traeger: '14',
        felder: { REFU: ctx.referenzwertVon('V50'), ADAT: d(ctx, plusTage(ctx.zrVon('V50'), -1)) },
      }),
  }),
  fall({
    id: 'V99',
    titel: 'F4b: neue Abmeldung (M4) ohne BVEN nach dem Storno V98',
    zweck:
      'Gegenstück zu V97: dieselbe Reparatur, aber mit vorherigem Storno der liegengebliebenen Abmeldung.',
    quelle: 'E.29.2 (M4), D.22 (AGRD 34)',
    erwartung: 'übernommen und verarbeitet (kein Clearing)',
    fenster: MI_VM,
    abhaengig: ['V50', 'V98'],
    rang: 41,
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zrVon('V50'), -1));
      return meldung(ctx, {
        fall: 'V99',
        art: 'abmeldung',
        rolle: 'angestelltenlehrling',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '34' },
      });
    },
  }),
  // --- F6 ------------------------------------------------------------------------------
  fall({
    id: 'K20',
    titel: 'F6: kasseneck-Anmeldung arbeiter auf A/14, Eintritt 02.02.2026 (M3)',
    zweck:
      'Vorlauf für K21. BVAB nach der kasseneck-Regel (Eintritt + 1 Monat). Verspätet zum sim. 01.04.2026.',
    quelle: 'kasseneck feature/elda-versichertenmeldung (8908f6b8): versichertenmeldung-core.felderAnmeldung',
    erwartung: 'übernommen',
    fenster: MI_VM,
    abhaengig: ['V12'],
    braucht: 'kasseneck-vr',
    rang: 40,
    baue: f6Anmeldung('K20', 1),
  }),
  fall({
    id: 'K21',
    titel: 'F6: kasseneck-Abmeldung „Kündigung durch DN während Elternteilzeit“ → AGRD 21 (M4)',
    zweck:
      'Seit 8908f6b8 bildet kasseneck dn_kuendigung_elternteilzeit auf AGRD 21 ab (vorher 02). Ende 31.03.2026 ' +
      'nach dem BV-Beginn 02.03.2026 → BVEN gesetzt.',
    quelle:
      'kasseneck 8908f6b8: beendigung-core.AGRD, versichertenmeldung-core.felderAbmeldung; D.22 (Code 21)',
    erwartung: 'übernommen, kein Clearing',
    fenster: MI_VM,
    abhaengig: ['K20'],
    braucht: 'kasseneck-vr',
    rang: 42,
    baue: f6Abmeldung('K21', 2),
  }),
  fall({
    id: 'V100',
    titel: 'F3c: Richtigstellung der B03-Anmeldung mit einem FREMDEN Referenzwert als REFU (M8)',
    zweck:
      'V96 (REFU leer) kam mit F7041 zurück. Bei einer Anmeldung, die nicht über uns lief, kennen wir den ' +
      'Referenzwert der Originalmeldung nicht. Reicht ein beliebiger REFU (Zuordnung über VSNR und Datum), oder ' +
      'muss er zur Originalmeldung passen? Danach zeigt M93 (BV 04/2025), ob die BV-Zeit geheilt ist.',
    quelle: F3_QUELLE,
    erwartung:
      'übernommen und Clearing ohne Zuordnungsfehler – oder ein VW-Code „kann keiner Anmeldung zugeordnet werden“',
    fenster: MI_VM,
    abhaengig: ['B03'],
    rang: 40,
    baue: (ctx) => {
      const ein = ctx.zrVon('B03');
      const b = meldung(ctx, {
        fall: 'V100',
        art: 'richtigstellungAnmeldung',
        rolle: 'reserve_1',
        dg: 'B',
        traeger: '15',
        felder: {
          REFU: 'FREMD-ANMELDUNG-UNBEKANNT',
          ADAT: d(ctx, ein),
          RDAT: d(ctx, ein),
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
          BVAB: d(ctx, monatSpaeter(ein)),
        },
      });
      return b;
    },
  }),
  // --- Gegenprobe F6 ----------------------------------------------------------------------
  fall({
    id: 'V101',
    titel:
      'F6-Gegenprobe: altes Dienstverhältnis des arbeiters auf A/14 zum 31.01.2026 beenden (M4, ohne BVEN)',
    zweck:
      'Das Dienstverhältnis aus V01 ist seit dem Storno V20 wieder offen. Erst wenn es beendet ist, kann K22 ' +
      'ein neues anlegen. Ohne BVEN, weil V01 ohne BVAB angemeldet war (sonst VW1942).',
    quelle: 'E.29.2 (M4), D.22 (Code 05); SIT V01, V12, V20, K20/K21 (VW1942), BW1916 bis 02/2026',
    erwartung: 'übernommen und verarbeitet (kein Clearing)',
    fenster: MI_NM,
    abhaengig: ['V20'],
    rang: 40,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V101',
        art: 'abmeldung',
        rolle: 'arbeiter',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: '31012026', EBSV: '31012026', AGRD: '05' },
      }),
  }),
  fall({
    id: 'K22',
    titel: 'F6-Gegenprobe: kasseneck-Anmeldung arbeiter auf A/14, Eintritt 02.02.2026 (wie K20)',
    zweck:
      'Wie K20, jetzt nach V101. Kommt zu K23 kein VW1942, hat das offene alte Dienstverhältnis K20 verschluckt.',
    quelle: 'wie K20; SIT K20/K21',
    erwartung: 'übernommen',
    fenster: MI_NM,
    abhaengig: ['V101'],
    braucht: 'kasseneck-vr',
    rang: 41,
    baue: f6Anmeldung('K22', 3),
  }),
  fall({
    id: 'K23',
    titel: 'F6-Gegenprobe: kasseneck-Abmeldung AGRD 21 zum 31.03.2026 mit BVEN (wie K21)',
    zweck: 'Wie K21. Kein VW1942 → AGRD 21 und BVEN aus kasseneck werden verarbeitet.',
    quelle: 'wie K21',
    erwartung: 'übernommen, kein Clearing',
    fenster: MI_NM,
    abhaengig: ['K22'],
    braucht: 'kasseneck-vr',
    rang: 42,
    baue: f6Abmeldung('K23', 4),
  }),
];
