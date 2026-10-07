import type { Pflichtstufe } from './pflicht-e29';

/**
 * Pflichtstufen der Adressmeldung Versicherter (Satzart `AV`) laut Kapitel
 * E.31.1, Seite 345 — reines Datenabbild. Legende wie bei E.30.1.
 */
export const PFLICHT_E31: Readonly<Record<string, Pflichtstufe>> = Object.freeze({
  REFW: 'Z',
  BKNR: 'Z',
  DGNA: 'Z',
  DTEL: 'Z3',
  MAIL: 'Z3',
  INF1: 'Z3',
  INF2: 'Z3',
  VSNR: 'Z',
  WKFZ: 'Z',
  PLZL: 'Z',
  WORT: 'Z',
  WSTR: 'Z',
  WHNR: 'Z1',
  WTUR: 'Z1',
});

/** Fehlercode je Pflichtfeld, wenn es leer bleibt — Prüfkatalog 43.1.0.0, Blatt `AV`. */
export const LEER_CODE_E31: Readonly<Record<string, string>> = Object.freeze({
  REFW: 'F8000',
  BKNR: 'F8010',
  DGNA: 'F8020',
  VSNR: 'F8030',
  WKFZ: 'F8040',
  PLZL: 'F8050',
  WORT: 'F8060',
  WSTR: 'F8070',
});
