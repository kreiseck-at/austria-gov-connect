// § 108 Abs 3 BAO und § 33 Abs 2 AVG sind wortgleich, regeln aber unterschiedliche
// Verfahren (Abgabenverfahren beim Finanzamt bzw. allgemeines Verwaltungsverfahren, u. a.
// Sozialversicherung) — deshalb zwei benannte Funktionen statt einer, die den Aufrufer
// zwingt, sich für eine Rechtsgrundlage zu entscheiden. Beide liefern das verschobene
// Fristende, nicht bloß ein Ja/Nein: Ein Prädikat lässt sich abfragen und die Verschiebung
// trotzdem vergessen, ein Ergebnis nicht.
//
// Die Menge der fristenhemmenden Tage ist größer als die der ARG-Feiertage: Samstag,
// Sonntag, gesetzlicher Feiertag (§ 7 Abs 2 ARG), Karfreitag und 24. Dezember.

import { parseIsoDatum, formatIsoDatum, wochentag } from './datum';
import { istGesetzlicherFeiertagNachArg } from './feiertage';
import { karfreitag } from './ostern';

function istFristhemmenderTag(epochTag: number): boolean {
  const tagDerWoche = wochentag(epochTag);
  if (tagDerWoche === 0 || tagDerWoche === 6) return true; // Sonntag, Samstag

  const iso = formatIsoDatum(epochTag);
  if (iso.slice(5) === '12-24') return true; // 24. Dezember, in BAO/AVG eigens genannt

  const jahr = Number(iso.slice(0, 4));
  if (karfreitag(jahr) === iso) return true; // kein ARG-Feiertag, aber fristenhemmend

  return istGesetzlicherFeiertagNachArg(iso);
}

// Schiebt so lange auf den jeweils nächsten Tag weiter, bis dieser auf keinen der in
// § 108 Abs 3 BAO / § 33 Abs 2 AVG genannten Tage fällt. Das bildet auch Ketten ab, etwa
// wenn ein Fristende auf den 24. Dezember fällt und über Weihnachten und Stephanstag
// hinweg verschoben werden muss.
function verschobenesFristende(datum: string): string {
  let epochTag = parseIsoDatum(datum).epochTag;
  while (istFristhemmenderTag(epochTag)) {
    epochTag += 1;
  }
  return formatIsoDatum(epochTag);
}

// § 108 Abs 3 BAO — Fristen im Abgabenverfahren (z. B. gegenüber dem Finanzamt).
export function verschiebeFristendeNachBao(datum: string): string {
  return verschobenesFristende(datum);
}

// § 33 Abs 2 AVG — Fristen im allgemeinen Verwaltungsverfahren (u. a. Sozialversicherung).
export function verschiebeFristendeNachAvg(datum: string): string {
  return verschobenesFristende(datum);
}
