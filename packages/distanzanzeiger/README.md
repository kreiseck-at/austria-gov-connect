# @kreiseck/distanzanzeiger

Client für den **Distanzanzeiger der österreichischen Sozialversicherung** — die
Schnittstelle, über die Vertragspartner (Taxi- und Rettungsunternehmen) und ihre
Abrechnungssoftware die Transportkilometer einer Krankenbeförderung ermitteln.
Keine Laufzeitabhängigkeiten; verwendet das `fetch` von Node.

Die Kilometer einer Krankenbeförderung kommen nicht aus dem Taxameter:

> „Unter Entfernung ist die jeweilige Strecke vom jeweiligen Abholort
> (Wohnsitz/Aufenthaltsort) bis zum Bestimmungsort des Versicherten zu verstehen.
> Sie ist in ganzen Kilometern zu berechnen, wobei bis 499 m abzurunden und
> darüber aufzurunden ist. Als Grundlage für die Ermittlung der
> Transportkilometer sind die Kilometrierungspunkte nach dem Distanzanzeiger der
> österreichischen Sozialversicherung – in der jeweils aktuellen Version –
> heranzuziehen." (Gesamtvertrag Krankenbeförderung mit Taxis, § 9 Abs. 5)

## Installation

```bash
npm install @kreiseck/distanzanzeiger
```

Node ≥ 20.18. Für den Zugriff vergibt die ÖGK (CC Transportwesen) einen API-Key.

## Verwendung

```ts
import { createDistanzanzeiger, DISTANZANZEIGER_ENDPUNKTE } from '@kreiseck/distanzanzeiger';

const distanz = createDistanzanzeiger({
  endpunkt: DISTANZANZEIGER_ENDPUNKTE.produktion,
  apiKey: process.env.DISTANZANZEIGER_KEY!,
});

const e = await distanz.abfragen([
  { plz: 3100, ort: 'st. pölten', str: 'mariazeller str', hnr: '79' },
  { ort: 'kh stockerau' },
]);

if (e.art === 'distanz') {
  e.kilometer; // ganze Kilometer nach § 9 Abs. 5 — der Wert für die Abrechnung
  e.meter; // Gesamtdistanz laut Server
  e.stationen; // je Ort: gefundene Adresse, Teilstrecke, ergänzte Felder
} else {
  e.suchen; // mindestens ein Ort war mehrdeutig — Treffer je Ort zur Auswahl
}
```

Mindestens zwei Standorte; dazwischen beliebig viele Zwischenstopps. Jeder
Standort braucht Postleitzahl, Ort oder Ortskennzahl (`okz`). Die Teilstrecke
einer Station (`meter`) ist die Strecke ab dem vorangehenden Ort; zusammen
ergeben sie die Gesamtdistanz.

`ganzeKilometer(meter)` steht auch einzeln zur Verfügung.

## Der Server ergänzt Adressen — `ergaenzt` zeigt, was

Der Distanzanzeiger löst ungenaue Angaben auf, ohne es eigens zu melden. Auf
„st. pölten, Hausnummer 1" **ohne Straße** antwortete er am 11.11.2026 nicht mit
einer Trefferliste (so das Beispiel der Dokumentation, 19 mögliche Adressen),
sondern mit einer Distanz ab „Am Bischofteich 1". Wer nur die Kilometer
übernimmt, rechnet dann eine Strecke ab, die niemand gewählt hat.

Jede Station trägt deshalb:

| Feld | Bedeutung |
| ---- | --------- |
| `angefragt` | der Standort, wie er gesendet wurde |
| `plz`, `ort`, `okz`, `str`, `hnr` | die Adresse, die der Server verwendet hat |
| `ergaenzt` | Felder, die in der Anfrage leer waren und die der Server belegt hat |
| `einrichtung` | `true` bei siebenstelliger Sonder-OKZ — der Server hat eine Einrichtung erkannt (z. B. „kh stockerau") und deren Adresse eingesetzt |

Steht `str` oder `hnr` in `ergaenzt` und ist `einrichtung` nicht gesetzt, hat der
Server eine Straße oder Hausnummer gewählt. Was daraus folgt — anzeigen,
bestätigen lassen, neu anfragen —, entscheidet die Anwendung; dieses Paket meldet
nur. Felder, die in der Anfrage belegt waren, vergleicht es nicht: Der Server
schreibt sie um („st. pölten" → „Sankt Pölten", „mariazeller str" → „Mariazeller
Straße"), und ob eine andere Schreibweise dieselbe Adresse meint, lässt sich
nicht allgemein entscheiden.

Am sichersten ist eine Anfrage über die `okz` aus einer früheren Antwort:
fünfstellig die Ortskennzahl der Statistik Austria, siebenstellig Sonder-OKZ
(Krankenhäuser etc.), zehnstellig die Rasterzellen-ID `N####E####`.

## Sparsam mit dem Key

Ein Key gilt für die ganze Software. Der Client ist deshalb bewusst zurückhaltend:

- **Ein Aufruf ist genau eine Anfrage.** Nichts wird von selbst wiederholt, auch
  kein Fehler.
- **Anfragen laufen nacheinander** mit Mindestabstand (`mindestabstandMs`,
  Voreinstellung eine Sekunde). Die Dokumentation nennt kein Limit; der Abstand
  ist eine Vorsichtsmaßnahme.
- **Mehrdeutige Orte** wählt der Client nicht selbst aus und fragt nicht nach.

Abfragen gehören an die einzelne Fahrt, nicht in eine Schleife über Bestände.
Das Ergebnis je Fahrt zu speichern ist Sache der Anwendung — auch weil sich die
Distanzen mit dem Datenstand des Servers ändern.

## Fehler

| Klasse | Wann |
| ------ | ---- |
| `DistanzanzeigerError` | ungültige Eingabe (ohne Anfrage), verweigerter Zugriff („no access"), Zeitlimit, Server nicht erreichbar |
| `DistanzanzeigerProtokollError` | Antwort ist kein JSON oder passt nicht zur Dokumentation; trägt die rohe Antwort in `antwort` |

Der API-Key steht in keiner Fehlermeldung.

## Stand

- Gegen den Echtbetrieb gelaufen am 11.11.2026 (Server-Version „1.33.0
  Datenstand: 10/26"): eindeutige Abfrage, Abfrage mit Zwischenstopps, ungenaue
  Adresse.
- Die Tests laufen gegen eine Attrappe mit den Beispielen der Dokumentation und
  den beobachteten Antworten; sie sprechen nie mit dem Server.
- Offen: Die Ablehnung ohne gültigen Key kommt laut Dokumentation mit HTTP 200,
  beobachtet wurde 401 — der Client liest den Körper. Wann der Server noch eine
  Trefferliste statt einer Distanz liefert, ist nicht beobachtet; der Client
  liest sie nach der Dokumentation.

## Quellen

- „Schnittstellendokumentation Distanzanzeiger", Version 1.32.710, Stand April
  2026.
- Zugangsmitteilung der ÖGK zur Distanzanzeiger-Schnittstelle vom 11.11.2026
  (Endpunkte für Echtbetrieb und Test; beide auch unter `…oegk.at`).
- Gesamtvertragliche Vereinbarung über die Krankenbeförderung mit Taxis, § 9
  Abs. 5.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
