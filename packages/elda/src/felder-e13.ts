import type { Feld } from './festsatz';

/**
 * Lohnzettel Finanz – Informationssatz, Satzart `I1`, Kapitel E.13 der
 * Organisationsbeschreibung.
 *
 * Die Feldtabelle ist in Version 28 (42. Ergänzung, Seiten 219–221, gültig ab
 * 01.01.2026) und Version 29 (43. Ergänzung, Seiten 225–227, gültig ab
 * 01.01.2027) gleich; das Änderungsprotokoll der 43. Ergänzung vermerkt für
 * E.13 nur „Versionsnummer erhöht". Die Version steht deshalb nicht im Satz,
 * sondern im Vorlaufsatz (Feld VERS) — und sie muss für alle Finanzsatzarten
 * eines Bestands dieselbe sein (Kapitel B.3, Seite 21: „einheitliche
 * Lohnzettelversionsnummer").
 *
 * Der Informationssatz ist der führende Satz im Bestand `LF`; die
 * Mitteilungssätze (`L1`, Kapitel E.14) folgen ihm (E.13.2).
 *
 * Feldnummer 5 und 8 vergibt das Dokument nicht; die Tabelle springt von 4
 * auf 6 und von 7 auf 9. Das bleibt hier so, damit jede Nummer mit dem
 * Dokument übereinstimmt.
 */

/** Satzlänge des Informationssatzes (Kapitel E.13). */
export const SATZLAENGE_I1 = 1100;

/**
 * Felder des Informationssatzes. `ANAM`, `AADR` und `AORT` sind Name und
 * Anschrift des Arbeitgebers und tragen deshalb die Feldklasse `unternehmen`.
 * Das Reservefeld heißt `RESE_27` — die Feldnummer im Namen, weil das Dokument
 * den Namen `RESE` in den Mitteilungssätzen mehrfach vergibt und ein Feldname
 * hier zugleich Schlüssel im Werte-Objekt ist.
 */
export const FELDER_I1: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'FSART', pos: 21, laenge: 1, typ: 'a/n' },
  { nr: 3, name: 'CLEAR', pos: 22, laenge: 6, typ: 'a/n' },
  { nr: 4, name: 'CLDVR', pos: 28, laenge: 7, typ: 'a/n' },
  { nr: 6, name: 'STNRL', pos: 35, laenge: 9, typ: 'n' },
  { nr: 7, name: 'DVRNL', pos: 44, laenge: 7, typ: 'n' },
  { nr: 9, name: 'STNRA', pos: 51, laenge: 9, typ: 'n' },
  { nr: 10, name: 'DVRNA', pos: 60, laenge: 7, typ: 'n' },
  { nr: 11, name: 'ARTD', pos: 67, laenge: 2, typ: 'a' },
  { nr: 12, name: 'DTUE', pos: 69, laenge: 8, typ: 'n', format: 'JJJJMMTT' },
  { nr: 13, name: 'ZTUE', pos: 77, laenge: 6, typ: 'n', format: 'HHMMSS' },
  { nr: 14, name: 'STVE', pos: 83, laenge: 2, typ: 'n' },
  { nr: 15, name: 'ANAM', pos: 85, laenge: 37, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 16, name: 'ATIT', pos: 122, laenge: 20, typ: 'a' },
  { nr: 17, name: 'AADR', pos: 142, laenge: 37, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 18, name: 'ALKZ', pos: 179, laenge: 3, typ: 'a' },
  { nr: 19, name: 'APLZ', pos: 182, laenge: 10, typ: 'a/n' },
  { nr: 20, name: 'AORT', pos: 192, laenge: 30, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 21, name: 'INTE', pos: 222, laenge: 11, typ: 'a/n' },
  { nr: 22, name: 'JAHR', pos: 233, laenge: 4, typ: 'n', format: 'JJJJ' },
  { nr: 23, name: 'GESA', pos: 237, laenge: 7, typ: 'n' },
  { nr: 24, name: 'ANZA', pos: 244, laenge: 7, typ: 'n' },
  { nr: 25, name: 'ATEL', pos: 251, laenge: 16, typ: 'a/n' },
  { nr: 26, name: 'AFAX', pos: 267, laenge: 16, typ: 'a/n' },
  { nr: 27, name: 'RESE_27', pos: 283, laenge: 818, typ: 'a/n' },
];
