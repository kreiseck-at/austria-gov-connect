import { EldaError } from './errors';

/** Eine abholbereite Rücksendung (Protokollnummer + Dateiname). */
export interface Ruecksendung {
  protokollnummer: string;
  dateiName: string;
}

/** Maskiert Regex-Metazeichen, damit die Protokollnummer literal gesucht wird. */
function maskiere(wert: string): string {
  return wert.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ordnet eine Sendung ihrer Rücksendung zu: laut ELDA steckt die Protokollnummer
 * der ursprünglichen Sendung im `dateiName` der Rücksendung (FAQ 8.1). Liefert die
 * erste passende Rücksendung oder `undefined`.
 *
 * Der Vergleich ist **ziffernscharf**: die Protokollnummer darf im `dateiName`
 * weder links noch rechts von einer weiteren Ziffer flankiert sein. ELDA vergibt
 * fortlaufende Nummern, `1557643` ist damit Präfix von `15576431` — ein reiner
 * Teilstring-Vergleich würde die FALSCHE Rücksendung liefern. Deren Abholung über
 * `empfangen` verbraucht sie unwiderruflich, während das eigene Protokoll nie
 * zugeordnet würde.
 *
 * @throws EldaError wenn `sendungsProtokollnummer` leer oder nur Whitespace ist —
 * eine leere Nadel würde sonst auf die erste beliebige Rücksendung passen.
 */
export function zuordnung(
  sendungsProtokollnummer: string,
  ruecksendungen: Ruecksendung[],
): Ruecksendung | undefined {
  const nr = sendungsProtokollnummer.trim();
  if (nr === '') {
    throw new EldaError(
      'zuordnung: sendungsProtokollnummer ist leer. Ohne Protokollnummer ist keine ' +
        'Zuordnung möglich — sonst würde eine beliebige fremde Rücksendung zurückgeliefert.',
    );
  }
  const muster = new RegExp(`(?<!\\d)${maskiere(nr)}(?!\\d)`);
  return ruecksendungen.find((r) => muster.test(r.dateiName));
}
