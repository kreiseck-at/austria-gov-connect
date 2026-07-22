# @kreiseck/finanzonline

Client für die FinanzOnline-DataBox (`getDatabox`/`getDataboxEntry`). Über die
DataBox stellt das BMF Bescheide, Protokolle und sonstige Zustellungen zu, die
zu anderen Verfahren gehören (z. B. RKSV-Ergebnisprotokolle, UID-Bescheide).
Weitere FON-Verfahren (jenseits der DataBox) folgen in späteren Versionen
dieses Pakets.

## Installation

```bash
npm install @kreiseck/finanzonline
```

Node ≥ 20.18. Baut auf [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Session/Transport).

## DataBox-Einträge auflisten und abholen

```ts
import { createSession } from '@kreiseck/finanzonline-core';
import { createDatabox } from '@kreiseck/finanzonline';

const session = await createSession({ /* … */ });
const databox = createDatabox(session);

// Ohne erltyp: nur ungelesene Einträge. Mit erltyp: auf einen Erledigungstyp
// eingrenzen (z. B. 'P' für Protokolle).
const eintraege = await databox.liste({ erltyp: 'P' });

for (const e of eintraege) {
  console.log(e.applkey, e.filebez, e.gelesen);
}

const erster = eintraege[0];
if (erster) {
  const { fileart, inhalt } = await databox.eintrag(erster.applkey, erster.fileart);
  // inhalt: Buffer — je nach fileart XML oder PDF
}
```

**Achtung:** `databox.eintrag(...)` markiert den Eintrag in der DataBox als
gelesen (`getDataboxEntry` setzt serverseitig den Gelesen-Status). Ein erneuter
Abruf desselben `applkey` liefert den Inhalt zwar weiterhin, der Eintrag taucht
in `liste()` ohne `erltyp`-Filter danach aber nicht mehr unter den ungelesenen
Einträgen auf.

## Zeitfenster bei `liste()`

Wird `von`/`bis` angegeben, gilt laut BMF-Spezifikation:

- **`von` maximal 31 Tage** in der Vergangenheit.
- **Die Spanne zwischen `von` und `bis` maximal 7 Tage.**

Verstöße quittiert der Dienst mit einem fachlichen Fehlercode (`rc != 0`), der
als `FonProtocolError` geworfen wird.

## UID-Bescheid über die DataBox abholen

Nach einer FON-UID-Abfrage der Stufe 1/2 (siehe [`@kreiseck/uid`](https://www.npmjs.com/package/@kreiseck/uid))
legt das BMF den Bescheid am Folgetag in der DataBox ab (§ 132 BAO). Um ihn zu
finden, `liste()` ohne engen `erltyp`-Filter abrufen und über das Feld
`anbringen` auf den UID-Vorgang eingrenzen:

```ts
const eintraege = await databox.liste({ von: gestern, bis: heute });
const bescheid = eintraege.find((e) => e.anbringen === 'UID' /* Wert offen, siehe unten */);
```

**Offener Punkt:** Der genaue Wert von `anbringen` für UID-Bescheide ist noch
nicht an einer echten FinanzOnline-Antwort verifiziert. Vor produktivem
Einsatz gegen eine Testumgebung bestätigen und diesen Abschnitt entsprechend
aktualisieren.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
