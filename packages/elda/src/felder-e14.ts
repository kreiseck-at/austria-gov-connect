import type { Feld } from './festsatz';

/**
 * Lohnzettel Finanz – Mitteilungssatz, Satzart `L1`, Kapitel E.14 der
 * Organisationsbeschreibung. Ein Satz ist ein Lohnzettel L16.
 *
 * Zwei Fassungen sind belegt, beide mit 3500 Zeichen:
 *
 * | Version | Quelle | gültig ab | zwingend ab | fachlich für Zeiträume ab |
 * |---|---|---|---|---|
 * | 28 | 42. Ergänzung, Seiten 223–237 | 01.01.2026 | 01.03.2026 | 01.01.2024 |
 * | 29 | 43. Ergänzung, Seiten 229–244 | 01.01.2027 | 01.03.2027 | 01.01.2027 |
 *
 * Die Felder 1–194 sind in beiden Fassungen an Position, Länge und Typ gleich.
 * Version 29 ändert dreierlei:
 *
 * - Die Vorzeichenfelder `VIEL`, `VABL` und `V260` lassen zusätzlich „-" zu.
 * - Auf Position 1194 stehen statt einer Reserve fünf neue Felder: `SBK37`
 *   (Sachbezug Kfz 0,375 %), `TALV` (Telearbeitsvereinbarung), `AKFB`, `AKFH`
 *   und `AKFK` (Aktivitätsfreibetrag nach § 105a).
 * - Der Kinderblock kennt den Familienbonus Plus zu 100, 50, 25 und 75 % und
 *   einen variablen Satz; Version 28 nur „ganzer" und „halber".
 *
 * **Namen.** Ein Feldname ist zugleich Schlüssel im Werte-Objekt und muss im
 * Satz eindeutig sein. Wo das Dokument einen Namen mehrfach vergibt, steht die
 * Feldnummer dahinter: die Reservefelder heißen `RESE_51`, `RESE_52` usw., und
 * Feld 175 („Referenznummer", vom Softwarehersteller zu befüllen, kommt in der
 * Rückantwort zurück) heißt `REFN_175` — Feld 11 behält den Namen `REFN`
 * („Referenznummer Finanz"). Die Felder des Kinderblocks tragen die Nummer
 * des Kindes: `KFAM_K1` bis `KFAM_K15`.
 *
 * Feldnummern 5, 100 und 133 vergibt das Dokument nicht; sie fehlen hier wie
 * dort.
 */

/** Satzlänge des Mitteilungssatzes (Kapitel E.14). */
export const SATZLAENGE_L1 = 3500;

/** Belegte Lohnzettelversionen (einheitliche Versionsnummer laut Kapitel B.3). */
export type Lohnzettelversion = '28' | '29';

/** Eckdaten je Version, wörtlich aus dem Kopf von Kapitel E.14. */
export const LOHNZETTELVERSION: Readonly<
  Record<Lohnzettelversion, { gueltigAb: string; zwingendAb: string; fachlichAbJahr: number; quelle: string }>
> = {
  '28': {
    gueltigAb: '01.01.2026',
    zwingendAb: '01.03.2026',
    fachlichAbJahr: 2024,
    quelle: 'DM-Org 42. Ergänzung (07/2026), Kapitel E.13/E.14, Seiten 219–237',
  },
  '29': {
    gueltigAb: '01.01.2027',
    zwingendAb: '01.03.2027',
    fachlichAbJahr: 2027,
    quelle: 'DM-Org 43. Ergänzung (09/2026), Kapitel E.13/E.14, Seiten 225–244',
  },
};

/** Anzahl der Kinderblöcke (Seite 232 bzw. 239: „Block für 15 Kinder"). */
export const KINDERBLOECKE = 15;

/** Länge eines Kinderblocks („Blocklänge pro Kind 123"). */
export const LAENGE_KINDERBLOCK = 123;

/** Startposition des Kinderblocks. */
const POS_KINDERBLOCK = 1501;

/** Felder 1–194, in beiden Versionen gleich. */
const GEMEINSAM: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'FSART', pos: 21, laenge: 1, typ: 'a/n' },
  { nr: 3, name: 'CLADR', pos: 22, laenge: 6, typ: 'a/n' },
  { nr: 4, name: 'CLDVR', pos: 28, laenge: 7, typ: 'a/n' },
  { nr: 6, name: 'STNRL', pos: 35, laenge: 9, typ: 'n' },
  { nr: 7, name: 'DVRNL', pos: 44, laenge: 7, typ: 'n' },
  { nr: 8, name: 'ARTU', pos: 51, laenge: 1, typ: 'a/n' },
  { nr: 9, name: 'DTUE', pos: 52, laenge: 8, typ: 'n', format: 'JJJJMMTT' },
  { nr: 10, name: 'ZTUE', pos: 60, laenge: 6, typ: 'n', format: 'HHMMSS' },
  { nr: 11, name: 'REFN', pos: 66, laenge: 30, typ: 'a/n' },
  { nr: 12, name: 'ARTL', pos: 96, laenge: 2, typ: 'n' },
  { nr: 13, name: 'FEHL', pos: 98, laenge: 20, typ: 'a/n' },
  { nr: 14, name: 'STAT', pos: 118, laenge: 1, typ: 'a/n' },
  { nr: 15, name: 'FIND', pos: 119, laenge: 1, typ: 'a' },
  { nr: 16, name: 'BELZ', pos: 120, laenge: 4, typ: 'n', format: 'TTMM' },
  { nr: 17, name: 'ENLZ', pos: 124, laenge: 4, typ: 'n', format: 'TTMM' },
  { nr: 18, name: 'JALZ', pos: 128, laenge: 4, typ: 'n', format: 'JJJJ' },
  { nr: 19, name: 'SOZS', pos: 132, laenge: 1, typ: 'n' },
  { nr: 20, name: 'AVLN', pos: 133, laenge: 4, typ: 'n', format: 'LLLP' },
  { nr: 21, name: 'AGBD', pos: 137, laenge: 6, typ: 'n', format: 'TTMMJJ' },
  { nr: 22, name: 'ANAM', pos: 143, laenge: 37, typ: 'a', klasse: 'personenname' },
  { nr: 23, name: 'ATIT', pos: 180, laenge: 20, typ: 'a' },
  { nr: 24, name: 'AADR', pos: 200, laenge: 37, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 25, name: 'ALKZ', pos: 237, laenge: 3, typ: 'a' },
  { nr: 26, name: 'APLZ', pos: 240, laenge: 10, typ: 'a/n' },
  { nr: 27, name: 'AORT', pos: 250, laenge: 30, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 28, name: 'GESW', pos: 280, laenge: 1, typ: 'a' },
  { nr: 29, name: 'GESM', pos: 281, laenge: 1, typ: 'a' },
  { nr: 30, name: 'GESD', pos: 282, laenge: 1, typ: 'a' },
  { nr: 31, name: 'VOLL', pos: 283, laenge: 1, typ: 'a' },
  { nr: 32, name: 'TEIL', pos: 284, laenge: 1, typ: 'a' },
  { nr: 33, name: 'AVAB', pos: 285, laenge: 1, typ: 'a' },
  { nr: 34, name: 'PVLN', pos: 286, laenge: 4, typ: 'n', format: 'LLLP' },
  { nr: 35, name: 'PGBD', pos: 290, laenge: 6, typ: 'n', format: 'TTMMJJ' },
  { nr: 36, name: 'AEAB', pos: 296, laenge: 1, typ: 'a' },
  { nr: 37, name: 'V210', pos: 297, laenge: 1, typ: 'a' },
  { nr: 38, name: 'B210', pos: 298, laenge: 10, typ: 'n' },
  { nr: 39, name: 'V215', pos: 308, laenge: 1, typ: 'a' },
  { nr: 40, name: 'B215', pos: 309, laenge: 10, typ: 'n' },
  { nr: 41, name: 'V220', pos: 319, laenge: 1, typ: 'a' },
  { nr: 42, name: 'B220', pos: 320, laenge: 10, typ: 'n' },
  { nr: 43, name: 'VIEB', pos: 330, laenge: 1, typ: 'a' },
  { nr: 44, name: 'BIEB', pos: 331, laenge: 10, typ: 'n' },
  { nr: 45, name: 'V225', pos: 341, laenge: 1, typ: 'a' },
  { nr: 46, name: 'B225', pos: 342, laenge: 10, typ: 'n' },
  { nr: 47, name: 'V226', pos: 352, laenge: 1, typ: 'a' },
  { nr: 48, name: 'B226', pos: 353, laenge: 10, typ: 'n' },
  { nr: 49, name: 'V230', pos: 363, laenge: 1, typ: 'a' },
  { nr: 50, name: 'B230', pos: 364, laenge: 10, typ: 'n' },
  { nr: 51, name: 'RESE_51', pos: 374, laenge: 1, typ: 'a' },
  { nr: 52, name: 'RESE_52', pos: 375, laenge: 10, typ: 'n' },
  { nr: 53, name: 'VAUS', pos: 385, laenge: 1, typ: 'a' },
  { nr: 54, name: 'BAUS', pos: 386, laenge: 10, typ: 'n' },
  { nr: 55, name: 'VPEN', pos: 396, laenge: 1, typ: 'a' },
  { nr: 56, name: 'BPEN', pos: 397, laenge: 10, typ: 'n' },
  { nr: 57, name: 'VEFB', pos: 407, laenge: 1, typ: 'a' },
  { nr: 58, name: 'BEFB', pos: 408, laenge: 10, typ: 'n' },
  { nr: 59, name: 'VSTF', pos: 418, laenge: 1, typ: 'a' },
  { nr: 60, name: 'BSTF', pos: 419, laenge: 10, typ: 'n' },
  { nr: 61, name: 'VSSB', pos: 429, laenge: 1, typ: 'a' },
  { nr: 62, name: 'BSSB', pos: 430, laenge: 10, typ: 'n' },
  { nr: 63, name: 'V243', pos: 440, laenge: 1, typ: 'a' },
  { nr: 64, name: 'B243', pos: 441, laenge: 10, typ: 'n' },
  { nr: 65, name: 'V245', pos: 451, laenge: 1, typ: 'a' },
  { nr: 66, name: 'B245', pos: 452, laenge: 10, typ: 'n' },
  { nr: 67, name: 'VIEL', pos: 462, laenge: 1, typ: 'a' },
  { nr: 68, name: 'BIEL', pos: 463, laenge: 10, typ: 'n' },
  { nr: 69, name: 'VABL', pos: 473, laenge: 1, typ: 'a' },
  { nr: 70, name: 'BABL', pos: 474, laenge: 10, typ: 'n' },
  { nr: 71, name: 'V260', pos: 484, laenge: 1, typ: 'a' },
  { nr: 72, name: 'B260', pos: 485, laenge: 10, typ: 'n' },
  { nr: 73, name: 'VSOB', pos: 495, laenge: 1, typ: 'a' },
  { nr: 74, name: 'BSOB', pos: 496, laenge: 10, typ: 'n' },
  { nr: 75, name: 'VFB1', pos: 506, laenge: 1, typ: 'a' },
  { nr: 76, name: 'BFB1', pos: 507, laenge: 10, typ: 'n' },
  { nr: 77, name: 'RESE_77', pos: 517, laenge: 10, typ: 'a/n' },
  { nr: 78, name: 'VFB2', pos: 527, laenge: 1, typ: 'a' },
  { nr: 79, name: 'BFB2', pos: 528, laenge: 10, typ: 'n' },
  { nr: 80, name: 'VAUF', pos: 538, laenge: 1, typ: 'a' },
  { nr: 81, name: 'BAUF', pos: 539, laenge: 10, typ: 'n' },
  { nr: 82, name: 'VFB3', pos: 549, laenge: 1, typ: 'a' },
  { nr: 83, name: 'BFB3', pos: 550, laenge: 10, typ: 'n' },
  { nr: 84, name: 'VNEB', pos: 560, laenge: 1, typ: 'a' },
  { nr: 85, name: 'BNEB', pos: 561, laenge: 10, typ: 'n' },
  { nr: 86, name: 'PVON', pos: 571, laenge: 2, typ: 'n' },
  { nr: 87, name: 'PBIS', pos: 573, laenge: 2, typ: 'n' },
  { nr: 88, name: 'VPFG', pos: 575, laenge: 1, typ: 'a' },
  { nr: 89, name: 'BPFG', pos: 576, laenge: 10, typ: 'n' },
  { nr: 90, name: 'VSFB', pos: 586, laenge: 1, typ: 'a' },
  { nr: 91, name: 'BSFB', pos: 587, laenge: 10, typ: 'n' },
  { nr: 92, name: 'RESE_92', pos: 597, laenge: 1, typ: 'a' },
  { nr: 93, name: 'RESE_93', pos: 598, laenge: 10, typ: 'n' },
  { nr: 94, name: 'RESE_94', pos: 608, laenge: 1, typ: 'a' },
  { nr: 95, name: 'RESE_95', pos: 609, laenge: 10, typ: 'n' },
  { nr: 96, name: 'RESE_96', pos: 619, laenge: 1, typ: 'a' },
  { nr: 97, name: 'RESE_97', pos: 620, laenge: 10, typ: 'n' },
  { nr: 98, name: 'RESE_98', pos: 630, laenge: 1, typ: 'a' },
  { nr: 99, name: 'RESE_99', pos: 631, laenge: 8, typ: 'n' },
  { nr: 101, name: 'STNRA', pos: 639, laenge: 9, typ: 'n' },
  { nr: 102, name: 'DVRNA', pos: 648, laenge: 7, typ: 'n' },
  { nr: 103, name: 'ANME', pos: 655, laenge: 1, typ: 'a' },
  { nr: 104, name: 'KORR', pos: 656, laenge: 1, typ: 'a' },
  { nr: 105, name: 'VUEB', pos: 657, laenge: 1, typ: 'a' },
  { nr: 106, name: 'BUEB', pos: 658, laenge: 10, typ: 'n' },
  { nr: 107, name: 'INTE', pos: 668, laenge: 11, typ: 'a/n' },
  { nr: 108, name: 'WOBD', pos: 679, laenge: 12, typ: 'a/n' },
  { nr: 109, name: 'ZOBD', pos: 691, laenge: 15, typ: 'a/n' },
  { nr: 110, name: 'ANZK', pos: 706, laenge: 2, typ: 'n' },
  { nr: 111, name: 'RESE_111', pos: 708, laenge: 1, typ: 'a/n' },
  { nr: 112, name: 'RESE_112', pos: 709, laenge: 1, typ: 'a/n' },
  { nr: 113, name: 'RESE_113', pos: 710, laenge: 1, typ: 'a/n' },
  { nr: 114, name: 'RESE_114', pos: 711, laenge: 1, typ: 'a/n' },
  { nr: 115, name: 'RESE_115', pos: 712, laenge: 1, typ: 'a/n' },
  { nr: 116, name: 'RESE_116', pos: 713, laenge: 1, typ: 'a/n' },
  { nr: 117, name: 'RESE_117', pos: 714, laenge: 1, typ: 'a/n' },
  { nr: 118, name: 'RESE_118', pos: 715, laenge: 1, typ: 'a/n' },
  { nr: 119, name: 'RESE_119', pos: 716, laenge: 1, typ: 'a/n' },
  { nr: 120, name: 'RESE_120', pos: 717, laenge: 1, typ: 'a/n' },
  { nr: 121, name: 'RESE_121', pos: 718, laenge: 1, typ: 'a/n' },
  { nr: 122, name: 'RESE_122', pos: 719, laenge: 1, typ: 'a/n' },
  { nr: 123, name: 'VAPK', pos: 720, laenge: 1, typ: 'a' },
  { nr: 124, name: 'BAPK', pos: 721, laenge: 10, typ: 'n' },
  { nr: 125, name: 'EPAB', pos: 731, laenge: 1, typ: 'a' },
  { nr: 126, name: 'VENT', pos: 732, laenge: 1, typ: 'a' },
  { nr: 127, name: 'ENTW', pos: 733, laenge: 10, typ: 'n' },
  { nr: 128, name: 'VPRE', pos: 743, laenge: 1, typ: 'a' },
  { nr: 129, name: 'PREI', pos: 744, laenge: 10, typ: 'n' },
  { nr: 130, name: 'WERK', pos: 754, laenge: 2, typ: 'n' },
  { nr: 131, name: 'VPEND', pos: 756, laenge: 1, typ: 'a' },
  { nr: 132, name: 'BPEND', pos: 757, laenge: 10, typ: 'n' },
  { nr: 134, name: 'UEBMO', pos: 767, laenge: 2, typ: 'n' },
  { nr: 135, name: 'RESE_135', pos: 769, laenge: 1, typ: 'a' },
  { nr: 136, name: 'RESE_136', pos: 770, laenge: 10, typ: 'n' },
  { nr: 137, name: 'LDKZA', pos: 780, laenge: 3, typ: 'a/n' },
  { nr: 138, name: 'VWBKB', pos: 783, laenge: 1, typ: 'a' },
  { nr: 139, name: 'WBKB', pos: 784, laenge: 10, typ: 'n' },
  { nr: 140, name: 'RESE_140', pos: 794, laenge: 1, typ: 'a/n' },
  { nr: 141, name: 'RESE_141', pos: 795, laenge: 10, typ: 'a/n' },
  { nr: 142, name: 'ERVAB', pos: 805, laenge: 1, typ: 'a' },
  { nr: 143, name: 'BFABO', pos: 806, laenge: 1, typ: 'a' },
  { nr: 144, name: 'KFABO', pos: 807, laenge: 2, typ: 'n' },
  { nr: 145, name: 'VFABO', pos: 809, laenge: 1, typ: 'a' },
  { nr: 146, name: 'FABO', pos: 810, laenge: 10, typ: 'n' },
  { nr: 147, name: 'HOTA', pos: 820, laenge: 3, typ: 'n' },
  { nr: 148, name: 'VHOPA', pos: 823, laenge: 1, typ: 'a' },
  { nr: 149, name: 'HOPA', pos: 824, laenge: 10, typ: 'n' },
  { nr: 150, name: 'VKOUN', pos: 834, laenge: 1, typ: 'a' },
  { nr: 151, name: 'KOUN', pos: 835, laenge: 10, typ: 'n' },
  { nr: 152, name: 'VMAGB', pos: 845, laenge: 1, typ: 'a' },
  { nr: 153, name: 'MAGB', pos: 846, laenge: 10, typ: 'n' },
  { nr: 154, name: 'FLABZ', pos: 856, laenge: 1, typ: 'a' },
  { nr: 155, name: 'AUEZG', pos: 857, laenge: 1, typ: 'a' },
  { nr: 156, name: 'VTEPR', pos: 858, laenge: 1, typ: 'a' },
  { nr: 157, name: 'TEPR', pos: 859, laenge: 10, typ: 'n' },
  { nr: 158, name: 'VMAPR', pos: 869, laenge: 1, typ: 'a' },
  { nr: 159, name: 'MAPR', pos: 870, laenge: 10, typ: 'n' },
  { nr: 160, name: 'STUM', pos: 880, laenge: 4, typ: 'n' },
  { nr: 161, name: 'STUMJ', pos: 884, laenge: 4, typ: 'n' },
  { nr: 162, name: 'ZF673', pos: 888, laenge: 1, typ: 'a' },
  { nr: 163, name: 'BDOZ', pos: 889, laenge: 1, typ: 'a' },
  { nr: 164, name: 'VFSVB', pos: 890, laenge: 1, typ: 'a' },
  { nr: 165, name: 'FSVB', pos: 891, laenge: 10, typ: 'n' },
  { nr: 166, name: 'PLST', pos: 901, laenge: 1, typ: 'a' },
  { nr: 167, name: 'VKAKL', pos: 902, laenge: 1, typ: 'a' },
  { nr: 168, name: 'KAKL', pos: 903, laenge: 10, typ: 'n' },
  { nr: 169, name: 'VZUKB', pos: 913, laenge: 1, typ: 'a' },
  { nr: 170, name: 'ZUKB', pos: 914, laenge: 10, typ: 'n' },
  { nr: 171, name: 'GEBD', pos: 924, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 172, name: 'GEBP', pos: 932, laenge: 8, typ: 'n', format: 'TTMMJJJJ' },
  { nr: 173, name: 'AKZKB', pos: 940, laenge: 2, typ: 'n' },
  { nr: 174, name: 'RESE_174', pos: 942, laenge: 59, typ: 'a/n' },
  { nr: 175, name: 'REFN_175', pos: 1001, laenge: 30, typ: 'a/n' },
  { nr: 176, name: 'RESE_176', pos: 1031, laenge: 19, typ: 'a/n' },
  { nr: 177, name: 'BSBKFZ', pos: 1050, laenge: 10, typ: 'n' },
  { nr: 178, name: 'BSBWR', pos: 1060, laenge: 10, typ: 'n' },
  { nr: 179, name: 'BSBSB', pos: 1070, laenge: 10, typ: 'n' },
  { nr: 180, name: 'SB681', pos: 1080, laenge: 10, typ: 'n' },
  { nr: 181, name: 'SB682', pos: 1090, laenge: 10, typ: 'n' },
  { nr: 182, name: 'BZUKG', pos: 1100, laenge: 10, typ: 'n' },
  { nr: 183, name: 'MAKBG', pos: 1110, laenge: 10, typ: 'n' },
  { nr: 184, name: 'MABST', pos: 1120, laenge: 10, typ: 'n' },
  { nr: 185, name: 'ZUCSG', pos: 1130, laenge: 10, typ: 'n' },
  { nr: 186, name: 'GUTSC', pos: 1140, laenge: 10, typ: 'n' },
  { nr: 187, name: 'MARAB', pos: 1150, laenge: 10, typ: 'n' },
  { nr: 188, name: 'SBK00', pos: 1160, laenge: 1, typ: 'a' },
  { nr: 189, name: 'SBK15', pos: 1161, laenge: 1, typ: 'a' },
  { nr: 190, name: 'SBK20', pos: 1162, laenge: 1, typ: 'a' },
  { nr: 191, name: 'SBKDW', pos: 1163, laenge: 1, typ: 'a' },
  { nr: 192, name: 'AKKFZ', pos: 1164, laenge: 10, typ: 'n' },
  { nr: 193, name: 'KEAKFZ', pos: 1174, laenge: 10, typ: 'n' },
  { nr: 194, name: 'AGLAG', pos: 1184, laenge: 10, typ: 'n' },
];

/** Version 28: Position 1194–1500 ist Reserve. */
const ANHANG_28: readonly Feld[] = [{ nr: 195, name: 'RESE_195', pos: 1194, laenge: 307, typ: 'a/n' }];

/** Version 29: fünf neue Felder ab Position 1194, danach Reserve. */
const ANHANG_29: readonly Feld[] = [
  { nr: 195, name: 'SBK37', pos: 1194, laenge: 1, typ: 'a' },
  { nr: 196, name: 'TALV', pos: 1195, laenge: 1, typ: 'a' },
  { nr: 197, name: 'AKFB', pos: 1196, laenge: 10, typ: 'n' },
  { nr: 198, name: 'AKFH', pos: 1206, laenge: 10, typ: 'n' },
  { nr: 199, name: 'AKFK', pos: 1216, laenge: 2, typ: 'n' },
  { nr: 200, name: 'RESE_200', pos: 1218, laenge: 283, typ: 'a/n' },
];

/** Ein Feld des Kinderblocks — ohne Position, die ergibt sich aus Block und Reihenfolge. */
type Kindfeld = Omit<Feld, 'pos'>;

/** Kinderblock Version 28, Felder 196–209. */
const KIND_28: readonly Kindfeld[] = [
  { nr: 196, name: 'KFAM', laenge: 30, typ: 'a', klasse: 'personenname' },
  { nr: 197, name: 'KVON', laenge: 30, typ: 'a', klasse: 'personenname' },
  { nr: 198, name: 'KSTAAT', laenge: 3, typ: 'a' },
  { nr: 199, name: 'KSTWE', laenge: 1, typ: 'a' },
  { nr: 200, name: 'KVSNR', laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 201, name: 'KGEBD', laenge: 8, typ: 'n' },
  { nr: 202, name: 'KAFBZ', laenge: 1, typ: 'a' },
  { nr: 203, name: 'KAPFB', laenge: 1, typ: 'a' },
  { nr: 204, name: 'KAUHZ', laenge: 1, typ: 'a' },
  { nr: 205, name: 'KBGFP', laenge: 2, typ: 'n' },
  { nr: 206, name: 'KEGFP', laenge: 2, typ: 'n' },
  { nr: 207, name: 'KBHFP', laenge: 2, typ: 'n' },
  { nr: 208, name: 'KEHFP', laenge: 2, typ: 'n' },
  { nr: 209, name: 'RESE', laenge: 30, typ: 'a/n' },
];

/** Kinderblock Version 29, Felder 201–221. */
const KIND_29: readonly Kindfeld[] = [
  { nr: 201, name: 'KFAM', laenge: 30, typ: 'a', klasse: 'personenname' },
  { nr: 202, name: 'KVON', laenge: 30, typ: 'a', klasse: 'personenname' },
  { nr: 203, name: 'KSTAAT', laenge: 3, typ: 'a' },
  { nr: 204, name: 'KSTWE', laenge: 1, typ: 'a' },
  { nr: 205, name: 'KVSNR', laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 206, name: 'KGEBD', laenge: 8, typ: 'n' },
  { nr: 207, name: 'KAFBZ', laenge: 1, typ: 'a' },
  { nr: 208, name: 'KAPFB', laenge: 1, typ: 'a' },
  { nr: 209, name: 'KAUHZ', laenge: 1, typ: 'a' },
  { nr: 210, name: 'KBGFP', laenge: 2, typ: 'n' },
  { nr: 211, name: 'KEGFP', laenge: 2, typ: 'n' },
  { nr: 212, name: 'KBHFP', laenge: 2, typ: 'n' },
  { nr: 213, name: 'KEHFP', laenge: 2, typ: 'n' },
  { nr: 214, name: 'KBVFP', laenge: 2, typ: 'n' },
  { nr: 215, name: 'KEVFP', laenge: 2, typ: 'n' },
  { nr: 216, name: 'KBDFP', laenge: 2, typ: 'n' },
  { nr: 217, name: 'KEDFP', laenge: 2, typ: 'n' },
  { nr: 218, name: 'KVRFP', laenge: 3, typ: 'n' },
  { nr: 219, name: 'KBRFP', laenge: 2, typ: 'n' },
  { nr: 220, name: 'KERFP', laenge: 2, typ: 'n' },
  { nr: 221, name: 'RESE', laenge: 15, typ: 'a/n' },
];

/**
 * Faltet die Blockbeschreibung in 15 aufeinanderfolgende Blöcke ab Position
 * 1501 aus. Das Dokument druckt die Felder einmal und ohne Position ab; die
 * Positionen der Blöcke 2–15 ergeben sich aus der Blocklänge 123.
 */
function kinderbloecke(block: readonly Kindfeld[]): Feld[] {
  const felder: Feld[] = [];
  let pos = POS_KINDERBLOCK;
  for (let kind = 1; kind <= KINDERBLOECKE; kind++) {
    for (const f of block) {
      const basis = f.name === 'RESE' ? `RESE_${f.nr}` : f.name;
      felder.push({ ...f, name: `${basis}_K${kind}`, pos });
      pos += f.laenge;
    }
  }
  return felder;
}

/** Name eines Feldes im Kinderblock, z. B. `kindfeld('KFAM', 1)` → `'KFAM_K1'`. */
export function kindfeld(name: string, kind: number): string {
  return `${name}_K${kind}`;
}

/** Feldnamen des Kinderblocks je Version, ohne Reserve und ohne Kindnummer. */
export const KINDFELDER: Readonly<Record<Lohnzettelversion, readonly string[]>> = {
  '28': KIND_28.filter((f) => f.name !== 'RESE').map((f) => f.name),
  '29': KIND_29.filter((f) => f.name !== 'RESE').map((f) => f.name),
};

/** Felder des Mitteilungssatzes je Version. */
export const FELDER_L1: Readonly<Record<Lohnzettelversion, readonly Feld[]>> = {
  '28': [
    ...GEMEINSAM,
    ...ANHANG_28,
    ...kinderbloecke(KIND_28),
    { nr: 210, name: 'RESE_210', pos: 3346, laenge: 155, typ: 'a/n' },
  ],
  '29': [
    ...GEMEINSAM,
    ...ANHANG_29,
    ...kinderbloecke(KIND_29),
    { nr: 222, name: 'RESE_222', pos: 3346, laenge: 155, typ: 'a/n' },
  ],
};

/** Ein Betragsfeld mit seinem Vorzeichenfeld und den zulässigen Vorzeichen. */
export interface Vorzeichenregel {
  vorzeichen: string;
  erlaubt: readonly ('+' | '-')[];
}

/**
 * Die 40 Paare aus Vorzeichen- und Betragsfeld, je Version. Die zulässigen
 * Vorzeichen stehen in der Feldtabelle unter dem Vorzeichenfeld („„+" oder
 * blank" bzw. „„+" oder „-" oder blank").
 *
 * Die Regel dazu (Seite 233 bzw. 240): „Das Vorzeichenfeld muss ‘blank’ sein,
 * wenn das nachfolgende Betragsfeld 0 ist. Hat das nachfolgende Betragsfeld
 * einen Wert ungleich 0, muss im davor liegenden Vorzeichenfeld ein zulässiges
 * Vorzeichen (lt. Angabe) eingetragen sein."
 */
export const VORZEICHEN_L1: Readonly<Record<Lohnzettelversion, Readonly<Record<string, Vorzeichenregel>>>> = {
  '28': {
    B210: { vorzeichen: 'V210', erlaubt: ['+'] },
    B215: { vorzeichen: 'V215', erlaubt: ['+'] },
    B220: { vorzeichen: 'V220', erlaubt: ['+', '-'] },
    BIEB: { vorzeichen: 'VIEB', erlaubt: ['+', '-'] },
    B225: { vorzeichen: 'V225', erlaubt: ['+'] },
    B226: { vorzeichen: 'V226', erlaubt: ['+'] },
    B230: { vorzeichen: 'V230', erlaubt: ['+'] },
    BAUS: { vorzeichen: 'VAUS', erlaubt: ['+'] },
    BPEN: { vorzeichen: 'VPEN', erlaubt: ['+'] },
    BEFB: { vorzeichen: 'VEFB', erlaubt: ['+'] },
    BSTF: { vorzeichen: 'VSTF', erlaubt: ['+'] },
    BSSB: { vorzeichen: 'VSSB', erlaubt: ['+', '-'] },
    B243: { vorzeichen: 'V243', erlaubt: ['+', '-'] },
    B245: { vorzeichen: 'V245', erlaubt: ['+', '-'] },
    BIEL: { vorzeichen: 'VIEL', erlaubt: ['+'] },
    BABL: { vorzeichen: 'VABL', erlaubt: ['+'] },
    B260: { vorzeichen: 'V260', erlaubt: ['+'] },
    BSOB: { vorzeichen: 'VSOB', erlaubt: ['+'] },
    BFB1: { vorzeichen: 'VFB1', erlaubt: ['+'] },
    BFB2: { vorzeichen: 'VFB2', erlaubt: ['+'] },
    BAUF: { vorzeichen: 'VAUF', erlaubt: ['+'] },
    BFB3: { vorzeichen: 'VFB3', erlaubt: ['+'] },
    BNEB: { vorzeichen: 'VNEB', erlaubt: ['+'] },
    BPFG: { vorzeichen: 'VPFG', erlaubt: ['+'] },
    BSFB: { vorzeichen: 'VSFB', erlaubt: ['+'] },
    BUEB: { vorzeichen: 'VUEB', erlaubt: ['+'] },
    BAPK: { vorzeichen: 'VAPK', erlaubt: ['+'] },
    ENTW: { vorzeichen: 'VENT', erlaubt: ['+'] },
    PREI: { vorzeichen: 'VPRE', erlaubt: ['+'] },
    BPEND: { vorzeichen: 'VPEND', erlaubt: ['+'] },
    WBKB: { vorzeichen: 'VWBKB', erlaubt: ['+'] },
    FABO: { vorzeichen: 'VFABO', erlaubt: ['+'] },
    HOPA: { vorzeichen: 'VHOPA', erlaubt: ['+'] },
    KOUN: { vorzeichen: 'VKOUN', erlaubt: ['+'] },
    MAGB: { vorzeichen: 'VMAGB', erlaubt: ['+'] },
    TEPR: { vorzeichen: 'VTEPR', erlaubt: ['+'] },
    MAPR: { vorzeichen: 'VMAPR', erlaubt: ['+'] },
    FSVB: { vorzeichen: 'VFSVB', erlaubt: ['+'] },
    KAKL: { vorzeichen: 'VKAKL', erlaubt: ['+'] },
    ZUKB: { vorzeichen: 'VZUKB', erlaubt: ['+'] },
  },
  '29': {
    B210: { vorzeichen: 'V210', erlaubt: ['+'] },
    B215: { vorzeichen: 'V215', erlaubt: ['+'] },
    B220: { vorzeichen: 'V220', erlaubt: ['+', '-'] },
    BIEB: { vorzeichen: 'VIEB', erlaubt: ['+', '-'] },
    B225: { vorzeichen: 'V225', erlaubt: ['+'] },
    B226: { vorzeichen: 'V226', erlaubt: ['+'] },
    B230: { vorzeichen: 'V230', erlaubt: ['+'] },
    BAUS: { vorzeichen: 'VAUS', erlaubt: ['+'] },
    BPEN: { vorzeichen: 'VPEN', erlaubt: ['+'] },
    BEFB: { vorzeichen: 'VEFB', erlaubt: ['+'] },
    BSTF: { vorzeichen: 'VSTF', erlaubt: ['+'] },
    BSSB: { vorzeichen: 'VSSB', erlaubt: ['+', '-'] },
    B243: { vorzeichen: 'V243', erlaubt: ['+', '-'] },
    B245: { vorzeichen: 'V245', erlaubt: ['+', '-'] },
    BIEL: { vorzeichen: 'VIEL', erlaubt: ['+', '-'] },
    BABL: { vorzeichen: 'VABL', erlaubt: ['+', '-'] },
    B260: { vorzeichen: 'V260', erlaubt: ['+', '-'] },
    BSOB: { vorzeichen: 'VSOB', erlaubt: ['+'] },
    BFB1: { vorzeichen: 'VFB1', erlaubt: ['+'] },
    BFB2: { vorzeichen: 'VFB2', erlaubt: ['+'] },
    BAUF: { vorzeichen: 'VAUF', erlaubt: ['+'] },
    BFB3: { vorzeichen: 'VFB3', erlaubt: ['+'] },
    BNEB: { vorzeichen: 'VNEB', erlaubt: ['+'] },
    BPFG: { vorzeichen: 'VPFG', erlaubt: ['+'] },
    BSFB: { vorzeichen: 'VSFB', erlaubt: ['+'] },
    BUEB: { vorzeichen: 'VUEB', erlaubt: ['+'] },
    BAPK: { vorzeichen: 'VAPK', erlaubt: ['+'] },
    ENTW: { vorzeichen: 'VENT', erlaubt: ['+'] },
    PREI: { vorzeichen: 'VPRE', erlaubt: ['+'] },
    BPEND: { vorzeichen: 'VPEND', erlaubt: ['+'] },
    WBKB: { vorzeichen: 'VWBKB', erlaubt: ['+'] },
    FABO: { vorzeichen: 'VFABO', erlaubt: ['+'] },
    HOPA: { vorzeichen: 'VHOPA', erlaubt: ['+'] },
    KOUN: { vorzeichen: 'VKOUN', erlaubt: ['+'] },
    MAGB: { vorzeichen: 'VMAGB', erlaubt: ['+'] },
    TEPR: { vorzeichen: 'VTEPR', erlaubt: ['+'] },
    MAPR: { vorzeichen: 'VMAPR', erlaubt: ['+'] },
    FSVB: { vorzeichen: 'VFSVB', erlaubt: ['+'] },
    KAKL: { vorzeichen: 'VKAKL', erlaubt: ['+'] },
    ZUKB: { vorzeichen: 'VZUKB', erlaubt: ['+'] },
  },
};

/**
 * Betragsfelder ohne Vorzeichenfeld (Cent, nicht negativ). Version 28 und 29
 * führen die Aufgliederungen ab Feld 177 ohne Vorzeichen; Version 29 kommt
 * mit `AKFB` und `AKFH` hinzu.
 */
export const BETRAEGE_OHNE_VORZEICHEN: Readonly<Record<Lohnzettelversion, readonly string[]>> = {
  '28': [
    'BSBKFZ',
    'BSBWR',
    'BSBSB',
    'SB681',
    'SB682',
    'BZUKG',
    'MAKBG',
    'MABST',
    'ZUCSG',
    'GUTSC',
    'MARAB',
    'AKKFZ',
    'KEAKFZ',
    'AGLAG',
  ],
  '29': [
    'BSBKFZ',
    'BSBWR',
    'BSBSB',
    'SB681',
    'SB682',
    'BZUKG',
    'MAKBG',
    'MABST',
    'ZUCSG',
    'GUTSC',
    'MARAB',
    'AKKFZ',
    'KEAKFZ',
    'AGLAG',
    'AKFB',
    'AKFH',
  ],
};
