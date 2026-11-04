import type { U30Kennzahlen } from './berechne';
import type { SatzKennzahl } from './kennzahlen';
import type { Zeitraum } from './zeitraum';

/** Eine Umsatzsteuervoranmeldung. Alle Beträge in ganzen Cent. */
export interface U30Erklaerung {
  /** Steuernummer der/des Pflichtigen (FASTNR), 9 Ziffern ohne Trennzeichen. */
  steuernummer: string;
  /** Kalendermonat oder Kalendervierteljahr. */
  zeitraum: Zeitraum;
  /** Kennzahlen in Cent. Wert 0 wird nicht übermittelt, außer KZ 000 (Pflicht). */
  kennzahlen: U30Kennzahlen;
  /** Ziffer des § 6 Abs. 1 UStG zu KZ 020 (`VST`). */
  vst?: string;
  /** Antrag, den Überschuss zur Abdeckung von Abgaben zu verwenden (`ARE`). */
  ueberschussVerwenden?: boolean;
  /** Rechnungskopien gehen vorab/zeitgleich per Post ans Finanzamt (`REPO`). */
  rechnungskopien?: boolean;
  /** Interne Kennung (≤ 50 Zeichen, ISO-8859-1); kommt im Protokoll zurück. */
  kundeninfo?: string;
  /**
   * Berichtigung einer bereits abgegebenen UVA desselben Zeitraums. Geht nicht
   * ins XML (das Schema kennt kein solches Feld); steuert nur die BMF-Regel
   * „ARE nicht möglich bei einer Berichtigung".
   */
  berichtigung?: boolean;
  /** Kontrolle: erwartete Steuer je Satz-Kennzahl (z. B. aus Belegsummen). */
  erwarteteSteuer?: Partial<Record<SatzKennzahl, number>>;
  /** Satznummer im Paket; Standard: Position (1, 2, …). */
  satzNr?: number;
}

/** Eine Übermittlung (ein Datenpaket) mit einer oder mehreren Erklärungen. */
export interface U30Paket {
  /** 1…999.999.999; vom Aufrufer vergeben und eindeutig zu halten (Zuordnung des Protokolls). */
  paketNr: number;
  /**
   * Steuernummer des übermittelnden FinanzOnline-Teilnehmers
   * (IDENTIFIKATIONSBEGRIFF). Standard: die gemeinsame Steuernummer aller
   * Erklärungen (Abgabe in eigener Sache).
   */
  uebermittler?: string;
  /** 1…9999 Erklärungen; das BMF empfiehlt höchstens 50 je Paket. */
  erklaerungen: U30Erklaerung[];
  /** Erstellungszeitpunkt; Standard: jetzt. Geht als Wiener Datum/Uhrzeit ins XML. */
  erstellt?: Date;
}
