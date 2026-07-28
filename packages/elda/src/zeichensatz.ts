import { EldaError } from './errors';

/**
 * Feldklasse im Sinne des ELDA-Zeichensatz-Dokuments. ELDA schränkt den
 * zulässigen Zeichenvorrat je nach Art des Feldes ein — für Personennamen
 * deutlich enger als für Unternehmensnamen und Adressen.
 */
export type Feldklasse = 'personenname' | 'unternehmen' | 'frei';

/**
 * Die acht Codepunkte, an denen ISO-8859-15 von ISO-8859-1 abweicht.
 * Node kennt nur `latin1` (= ISO-8859-1), deshalb diese Tabelle darüber.
 */
const ABWEICHUNGEN: ReadonlyMap<string, number> = new Map([
  ['€', 0xa4],
  ['Š', 0xa6],
  ['š', 0xa8],
  ['Ž', 0xb4],
  ['ž', 0xb8],
  ['Œ', 0xbc],
  ['œ', 0xbd],
  ['Ÿ', 0xbe],
]);

/** Zeichen, die ISO-8859-1 an denselben Positionen führt und die es in ISO-8859-15 daher nicht gibt. */
const NUR_ISO_8859_1: ReadonlySet<string> = new Set(['¤', '¦', '¨', '´', '¸', '¼', '½', '¾']);

function bereich(von: number, bis: number): number[] {
  const werte: number[] = [];
  for (let i = von; i <= bis; i++) werte.push(i);
  return werte;
}

/**
 * Zulässiger Zeichenvorrat für Personennamen laut Zeichensatz-Dokument
 * (ZOV-Vorrat UNT_ISO): Leerzeichen, Apostroph, Bindestrich, Punkt, Ziffern,
 * Groß- und Kleinbuchstaben sowie Ä Ö Ü ß ä ö ü. Mehr nicht — ein Name mit
 * anderen diakritischen Zeichen ist über ELDA nicht übermittelbar.
 */
const VORRAT_PERSONENNAME: ReadonlySet<number> = new Set([
  0x20,
  0x27,
  0x2d,
  0x2e,
  ...bereich(48, 57),
  ...bereich(65, 90),
  ...bereich(97, 122),
  196,
  214,
  220,
  223,
  228,
  246,
  252,
]);

/**
 * Zulässiger Zeichenvorrat für Unternehmensnamen und Adressen laut
 * Zeichensatz-Dokument. Deutlich weiter als bei Personennamen, aber nicht der
 * volle Zeichensatz: 188–190 und 225 sind ausgenommen (gegen die PDF-Tabelle
 * ISO8859-15/„Unternehmensnamen, Adressen" bestätigt — die Aufzählung springt
 * dort ausdrücklich von 160..187 auf 191..195 und von 224 auf 226).
 */
const VORRAT_UNTERNEHMEN: ReadonlySet<number> = new Set([
  ...bereich(32, 126),
  ...bereich(160, 187),
  ...bereich(191, 224),
  ...bereich(226, 255),
]);

function vorratFuer(klasse: Feldklasse): ReadonlySet<number> | undefined {
  if (klasse === 'personenname') return VORRAT_PERSONENNAME;
  if (klasse === 'unternehmen') return VORRAT_UNTERNEHMEN;
  return undefined;
}

/** Codepunkt eines Zeichens in ISO-8859-15, oder `undefined`, wenn nicht darstellbar. */
function codepunkt(zeichen: string): number | undefined {
  const abweichung = ABWEICHUNGEN.get(zeichen);
  if (abweichung !== undefined) return abweichung;
  if (NUR_ISO_8859_1.has(zeichen)) return undefined;
  const code = zeichen.codePointAt(0);
  return code !== undefined && code <= 0xff ? code : undefined;
}

/**
 * Prüft, ob jedes Zeichen im zulässigen Vorrat der Feldklasse liegt. Wirft mit
 * Feldname, Zeichen und Position, statt still zu ersetzen: Wie ein Name zu
 * schreiben ist, wenn der Vorrat ihn nicht hergibt, ist eine fachliche
 * Entscheidung des Dienstgebers, keine Ersetzungstabelle im Code.
 */
export function pruefeVorrat(text: string, klasse: Feldklasse, feld: string): void {
  const vorrat = vorratFuer(klasse);
  const zeichen = [...text];
  for (let i = 0; i < zeichen.length; i++) {
    const z = zeichen[i]!;
    const code = codepunkt(z);
    if (code === undefined) {
      throw new EldaError(
        `Feld ${feld}: Zeichen '${z}' an Position ${i + 1} ist in ISO-8859-15 nicht darstellbar. ` +
          'ELDA erwartet Fixlängen-Dateien in ISO-8859-15; eine Ersatzschreibweise ist fachlich zu wählen.',
      );
    }
    if (vorrat && !vorrat.has(code)) {
      throw new EldaError(
        `Feld ${feld}: Zeichen '${z}' an Position ${i + 1} gehört nicht zum zulässigen Zeichenvorrat ` +
          `für ${klasse === 'personenname' ? 'Personennamen' : 'Unternehmensnamen und Adressen'}.`,
      );
    }
  }
}

/**
 * Kodiert Text nach ISO-8859-15. Nicht darstellbare Zeichen werfen — es wird
 * nichts ersetzt und nichts weggelassen.
 */
export function nachIso885915(text: string, feld: string): Buffer {
  const zeichen = [...text];
  const bytes = Buffer.alloc(zeichen.length);
  for (let i = 0; i < zeichen.length; i++) {
    const z = zeichen[i]!;
    const code = codepunkt(z);
    if (code === undefined) {
      throw new EldaError(
        `Feld ${feld}: Zeichen '${z}' an Position ${i + 1} ist in ISO-8859-15 nicht darstellbar.`,
      );
    }
    bytes[i] = code;
  }
  return bytes;
}
