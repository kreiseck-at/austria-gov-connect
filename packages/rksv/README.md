# @kreiseck/rksv

Anbindung an den österreichischen Registrierkassen-Webservice (RKSV / `rkdb`) des
BMF und ein netzfreier Prüfer für den maschinenlesbaren Belegcode.

Dieses Paket kapselt die **Übermittlung** an die Behörde — es ist **keine**
Registrierkasse. Es erzeugt keine Belegketten, verwaltet keinen Umsatzzähler und
signiert nichts.

## Installation

```bash
npm install @kreiseck/rksv
```

Node ≥ 18.18. Baut auf [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Session/Transport).

## Übermittlung (online)

```ts
import { createSession } from '@kreiseck/finanzonline-core';
import { createRksv } from '@kreiseck/rksv';

const session = await createSession({ /* … */ });
const rksv = createRksv({ session, uebermittlung: 'test' }); // 'test' | 'echt'

// paketNr besitzt der Aufrufer (Idempotenz); satznr vergibt die Bibliothek.
const erg = await rksv.kasse.registriere({
  paketNr: 42,
  kassenidentifikationsnummer: 'KASSE-001',
  benutzerschluessel: '<44 Zeichen Base64>',
});
erg.ok; // false bei fachlichem rc — erg.rc / erg.msg tragen den BMF-Code

const st = await rksv.status.kasse({ paketNr: 43, kassenidentifikationsnummer: 'KASSE-001' });
st.status?.status; // 'REGISTRIERT' | 'IN_BETRIEB' | 'AUSFALL' | 'AKTIVIERT'
```

Fachliche Returncodes werfen nicht — sie kommen als `Ergebnis` (`ok`/`rc`/`msg`).
Technische Fehler werfen. Genau **eine** Vorgangsart pro Paket; mehr als ein
Vorgang wird asynchron verarbeitet (Ergebnis in der DataBox).

## Belegcode offline prüfen

Netzfrei, nur `node:crypto`, über den Subpath-Export:

```ts
import { decodeBelegCode, pruefeBelegCode, pruefeVerkettung } from '@kreiseck/rksv/code';

const beleg = decodeBelegCode('_R1-AT1_KASSE-001_1_2026-07-20T14:23:34_10,00_…');
const ergebnis = pruefeBelegCode(beleg, { zertifikat }); // Zertifikat optional
// ergebnis.pruefungen[]: { name, status: 'PASS'|'FAIL'|'NOT_EXECUTED', detail? }
pruefeVerkettung(beleg, vorherigerBeleg); // Startbeleg: pruefeVerkettung(beleg)
```

Ohne Zertifikat wird die ES256-Signaturprüfung als `NOT_EXECUTED` gemeldet, nicht
als Fehler.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
