/**
 * Status-Codes des ELDA Transfer-Webservice v4 (1:1 aus der
 * Schnittstellenbeschreibung V4). Steht im `serviceResult.statusCode` jeder Antwort.
 */
export const ELDA_STATUS: Record<string, string> = {
  '000': 'OK',
  '500': 'Interner Verarbeitungsfehler',
  '551': 'Request abgelaufen (created älter als 60 Sekunden)',
  '552': 'Nonce wurde bereits verwendet',
  '553': 'Seriennummer für dieses Service nicht berechtigt',
  '554': 'Nonce nicht gesetzt',
  '555': 'created nicht gesetzt',
  '557': 'API-Key ungültig',
  '558': 'Seriennummer und/oder Kundenpasswort falsch',
  '559': 'Unerlaubter Content-Type',
  '401': 'dateiName zu lang (max 255)',
  '402': 'dateiName nicht gesetzt',
  '403': 'Datei nicht verarbeitet (auslösender Fehlercode in der Meldung)',
  '404': 'Datei wird noch verarbeitet (Verarbeitung > 40 Sekunden)',
  '405': 'Datei ist Duplikat (Protokollnummer des Originals in der Meldung)',
  '406': 'Datei mit Protokollnummer nicht vorhanden',
  '407': 'Keine Berechtigung, Datei zu empfangen (Seriennummer stimmt nicht überein)',
  '408': 'Datei laut Protokollnummer wurde bereits empfangen',
};

/** True, wenn der Aufruf technisch ok war (`statusCode === '000'`). */
export function istOk(statusCode: string): boolean {
  return statusCode === '000';
}
