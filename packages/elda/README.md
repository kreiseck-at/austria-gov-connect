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
Datenbestand, siehe „Meldungen erzeugen" unten. Die monatliche
Beitragsgrundlagenmeldung (mBGM) ist seit 0.6.0 als Satzschicht enthalten —
Feldtabellen, Pflichtmatrix, Codekataloge und der Zusammenbau für beide
Verfahren (Selbstabrechnung und Vorschreibung). Dazu kommen die
**VSNR-Anforderung** (Kapitel E.30), die **Adresse Versicherter** (Kapitel
E.31), die **Familienhospizkarenz/Pflegekarenz** (Kapitel E.12, Bestand `FH`),
die **Schwerarbeitsmeldung** (Kapitel E.22, Bestand `SM`), der **Antrag auf
zwischenstaatliche Bescheinigung** (Entsendung, PD A1; Kapitel E.27, Bestand
`ES`) und der **Lohnzettel Finanz** (L16, Kapitel E.13/E.14, Bestand `LF`)
samt den Regeln des Prüfkatalogs L16.

## Reifegrad

Der **Transport ist seit 0.5.0 gegen die echte Gegenstelle verifiziert**:
`online-test.elda.at` und `online.elda.at` beantworten einen Aufruf mit
ungültigem API-Key mit einem sauberen `EldaStatusError 557`. Damit stehen
Endpunkte, Envelope, `securityParameters`, SOAPAction und das Auspacken der
Antwort fest.

Zwei Annahmen waren dabei falsch und sind korrigiert:

- **SOAPAction ist leer.** Die WSDL gibt bei allen drei Operationen
  `soapAction=""` vor. Mit dem Methodennamen antwortet ELDA mit einem
  SOAP-Fault („does not match an operation").
- **Die Antwort ist immer MTOM** — `multipart/related; type="application/xop+xml"`,
  auch bei Fehlern und auch ohne Binärdaten. Der ungeöffnete Körper ließ jeden
  XML-Parser mit „Unterminated element(s) in XML" abbrechen.

**Seit 05.08.2026 ist der gesamte Weg live verifiziert** — eine echte
monatliche Beitragsgrundlagenmeldung wurde von der ÖGK übernommen (`status: uebernommen`,
7 von 7 Sätzen). Vier Anläufe waren nötig; alle
drei Abweisungen kamen als Status `403` mit `nicht_uebernommen` und haben
**nichts gebucht**. Beanstandet war nie der Inhalt, sondern immer der Umschlag:

| Code | ELDA-Text | Ursache |
|------|-----------|---------|
| `E6` | Datenuebernehmender Versicherungstraeger (UVST) nicht ED | `UVST` trug den zuständigen Träger statt `ED` (D.2) |
| `E31` | Unbekannte Version (03) der Satzstrukturen für Projekt DM, Bestand MB | `VERS` war die Version aus E.29 statt der aus E.32 |
| `E2` | Falsche Satzlaenge! 1747 anstatt 326 Zeichen | keine Satztrenner — ELDA las die ganze Datei als **eine** Zeile |
| `E2` | Falsche Satzlaenge! 326 anstatt 42 Zeichen | alle Sätze auf das Maximum aufgefüllt statt jeder auf seine eigene Länge |

Daraus das **Bestandsformat, wie es tatsächlich erwartet wird**:

- Die Sätze sind durch **CRLF** getrennt, **ohne** Trenner nach dem letzten.
  Das Dokument sagt es nirgends; der Beleg steht im Fehlerkatalog (Kapitel H.25):
  `W4` lautet „Leerzeile gefunden" — eine Leerzeile setzt zeilenweises Lesen
  voraus. Damit ist auch „Die Übermittlung erfolgt in variabler Satzlänge"
  (C.1) aufgelöst: variabel **innerhalb** eines Bestands.
- **Vorlauf- und Schlusssatz** tragen die größte im Bestand vorkommende
  Satzlänge, **jeder Datensatz seine eigene**. ELDA hat das Satz für Satz
  bestätigt und die erwarteten Längen wörtlich genannt (mBGM: `PS`/`PE` 305,
  `G1` 326, `T1` 42, `BS` 33, `V1` 42) — sie stimmen mit den Feldtabellen
  dieses Pakets überein.
- Encoding **ISO-8859-15**: Kapitel C.2 führt es als Standard für Eingabedaten
  („Fixlängen-Dateien"). Der Dateiheader (C.1.1) ist damit entbehrlich.

**Kapitel H.25 „ELDA-FC" ist die Fundstelle für alle `E`- und `W`-Codes der
Datenübernahme** — im DM-ORG selbst stehen sie nicht, sondern in einem eigenen
PDF (Kapitel H) auf elda.at. Wer eine Abweisung deuten muss, findet dort
`E1`–`E38` und `W1`–`W13` im Klartext.

Ebenfalls live beantwortet:

- Eine **leere Rücksendungsliste** kommt als leeres Array — kein Sonderfall auf
  dem Draht.
- `senden` liefert die **Protokollnummer bei jedem Ausgang** mit, auch bei
  Status `403`; bei `000` zusätzlich `dateiId` und `eldaZeitstempel`.
- Zu **einer** angenommenen mBGM stellt ELDA **zwei** Rücksendungen ein: ein
  `mitteilung_<protokollnummer>.xml` (Status je Satz, Schema
  `elda_mitteilung-3.0.xsd`) und ein Klartext-Protokoll `mbd_<protokollnummer>_<bknr>`
  mit Beträgen, Beschäftigtengruppe und Verrechnungsbasis. Wer nach der ersten
  aufhört, verliert die zweite — beide tragen die Protokollnummer der Sendung im
  Dateinamen.
- Die `md5`-Prüfung gegen die **dekodierten Bytes** hält: drei abgeholte
  Rücksendungen sind ohne `MD5-Abweichung` durchgelaufen.

Auf der SIT-Plattform beantwortet (Oktober 2026, siehe „Was die SIT-Plattform
gezeigt hat"): `<messages>` kommt **mehrfach** vor — eine Fehlerantwort trägt
den Text und daneben `requestId:<Base64>`; `LF` als Satztrenner wird dort
**genauso angenommen** wie `CRLF`. Offen bleibt, ob `datei.dateiTyp` numerisch
kommt (so die Tabelle in Abschnitt 4.2) oder als Text wie `XML` (so die
Beispiel-Ausgabe in Abschnitt 7.4.3.3 desselben Dokuments — das Dokument
widerspricht sich hier selbst, deshalb reicht dieses Paket den Wert unverändert
als `string` durch).

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

Der **Meldungsbau** (Abschnitt „Meldungen erzeugen" unten) ist je Meldungsart
unterschiedlich weit belegt:

| Meldungsart | Bestand | Gegen ELDA gelaufen |
| ----------- | ------- | ------------------- |
| Versichertenmeldung reduziert (E.29) | `VR` | SIT-Plattform, Oktober 2026 |
| Monatliche Beitragsgrundlagenmeldung (E.32) | `MB` | Produktion seit 05.08.2026, SIT-Plattform |
| VSNR-Anforderung (E.30), Adresse Versicherter (E.31) | `VS`, `AV` | nein — SIT-Fälle angelegt |
| Familienhospizkarenz/Pflegekarenz (E.12), Schwerarbeitsmeldung (E.22) | `FH`, `SM` | nein — SIT-Fälle angelegt |
| Antrag auf zwischenstaatliche Bescheinigung (E.27) | `ES` | nein — SIT-Fälle angelegt; ob die SIT `ES` verarbeitet, ist unbelegt |
| Lohnzettel Finanz (E.13/E.14) | `LF` | nein — die SIT verarbeitet `LF` nicht, nur der Kundentest |

Was nicht gelaufen ist, stützt sich auf die Feldtabellen, Pflichtmatrizen und
Prüfkataloge — und, wo das Dokument welche abdruckt, auf dessen Beispiele. Bei
E.29 sind das die 28 durchgerechneten Beispiele aus Kapitel E.29.2 der
Organisationsbeschreibung (`beispiele-e29.test.ts`) — jede dort abgedruckte
Wert-Tabelle ist als Test erfasst und ausschließlich mit den im Dokument
genannten Werten bestückt. Eine Fehldeutung der Spezifikation, die bereits im
Dokument selbst durchgerechnet ist, würde also auffallen; eine Fehldeutung an
einer Stelle, die keines der 28 Beispiele berührt, bliebe dagegen unentdeckt.

Die früher offenste Stelle — ob die Sätze eines Bestands ohne Trenner
aneinandergereiht erwartet werden — ist seit August 2026 beantwortet (siehe
„Reifegrad"): Sätze werden durch `CRLF` getrennt, jeder in seiner eigenen
Länge; die SIT-Plattform nimmt auch `LF` an. Weiter ungeklärt: ob
MTOM/XOP-Fragen
aus der Transport-Schicht (siehe oben) sich auf einen Meldungsbestand als
Anhang genauso auswirken; und ob die in diesem Paket ergänzte Regel zu `REFV`
(fehlt die VSNR bei Abmeldung, Änderungsmeldung oder Richtigstellung Anmeldung,
muss neben dem Geburtsdatum auch `REFV` belegt sein, siehe unten) tatsächlich
so von ELDA durchgesetzt wird — sie ist aus Kapitel E.30.2 abgeleitet, aber in
keinem der 28 Beispiele belegt: Alle 28 geben durchweg die VSNR an, keines
prüft den Fall „VSNR fehlt" durch.

### Der Live-Check gegen den Kundentest

Für genau diese offenen Punkte liegt im Repository ein Live-Check
(`test/live/live-check.js`, `npm run test:live` — **nicht** Teil von
`npm test`). Er läuft gegen den echten ELDA-Kundentest, wird ausschließlich über
Umgebungsvariablen gesteuert und übersprungen, solange keine Zugangsdaten
gesetzt sind. Standardmäßig ruft er nur `ruecksendungenAuflisten` auf, weil das
nichts verändert; `senden` (legt echte Daten im Konto an) und `empfangen`
(verbraucht die Rücksendung endgültig) laufen je nur nach einer eigenen,
ausdrücklichen Freigabe. `empfangen` holt dabei ausschließlich die Rücksendung
zur eigenen Sendung aus demselben Lauf oder eine ausdrücklich genannte
Protokollnummer — nie einen Eintrag aus der abgefragten Liste, denn der wäre
fast sicher ein fremdes Verarbeitungsprotokoll und nach dem Abholen für dessen
Empfänger verloren. Ein Befund gilt zudem nur dann als beantwortet, wenn der
zugehörige Aufruf wirklich gelungen ist; sonst steht dort „Frage offen" samt
Status. Der Kopf des Skripts nennt alle Variablen.

## Installation

```bash
npm install @kreiseck/elda
```

Node ≥ 20.18.

## Zugangsdaten und Umgebungen

Für `createEldaTransfer` werden drei Zugangsdaten benötigt:

- **Seriennummer** — vergeben bei der ELDA-Registrierung.
- **Kundenpasswort** — entweder als `kundenpasswort` im Klartext (wird intern zu
  SHA-512 hex lowercase gehasht, wie von ELDA gefordert) **oder** als fertiger
  Hash `kundenpasswortHash`. Genau eines von beiden, siehe unten.
- **API-Key** — separat **bei ELDA anfordern**, unabhängig von Seriennummer/Kundenpasswort.

Diese Felder sind Pflicht: Fehlt eines oder ist es leer, wirft
`createEldaTransfer` bereits beim Bauen einen `EldaError` — ohne diese Prüfung
würde ELDA jeden Aufruf nur mit einem kryptischen Status `558` beantworten.

### Nur den Hash speichern, nicht das Passwort

Auf die Leitung geht ausschließlich der SHA-512-Hash des Kundenpassworts; das
Klartextpasswort wird nach der Eingabe nie wieder gebraucht. Wer Zugangsdaten
dauerhaft ablegt — etwa ein Mandantensystem, in dem der Kunde seine ELDA-Daten
einmal einträgt —, sollte deshalb **nur den Hash** ablegen und ihn als
`kundenpasswortHash` übergeben. Bei einem Einbruch in den Datenbestand ist dann
zwar der ELDA-Zugang kompromittiert, nicht aber das Passwort des Kunden selbst,
das erfahrungsgemäß anderswo wiederverwendet ist.

Gehasht wird an der Eingabestelle mit `hashKundenpasswort` — dieselbe Regel, die
der Client intern anwendet:

```ts
import { createEldaTransfer, hashKundenpasswort } from '@kreiseck/elda';

// einmal bei der Eingabe: nur das Ergebnis speichern, nicht das Passwort
const kundenpasswortHash = hashKundenpasswort(eingabeAusDemFormular);

// später bei jedem Aufruf
const elda = createEldaTransfer({
  seriennummer,
  kundenpasswortHash, // statt kundenpasswort
  apiKey,
  umgebung: 'produktion',
});
```

`kundenpasswort` und `kundenpasswortHash` schließen einander aus: Genau eines von
beiden muss gesetzt sein, sonst wirft `createEldaTransfer` (auch aus JavaScript
heraus, nicht nur beim Übersetzen). Der Hash wird zudem auf seine Form geprüft —
genau 128 Hexziffern in Kleinschreibung. Ein abgeschnittener oder
großgeschriebener Digest fällt damit sofort auf und nicht erst als ELDA-Status
`558`, der von einem echten Passwortfehler nicht zu unterscheiden wäre.

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

Beobachtet auf der SIT-Plattform (Oktober 2026):

- `551` heißt wörtlich „created älter als **60 Sekunden**". Geht die Uhr des
  Rechners mehr als eine Minute falsch, scheitert jeder Aufruf damit — der
  Zeitstempel wird bei jedem Aufruf neu gesetzt, das Problem ist die Uhr.
- Ein leeres `created` beantwortet ELDA nicht mit `555`, sondern mit einem
  SOAP-Fault „Ungueltiger Request: java.lang.IllegalArgumentException"
  (`FonSoapFaultError`).
- `500` kam dort bei `ruecksendungenAuflisten` mit **leerer** Outbox — laut
  ELDA ein Fehler der SIT, behoben mit der Testversion Oktober 2026, in
  Produktion nicht vorhanden. Die Antwort trug neben dem Text eine zweite
  `<messages>` mit `requestId:<Base64>`; darin stehen eine UUID, die
  Seriennummer und eine Zahl — wer Mitschnitte speichert, schwärzt sie.
- `405` (Duplikat) kam **nie**: Dieselbe Datei, byte-gleich mit derselben
  Datenträgernummer und denselben Referenzwerten, wurde zweimal mit `000`
  angenommen, und auch das Clearing meldete nichts. Gegen Doppelversand schützt
  sich der Absender selbst.
- `559` kam nie: ELDA nimmt die Anfrage auch mit `Content-Type: application/xml`
  an.

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
zweiter Versuch liefert nur noch `bereitsEmpfangen` — ohne die Datei. Auf der
SIT-Plattform belegt (07.10.2026): Ein zweites `empfangen` derselben
Protokollnummer antwortet mit `408` „Rücksendung … wurde bereits abgeholt."
Wer eine Rücksendung verliert, findet sie danach nur noch in ELDA-Online.

## Rücksendungen lesen

Zu jeder angenommenen Sendung stellt ELDA **nach wenigen Sekunden** zwei
Rücksendungen ein, eine je Sendung, nicht je Meldung:

| Datei | Art | Inhalt |
|---|---|---|
| `mitteilung_<Protokollnummer>.xml` | `mitteilung` | ob ELDA die Meldungen **formal** übernommen hat — je Bestand und je Meldung (Referenznummer, Zeile) |
| `mbd_<Protokollnummer>_<Beitragskontonummer>` | `protokoll` | dasselbe als Klartext-Protokoll (ISO-8859-15) mit Beträgen, Beschäftigtengruppe, Verrechnungsbasis; bei der Versichertenmeldung zusätzlich eine Bestätigung für Dienstgeber und Dienstnehmer |
| `cm_<Nummer>.xml` | `clearing` | **erst nach der fachlichen Verarbeitung** beim Träger, wenn etwas zu klären ist: Clearing-Datensatz 2.0 |

```ts
import { artDerRuecksendung, liesMitteilung, liesClearing, MELDUNG_STATUS } from '@kreiseck/elda';

const art = artDerRuecksendung(eintrag.dateiName);
const datei = (await elda.empfangen(eintrag.protokollnummer)).datei; // vorher sichern!

if (art.art === 'mitteilung') {
  const m = liesMitteilung(datei.inhalt);
  // m.status 'uebernommen' | 'teilweise_uebernommen' | 'nicht_uebernommen' | 'offen'
  for (const meldung of m.meldungen) {
    for (const c of meldung.codes) console.log(meldung.referenznummer, c.typ, c.code, c.text);
  }
}
if (art.art === 'clearing') {
  for (const fall of liesClearing(datei.inhalt)) {
    const status = fall.meldung.inhalt?.meldungStatus; // 'VA' → MELDUNG_STATUS.VA = 'verarbeitet'
    for (const info of fall.meldung.inhalt?.informationen ?? []) {
      console.log(fall.referenzwert, info.code, info.text); // z. B. VW1942 „Die Abmeldung wurde nicht verarbeitet …"
    }
  }
}
```

**`uebernommen` heißt nicht „verarbeitet".** Die Mitteilung sagt nur, dass ELDA
die Meldung formal angenommen hat. Ob der Träger sie fachlich verarbeitet hat,
steht allein im Clearing — eine Abmeldung kam auf der SIT als `uebernommen`
zurück und einen Tag später als Clearingfall `VW1942` „nicht verarbeitet".
Wer nur Mitteilungen auswertet, zeigt Meldungen als erledigt an, die es nicht
sind.

**Zuordnung.** Mitteilung und Protokoll tragen die Protokollnummer der eigenen
Sendung im Dateinamen — dafür ist `findeRuecksendung` da. Ein Clearing-Datensatz
trägt dagegen seine **eigene** Nummer; er gehört über `Dialogfall.referenzwert`
zu einer Meldung (dem `REFW`, mit dem sie gesendet wurde). Clearingfälle, die
der Träger selbst anlegt (Mahnung, mBGM von Amts wegen), tragen einen internen
Referenzwert und keinen der eigenen Meldungen.

**Clearing-Datensatz 2.0.** Je Datei eine `dialogfallListe` mit bis zu 1000
Dialogfällen; jeder trägt die Meldungsinfo und einen Base64-kodierten Inhalt
(`MVB_CLEARING_2_0_0`) mit Status und einer oder mehreren
Clearing-Informationen. `liesClearing` dekodiert ihn; eine andere
Inhaltsversion bleibt roh in `meldung.inhaltRoh`. Die Bedeutungen:

| Feld | Werte |
|---|---|
| `zustellungsgrund` | `M` gemeldet, `U` urgiert, `O` obsolet gesetzt |
| `dringlichkeit` | `D` dringend, Handlung nötig · `K` Kontrollfall, Meldung kontrollieren · `N` nicht dringend |
| `meldungStatus` | `NV` nicht verarbeitet · `IA` in Arbeit · `VA` verarbeitet · `ST` storniert |
| `meldungStatusZusatz` | Selbstabrechnung: `NB` nicht verbucht, `OB` noch nicht verbucht, `VB` verbucht, `TB` teilweise verbucht · Vorschreibung: `NV`, `OV`, `VV` (Verrechnung nicht / noch nicht / möglich) |

Den Rückfragetext liefert der Datensatz selbst (`informationTextFachsystem`),
die eingesetzten Werte stehen in `daten`. Die vollständige Liste aller Codes
samt Dringlichkeit und empfohlener Handlung führt die ÖGK als Excel-Datei
(„SV-Clearing-Rückmeldungen"); dieses Paket liefert sie nicht mit, weil sie
sich ändert. Quellen: ÖGK, [SV-Clearingsystem:
Clearing-Datensatz](https://www.gesundheitskasse.at/cdscontent/?contentid=10007.905521&portal=oegkdgportal)
(XML-Schemas, Beispiele, Code-Liste); DM-Org Kapitel J.

**Mitteilung.** `liesMitteilung` folgt dem Schema `elda_mitteilung-3.0.xsd`
(ELDA, Downloads für Dienstgeber, „Mitteilungsfiles"; die `schemaLocation` in
der Datei selbst ist nicht abrufbar). Das Schema kennt vier Werte für den
Status der Sendung (`MITTEILUNG_STATUS`):

| `status` | Bedeutung laut Schema |
|---|---|
| `uebernommen` | alle Meldungen übernommen |
| `teilweise_uebernommen` | mindestens eine Meldung nicht übernommen — die nicht übernommenen korrigiert neu senden |
| `nicht_uebernommen` | keine Meldung übernommen, etwa weil der Projektcode nicht erkannt wird oder der Bestand in einer ungültigen Version kommt |
| `offen` | ELDA hat die Datei empfangen, die Verarbeitung ist aber noch nicht abgeschlossen — **eine weitere Mitteilung folgt** |

Je Meldung stehen `status` (`uebernommen` / `nicht_uebernommen`),
Referenznummer, Zeilennummer (Leerzeilen zählt ELDA nicht mit) und die `codes`
mit `code` (z. B. `E17`), `text` (der fertige Fehlertext), `typ` (`fehler` /
`warnung`) und `zeilennummer`. Codes, die keiner Meldung zuzuordnen sind — das
Schema nennt `E17`, Mehrfachübermittlung einer Datei —, stehen in
`Mitteilung.codes`. Den Klartext aller `E`-/`W`-Codes führt Kapitel H.25
„ELDA-FC". Elemente außerhalb des Schemas landen in `weitere`. Auf der SIT kam
bisher nur `uebernommen`; Codes und die anderen Status sind nach dem Schema
gelesen, nicht beobachtet.

## Was die SIT-Plattform gezeigt hat

Die Systemintegrationstest-Plattform der Sozialversicherung (SIT) verarbeitet
Meldungen wie die Produktion, mit synthetischen Testdaten und einer
„Zeitreise" über simulierte Monate. Ein Testzyklus vom 05. bis 07.10.2026 mit
Versichertenmeldungen und mBGM hat Folgendes gezeigt — was dort beobachtet ist,
muss für die Produktion nicht ebenso gelten:

- **Rücksendungen kommen sofort**, nicht erst nach der Verarbeitung: Mitteilung
  und Protokoll lagen nach unter einer Minute bereit. Clearing kam erst nach
  der Sammelverarbeitung (in der Produktion: dem täglichen Datenpaket an den
  Träger).
- **Fehlt die mBGM**, mahnt der Träger je Beitragskonto und Monat (`BW1930`,
  dringend) und erstellt die mBGM **von Amts wegen** — nur für den Bereich SV
  (`BW1916`). Eine Betriebliche Vorsorge legt die amtswegige mBGM nicht an.
- Eine **Abmeldung mit BV-Ende**, zu der keine BV-Zeit gespeichert ist, kommt
  als `VW1942` (dringend, Status `IA` in Arbeit) zurück; die Code-Liste der ÖGK
  nennt als Handlung „Richtigstellung der Abmeldung". Im einen Fall lag das
  BV-Ende **vor** dem Anmeldedatum — ein Fehler der Testdaten. Im anderen
  endete die Beschäftigung mit dem ersten Monat, und für diesen Monat war keine
  mBGM gesendet (die amtswegige mBGM des Trägers umfasst nur die SV). Welcher
  der beiden Umstände die BV-Zeit verhindert hat, ist offen.
- Eine **mBGM für Monate vor der Anmeldung** wird übernommen und verbucht; der
  BV-Teil aber nicht: `BW1871` (dringend) „keine entsprechende
  Versicherungszeit BV vorhanden. Die Grundlage … wurde nicht gespeichert."
  Andere Codes zur fehlenden Versicherungszeit kamen nicht.
- `BVAB` gehört **nicht** in jede Anmeldung: Laut DM-Org (E.29.2, „Anmeldung
  zur Betrieblichen Vorsorge ohne Sozialversicherungszeit") ist es nur dann
  anzugeben, wenn eine BV-Zeit ohne SV-Zeit gemeldet wird. Die Anmeldungen der
  SIT trugen kein `BVAB`; das war nicht die Ursache der fehlenden BV-Zeit.
- **Lehrlinge** mit der allgemeinen AV-Minderung `A01`–`A03`: `BW1838`
  (Kontrollfall) und `BW1850` (Beitragssumme weicht ab) — die Meldung wird
  verarbeitet und verbucht, aber zu niedrig; Handlung „ggf. Storno und
  Neumeldung". Richtig sind `A04`/`A05`. Dazu kommt `BW1842` (nicht dringend):
  „Der Abschlag Minderung AV auf 0% (Lg.) wäre für die gemeldete
  Verrechnungsbasis … möglich". `pruefeMbgmPaket` meldet die falsche Minderung
  seither als Fehler `BW1838` (siehe „Prüfung der mBGM").
- **Rundung auf den Cent:** `BW1917` (nicht dringend) „Zur Verrechnungsposition
  Standard-Tarifgruppenverrechnung (T01) wurde im Unterschied zum gemeldeten
  Beitrag € 270,27 der Beitrag in der Höhe von € 270,28 verbucht." Gemeldet war
  eine Beitragsgrundlage von € 950,00 bei 28,45 %, also genau € 270,275. Der
  Träger rundet kaufmännisch auf — so verlangt es D.62 („kaufmännisch gerundet
  auf zwei Nachkommastellen"). In JavaScript ergibt `0.2845 * 95000`
  `27027.499999999996`, und `Math.round` macht daraus 27027 Cent. Wer Beiträge
  berechnet, muss in ganzen Zahlen rechnen (Tausendstelprozent × Cent) und erst
  dann runden: `berechneBeitragCent(95000, 28.45)` liefert 27028.
  `pruefeMbgmPaket` meldet solche Abweichungen seither als Warnung `DM-D.62`.
- Eine **verspätete mBGM** (nach dem 15. des Folgemonats) wurde angenommen und
  verarbeitet; einen eigenen Clearing-Code für die Verspätung gab es nicht.
- **Formal nicht geprüft** wurden dort: der Projektcode (`DM` statt `TM` wurde
  angenommen), das Erstellungsdatum gegen das simulierte Datum, der
  Content-Type und Duplikate (siehe „Status-Codes").

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
  geprüft — das ist die Lesart dieses Clients, siehe Vorbehalt oben, wonach die
  Schnittstellenbeschreibung offenlässt, worüber die Prüfsumme tatsächlich
  gebildet wird.

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

Seit 0.5.0 ist belegt, dass ELDA **immer** MTOM antwortet. Der Client packt die
mehrteilige Antwort aus (`src/mtom.ts`) und löst `<xop:Include>` gegen den
zugehörigen Teil auf; inline-Base64 bleibt daneben unterstützt, weil beide
Formen im selben Feld stehen können. Der Sendepfad selbst — ob ELDA eine
inline-Base64-Sendung annimmt — ist mangels gültigem Zugang noch nicht gegen die
echte Gegenstelle verifiziert.

## Meldungen erzeugen

Seit Version 0.3.0 baut dieses Paket zusätzlich zur Transport-Schicht auch die
eigentlichen Meldungssätze der **Versichertenmeldung reduziert** (Kapitel E.29
der Organisationsbeschreibung, Satzstruktur-Version 03, zwingend ab
01.02.2026): An-/Abmeldung, Änderungsmeldung, Richtigstellungen und Stornos.
Ein Builder liefert einen `RohSatz`; `erstelleBestand` klammert beliebig viele
`RohSatz` zu einem vollständigen, ISO-8859-15-kodierten Datenbestand
(Vorlaufsatz, Meldungssätze, Schlusssatz), der unverändert als `inhalt` an
`senden` geht.

Die monatliche Beitragsgrundlagenmeldung hat dafür eine eigene Funktion:
`erstelleMbgmPaket` baut die Satzfolge, `erstelleMbgmBestand` klammert sie.
Beide Klammer-Funktionen setzen die **Bestandsbezeichnung** (Feld `BEST`)
selbst — `VR` für die Versichertenmeldung, `MB` für die mBGM. Kapitel B.3 führt
jede Verarbeitung unter eigener Bezeichnung, und Kapitel C.1 hält fest, dass ein
Datenbestand Daten „zu einer Verarbeitung" enthält: Die Bezeichnung ist keine
Aufschrift, sondern die Adresse. Sie ist deshalb kein Aufrufer-Parameter, und
die beiden Meldungsarten lassen sich nicht im selben Bestand mischen.

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

**Und beim Klammern:** `erstelleBestand` verlangt, dass kein Referenzwert
(`REFW`) zu derselben Beitragskontonummer zweimal vorkommt (Kapitel D.43). Ein
doppelter Referenzwert ließe eine spätere Richtigstellung oder ein Storno auf
zwei Meldungen zugleich zeigen. Kapitel C.1.2 nennt Satzlängen und Satzanzahl
als die ersten Prüfungen, die ELDA bei der Übernahme fährt; ein Fehler dort
weist die gesamte Sendung zurück.

**Satzlängen dürfen sich innerhalb eines Bestands unterscheiden.** Kapitel E.2
(Seite 175): „Die Satzlänge des Vorlaufsatzes entspricht der Satzlänge der
nachfolgenden Datensätze. Hinweis: Bei Beständen mit Datensätzen
unterschiedlicher Satzlängen kommt die Satzlänge jenes Datensatzes zur
Anwendung der die maximal mögliche Satzlänge im Bestand aufweist."
`erstelleBestand` setzt das genau so um: Vorlauf- und Schlusssatz werden über
ihr Reserve-Feld auf die größte im Bestand vorkommende Satzlänge aufgefüllt,
jeder Datensatz behält seine eigene. Bei der Versichertenmeldung (Kapitel E.29)
fällt das nicht auf, weil dort alle Sätze 772 lang sind; beim Lohnzettel Finanz
ist es der Regelfall — ein Informationssatz (Satzart `I1`, Satzlänge 1100) vor
Mitteilungssätzen (Satzart `L1`, Satzlänge 3500).

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
  entscheiden lässt. Seit dem Prüfkatalog zur 43. Ergänzung sind beide nur noch
  Warnungen (Status `W`).
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

### Prüfung der mBGM

`erstelleMbgmPaket` wirft bei allem, was sich beim Bau entscheiden lässt
(Pflichtfelder, zulässige Verrechnungspositionen je Basis nach D.60,
Höchstanzahlen). `pruefeMbgmPaket(saetze)` prüft das fertige Paket und liefert
Befunde mit `schwere: 'fehler' | 'warnung'` — ein Fehler heißt: so nicht
senden.

| Code | Prüft |
| ---- | ----- |
| `F9000`, `F9070` | Aufbau des Pakets (Kopf, Ende, Satzfolge; Abfolgeregeln aus E.32.2.2.6, auch einzeln als `pruefeAbfolge`) |
| `F9010`, `F9020` | Beitragskontonummer und Dienstgebername belegt |
| `F9030`, `F9031`, `F9040`, `F9050`, `F9051`, `F9060` | Felder des Pakets laut Prüfkatalog |
| `F9072` | Höchstanzahl der Sätze je Art (Warnung) |
| `FAK-3.1.11` | mehr als ein Tarifblock bei regelmäßiger Beschäftigung (Warnung) |
| `BW1838` | Lehrlinge (`B044`, `B045`) mit der allgemeinen AV-Minderung `A01`–`A03` statt `A04`/`A05` (Fehler; Tarifsystem, Clearing auf der SIT) |
| `DM-D.62` | Beitrag jeder Verrechnungsposition `V1` = Verrechnungsbasis × Prozentsatz, kaufmännisch auf den Cent gerundet (Warnung; nur Selbstabrechnung) |

**Beiträge nachrechnen (D.61, D.62, E.32.2.2.5).** Der Beitrag einer Position
ergibt sich „durch Multiplikation des Verrechnungsbasis-Betrags … mit dem
Prozentsatz … unter Berücksichtigung des Vorzeichens (Datenfeld VPVZ),
kaufmännisch gerundet auf zwei Nachkommastellen" — je Position, nicht über eine
Summe. `berechneBeitragCent(basisCent, prozentsatz)` rechnet das in ganzen
Zahlen. Die Prüfung rechnet nur nach, was in der Meldung steht; ob der
Prozentsatz zur Tarifgruppe passt, weiß sie nicht (`BW1850`), denn die Sätze
des Tarifsystems liefert das Paket nicht mit. Alle 40 Beispiele des Kapitels
E.32.2 bestehen die Nachrechnung.

**AV-Minderung ab 2027 (43. Ergänzung, D.60, Seite 152).** Für die Minderung
der AV bei geringem Einkommen zählt ab 01.01.2027 der Beginn des
Dienstverhältnisses: Für zum 31.12.2026 aufrechte Dienstverhältnisse gelten
die Abschläge „Mind. AV (ALT)" (`A01`–`A04`, bisher „Minderung AV auf 2 % / 1 %
/ 0 % / 0 % (Lg.)"), für danach beginnende „Mind. AV (NEU)" (`A25` Bereich 1,
`A26` Bereich 2, `A27` Bereich 1 (Lg.)). `A05` gilt nur bis 31.12.2026. Alle
tragen laut Dokument ein Gültigkeitsende (`VPTY_CODES[…].einschraenkung`). Den
Beginn des Dienstverhältnisses enthält die mBGM nicht; die Wahl zwischen ALT
und NEU trifft der Aufrufer, das Paket prüft sie nicht. Die Einkommensgrenzen
der Bereiche stehen nicht in der DM-Org.

`pruefeBeitragskontonummer(bknr, traeger)` prüft die Länge der
Beitragskontonummer gegen den zuständigen Träger (`F9012`–`F9019`,
`F9080`–`F9082`); der Träger geht aus der Meldung nicht hervor. Seit der 43.
Ergänzung ist bei allen ÖGK-Landesstellen auch die 10-stellige Form gültig
(D.5); ab 01.02.2027 vergibt die ÖGK nur mehr 10-stellige Nummern. Den Katalog der
Tarifgruppen liefert das Paket bewusst nicht mit — er ändert sich laufend
(siehe `codes-e32.ts`).

### VSNR-Anforderung und Adresse Versicherter

Zwei Meldungen mit je einer Satzart und einem eigenen Bestand:

| Builder | Satzart | Bestand | Kapitel | Satzlänge |
| ------- | ------- | ------- | ------- | --------- |
| `vsnrAnforderung` → `erstelleVsnrAnforderungBestand` | `VS` | `VS`, Version `01` | E.30 | 688 |
| `adresseVersicherter` → `erstelleAdressmeldungBestand` | `AV` | `AV`, Version `01` | E.31 | 416 |

Beide Kapitel sind in der 42. und 43. Ergänzung wortgleich (Seiten 329–336
bzw. 340–347). Die Builder prüfen die Pflichtstufen aus E.30.1/E.31.1 — ein
leeres Pflichtfeld trägt den Code, mit dem der Prüfkatalog es abweist — und die
Katalogregeln mit Status `N`, die sich aus den Feldwerten entscheiden lassen.
Ein Bestand nimmt nur Sätze seiner eigenen Satzart auf (Kapitel C.1).

**VSNR-Anforderung (E.30.2, Seite 343).** Hat eine anzumeldende Person noch
keine Versicherungsnummer, fordert der Dienstgeber eine an — vorab oder
spätestens zeitgleich mit der Anmeldung. Die Anmeldung geht als eigener
`VR`-Bestand, mit Geburtsdatum statt VSNR und dem Referenzwert der Anforderung
in `REFV`:

```ts
const vs = vsnrAnforderung({
  REFW: 'VS-2026-0001',
  BKNR: '4711815',
  DGNA: 'Bäckerei Kornblum',
  GEBD: '14031998',
  FANA: 'Weinzierl',
  VONA: 'Mirela',
  GESL: '2',
  STSL: 'AUT',
  WKFZ: 'A',
  PLZL: '5020',
  WORT: 'Salzburg',
  WSTR: 'Musterweg',
  WHNR: '1',
});
const m3 = anmeldung({
  REFW: 'M3-2026-0001',
  BKNR: '4711815',
  DGNA: 'Bäckerei Kornblum',
  GEBD: '14031998',
  REFV: 'VS-2026-0001',
  FANA: 'Weinzierl',
  VONA: 'Mirela',
  ADAT: '12102026',
  BBER: '02',
  GERF: 'N',
  FRDV: 'N',
  VWAZ: wochenarbeitszeit(40),
});
await elda.senden({ dateiName: 'vs.dat', inhalt: erstelleVsnrAnforderungBestand([vs], opt) });
await elda.senden({ dateiName: 'vr.dat', inhalt: erstelleBestand([m3], opt) });
```

Die vergebene Nummer kommt laut E.30.2 „über das externe Clearingsystem mit dem
Referenzwert der VSNR – Anforderung" zurück (`liesClearing`); danach gilt für
alle weiteren Meldungen die VSNR (D.45). Ist die Nummer nur unbekannt, aber
vergeben, kann sie im WEB-BE-Kunden-Portal abgefragt werden.

Geprüft werden:

| Code | Prüft |
| ---- | ----- |
| `F6500`–`F6586` (leer) | Pflichtfelder laut E.30.1; `F6520` (Dienstgebername) steht nur auf dem Blatt `FC-Texte` |
| `F6531` | Geburtsdatum `TTMMJJJJ`, `00MMJJJJ` oder `0000JJJJ` |
| `F6541`, `F6551` | Familien- und Vorname gegen die „Prüfvorschriften" aus D.8/D.9: zulässige Zeichen, vor jedem Sonderzeichen ein Buchstabe, nach Bindestrich (und beim Familiennamen Hochkomma) ein Buchstabe, Punkt im Familiennamen nur an letzter oder vorletzter Stelle |
| `D.8` | dieselben Regeln für den früheren Familiennamen `FNA1`; der Katalog prüft ihn nicht |
| `F6562` | Geschlecht 1, 2, 3, 4, 6 oder 7 (Feldtabelle E.30) |
| `F6571` | Staatsangehörigkeit als ISOA3-Code der Staatencode-Tabelle (`STAATEN`, Stand 22.04.2026) |
| `F6512` | beim Träger ÖGK-V keine Beitragskontonummer mit führendem Leerzeichen (beim Bau des Bestands) |

Die Groß- und Kleinschreibung der Namen prüft das Paket nicht: D.8 nennt
Ausnahmen (Vorsilben, nachgewiesene Großschrift), die sich aus dem Namen nicht
entscheiden lassen.

**Adresse Versicherter (E.31.2.1, Seite 346).** An die ÖGK geht die Meldung
**nur für einen ausländischen Hauptwohnsitz** — inländische Adressen holt die ÖGK
aus dem zentralen Melderegister. Pflicht ist sie bei der ersten Beschäftigung mit
bekannter VSNR, bei einer Wiederanmeldung mit neuem Wohnsitz im Ausland und bei
einem Umzug ins Ausland während des Dienstverhältnisses; nicht nötig, wenn eine
VSNR-Anforderung die Adresse schon trägt.

| Code | Prüft |
| ---- | ----- |
| `F8000`–`F8070` (leer) | Pflichtfelder laut E.31.1 |
| `F8031` | Versicherungsnummer in der Form `LLLPTTMMJJ` (die Prüfziffer nicht) |
| `F8041` | `WKFZ` ist nicht `A` |
| `F8012` | wie `F6512` |

`STAATEN` und `STAATSANGEHOERIGKEITEN` geben die Staatencode-Tabelle der ÖGK
(elda.at, Downloads) als Daten heraus. Das KFZ-Kennzeichen des Wohnorts wird
nicht gegen sie geprüft: D.12 nennt „weitere KFZ-Kennzeichen" in einem
Verzeichnis, das nur den Versicherungsträgern zugänglich ist.

### Familienhospizkarenz/Pflegekarenz (Kapitel E.12)

Sieben Satzarten, Bestand `FH`, Version 03, Satzlänge 850 — als eigene
Builder, weil die Felder mit gleichem Namen andere Positionen haben als in der
Versichertenmeldung:

| Funktion | SART |
| -------- | ---- |
| `familienhospizAnmeldung` | 80 |
| `familienhospizAbmeldung` | 81 (bei Wiederantritt bzw. Ende der Karenzierung) |
| `familienhospizAenderungsmeldung` | 82 (berichtigt die Karenzart) |
| `familienhospizStornoAnmeldung` / `familienhospizStornoAbmeldung` | 83 / 84 |
| `familienhospizRichtigstellungAnmeldung` / `…Abmeldung` | 85 / 86 (`ADAT` alt, `RDAT` richtig) |

```ts
import { familienhospizAnmeldung, erstelleFamilienhospizBestand, KARENZART } from '@kreiseck/elda';

const satz = familienhospizAnmeldung({
  BKNR: '4711815',
  DGNA: 'Melisse Nails e.U.',
  VSNR: '7890030990',
  FANA: 'Lindmayr',
  VONA: 'Livia',
  GESL: '2',
  STSL: 'AUT',
  WKFZ: 'A',
  PLZL: '5020',
  WORT: 'Salzburg',
  STRA: 'Rosengasse 3/2',
  ADAT: '01032026', // Beginn der Karenz
  KART: KARENZART.PFLEGEKARENZ, // '04'
});
const inhalt = erstelleFamilienhospizBestand([satz], bestandOptionen);
```

Welche Meldung wann (E.12.2): Bei **Freistellung gegen Entfall des Entgelts**
nur Anmeldung (Karenzart 03, 04 oder 07) und bei Wiederantritt die Abmeldung —
alles Weitere am Versicherungsverlauf übernimmt der Krankenversicherungsträger.
Bei **Herabsetzung der Arbeitszeit** nur dann, wenn das reduzierte Entgelt
unter der Geringfügigkeitsgrenze liegt (Karenzart 05 oder 06); die Beiträge
laufen in beiden Teilzeit-Fällen unverändert über die mBGM. Für
**geringfügig Beschäftigte** gibt es keine Familienhospiz-Meldung. Eine
Referenz wie `REFU` kennt die Satzart nicht; Storno und Richtigstellung
nennen laut D.13 das `ADAT` der Meldung, auf die sie sich beziehen.

Geprüft wird beim Bau mit den Codes des Prüfkatalogs (Blatt `Allgemein` und
`FH`, nur Status N), danach die Pflichtmatrix aus E.12.1:

| Code | Prüft |
| ---- | ----- |
| `F0010`, `F0011` | Beitragskontonummer belegt, nur Buchstaben und Ziffern, nicht `NEU` |
| `F0020` | Dienstgebername belegt |
| `F0030`, `F0040`, `F0050` | Versicherungsnummer oder Geburtsdatum; Stellenfolge (D.6) bzw. Datum |
| `F0060`, `F0070` | Familien- und Vorname belegt |
| `F0080`, `F0082`, `F0090` | bei 80: Geschlecht (1, 2, 3, 4, 6, 7) und Staatsangehörigkeit belegt |
| `F0140`, `F0141`, `F0160`, `F0161` | `ADAT` und bei 85/86 `RDAT` belegt und gültig |
| `F3000`, `F3001` | Karenzart belegt und `01`–`07` (`KARENZART`) |
| `F3010`, `F3020` | bei 80: Entgelt vor der Karenz bei Karenzart 01/02, Entgelt während bei 02 |

Drei Zellen der Matrix fassen mehrere Felder zusammen (`FELDGRUPPEN_E12`):
`BKNR`/`DGNA` (beide einzeln zwingend, F0010 und F0020), `VSNR`/`GEBD` (eines
genügt, F0030) und bei der Anmeldung die Wohnanschrift `WKFZ`/`PLZL`/`WORT`/
`STRA`. Für die Anschrift prüft der Katalog nur mit Warnungen (F0100–F0130);
erzwungen wird sie deshalb nicht.

### Schwerarbeitsmeldung (Kapitel E.22)

`schwerarbeitsmeldung` (SART 65) und `stornoSchwerarbeitsmeldung` (66), Bestand
`SM`, Version 02, Satzlänge 800. Ein Satz trägt die Tätigkeiten **eines
Kalenderjahres** für eine Person in bis zu 26 Blöcken (`TART`, `TVON`,
`TBIS`); das Paket verteilt die Liste `taetigkeiten` der Reihe nach.

```ts
import { schwerarbeitsmeldung, erstelleSchwerarbeitBestand, TAETIGKEIT } from '@kreiseck/elda';

const satz = schwerarbeitsmeldung({
  BKNR: '4711815',
  DGNA: 'Bäckerei Kornblum',
  DKFZ: 'A',
  DPLZ: '5020',
  DORT: 'Salzburg',
  DSTR: 'Mühlgasse 7',
  VSNR: '4563120581',
  GEBD: '12051981',
  FANA: 'Weinzierl',
  VONA: 'Mirela',
  JAHR: '2026',
  taetigkeiten: [{ art: TAETIGKEIT.SCHICHT_ODER_WECHSELDIENST, von: '0101', bis: '3006' }],
});
const inhalt = erstelleSchwerarbeitBestand([satz], bestandOptionen);
```

Die Tätigkeitsart ist die Ziffer von § 1 Abs. 1 der Schwerarbeitsverordnung
(`TAETIGKEIT`: 1, 2, 4, 5, 6). Zu melden ist laut E.22.2: Schicht- oder
Wechseldienst (Z 1) erst ab sechs Arbeitstagen im Monat mit Nachtarbeit
(6 Stunden zwischen 22 und 6 Uhr), Z 2, 4 und 5 erst ab 15 Arbeitstagen im
Monat; Z 3 nie, Z 6 freiwillig; bei geringfügiger Beschäftigung nichts. Laut
§ 5 Abs. 1 der Schwerarbeitsverordnung (BGBl. II Nr. 413/2019) gilt die
Meldepflicht für Männer ab dem vollendeten 40. und Frauen ab dem vollendeten
35. Lebensjahr, Frist ist **Ende Februar des Folgejahres**. Diese Bedingungen
kennt das Paket nicht — es baut, was es bekommt.

| Code | Prüft |
| ---- | ----- |
| `F0010`–`F0070` | wie bei der Familienhospiz-Meldung (ohne Geschlecht, Staatsangehörigkeit, Datum) |
| `F5500`, `F5501` | Tätigkeitsjahr belegt, `JJJJ` |
| `F5511_n`, `F5521_n` | Beginn bzw. Ende in Block `n` ist ein Tag (`TTMM`) im Tätigkeitsjahr |
| `F5530_n` | Block `n` unvollständig (nur ein Feld, nur Beginn oder nur Ende) oder Beginn nach Ende |
| `F5580_n` | Tätigkeitsart nicht 1, 2, 4, 5 oder 6 |

Strenger als der Prüfkatalog, weil die Matrix (E.22.1) es so verlangt:
Versicherungsnummer **und** Geburtsdatum sind beide zwingend, ebenso die
Anschrift des Dienstgebers (`DKFZ`, `DPLZ`, `DORT`, `DSTR`; im Katalog nur
Warnungen). Nicht geprüft werden Warnungen: Tätigkeitsart leer (`F5579`) und
überschneidende Zeiträume gleicher Tätigkeit (`F5581`).

### Antrag auf zwischenstaatliche Bescheinigung (Kapitel E.27)

Anträge auf Entsendung und auf Feststellung der anzuwendenden
Rechtsvorschriften gehen laut ÖGK ausschließlich über ELDA. Die ÖGK (bzw. die
BVAEB, bei der Telearbeit der Dachverband) entscheidet und stellt
gegebenenfalls die Bescheinigung PD A1 aus (E.27.3, Seite 304).

| Satzart | Antrag | Zuständig (VSTR) |
| ------- | ------ | ---------------- |
| `E1` | Entsendung in einen anderen Staat (EU/EWR/CH/GB) | ÖGK `11`–`19`, BVAEB-EB `05` |
| `E2` | Beschäftigung für einen Arbeitgeber in mehreren Staaten | ÖGK |
| `E3` | Beschäftigung für mehrere Arbeitgeber in mehreren Staaten | ÖGK |
| `E4` | Selbständige und unselbständige Tätigkeit in verschiedenen Staaten | ÖGK |
| `E5` | Entsendung in einen Staat mit bilateralem Abkommen | ÖGK |
| `EA` | Ausnahmevereinbarung grenzüberschreitende Telearbeit | Dachverband `99` |

```ts
import { randomUUID } from 'node:crypto';
import { antragZwischenstaatlich, erstelleEsBestand } from '@kreiseck/elda';

const antrag = antragZwischenstaatlich('E1', {
  UIDM: randomUUID(),
  VONA: 'Mirela', FANA: 'Weinzierl', GESL: '2', GEBD: '01011980', VSNR: '1234010180',
  STSL: 'AT', STRA: 'Musterstraße 1', WKFZ: 'AT', PLZL: '5020', WORT: 'Salzburg',
  dienstgeber: [{
    DGNA: 'Max Hollerer GmbH', BKNR: '4711815', VTBK: '15',
    DGSTR: 'Hauptplatz 3', DGKFZ: 'AT', DGPLZ: '8010', DGORT: 'Graz',
    DGWS: '04', BBEG: '01032027', BEND: '30062027',
  }],
  DGPS: 'J', AGSTAAT: 'DE', BFEST: 'N', ANABL: 'N', BUEL: 'N', ANFL: 'N',
});
const inhalt = erstelleEsBestand([antrag], { ...bestandOptionen, versicherungstraeger: '15' });
```

Der Satz ist 9028 Zeichen lang (Version 08, zwingend ab 01.02.2025) und hat
drei Wiederholungsblöcke: bis zu 5 Dienstgeber (`dienstgeber`), bis zu 3
selbständige Tätigkeiten (`selbstaendig`, nur E4) und bis zu 32 Arbeitsorte
(`arbeitsorte`, E2–E4 und EA). Im Satz heißen ihre Felder `DGNA_1`…`DGNA_5`
usw. — dieselbe Zählung wie in den Fehlercodes des Prüfkatalogs (`F7500_1`).
Statt eines Referenzwerts trägt der Antrag eine UUID (`UIDM`, Kapitel D.68);
das Storno (`stornoAntragZwischenstaatlich`, Meldeart `02`) verweist über
`UIDU` auf den Antrag und lässt alles andere in Grundstellung (E.27.2, neu in
der 43. Ergänzung).

Geprüft wird beim Bau:

- die Pflichtmatrix je Satzart (E.27.1/E.27.2) samt Blockanzahl: Dienstgeber
  bei E1, E2, E5 und EA genau einmal, bei E3 zwei- bis fünfmal; selbständige
  Tätigkeit nur bei E4; Arbeitsorte bei E2–E4 und EA mindestens einmal;
- die Regeln mit Status `N` aus dem Prüfkatalog 43.1.0.0, Blatt `ES` und
  `Allgemein`, mit ihrem Fehlercode in der Meldung — u. a. Staatenlisten aus
  Kapitel D.36 (`STAATEN_E1_BIS_E4`, `STAATEN_E5`; bei E1 nicht `AT`,
  F7611), Japan erst ab Beginn 01.12.2025 (F7527), `ANATJ = J` verlangt einen
  Arbeitsort in Österreich (F7650), Länge der Beitragskontonummer je
  beitragskontoführendem Träger (F0162–F0171), `NEU` als Beitragskontonummer
  nur bei E1, E2, E5 (F0011), `VTBK` 05 nur bei E1 (F7660/F7661), Pflicht von
  Beitragskontonummer und Träger bei Sitz in Österreich (F0183, F7661, F7664),
  Geschlecht 1, 2, 3, 4, 6, 7 (F0082), UUID-Form (F7662), Ländercodes von
  Wohnort, Dienstgeber und selbständiger Tätigkeit gegen die ISOA2-Spalte der
  Staatencode-Tabelle (`STAATEN`; F7616, F7506, F7562);
- im Bestand: der zuständige Träger passt zur Satzart (`99` nur und immer bei
  EA, Kapitel D.4; `05` nur bei E1, Fußnote 69) und keine UIDM kommt doppelt
  vor (F7634).

Nicht geprüft werden Regeln mit Status `W`, die Prüfziffer der
Versicherungsnummer, F7665 (EA-Antragsbeginn höchstens drei Monate zurück —
hängt vom Prüftag ab) und die Zeilen des Prüfkatalogs zu Feldern, die die
Version 08 nicht mehr hat (DGP, BKFZ, AGKFZ, BFRIST, BBEGIN, BZEIT, ANAT,
BSTAAT, STAB, STSTAAT, STEND, BART). Ein abgedrucktes Beispiel für E.27 gibt es
weder in der Organisationsbeschreibung noch auf den Seiten von ÖGK und ELDA;
die Tests arbeiten mit erfundenen Daten gegen Feldtabelle und Prüfkatalog.

### Lohnzettel Finanz (L16)

Der Jahreslohnzettel L16 geht über ELDA als Bestand `LF`: ein
**Informationssatz** (`I1`, Kapitel E.13, 1100 Zeichen) für den Arbeitgeber,
danach je Lohnzettel ein **Mitteilungssatz** (`L1`, Kapitel E.14, 3500
Zeichen). ELDA prüft die Sätze nach den Regeln des Finanzministeriums und
leitet sie weiter; Fehler kommen mit dessen Fehlercodes zurück (E.13.2). Die
Lohnzettel eines Jahres sind bis Ende Februar des Folgejahres zu übermitteln
(§ 84 Abs. 1 Z 2 EStG).

```ts
import { erstelleLohnzettelBestand, lohnzettelSaetze, pruefeLohnzettel } from '@kreiseck/elda';

const uebermittlung = {
  version: '28' as const, // Lohnzettel 2026
  jahr: 2026,
  arbeitgeber: {
    STNRA: '911234565', // Steuernummer samt Finanzamt, 9 Stellen
    ANAM: 'Bäckerei Kornblum',
    AADR: 'Musterweg 1',
    ALKZ: 'A',
    APLZ: '5020',
    AORT: 'Salzburg',
    GESA: 1, // Gesamtanzahl der Lohnzettel des Jahres
  },
  lohnzettel: [
    {
      felder: {
        REFN: 'DV-2026-0001', // je Arbeitgeber, Jahr und Dienstverhältnis eindeutig
        ARTL: '01', BELZ: '0101', ENLZ: '3112', SOZS: '3',
        AVLN: '1234', AGBD: '010180',
        ANAM: 'Weinzierl Mirela', AADR: 'Musterweg 1', ALKZ: 'A', APLZ: '5020', AORT: 'Salzburg',
        GESW: 'J', VOLL: 'J',
      },
      // Cent, ganzzahlig, mit Vorzeichen; das Vorzeichenfeld setzt der Bau
      betraege: {
        B210: 4_200_000, B220: 600_000, BIEB: 790_000, B225: 105_000, B230: 685_000,
        B245: 2_915_000, BIEL: 356_220, B260: 356_220,
      },
    },
  ],
};

const befunde = pruefeLohnzettel(lohnzettelSaetze(uebermittlung, new Date()), '28');
const datei = erstelleLohnzettelBestand(uebermittlung, bestandOptionen); // ohne versicherungstraeger
```

Was der Bau selbst setzt:

- **Zuständiger Versicherungsträger `94`** (Bundesrechenzentrum) im
  Identifikationsteil — D.4 lässt ihn nur für die Finanzsatzarten zu, der
  ELDA-Fehlerkatalog verlangt ihn (`W8`: „Wert muss 94 ( = BRZ) statt <v2>
  sein").
- **Lohnzettelversion** im Vorlaufsatz (Feld VERS). Sie ist für alle
  Finanzsatzarten eines Bestands einheitlich (B.3).
- `FSART`, `ARTD = LZ`, `STVE = 03`, `JAHR`, `ANZA`, und in jedem Lohnzettel
  `JALZ` und `STNRA` aus dem Informationssatz — der Prüfkatalog verlangt
  Gleichheit (`F1704`, `F9900`, `F9990`).
- `DTUE`/`ZTUE` aus dem Erstellungszeitpunkt, in Wiener Ortszeit und in allen
  Sätzen gleich (E.13: „Datum und Uhrzeit in den Mitteilungssätzen … müssen
  gleich dem Datum und der Uhrzeit im zugehörigen Informationssatz sein").
- Die **Vorzeichenfelder**: blank bei 0, sonst `+` oder `-` — `-` nur, wo die
  Feldtabelle es zulässt; sonst wirft der Bau.

**Zwei Versionen.** Version 28 (42. Ergänzung) gilt fachlich für Zeiträume ab
2024, Version 29 (43. Ergänzung) für Zeiträume ab 2027, zwingend ab
01.03.2027. Lohnzettel 2026 sind also Version 28. Version 29 lässt bei
`VIEL`, `VABL` und `V260` auch „-" zu, bringt Felder für Sachbezug Kfz 0,375 %,
Telearbeitsvereinbarung und Aktivitätsfreibetrag (§ 105a) und teilt den
Familienbonus Plus im Kinderblock in 100/50/25/75 % und variabel.

**Feldnamen** sind die der Feldtabelle. Wo das Dokument einen Namen mehrfach
vergibt, steht die Feldnummer dahinter: `REFN` ist Feld 11 (Referenznummer
Finanz), `REFN_175` die Referenznummer des Softwareherstellers, die in der
Rückantwort zurückkommt; Reservefelder heißen `RESE_51` usw. Die 15 Kinder
werden als Liste übergeben (`kinder: [{ KFAM, KVON, KSTAAT, KVSNR, … }]`) und
im Satz zu `KFAM_K1` bis `KFAM_K15`.

**Pflichtangaben.** Der Bau weist leere Pflichtfelder (`REFN`, `ARTL`, `BELZ`,
`ENLZ`, `AGBD`, Name und Anschrift) und belegte „keine Angabe"-Felder zurück.
Einige `Z`-Angaben der Tabelle E.14.1 lassen sich nicht durchsetzen: `FIND`
(das Feld erklärt einen Lohnzettel trotz Hinweis für richtig — „kann", nicht
„muss"), die Versicherungsnummer des Partners (nur bei
Alleinverdienerabsetzbetrag nötig, `F3101`) und numerische Felder, bei denen 0
ein gültiger Wert ist. Die Tabelle E.14.1 selbst schreibt sechs Feldnamen
anders als die Feldtabelle (`PGDB`, `BVSV`, `HTOA` …); maßgeblich ist hier die
Feldnummer.

**Prüfkatalog.** `pruefeLohnzettel` rechnet die Regeln des Prüfkatalogs L16
(Finanzministerium, Version 09 vom 17.02.2026, „für Lohnzettel mit Zeitraum ab
1.1.2026", elda.at) nach, deren Bedingung eindeutig ist — derzeit 208 von 333
Codes, aufgelistet in `L16_GEPRUEFT` und `L16_NICHT_GEPRUEFT`. Darunter die
Summenregeln (`F4800` KZ 230, `F6201` KZ 243, `F6401` KZ 245, `F7004` KZ 260),
die Einschränkungen je Lohnzettelart, Höchstbeträge, die Kinderblöcke (`KA…`
für Kind 1, `KB…` für Kind 2 usw.) und das Rechenblatt `FC 7002, 7003 für KJ
2026`, das die Lohnsteuer gegen eine „Jahressteuer nach Tarif" hält
(`jahressteuerNachRechenblatt2026`, getestet mit dem Beispiel des Blatts).

| Befundfeld | Inhalt |
| ---------- | ------ |
| `code` | Fehlercode des Katalogs; ELDA meldet ihn vierstellig ohne `F` |
| `status`, `indikation` | Fehlerstatus und Fehlerindikation, wörtlich (`N`, `P`, `G`, `P (I)` …) |
| `meldung` | Fehlertext aus dem Blatt `Fehlertexte` |

Eine Legende zu Fehlerstatus und Fehlerindikation enthält der Katalog nicht;
das DM-Org erklärt nur `G` (D.32: übernommen, aber „mit dem Fehlerstatus „G"
gekennzeichnet"). Das Paket deutet die Buchstaben deshalb nicht. Nicht
nachgerechnet werden unter anderem Regeln mit „auf Monate aliquotiert" (wie
der Katalog aliquotiert, steht nicht dabei), Prüfziffern von
Versicherungs- und Steuernummer und drei Zeilen, deren Wortlaut sich selbst
widerspricht (`F4400`, `F6202`, `F9573`; Begründung im Code). Regeln zum
„laufenden Jahr" rechnen mit dem Übermittlungsdatum `DTUE`. Für Version 29
gibt es noch keinen Katalog — `pruefeLohnzettel` lehnt sie ab.

**Getestet** ist der Lohnzettel bisher nur hier: Die SIT-Plattform verarbeitet
den Bestand `LF` nicht (ÖGK, „LSWH-Test – Regelbetrieb", 10/2023), testen
lässt er sich nur im Kundentest. Gesendet wurde noch keiner.

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

- Organisationsbeschreibung „Datenaustausch mit Dienstgebern", 43. Ergänzung,
  Version 43.1.0 (09/2026, wirksam ab 01.12.2026), abgeglichen gegen die 42.
  Ergänzung (Version 42.7.0, 07/2026): Kapitel E.1 (Identifikationsteil), E.2
  (Vorlaufsatz), E.3 (Schlusssatz), E.29 (Versichertenmeldung reduziert:
  Feldtabelle, Pflichtmatrix, Erstellvorschriften mit Beispielen), D.22
  (Abmeldegrund-Codeliste samt Abhängigkeitstabelle auf Seite 96), D.6
  (Aufbau der Versicherungsnummer), D.39 (Beschäftigungsbereich-Codeliste),
  D.41 (freier Dienstvertrag), D.43 (Referenzwert), D.45 (Referenzwert der
  VSNR-Anforderung), D.47 (betriebliche Vorsorge), D.7–D.12 (Geburtsdatum,
  Namen, akademischer Grad, Staatenschlüssel, Wohnort), D.13/D.14 (An-/Abmelde-
  und richtiges Datum bei Familienhospiz-Meldungen), E.12
  (Familienhospizkarenz/Pflegekarenz), E.22 (Schwerarbeitsmeldung), E.30
  (VSNR-Anforderung), E.31 (Adresse Versicherter), D.31–D.33 (Art des Lohnzettels,
  Lohnzahlungszeitraum, soziale Stellung), E.13/E.14 (Lohnzettel Finanz) in
  Version 28 (42. Ergänzung) und 29 (43. Ergänzung).
- Prüfkatalog zur 43. Ergänzung (Version 43.1.0.0), Blätter `VR`, `VS`, `AV`,
  `FH` (H.7), `SM` (H.12), `Allgemein` (H.1), `FC-Texte` und `mBGM Paket`
  (Kapitel H.23).
- Schwerarbeitsverordnung, § 5 (Meldepflicht, Frist).
- Für E.12 und E.22 druckt die DM-Org keine Beispiele ab, und öffentliche
  Beispieldateien von ÖGK oder ELDA gibt es nicht; die Tests prüfen deshalb
  Feld für Feld gegen die Feldtabellen. Beide Kapitel sind in der 42. und 43.
  Ergänzung wortgleich; die Seitenangaben im Code nennen beide.

  `ES`, `Allgemein`, `FC-Texte` und `mBGM Paket` (Kapitel H.23).
- Staatencode-Tabelle der ÖGK, Stand 22.04.2026 (elda.at, Downloads
  Dienstgeber).
- Antrag auf zwischenstaatliche Bescheinigung: Kapitel E.27 (Seiten 290–306
  der 43. Ergänzung — `felder-e27.ts`, `pflicht-e27.ts` und `pruefung-e27.ts`
  zitieren diese Seiten), D.4, D.12, D.36, D.65, D.68, D.69; ÖGK
  „Zwischenstaatliche Anträge: Rasches Service via ELDA"; ÖGK-Präsentation zum
  6. ELDA-LSWH-Online-Event am 09.10.2025 (Seite 24: Erweiterung des LSWH-Tests
  um E1–E5).
- Prüfkatalog L16 des Finanzministeriums, „für Lohnzettel mit Zeitraum ab
  1.1.2026", Version 09 vom 17.02.2026 (elda.at, Downloads Dienstgeber), mit
  den Blättern `FC 6201`, `FC 7002, 7003 für KJ 2026` und `Fehlertexte`.

**Seitenangaben.** Gegenüber der 42. Ergänzung hat die 43. Inhalt nur in
D.5 (10-stellige ÖGK-Beitragskontonummer), D.54 (Verrechnungsgrundlage bei
Verrechnung mit und ohne Zeit), D.60 (Abschläge ALT/NEU, `Z15`/`Z16` bei
Sonderzahlungen), E.27 (Code `05` für die BVAEB-EB im Feld `VTBK`, eigene
Pflichtmatrix für das Storno) sowie in Kapiteln geändert, die dieses Paket
nicht abbildet (E.10, E.16, E.24, E.26) oder als eigene Version führt
(E.13/E.14: Lohnzettelversion 29). E.1–E.3, E.12, E.22, E.29, E.30, E.31 und
E.32 sind inhaltlich gleich geblieben. Die Seiten der 43. Ergänzung zitieren
`codes-e32.ts` und die Dateien zu E.27, E.30 und E.31; die Dateien zu E.12,
E.22 und E.13/E.14 nennen die Seiten beider Ergänzungen; die übrigen Seiten-
und Fußnotenangaben im Code beziehen sich auf die 42. In der 43. liegen D.61
bis E.10 zwei Seiten später, E.28 bis G.10 — also E.29 und E.32 — elf Seiten
später; die Fußnoten ab D.61 sind um neun bis zehn verschoben.
- Das separate Zeichensatz-Dokument (Zeichenvorrat Personennamen bzw.
  Unternehmensnamen/Adressen in ISO-8859-15).
- Rücksendungen: `elda_mitteilung-3.0.xsd` (ELDA, „Mitteilungsfiles") und
  „Änderungen im Mitteilungsfile Version 3.0"; die XML-Schemas, Beispiele und
  die Code-Liste des Clearing-Datensatzes 2.0 (ÖGK, „SV-Clearingsystem:
  Clearing-Datensatz"); das Tarifsystem (Stand 19.09.2025) für die
  Lehrlings-Abschläge.

## Ausblick

Abgedeckt sind die Versichertenmeldung reduziert (Kapitel E.29), die
monatliche Beitragsgrundlagenmeldung (Kapitel E.32), die VSNR-Anforderung
(Kapitel E.30), die Adresse Versicherter (Kapitel E.31),
Familienhospizkarenz/Pflegekarenz (Kapitel E.12), die Schwerarbeitsmeldung
(Kapitel E.22), der Antrag auf zwischenstaatliche Bescheinigung (Kapitel E.27),
der Lohnzettel Finanz (Kapitel E.13/E.14) und das Lesen der Rücksendungen (Mitteilung, Clearing-Datensatz 2.0). Noch offen — ohne Beleg
wird nichts davon geraten:

- **Lohnzettel Finanz:** nach DM-Org und Prüfkatalog gebaut, gegen ELDA noch
  nie gesendet — die SIT-Plattform verarbeitet `LF` nicht, nur der Kundentest.
  Offen: was gilt, wenn ein Lohnzettel 2026 nach dem 01.03.2027 berichtigt wird
  (Version 29 dann zwingend, fachlich aber erst ab 2027 gültig — das Paket lässt
  dafür Version 28 zu); ob ein eintägiger Lohnzahlungszeitraum zulässig ist (D.32
  verlangt ein Ende „größer" als den Beginn, die Katalogzeile `F1603` ist
  mehrdeutig); was das Feld `CLADR` tragen muss (E.14.1: keine Angabe, der
  Katalog prüft `F0200` „ungleich RADAUS oder OESTAT"); die Bedeutung von
  Fehlerstatus und Fehlerindikation; die übrigen Finanzsatzarten des Bestands
  (`W1`, `A1`, `B1`) und ein Prüfkatalog für Version 29.
- **Familienhospiz und Schwerarbeit** sind gebaut, aber noch nie gesendet
  worden (SIT-Fälle S30–S33, S40–S43). Offen bis dahin:
  - Die Erstellvorschriften aus E.12.2 ohne eigene Katalogzeile (bei der
    Anmeldung zur Freistellung nur 03, 04, 07, zur Teilzeit nur 05, 06; 07 erst
    ab 01.11.2023; Entgelte nur bei 01/02) werden nicht geprüft.
  - Für das Geschlecht bei SART 80 führt der Prüfkatalog zwei Zeilen mit
    Status N, die sich widersprechen: `F0081` „gültig 1,2" und `F0082`
    „gültig 1,2,3,4,6,7". Das Paket folgt der Feldtabelle (wie `F0082`).
  - Die Tätigkeitsart ist zweistellig, die Codes sind einstellig abgedruckt.
    Das Paket sendet `1 ` und weist `01` ab; ob ELDA `01` annimmt, klärt S43.
  - Die Version der Schwerarbeitsmeldung ist laut Kapitelkopf `02`, die
    Fehlertexte nennen „SM01".
  - Wie ELDA einen Storno (66) der ursprünglichen Schwerarbeitsmeldung
    zuordnet und was bei mehr als 26 Tätigkeiten im Jahr gilt, sagt E.22
    nicht; mehr als 26 weist das Paket ab.
- **VSNR-Anforderung und Adressmeldung:** nach DM-Org und Prüfkatalog gebaut,
  gegen ELDA noch nie gesendet. Offen ist dort: ob ELDA beim Geschlecht `F6561`
  („gültig 1,2") oder `F6562` („gültig 1,2,3,4,6,7") anwendet — beide Zeilen
  stehen mit Status `N` im Katalog; ob `WKFZ = A` an einen anderen Träger als
  die ÖGK zulässig ist (`F8041` sagt nein, die Feldtabelle schränkt nur die ÖGK
  ein); woran ELDA eine „ungültige" Beitragskontonummer (`F6511`, `F8011`) und
  Postleitzahl (`F6583`, `F8051`) erkennt; welche Regel hinter der Groß- und
  Kleinschreibung von Ort und Straße steht (`F6585`, `F6587`, `F8061`,
  `F8071`); und wie der Clearingfall mit der vergebenen VSNR aussieht.
- **Mitteilung bei Abweisung:** nach dem Schema gelesen, auf der SIT aber nie
  beobachtet (alle Sendungen kamen `uebernommen`). Das Klartext-Protokoll
  (`mbd_…`) wird nicht ausgewertet.
- **Beitragssätze:** Die Rundung je Position wird nachgerechnet (`DM-D.62`),
  der Prozentsatz selbst nicht — falsche Sätze (`BW1850`) erkennt erst der
  Träger. Wie er auf Abweichungen über die Rundung hinaus reagiert, ist nicht
  beobachtet.
- **Lehrlingsregel:** belegt nur für die Beschäftigtengruppen `B044`/`B045`
  und die Abschläge `A01`–`A03`. Ob `A04`/`A05`/`A27` umgekehrt bei anderen
  Gruppen unzulässig sind und ob `A25`/`A26` bei Lehrlingen ebenso `BW1838`
  auslösen, steht nicht in den Quellen und wird nicht geprüft.
- **ALT oder NEU:** ob ein Dienstverhältnis am 31.12.2026 aufrecht war, kann das
  Paket nicht wissen; es prüft die Wahl zwischen `A01`–`A04` und `A25`–`A27`
  nicht, ebenso wenig die Gültigkeitsenden der Abschläge.
- **`VW1942` nach einem Monat Beschäftigung:** ob die BV-Zeit am ersten Monat
  oder an der fehlenden mBGM scheiterte, ist offen (siehe „Was die
  SIT-Plattform gezeigt hat"). Das Paket prüft Abmeldungen nicht gegen den
  BV-Beginn.
- **Status `206`** („Limit an Rücksendungen erreicht", Schnittstellenbeschreibung
  09/2026) ist noch nie aufgetreten und nicht eingeordnet.
- **Antrag auf zwischenstaatliche Bescheinigung (`ES`):** nie gegen ELDA
  gesendet. Ob die SIT-Plattform `ES` verarbeitet, ist offen — angekündigt war
  es für Ende 2025 (E1–E5, ohne EA). Ebenfalls offen: Der Prüfkatalog führt
  `VSNA`, `APNR` und `AAKT` bei E5 als „leer" = Fehler (F7595–F7597), die
  Matrix auf Seite 298 als optional, und D.65 lässt es vom Abkommen abhängen —
  das Paket verlangt sie nicht. Beim Storno nennt der Prüfkatalog keine
  Ausnahme von F7610 („Block 1 leer"), die Storno-Matrix lässt den
  Dienstgeber-Block aber leer; das Paket folgt der Matrix. Die Matrix verlangt
  `VSNR` bei allen Satzarten, der Prüfkatalog nur bei E1 und E5 (F0031) —
  das Paket folgt der Matrix. Welcher Staat bei E1 bzw. E5 für Dänemark und
  die Schweiz je nach Staatsangehörigkeit gilt (D.36, Fußnoten 35/36/38/39),
  prüft das Paket nicht.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
