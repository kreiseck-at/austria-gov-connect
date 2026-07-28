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

/** Ausgänge von `empfangen`. */
export const EMPFANGEN_ZUSTAENDE = {
  '000': 'datei',
  '404': 'nochInArbeit',
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
  const zustand = karte[ergebnis.statusCode];
  if (zustand === undefined) {
    throw new EldaStatusError(ergebnis.statusCode, ergebnis, ergebnis.meldung);
  }
  return zustand;
}
