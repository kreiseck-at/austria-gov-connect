import { parseXml, childText } from '@kreiseck/finanzonline-core';
import { parseRkdbAntwort, rkdbResponseNode, type Ergebnis } from './antwort';

/**
 * Ergebnis eines asynchron übermittelten rkdb-Pakets, wie es die FinanzOnline
 * DataBox als Protokoll ablegt (erltyp=P, anbringen=RKDB, fileart=XML). Enthält
 * die Einzelergebnisse je Vorgang; zugeordnet wird über `paketNr` und je
 * `Ergebnis` über `satznr`/`kundeninfo`.
 */
export interface Ergebnisprotokoll {
  /** Paketnummer der ursprünglichen Übermittlung (zur Zuordnung). */
  paketNr?: string;
  /**
   * Art der Übermittlung aus `art_uebermittlung`: `T` = Test, `P` = Produktion.
   * `T` an echtem FON-Protokoll (live) verifiziert, `P` aus dem BMF-Musterprotokoll.
   * Wichtig, um Test- von Produktions-Protokollen zu unterscheiden.
   */
  artUebermittlung?: string;
  /** Finanzamts-/Steuernummer des Übermittlers (`fastnr`), sofern im Protokoll enthalten. */
  fastnr?: string;
  /** Verarbeitungshinweis des Dienstes (z. B. „…nicht vollständig eingebracht"). */
  info?: string;
  ergebnisse: Ergebnis[];
}

/**
 * Parst ein aus der DataBox abgeholtes rkdb-Ergebnisprotokoll (XML-String).
 * Das Protokoll ist strukturell eine `rkdbResponse` (Wurzel ohne SOAP-Envelope);
 * die Einzelergebnisse werden mit demselben Parser wie synchrone Antworten
 * gelesen. Robust gegen fremdes/leeres XML (dann `ergebnisse: []`).
 */
export function parseErgebnisprotokoll(xml: string): Ergebnisprotokoll {
  const root = parseXml(xml);
  const resp = rkdbResponseNode(root);
  const paketNr = resp ? childText(resp, 'paket_nr') : undefined;
  const artUebermittlung = resp ? childText(resp, 'art_uebermittlung') : undefined;
  const fastnr = resp ? childText(resp, 'fastnr') : undefined;
  const { ergebnisse, info } = parseRkdbAntwort(root);
  return {
    paketNr: paketNr || undefined,
    artUebermittlung: artUebermittlung || undefined,
    fastnr: fastnr || undefined,
    info,
    ergebnisse,
  };
}
