import type { Feld } from './festsatz';

/** Satzlänge der Adressmeldung Versicherter (Kapitel E.31, Seite 344). */
export const SATZLAENGE_E31 = 416;

/**
 * Die 15 Felder der Adressmeldung Versicherter, Kapitel E.31 der
 * Organisationsbeschreibung (Version 01, gültig ab 01.12.2018, zwingend ab
 * 01.01.2019). Reines Datenabbild der Feldtabelle auf Seite 344 der
 * 43. Ergänzung; in der 42. Ergänzung steht dieselbe Tabelle auf Seite 333,
 * unverändert.
 *
 * Feldklassen und Formatvorgaben wie in `felder-e30.ts`.
 */
export const FELDER_E31: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'REFW', pos: 21, laenge: 40, typ: 'a/n' },
  { nr: 3, name: 'BKNR', pos: 61, laenge: 10, typ: 'a/n' },
  { nr: 4, name: 'DGNA', pos: 71, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 5, name: 'DTEL', pos: 141, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 6, name: 'MAIL', pos: 191, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 7, name: 'INF1', pos: 251, laenge: 12, typ: 'a/n' },
  { nr: 8, name: 'INF2', pos: 263, laenge: 12, typ: 'a/n' },
  { nr: 9, name: 'VSNR', pos: 275, laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 10, name: 'WKFZ', pos: 285, laenge: 3, typ: 'a/n' },
  { nr: 11, name: 'PLZL', pos: 288, laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 12, name: 'WORT', pos: 297, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 13, name: 'WSTR', pos: 347, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 14, name: 'WHNR', pos: 397, laenge: 10, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 15, name: 'WTUR', pos: 407, laenge: 10, typ: 'a/n', klasse: 'unternehmen' },
];
