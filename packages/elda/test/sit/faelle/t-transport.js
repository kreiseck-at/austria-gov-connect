'use strict';

// T – Transport: senden, empfangen, Duplikate.

module.exports = [
  {
    id: 'T01',
    titel: 'Antwortfelder von senden',
    zweck: 'Protokollnummer, dateiId und eldaZeitstempel einer erfolgreichen Sendung festhalten.',
    quelle: 'Schnittstellenbeschreibung V4, SendenResult',
    erwartung: '000 mit Protokollnummer, dateiId, eldaZeitstempel',
    gefahr: null,
    abhaengig: [],
    aktion: 'beobachten',
    aus: ['V01'],
  },
  {
    id: 'T02',
    titel: 'dieselbe Datei ein zweites Mal senden',
    zweck: 'Zeigt die Duplikaterkennung: Wiederholung nach einem Zeitlimit darf nicht doppelt melden.',
    quelle: 'Schnittstellenbeschreibung V4, Status 405',
    erwartung: '405 „duplikatVon: <Protokollnummer von V01>"',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: ['V01'],
    aktion: 'senden',
    baue: (ctx) => ({ ...ctx.bestandVon('V01'), referenzwerte: [] }),
  },
  {
    id: 'T14',
    titel: 'empfangen mit einer Protokollnummer, die es nicht gibt',
    zweck: 'Zeigt die Antwort auf eine unbekannte Protokollnummer (Beispiel der Schnittstellenbeschreibung).',
    quelle: 'Schnittstellenbeschreibung V4, Status 406',
    erwartung: '406',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    baue: () => ({ protokollnummer: '1' }),
  },
];
