import type { Feld } from './festsatz';

/**
 * Monatliche Beitragsgrundlagenmeldung (mBGM), Kapitel E.32 der
 * Organisationsbeschreibung — Version 02, gültig ab 01.12.2020, zwingender
 * Einsatz ab 01.02.2021, fachliche Gültigkeit für Zeiträume ab 01.01.2019.
 *
 * Anders als die Versichertenmeldung (E.29) ist die mBGM **kein einzelner
 * Satz**, sondern eine Hierarchie:
 *
 * ```
 * mBGM-Paket            je Beitragskonto und Beitragszeitraum
 *   └ mBGM              je Versichertem
 *       └ Tarifblock            Versicherung und Tarifgruppe
 *           └ Verrechnungsbasis     Typ und Bemessungsgrundlage
 *               └ Verrechnungsposition   die einzelnen Beiträge
 * mBGM-Paket-Ende
 * ```
 *
 * Aus dem Dokument (Seite 337): „Alle nachfolgenden Satzarten bis zur nächsten
 * mBGM oder zum mBGM-Paket-Ende gehören zu diesem Versicherten/dieser mBGM."
 * Die Zugehörigkeit ergibt sich also allein aus der **Reihenfolge**, nicht aus
 * einer Verweis-ID. Wer die Sätze umsortiert, ändert die Bedeutung.
 *
 * Für das Storno entfallen Tarifblock, Verrechnungsbasis und
 * Verrechnungsposition (Seite 338).
 *
 * Alle Positionen, Längen und Typen unten sind Datenabbild der Feldtabellen auf
 * den Seiten 339–343. Die Pflichtstufen stehen in `pflicht-e32.ts`.
 */

/** Länge des Identifikationsteils laut Kapitel E.1 — in allen Satzarten gleich. */
export const LAENGE_IDENTIFIKATIONSTEIL = 20;

// --- Satzlängen (Seiten 339–343) ------------------------------------------

/** Satzlänge des mBGM-Paket-Satzes (PS/PV/PE). */
export const SATZLAENGE_PAKET = 305;
/** Satzlänge des mBGM-Satzes (G1–G7, R1–R7). */
export const SATZLAENGE_MBGM = 326;
/** Satzlänge des Tarifblocks (T1/T4). */
export const SATZLAENGE_TARIFBLOCK = 42;
/** Satzlänge des Tarifblocks für fallweise Beschäftigte (T2/T5). */
export const SATZLAENGE_TARIFBLOCK_FALLWEISE = 41;
/** Satzlänge des Tarifblocks für kürzer als einen Monat vereinbarte Beschäftigung (T3/T6). */
export const SATZLAENGE_TARIFBLOCK_KURZ = 44;
/** Satzlänge der Verrechnungsbasis (BS/BV). */
export const SATZLAENGE_VERRECHNUNGSBASIS = 33;
/** Satzlänge der Verrechnungsposition (V1/V2). */
export const SATZLAENGE_VERRECHNUNGSPOSITION = 42;

// --- mBGM-Paket (Seite 339) -----------------------------------------------

/**
 * mBGM-Paket, Satzarten `PS` (Selbstabrechner), `PV` (Vorschreiber) und `PE`
 * (Paket-Ende). Alle drei teilen dieselbe Feldtabelle; welche Felder besetzt
 * sein dürfen, steht in der Pflichtmatrix.
 *
 * `BZRM` trägt den Formatmarker `MMJJJJ`: Ohne ihn würde die generische
 * Nullauffüllung aus `'72026'` klaglos `'072026'` machen — hier zufällig
 * richtig — aus `'12026'` aber `'012026'` und damit stillschweigend Jänner
 * statt eines Tippfehlers. Dieselbe Falle hat bei E.29 ein Datum um neun Tage
 * verschoben.
 */
export const FELDER_PAKET: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'REFP', pos: 21, laenge: 40, typ: 'a/n' },
  { nr: 3, name: 'BKNR', pos: 61, laenge: 10, typ: 'a/n' },
  { nr: 4, name: 'DGNA', pos: 71, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 5, name: 'MPKE', pos: 141, laenge: 30, typ: 'a/n' },
  { nr: 6, name: 'JAGB', pos: 171, laenge: 1, typ: 'a/n' },
  { nr: 7, name: 'DTEL', pos: 172, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 8, name: 'MAIL', pos: 222, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 9, name: 'BZRM', pos: 282, laenge: 6, typ: 'n', format: 'MMJJJJ' },
  { nr: 10, name: 'GSVZ', pos: 288, laenge: 1, typ: 'a/n' },
  { nr: 11, name: 'GSUM', pos: 289, laenge: 11, typ: 'n' },
  { nr: 12, name: 'ANZM', pos: 300, laenge: 6, typ: 'n' },
];

// --- mBGM (Seite 340) -----------------------------------------------------

/**
 * Monatliche Beitragsgrundlagenmeldung je Versichertem — Satzarten `G1`–`G7`
 * (Meldung) und `R1`–`R7` (Storno).
 *
 * `VSNR` trägt wie in E.29 den Formatmarker `LLLPTTMMJJ`: Die
 * Versicherungsnummer ist eine Ziffernfolge mit bedeutungstragenden Stellen,
 * keine Zahl. Führende Nullen dürfen dort nicht entstehen oder wegfallen.
 */
export const FELDER_MBGM: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'REFW', pos: 21, laenge: 40, typ: 'a/n' },
  { nr: 3, name: 'REFU', pos: 61, laenge: 40, typ: 'a/n' },
  { nr: 4, name: 'REFV', pos: 101, laenge: 40, typ: 'a/n' },
  { nr: 5, name: 'VSNR', pos: 141, laenge: 10, typ: 'n', format: 'LLLPTTMMJJ' },
  { nr: 6, name: 'FANA', pos: 151, laenge: 70, typ: 'a/n', klasse: 'personenname' },
  { nr: 7, name: 'VONA', pos: 221, laenge: 70, typ: 'a/n', klasse: 'personenname' },
  { nr: 8, name: 'VSUM', pos: 291, laenge: 11, typ: 'n' },
  { nr: 9, name: 'VERG', pos: 302, laenge: 1, typ: 'a/n' },
  { nr: 10, name: 'INF1', pos: 303, laenge: 12, typ: 'a/n' },
  { nr: 11, name: 'INF2', pos: 315, laenge: 12, typ: 'a/n' },
];

// --- Tarifblöcke (Seiten 341–342) -----------------------------------------

/**
 * Die Feldtabellen aller drei Tarifblöcke führen die „Ergänzung zur
 * Beschäftigtengruppe" als **ein** Feld `ERGB` (3 a/n) auf, umschlossen von
 * `BLOCK FÜR 5 ERGÄNZUNGEN` über 15 Stellen ab Position 25. Es sind also fünf
 * Ablagen zu je drei Zeichen; hier als `ERGB1`–`ERGB5` geführt, damit jede
 * einzeln belegt und geprüft werden kann.
 *
 * Beschäftigtengruppe und Ergänzungen bilden zusammen die **Tarifgruppe**
 * (D.48/D.49). Die zulässigen Werte stehen NICHT im Dokument, sondern im
 * Tarifsystem der Sozialversicherung — siehe `tarifgruppe.ts`.
 */
const ERGAENZUNGEN: readonly Feld[] = [
  { nr: 3, name: 'ERGB1', pos: 25, laenge: 3, typ: 'a/n' },
  { nr: 3, name: 'ERGB2', pos: 28, laenge: 3, typ: 'a/n' },
  { nr: 3, name: 'ERGB3', pos: 31, laenge: 3, typ: 'a/n' },
  { nr: 3, name: 'ERGB4', pos: 34, laenge: 3, typ: 'a/n' },
  { nr: 3, name: 'ERGB5', pos: 37, laenge: 3, typ: 'a/n' },
];

/** Tarifblock, Satzarten `T1` (mit Verrechnung) und `T4` (ohne Verrechnung). */
export const FELDER_TARIFBLOCK: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'BSGR', pos: 21, laenge: 4, typ: 'a/n' },
  ...ERGAENZUNGEN,
  { nr: 4, name: 'VVON', pos: 40, laenge: 2, typ: 'n' },
  { nr: 5, name: 'KEUE', pos: 42, laenge: 1, typ: 'a/n' },
];

/** Tarifblock fallweise Beschäftigte, Satzarten `T2` und `T5`. */
export const FELDER_TARIFBLOCK_FALLWEISE: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'BSGR', pos: 21, laenge: 4, typ: 'a/n' },
  ...ERGAENZUNGEN,
  { nr: 4, name: 'FTAG', pos: 40, laenge: 2, typ: 'n' },
];

/** Tarifblock kürzer als ein Monat vereinbarte Beschäftigung, Satzarten `T3` und `T6`. */
export const FELDER_TARIFBLOCK_KURZ: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'BSGR', pos: 21, laenge: 4, typ: 'a/n' },
  ...ERGAENZUNGEN,
  { nr: 4, name: 'BTAB', pos: 40, laenge: 2, typ: 'n' },
  { nr: 5, name: 'BTBS', pos: 42, laenge: 2, typ: 'n' },
  { nr: 6, name: 'KEUE', pos: 44, laenge: 1, typ: 'a/n' },
];

// --- Verrechnungsbasis (Seite 342) ----------------------------------------

/**
 * Verrechnungsbasis, Satzarten `BS` (Selbstabrechner) und `BV` (Vorschreiber).
 *
 * `VBBT` ist ein **EURO-Betrag in CENT** (D.59), 11 Stellen, ohne Trennzeichen.
 *
 * Inhaltlich wichtig und leicht zu übersehen (D.59, Seite 141): „Für alle
 * Beitragsgrundlagen mit Ausnahme der ‚Beitragsgrundlage zur BV' gilt
 * grundsätzlich, dass im Bereich der Selbstabrechnung der mit der
 * Höchstbeitragsgrundlage begrenzte Wert und im Bereich der Vorschreibung der
 * unbegrenzte (nicht ‚gedeckelte') Wert erwartet wird." Derselbe Lohn führt
 * also je nach Verfahren zu einem anderen Betrag. Für die Beitragsgrundlage
 * zur BV ist eine Begrenzung generell unzulässig.
 */
export const FELDER_VERRECHNUNGSBASIS: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'VBTY', pos: 21, laenge: 2, typ: 'a/n' },
  { nr: 3, name: 'VBBT', pos: 23, laenge: 11, typ: 'n' },
];

// --- Verrechnungsposition (Seite 343) -------------------------------------

/**
 * Verrechnungsposition, Satzarten `V1` (Selbstabrechner) und `V2`
 * (Vorschreiber).
 *
 * `VPTA` ist ein Prozentsatz über 6 Stellen „kein Dezimaltrennzeichen, drei
 * Nachkommastellen" (D.61) — 12,750 % steht also als `012750`.
 *
 * Der Beitrag ergibt sich laut D.61 „durch Multiplikation des
 * Verrechnungsbasis-Betrags mit diesem Prozentsatz unter Berücksichtigung des
 * Vorzeichens (Datenfeld VPVZ), kaufmännisch gerundet auf zwei
 * Nachkommastellen".
 */
export const FELDER_VERRECHNUNGSPOSITION: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'VPTY', pos: 21, laenge: 3, typ: 'a/n' },
  { nr: 3, name: 'VPVZ', pos: 24, laenge: 1, typ: 'a/n' },
  { nr: 4, name: 'VPTA', pos: 25, laenge: 6, typ: 'n' },
  { nr: 5, name: 'RSVZ', pos: 31, laenge: 1, typ: 'a/n' },
  { nr: 6, name: 'RSUM', pos: 32, laenge: 11, typ: 'n' },
];
