import { FonError } from '@kreiseck/finanzonline-core';
import { KENNZAHLEN, type Kennzahl, type SatzKennzahl } from './kennzahlen';

/** Kennzahlen einer Voranmeldung, Beträge in ganzen Cent. Fehlend = 0. */
export type U30Kennzahlen = Partial<Record<Kennzahl, number>>;

export interface U30Berechnung {
  /** Steuer je Satz-Kennzahl mit Bemessungsgrundlage ≠ 0, in Katalog-Reihenfolge. */
  steuerJeSatz: Array<{
    kennzahl: SatzKennzahl;
    bemessungsgrundlage: number;
    satzProzent: number;
    steuer: number;
  }>;
  /** Σ Steuer je Satz + KZ 056 + 057 + 048 + 044 + 032. */
  umsatzsteuer: number;
  /** KZ 060 + 061 + 083 + 065 + 066 + 082 + 087 + 089 + 064 − 062 + 063 + 067. */
  vorsteuer: number;
  /** KZ 090. */
  sonstigeBerichtigungen: number;
  /** KZ 095: größer 0 Zahllast, kleiner 0 Gutschrift. */
  ergebnis: number;
  art: 'zahllast' | 'gutschrift' | 'null';
}

const STEUERSCHULD: readonly Kennzahl[] = ['kz056', 'kz057', 'kz048', 'kz044', 'kz032'];
const VORSTEUER_PLUS: readonly Kennzahl[] = [
  'kz060',
  'kz061',
  'kz083',
  'kz065',
  'kz066',
  'kz082',
  'kz087',
  'kz089',
  'kz064',
  'kz063',
  'kz067',
];

function alsZahl(wert: bigint, was: string): number {
  const n = Number(wert);
  if (!Number.isSafeInteger(n))
    throw new FonError(`${was} ist zu groß für eine genaue Darstellung (${wert} Cent).`);
  return n;
}

/**
 * Steuer einer Zeile in Cent: Bemessungsgrundlage × Satz, auf Cent gerundet,
 * halbe Cent vom Nullpunkt weg (bei nicht negativer Bemessungsgrundlage also
 * aufgerundet — § 204 BAO und die Rechnung im BMF-Formular U 30-2026).
 * Gerechnet wird ganzzahlig mit `BigInt`.
 */
export function steuerFuerSatz(bemessungsgrundlage: number, satzPromille: number): number {
  const exakt = BigInt(bemessungsgrundlage) * BigInt(satzPromille); // in 1/1000 Cent
  const betrag = exakt < 0n ? -exakt : exakt;
  const gerundet = (betrag * 2n + 1000n) / 2000n;
  return alsZahl(exakt < 0n ? -gerundet : gerundet, 'Steuerbetrag');
}

const wert = (kennzahlen: U30Kennzahlen, kz: Kennzahl): bigint => BigInt(kennzahlen[kz] ?? 0);

/**
 * Rechnet Steuer je Satz und Zahllast/Gutschrift (KZ 095) so, wie FinanzOnline
 * sie aus den übermittelten Kennzahlen ermittelt. Die Formel folgt dem Aufbau
 * des Formulars U 30-2026. Erwartet gültige Kennzahlen (siehe `pruefeU30`).
 */
export function berechneU30(kennzahlen: U30Kennzahlen): U30Berechnung {
  const steuerJeSatz: U30Berechnung['steuerJeSatz'] = [];
  let umsatzsteuer = 0n;
  for (const info of KENNZAHLEN) {
    if (info.satzPromille === undefined) continue;
    const bmg = kennzahlen[info.kz] ?? 0;
    if (bmg === 0) continue;
    const steuer = steuerFuerSatz(bmg, info.satzPromille);
    umsatzsteuer += BigInt(steuer);
    steuerJeSatz.push({
      kennzahl: info.kz as SatzKennzahl,
      bemessungsgrundlage: bmg,
      satzProzent: info.satzPromille / 10,
      steuer,
    });
  }
  for (const kz of STEUERSCHULD) umsatzsteuer += wert(kennzahlen, kz);

  let vorsteuer = -wert(kennzahlen, 'kz062');
  for (const kz of VORSTEUER_PLUS) vorsteuer += wert(kennzahlen, kz);

  const sonstige = wert(kennzahlen, 'kz090');
  const ergebnis = umsatzsteuer - vorsteuer + sonstige;

  return {
    steuerJeSatz,
    umsatzsteuer: alsZahl(umsatzsteuer, 'Umsatzsteuer'),
    vorsteuer: alsZahl(vorsteuer, 'Vorsteuer'),
    sonstigeBerichtigungen: alsZahl(sonstige, 'Sonstige Berichtigungen'),
    ergebnis: alsZahl(ergebnis, 'Ergebnis'),
    art: ergebnis > 0n ? 'zahllast' : ergebnis < 0n ? 'gutschrift' : 'null',
  };
}
