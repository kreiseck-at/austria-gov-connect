'use strict';

// Mi 07–09 (simuliert 01.04.2027), zweiter Nachschlag: Fälle, die einer Lohnverrechnung wirklich passieren,
// auf Personen-Monaten ohne bisherige mBGM. Clearing Mi nm.
//
//   M127 B/15 04/2026  reserve_1 (Q61) mit 2.000 € über kasseneck – AV-Minderung untere Stufe (Teilzeit-Entgelt)
//   M128 B/15 05/2026  reserve_1 mit 2.300 € über kasseneck – AV-Minderung mittlere Stufe
//   M129 A/15 04/2026  angestellte (Q64, als Angestelltenlehrling BBER 04 angemeldet) als normale Angestellte
//                      gerechnet: B002 statt B044 – Lehrling im Lohnprogramm nicht als Lehrling erfasst
//   M130 B/15 04/2026  reserve_2 (Q62, geringfügig angemeldet) mit 900 € voll versichert gerechnet – über der
//                      Grenze, aber ohne Änderungsmeldung
//   M131 B/15 08/2026  reserve_1 mit 9.000 €, BV-Satz 1,50 % statt 1,53 %
//   M132 B/15 05/2026  freier_dn (Q67): Storno einer mBGM, die es nie gab, und Neumeldung im selben Paket
//
// Bisher belegt (mBGM gesendet): reserve_1 02, 03 (M102/M103), 06 (M116); reserve_2 02, 03 (M104/M105);
// angestellte A/15 03 (M106); freier_dn 01–04, 06–09, 11, 12 und 04/05 2027.

const { mbgmPaket } = require('../lib/bausteine');

const fall = (mehr) => ({
  gefahr: null,
  aktion: 'senden',
  braucht: 'kasseneck',
  fenster: ['mi-vm'],
  rang: 31,
  ...mehr,
});
const QUELLE = 'E.32; kasseneck lohnabrechnung-core.js (alvStaffelMinderung), mbgm-core.js';
const NEGATIV = `${QUELLE}; Negativtest`;

/** Erster Tag des Monats `zurueck` Monate vor dem simulierten Tag, an dem `vorlauf` lief (JJJJ-MM-TT). */
function eintrittVon(ctx, vorlauf, zurueck) {
  const [j, m] = ctx.zrVon(vorlauf).split('-').map(Number);
  return `${new Date(Date.UTC(j, m - 1 - zurueck, 1)).toISOString().slice(0, 7)}-01`;
}

const angestellte = (eintritt, entgeltCent) => ({
  dienstnehmerGruppe: 'angestellter',
  beschaeftigungsart: 'fulltime',
  eintritt,
  austritt: null,
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: entgeltCent,
});

/** reserve_1 auf B/15 aus Q61 (Eintritt zwei Monate vor dessen Fenster). */
function reserve1(ctx, id, monat, entgeltCent, abwandlung) {
  const eintritt = eintrittVon(ctx, 'Q61', 2);
  return mbgmPaket(ctx, {
    fall: id,
    dg: 'B',
    traeger: '15',
    monat: `${eintritt.slice(0, 4)}-${monat}`,
    bundesland: 'oberoesterreich',
    beschaeftigte: [
      { rolle: 'reserve_1', mitarbeiter: angestellte(eintritt, entgeltCent), ...(abwandlung ? { abwandlung } : {}) },
    ],
  });
}

/** Summe der kasseneck-mBGM für 9.000 € mit BV (B002, AB 6.930 €, BV 9.000 €) – laut SIT-Protokoll M121/M122. */
const SUMME_9000_MIT_BV = 284_387;

module.exports = [
  fall({
    id: 'M127',
    titel: 'mBGM 04/2026 B/15 über kasseneck: reserve_1 mit 2.000 € – AV-Minderung untere Stufe',
    zweck:
      'Die AlV-Staffel (§ 2a AMPFG) trifft vor allem Teilzeitkräfte. Über kasseneck lief bisher nur 2.600 € (A01, ' +
      'M100/M101/M115) und der Lehrling (A05). Nimmt die ÖGK den Abschlag der unteren Stufe an?',
    quelle: `${QUELLE}; § 2a AMPFG`,
    erwartung: 'übernommen; Clearing Mi nm ohne BW1842/BW1850/BW1917',
    abhaengig: ['Q61'],
    baue: (ctx) => reserve1(ctx, 'M127', '04', 200_000),
  }),
  fall({
    id: 'M128',
    titel: 'mBGM 05/2026 B/15 über kasseneck: reserve_1 mit 2.300 € – AV-Minderung mittlere Stufe',
    zweck: 'Wie M127 für die mittlere Stufe der Staffel.',
    quelle: `${QUELLE}; § 2a AMPFG`,
    erwartung: 'übernommen; Clearing Mi nm ohne BW1842/BW1850/BW1917',
    abhaengig: ['Q61'],
    baue: (ctx) => reserve1(ctx, 'M128', '05', 230_000),
  }),
  fall({
    id: 'M129',
    titel: 'mBGM-Negativ 04/2026 A/15: als Angestelltenlehrling angemeldet (Q64), als Angestellte gerechnet (B002)',
    zweck:
      'Im Lohnprogramm nicht als Lehrling erfasst: Beschäftigtengruppe B002 und voller Satz statt B044. Erkennt die ' +
      'ÖGK den Widerspruch zur Anmeldung (BBER 04)?',
    quelle: NEGATIV,
    erwartung: 'formal übernommen; Clearing Mi nm zur Beschäftigtengruppe (BW1838 o. ä.)',
    abhaengig: ['Q64'],
    baue: (ctx) => {
      const eintritt = eintrittVon(ctx, 'Q64', 1);
      return mbgmPaket(ctx, {
        fall: 'M129',
        dg: 'A',
        traeger: '15',
        monat: `${eintritt.slice(0, 4)}-04`,
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'angestellte', mitarbeiter: angestellte(eintritt, 230_000) }],
      });
    },
  }),
  fall({
    id: 'M130',
    titel: 'mBGM-Negativ 04/2026 B/15: geringfügig angemeldet (Q62), mit 900 € voll versichert gerechnet',
    zweck:
      'Die Geringfügige verdient über der Grenze, das Lohnprogramm rechnet voll, eine Änderungsmeldung (GERF N) ' +
      'fehlt. Meldet die ÖGK den Widerspruch?',
    quelle: `${NEGATIV}; § 5 Abs 2 ASVG`,
    erwartung: 'formal übernommen; Clearing Mi nm zum Versicherungsumfang',
    abhaengig: ['Q62'],
    baue: (ctx) => {
      const eintritt = eintrittVon(ctx, 'Q62', 2);
      return mbgmPaket(ctx, {
        fall: 'M130',
        dg: 'B',
        traeger: '15',
        monat: `${eintritt.slice(0, 4)}-04`,
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'reserve_2',
            mitarbeiter: {
              dienstnehmerGruppe: 'arbeiter',
              beschaeftigungsart: 'parttime',
              eintritt,
              austritt: null,
              wochenstunden: 10,
              kvBasisStunden: 40,
              grossSalaryCents: 90_000,
            },
          },
        ],
      });
    },
  }),
  fall({
    id: 'M131',
    titel: 'mBGM-Negativ 08/2026 B/15: reserve_1 mit 9.000 €, BV-Satz 1,50 % statt 1,53 %',
    zweck: 'Wie M118 (T01) für die BV: prüft die ÖGK den BV-Satz, oder geht die BV ungeprüft an die Kasse?',
    quelle: `${NEGATIV}; § 6 Abs 1 BMSVG`,
    erwartung: 'formal übernommen; Clearing Mi nm BW1917/BW1850 – oder keins',
    abhaengig: ['Q61'],
    baue: (ctx) =>
      reserve1(ctx, 'M131', '08', 900_000, (e) => ({
        ...e,
        tarifbloecke: e.tarifbloecke.map((t) => ({
          ...t,
          basen: t.basen.map((b) =>
            b.typ !== 'BV'
              ? b
              : {
                  ...b,
                  positionen: b.positionen.map((p) =>
                    p.typ === 'V01'
                      ? { ...p, prozentsatz: 1.5, betragCent: ctx.elda.berechneBeitragCent(b.betragCent, 1.5) }
                      : p,
                  ),
                },
          ),
        })),
      })),
  }),
  fall({
    id: 'M132',
    titel: 'mBGM-Negativ 05/2026 B/15: Storno einer mBGM, die es nie gab, plus Neumeldung im selben Paket',
    zweck:
      'Eine Berichtigung (Storno + neu), deren Original nie verarbeitet wurde – etwa nach BW1837. Wird die ' +
      'Neumeldung trotzdem verbucht, und was sagt das Clearing zum Storno?',
    quelle: `${NEGATIV}; E.32.2.8 (Storno)`,
    erwartung: 'offen: übernommen; Clearing Mi nm zum Storno (nicht zuordenbar) oder keins',
    abhaengig: ['Q67'],
    baue: (ctx) => {
      const jahr = Number(ctx.zrVon('Q67').slice(0, 4)) - 1;
      return mbgmPaket(ctx, {
        fall: 'M132',
        dg: 'B',
        traeger: '15',
        monat: `${jahr}-05`,
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'freier_dn', mitarbeiter: angestellte(`${jahr}-01-01`, 900_000) }],
        stornos: [
          {
            referenzwert: ctx.referenzwert('M132-S'),
            referenzUrspruenglicheMeldung: ctx.referenzwert('M132-NIE'),
            versicherungsnummer: ctx.rolle('freier_dn').vsnr,
            summeCent: SUMME_9000_MIT_BV,
          },
        ],
      });
    },
  }),
];
