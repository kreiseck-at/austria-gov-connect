'use strict';

// Kette über kasseneck im Fenster mi-vm (sim. 01.04.2026), damit ihr Clearing
// noch zu mi-nm kommt (danach wird die SIT zurückgesetzt):
//
//   K11 (rang 30)  Anmeldung reserve_3, Eintritt 02.03.2026, BVAB 02.04.2026
//   Q05 (rang 31)  Anmeldung reserve_1, Eintritt 02.02.2026, BVAB 02.03.2026
//   M70 (rang 32)  mBGM 02/2026, Konto A/15: reserve_1 – erster Monat, BV-frei
//   K12 (rang 33)  Abmeldung reserve_3 zum 31.03.2026, vor dem BV-Beginn → ohne BVEN
//   K13 (rang 34)  Abmeldung reserve_1 zum 31.03.2026, nach dem BV-Beginn → mit BVEN
//   M71 (rang 35)  mBGM 03/2026, Konto A/15: reserve_1 (BV ab 02.03.) und
//                  reserve_3 (erster Monat, BV-frei) – nach den Abmeldungen,
//                  wie im Normalbetrieb (N4: Abmeldung vor der letzten mBGM).
//
// Die Beträge (3.000 € Monatsgehalt, Angestellte Vollzeit) sind so gewählt,
// dass jede Position ohne halben Cent aufgeht: Ein Rundungsbefund (DM-D.62)
// würde den Fall im Werkzeug abbrechen. Gerechnet wird mit der Lohnlogik von
// kasseneck (Parameter 2026) ohne Endabrechnung: aliquote Sonderzahlungen und
// Urlaubsersatzleistung beim Austritt fehlen bewusst – sie würden die
// Endabrechnungs-Antworten aus Firestore brauchen.

const { mbgmPaket } = require('../lib/bausteine');

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', braucht: 'kasseneck', ...mehr });

/** Der 02. des Monats, der `zurueck` Monate vor `iso` liegt (wie in k-kasseneck-vr.js). */
function zweiterVor(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 2)).toISOString().slice(0, 10);
}

/** Letzter Tag des Monats vor `iso`. */
function vormonatsende(iso) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, 0)).toISOString().slice(0, 10);
}

/** Monat `zurueck` Monate vor `iso` als JJJJ-MM. */
function monatVor(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 1)).toISOString().slice(0, 7);
}

const angestellte = (eintritt, austritt = null) => ({
  dienstnehmerGruppe: 'angestellter',
  beschaeftigungsart: 'fulltime',
  eintritt,
  austritt,
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: 300_000,
});

module.exports = [
  fall({
    id: 'M70',
    titel: 'kasseneck: mBGM Februar 2026, Konto A/15 – Q05-Person, erster Monat ohne BV',
    zweck:
      'Erste mBGM der kasseneck-Kette: Eintritt 02.02.2026, BV-freier erster Monat (§ 6 Abs 1 BMSVG), BVAB der ' +
      'Anmeldung = 02.03.2026. Erwartung laut Befund 13.10.: kein BW1874 (das kam nur bei BVAB = Eintrittstag).',
    quelle:
      'E.32; kasseneck functions-lohn/mbgm-core.js, lohnabrechnung-core.js (BV erster Monat); SIT M40 (13.10.2026)',
    erwartung: 'übernommen; Clearing: kein BW1874, kein BW1871',
    fenster: ['mi-vm'],
    abhaengig: ['Q05'],
    rang: 32,
    baue: (ctx) => {
      const zr = ctx.zrVon('Q05');
      return mbgmPaket(ctx, {
        fall: 'M70',
        dg: 'A',
        traeger: '15',
        monat: monatVor(zr, 2),
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'reserve_1', mitarbeiter: angestellte(zweiterVor(zr, 2)) }],
      });
    },
  }),
  fall({
    id: 'M71',
    titel: 'kasseneck: mBGM März 2026, Konto A/15 – Q05-Person mit BV, K11-Person erster Monat',
    zweck:
      'Letzte mBGM der Kette, gesendet NACH den Abmeldungen K12/K13 (Normalbetrieb, N4). Q05-Person: zweiter ' +
      'Monat, BV ab 02.03.2026 (Resttage laut kasseneck), Austritt 31.03. K11-Person: Eintritt 02.03., erster ' +
      'Monat BV-frei, Austritt 31.03. Erwartung: kein BW1871 (BV-Zeit über BVAB vorhanden).',
    quelle: 'E.32; kasseneck mbgm-core.js, lohnabrechnung-core.js; SIT-Befunde 13.10.2026 (BVAB, BW1871)',
    erwartung: 'übernommen; Clearing: kein BW1871, kein BW1874',
    fenster: ['mi-vm'],
    abhaengig: ['K11', 'Q05', 'M70', 'K12', 'K13'],
    rang: 35,
    baue: (ctx) => {
      const zrQ = ctx.zrVon('Q05');
      const zrK = ctx.zrVon('K11');
      return mbgmPaket(ctx, {
        fall: 'M71',
        dg: 'A',
        traeger: '15',
        monat: monatVor(zrQ, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_1', mitarbeiter: angestellte(zweiterVor(zrQ, 2), vormonatsende(zrQ)) },
          { rolle: 'reserve_3', mitarbeiter: angestellte(zweiterVor(zrK, 1), vormonatsende(zrK)) },
        ],
      });
    },
  }),
];
