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

Diese drei Felder sind Pflicht: Fehlt eines oder ist es leer, wirft
`createEldaTransfer` bereits beim Bauen einen `EldaError` — ohne diese Prüfung
würde ELDA jeden Aufruf nur mit einem kryptischen Status `558` beantworten.

`umgebung` bestimmt zusätzlich den Endpoint (`ELDA_ENDPOINTS`) und ist ebenfalls
**Pflicht** — bewusst **ohne** Produktions-Default: ein vergessenes Feld darf
nicht versehentlich echte Meldungen in den Echtbetrieb schicken.

| Umgebung     | Zweck                                  |
| ------------ | --------------------------------------- |
| `produktion` | Echtbetrieb                             |
| `kundentest` | ELDA-Kundentestsystem                   |
| `sit`        | ELDA-Systemintegrationstest              |

Alternativ kann `endpoint` explizit gesetzt werden (hat Vorrang vor `umgebung`,
z. B. für einen abweichenden Proxy) — dann ist `umgebung` optional.

## End-to-End-Beispiel

```ts
import { createEldaTransfer, findeRuecksendung } from '@kreiseck/elda';

const elda = createEldaTransfer({
  seriennummer: 'DEINE_SERIENNUMMER',
  kundenpasswort: 'DEIN_KUNDENPASSWORT', // Klartext; wird intern SHA-512-gehasht
  apiKey: 'DEIN_API_KEY',                // bei ELDA anfordern
  umgebung: 'kundentest',                // Pflicht: 'produktion' | 'kundentest' | 'sit'
});

// 1) Meldung senden. Falsche Zugangsdaten oder ein ungültiger Dateiname werfen —
//    ein vergessener Statuscheck ist damit nicht mehr möglich.
const gesendet = await elda.senden({ dateiName: 'mbgm.xml', inhalt: meldungsXml });
if (gesendet.zustand === 'duplikat') {
  // ELDA hatte die Datei schon (z. B. Wiederholung nach Timeout) — kein Fehler.
}
const meineNr = gesendet.protokollnummer; // persistieren!

// 2) später: Warteschlange der Rücksendungen leeren
for (const rs of await elda.ruecksendungenAuflisten()) {
  const erg = await elda.empfangen(rs.protokollnummer); // einmalig, unwiderruflich
  if (erg.zustand === 'datei') {
    speichere(erg.datei.inhalt); // Buffer mit dem Protokoll-XML — erst sichern, dann parsen
  }
}

// 3) gezielt die Rücksendung zu einer eigenen Sendung suchen
const meine = findeRuecksendung(meineNr!, await elda.ruecksendungenAuflisten());
```

**Zu `findeRuecksendung`:** Der Vergleich ist ziffernscharf — die Protokollnummer
darf im `dateiName` weder links noch rechts von einer weiteren Ziffer stehen.
ELDA vergibt fortlaufende Nummern, `1557643` ist damit Präfix von `15576431`; ein
reiner Teilstring-Vergleich würde die falsche Rücksendung liefern, und die wäre
nach dem `empfangen` unwiederbringlich verbraucht. Eine leere Protokollnummer
wirft einen `EldaError`, statt irgendeine fremde Rücksendung zu liefern.

## `senden` mit `zustand: 'angenommen'` heißt „empfangen", nicht „verarbeitet"

`senden` kehrt nur zurück, wenn ELDA die Datei entgegengenommen hat — dafür gibt
es kein `ok`-Feld mehr, sondern `zustand`. `'angenommen'` (Status `000`) bedeutet
nur, dass ELDA die Datei **entgegengenommen** hat. Die **fachliche Verarbeitung**
läuft asynchron und das Ergebnis kommt erst später — abrufbar über
`ruecksendungenAuflisten` (+ `findeRuecksendung`) und `empfangen`. Ein technisch
angenommener Sendevorgang kann fachlich trotzdem scheitern (z. B. Status `403`,
siehe Tabelle unten — der wirft dann allerdings als `EldaStatusError`, weil er
kein von `senden` behandelbarer Zustand ist).

## Status-Codes (`ELDA_STATUS`)

Alle Antworten tragen einen `statusCode` aus `serviceResult.statusCode`. Die
folgende Tabelle ist die vollständige Liste aus der Spec; die Spalte „Zustand"
zeigt, wo ein Code bei `senden`/`empfangen`/`ruecksendungenAuflisten` als
`zustand` zurückkommt — überall sonst wirft die Methode einen `EldaStatusError`.

| Code  | Bedeutung                                                          | Zustand bei          |
| ----- | ------------------------------------------------------------------- | --------------------- |
| `000` | OK                                                                   | `senden`: `angenommen`, `empfangen`: `datei`, `ruecksendungenAuflisten`: Liste |
| `500` | Interner Verarbeitungsfehler                                         | wirft überall |
| `551` | Request abgelaufen (created älter als 60 Sekunden)                   | wirft überall |
| `552` | Nonce wurde bereits verwendet                                        | wirft überall |
| `553` | Seriennummer für dieses Service nicht berechtigt                     | wirft überall |
| `554` | Nonce nicht gesetzt                                                  | wirft überall |
| `555` | created nicht gesetzt                                                | wirft überall |
| `557` | API-Key ungültig                                                     | wirft überall |
| `558` | Seriennummer und/oder Kundenpasswort falsch                          | wirft überall |
| `559` | Unerlaubter Content-Type                                             | wirft überall |
| `401` | dateiName zu lang (max 255)                                          | wirft (nur bei `senden` relevant) |
| `402` | dateiName nicht gesetzt                                              | wirft (nur bei `senden` relevant) |
| `403` | Datei nicht verarbeitet (auslösender Fehlercode in der Meldung)      | wirft (nur bei `senden` relevant) |
| `404` | Datei wird noch verarbeitet (Verarbeitung > 40 Sekunden)              | `senden`/`empfangen`: `nochInArbeit` |
| `405` | Datei ist Duplikat (Protokollnummer des Originals in der Meldung)     | `senden`: `duplikat` |
| `406` | Datei mit Protokollnummer nicht vorhanden                             | `empfangen`: `nichtVorhanden` |
| `407` | Keine Berechtigung, Datei zu empfangen (Seriennummer stimmt nicht überein) | wirft (nur bei `empfangen` relevant) |
| `408` | Datei laut Protokollnummer wurde bereits empfangen                   | `empfangen`: `bereitsEmpfangen` |

## Fehler oder Zustand?

Nur die Codes, die ein Aufrufer sinnvoll und ohne Rückfrage weiterverarbeiten
kann, kommen als `zustand` zurück (siehe Tabelle oben) — dafür gibt es dann kein
`ok`-Feld, sondern eine über `zustand` verengbare Vereinigung (`Gesendet`,
`Empfangen`). Erwartete Zustände wie `'duplikat'` oder `'nochInArbeit'` sind kein
Kontrollfluss über Ausnahmen: Sie treten im Normalbetrieb regelmäßig auf und
sollen nicht per `try/catch` behandelt werden müssen.

Alle übrigen Status-Codes — falsche Zugangsdaten, abgelaufener Request,
ungültiger Dateiname, interner Fehler — wirft die Methode als `EldaStatusError`.
Das ist bewusst so: Ein nicht vorgesehener Status-Code an der Aufrufstelle zu
übersehen (weil niemand ihn behandelt hat) wäre ein stiller Fehler; als Ausnahme
lässt er sich nicht überzeugend ignorieren. `EldaStatusError` trägt `statusCode`,
die Klartext-`meldung` von ELDA und das vollständige rohe `ergebnis` — es geht
nichts verloren.

## Volle Kontrolle: `elda.roh`

Wer lieber jede Entscheidung selbst trifft — z. B. um einen Status-Code
loggen, aber trotzdem weiterlaufen zu lassen, den die Komfortschicht werfen
würde — greift auf die rohe Variante zu. Sie nutzt denselben Transport und
dieselbe Konfiguration wie `elda`, wirft aber nie bei fachlichen Status-Codes:

```ts
const erg = await elda.roh.senden({ dateiName: 'mbgm.xml', inhalt: meldungsXml });
if (!erg.ok) {
  // erg.statusCode, erg.meldung — nichts wird geworfen, alles selbst entscheiden
}
```

`elda.roh` ist vom Typ `EldaTransferRoh` und lässt sich auch unabhängig von
`createEldaTransfer` direkt über `createEldaTransferRoh(config)` erzeugen.

## `empfangen` ist unwiderruflich

`empfangen` holt eine Rücksendung **einmalig** — danach gilt sie bei ELDA als
abgeholt und ist über ihre Protokollnummer nicht mehr abrufbar. Der Inhalt muss
deshalb gesichert sein, bevor mit ihm weitergearbeitet wird (z. B. bevor er
geparst wird und das Parsen scheitern könnte).

Zwei Fehlerfälle rund um `empfangen` sind absichtlich **kein** stilles
Wegwerfen von Inhalt:

- Meldet die Antwort `zustand: 'datei'` (Status `000`), aber ohne `<datei>`,
  wirft `empfangen` einen `EldaProtocolError` — die Rücksendung gilt bei ELDA
  bereits als abgeholt, ohne dass ein Inhalt vorläge, und das wird nicht als
  leeres Ergebnis durchgereicht.
- Liefert ELDA umgekehrt eine `<datei>` zu einem Status-Code, der dafür gar
  nicht vorgesehen ist, wirft `empfangen` einen Fehler, statt den
  mitgelieferten Inhalt kommentarlos zu verwerfen — welche Fehlerklasse das
  ist, hängt vom Status-Code ab: Ist der Code selbst ein von `empfangen`
  behandelter Zustand ohne vorgesehene `<datei>` (z. B. `408`, „bereits
  empfangen"), meldet `empfangen` einen `EldaProtocolError`. Ist der Code
  dagegen ohnehin kein behandelbarer Zustand (z. B. `407`, „keine
  Berechtigung"), wirft bereits die Zustandsprüfung zuerst einen
  `EldaStatusError` — auch der trägt die widersprüchliche `<datei>` über
  `ergebnis.datei` weiter.

In **beiden** Fällen hängt das bereits von ELDA ausgelieferte rohe
Ergebnisobjekt am Fehler (`err.ergebnis`, ggf. mit `ergebnis.datei`) — der
Inhalt ist damit aus dem Fehler selbst wiederherstellbar. Ein erneuter Aufruf
von `empfangen` ist dagegen **kein** verlässlicher Weg, den Inhalt zu holen:
`empfangen` ist einmalig, die Rücksendung gilt bereits als abgeholt, und ein
zweiter Versuch liefert typischerweise nur noch `nichtVorhanden` oder
`bereitsEmpfangen` — ohne die Datei.

## Fehlerbehandlung

Fachliche Status-Codes, die als `zustand` behandelbar sind, werden **nie**
geworfen (siehe „Fehler oder Zustand?" oben). Geworfen wird in folgenden Fällen:

- **`FonSoapFaultError`** (aus `@kreiseck/finanzonline-core`) — ein echter SOAP-Fault.
- **`FonTransportError`** (aus `@kreiseck/finanzonline-core`) — die Anfrage kam
  nicht durch (Netzfehler, Zeitüberschreitung). Siehe „Wiederholungen" unten.
- **`FonProtocolError`** (aus `@kreiseck/finanzonline-core`) — die Antwort ist
  kein gültiges XML (u. a. bei einer echten MTOM-Antwort, siehe unten) oder trägt
  einen HTTP-Fehlerstatus ohne SOAP-Fault.
- **`EldaProtocolError`** (aus diesem Paket, Basis `EldaError`) — die Antwort ist
  XML, aber inhaltlich nicht auswertbar: kein `<return>`-Element, kein
  `<serviceResult><statusCode>`, eine `<ruecksendungen>` ohne Protokollnummer,
  ein `<payload>`, der XOP-referenziert (`<xop:Include>`) bzw. trotz Status `000`
  leer ist, oder den ersten der beiden Fälle aus „`empfangen` ist unwiderruflich"
  oben (der zweite Fall wirft je nach Status-Code stattdessen einen
  `EldaStatusError`, siehe dort). Trägt optional das rohe Ergebnis als `err.ergebnis`.
- **`EldaStatusError`** (aus diesem Paket, Basis `EldaError`) — ein Status-Code,
  der keinen behandelbaren Zustand beschreibt (siehe Tabelle oben). Trägt
  `statusCode`, `meldung` und das vollständige rohe `ergebnis`.

```ts
import { EldaError, EldaProtocolError, EldaStatusError } from '@kreiseck/elda';
import { FonProtocolError } from '@kreiseck/finanzonline-core';

try {
  await elda.empfangen(protokollnummer);
} catch (err) {
  if (err instanceof EldaStatusError) {
    // nicht behandelbarer Status-Code — err.statusCode, err.meldung, err.ergebnis
  } else if (err instanceof EldaProtocolError) {
    // Antwort ist XML, aber inhaltlich nicht auswertbar (fehlendes <return>,
    // fehlender statusCode, XOP-Referenz statt Base64, widersprüchliche <datei> …)
    // — err.ergebnis trägt ggf. den bereits ausgelieferten Inhalt
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
wiederholtes `senden` kann daher fachlich als `zustand: 'duplikat'` (Status `405`,
mit der Protokollnummer des Originals in der Meldung) beantwortet werden — das
ist der gewollte, auswertbare Ausgang, kein Datenverlust.

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
