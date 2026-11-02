'use strict';

// mBGM der KW45-Ketten (Zeitreise 2026/27). Mo 12–14 = 01.02.2026: Die
// Sammelverarbeitung dieses Fensters rechnet den Beitragszeitraum 01/2026 ab.
// Je Beitragskonto ein Paket mit allen Q-Personen des Kontos – nur Q35 fehlt
// bewusst (Q17: Mahnung BW1930 und amtswegige mBGM BW1916 abwarten).
//
//   M80  A/15  01/2026  Q31 reserve_2, Q32 reserve_3 (ohne BVAB)
//   M81  B/15  01/2026  Q30 reserve_1 (ohne BVAB), Q33 angestellte (Austritt 31.01.), Q37 arbeiter
//   M82  A/14  01/2026  Q34 angestellte (BVAB 01.02. – Jänner BV-frei)
//
// Q36 (geringfügig) bekommt keine mBGM: Die mBGM-Logik von kasseneck bildet für Geringfügige
// keine Verrechnungspositionen, und für 12/2025 fehlt das Parameterwerk 2025. Die Q20-Kette
// prüft nur F7115 bei M6/M8 – eine Mahnung dazu ist Beobachtung, kein Fehler des Falls.
//
// Beträge wie in m-kw42-kette.js: 3.000 € Vollzeit, Geringfügig 500 €. Gerechnet
// mit der Lohnlogik von kasseneck ohne Endabrechnung.

const { mbgmPaket } = require('../lib/bausteine');

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', braucht: 'kasseneck', ...mehr });
const MO_NM = ['mo-nm'];
const QUELLE = 'E.32; kasseneck functions-lohn/mbgm-core.js, lohnabrechnung-core.js; SIT-Portal Zeitreise 2026/27';

/** Monat `zurueck` Monate vor `iso` als JJJJ-MM. */
function monatVor(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 1)).toISOString().slice(0, 7);
}

/** Letzter Tag des Monats vor `iso`. */
function vormonatsende(iso) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, 0)).toISOString().slice(0, 10);
}

const vollzeit = (dienstnehmerGruppe, eintritt, austritt = null) => ({
  dienstnehmerGruppe,
  beschaeftigungsart: 'fulltime',
  eintritt,
  austritt,
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: 300_000,
});

module.exports = [
  fall({
    id: 'M80',
    titel: 'mBGM Jänner 2026, Konto A/15 – Q31, Q32 (ohne BVAB); Q35 fehlt bewusst',
    zweck:
      'Erster Monat der Ketten Q07/Q14 (BV-frei, Anmeldung ohne BVAB – passt zusammen). Q35 ist auf ' +
      'demselben Konto angemeldet, bekommt aber keine mBGM: Kommt BW1930 bzw. eine amtswegige mBGM?',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing: kein BW1871 für Q31/Q32; Q35 später BW1930/BW1916',
    fenster: MO_NM,
    abhaengig: ['Q31', 'Q32'],
    rang: 14,
    baue: (ctx) => {
      return mbgmPaket(ctx, {
        fall: 'M80',
        dg: 'A',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_2', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q31')) },
          { rolle: 'reserve_3', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q32')) },
        ],
      });
    },
  }),
  fall({
    id: 'M81',
    titel: 'mBGM Jänner 2026, Konto B/15 – Q30 (ohne BVAB), Q33 (Austritt 31.01.), Q37 (kasseneck)',
    zweck:
      'Q30: erster Monat ohne BV, später M8 mit BVAB. Q33: einziger Monat vor der Abmeldung zum 31.01. (gesendet ' +
      'nach Q38, N4). Q37: erster Monat der kasseneck-Anmeldung.',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing ohne BW1871/BW1874',
    fenster: MO_NM,
    abhaengig: ['Q30', 'Q33', 'Q37', 'Q38'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M81',
        dg: 'B',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_1', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q30')) },
          {
            rolle: 'angestellte',
            mitarbeiter: vollzeit('angestellter', ctx.zrVon('Q33'), vormonatsende(ctx.zr)),
          },
          { rolle: 'arbeiter', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q37')) },
        ],
      }),
  }),
  fall({
    id: 'M82',
    titel: 'mBGM Jänner 2026, Konto A/14 – Q34 angestellte, Monat vor dem BV-Beginn',
    zweck: 'Normale mBGM für den Monat vor BVAB 01.02.2026; die Frage nach VERG 2 kommt erst mit 02/2026 (Di vm).',
    quelle: QUELLE,
    erwartung: 'übernommen; kein Clearing',
    fenster: MO_NM,
    abhaengig: ['Q34'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M82',
        dg: 'A',
        traeger: '14',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'angestellte', mitarbeiter: vollzeit('angestellter', ctx.zrVon('Q34')) }],
      }),
  }),
];
