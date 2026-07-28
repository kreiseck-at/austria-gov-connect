# @kreiseck/elda — Transfer-Webservice (v1) Design

**Ziel:** Ein neues Monorepo-Paket `@kreiseck/elda` für den elektronischen
Datenaustausch mit der österreichischen Sozialversicherung (ELDA, Dachverband/ÖGK).
**v1 deckt den ELDA Transfer-Webservice v4 zu 100 % ab** — die Transport-Schicht
zum Senden von Meldungs-Dateien und Abholen der Rücksendungen. Die fachlichen
Meldungs-Builder (Anmeldung/Abmeldung/mBGM …) sind ein dokumentierter
Erweiterungspunkt für v2 (brauchen die SV-Datensatzbeschreibung — nicht raten).

## Harte Vorgaben (aus dem Brainstorming)

- **100 % API-Abdeckung, nichts geraten, nichts übersprungen.** Jede Methode,
  jedes Request-/Result-Feld, jeder Status-Code der Transfer-Webservice-Spec V4
  ist umgesetzt und getestet.
- **Vollständige Doku + Beispiele.** JSDoc am gesamten öffentlichen API + eine
  README mit realen End-to-End-Beispielen, sodass sich ein späterer Integrator
  zu 100 % auskennt, ohne die BMF-/ELDA-PDFs lesen zu müssen.
- **Sehr einfach zu implementieren** (klares API, sinnvolle Defaults, ein
  `create…`-Factory wie die anderen Pakete).
- Monorepo-Standard: **keine Laufzeitabhängigkeiten** (außer ggf.
  `@kreiseck/finanzonline-core` für den SOAP-Layer), Node/TypeScript, `node:test`,
  CJS via `tsc`, Apache-2.0, framework-agnostisch, zustandslos.

## Quelle (verifiziert, nicht geraten)

ELDA „Transfer Webservice v4", Schnittstellenbeschreibung V4 (05/2026),
`https://www.elda.at/cdscontent/load?contentid=10008.807116`. SOAP-Webservice,
Namespace `http://v4.transfer.ws.elda.at/`.

## Architektur — zwei Schichten

1. **Transport (v1):** SOAP-Client gegen den Transfer-Webservice. Trägt beliebige
   Dateien (die Meldungs-XMLs sind der Datei-Inhalt).
2. **Meldungen (v2, Erweiterungspunkt):** Builder, die das Datei-XML je Meldungsart
   nach der SV-Datensatzbeschreibung erzeugen. In v1 NICHT gebaut, aber im
   Package-Layout + README als nächster Schritt dokumentiert.

## Transfer-Webservice v4 — vollständige Spec (Basis der Umsetzung)

**Endpoints** (eine URL je Umgebung, alle Methoden dorthin):
- Produktion: `https://online.elda.at/eldaws/transfer/v4/TransferService`
- Kundentest (Kundenintegration): `https://online-test.elda.at/eldaws/transfer/v4/TransferService`
- SIT (Systemintegrationstest): `https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService`

**SecurityParameters** (in JEDEM Request, alle obligatorisch):
- `nonce` (String) — zufällige, eindeutige Zeichenkette (Replay-Schutz). `randomUUID()`.
- `created` (Date) — Erstellzeitpunkt; Request nur ~60 s gültig.
- `seriennummer` (String) — Seriennummer des ELDA-Kunden.
- `kundenpasswort` (String) — Kundenpasswort im Format **SHA-512 hex lowercase**.
- `apiKey` (String) — von ELDA vergebener Client-Identifikator.

**Methoden (3):**
- `senden` — Datei übertragen. Request: `dateiName` (String) + `payload`
  (base64Binary, als SOAP-Attachment/`cid:`). Result: `serviceResult.statusCode`,
  `dateiId` (Long), `eldaZeitstempel` (Date), `protokollnummer` (Long).
- `ruecksendungenAuflisten` — keine Zusatzparameter. Result: `serviceResult.statusCode`
  + `ruecksendungen` (List<`{protokollnummer:Long, dateiName:String}`>). Der
  `dateiName` der Rücksendung enthält die Protokollnummer der ursprünglichen
  Sendung (Korrelation).
- `empfangen` — Request: `protokollnummer` (Long). Result: `serviceResult.statusCode`
  + `datei` (`{id:Long, name:String, payload:binary(Attachment), dateiTyp:Integer, md5:String}`).
  **Einmalig** — nach erfolgreichem Abruf ist die Rücksendung weg.

**Status-Codes (vollständig, 1:1 aus der Spec):**
`000` OK · `500` interner Verarbeitungsfehler · `551` Request abgelaufen (created
> 60 s) · `552` Nonce bereits verwendet · `553` Seriennummer für dieses Service
nicht berechtigt · `554` Nonce nicht gesetzt · `555` created nicht gesetzt · `557`
API-Key ungültig · `558` Seriennummer und/oder Kundenpasswort falsch · `559`
unerlaubter Content-Type · `401` dateiName zu lang (max 255) · `402` dateiName
nicht gesetzt · `403` Datei nicht verarbeitet (`messages` trägt den auslösenden
Fehlercode, z. B. „fehlerCode: E1") · `404` Datei wird noch verarbeitet
(Verarbeitung > 40 s) · `405` Datei ist Duplikat (`messages`: „duplikatVon:
<protokollnr>") · `406` Datei mit Protokollnummer nicht vorhanden · `407` keine
Berechtigung (Seriennummer stimmt nicht mit der ursprünglich übermittelten Datei
überein) · `408` Datei laut Protokollnummer bereits empfangen.

## Öffentliches API (v1)

```ts
export type EldaUmgebung = 'produktion' | 'kundentest' | 'sit';

export interface EldaConfig {
  seriennummer: string;
  /** Kundenpasswort im KLARTEXT — wird intern zu SHA-512 hex lowercase gehasht. */
  kundenpasswort: string;
  apiKey: string;
  /** Standard: 'produktion'. */
  umgebung?: EldaUmgebung;
  /** Optionaler Endpoint-Override (sonst aus `umgebung`). */
  endpoint?: string;
  transport?: TransportOptions; // Timeout/Retry/fetchImpl wie in finanzonline-core
}

export interface EldaTransfer {
  /** Überträgt eine Datei (= eine Meldung). `inhalt` ist der Datei-Payload. */
  senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<SendenErgebnis>;
  /** Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle). */
  ruecksendungenAuflisten(): Promise<Ruecksendung[]>;
  /** Holt EINE Rücksendung per Protokollnummer (einmalig). */
  empfangen(protokollnummer: string | number): Promise<EmpfangenErgebnis>;
}

export interface SendenErgebnis {
  statusCode: string;          // '000' = OK
  ok: boolean;                 // statusCode === '000'
  protokollnummer?: string;    // Referenz der Sendung
  dateiId?: string;
  eldaZeitstempel?: string;
  meldung?: string;            // serviceResult.messages (z. B. Fehlercode)
}
export interface Ruecksendung { protokollnummer: string; dateiName: string; }
export interface EmpfangenErgebnis {
  statusCode: string;
  ok: boolean;
  datei?: { id?: string; name?: string; inhalt: Buffer; dateiTyp?: number; md5?: string };
  meldung?: string;
}

export function createEldaTransfer(config: EldaConfig): EldaTransfer;
```

Zusätzlich exportiert: `ELDA_ENDPOINTS` (Map Umgebung→URL), `ELDA_STATUS`
(Code→Klartext, für Konsumenten-Anzeige), `istOk(statusCode)`, und eine
Korrelations-Hilfe `zuordnung(sendungsProtokollnummer, ruecksendungen)` (findet die
Rücksendung, deren `dateiName` die Sendungs-Protokollnummer enthält — FAQ 8.1).

## Offene technische Frage (verifizieren, NICHT raten)

Der `payload` ist laut Spec ein **MTOM/XOP-Attachment** (`<payload>cid:…`). Unser
FON-SOAP-Layer sendet bisher nur reinen Text-Body (kein MTOM/multipart). Vor der
Transport-Implementierung wird gegen das **ELDA-Kundentestsystem** verifiziert, ob
(a) MTOM (multipart/related) nötig ist oder (b) inline `base64Binary` im Body
akzeptiert wird. Ergebnis bestimmt, ob der SOAP-Layer um MTOM erweitert wird. Kein
Raten — es wird live getestet, bevor der Sendepfad festgeschrieben wird.

## Fehlerbehandlung

- Technische Fehler → SOAP-Fault (über den bestehenden `detectFault`).
- Fachliche Fehler → `serviceResult.statusCode` ≠ `000` wird im Ergebnis-Objekt
  durchgereicht (`ok:false`, `meldung`), NICHT geworfen — der Aufrufer entscheidet
  (analog zur rksv-/FON-Philosophie: fachliche rc werfen nicht).
- `senden` `000` bedeutet „von ELDA EMPFANGEN", nicht „fachlich verarbeitet" — die
  fachliche Rückmeldung kommt asynchron via `empfangen`. Das ist in JSDoc + README
  prominent dokumentiert.

## Dokumentation + Beispiele (harte Vorgabe)

- **JSDoc** an jedem exportierten Symbol (Config-Feld, Methode, Ergebnis-Feld,
  Status-Code) — mit Bedeutung + Wertebereich.
- **README** mit: Setup (Zugangsdaten woher), dem vollständigen End-to-End-Beispiel
  (Datei senden → protokollnummer → auflisten → zuordnen → empfangen → Protokoll),
  einer Status-Code-Tabelle, dem async/„empfangen einmalig"-Hinweis, und einem
  klaren Abschnitt „Was v1 (Transport) kann und was die Meldungs-Builder (v2) tun
  werden". Ziel: 100 % Selbsterklärung für spätere Integratoren.

## Datei-/Modul-Struktur

- `packages/elda/src/endpoints.ts` — `ELDA_ENDPOINTS`, Namespace.
- `packages/elda/src/security.ts` — `securityParameters` bauen (SHA-512, nonce, created), rein/testbar.
- `packages/elda/src/status.ts` — `ELDA_STATUS` (Code→Text), `istOk`.
- `packages/elda/src/transfer.ts` — `createEldaTransfer` + die 3 Methoden + Envelope/Parse.
- `packages/elda/src/zuordnung.ts` — Korrelations-Hilfe (rein/testbar).
- `packages/elda/src/index.ts` — Barrel-Export.
- `packages/elda/README.md` — Doku + Beispiele.
- Tests je Modul (`*.test.ts`, `node:test`).

## Testing

- **Rein:** `securityParameters` (SHA-512 korrekt, nonce eindeutig, created-Format),
  `status`/`istOk`, `zuordnung` (Protokollnummer-Match im dateiName, Nicht-Match).
- **Transport (SOAP gemockt via `fetchImpl`):** Envelope-Bau je Methode, Parsing von
  `senden`/`ruecksendungenAuflisten`/`empfangen`-Response, jeder relevante
  Status-Code (000/401–408/55x), SOAP-Fault → Fehler.
- **Optional live** gegen Kundentest (env-gated, opt-in) — u. a. zur MTOM-Klärung.

## Nicht in v1 (bewusst)

- **Meldungs-Builder** (Anmeldung, Anmeldung fallweise Beschäftigter,
  Vor-Ort-Anmeldung, Abmeldung, Änderungsmeldung, Adressmeldung,
  Versicherungsnummer-Anforderung, mBGM + Varianten, jeweils inkl. Storno/
  Richtigstellung) — brauchen die SV-Datensatzbeschreibung. Package-Layout +
  README halten den Platz frei; v2 holt die Datensatzbeschreibung „ohne raten".

## Offene Punkte

- MTOM vs. inline-base64 (siehe oben) — vor der Sendepfad-Implementierung live klären.
- Genaues `created`-Datumsformat (ISO mit Zeitzone `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`
  laut Beispiel) am Kundentest bestätigen.
- Volle Liste der Meldungsarten für v2 ist bereits recherchiert (ÖGK-Meldungskatalog);
  Feldschema je Meldung folgt aus der Datensatzbeschreibung.
