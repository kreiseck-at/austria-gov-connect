# Changelog

Alle nennenswerten Änderungen an den Paketen dieses Monorepos. Format angelehnt
an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/); die Pakete folgen
[Semantic Versioning](https://semver.org/lang/de/) (vor 1.0.0 können Minor-Bumps
brechen).

## @kreiseck/uid

### 0.1.1 — 2026-07-25

- **Fix:** `fon.abfrage` behandelt Returncode `101` (UID beginnt nicht mit ATU)
  wie `4`/`5` als Eingabefehler (`UidEingabeError`) statt als wiederholbares
  `keine_antwort` — kein sinnloser Retry bei fehlerhafter Eingabe.
- Returncode-Klassifizierung gegen die BMF-Spec „UID-Abfrage-Webservice"
  (Stand 20.09.2024) dokumentiert. Live gegen echtes FON verifiziert (Stufe 1/2
  gültig inkl. Name/Adresse; §132-Bescheid via `parseUidBescheid` am echten
  DataBox-Bescheid geprüft).

### 0.1.0 — 2026-07-22

- **Neu:** `createUid(config)` erzeugt ein Objekt mit Methoden zur UID-Prüfung
  (VIES und FinanzOnline).
- **Neu:** VIES-Prüfung über `pruefe()` (schnell, anonym) und `bestaetige()`
  (mit Adressapproximation und Konsultationsnummern).
- **Neu:** 3-Ausgänge-Modell: `gueltig` | `ungueltig` | `keine_antwort` mit
  differenziertem `grund` und `wiederholbar`-Flag.
- **Neu:** FON-UID-Abfrage (Stufe 1/2) über `fon.abfrage()` mit behördlicher
  Bestätigung via DataBox-Bescheid.
- **Neu:** `parseUidBescheid(xml)` liest den FON-UID-Bescheid aus der DataBox
  (`anbringen=UID`, `<Bestaetigungen>`-Format) — je Antragsteller-UID der
  §132-Nachweis mit den bestätigten UIDs. An einem echten Bescheid verifiziert.
- **Neu:** Normalisierung und Caching via `normalisiereUid()` und `cacheKey()`.
- Stateless API — alle Abfragen ohne interne Session (Session nur für FON optional).

## @kreiseck/rksv

### 0.7.0 — 2026-07-25

- **Neu:** `parseErgebnisprotokoll` erfasst zusätzlich `artUebermittlung`
  (`T` = Test / `P` = Produktion) und `fastnr` — an einem echten FON-Protokoll
  verifiziert. Additiv.
- **Doku:** rkdb gegen die BMF-Spec „Registrierkassen-Webservice" geprüft
  (Returncode-Tabelle/Begründungscodes decken sich; `vda_id`-Werte `AT1`/`AT2`/
  `AT9` dokumentiert; GGS-Vorgänge bewusst nicht umgesetzt). `@kreiseck/rksv/code`
  (Belegcode) field-für-field gegen die RKSV-Anlage (BGBl. II Nr. 410/2015,
  Detailspezifikationen Z2/Z4/Z5/Z6/Z12–Z14) verifiziert — 1:1 konform.

### 0.6.0 — 2026-07-23

- **Neu:** `parseErgebnisprotokoll(xml)` liest ein asynchron in der FinanzOnline
  DataBox abgelegtes rkdb-Ergebnisprotokoll (`<rkdbResponse>` ohne SOAP-Envelope)
  und liefert `{ paketNr, info, ergebnisse: Ergebnis[] }`. Damit schließt sich der
  asynchrone Kreis: Mehrfach-Pakete werden gesendet, das Ergebnis später aus der
  DataBox geholt und je Vorgang über `paketNr`/`satznr`/`kundeninfo` zugeordnet.
  An einem echten DataBox-Protokoll verifiziert.

### 0.5.0 — 2026-07-22

- **Neu:** `Pruefung.beschreibung` erfasst die menschenlesbare
  `verificationTextualDescription` je Knoten im Belegprüfungs-Baum (vorher
  verworfen).
- **Neu:** `Ergebnis.tsErstellung` reicht den Zeitstempel des Antwort-Envelopes
  (`ts_erstellung` auf rkdbResponse-Ebene) je Ergebnis durch — nützlich, um den
  Verarbeitungszeitpunkt einer Einreichung festzuhalten.
- Mindest-Abhängigkeit auf `@kreiseck/finanzonline-core` `^0.1.2` angehoben
  (enthält die vollständige Fault-Detailtext-Erfassung).
- Rein additiv, keine Breaking Changes.

### 0.4.1 — 2026-07-22

- **Wartung:** Mindest-Node auf `>=20.18.0` angehoben (Node 18 ist End-of-Life),
  `@types/node` auf 22, CI-Matrix auf Node 20/22/24. Keine funktionalen
  Änderungen am ausgelieferten Code.

### 0.4.0 — 2026-07-22

- **Neu:** Optionales `kundeninfo` je Vorgang (registrieren, Ausfall,
  Wiederinbetriebnahme, Außerbetriebnahme, Belegprüfung). Der Dienst gibt es im
  asynchronen Ergebnisprotokoll zurück; nützlich zur Zuordnung von Einreichungen
  zu DataBox-Ergebnissen.
- **Breaking:** `beleg.pruefe(...)` liefert jetzt das volle `Ergebnis`
  (`ok`/`rc`/`msg`/`belegpruefung`) statt nur `Pruefung[]` — konsistent mit
  `status.kasse/see`. Migration: statt des Rückgabe-Arrays `erg.belegpruefung`
  lesen; `erg.rc === '0'` = alle Prüfungen PASS, `'43'` = mindestens ein FAIL.
- JSDoc am öffentlichen API.

### 0.3.0 — 2026-07-22

- **Fix (Breaking gegenüber 0.2.x):** Synchron/asynchron wird wieder aus dem
  **Request** bestimmt (BMF-Handbuch-konform): genau ein Vorgang und nicht
  erzwungen → synchron mit Ergebnis; sonst asynchron → keine Ergebnisse in der
  Antwort (die stehen im Ergebnisprotokoll in der DataBox). Die in 0.2.0
  eingeführte response-basierte Erkennung war falsch: die einzelne `rc-0`-Antwort
  auf ein Mehrfach-Paket ist nur eine Empfangsbestätigung, kein synchrones
  Ergebnis. An echten FON-Antworten verifiziert.

### 0.2.1 — 2026-07-22

- **Fix:** `zertifikatsseriennummer` wird mit dem Attribut `hex="true"`
  übermittelt (wie in echten FON-Requests) — verhindert die Fehldeutung
  rein-numerischer Seriennummern als Dezimalzahl.

### 0.2.0 — 2026-07-21

- `status.kasse`/`status.see` liefern das volle `Ergebnis` (inkl. `rc`/`msg`)
  statt nur eines optionalen Status.
- Reale FON-Antworten als Regressions-Fixtures.

### 0.1.0 — 2026-07-21

- Erstveröffentlichung: Übermittlung an den rkdb-Webservice (SEE/Kasse
  registrieren, Ausfall, Wiederinbetriebnahme, Außerbetriebnahme, Statusabfrage,
  Belegprüfung), vollständige Returncode-Tabelle, `Pruefung.id`
  (`verificationId`). Offline-Belegcode (`@kreiseck/rksv/code`): Dekodieren,
  ES256-Signaturprüfung, SHA-256-Verkettung.

## @kreiseck/finanzonline-core

### 0.1.5 — 2026-07-25

- **Doku:** Session-Returncodes `-1..-4` als konform zur BMF-Spec
  „Session-Webservice" (Stand 06.11.2019) markiert; `-5..-8` als NICHT in der
  aktuellen Spec (best-effort/legacy) kenntlich gemacht — bei diesen Codes trägt
  ohnehin die FON-`serverMsg` den maßgeblichen Grund. Keine funktionale Änderung.

### 0.1.4 — 2026-07-23

- **Neu:** Helfer für FON-Webservice-Benutzer — `BENID_MUSTER`/`istGueltigeBenid`,
  `generiereBenid(praefix, nummer)` (z. B. `KASSENECK001`), `istGueltigesPasswort`
  und `generierePasswort()` (kryptografisch, erfüllt die 4-Kategorien-Regel). Für
  Onboarding/Admin-Panels, die neue Webservice-Benutzer anlegen. Additiv.

### 0.1.3 — 2026-07-23

- **Neu:** `FonRcError` (Subklasse von `FonProtocolError`) trägt den numerischen
  `rc` und die Servermeldung, damit Aufrufer verschiedene Fehler-Returncodes
  programmatisch unterscheiden können (z. B. DataBox `-5`/`-6`). Additiv.

### 0.1.2 — 2026-07-22

- **Wartung:** Mindest-Node auf `>=20.18.0` angehoben (Node 18 ist End-of-Life),
  `@types/node` auf 22. Keine funktionalen Änderungen.

### 0.1.1 — 2026-07-22

- **Fix:** `detectFault` liest den Detailtext eines SOAP-Faults auch aus
  verschachtelten Elementen (z. B. `<detail><fon:ValidationError>…`), statt nur
  den direkten Text — der eigentliche Fehlergrund geht nicht mehr verloren.
  Neuer Helfer `textContent` (exportiert).

### 0.1.0 — 2026-07-21

- Erstveröffentlichung: zustandslose Session (`login`/`logout`),
  selbstgeschriebener SOAP-1.1-Transport (Envelope, Parser, Fault-Erkennung),
  HTTP über `fetch` mit Timeout und sicherer Wiederholung, Fehlerhierarchie.
  Keine Laufzeitabhängigkeiten.

## @kreiseck/finanzonline

### 0.2.0 — 2026-07-25

- **Fix:** `normalizeFileart` ist jetzt case-insensitiv. FON liefert `fileart`
  klein (`xml`/`pdf`); der bisherige case-sensitive Vergleich hätte PDF-Einträge
  fälschlich als XML eingestuft. Live gegen echtes FON verifiziert.
- **Breaking (vor 1.0):** FileUpload-`ANBRINGEN`-Enum an die BMF-Spec
  „File-Upload-Webservice" (Stand 04.03.2026) angeglichen — ergänzt `BIL`
  (E-Bilanz), `IVF` (Investmentfonds), `JAB` (Jahresabschluss Firmenbuch);
  entfernt `KDUEB`/`NOVASB`/`NOVASBAB`/`KDX` (nicht in aktueller Spec). 39 Codes
  mit Bedeutung + Returncode-Tabelle (`-1..-5`) dokumentiert. Live im Test-Modus
  verifiziert (rc=0, „nur für Testzwecke").
- **Doku:** DataBox `erltyp`-Werte und Zeitfenster-Returncodes (`-4`/`-5`/`-6`)
  dokumentiert; Test-Fixtures an die echte (kleingeschriebene) FON-Form geerdet.

### 0.1.0 — 2026-07-22

- Erstveröffentlichung: DataBox-Client (`createDatabox`) mit `liste()`
  (`getDatabox`, optional gefiltert nach `erltyp` und Zustellfenster
  `von`/`bis`) und `eintrag()` (`getDataboxEntry`, liefert `fileart` und den
  Inhalt als `Buffer`).
- `liste()` ohne `erltyp` liefert nur ungelesene Einträge; der Abruf eines
  Eintrags über `eintrag()` markiert ihn serverseitig als gelesen.
- Zeitfenster-Limits dokumentiert: `von` maximal 31 Tage zurück, Spanne
  `von`–`bis` maximal 7 Tage.
- `rkdbProtokolle()` holt die asynchronen rkdb-Ergebnisprotokolle (`erltyp=P`,
  `anbringen=RKDB`) als XML-Strings — zum Parsen mit `parseErgebnisprotokoll` aus
  `@kreiseck/rksv`. Schließt zusammen mit rksv den asynchronen RKSV-Kreis.
- **FileUpload-Webservice:** `createFileUpload(session, { uebermittlung })` mit
  `upload({ art, data })` übermittelt Erklärungen/Dateien (`art`-Enum: U30, U13,
  JAHR_ERKL, L1, KOM, NOVA, DIGI, … verifiziert gegen die XSD). Antwort synchron
  `{ rc, msg }`; das Übermittlungsprotokoll kommt asynchron in die DataBox.
- Fehler-Returncodes tragen über `FonRcError` das numerische `rc` (z. B. DataBox
  `-5`/`-6`, FileUpload `-4`/`-5`); `rc -1` wirft `FonSessionExpiredError`.

## @kreiseck/elda

### 0.2.0 — 2026-07-28

- **Breaking:** `umgebung` ist jetzt in jeder Konfiguration ohne expliziten
  `endpoint` Pflicht — der bisherige Produktions-Default entfällt, damit ein
  vergessenes Feld nicht mehr unbemerkt echte Meldungen in den Echtbetrieb
  schickt.
- **Breaking:** `zuordnung` heißt jetzt `findeRuecksendung` (gleiche Signatur).
- **Neu:** `createEldaTransfer(config)` liefert die komfortable Oberfläche.
  `senden` und `empfangen` liefern kein `ok`-Feld mehr, sondern ein über
  `zustand` verengbares Ergebnis (`Gesendet`/`Empfangen`) — behandelbare
  Status-Codes (u. a. `duplikat`, `nochInArbeit`, `bereitsEmpfangen`) sind
  damit kein Kontrollfluss über Ausnahmen mehr. `ruecksendungenAuflisten`
  liefert die Liste der Rücksendungen direkt als Array statt als
  `AuflistenErgebnis`. Alle übrigen, nicht behandelbaren Status-Codes wirft die
  Methode jetzt als `EldaStatusError` (Code, Klartext-Meldung und volles
  rohes Ergebnis).
- **Neu:** `empfangen` wirft `EldaProtocolError`, wenn Status `000` ohne
  `<datei>` kommt oder wenn ein Status ohne vorgesehenen Dateiinhalt (z. B.
  `408`) dennoch eine `<datei>` mitliefert — in beiden Fällen hängt das bereits
  ausgelieferte rohe Ergebnis am Fehler (`err.ergebnis`), weil `empfangen`
  einmalig ist und ein zweiter Aufruf den Inhalt nicht mehr verlässlich holen
  kann.
- Das bisherige Verhalten (Ergebnisobjekte mit `ok`/`statusCode`/`meldung`,
  nie werfend bei fachlichen Status-Codes) bleibt unverändert erreichbar über
  `elda.roh` bzw. weiterhin direkt über `createEldaTransferRoh`.
- **Breaking:** der Barrel-Export exportiert kein Innenleben mehr — `baueSecurity`,
  `SecurityFelder`, `SecurityQuelle`, `baueEldaEnvelope`, `EldaFeld`,
  `ELDA_NAMESPACE` und `istOk` sind nicht mehr Teil der öffentlichen Oberfläche
  (die Module bestehen intern unverändert weiter).

### 0.1.0 — 2026-07-25

- Erstveröffentlichung: Transport-Schicht des ELDA Transfer-Webservice v4
  (Schnittstellenbeschreibung V4, 05/2026). `createEldaTransfer(config)` liefert
  die drei Webservice-Methoden `senden`, `ruecksendungenAuflisten` und
  `empfangen`; Envelope- und Security-Bau selbstgeschrieben auf Basis von
  `@kreiseck/finanzonline-core` — keine weiteren Laufzeitabhängigkeiten.
- **Security:** `baueSecurity` erzeugt die `securityParameters` (`apiKey`,
  `created`, `kundenpasswort` als SHA-512 hex lowercase, `nonce`, `seriennummer`).
  Das Kundenpasswort wird im Klartext übergeben und nur gehasht übermittelt.
- **Ergebnis-Objekte statt Ausnahmen:** Fachliche Status-Codes werden nie
  geworfen, sondern als `statusCode`/`ok`/`meldung` durchgereicht.
  `ruecksendungenAuflisten` liefert bewusst kein nacktes Array, sondern ein
  `AuflistenErgebnis` (`statusCode`, `ok`, `ruecksendungen`, `meldung`) — ein
  leeres `ruecksendungen` bei `ok: false` heißt „Aufruf fehlgeschlagen", nicht
  „keine Rücksendungen offen".
- **Wiederholungen:** `transport.retries` sind zusätzliche Versuche nach einem
  Transportfehler; für jeden Versuch werden `nonce` und `created` neu erzeugt
  (ein Replay liefe sonst in Status `552`/`551`). SOAP-Faults, Protokollfehler
  und fachliche Status-Codes werden nicht wiederholt.
- **Korrelation:** `zuordnung(sendungsProtokollnummer, ruecksendungen)` findet die
  Rücksendung, deren `dateiName` die Protokollnummer der Sendung enthält —
  ziffernscharf, damit `1557643` nicht auf `15576431` passt.
- **Keine stillen Verluste:** fehlendes `<return>`, fehlender
  `<serviceResult><statusCode>`, eine `<ruecksendungen>` ohne Protokollnummer
  sowie ein leerer oder XOP-referenzierter `<payload>` werfen `EldaProtocolError`
  statt ein halbes Ergebnis vorzutäuschen. Leaf-Texte werden getrimmt, damit
  pretty-printed Antworten korrekt ausgewertet werden.
- `ELDA_ENDPOINTS` (Produktion/Kundentest/SIT), `ELDA_NAMESPACE`, `ELDA_STATUS`
  (vollständige Status-Code-Tabelle der Spec V4) und `istOk` sind exportiert.
- **MTOM/XOP wird noch nicht unterstützt** — Payloads gehen und kommen inline als
  Base64. Eine echte MTOM-Antwort (`multipart/related`) endet in einem
  `FonProtocolError`, eine XOP-Referenz in einer XML-Antwort in einem
  `EldaProtocolError`. Der Sendepfad ist vollständig unit-getestet, aber noch
  nicht gegen die echte ELDA-Gegenstelle verifiziert.
- Meldungs-Builder (Anmeldung, Abmeldung, mBGM …) sind bewusst nicht enthalten —
  sie brauchen die SV-Datensatzbeschreibung als eigene Spec-Grundlage.
