import type { U30Paket } from './typen';

/** Flache Kopie der eigenen, aufzählbaren Eigenschaften — jede genau einmal gelesen. */
function flach(o: unknown): unknown {
  if (typeof o !== 'object' || o === null || Array.isArray(o) || o instanceof Date) return o;
  return Object.fromEntries(Object.entries(o));
}

/**
 * Momentaufnahme eines Pakets als reine Daten: Paket, Erklärungen, Zeitraum,
 * Kennzahlen und erwartete Steuer werden je einmal gelesen und flach kopiert;
 * Getter auf dem Prototyp, geerbte und nicht aufzählbare Eigenschaften fallen
 * weg. Prüfung und XML-Bau arbeiten ausschließlich auf dieser Kopie — so kann
 * keine Eingabe (z. B. ein Getter, der beim zweiten Lesen etwas anderes
 * liefert) an der Prüfung vorbei ins XML gelangen.
 */
export function schnappschuss(paket: unknown): U30Paket {
  if (typeof paket !== 'object' || paket === null) return {} as U30Paket;
  const kopie = flach(paket) as Record<string, unknown>;
  const erklaerungen = kopie['erklaerungen'];
  if (Array.isArray(erklaerungen)) {
    kopie['erklaerungen'] = erklaerungen.map((e: unknown) => {
      const k = flach(e);
      if (typeof k !== 'object' || k === null) return k;
      const r = k as Record<string, unknown>;
      for (const feld of ['zeitraum', 'kennzahlen', 'erwarteteSteuer']) {
        if (Object.hasOwn(r, feld)) r[feld] = flach(r[feld]);
      }
      return r;
    });
  }
  return kopie as unknown as U30Paket;
}
