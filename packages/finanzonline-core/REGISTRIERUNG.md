# Zugang einrichten — `@kreiseck/finanzonline-core`

Der Einsatz setzt einen FinanzOnline-Zugang mit eingerichtetem **Webservice-Benutzer**
sowie eine **UID des Softwareherstellers** voraus. `createSession` verlangt
**vier** Felder — alle sind Pflicht, TypeScript erzwingt ihre Angabe:

| Feld | Bedeutung | Restriktion | Woher |
|---|---|---|---|
| `tid` | Teilnehmer-Identifikation (FinanzOnline-Teilnehmer) | `[0-9A-Za-z]{8,12}` | FinanzOnline-Zugang |
| `benid` | Benutzer-ID des **Webservice-Benutzers** | 5–12 Zeichen | Benutzerverwaltung (siehe unten) |
| `pin` | PIN des Webservice-Benutzers | 5–128 Zeichen | bei Anlage des Webservice-Benutzers vergeben |
| `herstellerid` | **UID des Softwareherstellers** | `[0-9A-Za-z]{10,24}` | eigene UID des Software erstellenden Unternehmens (z. B. `ATU########`) |

Fehlt oder missfällt eines dieser Felder, bricht `createSession` **lokal** ab —
noch bevor irgendetwas gesendet wird — mit einem `FonError`, der Feld und
Bedeutung nennt.

## 1. Webservice-Benutzer in FinanzOnline anlegen

1. In FinanzOnline als Administrator anmelden.
2. **Benutzerverwaltung** öffnen und einen neuen **Benutzer** anlegen, bei dem
   die Verwendung als **Webservice-Benutzer** aktiviert ist.
3. Für diesen Benutzer die benötigten **Verfahrensrechte** freischalten — für
   `@kreiseck/rksv` insbesondere das **Registrierkassen-Verfahren**.
4. `benid` (Benutzer-ID) und `pin` dieses Benutzers verwenden — **nicht** die
   Zugangsdaten des persönlichen FinanzOnline-Kontos.

## 2. Hersteller-UID (`herstellerid`)

Die `herstellerid` ist die **UID (Umsatzsteuer-Identifikationsnummer) des
Unternehmens, das die Software herstellt** — also deine/eure eigene UID, nicht
die des Steuerpflichtigen, für den übermittelt wird. Format `ATU` gefolgt von
acht Ziffern (z. B. `ATU12345678`), Muster `[0-9A-Za-z]{10,24}`.

## 3. Feld-zu-Konfiguration-Zuordnung

```ts
import { createSession } from '@kreiseck/finanzonline-core';

const session = await createSession({
  tid:          process.env.FON_TID!,
  benid:        process.env.FON_BENID!,
  pin:          process.env.FON_PIN!,
  herstellerid: process.env.FON_HERSTELLER_UID!,
});
// session.id kurzlebig speichern; das aufrufende Projekt entscheidet wo.
await session.logout();
```

Die PIN gehört **nicht** in den Quellcode oder ins Repository. Über
Umgebungsvariablen oder einen Secret-Store zuführen.

## 4. Test- vs. Echtbetrieb

Es gibt **keinen** getrennten Test-Endpoint. Der Session-Webservice ist für
Test und Echtbetrieb derselbe. Die Unterscheidung Test/Echt trifft erst
`@kreiseck/rksv` über das Feld `art_uebermittlung` (`'T'` Test / `'P'` echt);
Testübermittlungen erlauben zusätzlich `vda_id = 'AT9'`.

## 5. Integrationstest ausführen

Der opt-in-Integrationstest (`src/session.integration.test.ts`) fährt einen
`login`/`logout`-Durchlauf gegen den echten Dienst. Er läuft nur, wenn alle vier
Umgebungsvariablen gesetzt sind, und wird sonst übersprungen — er enthält selbst
keine Zugangsdaten:

```bash
FON_TID=… FON_BENID=… FON_PIN=… FON_HERSTELLER_UID=… \
  npm test -w @kreiseck/finanzonline-core
```
