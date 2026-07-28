import { ELDA_STATUS } from './status';

/** Basisklasse aller Fehler aus `@kreiseck/elda`. */
export class EldaError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Antwort von ELDA ist technisch nicht verwertbar (z. B. unerwartetes
 * Antwortformat, fehlendes `<return>`-Element oder ein Payload, der weder
 * inline Base64 noch — wie erwartet — leer ist). Bewusst getrennt von
 * fachlichen Status-Codes (`statusCode`/`ok` im Ergebnis): Ein `EldaProtocolError`
 * bedeutet, dass die Antwort nicht sinnvoll ausgewertet werden kann, nicht dass
 * ELDA einen fachlichen Fehler gemeldet hat.
 *
 * Trägt optional das rohe Ergebnisobjekt, sofern beim Auftreten des Fehlers
 * bereits eines vorlag (z. B. wenn ELDA zu einem Status-Code widersprüchlich
 * eine `<datei>` mitgeliefert hat, die die Komfortschicht nicht ausliefern
 * kann). Darüber ist ein bereits von ELDA ausgelieferter Dateiinhalt weiterhin
 * erreichbar — ohne einen zweiten, ggf. folgenlosen Aufruf zu riskieren.
 */
export class EldaProtocolError extends EldaError {
  /** Das rohe Ergebnisobjekt zum Zeitpunkt des Fehlers, sofern eines vorlag. */
  readonly ergebnis?: unknown;

  constructor(message: string, ergebnis?: unknown, options?: ErrorOptions) {
    super(message, options);
    if (ergebnis !== undefined) this.ergebnis = ergebnis;
  }
}

/**
 * ELDA hat einen Status-Code gemeldet, der keinen behandelbaren Zustand
 * beschreibt — falsche Zugangsdaten, abgelaufener Request, ungültiger Dateiname,
 * interner Fehler. Solche Codes an der Aufrufstelle zu übersehen ist immer ein
 * Fehler, deshalb werden sie geworfen statt zurückgegeben.
 *
 * Es geht dabei nichts verloren: `statusCode`, die Klartext-`meldung` von ELDA
 * und das vollständige rohe `ergebnis` hängen am Fehler.
 */
export class EldaStatusError extends EldaError {
  /** ELDA-Status-Code, z. B. `'558'`. */
  readonly statusCode: string;
  /** Klartext-Meldung aus `serviceResult.messages`, sofern ELDA eine geliefert hat. */
  readonly meldung?: string;
  /** Das vollständige rohe Ergebnisobjekt, wie `elda.roh.*` es zurückgegeben hätte. */
  readonly ergebnis: unknown;

  constructor(statusCode: string, ergebnis: unknown, meldung?: string, options?: ErrorOptions) {
    const beschreibung = ELDA_STATUS[statusCode] ?? 'unbekannter Status-Code';
    super(`ELDA-Status ${statusCode}: ${beschreibung}${meldung ? ` — ${meldung}` : ''}`, options);
    this.statusCode = statusCode;
    this.ergebnis = ergebnis;
    if (meldung !== undefined) this.meldung = meldung;
  }
}
