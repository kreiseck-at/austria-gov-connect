import { EldaError } from './errors';
import type { Feld } from './festsatz';

/**
 * Pflichtstufen, wie sie die Legenden der Tabellen „zwingende Angabe je
 * Satzart" in Kapitel E führen:
 * - `Z`  Angabe zwingend
 * - `Z1` zwingend, wenn zutreffend
 * - `Z3` Angabe möglich
 * - `V`  Angabe nur bei Veränderung
 * - `-`  keine Angabe, Feld in Grundstellung
 */
export type Stufe = 'Z' | 'Z1' | 'Z3' | 'V' | '-';

/**
 * Eine Pflichtmatrix: je Feld die Stufe je Satzart. Die Satzarten sind die
 * SART-Werte des jeweiligen Kapitels, z. B. `'80'` bis `'86'`.
 */
export type Matrix<S extends string> = Readonly<Record<string, Readonly<Record<S, Stufe>>>>;

/**
 * Entscheidet, ob ein Feld belegt ist. Für numerische Felder ist ein Wert aus
 * lauter Nullen die Grundstellung (Kapitel E.1: „n numerisch: rechtsbündig,
 * Grundstellung 0") und damit unbelegt — dieselbe Regel wie in
 * `pflicht-e29.ts`, aus denselben Gründen.
 */
export function istBelegt(feld: Feld | undefined, wert: string | undefined): boolean {
  if (wert === undefined) return false;
  const getrimmt = wert.trim();
  if (getrimmt === '') return false;
  if (feld?.typ === 'n' && /^0+$/.test(getrimmt)) return false;
  return true;
}

/**
 * Prüft die objektiv entscheidbaren Stufen einer Matrix: `Z` muss belegt sein,
 * `-` muss leer bleiben. `Z1` und `V` hängen an einer fachlichen Bedingung,
 * die hier nicht bekannt ist, und werden nicht erzwungen; `Z3` ist
 * freigestellt.
 *
 * Felder, die in `werte` vorkommen, aber nicht in der Matrix stehen, weist
 * `baueSatz` ab — nicht diese Funktion.
 */
export function pruefeMatrix<S extends string>(
  matrix: Matrix<S>,
  felder: readonly Feld[],
  satzart: S,
  bezeichnung: string,
  werte: Readonly<Record<string, string | undefined>>,
): void {
  const nachName = new Map(felder.map((f) => [f.name, f]));
  for (const [name, stufen] of Object.entries(matrix)) {
    const stufe = stufen[satzart];
    const belegt = istBelegt(nachName.get(name), werte[name]);
    if (stufe === 'Z' && !belegt) {
      throw new EldaError(`Satzart ${satzart} (${bezeichnung}): Feld ${name} ist zwingend anzugeben.`);
    }
    if (stufe === '-' && belegt) {
      throw new EldaError(
        `Satzart ${satzart} (${bezeichnung}): Feld ${name} ist in Grundstellung zu übermitteln, ` +
          'eine Angabe ist hier nicht zulässig.',
      );
    }
  }
}
