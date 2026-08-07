# @kreiseck/feiertage

Österreichische Feiertage und die daraus folgende Fristenverschiebung. Keine
Laufzeitabhängigkeiten — das Paket rechnet, es braucht nichts.

## Installation

```bash
npm install @kreiseck/feiertage
```

Node ≥ 20.18.

## Zwei Rechtsgrundlagen, zwei Fragen

Dieses Paket beantwortet zwei unterschiedliche Rechtsfragen, die auf den ersten Blick
verwechselbar aussehen, aber unterschiedliche Antworten haben.

**§ 7 Abs 2 Arbeitsruhegesetz** zählt die gesetzlichen Feiertage abschließend auf:

> „Feiertage im Sinne dieses Bundesgesetzes sind: 1. Jänner (Neujahr), 6. Jänner (Heilige
> Drei Könige), Ostermontag, 1. Mai (Staatsfeiertag), Christi Himmelfahrt, Pfingstmontag,
> Fronleichnam, 15. August (Mariä Himmelfahrt), 26. Oktober (Nationalfeiertag), 1. November
> (Allerheiligen), 8. Dezember (Mariä Empfängnis), 25. Dezember (Weihnachten), 26. Dezember
> (Stephanstag)."

Dreizehn Tage. Der **Karfreitag ist keiner** — der frühere Abs 3 wurde durch
BGBl. I Nr. 22/2019 aufgehoben.

**§ 108 Abs 3 BAO** und **§ 33 Abs 2 AVG** sind wortgleich und nennen eine andere Menge:

> „Fällt das Ende einer Frist auf einen Samstag, Sonntag, gesetzlichen Feiertag,
> Karfreitag oder 24. Dezember, so ist der nächste Tag, der nicht einer der vorgenannten
> Tage ist, als letzter Tag der Frist anzusehen."

Zusätzlich also Karfreitag, 24. Dezember, Samstag und Sonntag. Die BAO gilt für
Abgabenverfahren (Finanzamt), das AVG für das allgemeine Verwaltungsverfahren (unter
anderem Sozialversicherung).

Wer beide Fragen mit derselben Funktion beantwortet, liegt jedes Jahr am Karfreitag und
am 24. Dezember falsch. Deshalb gibt es hier keine einzige `istFeiertag`-Funktion, sondern
für jede Rechtsfrage eine eigene, die ihre Fundstelle im Namen trägt.

## Verwendung

```ts
import {
  gesetzlicheFeiertageNachArg,
  istGesetzlicherFeiertagNachArg,
  verschiebeFristendeNachBao,
  verschiebeFristendeNachAvg,
} from '@kreiseck/feiertage';

gesetzlicheFeiertageNachArg(2026);
// [{ datum: '2026-01-01', name: 'Neujahr' }, …, { datum: '2026-12-26', name: 'Stephanstag' }]

istGesetzlicherFeiertagNachArg('2026-04-03'); // false — Karfreitag ist kein ARG-Feiertag

verschiebeFristendeNachBao('2026-04-03'); // '2026-04-07' — verschiebt trotzdem
verschiebeFristendeNachAvg('2026-12-24'); // '2026-12-28' — über Weihnachten und Stephanstag hinweg
```

## Warum keine `Date`-Objekte

Die öffentliche Schnittstelle nimmt und liefert ausschließlich ISO-Datumszeichenketten
(`YYYY-MM-DD`). Ein `Date`-Objekt trägt eine Zeitzone mit sich, und genau daran zerbrechen
Datumsrechnungen: In Wien ist der 1. Mai um 00:30 Uhr in UTC noch der 30. April. Wer eine
Zeichenkette übergibt, kann diesen Fehler nicht machen. Intern wird ausschließlich in UTC
gerechnet, damit auch dort keine Sommerzeit hineinspielt.

Ungültige Eingaben (`'2026-13-01'`, `'2026-02-30'`, falsches Format, Jahr außerhalb des
unterstützten Bereichs) werden mit `FeiertageEingabeError` abgewiesen statt still zu etwas
Falschem verarbeitet zu werden.

## Was absichtlich fehlt: Landesfeiertage

Landesfeiertage wie der heilige Florian (4. Mai, Oberösterreich) sind **keine** gesetzlichen
Feiertage nach dem ARG. Sie verschieben keine Fristen nach BAO/AVG und begründen keine
Feiertagsruhe nach dem ARG — sie sind arbeitsrechtlich ohne bundesweite Wirkung und
allenfalls dienstrechtlich oder landesrechtlich relevant. Dieses Paket nimmt sie deshalb
bewusst nicht auf.

## API

- `gesetzlicheFeiertageNachArg(jahr: number): Feiertag[]` — alle dreizehn Feiertage nach
  § 7 Abs 2 ARG, mit Namen, aufsteigend sortiert.
- `istGesetzlicherFeiertagNachArg(datum: string): boolean` — Feiertagsruhe-Frage nach ARG.
- `verschiebeFristendeNachBao(datum: string): string` — verschobenes Fristende nach
  § 108 Abs 3 BAO (Abgabenverfahren).
- `verschiebeFristendeNachAvg(datum: string): string` — verschobenes Fristende nach
  § 33 Abs 2 AVG (allgemeines Verwaltungsverfahren).
- `ostersonntag(jahr: number): string`, `karfreitag(jahr: number): string` — die
  Kalenderdaten, aus denen sich die beweglichen Feiertage ableiten; der Karfreitag wird
  hier gesondert geführt, weil er kein ARG-Feiertag ist.
- `FeiertageEingabeError` — geworfen bei unbrauchbaren Eingaben.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
