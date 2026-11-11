import type { Feld } from './festsatz';

/**
 * Feldtabellen der Krankentransport-Abrechnung — Organisationsbeschreibung
 * „Datenaustausch Krankentransporte (DKT)", Version 2.2, Stand 20.06.2025,
 * wirksam ab 07/2025, herausgegeben vom Dachverband der österreichischen
 * Sozialversicherungsträger. Gilt ausschließlich für das Fachgebiet 65
 * (Rettungsdienste, Beförderungsgewerbe Krankentransport; Kapitel B.2).
 *
 * Alle Sätze sind 128 Zeichen lang (Kapitel F, „Gesamtlänge: 128"). Die
 * Datenblöcke der Satzarten 07 (106 Zeichen) und 21/22/62 (43 Zeichen) haben
 * eigene Tabellen mit blockbezogenen Positionen; im Dokument sind die Blöcke von
 * Satzart 07 mit Satzpositionen (23–128) angegeben, die von Satzart 21 mit
 * Blockpositionen (1–43). Hier tragen beide Blockpositionen ab 1.
 *
 * Feldtypen nach Kapitel F.1 (Seite 53):
 * - `a`   alphabetisch, linksbündig, Grundstellung blank
 * - `a/n` alphanumerisch, linksbündig, Grundstellung blank
 * - `n`   numerisch, rechtsbündig, Grundstellung 0, führende Nullen, keine
 *         Interpunktion (auch kein Dezimalkomma)
 *
 * Reservefelder sind „zwingend mit blank zu befüllen" (D.42); sie heißen hier
 * `RES` plus Laufnummer, damit jeder Feldname in seiner Tabelle eindeutig ist.
 */

/**
 * Symbol der Spalte „Symbol" (Kapitel F.1): `Z` zwingend, `ZA` zwingend im
 * Anlassfall, `O` optional.
 */
export type DktStufe = 'Z' | 'ZA' | 'O';

/**
 * Ein Feld einer DKT-Satzart. `stufe` fehlt nur dort, wo die Tabelle selbst
 * kein Symbol führt (SART 00 Datensatzbeginn, Lauf-Nr. 14).
 */
export interface DktFeld extends Feld {
  stufe?: DktStufe;
}

/** Satzlänge aller DKT-Sätze. */
export const DKT_SATZLAENGE = 128;
/** Länge des Satzkopfes (Kapitel F.3, Seite 55). */
export const DKT_KOPFLAENGE = 20;
/** Länge eines Datenblocks der Satzarten 21/22/62 (Kapitel F.10.1–F.10.3). */
export const DKT_BLOCKLAENGE_LEISTUNG = 43;
/** Länge eines Datenblocks der Satzart 07 (Kapitel F.7.1–F.7.2). */
export const DKT_BLOCKLAENGE_EKVK = 106;

function an(nr: number, name: string, pos: number, laenge: number, stufe?: DktStufe): DktFeld {
  return stufe === undefined
    ? { nr, name, pos, laenge, typ: 'a/n', klasse: 'ascii' }
    : { nr, name, pos, laenge, typ: 'a/n', klasse: 'ascii', stufe };
}

/**
 * Freitextfeld (Begründung, Hinweis, Diagnosetext): voller Zeichensatz des
 * Bestands, ISO-8859-15 — Auskunft des ELDA Service Support vom 11.11.2026:
 * „Verwenden Sie bitte für die DKT-Bestände den Zeichensatz ISO 8859-15". Für
 * Namen und Adressen gilt weiter F.1 („keine diakritischen Zeichen").
 */
function txt(nr: number, name: string, pos: number, laenge: number, stufe: DktStufe): DktFeld {
  return { nr, name, pos, laenge, typ: 'a/n', klasse: 'frei', stufe };
}

function a(nr: number, name: string, pos: number, laenge: number, stufe: DktStufe): DktFeld {
  return { nr, name, pos, laenge, typ: 'a', klasse: 'alphabetisch', stufe };
}

function n(
  nr: number,
  name: string,
  pos: number,
  laenge: number,
  stufe: DktStufe,
  format?: Feld['format'],
): DktFeld {
  return format === undefined
    ? { nr, name, pos, laenge, typ: 'n', stufe }
    : { nr, name, pos, laenge, typ: 'n', stufe, format };
}

/** Reservefeld, D.42: „Das Reservefeld ist zwingend mit blank zu befüllen." */
function res(nr: number, pos: number, laenge: number, stufe: DktStufe | undefined = 'Z'): DktFeld {
  return an(nr, `RES${nr}`, pos, laenge, stufe);
}

/** Satzkopf, 20 Zeichen am Anfang jedes Satzes außer Vorlauf- und Schlusssatz (F.3, Seite 55). */
export const DKT_KOPF: readonly DktFeld[] = [
  an(1, 'VSTRA', 1, 2, 'Z'),
  n(2, 'BLNDA', 3, 1, 'Z'),
  n(3, 'VPNR', 4, 6, 'Z', 'LLLLLP'),
  n(4, 'VPADR', 10, 2, 'Z'),
  n(5, 'AJAHR', 12, 2, 'Z', 'JJ'),
  n(6, 'ABZR', 14, 2, 'Z'),
  n(7, 'SATNR', 16, 5, 'Z'),
];

/** SART 00 Vorlaufsatz für ELDA (F.2, Seite 54). Ohne Satzkopf. */
export const DKT_VORLAUF: readonly DktFeld[] = [
  an(1, 'SART', 1, 2, 'Z'),
  res(2, 3, 7),
  an(3, 'VSTRU', 10, 2, 'Z'),
  an(4, 'OBUS', 12, 7, 'Z'),
  an(5, 'VSTR', 19, 2, 'Z'),
  an(6, 'PROJ', 21, 2, 'Z'),
  an(7, 'BEST', 23, 2, 'Z'),
  n(8, 'DTNR', 25, 6, 'Z'),
  n(9, 'EDAT', 31, 8, 'Z', 'TTMMJJJJ'),
  an(10, 'EZEI', 39, 6, 'Z'),
  an(11, 'HRST', 45, 45, 'Z'),
  an(12, 'HKFZ', 90, 3, 'Z'),
  an(13, 'HPLZ', 93, 7, 'Z'),
  an(14, 'VSTRA', 100, 2, 'Z'),
  an(15, 'ELDAS', 102, 6, 'O'),
  an(16, 'ELDAÜ', 108, 8, 'O'),
  res(17, 116, 4),
  n(18, 'VERS', 120, 2, 'Z'),
  res(19, 122, 7),
];

/**
 * SART 00 Datensatzbeginn (F.3.1, Seite 56).
 *
 * Lauf-Nr. 14 (Stellen 90–96) führt in der Tabelle weder Symbol noch Inhalt.
 * In der Fassung vom 15.11.2023 hieß das Feld noch „RES DVR — Datenverarbeitungs-
 * registernummer des rechnungslegenden VP"; das Muster E.3 trägt dort bis heute
 * eine solche Nummer. Für neue Bestände gilt D.42: blank.
 */
export const DKT_BEGINN: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  n(3, 'DPNR', 23, 2, 'Z'),
  n(4, 'ERDAT', 25, 6, 'Z', 'TTMMJJ'),
  an(5, 'UIDV', 31, 14, 'ZA'),
  n(6, 'VPADR', 45, 3, 'Z'),
  res(7, 48, 26),
  n(8, 'UFACHL', 74, 2, 'ZA'),
  n(9, 'FACHL', 76, 2, 'Z'),
  n(10, 'BLLE', 78, 1, 'Z'),
  n(11, 'VPADRL', 79, 3, 'Z'),
  n(12, 'VPNRL', 82, 6, 'Z', 'LLLLLP'),
  n(13, 'VERSD', 88, 2, 'Z'),
  res(14, 90, 7, undefined),
  n(15, 'ABRA', 97, 1, 'Z'),
  n(16, 'VPNRU', 98, 6, 'ZA', 'LLLLLP'),
  an(17, 'UID', 104, 14, 'ZA'),
  n(18, 'ZVR', 118, 9, 'ZA'),
  res(19, 127, 2),
];

/** SART 01 Versichertendaten, SART 41 bei Korrektur (F.4, Seite 57). */
export const DKT_VERSICHERTER: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  an(3, 'VSTRL', 23, 2, 'Z'),
  n(4, 'BLNDL', 25, 1, 'ZA'),
  n(5, 'BSNR', 26, 5, 'Z'),
  res(6, 31, 2),
  a(7, 'ZUNVS', 33, 30, 'Z'),
  a(8, 'VONVS', 63, 15, 'Z'),
  n(9, 'VSNRV', 78, 10, 'Z', 'LLLPTTMMJJ'),
  n(10, 'KAT', 88, 3, 'ZA'),
  res(11, 91, 12),
  n(12, 'VPNUW', 103, 6, 'Z', 'LLLLLP'),
  a(13, 'ZUNUW', 109, 10, 'ZA'),
  n(14, 'FACHU', 119, 2, 'ZA'),
  n(15, 'UEDAT', 121, 6, 'Z', 'TTMMJJ'),
  n(16, 'VORZ', 127, 1, 'Z'),
  res(17, 128, 1),
];

/** SART 02 Angehörigendaten, SART 42 bei Korrektur (F.5, Seite 58). */
export const DKT_ANGEHOERIGER: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  n(3, 'VSNRA', 23, 10, 'Z', 'LLLPTTMMJJ'),
  a(4, 'AZUNA', 33, 30, 'Z'),
  a(5, 'AVONA', 63, 15, 'Z'),
  res(6, 78, 51),
];

/** SART 06 Adressdaten und sonstige Daten (F.6, Seite 59). */
export const DKT_ADRESSE: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  an(3, 'LKZ', 23, 3, 'Z'),
  an(4, 'PLZL', 26, 9, 'Z'),
  an(5, 'STRA', 35, 30, 'Z'),
  an(6, 'ORT', 65, 25, 'Z'),
  an(7, 'UVAZ', 90, 13, 'ZA'),
  res(8, 103, 26),
];

/** SART 07 EKVK — Europäische Krankenversicherungskarte, Container für einen Block (F.7, Seite 60). */
export const DKT_EKVK: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  an(3, 'BLOCK', 23, 106, 'Z'),
];

/** SART 07 Datenblock Patient bzw. Karteninhaber „P" (F.7.1, Seite 61), Blockpositionen. */
export const DKT_EKVK_PATIENT: readonly DktFeld[] = [
  a(1, 'BLOKZ', 1, 1, 'Z'),
  an(2, 'ESTAAT', 2, 2, 'Z'),
  an(3, 'EVSNR', 4, 20, 'Z'),
  a(4, 'EZUNA', 24, 40, 'Z'),
  a(5, 'EVONA', 64, 35, 'Z'),
  n(6, 'EGEBD', 99, 8, 'Z', 'TTMMJJJJ'),
];

/** SART 07 Datenblock Weitere EKVK-Datenmeldungen „E" (F.7.2, Seite 62), Blockpositionen. */
export const DKT_EKVK_WEITERE: readonly DktFeld[] = [
  a(1, 'BLOKZ', 1, 1, 'Z'),
  an(2, 'EGESL', 2, 1, 'O'),
  an(3, 'EIC', 3, 10, 'O'),
  an(4, 'EAKRO', 13, 21, 'O'),
  n(5, 'EKANR', 34, 20, 'O'),
  n(6, 'EAEND', 54, 8, 'O', 'TTMMJJJJ'),
  an(7, 'EFORM', 62, 4, 'ZA'),
  res(8, 66, 41),
];

/**
 * SART 11 Bezugsdaten (F.8, Seite 63): bei Korrekturen der Bezug zur
 * seinerzeitigen Abrechnung (AJAHR, ABZR, RNR, BSNR), bei mehreren
 * Leistungserbringern deren Identifikation (VPNRL, FACHL, UFACHL, VPADRL, BLLE).
 */
export const DKT_BEZUG: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  n(3, 'VPNRL', 23, 6, 'ZA', 'LLLLLP'),
  n(4, 'FACHL', 29, 2, 'ZA'),
  n(5, 'UFACHL', 31, 2, 'ZA'),
  n(6, 'VPADRL', 33, 3, 'ZA'),
  n(7, 'BLLE', 36, 1, 'ZA'),
  n(8, 'AJAHR', 37, 2, 'ZA', 'JJ'),
  n(9, 'ABZR', 39, 2, 'ZA'),
  an(10, 'RNR', 41, 10, 'ZA'),
  n(11, 'BSNR', 51, 5, 'ZA'),
  n(12, 'ABLG', 56, 3, 'Z'),
  res(13, 59, 70),
];

/** SART 20 Transportdaten, SART 60 bei Korrektur (F.9, Seite 64). */
export const DKT_TRANSPORT: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  n(3, 'LDAT', 23, 6, 'Z', 'TTMMJJ'),
  n(4, 'EBEG', 29, 4, 'Z', 'HHMM'),
  n(5, 'ANK', 33, 4, 'ZA', 'HHMM'),
  n(6, 'WZV', 37, 4, 'ZA', 'HHMM'),
  n(7, 'WZB', 41, 4, 'ZA', 'HHMM'),
  n(8, 'END', 45, 4, 'Z', 'HHMM'),
  an(9, 'TNR', 49, 8, 'Z'),
  an(10, 'KFZ', 57, 8, 'ZA'),
  an(11, 'ORTV', 65, 16, 'ZA'),
  an(12, 'PLZV', 81, 8, 'Z'),
  an(13, 'ORTN', 89, 16, 'ZA'),
  an(14, 'PLZN', 105, 8, 'Z'),
  n(15, 'GRU', 113, 2, 'Z'),
  n(16, 'TART', 115, 2, 'Z'),
  n(17, 'FART', 117, 2, 'Z'),
  n(18, 'ZKR', 119, 1, 'Z'),
  n(19, 'BEF', 120, 1, 'Z'),
  n(20, 'VPNRL', 121, 6, 'ZA', 'LLLLLP'),
  n(21, 'NACA', 127, 1, 'ZA'),
  res(22, 128, 1),
];

/**
 * SART 21 Leistungsdaten, SART 22 bei Rückmeldung, SART 62 bei Korrektur
 * (F.10, Seite 65). Zwei Datenblöcke zu je 43 Zeichen.
 */
export const DKT_LEISTUNG: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  an(3, 'RNR', 23, 10, 'Z'),
  // Die Blöcke sind bereits feldweise geprüft; der Container trägt, was sie tragen.
  txt(4, 'BLO1', 33, 43, 'Z'),
  txt(5, 'BLO2', 76, 43, 'ZA'),
  res(6, 119, 10),
];

/**
 * Datenblock Leistung „L" (SART 21/22), bei SART 62 „A" Abzug bzw.
 * „N" Nachverrechnung (F.10.1, Seite 66).
 */
export const DKT_BLOCK_LEISTUNG: readonly DktFeld[] = [
  a(1, 'BLOKZ', 1, 1, 'Z'),
  an(2, 'POSNR', 2, 3, 'Z'),
  n(3, 'TAR', 5, 5, 'Z'),
  n(4, 'ANZKM', 10, 4, 'Z'),
  n(5, 'BETR', 14, 8, 'Z'),
  n(6, 'UST', 22, 2, 'Z'),
  n(7, 'KBS', 24, 2, 'ZA'),
  n(8, 'SUMKB', 26, 8, 'ZA'),
  n(9, 'ABLG', 34, 2, 'Z'),
  an(10, 'BEWNR', 36, 8, 'ZA'),
];

/** Datenblock Diagnose „D" (F.10.2, Seite 67). */
export const DKT_BLOCK_DIAGNOSE: readonly DktFeld[] = [
  a(1, 'BLOKZ', 1, 1, 'Z'),
  n(2, 'DIAKZ', 2, 1, 'Z'),
  txt(3, 'DIAGN', 3, 30, 'Z'),
  res(4, 33, 11),
];

/** Datenblock Begründung „B" (F.10.3, Seite 68). */
export const DKT_BLOCK_BEGRUENDUNG: readonly DktFeld[] = [
  a(1, 'BLOKZ', 1, 1, 'Z'),
  txt(2, 'GRUN', 2, 42, 'Z'),
];

/**
 * SART 23 Rechnungssummensatz, SART 24 bei Rückmeldung, SART 64 bei
 * Korrekturen (F.11, Seiten 69–70). „Pro USt-Satz muss ein
 * Rechnungssummensatz übermittelt werden."
 */
export const DKT_SUMME: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  an(3, 'RNR', 23, 10, 'Z'),
  n(4, 'RDAT', 33, 6, 'Z', 'TTMMJJ'),
  n(5, 'UST', 39, 2, 'Z'),
  n(6, 'ANZLB', 41, 5, 'Z'),
  n(7, 'SUM', 46, 9, 'Z'),
  n(8, 'KOBE', 55, 9, 'ZA'),
  n(9, 'ZSUM', 64, 9, 'Z'),
  n(10, 'UBE', 73, 9, 'Z'),
  n(11, 'REBE', 82, 9, 'Z'),
  n(12, 'ABST', 91, 2, 'Z'),
  n(13, 'KOBEUST', 93, 9, 'ZA'),
  n(14, 'PSKO', 102, 4, 'Z'),
  n(15, 'SKO', 106, 8, 'Z'),
  n(16, 'VZS', 114, 1, 'ZA'),
  n(17, 'VZK', 115, 1, 'ZA'),
  n(18, 'VZZS', 116, 1, 'ZA'),
  n(19, 'VZR', 117, 1, 'ZA'),
  res(20, 118, 11),
];

/** SART 39 Textsatz (F.12, Seite 71). */
export const DKT_TEXT: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  txt(3, 'TXT', 23, 100, 'Z'),
  res(4, 123, 6),
];

/** SART 85 Pauschalsatz für Abzug/Zahlung durch den SV-Träger (F.13, Seite 72). */
export const DKT_PAUSCHALE: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  n(3, 'VPNRL', 23, 6, 'Z', 'LLLLLP'),
  n(4, 'FACHL', 29, 2, 'Z'),
  n(5, 'UFACHL', 31, 2, 'ZA'),
  n(6, 'VPADRL', 33, 3, 'Z'),
  n(7, 'BLLE', 36, 1, 'Z'),
  a(8, 'PART', 37, 1, 'Z'),
  n(9, 'PBETRN', 38, 10, 'Z'),
  n(10, 'PUST', 48, 8, 'Z'),
  n(11, 'PBETRB', 56, 10, 'Z'),
  txt(12, 'PBEGR', 66, 63, 'Z'),
];

/** SART 99 Dateiende (F.14, Seite 73). */
export const DKT_DATEIENDE: readonly DktFeld[] = [
  an(1, 'KOPF', 1, 20, 'Z'),
  n(2, 'SART', 21, 2, 'Z'),
  n(3, 'ANZ01', 23, 4, 'Z'),
  n(4, 'ANZ02', 27, 4, 'Z'),
  n(5, 'ANZ20', 31, 4, 'Z'),
  n(6, 'ANZ21', 35, 4, 'Z'),
  n(7, 'ANDP', 39, 2, 'Z'),
  n(8, 'ANZ06', 41, 4, 'Z'),
  n(9, 'ANZ23', 45, 4, 'Z'),
  n(10, 'ANZ07', 49, 4, 'Z'),
  n(11, 'ANZ11', 53, 5, 'Z'),
  n(12, 'ANZ39', 58, 5, 'Z'),
  n(13, 'ANZ85', 63, 5, 'Z'),
  res(14, 68, 61),
];

/** SART 99 Schlusssatz für ELDA (F.14.1, Seite 74). Ohne Satzkopf. */
export const DKT_SCHLUSS: readonly DktFeld[] = [
  an(1, 'SART', 1, 2, 'Z'),
  res(2, 3, 7),
  an(3, 'VSTRU', 10, 2, 'Z'),
  an(4, 'OBUS', 12, 7, 'Z'),
  an(5, 'VSTR', 19, 2, 'Z'),
  n(6, 'SANZ', 21, 6, 'Z'),
  res(7, 27, 102),
];
