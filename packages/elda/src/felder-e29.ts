import type { Feld } from './festsatz';

/** Länge des Identifikationsteils laut Kapitel E.1 — in allen Satzarten gleich. */
export const LAENGE_IDENTIFIKATIONSTEIL = 20;

/**
 * Identifikationsteil laut Kapitel E.1. Jeder Satz — Vorlaufsatz, Meldungssatz
 * und Schlusssatz — beginnt mit diesen 20 Zeichen. Alle Angaben sind zwingend.
 */
export const IDENTIFIKATIONSTEIL: readonly Feld[] = [
  { nr: 1, name: 'SART', pos: 1, laenge: 2, typ: 'a/n' },
  { nr: 2, name: 'SANR', pos: 3, laenge: 7, typ: 'n' },
  { nr: 3, name: 'UVST', pos: 10, laenge: 2, typ: 'a/n' },
  { nr: 4, name: 'OBUS', pos: 12, laenge: 7, typ: 'n' },
  { nr: 5, name: 'VSTR', pos: 19, laenge: 2, typ: 'a/n' },
];

/** Satzlänge der Versichertenmeldung reduziert (Kapitel E.29). */
export const SATZLAENGE_E29 = 772;

/**
 * Die 39 Felder der Versichertenmeldung reduziert, Kapitel E.29 der
 * Organisationsbeschreibung (Version 03, zwingend ab 01.02.2026). Reines
 * Datenabbild — Position, Länge und Typ stehen so im Dokument.
 *
 * `format` gibt die stellenscharfe Formatvorgabe wieder, die die Feldtabelle in
 * der Spalte INHALT/BEZEICHNUNG unter dem Feldnamen abdruckt (Seiten 299–301):
 * `TTMMJJJJ` bei allen dreizehn Datumsfeldern — GEBD, ADAT, BDAT, RDAT, EBSV,
 * KEAB, KEBI, UEAB, UEBI, BVAB, BVEN, UMDA, RUMD — und `LLLPTTMMJJ` bei der
 * Versicherungsnummer. Das ist ebenfalls ein Datenabbild und keine Auslegung;
 * die Folge für die Auffüllung steht bei {@link Feld.format}. Bewusst ohne
 * Marker bleiben die übrigen numerischen Felder: VWAZ trägt eine gerundete Zahl
 * (Hundertstelstunden), bei der führende Nullen tatsächlich bedeutungslos sind,
 * und die Feldtabelle druckt dort keine Stellenfolge ab.
 *
 * Die Zuordnung der Feldklasse (`klasse`) ist keine Angabe der Feldtabelle
 * selbst, sondern eine Auslegung des Zeichensatz-Dokuments: `FANA`/`VONA`
 * sind Personennamen, `DGNA`/`DTEL`/`MAIL`/`SAGR` fallen unter
 * Unternehmensnamen und Adressen. Alle übrigen alphanumerischen Felder
 * (Referenzwerte, Codes, freie Informationsfelder) tragen keine Klasse und
 * werden nur auf Darstellbarkeit in ISO-8859-15 geprüft.
 */
export const FELDER_E29: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'REFW', pos: 21, laenge: 40, typ: 'a/n' },
  { nr: 3, name: 'REFU', pos: 61, laenge: 40, typ: 'a/n' },
  { nr: 4, name: 'BKNR', pos: 101, laenge: 10, typ: 'a/n' },
  { nr: 5, name: 'DGNA', pos: 111, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 6, name: 'DTEL', pos: 181, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 7, name: 'MAIL', pos: 231, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 8, name: 'INF1', pos: 291, laenge: 12, typ: 'a/n' },
  { nr: 9, name: 'INF2', pos: 303, laenge: 12, typ: 'a/n' },
  { nr: 10, name: 'VSNR', pos: 315, laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 11, name: 'GEBD', pos: 325, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 12, name: 'REFV', pos: 333, laenge: 40, typ: 'a/n' },
  { nr: 13, name: 'FANA', pos: 373, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 14, name: 'VONA', pos: 443, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 15, name: 'ADAT', pos: 513, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 16, name: 'BDAT', pos: 521, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 17, name: 'RDAT', pos: 529, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 18, name: 'BBER', pos: 537, laenge: 2, typ: 'a/n' },
  { nr: 19, name: 'GERF', pos: 539, laenge: 1, typ: 'a/n' },
  { nr: 20, name: 'FRDV', pos: 540, laenge: 1, typ: 'a/n' },
  { nr: 21, name: 'EBSV', pos: 541, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 22, name: 'AGRD', pos: 549, laenge: 2, typ: 'a/n' },
  { nr: 23, name: 'SAGR', pos: 551, laenge: 20, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 24, name: 'KEAB', pos: 571, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 25, name: 'KEBI', pos: 579, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 26, name: 'UEAB', pos: 587, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 27, name: 'UEBI', pos: 595, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 28, name: 'BVAB', pos: 603, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 29, name: 'BVEN', pos: 611, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 30, name: 'BVJN', pos: 619, laenge: 1, typ: 'a/n' },
  { nr: 31, name: 'UMDA', pos: 620, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 32, name: 'RUMD', pos: 628, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 33, name: 'SOUM', pos: 636, laenge: 1, typ: 'a/n' },
  { nr: 34, name: 'ZTUM', pos: 637, laenge: 2, typ: 'a/n' },
  { nr: 35, name: 'ZKUM', pos: 639, laenge: 10, typ: 'a/n' },
  { nr: 36, name: 'RWUM', pos: 649, laenge: 40, typ: 'a/n' },
  { nr: 37, name: 'RUUM', pos: 689, laenge: 40, typ: 'a/n' },
  { nr: 38, name: 'BKUM', pos: 729, laenge: 40, typ: 'a/n' },
  { nr: 39, name: 'VWAZ', pos: 769, laenge: 4, typ: 'n' },
];
