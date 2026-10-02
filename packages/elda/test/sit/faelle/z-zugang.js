'use strict';

// Z – Zugang und Sicherheitsparameter. Ziel: jeden Status 55x einmal sehen.
// Alle Fälle hier rufen nur `ruecksendungenAuflisten` – das verändert nichts.

const { setzeElement, leereElement, setzeHeader, elementWert } = require('../lib/manipulation');

const basis = {
  fenster: 'jedes',
  gefahr: null,
  abhaengig: [],
  aktion: 'auflisten',
};

module.exports = [
  {
    ...basis,
    id: 'Z01',
    rang: 0,
    titel: 'Rücksendungen auflisten mit korrekten Zugangsdaten',
    zweck: 'Zugang, API-Key und Quell-Adresse im SIT bestätigen; Ausgangslage jeder Woche.',
    quelle: 'Schnittstellenbeschreibung V4 (09/2026), ruecksendungenAuflisten',
    erwartung: '000',
    baue: () => ({}),
  },
  {
    ...basis,
    id: 'Z07',
    titel: 'nonce leer',
    zweck: 'Prüft, ob ELDA eine leere Nonce mit dem dokumentierten Code abweist.',
    quelle: 'Schnittstellenbeschreibung V4, SecurityParameters, Status 554',
    erwartung: '554',
    baue: () => ({ manipulation: leereElement('nonce') }),
  },
  {
    ...basis,
    id: 'Z08',
    titel: 'nonce wiederverwendet',
    zweck: 'Zweiter Aufruf mit der Nonce des ersten – zeigt den Schutz gegen Wiederholung.',
    quelle: 'Schnittstellenbeschreibung V4, SecurityParameters, Status 552',
    erwartung: 'erster Aufruf 000, zweiter 552',
    aufrufe: 2,
    baue: () => {
      let erste;
      return {
        manipulation: (anfrage) => {
          if (erste === undefined) {
            erste = elementWert(anfrage.body, 'nonce');
            return anfrage;
          }
          return setzeElement('nonce', erste)(anfrage);
        },
      };
    },
  },
  {
    ...basis,
    id: 'Z09',
    titel: 'created leer',
    zweck: 'Prüft die Abweisung eines fehlenden Erstellzeitpunkts.',
    quelle: 'Schnittstellenbeschreibung V4, SecurityParameters, Status 555',
    erwartung: '555',
    baue: () => ({ manipulation: leereElement('created') }),
  },
  {
    ...basis,
    id: 'Z10',
    titel: 'created zwei Minuten alt',
    zweck: 'Prüft die 60-Sekunden-Grenze für den Erstellzeitpunkt.',
    quelle: 'Schnittstellenbeschreibung V4, Status 551',
    erwartung: '551',
    // Zum Sendezeitpunkt berechnet, nicht beim Bauen.
    baue: () => ({
      manipulation: (anfrage) =>
        setzeElement('created', new Date(Date.now() - 120_000).toISOString())(anfrage),
    }),
  },
  {
    ...basis,
    id: 'Z13',
    titel: 'falscher Content-Type',
    zweck: 'Zeigt, wie ELDA einen unerlaubten Content-Type meldet (Status oder HTTP-Fehler).',
    quelle: 'Schnittstellenbeschreibung V4, Status 559',
    erwartung: '559',
    baue: () => ({ manipulation: setzeHeader('Content-Type', 'application/xml; charset=utf-8') }),
  },
];
