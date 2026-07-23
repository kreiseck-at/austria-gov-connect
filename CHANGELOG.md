# Changelog

Alle nennenswerten Änderungen an den Paketen dieses Monorepos. Format angelehnt
an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/); die Pakete folgen
[Semantic Versioning](https://semver.org/lang/de/) (vor 1.0.0 können Minor-Bumps
brechen).

## @kreiseck/uid

### 0.1.0 — 2026-07-22

- **Neu:** `createUid(config)` erzeugt ein Objekt mit Methoden zur UID-Prüfung
  (VIES und FinanzOnline).
- **Neu:** VIES-Prüfung über `pruefe()` (schnell, anonym) und `bestaetige()`
  (mit Adressapproximation und Konsultationsnummern).
- **Neu:** 3-Ausgänge-Modell: `gueltig` | `ungueltig` | `keine_antwort` mit
  differenziertem `grund` und `wiederholbar`-Flag.
- **Neu:** FON-UID-Abfrage (Stufe 1/2) über `fon.abfrage()` mit behördlicher
  Bestätigung via DataBox-Bescheid.
- **Neu:** Normalisierung und Caching via `normalisiereUid()` und `cacheKey()`.
- Stateless API — alle Abfragen ohne interne Session (Session nur für FON optional).

## @kreiseck/rksv

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
