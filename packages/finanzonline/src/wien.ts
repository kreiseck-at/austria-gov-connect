import { FonError } from '@kreiseck/finanzonline-core';

const WIEN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Vienna',
  calendar: 'gregory',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Wanduhrzeit eines Zeitpunkts in Wien, je Bestandteil zweistellig (Jahr vierstellig). */
export interface WienerOrtszeit {
  jahr: string;
  monat: string;
  tag: string;
  stunde: string;
  minute: string;
  sekunde: string;
}

/**
 * Zerlegt einen Zeitpunkt in die Wiener Wanduhrzeit (Sommerzeit inklusive).
 * FinanzOnline arbeitet in Wiener Zeit: Das DataBox-Zeitfenster wird so gelesen
 * (live geprüft am 03.11.2026), und Erstellungsdatum/-uhrzeit sowie „laufender
 * Monat" der UVA beziehen sich darauf. Hängt nicht von `process.env.TZ` ab.
 */
export function wienerOrtszeit(d: Date): WienerOrtszeit {
  const teile = WIEN.formatToParts(d);
  const wert = (typ: Intl.DateTimeFormatPartTypes): string => {
    const gefunden = teile.find((t) => t.type === typ)?.value;
    if (gefunden === undefined) {
      throw new FonError(`Zeitzone Europe/Vienna: Bestandteil '${typ}' konnte nicht ermittelt werden.`);
    }
    return gefunden;
  };
  return {
    jahr: wert('year').padStart(4, '0'),
    monat: wert('month'),
    tag: wert('day'),
    stunde: wert('hour'),
    minute: wert('minute'),
    sekunde: wert('second'),
  };
}
