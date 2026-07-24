export class FonError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class FonTransportError extends FonError {}

export class FonProtocolError extends FonError {}

/**
 * Fachlicher/technischer Returncode ungleich 0 aus einer FON-Antwort. Subklasse
 * von {@link FonProtocolError} (bestehende `instanceof FonProtocolError`-Prüfungen
 * greifen weiter), trägt aber zusätzlich den numerischen `rc` und die
 * Servermeldung — so kann der Aufrufer z. B. DataBox-`-5`/`-6` (Fenster zu groß)
 * programmatisch von `-3` (technisch) unterscheiden.
 */
export class FonRcError extends FonProtocolError {
  readonly rc: number;
  readonly serverMsg?: string;
  constructor(rc: number, serverMsg?: string, kontext?: string) {
    super(`${kontext ?? 'FinanzOnline'} rc=${rc}${serverMsg ? `: ${serverMsg}` : ''}`);
    this.rc = rc;
    this.serverMsg = serverMsg;
  }
}

export class FonSoapFaultError extends FonError {
  readonly faultcode: string;
  readonly detail?: string;
  constructor(message: string, faultcode: string, detail?: string) {
    super(message);
    this.faultcode = faultcode;
    this.detail = detail;
  }
}

// -1..-4 sind 1:1 die Returncodes der BMF-Spec „Session-Webservice" (Stand
// 06.11.2019). -5..-8 stehen NICHT in dieser Spec (vermutlich legacy/beobachtet)
// — nur als Best-Effort-Klartext; bei diesen Codes trägt ohnehin die FON-eigene
// serverMsg den maßgeblichen Grund.
export const SESSION_RC_MESSAGES: Record<number, string> = {
  [-1]: 'Session ungültig oder abgelaufen', // Spec
  [-2]: 'Webservice wegen Wartungsarbeiten nicht verfügbar', // Spec
  [-3]: 'Technischer Fehler im Webservice', // Spec
  [-4]: 'Zugangsdaten ungültig', // Spec
  [-5]: 'Benutzer nach mehreren Fehlversuchen gesperrt', // nicht in aktueller Spec
  [-6]: 'Benutzer gesperrt', // nicht in aktueller Spec
  [-7]: 'Kein Webservice-Benutzer', // nicht in aktueller Spec
  [-8]: 'Teilnehmer für FinanzOnline gesperrt oder nicht berechtigt', // nicht in aktueller Spec
};

export class FonSessionError extends FonError {
  readonly rc: number;
  readonly serverMsg?: string;
  constructor(rc: number, serverMsg?: string) {
    const base = SESSION_RC_MESSAGES[rc] ?? `Session-Fehler (rc=${rc})`;
    super(serverMsg ? `${base}: ${serverMsg}` : base);
    this.rc = rc;
    this.serverMsg = serverMsg;
  }
}

export class FonSessionExpiredError extends FonSessionError {}

export function sessionErrorFor(rc: number, serverMsg?: string): FonSessionError {
  return rc === -1 ? new FonSessionExpiredError(rc, serverMsg) : new FonSessionError(rc, serverMsg);
}
