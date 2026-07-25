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
 */
export class EldaProtocolError extends EldaError {}
