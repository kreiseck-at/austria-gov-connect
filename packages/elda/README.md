# @kreiseck/elda

Anbindung an den ELDA Transfer-Webservice v4 (österreichische Sozialversicherung,
Übermittlung von Lohnverrechnungsmeldungen). Selbstgeschriebener SOAP-1.1-Layer auf
Basis von [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Transport, XML-Parsing) — **keine** eigene Laufzeitabhängigkeit über das hinaus.

Dieses Paket deckt zwei Stufen ab. **Transport:** die drei Methoden des
Transfer-Webservice (`senden`, `ruecksendungenAuflisten`, `empfangen`) samt
Security-Parametern (`securityParameters`, SHA-512-Hash) und Envelope-Bau.
**Meldungsbau:** seit Version 0.3.0 zusätzlich die Sätze der **Versichertenmeldung
reduziert** (Kapitel E.29 der Organisationsbeschreibung) — Anmeldung, Abmeldung,
Änderungsmeldung, Richtigstellungen und Stornos — als fertigen, ISO-8859-15-kodierten
Datenbestand, siehe „Meldungen erzeugen" unten. Andere Meldungsarten, insbesondere die
monatliche Beitragsgrundlagenmeldung (mBGM), sind **nicht** enthalten.

## Reifegrad

Dieses Paket ist **noch nie gegen eine echte ELDA-Gegenstelle gelaufen**. Das
Drahtformat stammt aus der offiziellen Schnittstellenbeschreibung V4; sämtliche
Tests laufen gegen selbst geschriebene Antwort-Fixtures, die dieselbe Lesart der
Spezifikation abbilden wie der Code. Eine Fehldeutung der Spezifikation wäre
folglich in Code und Test gleichermaßen enthalten und bliebe unentdeckt.

Ungeklärt, bis ein ELDA-Kundentest-Zugang vorliegt: ob der Payload inline als
Base64 übertragen wird oder per MTOM/XOP; wie eine leere Rücksendungsliste auf
dem Draht aussieht; ob `senden` bei Status `000` stets eine Protokollnummer
mitliefert; ob bei Status `405` die Protokollnummer der Originalsendung in einem
Feld oder nur im Meldungstext steht; ob `<messages>` mehrfach vorkommen kann; ob
`datei.dateiTyp` numerisch kommt (so die Tabelle in Abschnitt 4.2) oder als Text
wie `XML` (so die Beispiel-Ausgabe in Abschnitt 7.4.3.3 desselben Dokuments —
das Dokument widerspricht sich hier selbst, deshalb reicht dieses Paket den Wert
unverändert als `string` durch).

Status `404` bei `empfangen` ist **keine** offene Frage mehr: Die Status-Tabelle
in Abschnitt 6 führt den Code für `EmpfangenResult` ausdrücklich als nicht
zutreffend, und Abschnitt 3.6 listet ihn dort ebenfalls nicht. Er wird deshalb
geworfen, nicht als `nochInArbeit` durchgereicht. Sollte der Kundentest zeigen,
dass ELDA ihn bei `empfangen` doch schickt, gehört er mitsamt seiner dann
belegten Bedeutung wieder in die Karte — bis dahin wäre ein stilles
`nochInArbeit` genau die Falle, vor der der Rest dieses Abschnitts warnt: Der
Aufrufer pollte endlos, statt laut zu scheitern.

An all diesen Stellen schlägt der Client bewusst laut fehl, statt stillschweigend
leere oder halb geparste Daten zu liefern — eine falsche Annahme fällt damit beim
ersten echten Aufruf auf und nicht erst in den Daten.

Seit Version 0.3.0 gilt dasselbe Vorbehalt auch für den Meldungsbau (Abschnitt
„Meldungen erzeugen" unten): Auch diese Stufe ist nie gegen eine echte
ELDA-Gegenstelle gelaufen. Anders als bei der Transport-Schicht stützen sich die
Tests dort aber nicht nur auf die eigene Lesart der Spezifikation, sondern
zusätzlich auf die 28 durchgerechneten Beispiele aus Kapitel E.29.2 der
Organisationsbeschreibung (`beispiele-e29.test.ts`) — jede dort abgedruckte
Wert-Tabelle ist als Test erfasst und ausschließlich mit den im Dokument
genannten Werten bestückt. Eine Fehldeutung der Spezifikation, die bereits im
Dokument selbst durchgerechnet ist, würde also auffallen; eine Fehldeutung an
einer Stelle, die keines der 28 Beispiele berührt, bliebe dagegen unentdeckt.

Ungeklärt bleibt insbesondere: ob ELDA die Meldungssätze innerhalb eines
Bestands tatsächlich ohne Trennzeichen aneinandergereiht erwartet (so baut es
`erstelleBestand` — Fixlängensätze ohne Satztrenner, wie es die
Identifikationsteil-Konvention aus Kapitel E.1 nahelegt, aber kein Beispiel des
Dokuments zeigt einen kompletten Bestand als Byte-Strom). Das ist die offenste
Stelle des Meldungsbaus, und es gibt eine deutliche Gegenanzeige: Kapitel C.1
sagt auf Seite 49 wörtlich „**Die Übermittlung erfolgt in variabler
Satzlänge**". Eine variable Satzlänge lässt sich ohne Satztrenner (oder ein
Längenpräfix) gar nicht auflösen — der Satz spricht also eher für einen Trenner
als dagegen, auch wenn das Dokument an keiner Stelle sagt, welcher. Innerhalb
eines einzelnen Bestands ist die Satzlänge allerdings konstant (`erstelleBestand`
weist ungleich lange Sätze ab, Kapitel C.1.2 nennt die Satzlängen als erste
Prüfung bei der Übernahme), sodass die Aussage sich plausibel auch nur auf die
Unterschiede zwischen Verarbeitungen beziehen kann. **Das gehört als Erstes in
den Kundentest**: denselben Bestand einmal ohne Trenner und einmal mit `\n` bzw.
`\r\n` hochladen und die Mitteilungsfiles vergleichen. Weiter ungeklärt: ob
MTOM/XOP-Fragen
aus der Transport-Schicht (siehe oben) sich auf einen Meldungsbestand als
Anhang genauso auswirken; und ob die in diesem Paket ergänzte Regel zu `REFV`
(fehlt die VSNR bei Abmeldung, Änderungsmeldung oder Richtigstellung Anmeldung,
muss neben dem Geburtsdatum auch `REFV` belegt sein, siehe unten) tatsächlich
so von ELDA durchgesetzt wird — sie ist aus Kapitel E.30.2 abgeleitet, aber in
keinem der 28 Beispiele belegt: Alle 28 geben durchweg die VSNR an, keines
prüft den Fall „VSNR fehlt" durch.

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
| `404` | Datei wird noch verarbeitet (Verarbeitung > 40 Sekunden)              | `senden`: `nochInArbeit`; bei `empfangen` laut Spec nicht vorgesehen → wirft |
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

Daraus folgen zwei Dinge, die in diesem Paket bewusst anders sind als bei den
übrigen Methoden: `transport.retries` gilt hier nicht (siehe „`retries` gilt für
`empfangen` nicht"), und eine leere oder fehlende Protokollnummer wirft einen
`EldaError`, statt einen sinnlosen Request abzusetzen — ELDA beantwortete den mit
`406` („nicht vorhanden"), was von einer echten Fehladressierung nicht zu
unterscheiden wäre.

Drei Fehlerfälle rund um `empfangen` sind absichtlich **kein** stilles
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
- Ist das `<serviceResult>` unbrauchbar (fehlender oder leerer `<statusCode>`),
  wird die `<datei>` trotzdem **zuerst** gelesen und hängt am Fehler. Ohne
  Status-Code lässt sich Erfolg nicht von Fehlschlag unterscheiden — die
  Zustellung ist aber verbraucht, und die Bytes liegen bereits in der Antwort.

In **allen** Fällen hängt das bereits von ELDA ausgelieferte rohe
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
  einen HTTP-Fehlerstatus ohne SOAP-Fault. Trägt `err.httpStatus` und
  `err.rohantwort` (den ungeparsten Body, siehe „Hinweis zu MTOM/XOP").
- **`EldaProtocolError`** (aus diesem Paket, Basis `EldaError`) — die Antwort ist
  XML, aber inhaltlich nicht auswertbar: kein `<return>`-Element, kein
  `<serviceResult><statusCode>`, eine `<ruecksendungen>` ohne Protokollnummer,
  ein `<payload>`, der XOP-referenziert (`<xop:Include>`) bzw. trotz Status `000`
  leer ist, ein Payload, der kein wohlgeformtes Base64 ist oder nicht zur
  mitgelieferten `md5` passt, oder einer der Fälle aus „`empfangen` ist
  unwiderruflich" oben (bei einer widersprüchlichen `<datei>` wirft je nach
  Status-Code stattdessen ein `EldaStatusError`, siehe dort). Trägt optional das
  rohe Ergebnis als `err.ergebnis`.
- **`EldaError`** selbst — die Argumente eines Aufrufs sind unbrauchbar, bevor
  überhaupt ein Request abgeht: unvollständige Zugangsdaten, unbekannte
  `umgebung`, leere Protokollnummer bei `empfangen` bzw. `findeRuecksendung`.
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

### `retries` gilt für `empfangen` nicht

`empfangen` wird **nie** automatisch wiederholt, unabhängig vom eingestellten
Wert. Der Grund ist die Einmaligkeit der Zustellung (FAQ 8.2): ELDA verbucht die
Rücksendung als abgeholt, sobald sie ausgeliefert wird, und liefert sie danach
kein zweites Mal.

Ein Transportfehler beweist nicht, dass die Anfrage den Server nie erreicht hat.
`timeoutMs` (Standard 30 000 ms) umfasst nicht nur den Verbindungsaufbau, sondern
den **gesamten Body-Download**; bricht das Herunterladen eines großen Protokolls
ab, sieht das exakt aus wie ein gewöhnlicher Netzfehler. Ein automatischer
zweiter Versuch bekäme dann `408` („bereits empfangen") — und weil FAQ 8.2 genau
diesen Code als typische Folge *gleichzeitiger Aufrufe mehrerer Clients*
beschreibt, läse der Aufrufer den selbst verursachten Verlust als fremden Abruf.
Ein normaler, behandelter `zustand: 'bereitsEmpfangen'`, hinter dem ein
unwiederbringlich verlorenes Verarbeitungsprotokoll steckt. Deshalb: keine
automatische Wiederholung.

**Was das für Aufrufer heißt:** Ein `FonTransportError` aus `empfangen` heißt
nicht „nichts passiert". Die Rücksendung kann bereits als abgeholt gelten. Vor
einem eigenen zweiten Versuch prüfen, ob die Protokollnummer überhaupt noch in
`ruecksendungenAuflisten` steht — und wenn `empfangen` unmittelbar danach `408`
meldet, ist der wahrscheinlichere Grund der eigene abgebrochene Aufruf, nicht ein
fremder Client. Bei einem Abbruch mitten im Body ist die letzte Kopie der Daten
der rohe Antwort-Body; siehe „Hinweis zu MTOM/XOP" unten zu `err.rohantwort`.

Für `senden` und `ruecksendungenAuflisten` ist die Wiederholung dagegen
unbedenklich: `ruecksendungenAuflisten` verändert nichts, und eine doppelt
angekommene Sendung beantwortet ELDA mit `405` (siehe oben).

## Der Inhalt wird geprüft, nicht blind dekodiert

`Buffer.from(x, 'base64')` überspringt ungültige Zeichen stillschweigend und
akzeptiert abgeschnittene Eingaben ohne Fehler. Bei einer einmaligen Zustellung
wäre das fatal: Ein unterwegs verstümmeltes Protokoll käme als geglückte Abholung
mit falschen Bytes an, und einen zweiten Blick darauf gibt es nicht. `empfangen`
prüft deshalb, bevor es ein Ergebnis liefert:

- Der `<payload>` muss **wohlgeformtes Base64** sein (Zeilenumbrüche sind
  erlaubt). Die Schnittstellenbeschreibung liefert selbst den Anschauungsfall:
  In Abschnitt 7.4.1.2 stellt SoapUI eine Attachment-Referenz als
  `<payload>cid:1526066113758</payload>` dar — `c`, `i` und `d` sind gültige
  Base64-Zeichen, der Doppelpunkt würde übersprungen und das Ergebnis als Erfolg
  gemeldet.
- Liefert ELDA eine `md5` (Abschnitt 4.2), wird sie gegen den dekodierten Inhalt
  geprüft.

Schlägt eine der beiden Prüfungen fehl, wirft `empfangen` einen
`EldaProtocolError`. Der Inhalt geht dabei **nicht** verloren: `err.ergebnis`
trägt die Metadaten, `err.ergebnis.rohPayload` den Payload im Rohzustand und —
bei einer MD5-Abweichung — `err.ergebnis.datei.inhalt` die dekodierten Bytes.

## Hinweis zu MTOM/XOP

Dieser Client sendet und erwartet den Datei-Payload **inline als Base64**
(`base64Binary`), nicht als MTOM/multipart-Nachricht. MTOM ist **nicht**
implementiert. Antwortet ELDA trotzdem MTOM, äußert sich das in zwei
verschiedenen Fehlern — je nachdem, wie die Antwort auf der Leitung aussieht:

- **Echte MTOM-Antwort** (`multipart/related` mit MIME-Teilen): Der Body ist kein
  XML. Das Parsing scheitert bereits im Transport von
  `@kreiseck/finanzonline-core`, der Aufrufer bekommt einen **`FonProtocolError`**
  („Antwort ist kein gültiges XML"). Weil `empfangen` einmalig ist, ist der
  ungeparste Body an dieser Stelle die **letzte existierende Kopie** der
  Rücksendung — die Protokoll-Bytes stecken darin als MIME-Teil. Er hängt deshalb
  am Fehler: `err.rohantwort` (dazu `err.httpStatus`). Bewusst nicht in der
  Fehlermeldung und weder über `console.error(err)` noch über
  `JSON.stringify(err)` sichtbar, denn er kann personenbezogene Daten enthalten;
  wer ihn braucht, greift ihn gezielt ab und schreibt ihn selbst weg:

  ```ts
  import { FonProtocolError } from '@kreiseck/finanzonline-core';

  try {
    await elda.empfangen(protokollnummer);
  } catch (err) {
    if (err instanceof FonProtocolError && err.rohantwort) {
      await fs.writeFile(`rohantwort-${protokollnummer}.bin`, err.rohantwort);
    }
    throw err;
  }
  ```
- **Reguläre XML-Antwort mit XOP-Referenz** (`<payload><xop:Include href="cid:…"/></payload>`,
  z. B. wenn das Attachment fehlt oder von einer Zwischenstelle abgetrennt wurde):
  Das erkennt `empfangen` und wirft einen **`EldaProtocolError`** — statt still
  eine leere Datei vorzutäuschen.

Ob ELDA im Kundenbetrieb tatsächlich inline-Base64 akzeptiert/liefert oder MTOM
erzwingt, ist erst mit einem echten ELDA-Kundentest-Zugang endgültig zu klären;
bis dahin ist die Logik vollständig unit-getestet, aber der Sendepfad noch nicht
gegen die echte Gegenstelle verifiziert.

## Meldungen erzeugen

Seit Version 0.3.0 baut dieses Paket zusätzlich zur Transport-Schicht auch die
eigentlichen Meldungssätze der **Versichertenmeldung reduziert** (Kapitel E.29
der Organisationsbeschreibung, Satzstruktur-Version 03, zwingend ab
01.02.2026): An-/Abmeldung, Änderungsmeldung, Richtigstellungen und Stornos.
Ein Builder liefert einen `RohSatz`; `erstelleBestand` klammert beliebig viele
`RohSatz` zu einem vollständigen, ISO-8859-15-kodierten Datenbestand
(Vorlaufsatz, Meldungssätze, Schlusssatz), der unverändert als `inhalt` an
`senden` geht. Andere Meldungsarten (insbesondere die monatliche
Beitragsgrundlagenmeldung mBGM) sind davon nicht erfasst, siehe „Ausblick"
unten.

### Durchgehendes Beispiel

```ts
import {
  createEldaTransfer,
  anmeldung,
  erstelleBestand,
  wochenarbeitszeit,
} from '@kreiseck/elda';

const elda = createEldaTransfer({
  seriennummer: 'DEINE_SERIENNUMMER',
  kundenpasswort: 'DEIN_KUNDENPASSWORT',
  apiKey: 'DEIN_API_KEY',
  umgebung: 'kundentest',
});

// 1) Meldungssatz bauen. Wirft einen EldaError, wenn die Pflichtmatrix aus
//    E.29.1 oder eine entscheidbare Regel des Prüfkatalogs verletzt ist
//    (siehe „Was geprüft wird" unten) — nicht erst beim Senden.
const meldung = anmeldung({
  REFW: 'REF-2026-000123', // eigener, eindeutiger Referenzwert dieser Meldung
  BKNR: '1234567', // Beitragskontonummer beim zuständigen Träger
  DGNA: 'Muster GmbH',
  VSNR: '1234010180',
  FANA: 'Muster',
  VONA: 'Maria',
  ADAT: '01022026', // Anmeldedatum TTMMJJJJ
  BBER: '01', // Beschäftigungsbereich „Arbeiter" (Kapitel D.39)
  GERF: 'N',
  FRDV: 'N',
  VWAZ: wochenarbeitszeit(15, 40), // '1567' — hier zwingend, siehe unten
});

// 2) Einen oder mehrere Meldungssätze zu einem Bestand klammern.
const bestand = erstelleBestand([meldung], {
  seriennummer: '1234567', // Seriennummer zum Datensammelsystem (Feld OBUS)
  versicherungstraeger: '11',
  datentraegernummer: '000001',
  erstellt: new Date(), // echter Zeitpunkt — kein selbst vorverschobenes Datum, siehe unten
  testdaten: true, // PROJ = 'TM'; für den Echtbetrieb false
  hersteller: {
    name: 'Muster Software',
    kfz: 'A',
    plz: '1010',
    ort: 'Wien',
    strasse: 'Musterstraße 1',
    mail: 'edv@muster-gmbh.at',
  },
});

// 3) Bestand unverändert an senden übergeben.
await elda.senden({ dateiName: 'meldung.dat', inhalt: bestand });
```

**Immer den `Buffer` übergeben, nie einen String.** `senden` kodiert einen
`string` als **UTF-8**; ein E.29-Bestand ist dagegen ISO-8859-15. Bei einem von
Hand zusammengesetzten String mit Umlauten (ä, ö, ü, ß) oder dem Euro-Zeichen
ginge jedes betroffene Zeichen still als Mehrbyte-Sequenz auf die Leitung und
verschöbe alle Fixlängenfelder dahinter. `erstelleBestand` liefert genau deshalb
einen fertig kodierten `Buffer`.

### Die sieben Satzarten

| Code | Satzart (`SATZART_TEXT`)  | Anmerkung                                                        |
| ---- | -------------------------- | ----------------------------------------------------------------- |
| `M3` | Anmeldung                  | Vor Arbeitsantritt zu übermitteln                                  |
| `M4` | Abmeldung                  |                                                                     |
| `M6` | Änderungsmeldung           | Ändert ausschließlich `BBER`, `GERF` und `FRDV`                    |
| `M8` | Richtigstellung Anmeldung  |                                                                     |
| `M9` | Richtigstellung Abmeldung  |                                                                     |
| `S3` | Storno Anmeldung           |                                                                     |
| `S4` | Storno Abmeldung           |                                                                     |

Jeder Code entspricht genau einer Builder-Funktion (`anmeldung` → `M3`,
`abmeldung` → `M4`, `aenderungsmeldung` → `M6`, `richtigstellungAnmeldung` →
`M8`, `richtigstellungAbmeldung` → `M9`, `stornoAnmeldung` → `S3`,
`stornoAbmeldung` → `S4`). Alle sieben teilen sich dieselbe Feldtabelle
(`MeldungsFelder`) — welche Felder bei welcher Satzart zwingend, verboten oder
optional sind, steht in `PFLICHT_E29`.

### `wochenarbeitszeit`

Das Feld `VWAZ` erwartet das Ausmaß der vereinbarten wöchentlichen Arbeitszeit
als vier Ziffern ohne Dezimaltrenner, kaufmännisch auf zwei Nachkommastellen
gerundete Stunden. `wochenarbeitszeit` übernimmt diese Umrechnung. Das
Dokument nennt selbst 15 Stunden und 40 Minuten als Beispiel:

```ts
wochenarbeitszeit(15, 40); // '1567'
```

`stunden` und `minuten` müssen ganze Zahlen sein (Minuten 0–59) — Dezimal-
stunden rechnet der Aufrufer selbst in Stunden und Minuten um, weil eine
Rundung auf Basis von Dezimalstunden bei bestimmten Werten hauchdünn falsch
landen könnte (siehe Kommentar im Quelltext).

`VWAZ` ist nur in einem einzigen, eng umrissenen Fall zwingend (Prüfkatalog
`F7115`): bei einer **Anmeldung** (`M3`) mit Meldedatum (`ADAT`) **nach dem
31.12.2025**, wenn der Beschäftigungsbereich (`BBER`) `01`, `02`, `03`, `04`
oder `11` ist **und** kein freier Dienstvertrag vorliegt (`FRDV` = `'N'`).
Außerhalb dieser Kombination bleibt `VWAZ` optional (Pflichtstufe `Z1` bei
`M3`/`M8`, `-` bei allen übrigen Satzarten).

### Zeichensatz: ISO-8859-15, mit engem Vorrat für Personennamen

ELDA erwartet Fixlängen-Dateien in ISO-8859-15. Dieses Paket kodiert selbst
(Node kennt nativ nur `latin1` = ISO-8859-1) und prüft dabei zwei Dinge:

1. **Darstellbarkeit.** Jedes Zeichen muss überhaupt einen Codepunkt in
   ISO-8859-15 haben. Acht Positionen weichen dabei von ISO-8859-1 ab (u. a.
   `€` statt `¤`); alle anderen Positionen sind identisch.
2. **Zeichenvorrat je Feldklasse**, laut dem Abschnitt `ISO8859-15` des
   separaten Zeichensatz-Dokuments (nicht dem `CP850`-Abschnitt darüber):
   - **Personennamen** (`FANA`, `VONA`): nur Leerzeichen, Apostroph,
     Bindestrich, Punkt, Ziffern, Groß- und Kleinbuchstaben sowie
     `Ä Ö Ü ß ä ö ü` — sonst nichts. Ein `é`, `ñ` oder `č` im Namen ist damit
     zulässiges ISO-8859-15, aber **nicht** im engeren Personennamen-Vorrat.
   - **Unternehmensnamen und Adressen** (`DGNA`, `DTEL`, `MAIL`, `SAGR`):
     deutlich weiter gefasst, nahezu der volle ISO-8859-15-Bereich.
   - Alle übrigen Felder (Referenzwerte, Codes, freie Informationsfelder)
     tragen keine Feldklasse und werden nur auf Darstellbarkeit geprüft.

Ein Name, der aus dem zulässigen Vorrat fällt, **wirft** einen `EldaError` —
er wird nicht automatisch transliteriert oder ersetzt. Das ist Absicht: Ob aus
„Muñoz" korrekt „Munoz" oder „Munhoz" wird, ist eine fachliche Entscheidung,
die nur der Dienstgeber treffen kann, keine Ersetzungstabelle im Code treffen
sollte. Wer Namen mit einem breiteren Zeichensatz führt (z. B. aus einem
bestehenden Personalsystem), muss diese Fälle selbst abfangen und vorab eine
zulässige Schreibweise festlegen, bevor der Wert an einen Builder geht.

### Was geprüft wird — und was nicht

Jeder Builder prüft mehrstufig, bevor er einen `RohSatz` liefert:

**1. Pflichtmatrix (Kapitel E.29.1, `PFLICHT_E29`).** Jedes Feld trägt je
Satzart eine von fünf Pflichtstufen (`Z` zwingend, `Z1` zwingend wenn
zutreffend, `Z3` freigestellt, `V` zwingend bei Veränderung, `-` Grundstellung,
keine Angabe zulässig). Erzwungen werden nur die beiden objektiv
entscheidbaren Stufen: `Z` muss belegt sein, `-` muss leer bleiben. `Z1` und
`V` hängen an einer fachlichen Bedingung, die aus der Feldtabelle allein nicht
hervorgeht (bei `VSNR`/`GEBD`/`REFV` z. B. eine Alternativbedingung über
mehrere Felder hinweg, siehe `ALTERNATIVGRUPPEN`) — sie werden hier nicht
strukturell erzwungen, sondern so weit wie möglich über den Prüfkatalog
abgedeckt (siehe unten). `Z3` ist ohnehin freigestellt.

**2. Prüfkatalog (Blatt `VR`), soweit ohne fachliche Zusatzkenntnis
entscheidbar.** Umgesetzt sind:

| Code | Prüft | Satzarten |
| ---- | ----- | --------- |
| `F7000` | `BKNR` darf nicht leer sein | alle |
| `F7020` | Struktur `VSNR` (`LLLPTTMMJJ`, Tag `01`–`31`, Monat `01`–`12` bzw. `13`–`15` beim fingierten Datum, Kapitel D.6) | alle, wenn belegt |
| `F7030` | Format `GEBD` (`TTMMJJJJ`, `00MMJJJJ` oder `0000JJJJ`, echte Monatslänge inkl. Schaltjahr) | alle, wenn belegt |
| `F7050` | Ist `REFV` belegt, muss `GEBD` belegt sein | `M3`, `M4`, `M6` |
| `F7051` | `VSNR` oder `GEBD` muss belegt sein; zusätzlich (eigene, aus Kapitel E.30.2 abgeleitete Ergänzung ohne eigenen Katalog-Code): fehlt die `VSNR`, muss neben `GEBD` auch `REFV` belegt sein | alle bzw. `M4`/`M6`/`M8` |
| `F7060` | `ADAT` darf nicht leer sein | `M4`, `M6`, `M8`, `M9`, `S3`, `S4` |
| `F7061` | Format `ADAT` (`TTMMJJJJ`) | `M3`, `M4`, `M6`, `S3`, `S4` |
| `F7062` | `ADAT` nicht vor 01.01.2019 | alle, wenn belegt |
| `F7065` | `RDAT` darf nicht leer sein | `M8`, `M9` |
| `F7066` | Format `RDAT` | `M8`, `M9` |
| `F7067` | `RDAT` nicht vor 01.01.2019 | `M8`, `M9` |
| `F7069` | `BBER` gegen die Codeliste aus Kapitel D.39 (`01` bis `13`) | `M3`, `M6` (siehe unten) |
| `F7096` | `AGRD` gegen die Codeliste aus Kapitel D.22 | `M4`, `M9` |
| `F7104` | Format `UMDA` | `M4`, `M9`, `S4` |
| `F7105` | Ist `UMDA` belegt, muss `AGRD` `12` sein | nur `M4` (Begründung für `M9` siehe unten) |
| `F7106` | Format `RUMD` | `M9` |
| `F7107` | `SOUM` nur `'J'` oder leer | `M4`, `M9` |
| `F7108` | Ist `UMDA` belegt, muss `ZTUM` belegt sein | `M4`, `M9` |
| `F7109` | Ist `UMDA` belegt, muss `ZKUM` belegt sein | `M4`, `M9` |
| `F7111` | Bei `AGRD` `07`, `08`, `09`, `11`, `12`, `15`, `19`, `23`, `29`, `31`, `32`, `33` muss `EBSV` leer bleiben | `M4`, `M9` |
| `F7112` | Ist `UMDA` leer, dürfen `SOUM`/`ZTUM`/`ZKUM` nicht belegt sein | `M4` |
| `F7113` | wie `F7112`, zusätzlich `RUMD` | `M9` |
| `F7114` | `ZTUM` zwischen `11` und `19` | `M4`, `M9` |
| `F7115` | `VWAZ` zwingend (siehe oben) | `M3` |
| `F7116` | Format `VWAZ` (vierstellig) | `M3`, `M8` |

**Zusätzlich: Regeln aus der Organisationsbeschreibung, für die der
Prüfkatalog keinen Code führt.** Sie sind alle allein aus Feldwerten
entscheidbar, und ihre Verletzung erzeugt jeweils einen strukturell
einwandfreien, fachlich falschen Satz — ELDAs formale Prüfung nimmt ihn an.
Weil es dafür keinen Fehlercode gibt, tragen diese Meldungen das
**Quellkapitel** statt eines `F`-Codes:

| Marker | Prüft | Satzarten |
| ------ | ----- | --------- |
| `E.29` | `GERF` nur `'J'` oder `'N'` (Feldtabelle E.29, Feld Nr. 19) | `M3`, `M4`, `M6`, `M9` |
| `D.41` | `FRDV` nur `'J'` oder `'N'` (Kapitel D.41) | `M3`, `M6` |
| `D.47` | `BVJN` nur `'J'` oder `'N'` (Kapitel D.47) | `M6` |
| `E.29` | `BDAT`, `EBSV`, `KEAB`, `KEBI`, `UEAB`, `UEBI`, `BVAB`, `BVEN` sind gültige Kalenderdaten (`TTMMJJJJ`, echte Monatslänge inkl. Schaltjahr) | alle, wenn belegt |
| `D.22` | Bei 19 Abmeldegründen mit `Z` in der Spalte EBSV (Seite 96) ist `EBSV` zwingend | `M4`, `M9` |
| `D.22` | Bei `AGRD` `00` ist der Grund im Klartext in `SAGR` anzugeben (Seite 95) | `M4`, `M9` |
| `D.22` | Bei `AGRD` `08`, `09`, `15`, `20` muss `BVEN` in Grundstellung bleiben | `M4`, `M9` |
| `D.22` | Bei fünfzehn Abmeldegründen mit `-` in der Spalte KE/UE müssen `KEAB`/`KEBI`/`UEAB`/`UEBI` in Grundstellung bleiben | `M4`, `M9` |
| `E.29.2` | `UEBI` muss mit `ADAT` übereinstimmen; `KEBI` ebenso, solange keine Urlaubsersatzleistung anfällt (Seite 307, Fußnote 60) | `M4` |
| `D.43` | Der Referenzwert `REFW` kommt je Beitragskontonummer nur einmal im Bestand vor (geprüft in `erstelleBestand`) | alle |

Die drei Kennzeichenfelder werden **nicht** stillschweigend groß­geschrieben:
Ein `'n'` statt `'N'` geht als Byte unverändert auf die Leitung, und welche
Schreibweise gemeint war, entscheidet der Aufrufer. Bei `FRDV` hing daran
zusätzlich `F7115` — die Bedingung vergleicht zeichengenau gegen `'N'`, wie
der Katalog sie formuliert; ein `'n'` hätte also zugleich die VWAZ-Pflicht
ausgehebelt. Die Wertebereichsprüfungen laufen deshalb **vor** `F7115`.

`F7069` prüft `BBER` überall, wo die Pflichtmatrix das Feld belegen lässt —
also auch bei `M6`, wo der Katalog die Zeile nicht führt. Ein Code gehört
zum Feld (Kapitel D.39), nicht zur Satzart.

Nicht erzwungen bleiben aus der Abhängigkeitstabelle in Kapitel D.22 alle
**bedingten** Zellen: `Z1` („zwingend wenn zutreffend", u. a. `EBSV` beim
Abmeldegrund `13`), `Z3` („Angabe möglich", `BVEN` bei `07` und `29`) und
das `Z` beim Abmeldegrund `00` — dessen Fußnote 32 nimmt Meldungen zur
Sozialhilfe aus, und ob eine Meldung eine solche ist, sagen die Feldwerte
nicht. Die Identität von `KEBI`/`UEBI` mit `ADAT` gilt nur für `M4`: Der
Satz steht im `M4`-Abschnitt des Kapitels E.29.2, und Seite 97 dehnt
ausdrücklich nur die Abhängigkeiten vom Abmeldegrund auf `M9` aus.

Verletzt ein Satz mehrere dieser Regeln gleichzeitig, wirft die Prüfung beim
**ersten** verletzten Code — in der Reihenfolge, in der die Prüfungen in
`pruefung-e29.ts` stehen (die Tabellen oben ordnen nach Fehlercode, nicht
nach Auswertungsreihenfolge). Das ist eine Umsetzungsentscheidung dieses
Pakets, keine Vorgabe des Katalogs. ELDA kann
serverseitig deshalb bei einem mehrfach fehlerhaften Satz einen anderen Code
melden als den, der hier zuerst geworfen wird.

`F7105` ist für `M9` bewusst **nicht** umgesetzt: Ein dokumentiertes Beispiel
in Kapitel E.29.2 zeigt eine Richtigstellung mit belegtem `UMDA` und einem
Abmeldegrund ungleich `12` — die wörtliche Regel würde dieses belegte
Verhalten fälschlich ablehnen.

**3. Format und Grundstellung numerischer Felder — beim Schreiben.** Numerische
Felder sind laut Kapitel E.1 rechtsbündig mit führenden Nullen aufzufüllen. Für
die dreizehn Datumsfelder (`GEBD`, `ADAT`, `BDAT`, `RDAT`, `EBSV`, `KEAB`,
`KEBI`, `UEAB`, `UEBI`, `BVAB`, `BVEN`, `UMDA`, `RUMD`) und für die
Versicherungsnummer wäre das falsch: Die Feldtabelle druckt dort eine
stellenscharfe Vorgabe ab (`TTMMJJJJ` bzw. `LLLPTTMMJJ`), und ein Auffüllen
machte aus `'1032026'` (10.03.2026, Monat ohne führende Null) klammheimlich
`'01032026'` — den 01.03.2026. Für acht dieser Felder führt der Prüfkatalog
überhaupt keine Formatzeile; der Fehler fiele also auch bei ELDA nicht auf.
Deshalb gilt: ein belegter Wert muss dort die volle Stellenzahl haben, sonst
**wirft** `erstelleBestand`. Genau diese acht Felder (`BDAT`, `EBSV`,
`KEAB`, `KEBI`, `UEAB`, `UEBI`, `BVAB`, `BVEN`) prüft der Builder
zusätzlich gegen den Kalender — acht Ziffern allein machen aus `'31112026'`
noch keinen 31. November.

Umgekehrt ist ein numerischer Wert aus lauter Nullen — `''`, `'0'`, `'00000000'`
— immer die **Grundstellung** des Feldes, also „leer". Ein `String(row.vsnr ?? 0)`
aus einer Datenbank-Spalte gilt damit nicht als belegte Versicherungsnummer, und
ein aus einer Datei zurückgelesenes `UMDA = '00000000'` nicht als ungültiges
Datum. Führende und nachgestellte Leerzeichen werden bei numerischen Feldern
abgeschnitten. Die Regel gilt auf **allen drei Ebenen gleich** — Pflichtmatrix,
Prüfkatalog und Serialisierung: Ein vollständig zurückgelesener 772-Byte-Satz
läuft deshalb unverändert erneut durch einen Builder, ohne an seiner eigenen
Grundstellung zu scheitern. Bei **alphanumerischen** Feldern gilt sie
ausdrücklich nicht: Dort ist die Grundstellung blank, `AGRD = '00'` also ein
echter Abmeldegrund („sonstiger Grund").

> **Achtung bei `VWAZ`:** `'0000'` ist nach dieser Regel die Grundstellung, nicht
> die Angabe „null Wochenstunden" — und `wochenarbeitszeit(0)` liefert genau
> diesen Wert. Wo `F7115` das Feld verlangt, wirft der Builder deshalb, statt
> eine vereinbarte Arbeitszeit von 0,00 Stunden zu melden.

**Danach ist der Satz unveränderlich.** Die Builder liefern ihren `RohSatz`
eingefroren (`Object.freeze`, samt `werte`): Was nach den Prüfungen im Satz
steht, steht dort auch beim Schreiben. Ein nachträgliches
`satz.werte.AGRD = '99'` — aus JavaScript heraus oder nach einem `as`-Bruch —
wirft, statt beide Prüfstufen zu umgehen.

**Und beim Klammern:** `erstelleBestand` verlangt, dass alle übergebenen Sätze
dieselbe Satzlänge haben — ein Bestand hat genau eine — und dass kein
Referenzwert (`REFW`) zu derselben Beitragskontonummer zweimal vorkommt
(Kapitel D.43). Ein doppelter Referenzwert ließe eine spätere Richtigstellung
oder ein Storno auf zwei Meldungen zugleich zeigen. Kapitel C.1.2 nennt
Satzlängen und Satzanzahl als die ersten Prüfungen, die ELDA bei der Übernahme
fährt; ein Fehler dort weist die gesamte Sendung zurück.

**Ausdrücklich nicht umgesetzt** — ELDA prüft diese serverseitig:

- Die **Prüfziffer der Versicherungsnummer** — das Verfahren steht in keiner
  der verfügbaren Quellen. Geprüft wird nur die Stellenfolge `LLLPTTMMJJ`
  aus Kapitel D.6 (siehe `F7020` oben); die vierte Stelle bleibt
  ungerechnet. Sie zu raten wäre schlimmer als sie wegzulassen: Eine falsch
  berechnete Prüfziffer wiese gültige Versicherungsnummern ab.
- Die **trägerabhängige Länge der Beitragskontonummer** — im Prüfkatalog nur
  als Warnung geführt, nicht als harter Fehler.
- Die inhaltliche **Schreibweise von Namen** (`F7036`/`F7038`) — sie verlangt
  eine manuelle fachliche Durchsicht, die sich nicht allein aus den Feldwerten
  entscheiden lässt.
- Die **Formalprüfung der Beitragskontonummer** selbst (`F7001`/`F7002` und,
  wortgleich „Formalprüfung analog Feld BKNR", `F7110` für `ZKUM`) — welche Form
  gültig ist, sagt der Katalog nur über die trägerabhängigen Längenwarnungen.
- Die als **Warnungen** (Status `W`) geführten Zeilen — etwa `F7101`/`F7102`/
  `F7103` (Beschäftigungsbereich, Geringfügigkeit und freier Dienstvertrag nur
  teilweise belegt) oder die Längenwarnungen zur Beitragskontonummer. Sie weisen
  eine Meldung nicht zurück.

Diese Aufzählung ist nicht abschließend; maßgeblich ist die Tabelle oben.

Unabhängig vom Prüfkatalog enthält Kapitel E.29.2 selbst fachliche Regeln,
deren Verletzung eine **strukturell einwandfreie, aber inhaltlich falsche**
Meldung erzeugt — kein `EldaError`, denn es gibt formal nichts zu beanstanden.
Beispiel: Bleibt bei einer Richtigstellung (`M8`) das Feld „Betriebliche
Vorsorge AB" (`BVAB`) unbelegt, **storniert** das laut Dokument die Zeit der
betrieblichen Vorsorge — ein leeres `BVAB` ist dort also keine „keine
Änderung", sondern eine aktive Löschung.

### Zeitstempel im Bestand: Wiener Ortszeit

`BestandOptionen.erstellt` ist ein echter Zeitpunkt (typischerweise das
Ergebnis von `new Date()`). `erstelleBestand` rechnet ihn intern in die
Wanduhrzeit der Zeitzone `Europe/Vienna` um (Sommerzeit inklusive) und trägt
das Ergebnis in `EDAT`/`EZEI` des Vorlaufsatzes ein. Das Dokument kennt kein
eigenes Zeitzonenfeld und erwähnt an keiner Stelle UTC — für ein rein
österreichisches System ist die Wiener Ortszeit die einzig sinnvolle
Konvention. Ein Aufrufer sollte deshalb ein unverändertes `Date`-Objekt
übergeben und **nicht** selbst vorverschieben; die Zeitzone lässt sich über
`BestandOptionen.zeitzone` überschreiben, das ist aber nur für Sonderfälle
gedacht.

### Quellen

- Organisationsbeschreibung „Datenaustausch mit Dienstgebern", 42. Ergänzung,
  Version 42.7.0 (07/2026), Kapitel E.1 (Identifikationsteil), E.2
  (Vorlaufsatz), E.3 (Schlusssatz), E.29 (Versichertenmeldung reduziert:
  Feldtabelle, Pflichtmatrix, Erstellvorschriften mit Beispielen), D.22
  (Abmeldegrund-Codeliste samt Abhängigkeitstabelle auf Seite 96), D.6
  (Aufbau der Versicherungsnummer), D.39 (Beschäftigungsbereich-Codeliste),
  D.41 (freier Dienstvertrag), D.43 (Referenzwert), D.47 (betriebliche
  Vorsorge), E.30.2 (VSNR-Anforderung).
- Prüfkatalog zur 42. Ergänzung, Blatt `VR`.
- Das separate Zeichensatz-Dokument (Zeichenvorrat Personennamen bzw.
  Unternehmensnamen/Adressen in ISO-8859-15).

## Ausblick

Andere Meldungsarten als die Versichertenmeldung reduziert (Kapitel E.29) —
insbesondere die monatliche Beitragsgrundlagenmeldung (mBGM) — sind von diesem
Paket bislang nicht abgedeckt und benötigen ihre eigene Spec-Grundlage.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
