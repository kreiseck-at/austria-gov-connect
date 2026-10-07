import type { Feld } from './festsatz';

/** Satzlänge der VSNR-Anforderung (Kapitel E.30, Seite 340). */
export const SATZLAENGE_E30 = 688;

/**
 * Die 22 Felder der VSNR-Anforderung, Kapitel E.30 der Organisationsbeschreibung
 * (Version 01, gültig und zwingend ab 01.07.2018). Reines Datenabbild der
 * Feldtabelle auf Seite 340 der 43. Ergänzung; in der 42. Ergänzung steht
 * dieselbe Tabelle auf Seite 329, unverändert.
 *
 * `format` wie in `felder-e29.ts`: `TTMMJJJJ` steht in der Feldtabelle unter
 * GEBD. Die Feldklassen folgen derselben Auslegung des Zeichensatz-Dokuments wie
 * bei E.29 — `FANA`/`FNA1`/`VONA` sind Personennamen, Dienstgeberangaben und die
 * Wohnadresse fallen unter „Unternehmensnamen und Adressen".
 *
 * Kapitel D.12 (Seite 80) nennt für den Ort 40 Stellen, die Feldtabelle von
 * E.30 führt `WORT` mit 50. Für den Satzaufbau gilt die Feldtabelle; ein Ort mit
 * mehr als 40 Zeichen kommt in der Praxis kaum vor.
 */
export const FELDER_E30: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'REFW', pos: 21, laenge: 40, typ: 'a/n' },
  { nr: 3, name: 'BKNR', pos: 61, laenge: 10, typ: 'a/n' },
  { nr: 4, name: 'DGNA', pos: 71, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 5, name: 'DTEL', pos: 141, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 6, name: 'MAIL', pos: 191, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 7, name: 'INF1', pos: 251, laenge: 12, typ: 'a/n' },
  { nr: 8, name: 'INF2', pos: 263, laenge: 12, typ: 'a/n' },
  { nr: 9, name: 'GEBD', pos: 275, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 10, name: 'FANA', pos: 283, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 11, name: 'FNA1', pos: 353, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 12, name: 'VONA', pos: 423, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 13, name: 'AKGV', pos: 493, laenge: 30, typ: 'a/n' },
  { nr: 14, name: 'AKGH', pos: 523, laenge: 30, typ: 'a/n' },
  { nr: 15, name: 'GESL', pos: 553, laenge: 1, typ: 'n' },
  { nr: 16, name: 'STSL', pos: 554, laenge: 3, typ: 'a/n' },
  { nr: 17, name: 'WKFZ', pos: 557, laenge: 3, typ: 'a/n' },
  { nr: 18, name: 'PLZL', pos: 560, laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 19, name: 'WORT', pos: 569, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 20, name: 'WSTR', pos: 619, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 21, name: 'WHNR', pos: 669, laenge: 10, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 22, name: 'WTUR', pos: 679, laenge: 10, typ: 'a/n', klasse: 'unternehmen' },
];
