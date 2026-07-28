import { EldaError } from './errors';
import { nachIso885915, pruefeVorrat, type Feldklasse } from './zeichensatz';

/**
 * Feldtyp laut Kapitel E.1 der Organisationsbeschreibung:
 * - `a/n` alphanumerisch: linksbündig, Grundstellung blank
 * - `a`   alphabetisch: dieselbe Ausrichtung, engerer Zeichenvorrat
 * - `n`   numerisch: rechtsbündig, Grundstellung 0, führende Nullen,
 *         keine Interpunktion — auch kein Dezimalkomma
 */
export type Feldtyp = 'a/n' | 'a' | 'n';

/** Ein Feld einer Satzart: Position und Länge stammen aus der Feldtabelle des jeweiligen Kapitels. */
export interface Feld {
  /** Feldnummer laut Dokument, dient der Rückverfolgbarkeit. */
  nr: number;
  /** Kurzname laut Dokument, z. B. `BKNR`. Zugleich Schlüssel im Werte-Objekt. */
  name: string;
  /** Startposition im Satz, 1-basiert wie im Dokument. */
  pos: number;
  /** Feldlänge in Zeichen. */
  laenge: number;
  /** Feldtyp, bestimmt Ausrichtung, Grundstellung und zulässigen Zeichenvorrat. */
  typ: Feldtyp;
  /** Zeichenvorrat-Klasse; ohne Angabe wird nur auf Darstellbarkeit geprüft. */
  klasse?: Feldklasse;
}

/** Werte je Feldname. Ein fehlender oder `undefined`-Wert bedeutet Grundstellung. */
export type Werte = Readonly<Record<string, string | undefined>>;

/**
 * Prüft eine Feldtabelle gegen sich selbst: lückenlos ab Position 1, ohne
 * Überschneidung, und endend auf der angegebenen Satzlänge. Damit fällt ein
 * Übertragungsfehler aus dem Dokument auf, bevor er Sätze verfälscht.
 */
export function pruefeFeldtabelle(felder: readonly Feld[], satzlaenge: number): void {
  let erwartet = 1;
  for (const f of felder) {
    if (f.pos !== erwartet) {
      throw new EldaError(
        `Feldtabelle: Feld ${f.name} (Nr. ${f.nr}) beginnt auf Position ${f.pos}, erwartet war ${erwartet}.`,
      );
    }
    if (f.laenge < 1) {
      throw new EldaError(`Feldtabelle: Feld ${f.name} hat eine Länge von ${f.laenge}.`);
    }
    erwartet += f.laenge;
  }
  if (erwartet - 1 !== satzlaenge) {
    throw new EldaError(
      `Feldtabelle endet auf Position ${erwartet - 1}, die Satzlänge ist aber ${satzlaenge}.`,
    );
  }
}

function fuelle(wert: string | undefined, feld: Feld): string {
  // NFC einmal herstellen und ab hier ausschließlich mit dieser Fassung
  // arbeiten: Länge, Ziffernprüfung und Auffüllung müssen dieselbe
  // Zeichenfolge sehen wie später `nachIso885915`. Manche Quellen (u. a. das
  // macOS-Dateisystem) liefern Umlaute zerlegt als Grundbuchstabe + kombinierendes
  // Zeichen — dieselbe Zeichenfolge, aber mit mehr `string`-Elementen. Würde
  // hier auf der Rohfassung gemessen und aufgefüllt, aber später auf der
  // NFC-Fassung kodiert, verschöben sich Feldlänge und Satzpositionen.
  const roh = (wert ?? '').normalize('NFC');
  if (roh.length > feld.laenge) {
    throw new EldaError(
      `Feld ${feld.name}: Wert ist ${roh.length} Zeichen lang, zulässig sind ${feld.laenge}. ` +
        'Der Wert wird nicht abgeschnitten — er ist fachlich zu kürzen.',
    );
  }
  if (feld.typ === 'n') {
    if (roh !== '' && !/^\d+$/.test(roh)) {
      throw new EldaError(
        `Feld ${feld.name}: numerisches Feld enthält '${roh}'. Zulässig sind ausschließlich Ziffern ` +
          '(keine Vorzeichen, keine Interpunktion, kein Dezimalkomma).',
      );
    }
    return roh.padStart(feld.laenge, '0');
  }
  pruefeVorrat(roh, feld.klasse ?? 'frei', feld.name);
  return roh.padEnd(feld.laenge, ' ');
}

/**
 * Baut einen Satz aus Feldtabelle und Werten. Das Ergebnis ist genau
 * `satzlaenge` Bytes lang und in ISO-8859-15 kodiert — der von ELDA für
 * Fixlängen-Dateien vorgeschriebene Zeichensatz.
 *
 * Validiert die Feldtabelle bei jedem Aufruf (siehe `pruefeFeldtabelle`).
 * Das kostet nur eine lineare Prüfung über die Feldtabelle selbst — die ist
 * je Satzart eine Handvoll bis wenige hundert Einträge lang, unabhängig von
 * der Anzahl der Sätze einer Datei. Gegenüber der ohnehin je Feld anfallenden
 * Zeichenvorrat- und Kodierungsprüfung fällt das nicht ins Gewicht, schützt
 * aber zuverlässig davor, dass eine in Tasks 3/6/7 falsch abgetippte
 * Feldtabelle unbemerkt Sätze verfälscht.
 */
export function baueSatz(felder: readonly Feld[], werte: Werte, satzlaenge: number): Buffer {
  const bekannt = new Set(felder.map((f) => f.name));
  for (const name of Object.keys(werte)) {
    if (!bekannt.has(name)) {
      throw new EldaError(`Unbekanntes Feld '${name}' — es gehört nicht zu dieser Satzart.`);
    }
  }
  pruefeFeldtabelle(felder, satzlaenge);
  const teile = felder.map((f) => nachIso885915(fuelle(werte[f.name], f), f.name));
  const satz = Buffer.concat(teile);
  if (satz.length !== satzlaenge) {
    throw new EldaError(`Satz ist ${satz.length} Bytes lang, erwartet waren ${satzlaenge}.`);
  }
  return satz;
}
