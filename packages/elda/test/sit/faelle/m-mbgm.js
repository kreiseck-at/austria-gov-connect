'use strict';

// M – monatliche Beitragsgrundlagenmeldung (E.32), gerechnet mit kasseneck.
//
// Anlass (SIT 06.10.2026): Nach den Anmeldungen vom Montag kamen in der
// Sammelverarbeitung Mahnungen (BW1930) und amtswegige mBGMs nur für die SV
// (BW1916), und eine Abmeldung scheiterte mit VW1942 („keine Zeit der
// Betrieblichen Vorsorge gespeichert“). Diese Fälle schicken die mBGMs, die
// kasseneck für dieselben Beschäftigten bauen würde – Paket je Konto und
// Monat, mit ALLEN Beschäftigten des Kontos in diesem Monat.
//
//   Mi vormittags (sim. 01.04.2026) M03  März 2026, Konto A/14: beide Lehrlinge
//   Mi nachmittags (sim. 01.05.2026) M13 April 2026, Konto A/14: Arbeiter V01 +
//                                         Angestelltenlehrling (der Arbeiterlehrling
//                                         ist mit V16 zum 31.03.2026 abgemeldet)
//                                   M14 April 2026, Konto A/15: Angestellte V02
//
// Der freie Dienstnehmer (V06, Konto B) bekommt keine mBGM: kasseneck rechnet
// freie Dienstnehmer bewusst nicht ab – eine Lücke im Produkt, kein Testfall.
// Die Entgelte sind erfunden; Eintritt aus dem tatsächlichen Lauf der Anmeldung.

const { mbgmPaket } = require('../lib/bausteine');

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', braucht: 'kasseneck', ...mehr });

const lehrling = (ctx, art, entgelt) => ({
  dienstnehmerGruppe: 'lehrling',
  lehrlingsArt: art,
  beschaeftigungsart: 'fulltime',
  eintritt: ctx.zrVon(art === 'arbeiter' ? 'V03' : 'V04'),
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: entgelt,
});

module.exports = [
  fall({
    id: 'M03',
    titel: 'mBGM März 2026 für beide Lehrlinge (kasseneck)',
    zweck:
      'Erste mBGM mit BV-Verrechnung für Beschäftigte, die seit 02/2025 angemeldet sind; ' +
      'legt die BV-Zeit an, ohne die V15 (VW1942) scheiterte. Rechnung und Meldung aus kasseneck.',
    quelle: 'E.32; kasseneck functions-lohn/mbgm-core.js',
    erwartung: 'übernommen; danach kein BW1930/BW1916 mehr für 03/2026',
    fenster: ['mi-vm'],
    abhaengig: ['V03', 'V04'],
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M03',
        dg: 'A',
        traeger: '14',
        monat: '2026-03',
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'arbeiterlehrling', mitarbeiter: lehrling(ctx, 'arbeiter', 90000) },
          { rolle: 'angestelltenlehrling', mitarbeiter: lehrling(ctx, 'angestellter', 95000) },
        ],
      }),
  }),
  fall({
    id: 'M13',
    titel: 'mBGM April 2026, Konto A/14: Arbeiter Vollzeit + Angestelltenlehrling (kasseneck)',
    zweck: 'Neu eingetretener Arbeiter (erster Monat, BV beitragsfrei) neben einem laufenden Lehrling.',
    quelle: 'E.32; kasseneck functions-lohn/mbgm-core.js',
    erwartung: 'übernommen',
    fenster: ['mi-nm'],
    abhaengig: ['V01', 'V04', 'M03'],
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M13',
        dg: 'A',
        traeger: '14',
        monat: '2026-04',
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'arbeiter',
            mitarbeiter: {
              dienstnehmerGruppe: 'arbeiter',
              beschaeftigungsart: 'fulltime',
              eintritt: ctx.zrVon('V01'),
              wochenstunden: 40,
              kvBasisStunden: 40,
              grossSalaryCents: 260000,
            },
          },
          { rolle: 'angestelltenlehrling', mitarbeiter: lehrling(ctx, 'angestellter', 95000) },
        ],
      }),
  }),
  fall({
    id: 'M14',
    titel: 'mBGM April 2026, Konto A/15: Angestellte Teilzeit (kasseneck)',
    zweck: 'Zweites Beitragskonto desselben Dienstgebers beim anderen Träger, Teilzeit 20 h.',
    quelle: 'E.32; kasseneck functions-lohn/mbgm-core.js',
    erwartung: 'übernommen',
    fenster: ['mi-nm'],
    abhaengig: ['V02'],
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M14',
        dg: 'A',
        traeger: '15',
        monat: '2026-04',
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'angestellte',
            mitarbeiter: {
              dienstnehmerGruppe: 'angestellter',
              beschaeftigungsart: 'parttime',
              eintritt: ctx.zrVon('V02'),
              wochenstunden: 20,
              kvBasisStunden: 40,
              grossSalaryCents: 145000,
            },
          },
        ],
      }),
  }),
];
