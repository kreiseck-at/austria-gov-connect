import { FELDER_E22, TAETIGKEITSBLOECKE } from './felder-e22';
import { pruefeMatrix, type Matrix, type Stufe } from './pflichtmatrix';

/** Satzarten der Schwerarbeitsmeldung (Kapitel E.22, Feld SART). */
export type SatzartSM = '65' | '66';

/** Klartext je Satzart, wie ihn Kapitel E.22 führt. */
export const SATZART_TEXT_SM: Readonly<Record<SatzartSM, string>> = {
  '65': 'Schwerarbeitsmeldung',
  '66': 'Storno Schwerarbeitsmeldung',
};

const beide = (stufe: Stufe): Readonly<Record<SatzartSM, Stufe>> =>
  Object.freeze({ '65': stufe, '66': stufe });

/** Je Tätigkeitsblock dieselben Stufen wie in der Zeile von Feld 17–19. */
const BLOECKE: Matrix<SatzartSM> = Object.fromEntries(
  Array.from({ length: TAETIGKEITSBLOECKE }, (_, i) => i + 1).flatMap((n) => [
    [`TART_${n}`, beide('Z1')],
    [`TVON_${n}`, beide('Z1')],
    [`TBIS_${n}`, beide('Z1')],
  ]),
);

/**
 * Die Matrix aus Kapitel E.22.1 (Seite 269 der 43. Ergänzung, 262 der 42.). Beide Satzarten
 * führen jedes Feld mit derselben Stufe; die Tabelle kennt keine verbundenen
 * Zellen.
 *
 * Strenger als der Prüfkatalog: Die Tabelle führt `VSNR` und `GEBD` jeweils
 * einzeln als „Z", der Prüfkatalog weist erst ab, wenn beide fehlen (Blatt
 * Allgemein, F0030). Ebenso die Anschrift des Dienstgebers (`DKFZ`, `DPLZ`,
 * `DORT`, `DSTR`): „Z" in der Tabelle, im Prüfkatalog nur Warnungen (F5540,
 * F5550, F5560, F5570, Status W). Übernommen ist, was die Tabelle sagt.
 */
const MATRIX: Matrix<SatzartSM> = {
  BKNR: beide('Z'),
  DGNA: beide('Z'),
  WOBD: beide('Z1'),
  ZOBD: beide('Z3'),
  DTEL: beide('Z1'),
  MAIL: beide('Z1'),
  DKFZ: beide('Z'),
  DPLZ: beide('Z'),
  DORT: beide('Z'),
  DSTR: beide('Z'),
  VSNR: beide('Z'),
  GEBD: beide('Z'),
  FANA: beide('Z'),
  VONA: beide('Z'),
  JAHR: beide('Z'),
  ...BLOECKE,
  REFN: beide('Z3'),
};

/** Die Matrix nach Satzart aufgeschlüsselt, wie sie das API nach außen zeigt. */
export const PFLICHT_E22: Readonly<Record<SatzartSM, Readonly<Record<string, Stufe>>>> = Object.freeze({
  '65': Object.freeze(Object.fromEntries(Object.entries(MATRIX).map(([f, z]) => [f, z['65']]))),
  '66': Object.freeze(Object.fromEntries(Object.entries(MATRIX).map(([f, z]) => [f, z['66']]))),
});

/** Prüft `Z` (belegt) und `-` (Grundstellung) der Matrix aus Kapitel E.22.1. */
export function pruefePflichtSM(
  satzart: SatzartSM,
  werte: Readonly<Record<string, string | undefined>>,
): void {
  pruefeMatrix(MATRIX, FELDER_E22, satzart, SATZART_TEXT_SM[satzart], werte);
}
