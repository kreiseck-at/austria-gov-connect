import { FELDER_E12 } from './felder-e12';
import { pruefeMatrix, type Matrix, type Stufe } from './pflichtmatrix';

/** Satzarten der Meldung Familienhospizkarenz/Pflegekarenz (Kapitel E.12, Feld SART). */
export type SatzartFH = '80' | '81' | '82' | '83' | '84' | '85' | '86';

/** Klartext je Satzart, wie ihn Kapitel E.12 führt. */
export const SATZART_TEXT_FH: Readonly<Record<SatzartFH, string>> = {
  '80': 'Anmeldung',
  '81': 'Abmeldung',
  '82': 'Änderungsmeldung',
  '83': 'Storno Anmeldung',
  '84': 'Storno Abmeldung',
  '85': 'Richtigstellung Anmeldung',
  '86': 'Richtigstellung Abmeldung',
};

const SATZARTEN: readonly SatzartFH[] = ['80', '81', '82', '83', '84', '85', '86'];

function zeile(...stufen: Stufe[]): Readonly<Record<SatzartFH, Stufe>> {
  return Object.freeze(Object.fromEntries(SATZARTEN.map((sa, i) => [sa, stufen[i]!]))) as Record<
    SatzartFH,
    Stufe
  >;
}

const alle = (stufe: Stufe) => zeile(stufe, stufe, stufe, stufe, stufe, stufe, stufe);

/**
 * Die Matrix aus Kapitel E.12.1 (Seite 222 der 43. Ergänzung, 216 der 42.), Feld für Feld
 * und Satzart für Satzart in der Reihenfolge 80 bis 86. Am gerenderten
 * Tabellenbild abgelesen, weil die Textfassung verbundene Zellen nicht
 * wiedergibt.
 *
 * Drei Zellen fassen mehrere Felder zusammen (siehe {@link FELDGRUPPEN_E12}):
 *
 * - `BKNR`+`DGNA`: ein „Z". Der Prüfkatalog führt für beide Felder eine eigene
 *   Leerprüfung mit Status N (Blatt Allgemein, F0010 und F0020, je mit den
 *   Satzarten 80–86) — beide sind also einzeln zwingend und hier als `Z`
 *   eingetragen.
 * - `VSNR`+`GEBD`: ein „Z". Der Prüfkatalog prüft nur „VSNR leer und
 *   Geburtsdatum leer" (F0030) — eines von beiden genügt. Hier deshalb `Z1`;
 *   die Bedingung prüft `pruefeFamilienhospiz`.
 * - `WKFZ`+`PLZL`+`WORT`+`STRA`: bei 80 ein „Z" für die Wohnanschrift als
 *   Ganzes. Welches Feld die Stufe meint, sagt die Tabelle nicht; der
 *   Prüfkatalog prüft jedes Feld einzeln, aber nur als Warnung (F0100, F0110,
 *   F0120, F0130, Status W). Hier deshalb `Z1` — nicht erzwungen.
 */
const MATRIX: Matrix<SatzartFH> = {
  BKNR: alle('Z'),
  DGNA: alle('Z'),
  DTEL: alle('Z1'),
  WOBD: alle('Z1'),
  ZOBD: alle('Z3'),
  VSNR: alle('Z1'),
  GEBD: alle('Z1'),
  FANA: alle('Z'),
  FNA1: zeile('Z1', '-', '-', '-', '-', '-', '-'),
  FNA2: zeile('Z1', '-', '-', '-', '-', '-', '-'),
  VONA: alle('Z'),
  AKGR: zeile('Z1', 'Z1', '-', 'Z1', 'Z1', 'Z1', 'Z1'),
  GESL: zeile('Z', '-', '-', '-', '-', '-', '-'),
  STSL: zeile('Z', '-', '-', '-', '-', '-', '-'),
  WKFZ: zeile('Z1', 'Z3', '-', 'Z3', 'Z3', 'Z3', 'Z3'),
  PLZL: zeile('Z1', 'Z3', '-', 'Z3', 'Z3', 'Z3', 'Z3'),
  WORT: zeile('Z1', 'Z3', '-', 'Z3', 'Z3', 'Z3', 'Z3'),
  STRA: zeile('Z1', 'Z3', '-', 'Z3', 'Z3', 'Z3', 'Z3'),
  FAN2: zeile('Z3', 'Z3', '-', 'Z3', 'Z3', 'Z3', 'Z3'),
  VON2: zeile('Z3', 'Z3', '-', 'Z3', 'Z3', 'Z3', 'Z3'),
  AKG2: zeile('Z3', 'Z3', '-', '-', '-', 'Z3', 'Z3'),
  ADAT: alle('Z'),
  RDAT: zeile('-', '-', '-', '-', '-', 'Z', 'Z'),
  KART: alle('Z'),
  EVFH: zeile('Z1', '-', 'V', '-', '-', '-', '-'),
  EWFH: zeile('Z1', '-', 'V', '-', '-', '-', '-'),
  REFN: alle('Z3'),
};

/**
 * Felder, die Kapitel E.12.1 in einer gemeinsamen Zelle führt — mit den
 * Satzarten, in denen die Zelle eine Stufe trägt, die hier nicht je Feld
 * übernommen werden konnte. Begründung je Gruppe an der {@link MATRIX}.
 */
export const FELDGRUPPEN_E12: readonly {
  readonly satzarten: readonly SatzartFH[];
  readonly felder: readonly string[];
}[] = [
  { satzarten: SATZARTEN, felder: ['VSNR', 'GEBD'] },
  { satzarten: ['80'], felder: ['WKFZ', 'PLZL', 'WORT', 'STRA'] },
];

/** Die Matrix nach Satzart aufgeschlüsselt, wie sie das API nach außen zeigt. */
export const PFLICHT_E12: Readonly<Record<SatzartFH, Readonly<Record<string, Stufe>>>> = Object.freeze(
  Object.fromEntries(
    SATZARTEN.map((sa) => [
      sa,
      Object.freeze(Object.fromEntries(Object.entries(MATRIX).map(([feld, z]) => [feld, z[sa]]))),
    ]),
  ) as Record<SatzartFH, Readonly<Record<string, Stufe>>>,
);

/** Prüft `Z` (belegt) und `-` (Grundstellung) der Matrix aus Kapitel E.12.1. */
export function pruefePflichtFH(
  satzart: SatzartFH,
  werte: Readonly<Record<string, string | undefined>>,
): void {
  pruefeMatrix(MATRIX, FELDER_E12, satzart, SATZART_TEXT_FH[satzart], werte);
}
