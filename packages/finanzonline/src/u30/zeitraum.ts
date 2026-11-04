import { wienerOrtszeit } from '../wien';

/**
 * Voranmeldungszeitraum: ein Kalendermonat oder ein Kalendervierteljahr.
 * Im XML wird ein Quartal als erster bis letzter Monat angegeben
 * (BMF-Prüfliste ab 1/2008: „Quartal 01-03: ZRVON 200301 ZRBIS 200303").
 */
export type Zeitraum = { jahr: number; monat: number } | { jahr: number; quartal: 1 | 2 | 3 | 4 };

const zweistellig = (n: number): string => String(n).padStart(2, '0');

function istGanzzahlZwischen(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/**
 * ZRVON/ZRBIS (`JJJJ-MM`) eines Zeitraums, oder `undefined`, wenn die Angabe
 * nicht genau einen gültigen Monat oder ein gültiges Quartal beschreibt.
 */
export function zrVonBis(z: unknown): { zrvon: string; zrbis: string } | undefined {
  if (typeof z !== 'object' || z === null) return undefined;
  const { jahr, monat, quartal } = z as { jahr?: unknown; monat?: unknown; quartal?: unknown };
  if (!istGanzzahlZwischen(jahr, 1000, 9999)) return undefined;
  const hatMonat = monat !== undefined;
  const hatQuartal = quartal !== undefined;
  if (hatMonat === hatQuartal) return undefined;
  if (hatMonat) {
    if (!istGanzzahlZwischen(monat, 1, 12)) return undefined;
    const m = `${jahr}-${zweistellig(monat)}`;
    return { zrvon: m, zrbis: m };
  }
  if (!istGanzzahlZwischen(quartal, 1, 4)) return undefined;
  const erster = (quartal - 1) * 3 + 1;
  return { zrvon: `${jahr}-${zweistellig(erster)}`, zrbis: `${jahr}-${zweistellig(erster + 2)}` };
}

/** Laufender Monat (`JJJJ-MM`) in Wiener Zeit. */
export function laufenderMonat(jetzt: Date): string {
  const w = wienerOrtszeit(jetzt);
  return `${w.jahr}-${w.monat}`;
}
