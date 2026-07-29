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
  /**
   * Stellenscharfe Formatvorgabe, wie sie die Feldtabelle in der Spalte
   * INHALT/BEZEICHNUNG unter dem Feldnamen abdruckt — `TTMMJJJJ` bei allen
   * Datumsfeldern, `LLLPTTMMJJ` bei der Versicherungsnummer (Kapitel E.29,
   * Seiten 299–301).
   *
   * Nur bei numerischen Feldern sinnvoll und dort mit einer Folge: Ein belegter
   * Wert muss GENAU `laenge` Ziffern haben und wird NICHT mit führenden Nullen
   * aufgefüllt. Ohne diese Angabe wäre `BVAB: '1032026'` — der 10.03.2026, vom
   * Aufrufer ohne führende Null des Monats formatiert — stillschweigend zu
   * `'01032026'` (01.03.2026) geworden: ein anderes, gültig aussehendes Datum,
   * das weder hier noch bei ELDA auffiele, weil der Prüfkatalog (Blatt VR) für
   * die meisten dieser Felder überhaupt keine Formatzeile führt. Bei einem
   * stellenkodierten Wert wie der Versicherungsnummer verschöbe dieselbe
   * Auffüllung die Bedeutung jeder einzelnen Stelle.
   */
  format?: 'TTMMJJJJ' | 'LLLPTTMMJJ';
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

function zuLang(feld: Feld, laenge: number): EldaError {
  return new EldaError(
    `Feld ${feld.name}: Wert ist ${laenge} Zeichen lang, zulässig sind ${feld.laenge}. ` +
      'Der Wert wird nicht abgeschnitten — er ist fachlich zu kürzen.',
  );
}

/**
 * Füllt ein numerisches Feld (Typ `n`): rechtsbündig, Grundstellung 0, führende
 * Nullen, keine Interpunktion — so beschreibt es Kapitel C.1.1 bzw. E.1.
 *
 * Drei Feinheiten, die das Dokument nicht ausdrücklich ausbuchstabiert, die aber
 * aus derselben Beschreibung folgen:
 *
 * 1. Führende und nachgestellte Leerzeichen werden abgeschnitten. Werte, die aus
 *    einem längenfixierten Satz zurückgelesen wurden, kommen aufgefüllt an;
 *    `pruefeInhalt` trimmt sie bereits, hier wären sie sonst ein Ziffernfehler.
 * 2. Ein Wert, der ausschließlich aus Nullen besteht, IST die Grundstellung —
 *    unabhängig von seiner Stellenzahl. Weil führende Nullen in dieser Kodierung
 *    keine Bedeutung tragen, bezeichnen `''`, `'0'` und `'00000000'` denselben
 *    Feldinhalt. Ohne diese Gleichsetzung gälte ein `String(row.vsnr ?? 0)` aus
 *    einer Datenbank-Spalte als belegte Versicherungsnummer.
 * 3. Trägt das Feld eine Formatvorgabe (siehe {@link Feld.format}), wird ein
 *    belegter Wert NICHT aufgefüllt, sondern muss die volle Stellenzahl haben.
 *
 * Der Feldwert selbst steht in keiner Fehlermeldung: Zu den numerischen Feldern
 * zählen Versicherungsnummer und Geburtsdatum, und Fehlermeldungen landen in
 * Logs und Fehler-Trackern. Genannt werden Feldname, Art des Mangels und — wie
 * schon in `pruefeVorrat` — höchstens ein einzelnes Zeichen samt Position.
 */
function fuelleNumerisch(roh: string, feld: Feld): string {
  const wert = roh.trim();
  if (wert.length > feld.laenge) throw zuLang(feld, wert.length);

  const zeichen = [...wert];
  for (let i = 0; i < zeichen.length; i++) {
    const z = zeichen[i]!;
    if (z < '0' || z > '9') {
      throw new EldaError(
        `Feld ${feld.name}: numerisches Feld, aber Zeichen '${z}' an Position ${i + 1} ist keine ` +
          'Ziffer. Zulässig sind ausschließlich Ziffern (keine Vorzeichen, keine Interpunktion, ' +
          'kein Dezimalkomma).',
      );
    }
  }

  // Grundstellung: leer oder ausschließlich Nullen.
  if (wert === '' || /^0+$/.test(wert)) return '0'.repeat(feld.laenge);

  if (feld.format !== undefined && wert.length !== feld.laenge) {
    throw new EldaError(
      `Feld ${feld.name}: Format ${feld.format} verlangt genau ${feld.laenge} Ziffern, der Wert hat ` +
        `${wert.length}. Er wird bewusst NICHT mit führenden Nullen aufgefüllt — das ergäbe einen ` +
        'anderen, gültig aussehenden Wert (aus dem 10.03.2026 als "1032026" etwa den 01.03.2026).',
    );
  }
  return wert.padStart(feld.laenge, '0');
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
  if (feld.typ === 'n') return fuelleNumerisch(roh, feld);
  if (roh.length > feld.laenge) throw zuLang(feld, roh.length);
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
  const teile = fuelleAlle(felder, werte, satzlaenge);
  const satz = Buffer.concat(teile.map((t, i) => nachIso885915(t, felder[i]!.name)));
  if (satz.length !== satzlaenge) {
    throw new EldaError(`Satz ist ${satz.length} Bytes lang, erwartet waren ${satzlaenge}.`);
  }
  return satz;
}

/**
 * Wie {@link baueSatz}, liefert das Ergebnis aber als Zeichenkette statt als
 * ISO-8859-15-Puffer — für Satzteile, die anschließend als Feldwert in einen
 * umschließenden Satz eingehen und dort ohnehin kodiert werden (der
 * Identifikationsteil aus Kapitel E.1).
 *
 * Das ist kein Verzicht auf Prüfung: `fuelle` weist über `pruefeVorrat` jedes in
 * ISO-8859-15 nicht darstellbare Zeichen bereits feldscharf ab, und numerische
 * Felder enthalten danach nur noch Ziffern. Die frühere Fassung kodierte den
 * Identifikationsteil nach ISO-8859-15 und dekodierte ihn sofort wieder mit
 * `latin1` — zwei verschiedene Tabellen. An den acht Positionen, an denen die
 * beiden auseinandergehen, kam ein anderes Zeichen zurück, das der umschließende
 * Satz dann als „nicht darstellbar" abwies: derselbe Ausgang (nichts wurde still
 * verfälscht), aber mit einer Begründung, die auf das falsche Zeichen zeigt.
 */
export function baueSatzText(felder: readonly Feld[], werte: Werte, satzlaenge: number): string {
  const satz = fuelleAlle(felder, werte, satzlaenge).join('');
  if (satz.length !== satzlaenge) {
    throw new EldaError(`Satz ist ${satz.length} Zeichen lang, erwartet waren ${satzlaenge}.`);
  }
  return satz;
}

/** Gemeinsamer Kern von `baueSatz` und `baueSatzText`: prüfen, füllen — noch ohne Kodierung. */
function fuelleAlle(felder: readonly Feld[], werte: Werte, satzlaenge: number): string[] {
  const bekannt = new Set(felder.map((f) => f.name));
  for (const name of Object.keys(werte)) {
    if (!bekannt.has(name)) {
      throw new EldaError(`Unbekanntes Feld '${name}' — es gehört nicht zu dieser Satzart.`);
    }
  }
  pruefeFeldtabelle(felder, satzlaenge);
  return felder.map((f) => fuelle(werte[f.name], f));
}
