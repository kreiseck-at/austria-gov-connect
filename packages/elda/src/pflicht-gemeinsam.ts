import { EldaError } from './errors';
import type { Feld } from './festsatz';
import type { Pflichtstufe } from './pflicht-e29';

/**
 * Pflichtprüfung für Meldungsarten mit genau einer Satzart (VSNR-Anforderung,
 * Adressmeldung Versicherter). Dieselbe Lesart wie `pruefePflicht` in
 * `pflicht-e29.ts`: `Z` muss belegt sein, `-` muss in Grundstellung bleiben,
 * `Z1` („zwingend, wenn zutreffend") und `Z3` („Angabe möglich") werden nicht
 * erzwungen.
 *
 * „Belegt" heißt wie dort: nach dem Trimmen nicht leer, und bei numerischen
 * Feldern nicht ausschließlich Nullen — das ist laut Kapitel C.1.1/E.1 die
 * Grundstellung des Feldtyps `n`.
 *
 * `leerCode` ordnet einem Feld den Fehlercode zu, mit dem der Prüfkatalog ein
 * leeres Pflichtfeld abweist; er steht dann in der Meldung, damit sich eine
 * Rückmeldung von ELDA zuordnen lässt.
 */
export function pruefePflichtstufen(
  bezeichnung: string,
  matrix: Readonly<Record<string, Pflichtstufe>>,
  felder: readonly Feld[],
  werte: Readonly<Record<string, string | undefined>>,
  leerCode: Readonly<Record<string, string>>,
): void {
  const numerisch = new Set(felder.filter((f) => f.typ === 'n').map((f) => f.name));
  const belegt = (feld: string): boolean => {
    const wert = werte[feld]?.trim();
    if (wert === undefined || wert === '') return false;
    return !(numerisch.has(feld) && /^0+$/.test(wert));
  };
  for (const [feld, stufe] of Object.entries(matrix)) {
    if (stufe === 'Z' && !belegt(feld)) {
      const code = leerCode[feld];
      throw new EldaError(`${code ? `${code}: ` : ''}${bezeichnung}: Feld ${feld} ist zwingend anzugeben.`);
    }
    if (stufe === '-' && belegt(feld)) {
      throw new EldaError(
        `${bezeichnung}: Feld ${feld} ist in Grundstellung zu übermitteln, eine Angabe ist hier nicht zulässig.`,
      );
    }
  }
}
