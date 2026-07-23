import { parseXml, findDescendant } from '@kreiseck/finanzonline-core';

/** Eine einzelne UID-Bestätigung im FON-UID-Bescheid. */
export interface UidBestaetigung {
  uid: string;
  /** Bestätigungsstufe ("1" einfach, "2" qualifiziert). */
  stufe?: string;
  /** `gueltig="J"` → true, sonst false. */
  gueltig: boolean;
}

/**
 * FON-UID-Bescheid, wie ihn FinanzOnline am Folgetag als DataBox-Eintrag ablegt
 * (erltyp=P, anbringen=UID). Attribut-basiertes `<Bestaetigungen>`-Format; der
 * rechtliche Nachweis (§132 BAO) je Antragsteller-UID.
 */
export interface UidBescheid {
  /** Ausstellungsdatum (`Datum`, Format YYYYMMDD). */
  datum?: string;
  /** UID des Antragstellers (`ATUID`). */
  antragsteller?: string;
  name?: string;
  /** Finanzamt-/Steuernummer (`FAStNr`). */
  fastnr?: string;
  /** Zeitstempel des Bescheids (`TMS`). */
  tms?: string;
  bestaetigungen: UidBestaetigung[];
}

/**
 * Parst einen aus der DataBox abgeholten FON-UID-Bescheid (XML-String im
 * `<Bestaetigungen>`-Format). Robust gegen fremdes/leeres XML (dann leere
 * `bestaetigungen`).
 */
export function parseUidBescheid(xml: string): UidBescheid {
  const root = parseXml(xml);
  const b = findDescendant(root, 'Bestaetigungen');
  if (!b) return { bestaetigungen: [] };
  const bestaetigungen: UidBestaetigung[] = b.children
    .filter((c) => c.name === 'Bestaetigung')
    .map((c) => ({
      uid: c.attrs['UID'] ?? '',
      stufe: c.attrs['Stufe'] || undefined,
      gueltig: c.attrs['gueltig'] === 'J',
    }));
  return {
    datum: b.attrs['Datum'] || undefined,
    antragsteller: b.attrs['ATUID'] || undefined,
    name: b.attrs['Name'] || undefined,
    fastnr: b.attrs['FAStNr'] || undefined,
    tms: b.attrs['TMS'] || undefined,
    bestaetigungen,
  };
}
