'use strict';

// B – Bestand und Umschlag. Jede Formprobe nutzt eine eigene Reserveperson,
// damit sie keinen anderen Fall berührt. Alle hängen an V01: Erst wenn eine
// gewöhnliche Anmeldung in dieser Woche angenommen wurde, sagt eine Abweisung
// etwas über die geprüfte Abweichung aus – und nicht über die VR-Version.

const { meldung, mitLf } = require('../lib/bausteine');

const anmeldungReserve = (ctx, fall, rolle, optionen) =>
  meldung(ctx, {
    fall,
    art: 'anmeldung',
    rolle,
    dg: 'B',
    traeger: '15',
    felder: {
      ADAT: ctx.ttmmjjjj(ctx.zr),
      BBER: '01',
      GERF: 'N',
      FRDV: 'N',
      VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
    },
    optionen,
  });

module.exports = [
  {
    id: 'B01',
    titel: 'gültiger VR-Bestand (Referenzfall)',
    zweck: 'Der einfachste gültige Bestand wird übernommen – Grundlage aller anderen B-Fälle.',
    quelle: 'E.1, E.2, E.3, E.29',
    erwartung: 'übernommen',
    gefahr: null,
    abhaengig: [],
    aktion: 'beobachten',
    aus: ['V01'],
  },
  {
    id: 'B03',
    titel: 'Satztrenner LF statt CRLF',
    zweck: 'Klärt die offene README-Frage, ob ELDA auch LF als Satztrenner annimmt.',
    quelle: 'C.1, Fehlerkatalog H.22 (W4), README „Bestandsformat"',
    erwartung: 'angenommen oder E2',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: ['V01'],
    aktion: 'senden',
    baue: (ctx) => {
      const b = anmeldungReserve(ctx, 'B03', 'reserve_1');
      return { ...b, inhalt: mitLf(b.inhalt) };
    },
  },
  {
    id: 'B11',
    titel: 'Projektcode DM im SIT',
    zweck: 'Im SIT gilt TM – was passiert mit DM?',
    quelle: 'ÖGK „LSWH-Test – Regelbetrieb" 10/2023; E.2 (PROJ)',
    erwartung: '?',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: ['V01'],
    aktion: 'senden',
    baue: (ctx) => anmeldungReserve(ctx, 'B11', 'reserve_2', { testdaten: false }),
  },
  {
    id: 'B12',
    titel: 'Erstellungsdatum echt statt simuliert',
    zweck: 'Prüft die Regel „EDAT nicht nach dem 01. des Monats" – wird sie durchgesetzt?',
    quelle: 'ÖGK „LSWH-Test – Regelbetrieb" 10/2023; E.2 (EDAT)',
    erwartung: '?',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: ['V01'],
    aktion: 'senden',
    baue: (ctx) => anmeldungReserve(ctx, 'B12', 'reserve_3', { erstellt: ctx.jetzt }),
  },
];
