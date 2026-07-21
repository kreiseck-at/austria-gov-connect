# @kreiseck/finanzonline-core

Session- und SOAP-Transport für die FinanzOnline-Webservices des österreichischen
BMF. Selbstgeschriebener SOAP-1.1-Layer, zustandslos, **keine
Laufzeitabhängigkeiten** (HTTP über `fetch`, XML selbst geparst).

Dieses Paket kapselt `login`/`logout` und den Transport. Fachverfahren wie die
Registrierkasse liegen in eigenen Paketen (z. B. `@kreiseck/rksv`).

## Installation

```bash
npm install @kreiseck/finanzonline-core
```

Node ≥ 18.18.

## Verwendung

```ts
import { createSession } from '@kreiseck/finanzonline-core';

const session = await createSession({
  tid:          process.env.FON_TID!,
  benid:        process.env.FON_BENID!,   // Webservice-Benutzer
  pin:          process.env.FON_PIN!,
  herstellerid: process.env.FON_HERSTELLER_UID!, // UID des Softwareherstellers
});

session.id; // Session-ID, kurzlebig speichern
await session.logout();
```

Alle vier Felder sind Pflicht. Woher sie kommen und wie der Webservice-Benutzer
angelegt wird, steht in [`REGISTRIERUNG.md`](./REGISTRIERUNG.md).

## Fehlerbehandlung

Technische Fehler (Netz, SOAP-Fault, negativer Session-`rc`) werfen; `rc = -1`
(Session abgelaufen) bekommt den eigenen Typ `FonSessionExpiredError`. Es gibt
**keinen** automatischen Neu-Login.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
