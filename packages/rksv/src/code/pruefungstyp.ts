/**
 * Ergebnis einer einzelnen Pruefung.
 *
 * Liegt in einer eigenen Datei, weil sowohl die umgebungsneutrale
 * Verkettungspruefung als auch die Node-gebundene Signaturpruefung ihn
 * brauchen. Ein Typ zieht zur Laufzeit nichts nach sich -- der Import aus
 * pruefe.ts taete es.
 */
export interface Pruefung {
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  detail?: string;
}
