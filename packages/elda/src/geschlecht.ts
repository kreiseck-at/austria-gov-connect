/**
 * Geschlecht des Arbeitnehmers in den Meldungen – aus den Werten des
 * Personenstands, wie `@kreiseck/validator` (`Gender`) sie führt: `m` männlich,
 * `f` weiblich, `d` divers, `i` inter, `o` offen.
 *
 * - **L16** (E.14, Felder 28–30 `GESW`/`GESM`/`GESD`, „zwingend wenn zutreffend“;
 *   Prüfregel F2801: genau ein „J“). Das BMF-Formular L 16 hat die Kästchen
 *   „weiblich“, „männlich“ und „inter/divers/offen“ – inter und offen gehen
 *   deshalb wie divers in `GESD`.
 * - **ELDA `GESL`** (E.30 VSNR-Anforderung, E.18, E.12, E.27): 1 männlich,
 *   2 weiblich, 3 divers, 4 offen, 6 inter (7 „keine Angabe“ hat kein Gegenstück
 *   im L16 und ist hier kein Wert).
 *
 * Ein unbekannter oder fehlender Wert wirft: ein leeres Geschlecht ginge sonst
 * still mit W 2801 hinaus.
 */

export type Geschlecht = 'm' | 'f' | 'd' | 'i' | 'o';

/** Die fünf Werte in fester Reihenfolge. */
export const GESCHLECHTER: readonly Geschlecht[] = Object.freeze(['m', 'f', 'd', 'i', 'o']);

/** Die drei Geschlechtsfelder des L1-Satzes; genau eines trägt „J“. */
export type L16Geschlecht = { GESW: 'J' } | { GESM: 'J' } | { GESD: 'J' };

/** `GESL` der SV-Meldungen. */
export type GeschlechtCodeElda = '1' | '2' | '3' | '4' | '6';

const L16: ReadonlyMap<string, L16Geschlecht> = new Map<string, L16Geschlecht>([
  ['m', { GESM: 'J' }],
  ['f', { GESW: 'J' }],
  ['d', { GESD: 'J' }],
  ['i', { GESD: 'J' }],
  ['o', { GESD: 'J' }],
]);

const ELDA: ReadonlyMap<string, GeschlechtCodeElda> = new Map<string, GeschlechtCodeElda>([
  ['m', '1'],
  ['f', '2'],
  ['d', '3'],
  ['o', '4'],
  ['i', '6'],
]);

function unbekannt(wert: unknown): never {
  throw new Error(
    `Geschlecht fehlt oder ist unbekannt: ${JSON.stringify(wert)} (erlaubt: ${GESCHLECHTER.join(', ')})`,
  );
}

/** Die Geschlechtsfelder für den L1-Satz des Lohnzettels. */
export function l16Geschlecht(geschlecht: string): L16Geschlecht {
  const felder = typeof geschlecht === 'string' ? L16.get(geschlecht) : undefined;
  if (felder === undefined) unbekannt(geschlecht);
  return { ...felder };
}

/** Der Geschlechtscode `GESL` für SV-Meldungen. */
export function geschlechtCodeElda(geschlecht: string): GeschlechtCodeElda {
  const code = typeof geschlecht === 'string' ? ELDA.get(geschlecht) : undefined;
  if (code === undefined) unbekannt(geschlecht);
  return code;
}
