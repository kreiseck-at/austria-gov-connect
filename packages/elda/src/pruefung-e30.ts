import { EldaError } from './errors';
import { gueltigesGeburtsdatum } from './pruefung-e29';
import { STAATSANGEHOERIGKEITEN } from './staaten';

type Werte = Readonly<Record<string, string | undefined>>;

function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

function normalisiert(wert: string | undefined): string | undefined {
  if (wert === undefined) return undefined;
  const getrimmt = wert.trim().normalize('NFC');
  return getrimmt === '' ? undefined : getrimmt;
}

/**
 * Buchstaben im Sinne von Kapitel D.8/D.9: „Alphazeichen in Groß-/Kleinschrift
 * (inkl. Umlaute, ”ß”)". Weiter reicht auch der Zeichenvorrat für
 * Personennamen im Zeichensatz-Dokument nicht (siehe `zeichensatz.ts`).
 */
const BUCHSTABE = /^[A-Za-zÄÖÜäöüß]$/;

/**
 * Prüft einen Namen gegen die Prüfvorschriften aus Kapitel D.8 (Familienname,
 * Seite 74) bzw. D.9 (Vorname, Seite 75) und liefert den ersten Verstoß als
 * Text — oder `undefined`.
 *
 * Die Kapitel nennen ihre Regeln ausdrücklich als „Prüfvorschriften":
 *
 * - D.8 und D.9: „jedem Sonderzeichen (inkl. Blank) muss ein Buchstabe
 *   vorangestellt sein" und „nach zwei oder mehreren Blankstellen ist kein
 *   weiteres Zeichen erlaubt" — Letzteres folgt hier schon aus der ersten
 *   Regel, weil der Wert vor der Prüfung nur am Ende getrimmt wird;
 * - D.8: „Bindestrich und Hochkomma muss ein Buchstabe folgen"; D.9: „einem
 *   Bindestrich muss ein Buchstabe folgen";
 * - D.8: „der Punkt darf nur an der letzten bzw. vorletzten Stelle verwendet
 *   werden".
 *
 * Dazu der Zeichenvorrat aus dem jeweiligen Abschnitt „Inhalt": beim
 * Familiennamen Buchstaben, Hochkomma, Bindestrich, Punkt und Blank, beim
 * Vornamen Buchstaben, Bindestrich, Punkt und Blank — ein Hochkomma nennt D.9
 * nicht.
 *
 * Zur Punktregel: D.8 erlaubt, Namen über 70 Zeichen „an der 69/70. Stelle
 * durch einen Punkt" abzukürzen. Ob „letzte bzw. vorletzte Stelle" das Feld
 * oder den Namen meint, lässt der Text offen. Geprüft wird die schwächere
 * Lesart (letzte oder vorletzte Stelle des Namens) — sie gilt unter beiden.
 *
 * **Nicht** geprüft wird die Groß- und Kleinschreibung: D.8 nennt Ausnahmen
 * (Vorsilben wie „van", Großschrift bei nachgewiesenen asiatischen Namen), die
 * sich aus dem Namen allein nicht entscheiden lassen.
 *
 * Der Name selbst steht in keiner Meldung — er ist ein Personendatum; genannt
 * werden Stelle und Regel.
 */
export function namensVerstoss(name: string, art: 'familienname' | 'vorname'): string | undefined {
  const z = [...name.normalize('NFC').trimEnd()];
  const sonderzeichen = art === 'familienname' ? "'-. " : '-. ';
  const kapitel = art === 'familienname' ? 'D.8' : 'D.9';
  for (let i = 0; i < z.length; i++) {
    const c = z[i]!;
    if (BUCHSTABE.test(c)) continue;
    if (!sonderzeichen.includes(c)) {
      return `Zeichen an Stelle ${i + 1} ist nicht zulässig — erlaubt sind Buchstaben und ${
        art === 'familienname' ? 'Hochkomma, Bindestrich, Punkt, Blank' : 'Bindestrich, Punkt, Blank'
      } (Kapitel ${kapitel}).`;
    }
    if (i === 0 || !BUCHSTABE.test(z[i - 1]!)) {
      return `dem Sonderzeichen an Stelle ${i + 1} geht kein Buchstabe voran (Kapitel ${kapitel}).`;
    }
    if ((c === '-' || c === "'") && !(i + 1 < z.length && BUCHSTABE.test(z[i + 1]!))) {
      return `auf ${c === '-' ? 'den Bindestrich' : 'das Hochkomma'} an Stelle ${i + 1} folgt kein Buchstabe (Kapitel ${kapitel}).`;
    }
    if (art === 'familienname' && c === '.' && i < z.length - 2) {
      return `der Punkt an Stelle ${i + 1} steht weder an der letzten noch an der vorletzten Stelle (Kapitel D.8).`;
    }
  }
  return undefined;
}

/**
 * Zulässige Werte des Geschlechts laut Feldtabelle E.30 (Seite 340, Feld 15):
 * 1 männlich, 2 weiblich, 3 divers, 4 offen, 6 inter, 7 keine Angabe.
 * Deckt sich mit `F6562` des Prüfkatalogs.
 *
 * Der Katalog führt daneben noch `F6561` „ungültig (gültig 1,2)", ebenfalls
 * mit Status `N`. Beide Zeilen widersprechen sich für 3, 4, 6 und 7; die
 * Feldtabelle des Kapitels spricht für `F6562`. Was ELDA tatsächlich prüft, ist
 * offen (README, Ausblick).
 */
const GESCHLECHT: ReadonlySet<string> = new Set(['1', '2', '3', '4', '6', '7']);

/**
 * Prüft den Satzinhalt der VSNR-Anforderung gegen die Regeln des Prüfkatalogs
 * 43.1.0.0, Blatt `VS`, die sich aus den Feldwerten allein entscheiden lassen
 * und ELDA mit Status `N` (Zurückweisung) führt. Leere Pflichtfelder hat zuvor
 * schon `pruefePflichtstufen` abgewiesen.
 *
 * Nicht geprüft werden:
 *
 * - `F6511` „ungültige BKNR" und `F6583` „ungültige Postleitzahl" — der Katalog
 *   sagt nicht, woran er „ungültig" festmacht;
 * - `F6585`/`F6587` Groß- und Kleinschreibung von Ort und Straße — dafür nennt
 *   keine Quelle eine Regel;
 * - `F6581` das KFZ-Kennzeichen des Wohnorts — die öffentliche
 *   Staatencode-Tabelle ist dafür nicht abschließend (siehe `staaten.ts`);
 * - die Warnungen `F6513`–`F6519`, `F6590`–`F6592` (Länge der BKNR je Träger,
 *   dafür gibt es `pruefeBeitragskontonummer`), `F6593` (Zuordnung zur
 *   Seriennummer) und `F6532` (Geburtsjahr vor 1800 oder in der Zukunft).
 *
 * `F6512` (Leerzeichen an erster Stelle der BKNR, nur ÖGK-V) hängt am
 * zuständigen Träger und wird deshalb erst beim Bau des Bestands geprüft.
 */
export function pruefeVsnrAnforderungInhalt(werte: Werte): void {
  const gebd = normalisiert(werte.GEBD);
  if (gebd !== undefined && !gueltigesGeburtsdatum(gebd)) {
    wirf('F6531', 'Das Geburtsdatum (GEBD) ist ungültig. Zulässig: TTMMJJJJ, 00MMJJJJ oder 0000JJJJ.');
  }

  const fana = werte.FANA;
  if (fana !== undefined) {
    const verstoss = namensVerstoss(fana, 'familienname');
    if (verstoss) wirf('F6541', `Familienname (FANA): ${verstoss}`);
  }
  // FNA1 fällt unter dieselbe Überschrift D.8; der Katalog prüft aber nur FANA.
  const fna1 = werte.FNA1;
  if (fna1 !== undefined && fna1.trim() !== '') {
    const verstoss = namensVerstoss(fna1, 'familienname');
    if (verstoss) wirf('D.8', `Früherer Familienname (FNA1): ${verstoss}`);
  }
  const vona = werte.VONA;
  if (vona !== undefined) {
    const verstoss = namensVerstoss(vona, 'vorname');
    if (verstoss) wirf('F6551', `Vorname (VONA): ${verstoss}`);
  }

  const gesl = normalisiert(werte.GESL);
  if (gesl !== undefined && !GESCHLECHT.has(gesl)) {
    wirf(
      'F6562',
      `Das Geschlecht (GESL) '${gesl}' ist ungültig. Zulässig sind 1 (männlich), 2 (weiblich), 3 (divers), ` +
        '4 (offen), 6 (inter) und 7 (keine Angabe) — Feldtabelle E.30, Seite 340.',
    );
  }

  const stsl = normalisiert(werte.STSL);
  if (stsl !== undefined && !STAATSANGEHOERIGKEITEN.has(stsl)) {
    wirf(
      'F6571',
      `Die Staatsangehörigkeit (STSL) '${stsl}' steht nicht in der Staatencode-Tabelle der ÖGK ` +
        '(Spalte ISOA3, Kapitel D.11), z. B. AUT für Österreich.',
    );
  }
}
