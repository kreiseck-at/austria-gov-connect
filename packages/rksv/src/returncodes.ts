export type RcKind = 'ok' | 'technisch' | 'fachlich';

export interface RcInfo {
  kind: RcKind;
  text: string;
}

const INTERN = (code: string): RcInfo => ({
  kind: 'fachlich',
  text: `Interner Fehler (${code}) — später erneut versuchen oder Hotline kontaktieren`,
});

export const RKDB_RC: Record<string, RcInfo> = {
  '0': { kind: 'ok', text: 'Aufruf ok' },
  '-1': { kind: 'technisch', text: 'Session ungültig oder abgelaufen' },
  '-2': { kind: 'technisch', text: 'Webservice wegen Wartungsarbeiten nicht möglich' },
  '-3': { kind: 'technisch', text: 'Technischer Fehler' },
  '-4': { kind: 'technisch', text: 'Teilnehmer für diese Funktion nicht berechtigt' },
  '4': { kind: 'fachlich', text: 'Mit der angegebenen Seriennummer wurde beim VDA kein Zertifikat gefunden' },
  '5': { kind: 'fachlich', text: 'Der Status des Zertifikates ist nicht gültig' },
  '6': { kind: 'fachlich', text: 'OID für „Österreichische Finanzverwaltung Registrierkasseninhaber" nicht vorhanden' },
  '7': { kind: 'fachlich', text: 'Ordnungsbegriff im Zertifikat nicht dem registrierenden Unternehmen zugeordnet' },
  '8': { kind: 'fachlich', text: 'Wert in der OID für Registrierkasseninhaber ungültig' },
  '9': { kind: 'fachlich', text: 'Das Zertifikat ist fehlerhaft' },
  '13': { kind: 'fachlich', text: 'SEE-Registrierung nicht möglich: weder Steuernummer, UID noch GLN in der Finanzverwaltung vorhanden' },
  '14': { kind: 'fachlich', text: 'Zugriff auf die Zertifikate des VDA aktuell nicht möglich' },
  '27': { kind: 'fachlich', text: 'Angegebener Ordnungsbegriff ist ungültig' },
  '28': { kind: 'fachlich', text: 'Angegebener Ordnungsbegriff nicht dem registrierenden Unternehmen zugeordnet' },
  '29': { kind: 'fachlich', text: 'Der öffentliche Schlüssel ist ungültig' },
  '30': { kind: 'fachlich', text: 'Der öffentliche Schlüssel entspricht nicht dem veröffentlichten Format' },
  '31': { kind: 'fachlich', text: 'Überprüfung des Zertifikates fehlgeschlagen' },
  '32': { kind: 'fachlich', text: 'Keine steuerliche Vertretungsvollmacht vorhanden' },
  '36': { kind: 'fachlich', text: 'Angegebene vda_id ist nicht zulässig' },
  '41': { kind: 'fachlich', text: 'Das Zertifikat ist noch nicht bzw. nicht mehr gültig' },
  '43': { kind: 'fachlich', text: 'Der übermittelte Beleg ist fehlerhaft' },
  '998': { kind: 'fachlich', text: 'Statusabfrage bei asynchroner Verarbeitung nicht zulässig' },
  '999': { kind: 'fachlich', text: 'VDA-Id „AT9" nur bei Testübermittlungen zulässig' },
  '1336': INTERN('1336'),
  '1337': INTERN('1337'),
  'B1': { kind: 'fachlich', text: 'Registrierkasse mit dieser Kassenidentifikationsnummer ist bereits registriert' },
  'B2': { kind: 'fachlich', text: 'Für Kassen im vorliegenden Status ist keine Datenänderung möglich' },
  'B3': { kind: 'fachlich', text: 'Kein Ordnungsbegriff (Steuernummer, GLN, UID) für das Unternehmen ermittelbar' },
  'B4': INTERN('B4'),
  'B5': { kind: 'fachlich', text: 'Angegebener Zeitpunkt darf nicht vor der letzten Statusänderung liegen' },
  'B6': { kind: 'fachlich', text: 'Außerbetriebnahme bereits erfolgt — keine Änderung mehr möglich' },
  'B7': { kind: 'fachlich', text: 'Keine in Betrieb befindliche Signaturerstellungseinheit vorhanden' },
  'B8': { kind: 'fachlich', text: 'Nur in Betrieb/registrierte/ausgefallene Kassen dürfen außer Betrieb genommen werden' },
  'B9': { kind: 'fachlich', text: 'Nur in Betrieb befindliche Kassen dürfen als ausgefallen gemeldet werden' },
  'B10': { kind: 'fachlich', text: 'SEE mit diesem VDA und dieser Zertifikats-Seriennummer bereits gespeichert' },
  'B13': { kind: 'fachlich', text: 'Der angegebene Status ist bereits gesetzt' },
  'B14': { kind: 'fachlich', text: 'Es wurde keine Begründung angegeben' },
  'B15': { kind: 'fachlich', text: 'Der Zeitpunkt des Ausfalles darf nicht leer sein' },
  'B18': { kind: 'fachlich', text: 'Nur in Betrieb/ausgefallene SEE dürfen endgültig außer Betrieb genommen werden' },
  'B19': { kind: 'fachlich', text: 'Nur in Betrieb befindliche SEE dürfen als ausgefallen gemeldet werden' },
  'B20': { kind: 'fachlich', text: 'Die Begründung ist nicht (mehr) gültig' },
  'B21': { kind: 'fachlich', text: 'Der angegebene Zeitpunkt darf nicht in der Zukunft liegen' },
  'B22': { kind: 'fachlich', text: 'Dieser Status ist nicht verfügbar' },
  'B28': { kind: 'fachlich', text: 'Der öffentliche Schlüssel ist bereits vorhanden' },
  'B29': { kind: 'fachlich', text: 'Es muss ein Zusatz zum Ordnungsbegriff angegeben werden' },
  'B30': { kind: 'fachlich', text: 'Dieser Zusatz zum Ordnungsbegriff ist bereits vorhanden' },
  'B32': { kind: 'fachlich', text: 'Kassenidentifikationsnummer nicht registriert oder bereits außer Betrieb' },
  'B33': { kind: 'fachlich', text: 'Seriennummer nicht registriert oder bereits außer Betrieb' },
  'B34': { kind: 'fachlich', text: 'Ordnungsbegriff nicht registriert oder bereits außer Betrieb' },
  'B35': { kind: 'fachlich', text: 'Der Begründungscode ist nicht vorhanden' },
  'C1': INTERN('C1'),
  'V1': INTERN('V1'), 'V2': INTERN('V2'), 'V3': INTERN('V3'), 'V4': INTERN('V4'),
  'V5': INTERN('V5'), 'V6': INTERN('V6'), 'V7': INTERN('V7'), 'V8': INTERN('V8'),
  'V9': INTERN('V9'), 'V10': INTERN('V10'), 'V11': INTERN('V11'), 'V12': INTERN('V12'),
  'V13': INTERN('V13'), 'V14': INTERN('V14'), 'V15': INTERN('V15'), 'V16': INTERN('V16'),
};

export function rcInfo(rc: string): RcInfo {
  return RKDB_RC[rc] ?? { kind: 'fachlich', text: `Unbekannter Returncode ${rc}` };
}

export function rcIsOk(rc: string): boolean {
  return rcInfo(rc).kind === 'ok';
}

export function rcIsTechnical(rc: string): boolean {
  return rcInfo(rc).kind === 'technisch';
}
