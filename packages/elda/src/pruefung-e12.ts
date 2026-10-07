import type { SatzartFH } from './pflicht-e12';
import { pruefeAllgemein, wirf } from './pruefung-allgemein';
import { gueltigesDatum, normalisiert, normalisiertNumerisch } from './pruefung-e29';

type Werte = Readonly<Record<string, string | undefined>>;

/**
 * Karenzarten laut Feld 25 `KART` (Kapitel E.12, Seite 221 der 43. Ergänzung, 215 der 42.):
 *
 * - `01` Familienhospizkarenz gegen Entfall des Entgeltes mit Beginn bis 31.12.2013
 * - `02` Familienhospizkarenz bei Reduzierung der Arbeitszeit mit Beginn bis 31.12.2013
 * - `03` Familienhospizkarenz gegen Entfall des Entgelts ab 01.01.2014
 * - `04` Pflegekarenz gegen Entfall des Entgelts ab 01.01.2014
 * - `05` Familienhospizteilzeit mit Herabsetzung des Entgelts unter die
 *   Geringfügigkeitsgrenze ab 01.01.2014
 * - `06` Pflegeteilzeit mit Herabsetzung des Entgelts unter die
 *   Geringfügigkeitsgrenze ab 01.01.2014
 * - `07` Pflegekarenzgeld während Freistellung wegen Kinderrehabilitation
 *   (laut E.12.2 ab dem 01.11.2023 möglich)
 */
export const KARENZART = Object.freeze({
  FAMILIENHOSPIZKARENZ_BIS_2013: '01',
  FAMILIENHOSPIZKARENZ_REDUZIERT_BIS_2013: '02',
  FAMILIENHOSPIZKARENZ: '03',
  PFLEGEKARENZ: '04',
  FAMILIENHOSPIZTEILZEIT: '05',
  PFLEGETEILZEIT: '06',
  KINDERREHABILITATION: '07',
} as const);

/** Zulässige Werte von {@link KARENZART}. */
export type Karenzart = (typeof KARENZART)[keyof typeof KARENZART];

const KART_CODES: ReadonlySet<string> = new Set(Object.values(KARENZART));

/**
 * Geschlechtscodes laut Feld 14 `GESL` (Kapitel E.12, Seite 220 der 43. Ergänzung, 214 der 42.): 1 männlich,
 * 2 weiblich, 3 divers, 4 offen, 6 inter, 7 keine Angabe. Dieselbe Liste führt
 * der Prüfkatalog als `F0082`.
 *
 * Der Katalog nennt für dieselbe Satzart 80 zusätzlich `F0081` „gültig 1,2" —
 * die beiden Zeilen widersprechen sich. Übernommen ist die Liste der
 * Feldtabelle; welche Zeile ELDA tatsächlich anwendet, ist offen (README,
 * „Ausblick").
 */
const GESL_CODES: ReadonlySet<string> = new Set(['1', '2', '3', '4', '6', '7']);

/** Karenzarten, bei denen das Entgelt vor der Karenz zu melden ist (F3010). */
const KART_MIT_EVFH: ReadonlySet<string> = new Set(['01', '02']);

/**
 * Prüfregeln des Prüfkatalogs 43.1.0.0 für die Meldung
 * Familienhospizkarenz/Pflegekarenz (Bestand `FH`, Satzarten 80–86): Blatt
 * `Allgemein` (siehe `pruefeAllgemein`) und Blatt `FH` (Kapitel H.7), jeweils
 * die Zeilen mit Status N. Wirft beim ersten Verstoß mit dem Code des Katalogs.
 *
 * Aus dem Blatt `Allgemein` zusätzlich:
 *
 * - `F0080`/`F0082` Geschlecht leer bzw. ungültig — nur bei 80.
 * - `F0090` Staatsangehörigkeit leer — nur bei 80. Ob der Staatenschlüssel
 *   gültig ist (`F0091`), ist eine Warnung; die Liste führt die ÖGK auf
 *   elda.at, nicht das Dokument.
 * - `F0140`/`F0141` Datum (ADAT) leer bzw. ungültig — bei allen sieben.
 * - `F0160`/`F0161` richtiges Datum (RDAT) leer bzw. ungültig — bei 85 und 86.
 *
 * Aus dem Blatt `FH`:
 *
 * - `F3000`/`F3001` Karenzart leer bzw. nicht in {@link KARENZART}.
 * - `F3010` Entgelt vor der Karenz (EVFH) leer bei Karenzart 01 oder 02 — nur
 *   bei 80.
 * - `F3020` Entgelt während der Karenz (EWFH) leer bei Karenzart 02 — bei 80.
 *   Der Katalog nennt auch „82*"; der Stern heißt dort „optionales Feld in
 *   einer Änderungsmeldung", und in der Matrix steht EWFH bei 82 auf „V". Bei
 *   82 wird deshalb nichts erzwungen.
 *
 * `F3011` und `F3021` („ungültig") prüft `baueSatz`: Beide Felder sind
 * numerisch (Cent), anderes als Ziffern weist schon der Satzbau ab. Eine
 * Wertgrenze nennt der Katalog nicht.
 *
 * **Bewusst nicht geprüft** — Erstellvorschriften aus E.12.2 ohne eigene
 * Katalogzeile: dass bei der Anmeldung zur Freistellung nur 03, 04 oder 07 und
 * zur Teilzeit nur 05 oder 06 stehen soll, dass 07 erst ab 01.11.2023 möglich
 * ist und dass EVFH/EWFH nur bei 01 und 02 zu melden sind. Ob ELDA solche
 * Angaben abweist oder nur übergeht, steht nirgends.
 */
export function pruefeFamilienhospiz(satzart: SatzartFH, werte: Werte): void {
  pruefeAllgemein(werte);

  if (satzart === '80') {
    const gesl = normalisiertNumerisch(werte.GESL);
    if (gesl === undefined) wirf('F0080', 'Das Geschlecht (GESL) ist zu befüllen.');
    if (!GESL_CODES.has(gesl)) {
      wirf('F0082', 'Ungültiger Geschlechtscode (GESL). Zulässig: 1, 2, 3, 4, 6, 7.');
    }
    if (normalisiert(werte.STSL) === undefined) {
      wirf('F0090', 'Die Staatsangehörigkeit (STSL) ist zu befüllen.');
    }
  }

  const adat = normalisiertNumerisch(werte.ADAT);
  if (adat === undefined) wirf('F0140', 'Das Datum (ADAT) ist zu befüllen.');
  if (!gueltigesDatum(adat)) wirf('F0141', 'Das Datum (ADAT) ist ungültig. Erwartet: TTMMJJJJ.');

  if (satzart === '85' || satzart === '86') {
    const rdat = normalisiertNumerisch(werte.RDAT);
    if (rdat === undefined) wirf('F0160', 'Das richtige An-/Abmeldedatum (RDAT) ist zu befüllen.');
    if (!gueltigesDatum(rdat)) {
      wirf('F0161', 'Das richtige An-/Abmeldedatum (RDAT) ist ungültig. Erwartet: TTMMJJJJ.');
    }
  }

  const kart = normalisiertNumerisch(werte.KART);
  if (kart === undefined) wirf('F3000', 'Die Karenzart (KART) ist zu befüllen.');
  const kartZweistellig = kart.padStart(2, '0');
  if (!KART_CODES.has(kartZweistellig)) {
    wirf('F3001', 'Ungültige Karenzart (KART). Zulässig: 01 bis 07.');
  }

  if (satzart === '80') {
    if (KART_MIT_EVFH.has(kartZweistellig) && normalisiertNumerisch(werte.EVFH) === undefined) {
      wirf('F3010', 'Bei Karenzart 01 oder 02 ist das Entgelt vor Antritt der Karenz (EVFH) zu befüllen.');
    }
    if (kartZweistellig === '02' && normalisiertNumerisch(werte.EWFH) === undefined) {
      wirf('F3020', 'Bei Karenzart 02 ist das Entgelt während der Karenz (EWFH) anzugeben.');
    }
  }
}
