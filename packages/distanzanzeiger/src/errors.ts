/** Basisklasse aller Fehler aus `@kreiseck/distanzanzeiger`. */
export class DistanzanzeigerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Die Antwort des Servers ist nicht verwertbar — kein JSON, ein unerwarteter
 * Aufbau oder ein HTTP-Fehler ohne die dokumentierte Ablehnung. Getrennt von
 * {@link DistanzanzeigerError}, damit ein Aufrufer „der Server hat abgelehnt"
 * von „die Antwort passt nicht zur Dokumentation" unterscheiden kann.
 */
export class DistanzanzeigerProtokollError extends DistanzanzeigerError {
  /** Die rohe Antwort, soweit sie vorlag — zur Fehlersuche. Enthält nie den API-Key. */
  readonly antwort?: unknown;

  constructor(message: string, antwort?: unknown, options?: ErrorOptions) {
    super(message, options);
    if (antwort !== undefined) this.antwort = antwort;
  }
}
