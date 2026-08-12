// Kalenderrechnung ausschließlich in UTC-Tagen (epochTag = Tage seit 1970-01-01Z).
// Grund: Die öffentliche Schnittstelle dieses Pakets nimmt und liefert ISO-Datumsstrings,
// keine `Date`-Objekte — eine `Date` trägt eine Zeitzone mit sich, und genau daran zerbrechen
// Fristenrechnungen (z. B. wäre der 1. Mai um 00:30 MESZ in UTC noch der 30. April). Damit
// diese Falle auch intern nicht zuschlägt, rechnet das gesamte Paket in UTC-Millisekunden.

const MS_PRO_TAG = 86_400_000;

export class FeiertageEingabeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeiertageEingabeError';
  }
}

const ISO_MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ZerlegtesDatum {
  jahr: number;
  monat: number;
  tag: number;
  epochTag: number;
}

function istSchaltjahr(jahr: number): boolean {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
}

function tageImMonat(jahr: number, monat: number): number {
  const tage = [31, istSchaltjahr(jahr) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // monat ist zu diesem Zeitpunkt bereits als 1..12 geprüft
  return tage[monat - 1] as number;
}

// Die Meeus/Jones/Butcher-Osterformel (in ostern.ts) ist für den gregorianischen Kalender
// ab 1583 definiert; nach oben begrenzen wir großzügig, um mit `Number.isInteger`-Werten
// ohne Sonderfälle rechnen zu können.
const FRUEHESTES_JAHR = 1583;
const SPAETESTES_JAHR = 4099;

export function pruefeJahr(jahr: number): void {
  if (!Number.isInteger(jahr) || jahr < FRUEHESTES_JAHR || jahr > SPAETESTES_JAHR) {
    throw new FeiertageEingabeError(
      `Jahr außerhalb des unterstützten Bereichs (${FRUEHESTES_JAHR}–${SPAETESTES_JAHR}): ${jahr}`,
    );
  }
}

// Wandelt eine ISO-Datumszeichenkette strikt in ihre Bestandteile um. Anders als `new
// Date(...)` toleriert das hier keine überlaufenden Werte — ein "2026-02-30" wird
// abgewiesen statt stillschweigend auf den 2. März gerollt.
export function parseIsoDatum(text: string): ZerlegtesDatum {
  if (typeof text !== 'string') {
    throw new FeiertageEingabeError('Datum muss eine Zeichenkette im Format YYYY-MM-DD sein');
  }
  const treffer = ISO_MUSTER.exec(text);
  if (!treffer) {
    throw new FeiertageEingabeError(`Datum nicht im Format YYYY-MM-DD: ${text}`);
  }
  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const tag = Number(treffer[3]);
  pruefeJahr(jahr);
  if (monat < 1 || monat > 12) {
    throw new FeiertageEingabeError(`Ungültiger Monat: ${text}`);
  }
  if (tag < 1 || tag > tageImMonat(jahr, monat)) {
    throw new FeiertageEingabeError(`Ungültiger Tag: ${text}`);
  }
  const epochTag = Date.UTC(jahr, monat - 1, tag) / MS_PRO_TAG;
  return { jahr, monat, tag, epochTag };
}

export function formatIsoDatum(epochTag: number): string {
  const d = new Date(epochTag * MS_PRO_TAG);
  const jahr = String(d.getUTCFullYear()).padStart(4, '0');
  const monat = String(d.getUTCMonth() + 1).padStart(2, '0');
  const tag = String(d.getUTCDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

// 0 = Sonntag … 6 = Samstag (wie `Date.prototype.getUTCDay`)
export function wochentag(epochTag: number): number {
  return new Date(epochTag * MS_PRO_TAG).getUTCDay();
}

export function addTage(epochTag: number, anzahl: number): number {
  return epochTag + anzahl;
}
