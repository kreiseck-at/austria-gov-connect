import type { Pflichtstufe } from './pflicht-e29';

/**
 * Pflichtstufen der VSNR-Anforderung (Satzart `VS`) laut Kapitel E.30.1,
 * Seite 342 — reines Datenabbild. Legende ebenda: `Z` Angabe zwingend, `Z1`
 * zwingend, wenn zutreffend, `Z3` Angabe möglich, `-` keine Angabe.
 */
export const PFLICHT_E30: Readonly<Record<string, Pflichtstufe>> = Object.freeze({
  REFW: 'Z',
  BKNR: 'Z',
  DGNA: 'Z',
  DTEL: 'Z3',
  MAIL: 'Z3',
  INF1: 'Z3',
  INF2: 'Z3',
  GEBD: 'Z',
  FANA: 'Z',
  FNA1: 'Z1',
  VONA: 'Z',
  AKGV: 'Z1',
  AKGH: 'Z1',
  GESL: 'Z',
  STSL: 'Z',
  WKFZ: 'Z',
  PLZL: 'Z',
  WORT: 'Z',
  WSTR: 'Z',
  WHNR: 'Z1',
  WTUR: 'Z1',
});

/**
 * Fehlercode je Pflichtfeld, wenn es leer bleibt — Prüfkatalog 43.1.0.0,
 * Blatt `VS`, Spalte „Fehler wenn: leer". `DGNA` fehlt auf dem Blatt `VS`,
 * steht aber auf dem Blatt `FC-Texte`: „6520 Feld DIENSTGEBERNAME ist zu
 * befuellen", Status `N`.
 */
export const LEER_CODE_E30: Readonly<Record<string, string>> = Object.freeze({
  REFW: 'F6500',
  BKNR: 'F6510',
  DGNA: 'F6520',
  GEBD: 'F6530',
  FANA: 'F6540',
  VONA: 'F6550',
  GESL: 'F6560',
  STSL: 'F6570',
  WKFZ: 'F6580',
  PLZL: 'F6582',
  WORT: 'F6584',
  WSTR: 'F6586',
});
