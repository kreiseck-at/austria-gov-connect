# @kreiseck/elda

Anbindung an den ELDA Transfer-Webservice v4 (österreichische Sozialversicherung,
Übermittlung von Lohnverrechnungsmeldungen). Selbstgeschriebener SOAP-1.1-Layer auf
Basis von [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Transport, XML-Parsing) — **keine** eigene Laufzeitabhängigkeit über das hinaus.

Dieses Paket kapselt die drei Methoden des Transfer-Webservice (`senden`,
`ruecksendungenAuflisten`, `empfangen`) samt Security-Parametern (`securityParameters`,
SHA-512-Hash) und Envelope-Bau. Es erzeugt **keine** SV-Meldungen (Anmeldung,
Abmeldung, mBGM …) — dafür siehe „v2" unten.

## Installation

```bash
npm install @kreiseck/elda
```

Node ≥ 20.18.

## Zugangsdaten und Umgebungen

Für `createEldaTransfer` werden drei Zugangsdaten benötigt:

- **Seriennummer** — vergeben bei der ELDA-Registrierung.
- **Kundenpasswort** — im Klartext übergeben, wird intern zu SHA-512 (hex,
  lowercase) gehasht, wie von ELDA gefordert.
- **API-Key** — separat **bei ELDA anfordern**, unabhängig von Seriennummer/Kundenpasswort.

Der Aufruf geht je nach `umgebung` an einen von drei Endpoints (`ELDA_ENDPOINTS`):

| Umgebung     | Zweck                                  |
| ------------ | --------------------------------------- |
| `produktion` | Echtbetrieb (Standard, wenn nicht gesetzt) |
| `kundentest` | ELDA-Kundentestsystem                   |
| `sit`        | ELDA-Systemintegrationstest              |

Alternativ kann `endpoint` explizit gesetzt werden (hat Vorrang vor `umgebung`,
z. B. für einen abweichenden Proxy).

## End-to-End-Beispiel

```ts
import { createEldaTransfer, zuordnung } from '@kreiseck/elda';

const elda = createEldaTransfer({
  seriennummer: 'DEINE_SERIENNUMMER',
  kundenpasswort: 'DEIN_KUNDENPASSWORT', // Klartext; wird intern SHA-512-gehasht
  apiKey: 'DEIN_API_KEY',                // bei ELDA anfordern
  umgebung: 'kundentest',                // 'produktion' | 'kundentest' | 'sit'
});

// 1) Meldung (Datei-XML) senden
const gesendet = await elda.senden({ dateiName: 'mbgm.xml', inhalt: meldungsXml });
if (!gesendet.ok) throw new Error(`Senden fehlgeschlagen: ${gesendet.statusCode} ${gesendet.meldung}`);
const meineNr = gesendet.protokollnummer!; // merken! statusCode '000' heißt "empfangen", nicht "verarbeitet" (siehe unten)

// 2) später: Liste der abholbereiten Rücksendungen (Verarbeitungsprotokolle) holen
const liste = await elda.ruecksendungenAuflisten();
if (!liste.ok) throw new Error(`Auflisten fehlgeschlagen: ${liste.statusCode} ${liste.meldung}`);

// 3) die zur eigenen Sendung gehörende Rücksendung finden
const rs = zuordnung(meineNr, liste.ruecksendungen);
if (rs) {
  // 4) Rücksendung abholen (einmalig! danach nicht mehr per Protokollnummer verfügbar)
  const antwort = await elda.empfangen(rs.protokollnummer);
  if (antwort.ok && antwort.datei) {
    // antwort.datei.inhalt = Buffer mit dem Protokoll-XML -> parsen
  }
}
```

**Wichtig:** `liste` ist kein Array, sondern ein `AuflistenErgebnis` mit
`statusCode`/`ok`/`ruecksendungen`/`meldung` — genau wie bei `senden`/`empfangen`
geht dadurch keine Status-Information verloren. Ein leeres `liste.ruecksendungen`
bei `liste.ok === false` bedeutet **nicht** "keine Rücksendungen offen", sondern
dass der Aufruf selbst fehlgeschlagen ist (z. B. ungültiger API-Key).

**Zu `zuordnung`:** Der Vergleich ist ziffernscharf — die Protokollnummer darf im
`dateiName` weder links noch rechts von einer weiteren Ziffer stehen. ELDA vergibt
fortlaufende Nummern, `1557643` ist damit Präfix von `15576431`; ein reiner
Teilstring-Vergleich würde die falsche Rücksendung liefern, und die wäre nach dem
`empfangen` unwiederbringlich verbraucht. Eine leere Protokollnummer wirft einen
`EldaError`, statt irgendeine fremde Rücksendung zu liefern.

## `senden` mit statusCode '000' heißt „empfangen", nicht „verarbeitet"

`gesendet.ok === true` (statusCode `'000'`) bedeutet nur, dass ELDA die Datei
**entgegengenommen** hat. Die **fachliche Verarbeitung** läuft asynchron und
das Ergebnis kommt erst später — abrufbar über `ruecksendungenAuflisten` (+
`zuordnung`) und `empfangen`. Ein technisch angenommener Sendevorgang kann
fachlich trotzdem scheitern (z. B. Status `'403'`, siehe Tabelle unten).

## Status-Codes (`ELDA_STATUS`)

Alle Antworten tragen einen `statusCode` aus `serviceResult.statusCode`. Über
`istOk(statusCode)` lässt sich der technische Erfolg prüfen (`=== '000'`); die
Ergebnisse aller drei Methoden setzen `ok` bereits entsprechend.

| Code  | Bedeutung                                                          |
| ----- | ------------------------------------------------------------------- |
| `000` | OK                                                                   |
| `500` | Interner Verarbeitungsfehler                                         |
| `551` | Request abgelaufen (created älter als 60 Sekunden)                   |
| `552` | Nonce wurde bereits verwendet                                        |
| `553` | Seriennummer für dieses Service nicht berechtigt                     |
| `554` | Nonce nicht gesetzt                                                  |
| `555` | created nicht gesetzt                                                |
| `557` | API-Key ungültig                                                     |
| `558` | Seriennummer und/oder Kundenpasswort falsch                          |
| `559` | Unerlaubter Content-Type                                             |
| `401` | dateiName zu lang (max 255)                                          |
| `402` | dateiName nicht gesetzt                                              |
| `403` | Datei nicht verarbeitet (auslösender Fehlercode in der Meldung)      |
| `404` | Datei wird noch verarbeitet (Verarbeitung > 40 Sekunden)              |
| `405` | Datei ist Duplikat (Protokollnummer des Originals in der Meldung)     |
| `406` | Datei mit Protokollnummer nicht vorhanden                             |
| `407` | Keine Berechtigung, Datei zu empfangen (Seriennummer stimmt nicht überein) |
| `408` | Datei laut Protokollnummer wurde bereits empfangen                   |

## Fehlerbehandlung

Fachliche Status-Codes werden **nie** geworfen — sie stecken in `ok`/`statusCode`/
`meldung` des jeweiligen Ergebnisses (siehe oben). Geworfen wird nur, wenn die
Antwort technisch nicht sinnvoll auswertbar ist:

- **`FonSoapFaultError`** (aus `@kreiseck/finanzonline-core`) — ein echter SOAP-Fault.
- **`FonTransportError`** (aus `@kreiseck/finanzonline-core`) — die Anfrage kam
  nicht durch (Netzfehler, Zeitüberschreitung). Siehe „Wiederholungen" unten.
- **`FonProtocolError`** (aus `@kreiseck/finanzonline-core`) — die Antwort ist
  kein gültiges XML (u. a. bei einer echten MTOM-Antwort, siehe unten) oder trägt
  einen HTTP-Fehlerstatus ohne SOAP-Fault.
- **`EldaProtocolError`** (aus diesem Paket, Basis `EldaError`) — die Antwort ist
  XML, aber inhaltlich nicht auswertbar: kein `<return>`-Element, kein
  `<serviceResult><statusCode>`, eine `<ruecksendungen>` ohne Protokollnummer,
  oder bei `empfangen` ein `<payload>`, der XOP-referenziert (`<xop:Include>`)
  bzw. trotz `statusCode '000'` leer ist.

```ts
import { EldaError, EldaProtocolError } from '@kreiseck/elda';
import { FonProtocolError } from '@kreiseck/finanzonline-core';

try {
  await elda.empfangen(protokollnummer);
} catch (err) {
  if (err instanceof EldaProtocolError) {
    // Antwort ist XML, aber inhaltlich nicht auswertbar (fehlendes <return>,
    // fehlender statusCode, XOP-Referenz statt Base64 …)
  } else if (err instanceof EldaError) {
    // reserviert für künftige elda-spezifische Fehlerarten
  } else if (err instanceof FonProtocolError) {
    // Antwort war gar kein XML — z. B. eine echte MTOM-Nachricht
  }
  throw err;
}
```

## Wiederholungen (`transport.retries`)

`transport.retries` ist die Anzahl **zusätzlicher** Versuche nach einem
Transportfehler (Standard `0`). Dieses Paket wiederholt selbst und baut dabei für
jeden Versuch **frische `securityParameters`** (neuer `nonce`, neues `created`)
und einen neuen Envelope — ein identisch wiederholter Request liefe bei ELDA
sonst zwangsläufig in Status `552` (Nonce bereits verwendet) bzw. `551` (`created`
älter als 60 Sekunden). Wiederholt wird **ausschließlich** bei Transportfehlern;
SOAP-Faults, Protokollfehler und fachliche Status-Codes werden unverändert
durchgereicht.

Zu beachten: ein Timeout heißt nicht, dass ELDA die Datei nicht bekommen hat. Ein
wiederholtes `senden` kann daher fachlich als Duplikat (`405`, mit der
Protokollnummer des Originals in der Meldung) beantwortet werden — das ist der
gewollte, auswertbare Ausgang, kein Datenverlust.

## Hinweis zu MTOM/XOP

Dieser Client sendet und erwartet den Datei-Payload **inline als Base64**
(`base64Binary`), nicht als MTOM/multipart-Nachricht. MTOM ist **nicht**
implementiert. Antwortet ELDA trotzdem MTOM, äußert sich das in zwei
verschiedenen Fehlern — je nachdem, wie die Antwort auf der Leitung aussieht:

- **Echte MTOM-Antwort** (`multipart/related` mit MIME-Teilen): Der Body ist kein
  XML. Das Parsing scheitert bereits im Transport von
  `@kreiseck/finanzonline-core`, der Aufrufer bekommt einen **`FonProtocolError`**
  („Antwort ist kein gültiges XML").
- **Reguläre XML-Antwort mit XOP-Referenz** (`<payload><xop:Include href="cid:…"/></payload>`,
  z. B. wenn das Attachment fehlt oder von einer Zwischenstelle abgetrennt wurde):
  Das erkennt `empfangen` und wirft einen **`EldaProtocolError`** — statt still
  eine leere Datei vorzutäuschen.

Ob ELDA im Kundenbetrieb tatsächlich inline-Base64 akzeptiert/liefert oder MTOM
erzwingt, ist erst mit einem echten ELDA-Kundentest-Zugang endgültig zu klären;
bis dahin ist die Logik vollständig unit-getestet, aber der Sendepfad noch nicht
gegen die echte Gegenstelle verifiziert.

## v2: Meldungs-Builder (Anmeldung/Abmeldung/mBGM) folgen nach SV-Datensatzbeschreibung

Dieses Paket deckt v1 nur die **Transport-Schicht** ab (Envelope, Security,
die drei Webservice-Methoden, Status-Codes, Korrelation von Sendung und
Rücksendung). Builder für die eigentlichen SV-Meldungsarten (An-/Abmeldung,
monatliche Beitragsgrundlagenmeldung mBGM, …) sind bewusst auf v2 verschoben —
sie brauchen die SV-Datensatzbeschreibung als eigene Spec-Grundlage.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
