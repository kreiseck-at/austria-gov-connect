import type { Feld } from './festsatz';

/**
 * Antrag auf zwischenstaatliche Bescheinigung, Kapitel E.27 der
 * Organisationsbeschreibung — Version 08, gültig ab 01.12.2024, zwingender
 * Einsatz ab 01.02.2025. Feldtabelle auf den Seiten 290–295 (43. Ergänzung;
 * in der 42. Ergänzung Seiten 283–288, inhaltlich gleich bis auf den Code
 * `05` für die BVAEB-EB im Feld VTBK).
 *
 * Anders als die Versichertenmeldung ist der Satz nicht flach: Er enthält drei
 * Wiederholungsblöcke mit fester Anzahl an Plätzen.
 *
 * - **Dienstgeber** ab Position 435: 5 Plätze zu je 399 Zeichen (Felder 16–33).
 * - **Selbständige Tätigkeit** ab Position 2718: 3 Plätze zu je 370 Zeichen
 *   (Felder 50–60).
 * - **Arbeitsorte** ab Position 4099: 32 Plätze zu je 153 Zeichen (Felder 68–74).
 *
 * Das Dokument druckt für die Felder innerhalb eines Blocks nur die Länge,
 * keine Position; die Positionen ergeben sich aus Blockbeginn und Reihenfolge.
 * Die Summe stimmt mit dem Dokument überein (Blocklängen 399, 370 und 153,
 * Gesamtlängen 1995, 1110 und 4896, Folgefelder auf 2430, 3828 und 8995) —
 * `pruefeFeldtabelle` stellt das bei jedem Bau sicher.
 *
 * Feldnamen in Blöcken tragen die Platznummer als Suffix: `DGNA_1` bis
 * `DGNA_5`, `AOST_1` bis `AOST_32`. Das ist dieselbe Zählung, die der
 * Prüfkatalog (Blatt ES) in seinen Fehlercodes verwendet (`F7500_1`–`F7500_5`).
 *
 * `klasse` ist wie bei E.29 eine Auslegung des Zeichensatz-Dokuments:
 * Personennamen (`VONA`, `FANA`, `FNA1`) bekommen den engen Vorrat, Namen von
 * Unternehmen, Adressen, Orte, Telefon und Mail den weiteren. Codes, Kennzeichen
 * und Freitexte ohne diese Zuordnung werden nur auf Darstellbarkeit geprüft.
 */

/** Satzlänge des Antrags auf zwischenstaatliche Bescheinigung (Seite 295). */
export const SATZLAENGE_E27 = 9028;

/** Anzahl der Plätze je Block (Seite 295, Absatz unter der Feldtabelle). */
export const PLAETZE_DIENSTGEBER = 5;
export const PLAETZE_SELBSTAENDIG = 3;
export const PLAETZE_ARBEITSORT = 32;

/** Ein Feld innerhalb eines Blocks: Name, Länge, Typ — die Position ergibt sich. */
interface Blockfeld {
  nr: number;
  name: string;
  laenge: number;
  typ: Feld['typ'];
  klasse?: Feld['klasse'];
  format?: Feld['format'];
}

/** Felder 16–33, ein Dienstgeber (Seiten 291–292). Blocklänge 399. */
export const BLOCK_DIENSTGEBER: readonly Blockfeld[] = [
  { nr: 16, name: 'DGNA', laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 17, name: 'BKNR', laenge: 10, typ: 'a/n' },
  { nr: 18, name: 'VTBK', laenge: 2, typ: 'n' },
  { nr: 19, name: 'RESE', laenge: 45, typ: 'a/n' },
  { nr: 20, name: 'DGSTR', laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 21, name: 'DGKFZ', laenge: 2, typ: 'a/n' },
  { nr: 22, name: 'DGPLZ', laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 23, name: 'DGORT', laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 24, name: 'DGTEL', laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 25, name: 'DGMAIL', laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 26, name: 'DGWS', laenge: 2, typ: 'n' },
  { nr: 27, name: 'BBEG', laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 28, name: 'BEND', laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 29, name: 'MARGDG', laenge: 1, typ: 'a' },
  { nr: 30, name: 'BEAT', laenge: 1, typ: 'a' },
  { nr: 31, name: 'RESE', laenge: 38, typ: 'a/n' },
  { nr: 32, name: 'ANKZ', laenge: 1, typ: 'a' },
  { nr: 33, name: 'STAATHB', laenge: 2, typ: 'a' },
];

/** Felder 50–60, eine selbständige Tätigkeit (Seite 293). Blocklänge 370. */
export const BLOCK_SELBSTAENDIG: readonly Blockfeld[] = [
  { nr: 50, name: 'STFNA', laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 51, name: 'STREFO', laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 52, name: 'STSTR', laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 53, name: 'STKFZ', laenge: 2, typ: 'a' },
  { nr: 54, name: 'STPLZ', laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 55, name: 'STORT', laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 56, name: 'STTEL', laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 57, name: 'STMAIL', laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 58, name: 'STAS', laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 59, name: 'START', laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 60, name: 'MARGST', laenge: 1, typ: 'a' },
];

/** Felder 68–74, ein Arbeitsort (Seite 294). Blocklänge 153. */
export const BLOCK_ARBEITSORT: readonly Blockfeld[] = [
  { nr: 68, name: 'AOST', laenge: 2, typ: 'a' },
  { nr: 69, name: 'AOKBS', laenge: 1, typ: 'a' },
  { nr: 70, name: 'AOFNSN', laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 71, name: 'AOSTRA', laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 72, name: 'AOPLZL', laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 73, name: 'AOORT', laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 74, name: 'AUET', laenge: 1, typ: 'a' },
];

/** Feld mit Position, aufgefaltet aus einem Block. */
function falteAuf(block: readonly Blockfeld[], beginn: number, plaetze: number): Feld[] {
  const felder: Feld[] = [];
  let pos = beginn;
  for (let platz = 1; platz <= plaetze; platz++) {
    for (const f of block) {
      felder.push({ ...f, name: `${f.name}_${platz}`, pos });
      pos += f.laenge;
    }
  }
  return felder;
}

/**
 * Die Feldtabelle des Satzes, Blöcke aufgefaltet. Felder außerhalb der Blöcke
 * tragen Position, Länge und Typ wie im Dokument abgedruckt.
 */
export const FELDER_E27: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'MART', pos: 21, laenge: 2, typ: 'n' },
  { nr: 3, name: 'VONA', pos: 23, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 4, name: 'FANA', pos: 93, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 5, name: 'GESL', pos: 163, laenge: 1, typ: 'n' },
  { nr: 6, name: 'GEBD', pos: 164, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 7, name: 'GEBO', pos: 172, laenge: 40, typ: 'a', klasse: 'unternehmen' },
  { nr: 8, name: 'VSNR', pos: 212, laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 9, name: 'STSL', pos: 222, laenge: 2, typ: 'a/n' },
  { nr: 10, name: 'STRA', pos: 224, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 11, name: 'WKFZ', pos: 274, laenge: 2, typ: 'a/n' },
  { nr: 12, name: 'PLZL', pos: 276, laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 13, name: 'WORT', pos: 285, laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 14, name: 'WTEL', pos: 325, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 15, name: 'WMAIL', pos: 375, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  ...falteAuf(BLOCK_DIENSTGEBER, 435, PLAETZE_DIENSTGEBER),
  { nr: 34, name: 'DGPS', pos: 2430, laenge: 1, typ: 'a' },
  { nr: 35, name: 'RESE', pos: 2431, laenge: 1, typ: 'a/n' },
  { nr: 36, name: 'AGSTAAT', pos: 2432, laenge: 2, typ: 'a' },
  { nr: 37, name: 'AGNA', pos: 2434, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 38, name: 'AGSTR', pos: 2504, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 39, name: 'AGPLZ', pos: 2554, laenge: 9, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 40, name: 'AGORT', pos: 2563, laenge: 40, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 41, name: 'BFEST', pos: 2603, laenge: 1, typ: 'a' },
  { nr: 42, name: 'RESE', pos: 2604, laenge: 1, typ: 'a/n' },
  { nr: 43, name: 'RESE', pos: 2605, laenge: 8, typ: 'a/n' },
  { nr: 44, name: 'ANABL', pos: 2613, laenge: 1, typ: 'a' },
  { nr: 45, name: 'ANABLJ', pos: 2614, laenge: 100, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 46, name: 'RESE', pos: 2714, laenge: 1, typ: 'a/n' },
  { nr: 47, name: 'BUEL', pos: 2715, laenge: 1, typ: 'a' },
  { nr: 48, name: 'RESE', pos: 2716, laenge: 1, typ: 'a/n' },
  { nr: 49, name: 'ANATJ', pos: 2717, laenge: 1, typ: 'a' },
  ...falteAuf(BLOCK_SELBSTAENDIG, 2718, PLAETZE_SELBSTAENDIG),
  { nr: 61, name: 'UIDM', pos: 3828, laenge: 40, typ: 'a/n' },
  { nr: 62, name: 'UIDU', pos: 3868, laenge: 40, typ: 'a/n' },
  { nr: 63, name: 'FNA1', pos: 3908, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 64, name: 'ANIV', pos: 3978, laenge: 1, typ: 'a' },
  { nr: 65, name: 'VSNA', pos: 3979, laenge: 40, typ: 'a/n' },
  { nr: 66, name: 'APNR', pos: 4019, laenge: 40, typ: 'a/n' },
  { nr: 67, name: 'AAKT', pos: 4059, laenge: 40, typ: 'a/n' },
  ...falteAuf(BLOCK_ARBEITSORT, 4099, PLAETZE_ARBEITSORT),
  { nr: 75, name: 'AZRV', pos: 8995, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 76, name: 'AZRB', pos: 9003, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 77, name: 'ANFL', pos: 9011, laenge: 1, typ: 'a' },
  { nr: 78, name: 'AUSMTE', pos: 9012, laenge: 1, typ: 'a' },
  { nr: 79, name: 'ANTVON', pos: 9013, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 80, name: 'ANTBIS', pos: 9021, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
];
