# @kreiseck/uid

Prüft Umsatzsteuer-Identifikationsnummern (UID) — primär über das EU-System VIES, sekundär über FinanzOnline (Österreich). Format-Normalisierung ohne Netzzugriff, zustandsloses 3-Ausgänge-Modell (gültig / ungültig / keine Antwort) mit Retry-Hinweis, Konsultationsnummer und Nachweis.

Dieses Paket kapselt die Anbindung an die europäische VIES-API und den
österreichischen FON-UID-Dienst (FinanzOnline).

## Installation

```bash
npm install @kreiseck/uid
```

Node ≥ 18.18. Baut auf [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Session/Transport).

## Grundlagen

Ein `Uid`-Objekt wird über `createUid(config)` mit einem Antragsteller initialisiert
— das ist die UID des Abfragenden.

```ts
import { createUid } from '@kreiseck/uid';

const uid = createUid({ antragsteller: 'ATU12345678' });

// Schnelle VIES-Prüfung (3 Ausgänge)
const erg = await uid.pruefe('DE987654321');
erg.ergebnis; // 'gueltig' | 'ungueltig' | 'keine_antwort'
```

## 3-Ausgänge-Modell

Alle Prüfungen (`pruefe`, `bestaetige`, `fon.abfrage`) liefern ein Ergebnis
mit drei möglichen Ausgängen:

- **`gueltig`** — UID ist aktiviert und kann verwendet werden (Name/Adresse ggf.
  erfasst)
- **`ungueltig`** — UID existiert nicht oder ist nicht aktiv
- **`keine_antwort`** — Dienst nicht erreichbar; `grund` differenziert, `wiederholbar`
  gibt an, ob eine Wiederholung sinnvoll ist

```ts
const erg = await uid.pruefe('DE987654321');
if (erg.ergebnis === 'keine_antwort') {
  console.log(erg.grund); // 'timeout' | 'ueberlast' | 'ms_nicht_erreichbar' | …
  if (erg.wiederholbar) { /* retry */ }
}
```

## VIES — Schnelle Prüfung (Basis)

`pruefe()` — Netzwerk, schnell, anonym:

```ts
const erg = await uid.pruefe('DE987654321');
// erg.ergebnis, erg.quelle: 'vies', erg.nachweis?, erg.wiederholbar?, …
```

`bestaetige()` — Mit Adressanfrage und Approximation:

```ts
const erg = await uid.bestaetige({
  uid: 'DE987654321',
  name: 'Example GmbH',
  strasse: 'Mustergasse 1',
  plz: '1010',
  ort: 'Wien',
});
erg.matches; // { name: 'match'|'kein_match'|'nicht_geprueft', … }
erg.nachweis; // { art: 'vies-konsultationsnummer', id, datum }
```

`viesStatus()` — Verfügbarkeitsstatus der VIES pro Land:

```ts
const st = await uid.viesStatus();
// st.vowVerfuegbar, st.land: { AT: 'verfuegbar', DE: 'beobachtet', … }
```

## FinanzOnline — Tiefe Prüfung (Fallback)

`fon.abfrage()` — Behördliche Bestätigung aus FinanzOnline-Datenbank (in Österreich).
Erfordert eine gültige Session (aus `@kreiseck/finanzonline-core`):

```ts
const session = await createSession({ /* … */ });
const uid = createUid({ antragsteller: 'ATU12345678', session });

const erg = await uid.fon.abfrage({ uid: 'ATU98765432', stufe: 1 });
// erg.ergebnis, erg.quelle: 'fon', erg.nachweis.art: 'fon-bescheid-in-databox'
```

Stufe 1: Name + Land; Stufe 2: volle Adresse. Die Bestätigung wird asynchron als
Bescheid in die DataBox gestellt (FinanzOnline BAO § 132).

## Nachweise und Nachweisverpflichtungen

Jedes Ergebnis mit `ergebnis === 'gueltig'` enthält einen `nachweis`:

- **VIES:** `art: 'vies-konsultationsnummer'` — Eindeutige Anfrage-ID,
  verwendbar für Compliance-Audit-Trail
- **FON:** `art: 'fon-bescheid-in-databox'` — Der Behördenbescheid liegt am
  Folgetag in der DataBox; empfohlen für Geschäftsverkehr mit neuen Partnern

## Stateless + Caching

Alle Abfragen sind **stateless** — keine Session im Uid-Objekt erforderlich
(außer für FON). Zur Optimierung:

```ts
const cacheKey = uid.cacheKey('DE987654321');
// => 'DE987654321' (normalisiert)
```

## Offene Live-Verifikationspunkte

Die folgenden Szenarien sind noch nicht im Live-Betrieb validiert — Feedback
nach Einsatz sehr willkommen:

- FON-Prüfung in der Testumgebung (FinanzOnline Test-Zugänge)
- Verhalten bei VIES-Ratenlimiting und Überlast-Codes
- Konsultationsnummern und VIES-Datumgenauigkeit für Compliance

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
