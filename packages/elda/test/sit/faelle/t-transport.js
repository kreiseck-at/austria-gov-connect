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
    id: 'T03',
    titel: 'dieselbe Datei wie V40 (Mo 12.10.) an einem späteren Testtag noch einmal senden',
    zweck:
      'T02 (gleiche Datei Minuten später) kam mit 000 durch. Die ELDA-FAQ für Dienstgeber (elda.at, contentid ' +
      '10007.838884) nennt E17 „Datei … ist bereits vorhanden“ = „Die Datei wurde mit identischem Inhalt bereits ' +
      'einmal gesendet und erfolgreich verarbeitet.“ Greift die Erkennung erst nach der Verarbeitung? Byte-gleich ' +
      'samt Dateiname, über `ctx.bestandVon` wie T02.',
    quelle: 'Schnittstellenbeschreibung V4 (Status 405 duplikatVon); ELDA-FAQ Dienstgeber (E17)',
    erwartung: '? – 405 „duplikatVon“, E17 in der Mitteilung oder wieder 000',
    fenster: ['mi-vm', 'mi-nm'],
    gefahr: null,
    abhaengig: ['V40'],
    aktion: 'senden',
    baue: (ctx) => ({ ...ctx.bestandVon('V40'), referenzwerte: [] }),
  },
  {
    id: 'T15',
    titel: 'eine schon abgeholte Rücksendung ein zweites Mal empfangen',
    zweck:
      'Ob eine Rücksendung nach dem Abholen weiter abrufbar ist – entscheidet, ob ein ' +
      'abgebrochenes Abholen (Absturz nach dem Empfang, vor dem Speichern) die Datei kostet.',
    quelle: 'Schnittstellenbeschreibung V4 (empfangen, Status 406)',
    erwartung: '? (000 mit derselben Datei oder 406)',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    baue: (ctx) => ({ protokollnummer: ctx.letzteRuecksendung() }),
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
