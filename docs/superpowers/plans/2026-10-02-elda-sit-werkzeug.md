# ELDA-SIT-Werkzeug – Umsetzungsplan

**Goal:** Ein Kommandozeilenwerkzeug, mit dem wir in den Testfenstern der SIT-Plattform der Sozialversicherung
jeden Testfall aus dem Katalog sicher, reproduzierbar und lückenlos protokolliert gegen ELDA laufen lassen –
positive wie gezielt falsche Anfragen.

**Architecture:** Reines Node (CommonJS) unter `packages/elda/test/sit/`, ohne neue Abhängigkeiten. Die Fachlogik
liefert das gebaute Paket (`dist/`); das Werkzeug ergänzt Zeitreise, Sicherheitsgrenzen, einen aufzeichnenden und
gezielt manipulierenden `fetch`, eine Ablage mit Laufprotokoll und den Testkatalog als Code. Alles, was ohne Netz
geht, ist mit `node:test` getestet; Netzaufrufe gibt es nur über die Kommandos `pruefen`, `senden` und `abholen`.

**Tech Stack:** Node ≥ 20.18 (`fetch`, `node:test`, `Intl`), `@kreiseck/elda` aus `dist/`.

**Spec:** Kampagnenplan und Testkatalog im privaten kasseneck-Repo (`docs/plans/2026-10-02-sit-testkampagne.md`,
`docs/plans/2026-10-02-sit-testkatalog.md`, Abschnitte „WP1", „Sicherheitsregeln", „Protokoll").

## Global Constraints

- Nur die SIT-Plattform: `https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService`. Jeder andere
  Endpoint bricht **vor** dem Aufruf ab – auch Kundentest und Produktion (die kommen später mit eigenem
  Vertraulichkeitsmodus).
- Projektcode im SIT immer `TM` (`testdaten: true`); Ausnahme nur ein Fall, der genau das Gegenteil prüft (B11).
- Erstellungsdatum (EDAT/EZEI) = simuliertes Datum des aktiven Fensters mit der aktuellen Wiener Uhrzeit; Meldedaten
  passen dazu.
- `senden` und `abholen` (empfangen) nur mit `--ja`; ohne `--ja` Trockenlauf. Netzaufrufe nur innerhalb eines
  aktiven Testfensters, nicht an testfreien Tagen und nicht nach dem Ende der Zeitreise-Tabelle (`gueltigBis`).
- Vor jedem Netzaufruf: Quell-IP muss `ELDA_SIT_QUELL_IP` entsprechen.
- Geheimnisse (Kundenpasswort, Hash, API-Key, Seriennummer) erscheinen nie in Ausgabe oder Dateien; Mitschnitte werden
  geschwärzt, sonst nicht geschrieben.
- Keine Kennungen im Repo: Testdaten nur in `testdaten.local.json`, Ablage nur in `ablage/` – beides gitignoriert.
  Im Code stehen Rollen (`arbeiter`, `geringfuegig` …), nie Namen, VSNR, BKNR oder Seriennummern.
- Stil wie im Paket: deutsche Bezeichner und Kommentare, Prettier-Konfiguration des Repos.

## Review Focus

1. **Falsches Fenster:** Ein Lauf außerhalb eines Fensters oder mit einem Fenster, das nicht dem aktiven entspricht,
   darf nichts senden – erwartet: Abbruch mit klarer Meldung vor jedem Netzaufruf.
2. **Endpoint-Fehlkonfiguration:** Eine manipulierte oder fehlerhafte Umgebungs-/Endpoint-Angabe darf nie die
   Produktion erreichen – erwartet: `pruefeZiel` wirft im `fetch` selbst, unabhängig von der Konfiguration.
3. **Geheimnis im Mitschnitt:** Ein Geheimnis, das in einer manipulierten Anfrage oder in einer SOAP-Fault-Antwort
   steht, darf nicht auf die Platte – erwartet: geschwärzt oder Datei nicht geschrieben.
4. **Abhängiger Fall ohne Vorlauf:** Ein Fall, der den Referenzwert oder Bestand eines früheren Falls braucht
   (T02, V07 …), dieser aber in der Woche noch nicht gelaufen ist – erwartet: `zeigen`/`senden` brechen mit Hinweis ab.
5. **Rücksendung beim Parsen kaputt:** `abholen` muss die Bytes sichern, bevor irgendetwas geparst wird – erwartet:
   Datei liegt in der Ablage, auch wenn die Auswertung danach scheitert.

---

## Dateien

```
packages/elda/test/sit/
  README.md                  Bedienung, Sicherheitsregeln, Ablauf je Fenster
  sit.js                     Kommandozeile: pruefen | plan | zeigen | senden | abholen | urteil | protokoll | katalog
  testdaten.beispiel.json    Vorlage mit erfundenen Werten (auch für die Tests)
  lib/
    fenster.js               Fenstertabelle, testfreie Tage, Wiener Zeit, simuliertes Datum
    sicherheit.js            erlaubte Endpoints, Zielprüfung, Quell-IP-Vergleich
    manipulation.js          reine Umformungen einer Anfrage (Element setzen/leeren, Header)
    ablage.js                Laufordner, Laufprotokoll (JSONL), sichere Dateinamen
    transport.js             fetch: Zielprüfung → Manipulation → geschwärzter Mitschnitt → Antwort
    testdaten.js             Laden/Prüfen von testdaten.local.json, Rollen, Konten, Hersteller
    katalog.js               Fälle laden und prüfen, Plan je Fenster, Markdown
    status.js                Status je Fall aus dem Laufprotokoll
    kontext.js               ctx für die Fälle (Datum, Referenzwerte, Bestandsoptionen, Vorläufe)
    *.test.js
  faelle/
    z-zugang.js  t-transport.js  b-bestand.js  v-versichertenmeldung.js
    katalog.test.js          alle Fälle gültig und mit der Vorlage baubar
.gitignore                   + packages/*/test/sit/ablage/, packages/*/test/sit/*.local.json
packages/elda/package.json   + "test:sit"
.github/workflows/ci.yml     + npm run test:sit -w @kreiseck/elda (nach dem Build)
```

## Interfaces (verbindlich für alle Aufgaben)

```js
// lib/fenster.js
FENSTER;                       // { 'mo-vm': { wochentag: 1, von: '07:00', bis: '09:00', datum: '2025-01-01' }, … }
GUELTIG_BIS;                   // '2026-11-01'  (danach neue Zeitreise → Tabelle erneuern)
TESTFREIE_TAGE;                // ['2026-10-19', …]
wienerZeit(date)               // → { datum: 'YYYY-MM-DD', zeit: 'HH:MM:SS', wochentag: 1..7 }
aktivesFenster(jetzt)          // → 'mo-vm' | … | null
zrDatum(fenster)               // → 'YYYY-MM-DD'
wienerZeitpunkt(datum, zeit)   // → Date (Wiener Wanduhr, CET/CEST richtig)
simuliertesErstellt(fenster, jetzt) // → Date: Datum des Fensters, aktuelle Wiener Uhrzeit
ttmmjjjj(iso)                  // '2025-01-01' → '01012025'

// lib/sicherheit.js
ERLAUBTE_ENDPOINTS;            // { sit: 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService' }
endpointFuer(umgebung)         // wirft für alles außer 'sit'
pruefeZiel(url)                // wirft, wenn url nicht exakt ein erlaubter Endpoint ist
pruefeQuellIp(ist, soll)       // wirft bei fehlender oder abweichender Adresse

// lib/manipulation.js  – jede Funktion: (anfrage: { body: string, headers: object }) → neue anfrage
setzeElement(name, wert)       // <name>…</name> → <name>wert</name> (erste Fundstelle, wert XML-escaped)
leereElement(name)             // <name>…</name> → <name></name>
entferneElement(name)          // <name>…</name> → ''
setzeHeader(name, wert)        // Header setzen/überschreiben
kette(...manipulationen)       // nacheinander anwenden
elementWert(body, name)        // liest den ersten Wert (für Nonce-Wiederverwendung)

// lib/ablage.js
erstelleAblage(basis)          // → { neuerLauf(fallId) → { ordner, id }, schreibe(ordner, name, daten),
                               //     protokolliere(ereignis), ereignisse() }
sichererName(text)             // nur [A-Za-z0-9._-], max. 120 Zeichen

// lib/transport.js
erstelleSitFetch({ ablage, lauf, geheimnisse, manipulation, echterFetch })  // → fetchImpl

// lib/testdaten.js
ladeTestdaten(pfad)            // → { seriennummer, rolle(name), konto(dg, { traeger, freieDN }),
                               //     dienstgeber(dg), hersteller() }

// lib/katalog.js
GRUPPEN; AKTIONEN; GEFAHREN
validiereFall(fall)            // wirft mit Fall-ID im Text
ladeKatalog(verzeichnis)       // → Fall[] (geprüft, IDs eindeutig, Abhängigkeiten vorhanden)
planFuer(katalog, fenster, status) // → Fall[] offen + erlaubt, Abhängigkeiten vor, Gefahr 'sperre' zuletzt
alsMarkdown(katalog, status)

// lib/status.js
statusJeFall(katalog, ereignisse) // → Map id → { status, laeufe, letzter, protokollnummern, ruecksendungen, urteil }

// lib/kontext.js
baueKontext({ fenster, testdaten, ereignisse, jetzt, elda }) // → ctx
// ctx: fenster, zr (ISO), ttmmjjjj, erstellt, elda, rolle, konto, dienstgeber,
//      referenzwert(fallId), referenzwertVon(fallId), protokollnummerVon(fallId),
//      bestandVon(fallId) → { dateiName, inhalt }, bestandOptionen({ dg, traeger }), dateiName(fallId)
```

**Fall-Form** (`faelle/*.js` exportiert ein Array):

```js
{
  id: 'V01', titel: '…', zweck: '…', quelle: 'E.29, D.39',
  fenster: ['mo-vm', …] | 'jedes',
  gefahr: null | 'sperre' | 'verbraucht',
  abhaengig: ['V01'],
  erwartung: '…',
  aktion: 'auflisten' | 'senden' | 'empfangen' | 'beobachten',
  aus: ['V01'],               // nur bei 'beobachten': welche Läufe die Antwort liefern
  aufrufe: 2,                 // optional, Standard 1 – z. B. Z08: zweiter Aufruf mit der Nonce des ersten
  baue(ctx) → { manipulation?, dateiName?, inhalt?, protokollnummer? }   // nicht bei 'beobachten'
}
```

**Laufprotokoll** (`ablage/laufprotokoll.jsonl`, eine Zeile je Ereignis):

```json
{"art":"lauf","zeit":"…","fall":"V01","fenster":"mo-vm","zr":"2025-01-01","aktion":"senden","ordner":"…",
 "statusCode":"000","protokollnummer":"…","meldung":"…","referenzwerte":["…"],"dateiName":"…"}
{"art":"ruecksendung","zeit":"…","protokollnummer":"…","dateiName":"…","datei":"…","bytes":123,"sha256":"…"}
{"art":"urteil","zeit":"…","fall":"V01","status":"bestanden","notiz":"…","befund":"B004"}
```

---

### Aufgabe 1: Gerüst, Ignorieren, Testskript, CI

**Dateien:** `.gitignore`, `packages/elda/package.json`, `.github/workflows/ci.yml`,
`packages/elda/test/sit/testdaten.beispiel.json`, `packages/elda/test/sit/README.md` (Gerüst)

- [ ] `.gitignore` ergänzen: `packages/*/test/sit/ablage/` und `packages/*/test/sit/*.local.json`.
- [ ] `package.json`: `"test:sit": "node --test test/sit/lib/ test/sit/faelle/"`.
- [ ] CI: nach „Test" ein Schritt `npm run test:sit -w @kreiseck/elda` (der Build läuft davor).
- [ ] `testdaten.beispiel.json` mit erfundenen Werten: Seriennummer `'1234567'`, DG A mit Konten Träger 14 und 15,
      DG B mit Konto Träger 15 und Konto Träger 15 mit freien DN, Rollen `arbeiter`, `angestellte`,
      `arbeiterlehrling`, `angestelltenlehrling`, `geringfuegig`, `freier_dn`, `reserve_1` … `reserve_3`
      (eigene Personen für Formproben, damit sie keinen anderen Fall berühren; Muster-VSNR wie in den Paket-Tests,
      z. B. `1234010180`), Hersteller-Block.
- [ ] `git check-ignore` bestätigt beide Muster; Commit.

### Aufgabe 2: `lib/fenster.js`

- [ ] Tests zuerst (`fenster.test.js`): `wienerZeit` für einen Winter- und einen Sommerzeitpunkt;
      `aktivesFenster` für Mo 07:30 → `mo-vm`, Mo 09:30 → `null`, Mi 13:59 → `mi-nm`, Do 07:30 → `null`,
      testfreier Tag 19.10.2026 07:30 → `null`, nach `GUELTIG_BIS` → `null`;
      `wienerZeitpunkt('2025-01-01', '07:30:00')` = `2025-01-01T06:30:00Z`,
      `wienerZeitpunkt('2025-04-01', '07:30:00')` = `2025-04-01T05:30:00Z`;
      `simuliertesErstellt('mi-vm', <Mi 07:45 Wien>)` hat Wiener Datum `2026-04-01`, Uhrzeit `07:45`;
      `ttmmjjjj('2025-03-01')` = `'01032025'`.
- [ ] Umsetzen (Fenster-Tabelle laut Testkalender bis KW44, testfreie Tage Okt–Dez 2026). Tests grün, Commit.

### Aufgabe 3: `lib/sicherheit.js`

- [ ] Tests zuerst: `endpointFuer('sit')` = SIT-URL und gleich `ELDA_ENDPOINTS.sit` aus dem Paket;
      `endpointFuer('produktion')`/`('kundentest')` werfen; `pruefeZiel` akzeptiert nur die exakte SIT-URL,
      wirft bei Produktion, Kundentest, anderem Pfad, `http:`; `pruefeQuellIp` wirft bei `null`, Abweichung und
      fehlendem Soll.
- [ ] Umsetzen, Tests grün, Commit.

### Aufgabe 4: `lib/manipulation.js`

- [ ] Tests zuerst mit einem Umschlag aus `baueEldaEnvelope` (aus `dist/envelope.js`): Element setzen (inkl.
      Escaping), leeren, entfernen; nur die erste Fundstelle; Header setzen ohne die übrigen zu verlieren; `kette`;
      `elementWert`; Umformung lässt das Original unverändert.
- [ ] Umsetzen, Tests grün, Commit.

### Aufgabe 5: `lib/ablage.js`

- [ ] Tests zuerst in einem Temp-Verzeichnis: Laufordner eindeutig, Dateien `0600`, Ordner `0700`; Ereignisse werden
      angehängt und in Reihenfolge gelesen; kaputte Zeile im JSONL wird gemeldet, nicht verschluckt;
      `sichererName` entfernt Pfadtrenner und kürzt.
- [ ] Umsetzen, Tests grün, Commit.

### Aufgabe 6: `lib/transport.js`

- [ ] Tests zuerst mit Fake-`fetch`: Ziel außerhalb der Liste → wirft, Fake wird nicht aufgerufen; Manipulation wird
      vor dem Senden angewandt; Anfrage- und Antwort-Mitschnitt geschwärzt (Seriennummer, API-Key, Hash);
      Antwort, die ein Geheimnis zitiert, wird geschwärzt geschrieben; Antwort wird byte-gleich weitergereicht;
      Netzfehler wird weitergeworfen und als Ereignis vermerkt.
- [ ] Umsetzen (Schwärzung über `redigiereGeheimnisse` aus `dist/redigieren.js`), Tests grün, Commit.

### Aufgabe 7: `lib/testdaten.js`

- [ ] Tests zuerst mit `testdaten.beispiel.json`: gültige Datei lädt; fehlende Rolle → klarer Fehler mit Rollennamen;
      VSNR nicht zehnstellig / Geburtsdatum nicht `TTMMJJJJ` → Fehler; `konto('A', { traeger: '15' })` und
      `konto('B', { freieDN: true })` liefern das richtige Konto; mehrdeutiges Konto → Fehler.
- [ ] Umsetzen, Tests grün, Commit.

### Aufgabe 8: `lib/katalog.js` und `lib/status.js`

- [ ] Tests zuerst: `validiereFall` lehnt doppelte/ungültige IDs, unbekannte Gruppe/Aktion/Gefahr/Fenster, fehlende
      Abhängigkeit, fehlendes `baue` (außer bei `beobachten`) ab; `planFuer` sortiert Abhängigkeiten vor, `sperre`
      zuletzt, filtert erledigte und nicht erlaubte Fälle; `statusJeFall`: kein Ereignis → `offen`, Lauf →
      `gelaufen`, passende Rücksendung (Protokollnummer ziffernscharf im Dateinamen) → `rueckmeldung`, Urteil
      überstimmt alles; `alsMarkdown` enthält jede ID genau einmal.
- [ ] Umsetzen, Tests grün, Commit.

### Aufgabe 9: `lib/kontext.js`

- [ ] Tests zuerst: `referenzwert('V01')` eindeutig je Lauf und ≤ 16 Zeichen (REFW-Länge laut Feldtabelle prüfen);
      `referenzwertVon('V01')` liefert den Wert aus dem letzten Lauf von V01, sonst Fehler „V01 ist in dieser Woche noch
      nicht gelaufen"; `bestandOptionen({ dg: 'A', traeger: '14' })` setzt Seriennummer, VSTR, `testdaten: true`,
      `erstellt` = simuliertes Datum, laufende Datenträgernummer, Hersteller aus den Testdaten;
      `bestandVon('V01')` liest den gesicherten Bestand byte-gleich.
- [ ] Umsetzen, Tests grün, Commit.

### Aufgabe 10: Fälle für KW41 (Montag und Dienstag) und `faelle/katalog.test.js`

Werte je Fall (Personen über Rollen, Konten über `konto`, Datum = Fensterdatum; Feldbelegung nach E.29.1 und den
Beispielen aus E.29.2 – bei M8/M9/S3/S4 Namen in Grundstellung, Verweis auf die Ursprungsmeldung über `REFU`):

| ID | Aktion | Fenster | Inhalt |
|---|---|---|---|
| Z01 | auflisten | jedes | ohne Manipulation |
| Z07 | auflisten | jedes | `leereElement('nonce')` → 554 |
| Z08 | auflisten | jedes | zweiter Aufruf mit der Nonce des ersten → 552 |
| Z09 | auflisten | jedes | `leereElement('created')` → 555 |
| Z10 | auflisten | jedes | `created` = jetzt − 120 s → 551 |
| Z13 | auflisten | jedes | `Content-Type: application/xml` → 559 |
| T01 | beobachten | – | aus V01: Protokollnummer, `dateiId`, `eldaZeitstempel` |
| T02 | senden | jedes | `bestandVon('V01')` byte-gleich, gleicher Dateiname → 405 |
| T14 | empfangen | jedes | Protokollnummer `1` → 406 |
| B01 | beobachten | – | aus V01 |
| B03 | senden | jedes, nach V01 | M3 `reserve_1`, DG B/Träger 15, wie V01 aufgebaut, Satztrenner CRLF → LF |
| B11 | senden | jedes, nach V01 | M3 `reserve_2`, DG B/Träger 15, `testdaten: false` (`DM`) |
| B12 | senden | jedes, nach V01 | M3 `reserve_3`, DG B/Träger 15, `erstellt` = echte Zeit statt simuliert |
| V01 | senden | mo-vm | M3 `arbeiter`, DG A/Träger 14, BBER 01, GERF N, FRDV N, VWAZ 40:00, ADAT = Fensterdatum |
| V02 | senden | mo-vm | M3 `angestellte`, DG A/Träger 15 (eigener Bestand, VSTR 15), BBER 02, VWAZ 20:00 |
| V03 | senden | mo-nm | M3 `arbeiterlehrling`, DG A/14, BBER 03, VWAZ 40:00 |
| V04 | senden | mo-nm | M3 `angestelltenlehrling`, DG A/14, BBER 04, VWAZ 40:00 |
| V05 | senden | mo-nm | M3 `geringfuegig`, DG A/14, BBER 01, GERF J, VWAZ 10:00 |
| V06 | senden | mo-nm | M3 `freier_dn`, DG B/Konto mit freien DN, BBER 02, FRDV J |
| V07 | senden | di-vm | M6 `arbeiter` (nach V01): BBER 02, GERF N, FRDV N, ADAT = Fensterdatum |
| V15 | senden | di-vm | M4 `arbeiterlehrling` (nach V03): AGRD 30, EBSV = ADAT = Vortag des Fensterdatums, BVEN = ADAT |
| V09 | senden | di-vm | M8 `angestellte` (nach V02): REFU = REFW von V02, ADAT = RDAT = Datum des V02-Laufs, VWAZ 25:00 |
| V11 | senden | di-vm | S3 `geringfuegig` (nach V05): REFU = REFW von V05, ADAT = Datum des V05-Laufs |
| V13 | senden | di-vm | M4 `angestellte` (nach V02): AGRD 03, EBSV = Vortag, UEAB = Fensterdatum, UEBI = ADAT = Fensterdatum + 6, BVEN = ADAT (Muster Seite 316) |
| V12 | senden | di-nm | M4 `arbeiter` (nach V07): AGRD 01, EBSV = ADAT = Fensterdatum, BVEN = ADAT |
| V19 | senden | di-nm | M9 `arbeiterlehrling` (nach V15): REFU = REFW von V15, ADAT = RDAT = EBSV wie V15, AGRD 34, GERF N |
| V20 | senden | di-nm | S4 `arbeiter` (nach V12): REFU = REFW von V12, ADAT wie V12 |

- [ ] `faelle/katalog.test.js` zuerst: Katalog lädt; jeder Fall mit `baue` baut mit der Vorlage und einem Kontext,
      dessen Vorläufe aus Fake-Ereignissen kommen, ohne Fehler; jeder gebaute Bestand beginnt mit dem Vorlaufsatz und
      trägt `TM` (außer B11); Z/T-Manipulationen verändern genau das gemeinte Element.
- [ ] Fälle umsetzen, bis alle Builder-Prüfungen des Pakets grün sind. Wo der Builder einen Fall ablehnt, ist das ein
      Befund über unsere Lesart – Wert nach Quelle korrigieren, nicht die Prüfung umgehen.
- [ ] Commit.

### Aufgabe 11: `sit.js`

- [ ] Kommandos laut Interfaces; jedes Netz-Kommando prüft vorher: Fenster aktiv (oder Abbruch), `--fenster` passt
      zum aktiven, Quell-IP, Zugangsdaten vollständig (`ELDA_SIT_KUNDENPASSWORT`, `ELDA_API_KEY`; Seriennummer aus
      den Testdaten), Abhängigkeiten gelaufen. `senden`/`abholen` ohne `--ja` = Trockenlauf. `abholen --ja`: erst
      `empfangen` → Bytes sichern → Ereignis → danach Klassifikation nach Dateinamenmuster.
      HTTP 403 mit „Wartung" wird als „SIT in Wartung" gemeldet.
- [ ] Ohne Netz prüfbar: `plan`, `zeigen`, `katalog`, `protokoll`, `urteil` – jeweils einmal gegen eine Temp-Ablage
      ausführen (Test oder Skript-Aufruf im Test).
- [ ] Commit.

### Aufgabe 12: lokale Testdaten, Trockenlauf, README

- [ ] `testdaten.local.json` aus dem Stammdaten-Basispaket anlegen (nicht committen; `git status` sauber).
- [ ] Trockenlauf für jeden KW41-Fall: `node test/sit/sit.js zeigen <ID> --fenster <f>` – alle bauen.
- [ ] README: Ablauf je Fenster (06:45 Büronetz → 07:00 `pruefen` → `plan` → `senden --ja` → mittags `abholen --ja`
      → `urteil` → `protokoll`), Sicherheitsregeln, Entscheidungsregel „Versionsfrage" (siehe unten).
- [ ] `npm test` und `npm run test:sit` grün, Prettier über die neuen Dateien, Commit, PR.

**Entscheidungsregel „Versionsfrage":** VR Version 03 gilt laut E.29 ab 01.12.2025. Ob der SIT sie an Tagen annimmt,
die 2025 simulieren, ist offen. V01 (Mo 07:00) klärt das: Abweisung wegen der Version (E31 o. ä.) → die V-Fälle laufen
in ihren Ausweichfenstern am Mittwoch (Anmeldungen vormittags, Folgemeldungen nachmittags); alle Daten rechnen sie aus
dem eigenen Fenster (`ctx.zr`) und dem tatsächlichen Lauf der Ursprungsmeldung (`ctx.zrVon`). Die B-Fälle hängen an V01.

**Nach dem Review ergänzt:** Weiterleitungen verboten, Fenster vor jedem Aufruf geprüft, Seriennummer nie in der
Ausgabe, Fehler nur geschwärzt, Trockenlauf ohne Netz, abhängige Fälle werden übersprungen statt den Lauf abzubrechen,
erneutes Senden nur mit `--nochmal`, Läufe ohne Antwort zählen nicht, Ablage und Testdaten für Netzbefehle Pflicht
und außerhalb des Repos, Generalprobe räumt auf.
