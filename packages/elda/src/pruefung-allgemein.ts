import { EldaError } from './errors';
import {
  gueltigesGeburtsdatum,
  gueltigeVsnrStruktur,
  normalisiert,
  normalisiertNumerisch,
} from './pruefung-e29';

type Werte = Readonly<Record<string, string | undefined>>;

/** Wirft einen Fehler mit dem Code des Prüfkatalogs vorne, wie `pruefung-e29.ts`. */
export function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

/**
 * Die Prüfungen aus dem Blatt `Allgemein` des Prüfkatalogs (43.1.0.0, Kapitel
 * H.1), die für alle Bestände gelten, deren Satzarten dort genannt sind — mit
 * Status N, also „Nichtübernahme". Status-W-Zeilen (Warnungen) prüft dieses
 * Paket nicht.
 *
 * Abgedeckt sind die Personen- und Dienstgeberangaben, die die
 * Familienhospiz- (80–86) und die Schwerarbeitsmeldung (65, 66) gemeinsam
 * haben:
 *
 * - `F0010` Beitragskontonummer leer.
 * - `F0011` Beitragskontonummer ungültig. Der Fehlertext (Blatt `FC-Texte`)
 *   lautet „keine Sonder- oder Leerzeichen verwenden"; die Katalogzeile sagt
 *   dazu: „‚NEU' ist gültig nur bei SART 03, 05, 08, 13, 15, E1, E2, E5" — für
 *   die Satzarten hier also nicht. Geprüft wird genau das: nur Buchstaben und
 *   Ziffern, nicht `NEU`. Die trägerabhängige Stellenzahl (F0013 ff.) ist
 *   Status W und bleibt bei `pruefeBeitragskontonummer`.
 * - `F0020` Dienstgebername leer.
 * - `F0030` Versicherungsnummer und Geburtsdatum beide leer.
 * - `F0040` Versicherungsnummer ungültig — die Stellenfolge laut Kapitel D.6
 *   wie in `pruefung-e29.ts`; die Prüfziffer bleibt ungeprüft.
 * - `F0050` Geburtsdatum ungültig (TTMMJJJJ, 00MMJJJJ oder 0000JJJJ).
 * - `F0060` Familienname leer, `F0070` Vorname leer.
 *
 * Der Wert selbst steht in keiner Meldung: Versicherungsnummer und
 * Geburtsdatum sind Personendaten.
 */
export function pruefeAllgemein(werte: Werte): void {
  const bknr = normalisiert(werte.BKNR);
  if (bknr === undefined) wirf('F0010', 'Die Beitragskontonummer (BKNR) ist zu befüllen.');
  if (!/^[0-9A-Za-z]+$/.test(bknr) || bknr.toUpperCase() === 'NEU') {
    wirf(
      'F0011',
      'Die Beitragskontonummer (BKNR) ist ungültig: keine Sonder- oder Leerzeichen; „NEU" ist bei ' +
        'dieser Satzart nicht zulässig.',
    );
  }
  if (normalisiert(werte.DGNA) === undefined) wirf('F0020', 'Der Dienstgebername (DGNA) ist zu befüllen.');

  const vsnr = normalisiertNumerisch(werte.VSNR);
  const gebd = normalisiertNumerisch(werte.GEBD);
  if (vsnr === undefined && gebd === undefined) {
    wirf('F0030', 'Versicherungsnummer (VSNR) oder Geburtsdatum (GEBD) ist zu befüllen.');
  }
  if (vsnr !== undefined && !gueltigeVsnrStruktur(vsnr)) {
    wirf(
      'F0040',
      'Die Versicherungsnummer (VSNR) ist ungültig. Erwartet: zehn Ziffern LLLPTTMMJJ mit Tag 01 bis 31 ' +
        'und Monat 01 bis 15 (Kapitel D.6). Die Prüfziffer wird hier nicht nachgerechnet.',
    );
  }
  if (gebd !== undefined && !gueltigesGeburtsdatum(gebd)) {
    wirf('F0050', 'Das Geburtsdatum (GEBD) ist ungültig. Zulässig: TTMMJJJJ, 00MMJJJJ oder 0000JJJJ.');
  }
  if (normalisiert(werte.FANA) === undefined) wirf('F0060', 'Der Familienname (FANA) ist zu befüllen.');
  if (normalisiert(werte.VONA) === undefined) wirf('F0070', 'Der Vorname (VONA) ist zu befüllen.');
}
