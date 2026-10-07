import type { Feld } from './festsatz';

/** Satzlänge der Meldung Familienhospizkarenz/Pflegekarenz (Kapitel E.12, Seite 221 der 43. Ergänzung, 215 der 42.). */
export const SATZLAENGE_E12 = 850;

/**
 * Die 29 Felder der Meldung Familienhospizkarenz/Pflegekarenz, Kapitel E.12 der
 * Organisationsbeschreibung (Version 03, gültig ab 01.12.2013, zwingend ab
 * 01.01.2014; Seiten 220–221 der 43. Ergänzung, Seiten 214–215 der 42. — der
 * Inhalt ist in beiden Ausgaben gleich). Reines Datenabbild: Position, Länge und
 * Typ stehen so im Dokument.
 *
 * `format` übernimmt die unter dem Feldnamen abgedruckte Stellenfolge
 * (`TTMMJJJJ` bei GEBD, ADAT und RDAT, `LLLPTTMMJJ` bei der
 * Versicherungsnummer). `EVFH` und `EWFH` tragen Beträge in Cent („EURO-Betrag,
 * Angabe in CENT"), dort sind führende Nullen bedeutungslos — kein Marker.
 *
 * Die Feldklassen folgen derselben Auslegung des Zeichensatz-Dokuments wie in
 * Kapitel E.29: Familien- und Vornamen sind Personennamen, Dienstgebername,
 * Telefonnummer und Wohnanschrift fallen unter „Unternehmensnamen und
 * Adressen".
 */
export const FELDER_E12: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'BKNR', pos: 21, laenge: 10, typ: 'a/n' },
  { nr: 3, name: 'DGNA', pos: 31, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 4, name: 'DTEL', pos: 101, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 5, name: 'WOBD', pos: 151, laenge: 12, typ: 'a/n' },
  { nr: 6, name: 'ZOBD', pos: 163, laenge: 15, typ: 'a/n' },
  { nr: 7, name: 'VSNR', pos: 178, laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 8, name: 'GEBD', pos: 188, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 9, name: 'FANA', pos: 196, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 10, name: 'FNA1', pos: 266, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 11, name: 'FNA2', pos: 336, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 12, name: 'VONA', pos: 406, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 13, name: 'AKGR', pos: 476, laenge: 30, typ: 'a/n' },
  { nr: 14, name: 'GESL', pos: 506, laenge: 1, typ: 'n' },
  { nr: 15, name: 'STSL', pos: 507, laenge: 3, typ: 'a/n' },
  { nr: 16, name: 'WKFZ', pos: 510, laenge: 3, typ: 'a/n' },
  { nr: 17, name: 'PLZL', pos: 513, laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 18, name: 'WORT', pos: 522, laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 19, name: 'STRA', pos: 562, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 20, name: 'FAN2', pos: 612, laenge: 70, typ: 'a/n', klasse: 'personenname' },
  { nr: 21, name: 'VON2', pos: 682, laenge: 70, typ: 'a/n', klasse: 'personenname' },
  { nr: 22, name: 'AKG2', pos: 752, laenge: 30, typ: 'a/n' },
  { nr: 23, name: 'ADAT', pos: 782, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 24, name: 'RDAT', pos: 790, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 25, name: 'KART', pos: 798, laenge: 2, typ: 'n' },
  { nr: 26, name: 'EVFH', pos: 800, laenge: 8, typ: 'n' },
  { nr: 27, name: 'EWFH', pos: 808, laenge: 8, typ: 'n' },
  { nr: 28, name: 'REFN', pos: 816, laenge: 30, typ: 'a/n' },
  { nr: 29, name: 'RESE', pos: 846, laenge: 5, typ: 'a/n' },
];
