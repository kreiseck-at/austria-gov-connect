'use strict';

// Z – Zugang und Sicherheitsparameter. Ziel: jeden Status 55x einmal sehen.
// Alle Fälle hier rufen nur `ruecksendungenAuflisten` – das verändert nichts.

const { createHash } = require('node:crypto');
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
    id: 'Z16',
    rang: 1,
    titel: 'Auflisten bei leerer Outbox (Nachprüfung B004)',
    zweck:
      'Am 05.10.2026 lieferte das Auflisten bei leerer Outbox 500 „Interner Verarbeitungsfehler“ statt 000 mit ' +
      'leerer Liste (B004); lswh hat eine Korrektur zugesagt. Läuft nach Z01 und dem Abholen aller Reste, bevor ' +
      'in der Woche etwas gesendet ist – nur dann ist die Outbox sicher leer.',
    quelle: 'Schnittstellenbeschreibung V4, ruecksendungenAuflisten; SIT B004 (05.10.2026), Zusage lswh',
    erwartung: '000 mit 0 Rücksendungen = behoben; 500 = noch nicht behoben',
    baue: () => ({}),
  },
  {
    ...basis,
    id: 'Z04',
    // Sperrgefahr: nur am Ende des letzten Fensters der Woche, ein Versuch, NACH dem letzten
    // Abholen (Kampagnenplan, Regel 3) – deshalb nie in der Liste des Auto-Laufs.
    fenster: ['mi-nm'],
    gefahr: 'sperre',
    rang: 98,
    titel: 'falsches Kundenpasswort (eigene SIT-Seriennummer)',
    zweck:
      'Ein gültig gebildeter SHA-512-Digest eines falschen Passworts im Feld kundenpasswort. Zeigt den Code ' +
      '(erwartet 558) und ob schon ein Fehlversuch sperrt – das nächste Z01 (Mo der Folgewoche) sagt es.',
    quelle: 'Schnittstellenbeschreibung V4, SecurityParameters, Status 558; Kampagnenplan Regel 3',
    erwartung: '558',
    baue: () => ({
      manipulation: setzeElement(
        'kundenpasswort',
        createHash('sha512').update('falsches-sit-kundenpasswort', 'utf8').digest('hex'),
      ),
    }),
  },
  {
    ...basis,
    id: 'Z05',
    fenster: ['mi-nm'],
    gefahr: 'sperre',
    rang: 99,
    titel: 'Kundenpasswort-Hash in Großbuchstaben',
    zweck:
      'Der richtige Digest, nur in Großbuchstaben. Vergleicht ELDA den Hex-Wert ohne Rücksicht auf die ' +
      'Schreibung (000) oder ist das ein falsches Passwort (558)? Davon hängt ab, ob das Paket einen groß ' +
      'geschriebenen Hash weiter abweisen muss (loeseKundenpasswortHash). Der Mitschnitt schwärzt auch die ' +
      'Großschreibung (transport.js).',
    quelle: 'Schnittstellenbeschreibung V4, SecurityParameters (SHA-512 hex), Status 558',
    erwartung: '558 oder 000',
    baue: () => ({
      manipulation: (anfrage) => {
        const hash = elementWert(anfrage.body, 'kundenpasswort');
        if (!/^[0-9a-f]{128}$/.test(hash ?? '')) throw new Error('Z05: kein SHA-512-Digest in kundenpasswort');
        return setzeElement('kundenpasswort', hash.toUpperCase())(anfrage);
      },
    }),
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
