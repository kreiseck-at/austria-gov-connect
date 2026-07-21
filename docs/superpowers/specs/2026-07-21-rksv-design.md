# Spec — `@kreiseck/rksv` (rkdb-Paket + Offline-Belegcode)

Stand: 2026-07-21. Ausbaustufe 2. Die verifizierten Wire-Details (Endpoints,
Feldreihenfolgen, Muster, Vorgangsarten, Antwortstruktur, Belegformat) stehen in
`docs/design.md` §2.2–2.6 und §4.2–4.5 und sind gegen die echten
`regKasseService.wsdl` / `regKasse.xsd` / `verification.xsd` sowie den
BMF-Mustercode gepinnt. Diese Spec pinnt darauf den Paketschnitt, die API und die
paketspezifischen Entscheidungen. **Werte, die dort verifiziert sind, werden in
den Plänen wörtlich übernommen, nicht geraten.**

## 1. Decomposition — zwei unabhängige Sub-Projekte

**Paket A — `@kreiseck/rksv`** (rkdb-SOAP): übermittelt Vorgänge an den
Registrierkassen-Webservice, baut auf `@kreiseck/finanzonline-core`.

**Paket B — `@kreiseck/rksv/code`** (Offline-Belegcode): dekodiert und prüft den
maschinenlesbaren Code. Netzfrei, abhängigkeitsfrei außer `node:crypto`, kennt
weder Core noch HTTP.

Isolation ist bindend: A importiert nie `code/`, B importiert nie Netz/Core.
`code/` ist ein Subpath-Export (`@kreiseck/rksv/code`), sodass reine
Belegprüfer keinen SOAP-Layer mitziehen. Beide sind getrennte Pläne, parallel.

## 2. Vorbedingung im Core (additiv, non-breaking)

`@kreiseck/finanzonline-core`: `Session` wird um `readonly tid: string` und
`readonly benid: string` erweitert (in `createSession` bereits vorhanden, nur
durchgereicht). Grund: der rkdb-Request braucht `tid`+`benid`+`id`; `createRksv`
soll laut design.md §4.2 nur `{ session }` bekommen. Die PIN wird **nicht**
exponiert (bleibt wie bisher nach dem Login vergessen). Bestehende Tests bleiben
grün; ein Test ergänzt, dass `session.tid`/`session.benid` gesetzt sind.

## 3. Paket A — `@kreiseck/rksv`

### 3.1 Dateien

```
packages/rksv/src/
├─ client.ts        createRksv(), Paketaufbau, Envelope, Antwort-Parsing
├─ envelope.ts      rkdbRequest-XML aus Vorgangsliste (nutzt core/buildEnvelope-Bausteine)
├─ vorgaenge.ts     Typen + XML je Vorgangsart (see/kasse/status/beleg)
├─ antwort.ts       rkdbResponse -> Ergebnis[], verificationResult-Baum
├─ returncodes.ts   rc-Tabelle (String -> { kind, text }), aus BMF-PDF transkribiert
├─ see.ts kasse.ts status.ts beleg.ts   dünne Einzelvorgang-Hüllen
└─ index.ts
```

`code/` ist ein eigener Ordner/Export (Paket B), im selben Package-Verzeichnis
`packages/rksv/src/code/`, aber ohne Import-Kante zu obigem.

### 3.2 Client

```ts
import { createRksv } from '@kreiseck/rksv';

const rksv = createRksv({
  session,                       // Session aus finanzonline-core (tid, benid, id)
  uebermittlung: 'test',         // 'test' -> art_uebermittlung 'T', 'echt' -> 'P'
  fastnr,                        // optional, nur Parteienvertreter
});
```

Zustandslos: `createRksv` hält nur die übergebene Referenz, keinen Zähler.

### 3.3 Batch — `uebermittlePaket` (Kern)

```ts
const quittung = await rksv.uebermittlePaket({
  paketNr,                       // 1..999999999, PFLICHT, Aufrufer besitzt sie
  vorgaenge,                     // 1..n Vorgänge DERSELBEN Vorgangsart
  erzwingeAsynchron,             // optional boolean
});
```

Verarbeitung sichtbar gemacht (nicht wegabstrahierbar, design.md §2.3):

```ts
type Quittung =
  | { verarbeitung: 'synchron';  ergebnisse: Ergebnis[] }       // genau 1 Vorgang, nicht erzwungen async
  | { verarbeitung: 'asynchron'; hinweis: string };             // >1 Vorgang oder erzwingeAsynchron
```

`satznr` wird intern vergeben (1..n in Vorgangsreihenfolge) und im Ergebnis
zurückgereicht, sodass der Aufrufer Vorgang↔Ergebnis zuordnen kann.
`paket_nr`/`ts_erstellung` setzt der Client (ts_erstellung = jetzt, ISO ohne
Millisekunden-Rauschen wie vom Dienst erwartet).

Genau eine Vorgangsart pro Paket wird erzwungen: `vorgaenge` ist eine getypte
Union; ein Paket mit gemischten Arten wird lokal vor dem Senden mit einem
`RksvError` abgelehnt (kein Rundtrip für einen sicher ungültigen Request).

### 3.4 Ergebnis und Returncodes

```ts
interface Ergebnis {
  satznr: number;
  ok: boolean;                   // abgeleitet aus returncodes[rc].kind === 'ok'
  rc: string;                    // roher rc, z. B. 'B1' (String, maxLength 12)
  msg: string;                   // Pflichttext des BMF
  belegpruefung?: Pruefergebnis; // nur bei Belegprüfung (verificationResult-Baum)
  status?: StatusErgebnis;       // nur bei Statusabfrage
}
```

`returncodes.ts` ist eine getypte Map `Record<string, { kind: 'ok' | 'fachlich';
text: string }>`, **wörtlich transkribiert aus dem BMF-Handbuch
„Registrierkassen-Webservice"** (die rund fünfzig Codes). Ein unbekannter rc wird
nicht geraten, sondern als `{ kind: 'fachlich', text: '<unbekannt>' }` mit dem
rohen rc weitergereicht. `ok` ergibt sich ausschließlich aus dieser Tabelle.

**Werfen vs. nicht werfen** (design.md §4.4, geerbt vom Core): technische Fehler
(Netz, SOAP-Fault, negativer Session-rc, unparsebare Antwort) werfen. Fachliche
`rc` werfen **nie** — sie kommen als `Ergebnis`. Der Aufrufer wird nicht
gezwungen, erwartbare Geschäftszustände über try/catch zu behandeln.

### 3.5 Einzelvorgang-Hüllen (§4.2)

Dünne, synchrone Hüllen über `uebermittlePaket` mit genau einem Vorgang. Jede
verlangt `paketNr` (Pflicht, wie oben). Beispiele:

```ts
await rksv.kasse.registriere({ paketNr, kassenidentifikationsnummer, benutzerschluessel, anmerkung? });
await rksv.kasse.meldeAusfall({ paketNr, kassenidentifikationsnummer, begruendung, beginn });
await rksv.kasse.meldeWiederinbetriebnahme({ paketNr, kassenidentifikationsnummer, ende });
await rksv.kasse.nimmAusserBetrieb({ paketNr, kassenidentifikationsnummer, begruendung });
const st = await rksv.status.kasse({ paketNr, kassenidentifikationsnummer }); // -> StatusErgebnis
const pr = await rksv.beleg.pruefe({ paketNr, beleg });                        // -> Pruefergebnis

// SEE identisch, adressiert über zertifikatsseriennummer statt kassenidentifikationsnummer
await rksv.see.registriere({ paketNr, artSe, vdaId, zertifikatsseriennummer | zertifikat });
```

Jede Hülle liefert bei genau einem Vorgang direkt das `Ergebnis` (bzw. dessen
`belegpruefung`/`status`), nicht die Quittung-Union — die Sync-Garantie gilt hier
per Konstruktion (1 Vorgang, nicht erzwungen async). Feldvalidierung (Muster aus
§2.4) erfolgt lokal vor dem Senden.

## 4. Paket B — `@kreiseck/rksv/code`

### 4.1 Dateien

```
packages/rksv/src/code/
├─ decode.ts        decodeBelegCode(): 13 Segmente -> struktur, OCR-Base32-Erkennung
├─ pruefe.ts        pruefeBelegCode(): Struktur/Format; ES256 mit node:crypto
├─ verkettung.ts    pruefeVerkettung(): SHA-256-Verkettung Vorbeleg<-Beleg
└─ index.ts
```

### 4.2 API (design.md §4.5)

```ts
import { decodeBelegCode, pruefeBelegCode, pruefeVerkettung } from '@kreiseck/rksv/code';

const beleg = decodeBelegCode('_R1-AT1_KASSE-001_1_2026-07-20T14:23:34_10,00_…');
// beleg.rka.zda, beleg.betraege.normal, beleg.besonderheit?  ('see-ausfall'|'trainingsbuchung'|'stornobuchung')

const ergebnis = pruefeBelegCode(beleg, { zertifikat });   // zertifikat optional
// ergebnis.pruefungen[]: { name, status: 'PASS'|'FAIL'|'NOT_EXECUTED', detail? }

pruefeVerkettung(beleg, vorherigerBeleg);   // Startbeleg: pruefeVerkettung(beleg)
```

Ergebnisform spiegelt bewusst `verificationState` (`PASS`|`FAIL`|`NOT_EXECUTED`)
des amtlichen Webservice (design.md §2.5), damit lokale Vorprüfung und amtliche
Prüfung ohne Umbau nebeneinander darstellbar sind. Ohne Schlüssel wird die
Signaturprüfung als `NOT_EXECUTED` gemeldet, nicht als Fehler.

### 4.3 Verifizierte Formatregeln (design.md §2.6, Novelle geklärt)

13 Segmente, Pattern `(_[^_]+){13}`; Betragsfelder mit Dezimalkomma; Segment 10
Standard-Base64 (8 Byte Umsatzzähler); Signatur ES256, Verkettung SHA-256, N=8;
JWS-Kompaktdarstellung mit fixem Header `eyJhbGciOiJFUzI1NiJ9`, Signaturwert von
Base64-URL nach Standard-Base64 umkodiert; SEE-Ausfall-Ersatztext; OCR-Variante
mit Base32 in drei Feldern; Trainings-/Stornobuchung. **4,9 % USt ändert das
Format nicht** — Betrag-Satz-Besonders bleibt ein rein numerisches Feld.

## 5. Fehlerbehandlung

Paket A erbt die Fehlerhierarchie des Core und ergänzt `RksvError extends
FonError` für lokale Validierungsfehler (ungültige Felder, gemischte
Vorgangsarten im Paket, ungültige paketNr). Paket B ist rein funktional: keine
Würfe für erwartbare Prüfausgänge (die sind `FAIL`/`NOT_EXECUTED` im Ergebnis);
ein `RksvCodeError` nur bei strukturell unmöglicher Eingabe (falsche Segmentzahl),
damit `decodeBelegCode` auf Müll klar reagiert.

## 6. Tests

- **Nachrichtenaufbau (A):** je Vorgangsart ein Test, der das erzeugte
  rkdbRequest-XML gegen die XSD-Restriktionen prüft (Pflichtfelder, Reihenfolge,
  Muster, maxOccurs, genau-eine-Vorgangsart).
- **Antwortverarbeitung (A):** aufgezeichnete rkdbResponse-Fälle — synchron,
  asynchron-Quittung, Statusabfrage, Belegprüfung (verificationResult-Baum),
  fachlicher rc, SOAP-Fault. `fetch` injiziert wie in core.
- **Returncodes (A):** Tabelle vollständig geladen; ok/fachlich-Klassifikation;
  unbekannter rc wird durchgereicht, nicht geraten.
- **Offline-Code (B):** Testvektoren aus dem BMF-Mustercode — Startbeleg,
  SEE-Ausfall, Trainings-/Stornobuchung, OCR-Variante, Verkettung; ES256 mit
  bekanntem Schlüssel PASS, ohne Schlüssel NOT_EXECUTED, manipulierter Beleg FAIL.
- **Isolation:** ein Test/Lint-Check, dass `code/` nichts aus Core/HTTP importiert.
- Alle deterministisch, netzfrei; Node ≥ 18.18, `node:test`, keine Runtime-Deps.

## 7. Noch zu transkribieren (verifizierte Quelle, nicht raten)

- Die vollständige rkdb-rc-Tabelle für `returncodes.ts` stammt aus dem
  BMF-Handbuch „Registrierkassen-Webservice" (PDF). Sie wird beim Planschreiben
  daraus gezogen, nicht erfunden. Bis dahin ist die Struktur (String→{kind,text})
  festgelegt, der Inhalt offen.
- BMF-Mustercode-Testvektoren für Paket B werden beim Planschreiben aus dem
  offiziellen Repo/Anlagen gezogen.
