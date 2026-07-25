/** Eine abholbereite Rücksendung (Protokollnummer + Dateiname). */
export interface Ruecksendung {
  protokollnummer: string;
  dateiName: string;
}

/**
 * Ordnet eine Sendung ihrer Rücksendung zu: laut ELDA steckt die Protokollnummer
 * der ursprünglichen Sendung im `dateiName` der Rücksendung (FAQ 8.1). Liefert die
 * erste passende Rücksendung oder `undefined`.
 */
export function zuordnung(
  sendungsProtokollnummer: string,
  ruecksendungen: Ruecksendung[],
): Ruecksendung | undefined {
  return ruecksendungen.find((r) => r.dateiName.includes(sendungsProtokollnummer));
}
