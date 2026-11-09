'use strict';

// mBGM für KW46 (Zeitreise 2026/27): die Kette zur Höchstbeitragsgrundlage nach Q60
// (Anmeldung angestellte A/14 zum 01.02.2026, BVAB 01.03.2026). Sie ersetzt M85/M97
// aus KW45, deren Vorlauf Q34 nur Mo 07–09 lief.
//
//   M98  A/14  02/2026  Di 07–09 (01.03.): 9.000 €, erster Monat – SV bei 6.930 € gedeckelt, BV beitragsfrei
//   M99  A/14  03/2026  Di 12–14 (01.04.): 9.000 €, BV ab 01.03. vom vollen Entgelt (§ 6 Abs 1 BMSVG)

const { mbgmPaket } = require('../lib/bausteine');

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
];
