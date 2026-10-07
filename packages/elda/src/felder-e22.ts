import type { Feld } from './festsatz';

/** Satzlänge der Schwerarbeitsmeldung (Kapitel E.22, Seite 268 der 43. Ergänzung, 261 der 42.). */
export const SATZLAENGE_E22 = 800;

/** Anzahl der Tätigkeitsblöcke je Satz: „BLOCK FÜR 26 TÄTIGKEITEN" (Kapitel E.22, Seite 267 der 43. Ergänzung, 260 der 42.). */
export const TAETIGKEITSBLOECKE = 26;

/** Länge eines Tätigkeitsblocks: „Länge für einen Tätigkeitsblock 10 Stellen". */
const BLOCKLAENGE = 10;

/** Erste Position des Blocks für die 26 Tätigkeiten. */
const BLOCKBEGINN = 502;

/**
 * Die Felder eines Tätigkeitsblocks mit der Nummer `n` (1 bis 26). Das Dokument
 * führt TART, TVON und TBIS einmal als Feld 17–19 und schreibt dazu „BLOCK FÜR
 * 26 TÄTIGKEITEN"; je Block heißen die Felder hier `TART_n`, `TVON_n` und
 * `TBIS_n`. Dieselbe Zählung verwendet der Prüfkatalog in seinen Codes
 * (`F5511_1` – `F5511_26` usw.).
 */
function block(n: number): Feld[] {
  const pos = BLOCKBEGINN + (n - 1) * BLOCKLAENGE;
  return [
    { nr: 17, name: `TART_${n}`, pos, laenge: 2, typ: 'a/n' },
    { nr: 18, name: `TVON_${n}`, pos: pos + 2, laenge: 4, typ: 'n', format: 'TTMM' },
    { nr: 19, name: `TBIS_${n}`, pos: pos + 6, laenge: 4, typ: 'n', format: 'TTMM' },
  ];
}

/**
 * Die Felder der Schwerarbeitsmeldung, Kapitel E.22 der
 * Organisationsbeschreibung (Version 02, gültig ab 20.12.2010, zwingend ab
 * 17.01.2011; Seiten 267–268 der 43. Ergänzung, Seiten 260–261 der 42. — der
 * Inhalt ist in beiden Ausgaben gleich). Reines Datenabbild.
 *
 * Felder 1–16 und 20–21 einmal, die Felder 17–19 als 26 Tätigkeitsblöcke zu je
 * zehn Stellen (Positionen 502–761). `JAHR` trägt laut Dokument `JJJJ`, `TVON`
 * und `TBIS` tragen `TTMM` — beides als Formatmarker übernommen.
 */
export const FELDER_E22: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'BKNR', pos: 21, laenge: 10, typ: 'a/n' },
  { nr: 3, name: 'DGNA', pos: 31, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 4, name: 'WOBD', pos: 101, laenge: 12, typ: 'a/n' },
  { nr: 5, name: 'ZOBD', pos: 113, laenge: 15, typ: 'a/n' },
  { nr: 6, name: 'DTEL', pos: 128, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 7, name: 'MAIL', pos: 178, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 8, name: 'DKFZ', pos: 238, laenge: 3, typ: 'a/n' },
  { nr: 9, name: 'DPLZ', pos: 241, laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 10, name: 'DORT', pos: 250, laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 11, name: 'DSTR', pos: 290, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 12, name: 'VSNR', pos: 340, laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 13, name: 'GEBD', pos: 350, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 14, name: 'FANA', pos: 358, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 15, name: 'VONA', pos: 428, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 16, name: 'JAHR', pos: 498, laenge: 4, typ: 'n', format: 'JJJJ' },
  ...Array.from({ length: TAETIGKEITSBLOECKE }, (_, i) => block(i + 1)).flat(),
  { nr: 20, name: 'REFN', pos: 762, laenge: 30, typ: 'a/n' },
  { nr: 21, name: 'RESE', pos: 792, laenge: 9, typ: 'a/n' },
];
