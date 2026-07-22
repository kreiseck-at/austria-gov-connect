export class FonError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class FonTransportError extends FonError {}

export class FonProtocolError extends FonError {}

export class FonSoapFaultError extends FonError {
  readonly faultcode: string;
  readonly detail?: string;
  constructor(message: string, faultcode: string, detail?: string) {
    super(message);
    this.faultcode = faultcode;
    this.detail = detail;
  }
}

export const SESSION_RC_MESSAGES: Record<number, string> = {
  [-1]: 'Session ungültig oder abgelaufen',
  [-2]: 'Webservice wegen Wartungsarbeiten nicht verfügbar',
  [-3]: 'Technischer Fehler im Webservice',
  [-4]: 'Zugangsdaten ungültig',
  [-5]: 'Benutzer nach mehreren Fehlversuchen gesperrt',
  [-6]: 'Benutzer gesperrt',
  [-7]: 'Kein Webservice-Benutzer',
  [-8]: 'Teilnehmer für FinanzOnline gesperrt oder nicht berechtigt',
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
