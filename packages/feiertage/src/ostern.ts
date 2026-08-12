// Vier der dreizehn Feiertage nach § 7 Abs 2 ARG hängen am Ostersonntag; dazu kommt der
// Karfreitag, der zwar kein ARG-Feiertag ist, aber Fristen nach BAO/AVG hemmt. Alle fünf
// werden hier aus dem einen berechneten Datum abgeleitet, statt sie unabhängig zu pflegen.

import { pruefeJahr, formatIsoDatum } from './datum';

const MS_PRO_TAG = 86_400_000;

// Gaußsche Osterformel in der von Meeus/Jones/Butcher angegebenen Fassung — der
// gebräuchliche Algorithmus zur Berechnung des Ostersonntags im gregorianischen Kalender.
function ostersonntagEpochTag(jahr: number): number {
  pruefeJahr(jahr);
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(jahr, monat - 1, tag) / MS_PRO_TAG;
}

export function ostersonntag(jahr: number): string {
  return formatIsoDatum(ostersonntagEpochTag(jahr));
}

function verschobenesOsterdatum(jahr: number, versatzTage: number): string {
  return formatIsoDatum(ostersonntagEpochTag(jahr) + versatzTage);
}

// Karfreitag ist kein gesetzlicher Feiertag nach ARG (Abs 3 wurde durch BGBl. I Nr. 22/2019
// aufgehoben), zählt aber zu den fristenhemmenden Tagen nach § 108 Abs 3 BAO / § 33 Abs 2 AVG.
export function karfreitag(jahr: number): string {
  return verschobenesOsterdatum(jahr, -2);
}

export function ostermontag(jahr: number): string {
  return verschobenesOsterdatum(jahr, 1);
}

export function christiHimmelfahrt(jahr: number): string {
  return verschobenesOsterdatum(jahr, 39);
}

export function pfingstmontag(jahr: number): string {
  return verschobenesOsterdatum(jahr, 50);
}

export function fronleichnam(jahr: number): string {
  return verschobenesOsterdatum(jahr, 60);
}
