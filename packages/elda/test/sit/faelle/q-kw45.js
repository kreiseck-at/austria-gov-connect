'use strict';

// Q – Fragen für KW45 (Zeitreise 2026/27, DM-Org 43.1.0, TASY 2026-03-24).
//
// Die Zeitreise läuft jetzt durch 2026: Mo 07–09 = 01.01.2026, Mo 12–14 = 01.02.,
// Di 07–09 = 01.03., Di 12–14 = 01.04.2026; Mi 07–09 = 01.04.2027, Mi 12–14 =
// 01.05.2027 (danach keine Sammelverarbeitung mehr). Jede Sammelverarbeitung
// rechnet den Beitragszeitraum vor ihrem Monat ab (SIT-Portal, „Rahmenbedingungen
// für Zeitreisesupport“). Damit lassen sich Ketten über vier Monate bauen, die
// in KW41/42 nicht in eine Woche passten.
//
// Montag 07–09 legt nur die Anmeldungen an, auf denen die Ketten der Woche
// aufbauen (Eintritt am simulierten Tag 01.01.2026, BV ab 01.02.2026, wo es
// verlangt ist; Q36 15.01.2026). Die Folgeschritte kommen als eigene Fälle dazu, sobald die
// Rückmeldungen des Vorschritts gelesen sind – sie hängen von ihnen ab.
//
// Personen (je Beitragskonto höchstens ein offenes Dienstverhältnis; die übrigen
// Konten der Rollen belegen D01 und die Negativtests):
//   Q30 reserve_1   B/15  ohne BVAB      Q10: BV-Zeit nachtragen, BW2032, mBGM-Berichtigung
//   Q31 reserve_2   A/15  ohne BVAB      Q07: VW1942 → neue Abmeldung über kasseneck
//   Q32 reserve_3   A/15  ohne BVAB      Q14: VW1942 → rechtlich richtig (M8 mit BVAB + mBGM-Berichtigung)
//   Q33 angestellte B/15  BVAB 01.02.    Q15/B7: Wiedereintritt binnen 12 Monaten, BV ab dem ersten Tag
//   Q34 angestellte A/14  BVAB 01.02.    Q16: mBGM nur SV (VERG 2) nach dem BV-Beginn → BW2032?
//   Q35 arbeiter    A/15  BVAB 01.02.    Q17: mBGM bleibt aus → BW1930/BW1916, dann die echte mBGM
//   Q36 geringfuegig A/15 Beginn 15.12.2025, ohne VWAZ   Q20: F7115 bei M6/M8 zu einem DV aus 2025
//   Q37 arbeiter    B/15  über kasseneck F6-Gegenprobe: später Abmeldung AGRD 21 mit BVEN
//
// Geplante Folgeschritte (Stand Mo 02.11.2026, je nach Rückmeldung):
//   Mo 12–14 (01.02.): mBGM 01/2026 für alle (Q35 bewusst nicht), Q33 Abmeldung zum 31.01.
//   Di 07–09 (01.03.): Q30 mBGM 02 ohne BV + M8 mit BVAB; Q31/Q32 Abmeldung zum 28.02. mit BVEN
//                      (→ VW1942); Q34 mBGM 02 nur SV; Q33 Wiedereintritt 01.03. mit BVAB = Eintritt;
//                      Q36 M8/M6 ohne VWAZ; Q37 Abmeldung AGRD 21 über kasseneck
//   Di 12–14 (01.04.): Q30 mBGM-Berichtigung 02 mit BV; Q31 neue M4 ohne BVEN über kasseneck (Q07);
//                      Q32 M8 mit BVAB + mBGM-Berichtigung (Q14); Q35 echte mBGM 01 nach BW1916 (Q17);
//                      Q33 mBGM 03 mit BV ab dem ersten Tag (B7)
//   Mi 07–09 (01.04.2027): Clearing der Apr-2026-Verarbeitung lesen; F5 (A25–A27) über das Paket

const { meldung, setzeFeld } = require('../lib/bausteine');
const { FELDER_E29 } = require('../../../dist/felder-e29.js');
const { plusTage } = require('../lib/fenster');
const { kasseneckVr } = require('../lib/kasseneck');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const MO_VM = ['mo-vm'];
const QUELLE_ZR = 'SIT-Portal LOHNSOFTWAREHERSTELLER: Testkalender 2026/27, Rahmenbedingungen Zeitreise';

/** Derselbe Tag einen Monat später (JJJJ-MM-TT) – die BVAB-Regel von kasseneck (Eintritt + 1 Monat). */
function einMonatSpaeter(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  const ziel = new Date(Date.UTC(j, m, t));
  // 31.01. + 1 Monat = 28./29.02., nicht 03.03.
  if (ziel.getUTCMonth() !== m % 12) return new Date(Date.UTC(j, m + 1, 0)).toISOString().slice(0, 10);
  return ziel.toISOString().slice(0, 10);
}

/**
 * Anmeldung (M3) am simulierten Tag. `bvab`: 'folgemonat' (Eintritt + 1 Monat, die
 * Regel von kasseneck), 'eintritt' oder null (ohne BVAB, wie eine Anmeldung aus
 * einem Programm, das die BV-Zeit nicht meldet).
 */
function anmeldung(id, { rolle, dg, traeger, bber = '01', gerf = 'N', bvab, stunden = 40, adat }) {
  return (ctx) => {
    const ein = adat ?? ctx.zr;
    const bv = bvab === 'folgemonat' ? einMonatSpaeter(ein) : bvab === 'eintritt' ? ein : null;
    return meldung(ctx, {
      fall: id,
      art: 'anmeldung',
      rolle,
      dg,
      traeger,
      felder: {
        ADAT: d(ctx, ein),
        BBER: bber,
        GERF: gerf,
        FRDV: 'N',
        ...(stunden === null ? {} : { VWAZ: ctx.elda.wochenarbeitszeit(stunden, 0) }),
        ...(bv ? { BVAB: d(ctx, bv) } : {}),
      },
    });
  };
}

// --- Q37: Anmeldung über kasseneck (neuer Stand feature/elda-versichertenmeldung) ----

const Q37_EMPLOYEE = 'sitQ37arb';

function q37Nutzer(ctx) {
  return {
    elda: { beitragskontonummer: ctx.konto('B', { traeger: '15' }).bknr },
    company_name: ctx.dienstgeber('B').name,
  };
}

function q37Mitarbeiter(ctx, mehr = {}) {
  const p = ctx.rolle('arbeiter');
  return {
    firstName: p.vorname,
    lastName: p.familienname,
    svnr: p.vsnr,
    startDate: ctx.zr,
    workerGroup: 'arbeiter',
    employmentType: 'fulltime',
    weeklyHours: 40,
    ...mehr,
  };
}

function q37Anmeldung(ctx) {
  const { vr, rueck } = kasseneckVr();
  const ergebnis = vr.felderAnmeldung({ nutzer: q37Nutzer(ctx), emp: q37Mitarbeiter(ctx), historie: [] });
  if (ergebnis.fehlend?.length)
    throw new Error(
      `Q37: kasseneck meldet fehlende Angaben: ${ergebnis.fehlend.map((f) => f.text).join(' | ')}`,
    );
  if (ergebnis.sperre) throw new Error(`Q37: kasseneck sperrt: ${ergebnis.sperre.text}`);
  const befunde = vr.pruefeSatz('M3', ergebnis.felder);
  if (befunde.length) throw new Error(`Q37: kasseneck-Prüfung: ${befunde.map((b) => b.text).join(' | ')}`);
  const referenzwert = rueck.referenzwertVr({
    tag: rueck.wienerTagKurz(Date.now()),
    employeeId: Q37_EMPLOYEE,
    n: 1,
  });
  const satz = vr.baueSatz('M3', { ...ergebnis.felder, REFW: referenzwert });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg: 'B', traeger: '15' })),
    dateiName: ctx.dateiName('Q37'),
    referenzwerte: [referenzwert],
  };
}

module.exports = [
  fall({
    id: 'Q30',
    titel: 'Q10-Kette: Anmeldung reserve_1 auf B/15 zum 01.01.2026 OHNE BVAB (M3)',
    zweck:
      'Start der Kette „BV-Zeit nachtragen“: eine Anmeldung ohne BV-Zeit, wie sie aus einem fremden Programm ' +
      'kommt. Später M8 mit BVAB und die Frage, ob BW2032 nach der mBGM-Berichtigung der Vormonate verschwindet.',
    quelle: `${QUELLE_ZR}; E.29.2 (M3, BVAB); SIT KW42 F3 (BW2032 nach M8)`,
    erwartung: 'übernommen, kein Clearing (BV-Zeit fehlt erst auf, wenn eine mBGM mit BV kommt)',
    fenster: MO_VM,
    rang: 11,
    baue: anmeldung('Q30', { rolle: 'reserve_1', dg: 'B', traeger: '15', bvab: null }),
  }),
  fall({
    id: 'Q31',
    titel: 'Q07-Kette: Anmeldung reserve_2 auf A/15 zum 01.01.2026 OHNE BVAB (M3)',
    zweck:
      'Start für Q07: Die Abmeldung mit BV-Ende (Di vm) trifft auf keine BV-Zeit → VW1942. Danach repariert ' +
      'kasseneck mit einer neuen Abmeldung ohne BVEN (Di nm).',
    quelle: `${QUELLE_ZR}; SIT KW42 V45/V47 (VW1942 ohne BVAB)`,
    erwartung: 'übernommen',
    fenster: MO_VM,
    rang: 11,
    baue: anmeldung('Q31', { rolle: 'reserve_2', dg: 'A', traeger: '15', bvab: null }),
  }),
  fall({
    id: 'Q32',
    titel: 'Q14-Kette: Anmeldung reserve_3 auf A/15 zum 01.01.2026 OHNE BVAB (M3)',
    zweck:
      'Start für Q14: wie Q31, aber die rechtlich richtige Reparatur – BV-Zeit per M8 nachtragen und die ' +
      'mBGM der Monate mit BV berichtigen, statt das BV-Ende wegzulassen.',
    quelle: `${QUELLE_ZR}; § 6 Abs 1 BMSVG; SIT KW42 F3/F4`,
    erwartung: 'übernommen',
    fenster: MO_VM,
    rang: 11,
    baue: anmeldung('Q32', { rolle: 'reserve_3', dg: 'A', traeger: '15', bvab: null }),
  }),
  fall({
    id: 'Q33',
    titel: 'Q15/B7-Kette: Anmeldung angestellte auf B/15 zum 01.01.2026, BVAB 01.02.2026 (M3)',
    zweck:
      'Erstes Dienstverhältnis; Abmeldung zum 31.01. (Mo nm), Wiedereintritt am 01.03. mit BV ab dem ' +
      'Eintrittstag (Vordienstzeit beim selben Dienstgeber binnen 12 Monaten) und mBGM 03 danach.',
    quelle: `${QUELLE_ZR}; § 6 Abs 1 BMSVG; E.29.2 (BVAB)`,
    erwartung: 'übernommen',
    fenster: MO_VM,
    rang: 11,
    baue: anmeldung('Q33', { rolle: 'angestellte', dg: 'B', traeger: '15', bber: '02', bvab: 'folgemonat' }),
  }),
  fall({
    id: 'Q34',
    titel: 'Q16-Kette: Anmeldung angestellte auf A/14 zum 01.01.2026, BVAB 01.02.2026 (M3)',
    zweck:
      'Richtig angemeldet. Die mBGM 02/2026 kommt bewusst nur mit SV (Verrechnungsgrundlage 2) – verlangt ' +
      'die ÖGK ab dem BV-Beginn zwingend Grundlage 1 (BW2032)?',
    quelle: `${QUELLE_ZR}; E.32 (VERG), D.54`,
    erwartung: 'übernommen',
    fenster: MO_VM,
    rang: 11,
    baue: anmeldung('Q34', { rolle: 'angestellte', dg: 'A', traeger: '14', bber: '02', bvab: 'folgemonat' }),
  }),
  fall({
    id: 'Q35',
    titel: 'Q17-Kette: Anmeldung arbeiter auf A/15 zum 01.01.2026, BVAB 01.02.2026 (M3)',
    zweck:
      'Für diesen Dienstnehmer kommt die mBGM 01/2026 nicht rechtzeitig: Mahnung BW1930 und amtswegige mBGM ' +
      '(BW1916) abwarten, dann die echte mBGM schicken – Hinweis, Differenz oder nichts?',
    quelle: `${QUELLE_ZR}; SIT-README (BW1930, BW1916)`,
    erwartung: 'übernommen',
    fenster: MO_VM,
    rang: 11,
    baue: anmeldung('Q35', { rolle: 'arbeiter', dg: 'A', traeger: '15', bvab: 'folgemonat' }),
  }),
  fall({
    id: 'Q36',
    titel: 'Q20-Kette: Anmeldung geringfügig auf A/15, Beginn 15.12.2025, ohne Wochenarbeitszeit (M3)',
    zweck:
      'Ein Dienstverhältnis aus 2025 (verspätet gemeldet, F7115 gilt erst für Anmeldungen ab 2026). Später ' +
      'Richtigstellung und Änderung ohne Wochenarbeitszeit: Greift F7115 auch dort?',
    quelle: `${QUELLE_ZR}; Prüfkatalog VR (F7115)`,
    erwartung: 'übernommen ohne F7115 (Beginn 2025); Meldeverstoß wegen Verspätung möglich',
    fenster: MO_VM,
    rang: 12,
    baue: anmeldung('Q36', {
      rolle: 'geringfuegig',
      dg: 'A',
      traeger: '15',
      gerf: 'J',
      adat: '2025-12-15',
      stunden: null,
      bvab: 'folgemonat',
    }),
  }),
  fall({
    id: 'Q37',
    titel: 'F6-Gegenprobe: kasseneck-Anmeldung arbeiter auf B/15 zum 01.01.2026 (M3)',
    zweck:
      'Anmeldung über den Versandweg von kasseneck (BVAB nach kasseneck-Regel). Später kasseneck-Abmeldung ' +
      '„Kündigung durch DN während Elternteilzeit“ (AGRD 21) mit BV-Ende – kommt diesmal kein VW1942?',
    quelle:
      'kasseneck feature/elda-versichertenmeldung (versichertenmeldung-core.js, elda-rueckmeldung-core.js); ' +
      'SIT KW42 K20–K23',
    erwartung: 'übernommen; Referenzwert KE-VR-…',
    fenster: MO_VM,
    braucht: 'kasseneck-vr',
    rang: 13,
    baue: q37Anmeldung,
  }),
  fall({
    id: 'Q38',
    titel: 'Q15/B7-Kette: Abmeldung angestellte von B/15 zum 31.01.2026, vor dem BV-Beginn (M4)',
    zweck:
      'Q33 endet nach einem Monat, bevor die BV (BVAB 01.02.) begonnen hat – also ohne BVEN. Gesendet vor der ' +
      'mBGM 01/2026 (M81, N4). Grundlage für den Wiedereintritt am 01.03. mit BV ab dem ersten Tag.',
    quelle: `${QUELLE_ZR}; E.29.2 (M4), D.22; § 6 Abs 1 BMSVG`,
    erwartung: 'übernommen; kein VW1942 (kein BVEN gemeldet)',
    fenster: ['mo-nm'],
    abhaengig: ['Q33'],
    rang: 11,
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'Q38',
        art: 'abmeldung',
        rolle: 'angestellte',
        dg: 'B',
        traeger: '15',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '03' },
      });
    },
  }),
  fall({
    id: 'Q39',
    titel: 'F7062-Grenze: Anmeldung freier_dn auf A/14 mit Beginn 31.12.2018 (M3)',
    zweck:
      'Der Text von F7062 nennt „Datum vor 01.01.2018“, V62 (01.01.2018) wurde trotzdem abgewiesen; das Paket ' +
      'prüft gegen 01.01.2019. Weist ELDA auch den 31.12.2018 ab, ist die Grenze 2019 und nur der Text veraltet.',
    quelle: 'Prüfkatalog Blatt VR (F7062); SIT V62 (KW42); pruefung-e29.ts',
    erwartung: 'F7062, Abweisung (dann stimmt die Grenze 2019 im Paket)',
    fenster: ['mo-nm'],
    rang: 12,
    // Das Paket ließe den Satz nicht bauen (F7062 ab 2019) – also mit gültigem Datum bauen und ADAT danach setzen.
    baue: (ctx) => {
      const b = anmeldung('Q39', { rolle: 'freier_dn', dg: 'A', traeger: '14', bvab: null })(ctx);
      const adat = FELDER_E29.find((f) => f.name === 'ADAT');
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, adat, '31122018') };
    },
  }),
];
