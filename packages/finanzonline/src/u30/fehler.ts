import { FonError } from '@kreiseck/finanzonline-core';
import type { Kennzahl } from './kennzahlen';

/** Stabile Fehlercodes der U30-Prüfung. */
export type U30FehlerCode =
  // Paket
  | 'PAKETNR_UNGUELTIG'
  | 'ERKLAERUNGEN_ANZAHL'
  | 'UEBERMITTLER_UNGUELTIG'
  | 'UEBERMITTLER_FEHLT'
  | 'SATZNR_UNGUELTIG'
  | 'SATZNR_DOPPELT'
  | 'ERKLAERUNG_DOPPELT'
  | 'FELD_UNBEKANNT'
  // Erklärung — Form
  | 'STEUERNUMMER_UNGUELTIG'
  | 'STEUERNUMMER_PRUEFZIFFER'
  | 'ZEITRAUM_UNGUELTIG'
  | 'ZEITRAUM_NICHT_UNTERSTUETZT'
  | 'ZEITRAUM_ZU_ALT'
  | 'ZEITRAUM_NICHT_ABGESCHLOSSEN'
  | 'KENNZAHL_UNBEKANNT'
  | 'BETRAG_KEINE_GANZZAHL'
  | 'BETRAG_NEGATIV'
  | 'BETRAG_ZU_GROSS'
  | 'VST_UNGUELTIG'
  | 'KUNDENINFO_ZU_LANG'
  | 'KUNDENINFO_ZEICHEN'
  | 'SCHALTER_UNGUELTIG'
  // Erklärung — BMF-Prüfregeln (Prüfungen UVA ab 7/2026)
  | 'KZ000_FEHLT'
  | 'STEUERFREI_UEBER_STEUERBAR'
  | 'SUMME_STEUERPFLICHTIG_UNGLEICH'
  | 'IGE_OHNE_KZ070'
  | 'KZ071_UEBER_KZ070'
  | 'SUMME_IGE_UNGLEICH'
  | 'KZ066_OHNE_KZ057'
  | 'KZ066_UEBER_KZ057'
  | 'KZ082_OHNE_KZ048'
  | 'KZ082_UEBER_KZ048'
  | 'KZ087_OHNE_KZ044'
  | 'KZ087_UEBER_KZ044'
  | 'KZ089_OHNE_KZ032'
  | 'KZ089_UEBER_KZ032'
  | 'KZ020_OHNE_VST'
  | 'VST_OHNE_KZ020'
  | 'ARE_BEI_BERICHTIGUNG'
  | 'KZ124_125_ZU_FRUEH'
  // Kontrolle erwartete Steuer
  | 'STEUER_WEICHT_AB'
  | 'ERWARTETE_STEUER_KEIN_SATZ';

export interface U30Fehler {
  code: U30FehlerCode;
  /** Beschreibung für Menschen (deutsch). */
  nachricht: string;
  /** Index der betroffenen Erklärung in `paket.erklaerungen`. */
  erklaerung?: number;
  kennzahl?: Kennzahl;
  /** Betroffenes Feld, z. B. `'paketNr'`, `'zeitraum'`, `'kundeninfo'`. */
  feld?: string;
}

/** Ein Paket hat die Prüfung nicht bestanden; `fehler` enthält alle Befunde. */
export class U30PruefError extends FonError {
  readonly fehler: readonly U30Fehler[];

  constructor(fehler: readonly U30Fehler[]) {
    const codes = fehler.slice(0, 5).map((f) => f.code);
    const rest = fehler.length > 5 ? ', …' : '';
    super(`U30-Prüfung: ${fehler.length} Fehler (${codes.join(', ')}${rest})`);
    this.fehler = fehler;
  }
}
