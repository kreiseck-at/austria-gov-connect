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
    erwartung: 'KW41: 408 „wurde bereits abgeholt“; seit KW46: 000, die Rücksendung kommt erneut (Kopie daneben)',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    baue: (ctx) => ({ protokollnummer: ctx.letzteRuecksendung() }),
  },
  {
    id: 'T16',
    titel: 'eine vor mindestens sieben Tagen abgeholte Rücksendung (Vorwoche) erneut empfangen',
    zweck:
      'T15 zeigt seit KW46: eine abgeholte Rücksendung kommt erneut. Gilt das auch über den Wochen-Neustart ' +
      'der SIT hinweg? Entscheidet, wie lange kasseneck ein verlorenes Abholen nachholen kann.',
    quelle: 'Schnittstellenbeschreibung V4 (empfangen); SIT KW46 T15',
    erwartung: 'offen: 000 mit derselben Datei, oder 406/408',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    baue: (ctx) => ({ protokollnummer: ctx.ruecksendungVor(7) }),
  },
  {
    id: 'T17',
    titel: 'eine vor mindestens 25 Tagen abgeholte Rücksendung (KW42) erneut empfangen',
    zweck: 'Wie T16 mit einer Rücksendung aus einer früheren Zeitreise – gibt es eine Aufbewahrungsgrenze?',
    quelle: 'Schnittstellenbeschreibung V4 (empfangen); SIT KW46 T15',
    erwartung: 'offen: 000 mit derselben Datei, oder 406/408',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    baue: (ctx) => ({ protokollnummer: ctx.ruecksendungVor(25) }),
  },
  {
    id: 'T18',
    titel: 'die älteste abgeholte Rücksendung (KW41, mindestens 35 Tage) erneut empfangen',
    zweck:
      'T16/T17 kamen nach 7 und 25 Tagen byte-gleich wieder. Gibt es überhaupt eine Grenze? Die älteste ' +
      'Rücksendung der Ablage stammt aus der ersten Testwoche.',
    quelle: 'Schnittstellenbeschreibung V4 (empfangen); SIT KW46 T15–T17',
    erwartung: 'offen: 000 mit derselben Datei, oder 406/408',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    baue: (ctx) => ({ protokollnummer: ctx.ruecksendungVor(35) }),
  },
  {
    id: 'T19',
    titel: 'dieselbe alte Rücksendung dreimal hintereinander empfangen',
    zweck:
      'T15–T18: abgeholte Rücksendungen kommen erneut, auch nach Wochen. Gibt es eine Grenze für die Anzahl ' +
      '(etwa der Status 206 „Limit an Rücksendungen erreicht“ der Schnittstellenbeschreibung 09/2026)?',
    quelle: 'Schnittstellenbeschreibung V4 Stand 09/2026 (empfangen, Status 206); SIT KW46 T15–T18',
    erwartung: 'offen: dreimal 000, oder 206/408 ab einem Aufruf',
    fenster: 'jedes',
    gefahr: null,
    abhaengig: [],
    aktion: 'empfangen',
    aufrufe: 3,
    baue: (ctx) => ({ protokollnummer: ctx.ruecksendungVor(35) }),
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
