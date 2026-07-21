# Design — austria-gov-connect

Anbindung an österreichische Behörden-Webservices für Node. Dieses Dokument
beschreibt das Gesamtvorhaben und spezifiziert die erste Ausbaustufe:
`@kreiseck/finanzonline-core` und `@kreiseck/rksv`.

Stand: 2026-07-20.

## 1. Ziel und Abgrenzung

Das Projekt kapselt die **Übermittlung** an Behörden — nicht deren Fachlogik.
`@kreiseck/rksv` meldet Registrierkassen und Signatureinheiten beim Finanzamt
an und prüft Belege; es ist **keine** Registrierkasse. Es erzeugt keine
Belegketten, verwaltet keinen Umsatzzähler und signiert nichts. Wer eine Kassa
baut, verwendet dieses Paket für den Behördenkontakt und implementiert die
Kassenlogik selbst.

Das Vorbild ist `id-austria-connect`: ein Paket pro Behördenkanal,
framework-agnostisch, zustandslos, minimale Abhängigkeiten.

### Geplante Pakete

| Paket | Kanal | Status |
|---|---|---|
| `@kreiseck/finanzonline-core` | FinanzOnline Session + SOAP-Transport | Ausbaustufe 1 |
| `@kreiseck/rksv` | Registrierkassen-Webservice (`rkdb`) + Belegcode offline | Ausbaustufe 1 |
| `@kreiseck/finanzonline` | Übrige FinanzOnline-Verfahren (DataBox, Uploads, UID) | später |
| `@kreiseck/elda` | Sozialversicherung (ELDA) | später |

Jede weitere Ausbaustufe bekommt eine eigene Spezifikation. Dieses Dokument
deckt ausschließlich Ausbaustufe 1 ab.

## 2. Verifizierte Grundlagen

Alle folgenden Angaben stammen aus den WSDL/XSD-Dateien unter
`https://finanzonline.bmf.gv.at/fonws/ws/` sowie den BMF-Handbüchern. Sie sind
die Basis der Implementierung; Abweichungen davon sind Fehler.

### 2.1 Session-Webservice

- WSDL: `https://finanzonline.bmf.gv.at/fonws/ws/sessionService.wsdl`,
  Schema: `https://finanzonline.bmf.gv.at/fonws/ws/session.xsd`
- Endpoint: `https://finanzonline.bmf.gv.at:443/fonws/ws/session`
- Namespace: `https://finanzonline.bmf.gv.at/fon/ws/session`
- Binding: document/literal, `soapAction` = `login` bzw. `logout`
- Operationen: `login`, `logout`. Die Message-Parts referenzieren **Elemente**;
  das den SOAP-Body füllende Wurzelelement heißt daher `loginRequest` bzw.
  `logoutRequest` (nicht `login`/`logout`). SOAP 1.1, `Content-Type:
  text/xml; charset=utf-8`, `SOAPAction`-Header gesetzt.

`loginRequest` (Feldreihenfolge ist bindend):

| Feld | Restriktion | Bedeutung |
|---|---|---|
| `tid` | `[0-9A-Za-z]{8,12}` | Teilnehmer-Identifikation |
| `benid` | 5–12 Zeichen (nur Länge, kein Muster) | Benutzer-ID des Webservice-Benutzers |
| `pin` | 5–128 Zeichen | PIN des Webservice-Benutzers |
| `herstellerid` | `[0-9A-Za-z]{10,24}` | UID des **Softwareherstellers** |

`loginResponse` (Reihenfolge): `id` (String, Session-ID), `rc` (int), `msg`
(optional).

`logoutRequest` (Feldreihenfolge ist bindend): `tid` (`[0-9A-Za-z]{8,12}`),
`benid` (`[0-9A-Za-z]{5,12}` — hier **mit** Muster, anders als bei `login`),
`id` (`[0-9A-Za-z]{10,24}`, die Session-ID).
`logoutResponse` (Reihenfolge): `rc` (int), `msg` (optional) — **kein** `id`.

Session-Returncodes: `0` ok · `-1` Session ungültig/abgelaufen · `-2`
Wartungsarbeiten · `-3` technischer Fehler · `-4` Zugangsdaten ungültig ·
`-5` Benutzer nach mehreren Fehlversuchen gesperrt · `-6` Benutzer gesperrt ·
`-7` kein Webservice-Benutzer · `-8` Teilnehmer für FinanzOnline gesperrt bzw.
nicht zur Webservice-Nutzung berechtigt.

Die Lebensdauer einer Session ist vom BMF **nicht dokumentiert**. Die Bibliothek
trifft daher keine Annahme darüber und läuft nicht in einen selbstgesetzten
Timeout; sie erkennt Ablauf ausschließlich an `rc = -1`.

### 2.2 Registrierkassen-Webservice

- Endpoint: `https://finanzonline.bmf.gv.at:443/fonws/ws/rkdb`
- Namespace: `https://finanzonline.bmf.gv.at/rkdb`
- Genau **eine** Operation: `rkdb`

**Es gibt keinen getrennten Test-Endpoint.** Testbetrieb erfolgt über das Feld
`art_uebermittlung` mit dem Wert `T` gegen dieselbe URL; `P` ist der Echtbetrieb.
Passend dazu ist `vda_id = AT9` ausschließlich bei Testübermittlungen zulässig
(sonst `rc = 999`).

Aufbau des Requests:

```
rkdbRequest
├─ tid, benid, id            Zugangsdaten + Session-ID
├─ art_uebermittlung         'T' | 'P'
├─ erzwinge_asynchron        boolean (optional)
└─ genau eines von:
   status_kasse | status_see | status_ggs | rkdb
```

Das Element `rkdb` ist ein Paket:

```
rkdb
├─ fastnr        optional, nur Parteienvertreter
├─ paket_nr      1–999999999
├─ ts_erstellung dateTime
└─ genau EINE Vorgangsart, 1..n Einträge:
   registrierung_se (max 2000) | registrierung_kasse (max 4000)
   registrierung_ggs (max 2000)
   ausfall_se | wiederinbetriebnahme_se        (max 4000)
   ausfall_kasse | wiederinbetriebnahme_kasse  (max 4000)
   ausfall_ggs | wiederinbetriebnahme_ggs      (max 4000)
   belegpruefung (genau 1)
```

### 2.3 Synchron vs. asynchron

| Paketinhalt | Verhalten |
|---|---|
| genau 1 Vorgang | **synchron** — Ergebnis steht in der SOAP-Antwort |
| mehr als 1 Vorgang | **asynchron** — Antwort ist nur Empfangsbestätigung, das Ergebnisprotokoll landet in der DataBox |

`erzwinge_asynchron = true` erzwingt asynchrone Verarbeitung auch bei einem
einzelnen Vorgang. Statusabfragen sind asynchron unzulässig (`rc = 998`).
Belegprüfung ist immer synchron und immer genau ein Beleg.

Diese Eigenschaft ist nicht wegabstrahierbar: Bei mehr als einem Vorgang
bekommt der Aufrufer kein Ergebnis. Die API muss das sichtbar machen (siehe 4.3).

### 2.4 Vorgangsarten und Felder

| Vorgang | Element | Felder |
|---|---|---|
| SEE registrieren | `registrierung_se` | `satznr`, `kundeninfo?`, `art_se`, `vda_id`, (`zertifikatsseriennummer` \| `zertifikat`) |
| SEE Ausfall / Außerbetriebnahme | `ausfall_se` | `satznr`, `kundeninfo?`, `zertifikatsseriennummer`, (`ausfall` \| `ausserbetriebnahme`) |
| SEE Ausfall-Ende | `wiederinbetriebnahme_se` | `satznr`, `kundeninfo?`, `zertifikatsseriennummer`, `ende_ausfall` |
| Kasse registrieren | `registrierung_kasse` | `satznr`, `kundeninfo?`, `kassenidentifikationsnummer`, `anmerkung?`, `benutzerschluessel` |
| Kasse Ausfall / Außerbetriebnahme | `ausfall_kasse` | `satznr`, `kundeninfo?`, `kassenidentifikationsnummer`, (`ausfall` \| `ausserbetriebnahme`) |
| Kasse Ausfall-Ende | `wiederinbetriebnahme_kasse` | `satznr`, `kundeninfo?`, `kassenidentifikationsnummer`, `ende_ausfall` |
| Status SEE | `status_see` | `fastnr?`, `paket_nr`, `ts_erstellung`, `satznr`, `zertifikatsseriennummer` |
| Status Kasse | `status_kasse` | `fastnr?`, `paket_nr`, `ts_erstellung`, `satznr`, `kassenidentifikationsnummer` |
| Belegprüfung | `belegpruefung` | `satznr`, `kundeninfo?`, `beleg` |

`ausfall` = `begruendung` + `beginn_ausfall` (nicht in der Zukunft).
`ausserbetriebnahme` = nur `begruendung`; der Zeitpunkt ist der Übermittlungszeitpunkt.

Wertebereiche:

- `art_se`: `SIGNATURKARTE` | `EIGENES_HSM` | `HSM_DIENSTLEISTER`
- `vda_id`: `[A-Z]{2}[1-9][0-9]?` — `AT1` A-Trust, `AT2` GlobalTrust, `AT9` nur Test
- `zertifikatsseriennummer`: `[0-9A-Fa-f]+`, max 50, Attribut `hex="true"` möglich, ohne `0x`-Präfix
- `benutzerschluessel`: exakt 44 Zeichen `[0-9a-zA-Z+/=]{44}` — Base64 eines AES-256-Schlüssels
- `zertifikat`: Base64 des X.509 in DER
- `begruendung` (Ausfall SEE): `1` Diebstahl/Verlust, `2` Signaturerstellung unmöglich/fehlerhaft, `99` sonstiger Grund
- `begruendung` (Ausfall Kasse): `1` Diebstahl/Verlust, `5` Erfassung/Belegerstellung nicht korrekt möglich, `99` sonstiger Grund
- `begruendung` (Außerbetriebnahme, SEE und Kasse): `6` planmäßig, `7` wegen irreparablen Ausfalls

Eine **Liste** registrierter Kassen oder Signatureinheiten gibt es als
Webservice nicht — nur die Einzelabfrage je Seriennummer bzw.
Kassenidentifikationsnummer. Status: `AKTIVIERT` | `REGISTRIERT` | `IN_BETRIEB`
| `AUSFALL`.

### 2.5 Antwort

```
rkdbResponse
├─ fastnr?, paket_nr, art_uebermittlung?, ts_erstellung, info?
└─ result (1..n)
   ├─ satznr, kundeninfo?
   ├─ rkdbMessage (1..n): rc (String!), msg
   ├─ verificationResultList?   nur Belegprüfung
   └─ abfrage_ergebnis?          nur Statusabfrage
      └─ ts_registrierung, status, ts_status
```

`rc` ist hier ein **String** (Werte wie `B1`, `V7`), nicht `int` wie beim
Session-Service. Das ist eine echte Typabweichung zwischen den beiden Diensten
und darf nicht vereinheitlicht werden.

### 2.6 Maschinenlesbarer Code (RKSV-Anlage)

XSD-Restriktion für `beleg`: UTF-8, 100–1000 Zeichen, Pattern `(_[^_]+){13}` —
also exakt 13 durch `_` getrennte Segmente mit führendem `_`.

| # | Segment | Format |
|---|---|---|
| 1 | Registrierkassen-Algorithmuskennzeichen | `RN-CM`, z. B. `R1-AT1` |
| 2 | Kassen-ID | String |
| 3 | Belegnummer | String |
| 4 | Beleg-Datum-Uhrzeit | `yyyy-MM-dd'T'HH:mm:ss`, **ohne Zeitzone**, österreichische Lokalzeit |
| 5 | Betrag-Satz-Normal | 2 Nachkommastellen, Dezimaltrennzeichen **Komma** |
| 6 | Betrag-Satz-Ermaessigt-1 | wie oben |
| 7 | Betrag-Satz-Ermaessigt-2 | wie oben |
| 8 | Betrag-Satz-Null | wie oben |
| 9 | Betrag-Satz-Besonders | wie oben |
| 10 | Stand-Umsatz-Zaehler-AES256-ICM | Standard-Base64 (nicht URL-safe), 8 Byte |
| 11 | Zertifikat-Seriennummer | UTF-8-String |
| 12 | Sig-Voriger-Beleg | Base64, SHA-256 des Vorbelegs, Bytes 0–7 |
| 13 | Signaturwert | Base64, aus Base64-URL rückkodiert |

Suite `R1-**`: Signatur **ES256**, Verkettungshash **SHA-256**, extrahierte
Bytes **N = 8**. ZDA-Kennungen: `AT0` geschlossenes System nach § 20 RKSV,
`AT1` A-Trust, `AT2` GlobalTrust, `AT9` Test, `AT100` virtueller ZDA für offene
Systeme.

Weitere Regeln:

- Der Signaturwert stammt aus der JWS-Kompaktdarstellung
  (`BASE64URL(header).BASE64URL(payload).BASE64URL(signature)`, Header fix
  `eyJhbGciOiJFUzI1NiJ9`) und wird von Base64-URL nach Standard-Base64
  umkodiert, weil `_` sonst mit dem Segmenttrenner kollidiert.
- Beim **Startbeleg** ist der Hash-Eingang für `Sig-Voriger-Beleg` der Wert von
  `Kassen-ID`, nicht ein Vorbeleg.
- Bei **Ausfall der Signatureinheit** steht statt des Signaturwerts die
  Base64-URL-Kodierung der Zeichenkette `Sicherheitseinrichtung ausgefallen`.
- **OCR-Variante** (Z 14): drei Felder — Signaturwert, Sig-Voriger-Beleg,
  Stand-Umsatz-Zaehler — sind Base32 statt Base64.
- Trainings- und Stornobuchungen tragen zusätzlich die Bezeichnung
  `Trainingsbuchung` bzw. `Stornobuchung`.

## 3. Architektur

```
austria-gov-connect/                 npm workspaces
├─ packages/
│  ├─ finanzonline-core/            @kreiseck/finanzonline-core
│  │  └─ src/
│  │     ├─ soap/
│  │     │  ├─ envelope.ts          Envelope bauen
│  │     │  ├─ parse.ts             XML lesen
│  │     │  └─ fault.ts             SOAP-Fault erkennen und typisieren
│  │     ├─ transport.ts            HTTP, Timeout, Wiederholung
│  │     ├─ session.ts              login / logout
│  │     ├─ endpoints.ts            Endpoint-Konstanten
│  │     └─ errors.ts               Fehlerhierarchie
│  └─ rksv/                         @kreiseck/rksv
│     └─ src/
│        ├─ client.ts               createRksv(), Paket-Übermittlung
│        ├─ see.ts                  Signatureinheit
│        ├─ kasse.ts                Registrierkasse
│        ├─ status.ts               Statusabfrage
│        ├─ beleg.ts                Belegprüfung
│        ├─ returncodes.ts          rc-Tabelle
│        └─ code/                   offline, netzfrei
│           ├─ decode.ts
│           ├─ pruefe.ts
│           └─ verkettung.ts
├─ examples/
├─ docs/
└─ assets/
```

Drei Prinzipien:

**Der Core kennt kein RKSV.** Er kennt Session, Transport, SOAP und Fehler.
Damit ist `@kreiseck/finanzonline` später ein zweiter Konsument, ohne dass am
Core etwas geändert werden muss.

**Der Offline-Teil ist netzfrei und abhängigkeitsfrei.** `rksv/code/` importiert
weder den Core noch HTTP, nur `node:crypto`. Wer ausschließlich Belegcodes
prüfen will, zieht keinen SOAP-Layer mit. Dieser Teil ist vollständig
deterministisch testbar.

**Zustandslos.** Kein Modul-Singleton hält eine Session. `createRksv(config)`
liefert ein Objekt; die Session wird explizit geöffnet und übergeben. Wo sie
zwischengespeichert wird, entscheidet das aufrufende Projekt.

### 3.1 Technik

- TypeScript, Kompilat CommonJS + `.d.ts` + Sourcemaps, ausschließlich `tsc`.
  Kein Bundler, kein Dual-ESM/CJS.
- Tests mit `node:test`.
- Laufzeitabhängigkeiten: keine. HTTP über `fetch` aus Node, Krypto über
  `node:crypto`.
- Der SOAP-Layer wird selbst geschrieben: Envelope über Templates, ein kleiner
  Parser für die flachen Antwortstrukturen dieser Dienste. Er ist ein
  eigenständiges Modul mit eigener Testsuite und kennt keine Fachlogik.

## 4. API

### 4.1 Core

```ts
import { createSession } from '@kreiseck/finanzonline-core';

const session = await createSession({
  tid:          process.env.FON_TID,
  benid:        process.env.FON_BENID,
  pin:          process.env.FON_PIN,
  herstellerid: process.env.FON_HERSTELLER_UID,
});
// session.id → Session-ID, kurzlebig speichern
await session.logout();
```

### 4.2 Einzelvorgänge

Bequeme Hüllen für den synchronen Fall. Sie übernehmen die Buchhaltung von
`paket_nr` und `satznr` und liefern ein echtes Ergebnis.

```ts
import { createRksv } from '@kreiseck/rksv';

const rksv = createRksv({ session, uebermittlung: 'test' });  // 'test' | 'echt'

await rksv.see.registriere({
  artSe: 'HSM_DIENSTLEISTER',
  vdaId: 'AT9',
  zertifikatsseriennummer: '1a2b3c',
});

await rksv.kasse.registriere({
  kassenidentifikationsnummer: 'KASSE-001',
  benutzerschluessel: '<44 Zeichen Base64>',
});

await rksv.kasse.meldeAusfall({
  kassenidentifikationsnummer: 'KASSE-001',
  begruendung: 5,
  beginn: new Date(),
});

await rksv.kasse.meldeWiederinbetriebnahme({ /* … */ });
await rksv.kasse.nimmAusserBetrieb({ kassenidentifikationsnummer: 'KASSE-001', begruendung: 6 });

const status = await rksv.status.kasse('KASSE-001');
// → { status: 'IN_BETRIEB', tsRegistrierung, tsStatus }

const pruefung = await rksv.beleg.pruefe('_R1-AT9_…');
// → strukturiertes Prüfprotokoll
```

Die Signatureinheit hat dieselben vier Vorgänge, adressiert über
`zertifikatsseriennummer`.

### 4.3 Batch

Explizit, weil das Ergebnis nicht zurückkommt:

```ts
const quittung = await rksv.uebermittlePaket({
  paketNr: 42,
  vorgaenge: [ /* n Vorgänge derselben Art */ ],
});
// quittung.verarbeitung === 'asynchron'
// quittung.hinweis → Ergebnisprotokoll in der DataBox abholen
```

Bei genau einem Vorgang meldet die Quittung `verarbeitung: 'synchron'` und
enthält das Ergebnis. Die Methoden aus 4.2 sind dünne Hüllen hierum.

### 4.4 Fehlerbehandlung

Der Dienst trennt technische und fachliche Fehler; die Bibliothek behält diese
Trennung bei.

**Es wird geworfen bei:** Netzfehlern, SOAP-Faults, sowie jedem negativen
Session-`rc` — `-1` (abgelaufen), `-2` (Wartung), `-3` (technisch), `-4`
(Zugangsdaten), `-5`/`-6` (Benutzer gesperrt), `-7` (kein Webservice-Benutzer),
`-8` (Teilnehmer gesperrt/nicht berechtigt). Diese Zustände sind für den
Aufrufer nicht sinnvoll weiterverarbeitbar. `rc = -1` bekommt einen eigenen
Fehlertyp (siehe unten), damit der Aufrufer den Ablauf-Fall eindeutig von den
übrigen unterscheiden kann.

Bei `rc = -1` wird **kein** automatischer neuer Login versucht. Die Bibliothek
ist zustandslos und besitzt die Zugangsdaten nach dem Login nicht mehr; ein
stiller Neu-Login würde außerdem verschleiern, dass ein Vorgang möglicherweise
schon übermittelt wurde. Stattdessen wird ein eigener Fehlertyp geworfen, an dem
der Aufrufer den Fall eindeutig erkennt und selbst entscheidet, ob er eine neue
Session öffnet und den Vorgang wiederholt.

**Es wird nicht geworfen bei fachlichen `rc`.** `B1` „Kasse bereits
registriert", `43` „Beleg fehlerhaft" und die übrigen rund fünfzig Codes sind
erwartbare Geschäftszustände. Sie kommen als typisiertes Ergebnis zurück:

```ts
const res = await rksv.kasse.registriere({ /* … */ });
if (!res.ok) {
  res.rc;   // 'B1'
  res.msg;  // Text des BMF
}
```

Eine Bibliothek darf den Aufrufer nicht zwingen, erwartbare Zustände über
`try/catch` zu behandeln.

Die Returncode-Tabelle wird als typisierte Map mitgeliefert, damit `rc` nicht
als nackter String beim Konsumenten ankommt.

### 4.5 Offline-Belegcode

Netzfrei, ohne Zugangsdaten nutzbar:

```ts
import { decodeBelegCode, pruefeBelegCode, pruefeVerkettung } from '@kreiseck/rksv/code';

const beleg = decodeBelegCode('_R1-AT1_KASSE-001_1_2026-07-20T14:23:34_…');
// beleg.rka.zda === 'AT1', beleg.betraege.normal === '10,00', …
// beleg.besonderheit → 'see-ausfall' | 'trainingsbuchung' | 'stornobuchung' | undefined

const ergebnis = pruefeBelegCode(beleg, { zertifikat });  // Zertifikat optional
// ergebnis.pruefungen[] → { name, status: 'PASS' | 'FAIL' | 'NOT_EXECUTED', detail? }

pruefeVerkettung(vorherigerBeleg, beleg);
```

`pruefeBelegCode` prüft ohne Zertifikat nur Struktur und Formate: Segmentanzahl,
Muster des Algorithmuskennzeichens, Datum, Betragsformate, Base64-Längen. Wird
ein Zertifikat oder öffentlicher Schlüssel übergeben, rekonstruiert es die
JWS-Kompaktdarstellung und verifiziert die ES256-Signatur mit `node:crypto`.
Ohne Schlüssel wird dieser Schritt als `NOT_EXECUTED` gemeldet, nicht als
Fehler.

`decodeBelegCode` erkennt die OCR-Variante an der Kodierung der drei
betroffenen Felder und normalisiert sie nach Base64.

Das Prüfergebnis verwendet dieselbe Form wie die Antwort des BMF-Webservice
(`PASS` | `FAIL` | `NOT_EXECUTED` je Einzelprüfung). Damit lassen sich lokale
Vorprüfung und amtliche Prüfung ohne Umbau nebeneinander darstellen.

## 5. Tests

- **SOAP-Layer:** eigene Testsuite gegen die realen WSDL/XSD-Strukturen —
  Envelope-Aufbau, Namespaces, Feldreihenfolge, Fault-Erkennung, Sonderzeichen-
  Maskierung.
- **Nachrichtenaufbau:** für jede Vorgangsart ein Test, der das erzeugte XML
  gegen die XSD-Restriktionen prüft (Pflichtfelder, Reihenfolge, Muster,
  Längen).
- **Antwortverarbeitung:** aufgezeichnete Antworten je Fall — synchron,
  asynchron, Statusabfrage, Belegprüfung, fachlicher Fehler, SOAP-Fault.
- **Offline-Code:** Testvektoren aus dem BMF-Mustercode, inklusive Startbeleg,
  SEE-Ausfall, Trainings- und Stornobuchung sowie OCR-Variante.
- **Integrationstests** gegen `art_uebermittlung = 'T'` mit `vda_id = 'AT9'`,
  opt-in über Umgebungsvariablen, nicht Teil des Standardlaufs.

## 6. Dokumentation

- `README.md` je Paket: Installation, Kurzbeispiel, Abgrenzung.
- `REGISTRIERUNG.md` für `@kreiseck/finanzonline-core`: Weg zum
  Webservice-Benutzer in FinanzOnline, Feld-zu-Konfiguration-Zuordnung,
  Beschaffung der Hersteller-UID, Freischaltung des Registrierkassen-Verfahrens.
- Dieses Dokument als Referenz der verifizierten Spezifikation.

## 7. Offene Punkte

- Der BMF-Mustercode kündigte für Anfang März 2026 eine Novelle der
  Detailspezifikation an (Umsatzsteuersatz 4,9 % im Feld
  `Betrag-Satz-Besonders`). Am Belegformat ändert sich laut Ankündigung nichts.
  Vor Implementierung des Code-Parsers ist die geltende Fassung in RIS
  gegenzuprüfen.
- Die Session-Lebensdauer ist nicht dokumentiert. Das Verhalten bei `rc = -1`
  ist entschieden (siehe 4.4), die tatsächliche Lebensdauer bleibt aber
  unbekannt und sollte im Testbetrieb gemessen und hier festgehalten werden.
- Geschlossene Gesamtsysteme (`registrierung_ggs` und Verwandte) sind in
  Ausbaustufe 1 nicht enthalten. Aufnahme prüfen, sobald Bedarf besteht.
