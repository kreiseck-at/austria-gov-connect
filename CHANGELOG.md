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

### 0.10.1 — 2026-08-13

- **Fix:** `decodeBelegCode` erkennt Trainings- und Stornobuchungen (§ 10 Abs. 3
  RKSV) jetzt auch an der base64-Form des Markers im Umsatzzähler-Feld:
  `VFJB` = base64(`TRA`), `U1RP` = base64(`STO`). Bisher wurde nur das literale
  `TRA`/`STO` verglichen — genau das, was in echten Daten **nicht** vorkommt. In
  Szenario 1 der offiziellen BMF-Prüfwerkzeug-Testsuite steht 17-mal `VFJB` und
  17-mal `U1RP`, kein einziges Mal das literale Kürzel; alle 34 Buchungen galten
  bis 0.10.0 als gewöhnliche Belege, gingen also in Umsatzsummen ein und
  entzogen sich den Regeln, die nur für sie gelten. Die literale Schreibweise
  wird weiterhin akzeptiert. Der Fehler ist älter als 0.10.0 — er fiel nur nie
  auf, weil die Dekodierung nie gegen echte BMF-Daten lief.
- **Fix:** Der OCR-Beleg (Anlage Z 14) trägt den Marker base32-kodiert
  (`KRJEC===` / `KNKE6===`). Das Feld wird jetzt auch dann nach base64
  umkodiert, wenn es den Marker trägt — QR- und OCR-Fassung desselben Belegs
  liefern denselben `umsatzzaehler`. Nur die literale Schreibweise bleibt
  unangetastet, sie ist kein kodierter Wert.
- **Neu:** `Beleg.seeAusfall` sagt unabhängig von `besonderheit`, ob der
  Signaturwert den Ausfalltext trägt. Nötig, weil beides zugleich vorkommt: 16
  der 34 Buchungen in Szenario 1 sind Trainings- oder Stornobuchungen
  **während** eines Ausfalls der Signatureinheit. `besonderheit` führt in diesem
  Fall die Belegart; `pruefeBelegCode` meldet Signaturlänge und Signatur
  weiterhin als `NOT_EXECUTED`, richtet sich dafür aber nach `seeAusfall`. Wer
  bisher `besonderheit === 'see-ausfall'` abfragt, stellt auf `seeAusfall` um.
- **Neu:** Einstiegspunkt `@kreiseck/rksv/code/sha256`. Die paketinterne,
  synchrone SHA-256 lag zwar in `dist`, war über die `exports`-Karte aber nicht
  erreichbar (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
- Regressionstests gegen die echten Belegcodes aus Szenario 1 der
  BMF-Testsuite — 81 Belege in QR- und in OCR-Fassung, die erwarteten Belegarten
  aus der Szenariodatei des BMF-Werkzeugs selbst.

### 0.10.0 — 2026-08-12

- **Breaking:** `pruefeBelegCode` und die Typen `Pruefergebnis`/`PruefOptionen`
  liegen nicht mehr unter `@kreiseck/rksv/code`, sondern unter dem neuen Subpath
  `@kreiseck/rksv/code/signatur`. Die ES256-Prüfung braucht X.509 und damit
  `node:crypto`; über den bisherigen Export zog jeder Nutzer des Offline-Teils
  diese Abhängigkeit mit. **Betroffen ist u. a.
  `functions/test/integration/belegcheck-core.js` im Repository `kasseneck`** —
  der Zweit-Verifizierer der RKSV-Integrationssuite holt `pruefeBelegCode` heute
  aus `@kreiseck/rksv/code`. Solange dort `^0.9.0` steht, passiert nichts; wer
  die Abhängigkeit hebt, muss den Import auf `/code/signatur` umstellen.
- **Breaking:** `base32Decode` liefert und `base32Encode` nimmt `Uint8Array`
  statt `Buffer`. In Node ist `Buffer` ein `Uint8Array` — wer nur Bytes liest
  oder weiterreicht, merkt den Wechsel nicht; wer `.toString('base64')` o. Ä.
  auf dem Ergebnis von `base32Decode` aufruft, muss umstellen.
- **Neu:** `@kreiseck/rksv/code` kommt ohne `node:crypto`, ohne `Buffer` und
  ohne `process` aus und läuft damit unverändert im Browser — gedacht für ein
  Prüfportal, das die Verkettung einer Belegkette clientseitig prüft. Eine
  zweite Fassung derselben Logik, die auseinanderlaufen kann, entfällt damit.
  SHA-256 und die Base64-/Byte-Helfer sind paketintern umgesetzt; die
  Verkettungswerte sind gegen die vorherige Fassung differenziell verglichen
  (u. a. der BMF-Vektor `A12347` → `OeSKQjO4zKI=`).
- **Fix:** Die interne Base64-Dekodierung bricht am ersten Auffüllzeichen `=`
  ab, wie `Buffer.from(s, 'base64')`. Eine nachsichtige Fassung hätte in einem
  **verfälschten** Belegcode (`=` mitten im Signatursegment) den Ausfalltext
  „Sicherheitseinrichtung ausgefallen" erkannt und daraufhin Signaturlänge und
  Signatur als `NOT_EXECUTED` gemeldet, statt sie fehlschlagen zu lassen. In
  einem RKSV-konformen Beleg ist der Fall nicht erreichbar; für die Prüfung
  manipulierter oder beschädigter Codes ist er es sehr wohl.
- `belegSigningInput` bleibt öffentlich und liegt weiterhin in
  `@kreiseck/rksv/code` — es hängt an nichts Node-Eigenem mehr.

### 0.9.0 — 2026-07-31

- **Neu:** `vorgangErgebnis(...)` und `vorgangKlasse(...)` samt Typen
  `VorgangKlasse`, `VorgangUrteil`, `UrteilEingabe` — ein **vorgangsbezogenes**
  Urteil statt roher Returncodes. `Ergebnis.ok` beantwortet nur „hat der Aufruf
  funktioniert"; die Frage des Aufrufers ist aber „ist der gewünschte Zustand
  hergestellt". Beides fällt bei FinanzOnline vorgangsabhängig auseinander:
  `B6` heißt bei einer Außerbetriebnahme *Ziel erreicht*, bei einer
  Wiederinbetriebnahme *Ablehnung*, bei `B13` ist es umgekehrt. Daher drei
  Ausgänge: Ziel erreicht, `statusUnklar`, abgelehnt.
- **Neu:** `FonStatus` (`AKTIVIERT` | `REGISTRIERT` | `IN_BETRIEB` | `AUSFALL`)
  als offener Wertebereich in `StatusErgebnis.status` — unbekannte Werte brechen
  die Auswertung nicht, die bekannten vier werden beim Tippen vorgeschlagen.
- Dokumentiert: `statusUnklar` verspricht **nicht**, dass eine Statusabfrage die
  Sache klärt. Am 31.07.2026 am echten Dienst nachgemessen — für abgemeldete
  Einheiten kommt `B32`/`B33` ohne Status und ohne Datum; „nie registriert" und
  „bereits abgemeldet" sind über das Webservice nicht zu unterscheiden.

### 0.8.0 — 2026-07-29

- **Neu:** Begründungscodes für Ausfall und Außerbetriebnahme als Katalog —
  `BEGRUENDUNGEN`, `begruendungCodes(vorgang)`, `begruendungText(vorgang, code)`
  und `istBegruendungZulaessig(vorgang, code)`. Codes und Wortlaute wörtlich aus
  Abschnitt 4 der BMF-Beschreibung „Registrierkassen-Webservice", getrennt nach
  `ausfall_see` (1/2/99), `ausfall_kasse` (1/5/99) und `ausserbetriebnahme`
  (6/7). Dieselbe Zahl bedeutet je nach Vorgang etwas anderes; wer den Text
  vorher selbst hinschrieb, riskierte eine falsche Begründung in einer
  Behördenmeldung. Die Vorgangsvalidierung prüft jetzt gegen diesen Katalog
  statt gegen eine zweite, hartkodierte Liste.
- **Neu:** `istWiederholbar(rc)` beantwortet, ob derselbe Aufruf unverändert
  später gelingen kann — bewusst getrennt von `rcInfo(rc).kind`, das nur
  entscheidet, ob der Client wirft oder ein Ergebnis liefert. Interne FON-Fehler
  (`1336`, `1337`, `B4`, `C1`, `V1`–`V16`) und die vorübergehend gestörte
  VDA-Abfrage (`14`) sind wiederholbar; fachliche Ablehnungen wie `B5` oder
  `B18` nicht. `B38` ist bewusst ausgenommen: der Beleg wird ohnehin bis zu 24 h
  nicht neuerlich geprüft.
- **Neu:** `rcIsOk` und `rcIsTechnical` werden jetzt exportiert — sie gab es
  bereits, waren von außen aber nicht erreichbar.
- **Ergänzt:** Returncode `B38` (Beleg wurde mehrfach fehlerhaft geprüft und
  wird bis zu 24 Stunden nicht neuerlich geprüft) in `RKDB_RC`.

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

### 0.1.6 — 2026-07-29

- **Neu:** `FonProtocolError` trägt jetzt optional `httpStatus` und einen
  `rohantwort`-Getter mit dem rohen, ungeparsten Antwort-Body. Rein additiv
  (`new FonProtocolError(msg)` bleibt gültig). Relevant für Dienste mit
  einmaliger Zustellung: scheitert das Parsen einer Antwort, ist der rohe
  Body sonst der einzige Rest der bereits verbrauchten Nutzdaten (Beispiel:
  eine MTOM-Antwort auf `empfangen` beim ELDA Transfer-Webservice). Bewusst
  als Getter statt eigener Eigenschaft, damit `console.error`/`util.inspect`/
  `JSON.stringify` ihn nicht ungefragt in ein Log schreiben.

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

### 0.4.1 — 2026-07-30

- **Fix:** `erstelleBestand` klammert wieder Bestände, deren Sätze
  unterschiedlich lang sind. Seit 0.3.0 wies die Funktion sie mit „Alle Sätze
  eines Datenbestands müssen dieselbe Satzlänge haben" ab — das widerspricht
  Kapitel E.2 (Seite 175): „Bei Beständen mit Datensätzen unterschiedlicher
  Satzlängen kommt die Satzlänge jenes Datensatzes zur Anwendung der die
  maximal mögliche Satzlänge im Bestand aufweist." Vorlauf- und Schlusssatz
  tragen also die größte im Bestand vorkommende Satzlänge, jeder Datensatz
  behält seine eigene; die Satzanzahl (`SANZ`) und die laufenden Satznummern
  bleiben davon unberührt. Für die Versichertenmeldung (Kapitel E.29, alle
  Sätze 772) ändert sich nichts. Betroffen war der Lohnzettel Finanz, wo ein
  Informationssatz (Satzart `I1`, Satzlänge 1100, Kapitel E.13) den
  Mitteilungssätzen (Satzart `L1`, Satzlänge 3500, Kapitel E.14) vorangeht —
  ein solcher Bestand ließ sich gar nicht bauen.

### 0.4.0 — 2026-07-30

- **Neu:** `kundenpasswortHash` in `EldaConfig` — statt des Kundenpassworts im
  Klartext lässt sich der fertige SHA-512-Hex-Digest übergeben. Auf die Leitung
  geht ohnehin nur dieser Hash; wer Zugangsdaten dauerhaft ablegt (etwa ein
  Mandantensystem, in dem der Kunde seine ELDA-Daten einmal einträgt), speichert
  damit nur noch ein ELDA-gleichwertiges Token und nicht mehr das Passwort des
  Kunden, das anderswo wiederverwendet sein dürfte.
- **Neu:** `hashKundenpasswort(klartext)` bildet denselben Hash, den der Client
  intern bildet — zum Hashen an der Eingabestelle, ohne die Regel nachzubauen.
- `kundenpasswort` und `kundenpasswortHash` schließen einander aus: Genau eines
  von beiden muss gesetzt sein. Die Ausschließlichkeit steht im Typ und wird
  zusätzlich zur Laufzeit erzwungen (Aufrufer aus reinem JavaScript haben keinen
  Compiler). Der Hash wird auf seine Form geprüft — genau 128 Hexziffern in
  Kleinschreibung; ein abgeschnittener oder großgeschriebener Digest wirft beim
  Bauen des Clients statt als ELDA-Status `558` zurückzukommen, der von einem
  echten Passwortfehler nicht zu unterscheiden wäre.
- **Neu:** Live-Check gegen den echten ELDA-Kundentest (`npm run test:live` im
  Paket, nicht Teil von `npm test`). Steuerung ausschließlich über
  Umgebungsvariablen; ohne Zugangsdaten wird sauber übersprungen. `senden` und
  `empfangen` laufen nur nach ausdrücklicher Freigabe je eigener Variable, weil
  beide unwiderruflich sind; `empfangen` holt ausschließlich die Rücksendung zur
  eigenen Sendung aus demselben Lauf oder eine ausdrücklich genannte
  Protokollnummer, nie einen Eintrag der abgefragten Liste — der gehörte fast
  sicher einer fremden Verarbeitung und wäre nach dem Abholen für sie verloren.
- **Intern:** `redigiereGeheimnisse` schwärzt Zugangsdaten in mitgeschnittenen
  Requests und Antworten — wertbasiert (auch in XML-escapter Form), damit auch
  ein SOAP-Fault, der die Anfrage in seinem `<detail>` zitiert, erfasst wird.
  Steht ein Geheimnis danach noch im Text, wird geworfen statt geschrieben. Nicht
  über den Barrel exportiert.
- Additiv, keine Bruchstelle gegenüber 0.3.0 — `kundenpasswort` im Klartext
  bleibt unverändert zulässig.

### 0.3.0 — 2026-07-29

- **Neu:** Meldungs-Builder für die sieben Satzarten der Versichertenmeldung
  reduziert (Kapitel E.29): `anmeldung`, `abmeldung`, `aenderungsmeldung`,
  `richtigstellungAnmeldung`, `richtigstellungAbmeldung`, `stornoAnmeldung`,
  `stornoAbmeldung`. Jeder Builder prüft vor dem Bau die Pflichtmatrix aus
  E.29.1 (`PFLICHT_E29`) sowie die entscheidbaren Regeln des Prüfkatalogs
  (Blatt `VR`) und wirft bei Verletzung einen `EldaError` mit Katalog-Code.
- **Neu:** `erstelleBestand` klammert Meldungssätze zu einem vollständigen,
  ISO-8859-15-kodierten Datenbestand (Vorlaufsatz, Meldungssätze,
  Schlusssatz) — das Ergebnis geht unverändert als `inhalt` an `senden`.
  Zeitstempel im Vorlaufsatz werden aus einem echten Zeitpunkt in Wiener
  Ortszeit umgerechnet (Sommerzeit inklusive), konfigurierbar über
  `BestandOptionen.zeitzone`.
- **Neu:** `wochenarbeitszeit(stunden, minuten)` rechnet in das vierstellige
  Format des Feldes `VWAZ` um.
- **Neu:** Zeichensatz-Kodierung nach ISO-8859-15 mit engerem Zeichenvorrat
  für Personennamen; ein nicht darstellbarer oder außerhalb des Vorrats
  liegender Name wirft, statt transliteriert zu werden.
- Additiv, keine Bruchstelle gegenüber 0.2.0.
- Mindest-Abhängigkeit auf `@kreiseck/finanzonline-core` `^0.1.6` angehoben
  (enthält `httpStatus`/`rohantwort` an `FonProtocolError` — die im
  README dokumentierte Wiederherstellung des rohen Antwort-Bodys bei einem
  Parse-Fehler auf `empfangen` setzt das voraus).

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
