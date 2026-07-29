import { EldaStatusError } from './errors';

/**
 * Die Status-Codes des Transfer-Webservice zerfallen in zwei Klassen: Zustände,
 * die ein Aufrufer sinnvoll behandeln kann, und Ausnahmen, bei denen der Aufruf
 * schlicht kaputt ist. Diese Datei ist die einzige Stelle, an der diese
 * Unterscheidung getroffen wird.
 *
 * Ein Code, der in der Karte einer Methode fehlt, wird geworfen — auch wenn er
 * bei einer anderen Methode ein Zustand ist (`405` ergibt beim Empfangen keinen
 * Sinn) und auch wenn ELDA die Tabelle künftig erweitert. Werfen ist die sichere
 * Vorgabe.
 */

/** Ausgänge von `senden`: die Datei liegt in allen drei Fällen bei ELDA. */
export const SENDEN_ZUSTAENDE = {
  '000': 'angenommen',
  '404': 'nochInArbeit',
  '405': 'duplikat',
} as const satisfies Readonly<Record<string, string>>;

/**
 * Ausgänge von `empfangen`.
 *
 * `404` steht hier bewusst NICHT: Die Status-Tabelle der Schnittstellenbeschreibung
 * (Abschnitt 6) führt den Code ausdrücklich als „nicht zutreffend" für
 * `EmpfangenResult`, und Abschnitt 3.6 nennt für `empfangen` nur `000`, `406`,
 * `407`, `408` und `500`. `404` heißt dort „Datei wird noch verarbeitet
 * (Verarbeitung > 40 Sekunden)" — eine Aussage über eine SENDUNG, die zu einem
 * Abholvorgang nicht passt. Ihn trotzdem als `'nochInArbeit'` durchzureichen
 * hieße: Sollte ELDA den Code bei `empfangen` je mit anderer Bedeutung schicken,
 * pollt der Aufrufer endlos weiter, statt laut zu scheitern. Werfen ist die
 * sichere Vorgabe.
 */
export const EMPFANGEN_ZUSTAENDE = {
  '000': 'datei',
  '406': 'nichtVorhanden',
  '408': 'bereitsEmpfangen',
} as const satisfies Readonly<Record<string, string>>;

/** Ausgänge von `ruecksendungenAuflisten`: nur der Erfolgsfall ist behandelbar. */
export const AUFLISTEN_ZUSTAENDE = {
  '000': 'liste',
} as const satisfies Readonly<Record<string, string>>;

/**
 * Übersetzt den Status-Code eines rohen Ergebnisses in den Zustand der jeweiligen
 * Methode. Ist der Code dort nicht vorgesehen, wirft die Funktion einen
 * {@link EldaStatusError}, der Code, Meldung und das rohe Ergebnis mitführt.
 */
export function zustandOderWurf<T extends string>(
  karte: Readonly<Record<string, T>>,
  ergebnis: { statusCode: string; meldung?: string },
): T {
  // `karte[...]` löst auch über die Prototyp-Kette auf: Ein `statusCode` von
  // z. B. `'constructor'` oder `'toString'` läge dann NICHT bei `undefined`,
  // obwohl er gar nicht in der Karte steht — die Wurf-Garantie dieser Funktion
  // wäre lautlos ausgehebelt. `Object.hasOwn` prüft ausschließlich Eigenschaften
  // der Karte selbst und hält die drei Karten dabei als gewöhnliche, gut lesbare
  // Objekt-Literale (Alternative wäre `Object.create(null)` beim Bau der Karten
  // — das an dieser einzigen Zugriffsstelle abzusichern ist einfacher und lokaler).
  const zustand = Object.hasOwn(karte, ergebnis.statusCode) ? karte[ergebnis.statusCode] : undefined;
  if (zustand === undefined) {
    throw new EldaStatusError(ergebnis.statusCode, ergebnis, ergebnis.meldung);
  }
  return zustand;
}
