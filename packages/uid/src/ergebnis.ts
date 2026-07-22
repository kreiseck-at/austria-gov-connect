export class UidEingabeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UidEingabeError';
  }
}

export type Ausgang = 'gueltig' | 'ungueltig' | 'keine_antwort';
export type KeinAntwortGrund =
  | 'ms_nicht_erreichbar'
  | 'timeout'
  | 'ueberlast'
  | 'wartung'
  | 'ratenlimit'
  | 'gesperrt'
  | 'technisch'
  | 'nicht_berechtigt';
export interface Nachweis {
  art: 'vies-konsultationsnummer' | 'fon-bescheid-in-databox';
  id?: string;
  datum: string;
  hinweis?: string;
}
export interface UidErgebnis {
  ergebnis: Ausgang;
  quelle: 'vies' | 'fon';
  uid: string;
  land: string;
  abfragedatum: string;
  name?: string;
  adresse?: string;
  nachweis?: Nachweis;
  grund?: KeinAntwortGrund;
  wiederholbar?: boolean;
  rohRc?: string;
}

const TRANSIENT: Record<string, KeinAntwortGrund> = {
  MS_UNAVAILABLE: 'ms_nicht_erreichbar',
  SERVICE_UNAVAILABLE: 'wartung',
  TIMEOUT: 'timeout',
  MS_MAX_CONCURRENT_REQ: 'ueberlast',
  GLOBAL_MAX_CONCURRENT_REQ: 'ueberlast',
  SERVER_BUSY: 'ueberlast',
  IO_ERROR: 'technisch',
  TECHNICAL_ERROR: 'technisch',
};

export function viesUserErrorAusgang(userError: string) {
  if (userError === 'VALID') return { ergebnis: 'gueltig' as const };
  if (userError === 'INVALID') return { ergebnis: 'ungueltig' as const };
  if (userError === 'VAT_BLOCKED' || userError === 'IP_BLOCKED')
    return { ergebnis: 'keine_antwort' as const, grund: 'gesperrt' as const, wiederholbar: false };
  const grund = TRANSIENT[userError];
  if (grund) return { ergebnis: 'keine_antwort' as const, grund, wiederholbar: true };
  // Unbekannt: konservativ als keine_antwort behandeln (nie faelschlich ungueltig)
  return { ergebnis: 'keine_antwort' as const, grund: 'technisch' as const, wiederholbar: true };
}
