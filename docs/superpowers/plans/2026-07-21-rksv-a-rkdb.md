# Plan A — `@kreiseck/rksv` (rkdb-SOAP-Paket) Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Paket `@kreiseck/rksv` bauen: Übermittlung von Registrierkassen-/Signatureinheit-Vorgängen an den FinanzOnline rkdb-Webservice (registrieren, Ausfall, Wiederinbetriebnahme, Außerbetriebnahme, Belegprüfung, Statusabfrage), synchron/asynchron sichtbar, fachliche Returncodes typisiert.

**Architecture:** `@kreiseck/rksv` baut auf `@kreiseck/finanzonline-core` (`callSoap`, `parseXml`, `escapeXmlText`). Ein Request-Builder erzeugt das genestete `rkdbRequest`-XML (Choice `rkdb` mit Vorgangsliste ODER `status_*`), ein Antwort-Parser liest `rkdbResponse` in typisierte Ergebnisse (inkl. `verificationResult`-Baum), eine Returncode-Tabelle klassifiziert `rc`. `createRksv` liefert `uebermittlePaket` (Batch, Kern) plus dünne Einzelvorgang-Hüllen. Zustandslos.

**Tech Stack:** TypeScript strict (CommonJS), `node:test`, keine Dritt-Runtime-Deps (nur der Workspace `@kreiseck/finanzonline-core`).

## Global Constraints

- **Verifizierte Quelle:** `docs/design.md` §2.2–2.5 und §4.2–4.4, gepinnt gegen `regKasseService.wsdl`, `regKasse.xsd`, `regKasseWs.xsd`, `verification.xsd` sowie das BMF-Handbuch „Registrierkassen-Webservice" (Stand 20.12.2016). Werte daraus werden **wörtlich** übernommen, nie geraten.
- Endpoint `https://finanzonline.bmf.gv.at/fonws/ws/rkdb`, Namespace `https://finanzonline.bmf.gv.at/rkdb`, Operation/soapAction `rkdb`, Request-Wurzelelement `rkdbRequest`, Response `rkdbResponse`.
- `rkdbRequest`-Reihenfolge: `tid`, `benid`, `id`, `art_uebermittlung` (`T`|`P`), `erzwinge_asynchron`? (boolean), dann **genau eines** von `status_kasse` | `status_see` | `status_ggs` | `rkdb`.
- `rkdb`-Element: `fastnr`?, `paket_nr` (1–999999999), `ts_erstellung` (dateTime), dann **genau eine** Vorgangsart, 1..n Einträge (maxOccurs: `registrierung_se` 2000, `registrierung_kasse` 4000, `ausfall_se`/`wiederinbetriebnahme_se`/`ausfall_kasse`/`wiederinbetriebnahme_kasse` 4000, `belegpruefung` 1).
- `rkdbMessage.rc` ist **`xs:string`** (maxLength 12), `msg` Pflicht. `rc` `"0"` = ok; `"-1".."-4"` = technisch (werfen); alle übrigen = fachlich (`{ ok:false, rc, msg }`, nie werfen).
- Sync/Async (§2.3): genau 1 Vorgang → synchron (Ergebnis in Antwort); >1 → asynchron (nur Empfangsbestätigung → DataBox); `erzwinge_asynchron=true` erzwingt async. Statusabfragen sind **immer synchron** (async → rc 998). Belegprüfung immer genau 1, synchron.
- `paket_nr` ist **Pflichtparameter** des Aufrufers (Idempotenz); `satznr` vergibt die Bibliothek intern (1..n).
- Muster (§2.4): `vda_id` `[A-Z]{2}[1-9][0-9]?`; `zertifikatsseriennummer` `[0-9A-Fa-f]+` (max 50); `benutzerschluessel` `[0-9a-zA-Z+/=]{44}`; `art_se` ∈ {SIGNATURKARTE, EIGENES_HSM, HSM_DIENSTLEISTER}. Begründungscodes: Ausfall SEE {1,2,99}, Ausfall Kasse {1,5,99}, Außerbetriebnahme {6,7}.
- `art_uebermittlung='T'` erlaubt `vda_id='AT9'`; sonst rc 999.
- No runtime deps außer `@kreiseck/finanzonline-core`. `strict` + `noUncheckedIndexedAccess`. Node ≥ 18.18. Lizenz Apache-2.0.
- No footprint: keine KI-/Assistenten-Marker in Code, Kommentaren, Commits, Dateinamen. Commit-Messages ohne Co-Author-/Tool-Trailer.
- **GGS (`status_ggs`, `registrierung_ggs` etc.) ist NICHT Teil dieses Plans** (design.md §7).

**Voraussetzung:** `@kreiseck/finanzonline-core` muss gebaut sein (`dist/`), bevor `@kreiseck/rksv` kompiliert/getestet wird. Task 1 baut es einmalig; da `src/finanzonline-core` in diesem Plan nur additiv (Task 1) verändert wird, bleibt `dist/` danach gültig.

---

### Task 1: Core erweitern — Session trägt tid/benid, escapeXmlText exportiert

**Files:**
- Modify: `packages/finanzonline-core/src/session.ts`
- Modify: `packages/finanzonline-core/src/index.ts`
- Test: `packages/finanzonline-core/src/session.test.ts` (ergänzen)

**Interfaces:**
- Consumes: bestehendes `createSession`.
- Produces: `Session` erhält `readonly tid: string` und `readonly benid: string`. `index.ts` re-exportiert zusätzlich `escapeXmlText` (aus `./soap/escape`), die Parser-Helfer `firstChild`/`childText`/`findDescendant` (aus `./soap/parse`) und `sessionErrorFor` (aus `./errors`) — alle von `@kreiseck/rksv` benötigt.

- [ ] **Step 1: Failing test ergänzen** — in `session.test.ts` einen Test anhängen:

```ts
test('createSession stellt tid und benid am Session-Objekt bereit', async () => {
  const session = await createSession({
    ...VALID,
    transport: { fetchImpl: respond(loginOk('SESSION0001')) },
  });
  assert.equal(session.tid, VALID.tid);
  assert.equal(session.benid, VALID.benid);
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `session.tid`/`benid` sind `undefined` bzw. Property fehlt im Typ.

- [ ] **Step 3: Session-Interface und Rückgabe erweitern**

In `session.ts` das Interface ergänzen:

```ts
export interface Session {
  readonly id: string;
  readonly tid: string;
  readonly benid: string;
  logout(): Promise<void>;
}
```

Im `return` von `createSession` `tid`/`benid` ergänzen (Rest unverändert):

```ts
  return {
    id: sessionId,
    tid: config.tid,
    benid: config.benid,
    async logout(): Promise<void> {
```

- [ ] **Step 4: Zusätzliche Symbole aus index.ts re-exportieren**

In `packages/finanzonline-core/src/index.ts` ergänzen (die bestehende
`parseXml`/`XmlNode`-Export-Zeile bleibt; hier kommen die Helfer und
`escapeXmlText`/`sessionErrorFor` dazu):

```ts
export { escapeXmlText } from './soap/escape';
export { firstChild, childText, findDescendant } from './soap/parse';
export { sessionErrorFor } from './errors';
```

- [ ] **Step 5: Tests + Build**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS (bestehende + neuer Test).
Run: `npm run build -w @kreiseck/finanzonline-core`
Expected: sauberer Build, `dist/` aktualisiert.

- [ ] **Step 6: Commit**

```bash
git add packages/finanzonline-core/src/session.ts packages/finanzonline-core/src/index.ts packages/finanzonline-core/src/session.test.ts
git commit -m "feat(finanzonline-core): Session traegt tid/benid, escapeXmlText exportiert"
```

---

### Task 2: Paketgerüst `@kreiseck/rksv`

**Files:**
- Create: `packages/rksv/package.json`
- Create: `packages/rksv/tsconfig.json`
- Create: `packages/rksv/tsconfig.test.json`
- Create: `packages/rksv/src/smoke.test.ts`

**Interfaces:**
- Consumes: `@kreiseck/finanzonline-core` (gebaut in Task 1).
- Produces: lauffähige Toolchain für `@kreiseck/rksv` mit Subpath-Export `./code`.

- [ ] **Step 1: package.json anlegen**

`packages/rksv/package.json`:
```json
{
  "name": "@kreiseck/rksv",
  "version": "0.0.0",
  "description": "FinanzOnline Registrierkassen-Webservice (RKSV) und Offline-Belegcode",
  "license": "Apache-2.0",
  "type": "commonjs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./code": { "types": "./dist/code/index.d.ts", "default": "./dist/code/index.js" }
  },
  "files": ["dist"],
  "engines": { "node": ">=18.18" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "tsc -p tsconfig.test.json && node --test $(find test-dist -name '*.test.js')",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@kreiseck/finanzonline-core": "*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0"
  }
}
```

- [ ] **Step 2: tsconfig-Dateien anlegen**

`packages/rksv/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/rksv/tsconfig.test.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "test-dist",
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Smoke-Test**

`packages/rksv/src/smoke.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '@kreiseck/finanzonline-core';

test('Core ist als Workspace-Dependency auflösbar', () => {
  assert.equal(typeof createSession, 'function');
});
```

- [ ] **Step 4: Installieren, Core bauen, testen**

Run: `npm install`
Run: `npm run build -w @kreiseck/finanzonline-core`
Run: `npm test -w @kreiseck/rksv`
Expected: PASS (`# pass 1`). Falls der Import nicht auflöst: sicherstellen, dass Core gebaut ist (`dist/index.js` existiert).

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/package.json packages/rksv/tsconfig.json packages/rksv/tsconfig.test.json packages/rksv/src/smoke.test.ts package-lock.json
git commit -m "feat(rksv): Paketgeruest mit Subpath-Export ./code und Core-Dependency"
```

---

### Task 3: Returncode-Tabelle (`returncodes.ts`)

**Files:**
- Create: `packages/rksv/src/returncodes.ts`
- Test: `packages/rksv/src/returncodes.test.ts`

**Interfaces:**
- Produces: `type RcKind = 'ok' | 'technisch' | 'fachlich'`; `interface RcInfo { kind: RcKind; text: string }`; `const RKDB_RC: Record<string, RcInfo>`; `rcInfo(rc: string): RcInfo`; `rcIsOk(rc): boolean`; `rcIsTechnical(rc): boolean`.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/returncodes.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rcInfo, rcIsOk, rcIsTechnical, RKDB_RC } from './returncodes';

test('"0" ist ok', () => {
  assert.equal(rcIsOk('0'), true);
  assert.equal(rcInfo('0').kind, 'ok');
});

test('-1 bis -4 sind technisch', () => {
  for (const rc of ['-1', '-2', '-3', '-4']) {
    assert.equal(rcIsTechnical(rc), true, rc);
    assert.equal(rcInfo(rc).kind, 'technisch', rc);
  }
});

test('B1 ist ein fachlicher Zustand mit Text', () => {
  assert.equal(rcInfo('B1').kind, 'fachlich');
  assert.match(rcInfo('B1').text, /bereits registriert/i);
  assert.equal(rcIsOk('B1'), false);
});

test('43 (Beleg fehlerhaft) ist fachlich', () => {
  assert.equal(rcInfo('43').kind, 'fachlich');
});

test('unbekannter rc wird nicht geraten, sondern als fachlich mit rohem Code durchgereicht', () => {
  const info = rcInfo('ZZ');
  assert.equal(info.kind, 'fachlich');
  assert.match(info.text, /ZZ/);
});

test('Tabelle enthält die verifizierten Codes vollständig', () => {
  for (const rc of ['0','-1','-2','-3','-4','4','5','6','7','8','9','13','14','27','28','29','30','31','32','36','41','43','998','999','1336','1337','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B13','B14','B15','B18','B19','B20','B21','B22','B28','B29','B30','B32','B33','B34','B35','C1','V1','V16']) {
    assert.ok(RKDB_RC[rc], `fehlt: ${rc}`);
  }
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './returncodes'`.

- [ ] **Step 3: Implementierung schreiben** (Texte wörtlich aus dem BMF-Handbuch)

`packages/rksv/src/returncodes.ts`:
```ts
export type RcKind = 'ok' | 'technisch' | 'fachlich';

export interface RcInfo {
  kind: RcKind;
  text: string;
}

const INTERN = (code: string): RcInfo => ({
  kind: 'fachlich',
  text: `Interner Fehler (${code}) — später erneut versuchen oder Hotline kontaktieren`,
});

export const RKDB_RC: Record<string, RcInfo> = {
  '0': { kind: 'ok', text: 'Aufruf ok' },
  '-1': { kind: 'technisch', text: 'Session ungültig oder abgelaufen' },
  '-2': { kind: 'technisch', text: 'Webservice wegen Wartungsarbeiten nicht möglich' },
  '-3': { kind: 'technisch', text: 'Technischer Fehler' },
  '-4': { kind: 'technisch', text: 'Teilnehmer für diese Funktion nicht berechtigt' },
  '4': { kind: 'fachlich', text: 'Mit der angegebenen Seriennummer wurde beim VDA kein Zertifikat gefunden' },
  '5': { kind: 'fachlich', text: 'Der Status des Zertifikates ist nicht gültig' },
  '6': { kind: 'fachlich', text: 'OID für „Österreichische Finanzverwaltung Registrierkasseninhaber" nicht vorhanden' },
  '7': { kind: 'fachlich', text: 'Ordnungsbegriff im Zertifikat nicht dem registrierenden Unternehmen zugeordnet' },
  '8': { kind: 'fachlich', text: 'Wert in der OID für Registrierkasseninhaber ungültig' },
  '9': { kind: 'fachlich', text: 'Das Zertifikat ist fehlerhaft' },
  '13': { kind: 'fachlich', text: 'SEE-Registrierung nicht möglich: weder Steuernummer, UID noch GLN in der Finanzverwaltung vorhanden' },
  '14': { kind: 'fachlich', text: 'Zugriff auf die Zertifikate des VDA aktuell nicht möglich' },
  '27': { kind: 'fachlich', text: 'Angegebener Ordnungsbegriff ist ungültig' },
  '28': { kind: 'fachlich', text: 'Angegebener Ordnungsbegriff nicht dem registrierenden Unternehmen zugeordnet' },
  '29': { kind: 'fachlich', text: 'Der öffentliche Schlüssel ist ungültig' },
  '30': { kind: 'fachlich', text: 'Der öffentliche Schlüssel entspricht nicht dem veröffentlichten Format' },
  '31': { kind: 'fachlich', text: 'Überprüfung des Zertifikates fehlgeschlagen' },
  '32': { kind: 'fachlich', text: 'Keine steuerliche Vertretungsvollmacht vorhanden' },
  '36': { kind: 'fachlich', text: 'Angegebene vda_id ist nicht zulässig' },
  '41': { kind: 'fachlich', text: 'Das Zertifikat ist noch nicht bzw. nicht mehr gültig' },
  '43': { kind: 'fachlich', text: 'Der übermittelte Beleg ist fehlerhaft' },
  '998': { kind: 'fachlich', text: 'Statusabfrage bei asynchroner Verarbeitung nicht zulässig' },
  '999': { kind: 'fachlich', text: 'VDA-Id „AT9" nur bei Testübermittlungen zulässig' },
  '1336': INTERN('1336'),
  '1337': INTERN('1337'),
  'B1': { kind: 'fachlich', text: 'Registrierkasse mit dieser Kassenidentifikationsnummer ist bereits registriert' },
  'B2': { kind: 'fachlich', text: 'Für Kassen im vorliegenden Status ist keine Datenänderung möglich' },
  'B3': { kind: 'fachlich', text: 'Kein Ordnungsbegriff (Steuernummer, GLN, UID) für das Unternehmen ermittelbar' },
  'B4': INTERN('B4'),
  'B5': { kind: 'fachlich', text: 'Angegebener Zeitpunkt darf nicht vor der letzten Statusänderung liegen' },
  'B6': { kind: 'fachlich', text: 'Außerbetriebnahme bereits erfolgt — keine Änderung mehr möglich' },
  'B7': { kind: 'fachlich', text: 'Keine in Betrieb befindliche Signaturerstellungseinheit vorhanden' },
  'B8': { kind: 'fachlich', text: 'Nur in Betrieb/registrierte/ausgefallene Kassen dürfen außer Betrieb genommen werden' },
  'B9': { kind: 'fachlich', text: 'Nur in Betrieb befindliche Kassen dürfen als ausgefallen gemeldet werden' },
  'B10': { kind: 'fachlich', text: 'SEE mit diesem VDA und dieser Zertifikats-Seriennummer bereits gespeichert' },
  'B13': { kind: 'fachlich', text: 'Der angegebene Status ist bereits gesetzt' },
  'B14': { kind: 'fachlich', text: 'Es wurde keine Begründung angegeben' },
  'B15': { kind: 'fachlich', text: 'Der Zeitpunkt des Ausfalles darf nicht leer sein' },
  'B18': { kind: 'fachlich', text: 'Nur in Betrieb/ausgefallene SEE dürfen endgültig außer Betrieb genommen werden' },
  'B19': { kind: 'fachlich', text: 'Nur in Betrieb befindliche SEE dürfen als ausgefallen gemeldet werden' },
  'B20': { kind: 'fachlich', text: 'Die Begründung ist nicht (mehr) gültig' },
  'B21': { kind: 'fachlich', text: 'Der angegebene Zeitpunkt darf nicht in der Zukunft liegen' },
  'B22': { kind: 'fachlich', text: 'Dieser Status ist nicht verfügbar' },
  'B28': { kind: 'fachlich', text: 'Der öffentliche Schlüssel ist bereits vorhanden' },
  'B29': { kind: 'fachlich', text: 'Es muss ein Zusatz zum Ordnungsbegriff angegeben werden' },
  'B30': { kind: 'fachlich', text: 'Dieser Zusatz zum Ordnungsbegriff ist bereits vorhanden' },
  'B32': { kind: 'fachlich', text: 'Kassenidentifikationsnummer nicht registriert oder bereits außer Betrieb' },
  'B33': { kind: 'fachlich', text: 'Seriennummer nicht registriert oder bereits außer Betrieb' },
  'B34': { kind: 'fachlich', text: 'Ordnungsbegriff nicht registriert oder bereits außer Betrieb' },
  'B35': { kind: 'fachlich', text: 'Der Begründungscode ist nicht vorhanden' },
  'C1': INTERN('C1'),
  'V1': INTERN('V1'), 'V2': INTERN('V2'), 'V3': INTERN('V3'), 'V4': INTERN('V4'),
  'V5': INTERN('V5'), 'V6': INTERN('V6'), 'V7': INTERN('V7'), 'V8': INTERN('V8'),
  'V9': INTERN('V9'), 'V10': INTERN('V10'), 'V11': INTERN('V11'), 'V12': INTERN('V12'),
  'V13': INTERN('V13'), 'V14': INTERN('V14'), 'V15': INTERN('V15'), 'V16': INTERN('V16'),
};

export function rcInfo(rc: string): RcInfo {
  return RKDB_RC[rc] ?? { kind: 'fachlich', text: `Unbekannter Returncode ${rc}` };
}

export function rcIsOk(rc: string): boolean {
  return rcInfo(rc).kind === 'ok';
}

export function rcIsTechnical(rc: string): boolean {
  return rcInfo(rc).kind === 'technisch';
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/returncodes.ts packages/rksv/src/returncodes.test.ts
git commit -m "feat(rksv): rkdb-Returncode-Tabelle aus BMF-Handbuch mit ok/technisch/fachlich-Klassifikation"
```

---

### Task 4: Vorgangstypen und XML-Fragmente (`vorgaenge.ts`)

**Files:**
- Create: `packages/rksv/src/vorgaenge.ts`
- Test: `packages/rksv/src/vorgaenge.test.ts`

**Interfaces:**
- Consumes: `escapeXmlText` aus `@kreiseck/finanzonline-core`.
- Produces: die Vorgangs-Typen (discriminated union über `art`) und:
  - `function isoDateTime(d: Date): string` — `YYYY-MM-DDTHH:mm:ssZ` (Sekunden, UTC, gültiges xsd:dateTime)
  - `function vorgangArt(v: Vorgang): string` — der Choice-Elementname (z. B. `registrierung_kasse`)
  - `function vorgangXml(v: Vorgang, satznr: number): string` — das komplette Vorgangselement inkl. `<satznr>`
  - `class RksvError extends Error` (lokale Validierung); Validierung in `vorgangXml` (Muster/Enums/Begründungscodes), wirft `RksvError` vor dem Senden.

  Typen:
  ```ts
  export type ArtSe = 'SIGNATURKARTE' | 'EIGENES_HSM' | 'HSM_DIENSTLEISTER';
  export interface RegistrierungKasse { art: 'registrierung_kasse'; kassenidentifikationsnummer: string; benutzerschluessel: string; anmerkung?: string }
  export interface RegistrierungSee { art: 'registrierung_se'; artSe: ArtSe; vdaId: string; zertifikatsseriennummer?: string; zertifikat?: string }
  export interface AusfallKasse { art: 'ausfall_kasse'; kassenidentifikationsnummer: string; ausfall?: { begruendung: 1|5|99; beginn: Date }; ausserbetriebnahme?: { begruendung: 6|7 } }
  export interface AusfallSee { art: 'ausfall_se'; zertifikatsseriennummer: string; ausfall?: { begruendung: 1|2|99; beginn: Date }; ausserbetriebnahme?: { begruendung: 6|7 } }
  export interface WiederinbetriebnahmeKasse { art: 'wiederinbetriebnahme_kasse'; kassenidentifikationsnummer: string; ende: Date }
  export interface WiederinbetriebnahmeSee { art: 'wiederinbetriebnahme_se'; zertifikatsseriennummer: string; ende: Date }
  export interface BelegpruefungVorgang { art: 'belegpruefung'; beleg: string }
  export type Vorgang = RegistrierungKasse | RegistrierungSee | AusfallKasse | AusfallSee | WiederinbetriebnahmeKasse | WiederinbetriebnahmeSee | BelegpruefungVorgang;
  ```

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/vorgaenge.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorgangXml, vorgangArt, isoDateTime, RksvError, type Vorgang } from './vorgaenge';

test('registrierung_kasse erzeugt Felder in Reihenfolge satznr, kassenid, benutzerschluessel', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'KASSE-001', benutzerschluessel: 'A'.repeat(44) };
  const xml = vorgangXml(v, 1);
  assert.equal(vorgangArt(v), 'registrierung_kasse');
  assert.match(xml, /^<registrierung_kasse><satznr>1<\/satznr>/);
  assert.ok(xml.indexOf('<kassenidentifikationsnummer>KASSE-001<') < xml.indexOf('<benutzerschluessel>'));
  assert.match(xml, /<\/registrierung_kasse>$/);
});

test('registrierung_kasse mit optionaler anmerkung platziert sie vor benutzerschluessel', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44), anmerkung: 'Hinweis' };
  const xml = vorgangXml(v, 2);
  assert.ok(xml.indexOf('<anmerkung>Hinweis<') < xml.indexOf('<benutzerschluessel>'));
});

test('benutzerschluessel != 44 Zeichen wird lokal abgelehnt', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'zu-kurz' };
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('registrierung_se mit vdaId und zertifikatsseriennummer', () => {
  const v: Vorgang = { art: 'registrierung_se', artSe: 'HSM_DIENSTLEISTER', vdaId: 'AT9', zertifikatsseriennummer: '1a2b3c' };
  const xml = vorgangXml(v, 1);
  assert.match(xml, /<art_se>HSM_DIENSTLEISTER<\/art_se>/);
  assert.match(xml, /<vda_id>AT9<\/vda_id>/);
  assert.match(xml, /<zertifikatsseriennummer>1a2b3c<\/zertifikatsseriennummer>/);
});

test('registrierung_se verlangt genau eines von zertifikatsseriennummer/zertifikat', () => {
  const beide: Vorgang = { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: 'aa', zertifikat: 'YmFzZQ==' };
  const keines: Vorgang = { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1' };
  assert.throws(() => vorgangXml(beide, 1), RksvError);
  assert.throws(() => vorgangXml(keines, 1), RksvError);
});

test('ungültige vda_id wird abgelehnt', () => {
  const v: Vorgang = { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'X', zertifikatsseriennummer: 'aa' };
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('ausfall_kasse mit Ausfall setzt begruendung und beginn_ausfall', () => {
  const v: Vorgang = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1', ausfall: { begruendung: 5, beginn: new Date('2026-07-20T10:00:00Z') } };
  const xml = vorgangXml(v, 1);
  assert.match(xml, /<ausfall><begruendung>5<\/begruendung><beginn_ausfall>2026-07-20T10:00:00Z<\/beginn_ausfall><\/ausfall>/);
});

test('ausfall_kasse mit Ausserbetriebnahme nur begruendung', () => {
  const v: Vorgang = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1', ausserbetriebnahme: { begruendung: 6 } };
  assert.match(vorgangXml(v, 1), /<ausserbetriebnahme><begruendung>6<\/begruendung><\/ausserbetriebnahme>/);
});

test('ausfall_kasse verlangt genau eines von ausfall/ausserbetriebnahme', () => {
  const keines: Vorgang = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1' };
  assert.throws(() => vorgangXml(keines, 1), RksvError);
});

test('ausfall_kasse mit falschem Begründungscode wird abgelehnt', () => {
  const v = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1', ausfall: { begruendung: 2 as unknown as 1|5|99, beginn: new Date() } } as Vorgang;
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('wiederinbetriebnahme_kasse setzt ende_ausfall', () => {
  const v: Vorgang = { art: 'wiederinbetriebnahme_kasse', kassenidentifikationsnummer: 'K1', ende: new Date('2026-07-21T09:00:00Z') };
  assert.match(vorgangXml(v, 1), /<ende_ausfall>2026-07-21T09:00:00Z<\/ende_ausfall>/);
});

test('belegpruefung setzt beleg und maskiert Sonderzeichen', () => {
  const v: Vorgang = { art: 'belegpruefung', beleg: '_R1-AT9_K&1_1_2026-07-20T14:23:34_10,00' };
  assert.match(vorgangXml(v, 1), /<beleg>_R1-AT9_K&amp;1_/);
});

test('isoDateTime liefert Sekunden ohne Millisekunden mit Z', () => {
  assert.equal(isoDateTime(new Date('2026-07-21T12:34:56.789Z')), '2026-07-21T12:34:56Z');
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './vorgaenge'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/vorgaenge.ts`:
```ts
import { escapeXmlText } from '@kreiseck/finanzonline-core';

export class RksvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RksvError';
  }
}

export type ArtSe = 'SIGNATURKARTE' | 'EIGENES_HSM' | 'HSM_DIENSTLEISTER';

export interface RegistrierungKasse {
  art: 'registrierung_kasse';
  kassenidentifikationsnummer: string;
  benutzerschluessel: string;
  anmerkung?: string;
}
export interface RegistrierungSee {
  art: 'registrierung_se';
  artSe: ArtSe;
  vdaId: string;
  zertifikatsseriennummer?: string;
  zertifikat?: string;
}
export interface AusfallKasse {
  art: 'ausfall_kasse';
  kassenidentifikationsnummer: string;
  ausfall?: { begruendung: 1 | 5 | 99; beginn: Date };
  ausserbetriebnahme?: { begruendung: 6 | 7 };
}
export interface AusfallSee {
  art: 'ausfall_se';
  zertifikatsseriennummer: string;
  ausfall?: { begruendung: 1 | 2 | 99; beginn: Date };
  ausserbetriebnahme?: { begruendung: 6 | 7 };
}
export interface WiederinbetriebnahmeKasse {
  art: 'wiederinbetriebnahme_kasse';
  kassenidentifikationsnummer: string;
  ende: Date;
}
export interface WiederinbetriebnahmeSee {
  art: 'wiederinbetriebnahme_se';
  zertifikatsseriennummer: string;
  ende: Date;
}
export interface BelegpruefungVorgang {
  art: 'belegpruefung';
  beleg: string;
}
export type Vorgang =
  | RegistrierungKasse
  | RegistrierungSee
  | AusfallKasse
  | AusfallSee
  | WiederinbetriebnahmeKasse
  | WiederinbetriebnahmeSee
  | BelegpruefungVorgang;

const VDA_ID = /^[A-Z]{2}[1-9][0-9]?$/;
const ZERT_SN = /^[0-9A-Fa-f]{1,50}$/;
const BENUTZERSCHLUESSEL = /^[0-9a-zA-Z+/=]{44}$/;
const ART_SE: readonly ArtSe[] = ['SIGNATURKARTE', 'EIGENES_HSM', 'HSM_DIENSTLEISTER'];

export function isoDateTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function el(name: string, value: string): string {
  return `<${name}>${escapeXmlText(value)}</${name}>`;
}

function req(condition: boolean, message: string): void {
  if (!condition) throw new RksvError(message);
}

export function vorgangArt(v: Vorgang): string {
  return v.art;
}

function ausfallBlock(
  a: { ausfall?: { begruendung: number; beginn: Date }; ausserbetriebnahme?: { begruendung: number } },
  ausfallCodes: readonly number[],
): string {
  const hatAusfall = a.ausfall !== undefined;
  const hatAbn = a.ausserbetriebnahme !== undefined;
  req(hatAusfall !== hatAbn, 'Genau eines von ausfall/ausserbetriebnahme ist erforderlich');
  if (a.ausfall) {
    req(ausfallCodes.includes(a.ausfall.begruendung), `Ungültiger Begründungscode ${a.ausfall.begruendung} für Ausfall`);
    return `<ausfall>${el('begruendung', String(a.ausfall.begruendung))}${el('beginn_ausfall', isoDateTime(a.ausfall.beginn))}</ausfall>`;
  }
  const abn = a.ausserbetriebnahme!;
  req(abn.begruendung === 6 || abn.begruendung === 7, `Ungültiger Begründungscode ${abn.begruendung} für Außerbetriebnahme`);
  return `<ausserbetriebnahme>${el('begruendung', String(abn.begruendung))}</ausserbetriebnahme>`;
}

export function vorgangXml(v: Vorgang, satznr: number): string {
  const satz = el('satznr', String(satznr));
  switch (v.art) {
    case 'registrierung_kasse': {
      req(BENUTZERSCHLUESSEL.test(v.benutzerschluessel), 'benutzerschluessel muss 44 Zeichen [0-9a-zA-Z+/=] sein');
      const anmerkung = v.anmerkung !== undefined ? el('anmerkung', v.anmerkung) : '';
      return `<registrierung_kasse>${satz}${el('kassenidentifikationsnummer', v.kassenidentifikationsnummer)}${anmerkung}${el('benutzerschluessel', v.benutzerschluessel)}</registrierung_kasse>`;
    }
    case 'registrierung_se': {
      req(ART_SE.includes(v.artSe), `art_se ungültig: ${v.artSe}`);
      req(VDA_ID.test(v.vdaId), `vda_id ungültig: ${v.vdaId}`);
      const hatSn = v.zertifikatsseriennummer !== undefined;
      const hatZert = v.zertifikat !== undefined;
      req(hatSn !== hatZert, 'Genau eines von zertifikatsseriennummer/zertifikat ist erforderlich');
      if (hatSn) req(ZERT_SN.test(v.zertifikatsseriennummer!), 'zertifikatsseriennummer muss hex (max 50) sein');
      const zertEl = hatSn
        ? el('zertifikatsseriennummer', v.zertifikatsseriennummer!)
        : el('zertifikat', v.zertifikat!);
      return `<registrierung_se>${satz}${el('art_se', v.artSe)}${el('vda_id', v.vdaId)}${zertEl}</registrierung_se>`;
    }
    case 'ausfall_kasse': {
      const block = ausfallBlock(v, [1, 5, 99]);
      return `<ausfall_kasse>${satz}${el('kassenidentifikationsnummer', v.kassenidentifikationsnummer)}${block}</ausfall_kasse>`;
    }
    case 'ausfall_se': {
      req(ZERT_SN.test(v.zertifikatsseriennummer), 'zertifikatsseriennummer muss hex (max 50) sein');
      const block = ausfallBlock(v, [1, 2, 99]);
      return `<ausfall_se>${satz}${el('zertifikatsseriennummer', v.zertifikatsseriennummer)}${block}</ausfall_se>`;
    }
    case 'wiederinbetriebnahme_kasse':
      return `<wiederinbetriebnahme_kasse>${satz}${el('kassenidentifikationsnummer', v.kassenidentifikationsnummer)}${el('ende_ausfall', isoDateTime(v.ende))}</wiederinbetriebnahme_kasse>`;
    case 'wiederinbetriebnahme_se': {
      req(ZERT_SN.test(v.zertifikatsseriennummer), 'zertifikatsseriennummer muss hex (max 50) sein');
      return `<wiederinbetriebnahme_se>${satz}${el('zertifikatsseriennummer', v.zertifikatsseriennummer)}${el('ende_ausfall', isoDateTime(v.ende))}</wiederinbetriebnahme_se>`;
    }
    case 'belegpruefung':
      return `<belegpruefung>${satz}${el('beleg', v.beleg)}</belegpruefung>`;
  }
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/vorgaenge.ts packages/rksv/src/vorgaenge.test.ts
git commit -m "feat(rksv): Vorgangstypen und validierte XML-Fragmente je Vorgangsart"
```

---

### Task 5: Request-Builder (`request.ts`)

**Files:**
- Create: `packages/rksv/src/request.ts`
- Test: `packages/rksv/src/request.test.ts`

**Interfaces:**
- Consumes: `escapeXmlText` aus Core; `Vorgang`, `vorgangArt`, `vorgangXml`, `isoDateTime`, `RksvError` aus `./vorgaenge`.
- Produces:
  - `interface RkdbPaket { tid; benid; id; uebermittlung: 'test'|'echt'; fastnr?; paketNr: number; tsErstellung: Date; erzwingeAsynchron?: boolean; vorgaenge: Vorgang[] }`
  - `interface StatusAbfrage { tid; benid; id; uebermittlung: 'test'|'echt'; fastnr?; paketNr: number; tsErstellung: Date; ziel: { art: 'status_kasse'; kassenidentifikationsnummer: string } | { art: 'status_se'; zertifikatsseriennummer: string } }`
  - `function buildRkdbEnvelope(p: RkdbPaket): string`
  - `function buildStatusEnvelope(s: StatusAbfrage): string`

  Beide erzeugen den vollständigen SOAP-Envelope. `buildRkdbEnvelope` erzwingt: `vorgaenge.length >= 1`, **genau eine** Vorgangsart über alle Einträge (sonst `RksvError`), `paketNr` in 1..999999999. `satznr` wird 1..n vergeben. Namespace-Elementname: `status_se` heißt im XSD `status_see` — der Builder schreibt `status_see`.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/request.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRkdbEnvelope, buildStatusEnvelope, type RkdbPaket, type StatusAbfrage } from './request';
import { RksvError, type Vorgang } from './vorgaenge';

const BASE = {
  tid: 'ABCD1234',
  benid: 'benutzer1',
  id: 'SESSION0001',
  uebermittlung: 'test' as const,
  paketNr: 42,
  tsErstellung: new Date('2026-07-21T12:00:00Z'),
};

test('rkdbRequest: Kopf-Reihenfolge und art_uebermittlung T', () => {
  const p: RkdbPaket = { ...BASE, vorgaenge: [{ art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' }] };
  const xml = buildRkdbEnvelope(p);
  assert.match(xml, /<rkdbRequest xmlns="https:\/\/finanzonline\.bmf\.gv\.at\/rkdb">/);
  assert.ok(xml.indexOf('<tid>') < xml.indexOf('<benid>'));
  assert.ok(xml.indexOf('<benid>') < xml.indexOf('<id>'));
  assert.ok(xml.indexOf('<id>SESSION0001</id>') < xml.indexOf('<art_uebermittlung>'));
  assert.match(xml, /<art_uebermittlung>T<\/art_uebermittlung>/);
  assert.match(xml, /<rkdb><paket_nr>42<\/paket_nr><ts_erstellung>2026-07-21T12:00:00Z<\/ts_erstellung><belegpruefung>/);
});

test('uebermittlung echt -> P', () => {
  const p: RkdbPaket = { ...BASE, uebermittlung: 'echt', vorgaenge: [{ art: 'belegpruefung', beleg: '_R1-AT1_K_1_2026-07-20T14:23:34_10,00' }] };
  assert.match(buildRkdbEnvelope(p), /<art_uebermittlung>P<\/art_uebermittlung>/);
});

test('mehrere Vorgänge gleicher Art bekommen fortlaufende satznr', () => {
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K2', benutzerschluessel: 'B'.repeat(44) },
  ];
  const xml = buildRkdbEnvelope({ ...BASE, vorgaenge: vs });
  assert.ok(xml.indexOf('<satznr>1</satznr>') < xml.indexOf('<satznr>2</satznr>'));
  assert.match(xml, /K1/);
  assert.match(xml, /K2/);
});

test('gemischte Vorgangsarten werden abgelehnt', () => {
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' },
  ];
  assert.throws(() => buildRkdbEnvelope({ ...BASE, vorgaenge: vs }), RksvError);
});

test('leere Vorgangsliste wird abgelehnt', () => {
  assert.throws(() => buildRkdbEnvelope({ ...BASE, vorgaenge: [] }), RksvError);
});

test('paketNr außerhalb 1..999999999 wird abgelehnt', () => {
  const v: Vorgang = { art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' };
  assert.throws(() => buildRkdbEnvelope({ ...BASE, paketNr: 0, vorgaenge: [v] }), RksvError);
  assert.throws(() => buildRkdbEnvelope({ ...BASE, paketNr: 1_000_000_000, vorgaenge: [v] }), RksvError);
});

test('erzwinge_asynchron wird gesetzt wenn true', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  assert.match(buildRkdbEnvelope({ ...BASE, erzwingeAsynchron: true, vorgaenge: [v] }), /<erzwinge_asynchron>true<\/erzwinge_asynchron>/);
});

test('status_kasse: Element status_kasse mit satznr 1 und kassenid', () => {
  const s: StatusAbfrage = { ...BASE, ziel: { art: 'status_kasse', kassenidentifikationsnummer: 'K1' } };
  const xml = buildStatusEnvelope(s);
  assert.match(xml, /<status_kasse><paket_nr>42<\/paket_nr><ts_erstellung>2026-07-21T12:00:00Z<\/ts_erstellung><satznr>1<\/satznr><kassenidentifikationsnummer>K1<\/kassenidentifikationsnummer><\/status_kasse>/);
});

test('status_se schreibt XSD-Elementnamen status_see', () => {
  const s: StatusAbfrage = { ...BASE, ziel: { art: 'status_se', zertifikatsseriennummer: '1a2b' } };
  assert.match(buildStatusEnvelope(s), /<status_see><paket_nr>42<\/paket_nr>.*<zertifikatsseriennummer>1a2b<\/zertifikatsseriennummer><\/status_see>/);
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './request'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/request.ts`:
```ts
import { escapeXmlText } from '@kreiseck/finanzonline-core';
import { type Vorgang, vorgangArt, vorgangXml, isoDateTime, RksvError } from './vorgaenge';

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';
const RKDB_NS = 'https://finanzonline.bmf.gv.at/rkdb';

export interface RkdbPaket {
  tid: string;
  benid: string;
  id: string;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  paketNr: number;
  tsErstellung: Date;
  erzwingeAsynchron?: boolean;
  vorgaenge: Vorgang[];
}

export interface StatusAbfrage {
  tid: string;
  benid: string;
  id: string;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  paketNr: number;
  tsErstellung: Date;
  ziel:
    | { art: 'status_kasse'; kassenidentifikationsnummer: string }
    | { art: 'status_se'; zertifikatsseriennummer: string };
}

function el(name: string, value: string): string {
  return `<${name}>${escapeXmlText(value)}</${name}>`;
}

function artUebermittlung(u: 'test' | 'echt'): string {
  return u === 'test' ? 'T' : 'P';
}

function kopf(tid: string, benid: string, id: string, u: 'test' | 'echt'): string {
  return el('tid', tid) + el('benid', benid) + el('id', id) + el('art_uebermittlung', artUebermittlung(u));
}

function requirePaketNr(paketNr: number): void {
  if (!Number.isInteger(paketNr) || paketNr < 1 || paketNr > 999_999_999) {
    throw new RksvError(`paketNr muss ganzzahlig in 1..999999999 liegen, war ${paketNr}`);
  }
}

function envelope(inner: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV}"><soapenv:Body>` +
    `<rkdbRequest xmlns="${RKDB_NS}">${inner}</rkdbRequest>` +
    '</soapenv:Body></soapenv:Envelope>'
  );
}

export function buildRkdbEnvelope(p: RkdbPaket): string {
  requirePaketNr(p.paketNr);
  if (p.vorgaenge.length < 1) throw new RksvError('vorgaenge darf nicht leer sein');
  const art = vorgangArt(p.vorgaenge[0]!);
  for (const v of p.vorgaenge) {
    if (vorgangArt(v) !== art) {
      throw new RksvError(`Ein Paket darf nur eine Vorgangsart enthalten (gemischt: ${art} und ${vorgangArt(v)})`);
    }
  }
  const fastnr = p.fastnr !== undefined ? el('fastnr', p.fastnr) : '';
  const erzwinge = p.erzwingeAsynchron === true ? el('erzwinge_asynchron', 'true') : '';
  const vorgangXmls = p.vorgaenge.map((v, i) => vorgangXml(v, i + 1)).join('');
  const rkdb =
    '<rkdb>' + fastnr + el('paket_nr', String(p.paketNr)) + el('ts_erstellung', isoDateTime(p.tsErstellung)) + vorgangXmls + '</rkdb>';
  return envelope(kopf(p.tid, p.benid, p.id, p.uebermittlung) + erzwinge + rkdb);
}

export function buildStatusEnvelope(s: StatusAbfrage): string {
  requirePaketNr(s.paketNr);
  const fastnr = s.fastnr !== undefined ? el('fastnr', s.fastnr) : '';
  const gemeinsam = fastnr + el('paket_nr', String(s.paketNr)) + el('ts_erstellung', isoDateTime(s.tsErstellung)) + el('satznr', '1');
  const block =
    s.ziel.art === 'status_kasse'
      ? `<status_kasse>${gemeinsam}${el('kassenidentifikationsnummer', s.ziel.kassenidentifikationsnummer)}</status_kasse>`
      : `<status_see>${gemeinsam}${el('zertifikatsseriennummer', s.ziel.zertifikatsseriennummer)}</status_see>`;
  return envelope(kopf(s.tid, s.benid, s.id, s.uebermittlung) + block);
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/request.ts packages/rksv/src/request.test.ts
git commit -m "feat(rksv): rkdbRequest- und Status-Envelope-Builder mit Vorgangsart-Invariante"
```

---

### Task 6: Antwort-Parser (`antwort.ts`)

**Files:**
- Create: `packages/rksv/src/antwort.ts`
- Test: `packages/rksv/src/antwort.test.ts`

**Interfaces:**
- Consumes: `parseXml`, `XmlNode`, `firstChild`, `childText`, `findDescendant` aus Core; `rcInfo` aus `./returncodes`.
- Produces:
  - `interface Pruefung { name: string; status: 'PASS'|'FAIL'|'NOT_EXECUTED'; detail?: string; teilpruefungen?: Pruefung[] }`
  - `interface StatusErgebnis { status: string; tsRegistrierung?: string; tsStatus?: string }`
  - `interface Ergebnis { satznr: number; ok: boolean; rc: string; msg: string; belegpruefung?: Pruefung[]; status?: StatusErgebnis }`
  - `function parseRkdbErgebnisse(root: XmlNode): Ergebnis[]` — liest alle `result`-Elemente; nimmt je `result` die **erste** `rkdbMessage` für rc/msg; `ok = rcInfo(rc).kind === 'ok'`.

  Hinweis: Die Core-Helfer `firstChild`/`childText`/`findDescendant` sind exportiert; `parseXml` liefert die Wurzel.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/antwort.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '@kreiseck/finanzonline-core';
import { parseRkdbErgebnisse } from './antwort';

const wrap = (results: string) =>
  parseXml(`<Envelope><Body><rkdbResponse><paket_nr>42</paket_nr><ts_erstellung>x</ts_erstellung>${results}</rkdbResponse></Body></Envelope>`);

test('ok-Ergebnis: rc 0 -> ok true', () => {
  const root = wrap('<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>Aufruf ok</msg></rkdbMessage></result>');
  const erg = parseRkdbErgebnisse(root);
  assert.equal(erg.length, 1);
  assert.equal(erg[0]?.satznr, 1);
  assert.equal(erg[0]?.ok, true);
  assert.equal(erg[0]?.rc, '0');
});

test('fachlicher rc B1 -> ok false, rc/msg durchgereicht', () => {
  const root = wrap('<result><satznr>1</satznr><rkdbMessage><rc>B1</rc><msg>bereits registriert</msg></rkdbMessage></result>');
  const erg = parseRkdbErgebnisse(root);
  assert.equal(erg[0]?.ok, false);
  assert.equal(erg[0]?.rc, 'B1');
  assert.equal(erg[0]?.msg, 'bereits registriert');
});

test('mehrere results werden in Reihenfolge geliefert', () => {
  const root = wrap(
    '<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage></result>' +
    '<result><satznr>2</satznr><rkdbMessage><rc>B1</rc><msg>x</msg></rkdbMessage></result>',
  );
  const erg = parseRkdbErgebnisse(root);
  assert.deepEqual(erg.map((e) => e.satznr), [1, 2]);
  assert.deepEqual(erg.map((e) => e.ok), [true, false]);
});

test('Belegprüfung: verificationResult-Baum inkl. Teilprüfungen', () => {
  const root = wrap(
    '<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage>' +
    '<verificationResultList>' +
      '<verificationResult><verificationId>1</verificationId><version>1</version><verificationName>Struktur</verificationName><verificationState>PASS</verificationState><verificationTimestamp>t</verificationTimestamp>' +
        '<verificationResultList><verificationResult><verificationId>1.1</verificationId><version>1</version><verificationName>Segmentzahl</verificationName><verificationState>PASS</verificationState><verificationTimestamp>t</verificationTimestamp></verificationResult></verificationResultList>' +
      '</verificationResult>' +
      '<verificationResult><verificationId>2</verificationId><version>1</version><verificationName>Signatur</verificationName><verificationState>FAIL</verificationState><verificationResultDetailedMessage>ungültig</verificationResultDetailedMessage><verificationTimestamp>t</verificationTimestamp></verificationResult>' +
    '</verificationResultList></result>',
  );
  const erg = parseRkdbErgebnisse(root);
  const pr = erg[0]?.belegpruefung;
  assert.ok(pr);
  assert.equal(pr.length, 2);
  assert.equal(pr[0]?.name, 'Struktur');
  assert.equal(pr[0]?.status, 'PASS');
  assert.equal(pr[0]?.teilpruefungen?.[0]?.name, 'Segmentzahl');
  assert.equal(pr[1]?.status, 'FAIL');
  assert.equal(pr[1]?.detail, 'ungültig');
});

test('Statusabfrage: abfrage_ergebnis wird gelesen', () => {
  const root = wrap(
    '<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage>' +
    '<abfrage_ergebnis><ts_registrierung>2026-01-01T00:00:00Z</ts_registrierung><status>IN_BETRIEB</status><ts_status>2026-02-01T00:00:00Z</ts_status></abfrage_ergebnis></result>',
  );
  const erg = parseRkdbErgebnisse(root);
  assert.equal(erg[0]?.status?.status, 'IN_BETRIEB');
  assert.equal(erg[0]?.status?.tsRegistrierung, '2026-01-01T00:00:00Z');
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './antwort'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/antwort.ts`:
```ts
import { type XmlNode, firstChild, childText, findDescendant } from '@kreiseck/finanzonline-core';
import { rcInfo } from './returncodes';

export interface Pruefung {
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  detail?: string;
  teilpruefungen?: Pruefung[];
}

export interface StatusErgebnis {
  status: string;
  tsRegistrierung?: string;
  tsStatus?: string;
}

export interface Ergebnis {
  satznr: number;
  ok: boolean;
  rc: string;
  msg: string;
  belegpruefung?: Pruefung[];
  status?: StatusErgebnis;
}

function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

function normalizeState(s: string | undefined): 'PASS' | 'FAIL' | 'NOT_EXECUTED' {
  return s === 'PASS' || s === 'FAIL' || s === 'NOT_EXECUTED' ? s : 'NOT_EXECUTED';
}

function parsePruefungen(list: XmlNode): Pruefung[] {
  return childrenNamed(list, 'verificationResult').map((vr) => {
    const teil = firstChild(vr, 'verificationResultList');
    const p: Pruefung = {
      name: childText(vr, 'verificationName') ?? '',
      status: normalizeState(childText(vr, 'verificationState')),
    };
    const detail = childText(vr, 'verificationResultDetailedMessage');
    if (detail) p.detail = detail;
    if (teil) p.teilpruefungen = parsePruefungen(teil);
    return p;
  });
}

export function parseRkdbErgebnisse(root: XmlNode): Ergebnis[] {
  const resp = findDescendant(root, 'rkdbResponse');
  if (!resp) return [];
  return childrenNamed(resp, 'result').map((result) => {
    const msgNode = firstChild(result, 'rkdbMessage');
    const rc = (msgNode ? childText(msgNode, 'rc') : undefined) ?? '';
    const msg = (msgNode ? childText(msgNode, 'msg') : undefined) ?? '';
    const satznr = Number.parseInt(childText(result, 'satznr') ?? '0', 10);
    const erg: Ergebnis = { satznr, ok: rcInfo(rc).kind === 'ok', rc, msg };

    const vrl = firstChild(result, 'verificationResultList');
    if (vrl) erg.belegpruefung = parsePruefungen(vrl);

    const ab = firstChild(result, 'abfrage_ergebnis');
    if (ab) {
      erg.status = {
        status: childText(ab, 'status') ?? '',
        tsRegistrierung: childText(ab, 'ts_registrierung'),
        tsStatus: childText(ab, 'ts_status'),
      };
    }
    return erg;
  });
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/antwort.ts packages/rksv/src/antwort.test.ts
git commit -m "feat(rksv): rkdbResponse-Parser mit verificationResult-Baum und Statusergebnis"
```

---

### Task 7: Client (`client.ts`) — createRksv, uebermittlePaket, Status

**Files:**
- Create: `packages/rksv/src/client.ts`
- Test: `packages/rksv/src/client.test.ts`

**Interfaces:**
- Consumes: `callSoap`, `type Session`, `type TransportOptions`, `sessionErrorFor` aus Core; `buildRkdbEnvelope`/`buildStatusEnvelope`/`RkdbPaket`/`StatusAbfrage` aus `./request`; `parseRkdbErgebnisse`/`Ergebnis`/`StatusErgebnis` aus `./antwort`; `Vorgang`/`RksvError` aus `./vorgaenge`; `rcIsTechnical` aus `./returncodes`.
- Produces:
  - `interface RksvConfig { session: Session; uebermittlung: 'test'|'echt'; fastnr?: string; transport?: TransportOptions }`
  - `type Quittung = { verarbeitung: 'synchron'; ergebnisse: Ergebnis[] } | { verarbeitung: 'asynchron'; hinweis: string }`
  - `interface Rksv { uebermittlePaket(args: { paketNr: number; vorgaenge: Vorgang[]; erzwingeAsynchron?: boolean }): Promise<Quittung>; statusKasse(args: { paketNr: number; kassenidentifikationsnummer: string }): Promise<StatusErgebnis | undefined>; statusSee(args: { paketNr: number; zertifikatsseriennummer: string }): Promise<StatusErgebnis | undefined>; _config: RksvConfig }`
  - `function createRksv(config: RksvConfig): Rksv`

  `_config` wird von den Vorgangs-Hüllen (Task 8) genutzt. Endpoint/soapAction: der rkdb-Endpoint `https://finanzonline.bmf.gv.at/fonws/ws/rkdb`, soapAction `rkdb` (aus Core-Konstante `RKDB_ENDPOINT`). Technisches Werfen: nach dem Parsen wird geprüft, ob ein Ergebnis-`rc` technisch ist (`-1..-4`) → `sessionErrorFor(Number(rc), msg)` werfen (Session abgelaufen etc.), sonst fachliche Ergebnisse zurückgeben.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/client.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonSessionExpiredError, type Session } from '@kreiseck/finanzonline-core';
import { createRksv } from './client';
import { RksvError, type Vorgang } from './vorgaenge';

function fakeSession(): Session {
  return { id: 'SESSION0001', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
}

function respond(xml: string, capture?: (body: string) => void): (u: string | URL | Request, i?: RequestInit) => Promise<Response> {
  return async (_u: string | URL | Request, init?: RequestInit) => {
    capture?.(String(init?.body ?? ''));
    return new Response(xml, { status: 200 });
  };
}

const rkdbResp = (results: string) =>
  `<Envelope><Body><rkdbResponse><paket_nr>42</paket_nr><ts_erstellung>x</ts_erstellung>${results}</rkdbResponse></Body></Envelope>`;

const okResult = (satznr: number, rc = '0') =>
  `<result><satznr>${satznr}</satznr><rkdbMessage><rc>${rc}</rc><msg>m</msg></rkdbMessage></result>`;

test('ein Vorgang -> synchron mit Ergebnis', async () => {
  const fetchImpl = respond(rkdbResp(okResult(1))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [v] });
  assert.equal(q.verarbeitung, 'synchron');
  assert.equal(q.verarbeitung === 'synchron' && q.ergebnisse[0]?.ok, true);
});

test('mehrere Vorgänge -> asynchron mit Hinweis (DataBox)', async () => {
  const fetchImpl = respond(rkdbResp('')) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K2', benutzerschluessel: 'B'.repeat(44) },
  ];
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: vs });
  assert.equal(q.verarbeitung, 'asynchron');
  assert.equal(q.verarbeitung === 'asynchron' && /DataBox/i.test(q.hinweis), true);
});

test('erzwingeAsynchron macht auch einen Vorgang asynchron', async () => {
  const fetchImpl = respond(rkdbResp('')) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [v], erzwingeAsynchron: true });
  assert.equal(q.verarbeitung, 'asynchron');
});

test('technischer rc -1 im Ergebnis wirft FonSessionExpiredError', async () => {
  const fetchImpl = respond(rkdbResp(okResult(1, '-1'))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  await assert.rejects(() => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [v] }), FonSessionExpiredError);
});

test('gemischte Vorgangsarten werfen RksvError vor dem Senden', async () => {
  let called = false;
  const fetchImpl = (async () => { called = true; return new Response('', { status: 200 }); }) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' },
  ];
  await assert.rejects(() => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: vs }), RksvError);
  assert.equal(called, false);
});

test('statusKasse liefert StatusErgebnis', async () => {
  let body = '';
  const fetchImpl = respond(
    rkdbResp('<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>m</msg></rkdbMessage><abfrage_ergebnis><ts_registrierung>r</ts_registrierung><status>IN_BETRIEB</status><ts_status>s</ts_status></abfrage_ergebnis></result>'),
    (b) => { body = b; },
  ) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const st = await rksv.statusKasse({ paketNr: 42, kassenidentifikationsnummer: 'K1' });
  assert.equal(st?.status, 'IN_BETRIEB');
  assert.match(body, /<status_kasse>/);
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/client.ts`:
```ts
import {
  callSoap,
  sessionErrorFor,
  RKDB_ENDPOINT,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';
import { buildRkdbEnvelope, buildStatusEnvelope } from './request';
import { parseRkdbErgebnisse, type Ergebnis, type StatusErgebnis } from './antwort';
import { type Vorgang } from './vorgaenge';
import { rcIsTechnical } from './returncodes';

export interface RksvConfig {
  session: Session;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  transport?: TransportOptions;
}

export type Quittung =
  | { verarbeitung: 'synchron'; ergebnisse: Ergebnis[] }
  | { verarbeitung: 'asynchron'; hinweis: string };

export interface Rksv {
  uebermittlePaket(args: {
    paketNr: number;
    vorgaenge: Vorgang[];
    erzwingeAsynchron?: boolean;
  }): Promise<Quittung>;
  statusKasse(args: { paketNr: number; kassenidentifikationsnummer: string }): Promise<StatusErgebnis | undefined>;
  statusSee(args: { paketNr: number; zertifikatsseriennummer: string }): Promise<StatusErgebnis | undefined>;
  _config: RksvConfig;
}

function throwIfTechnical(ergebnisse: Ergebnis[]): void {
  for (const e of ergebnisse) {
    if (rcIsTechnical(e.rc)) {
      throw sessionErrorFor(Number.parseInt(e.rc, 10), e.msg);
    }
  }
}

async function ruf(config: RksvConfig, body: string): Promise<Ergebnis[]> {
  const root = await callSoap({ endpoint: RKDB_ENDPOINT, soapAction: 'rkdb', body }, config.transport);
  const ergebnisse = parseRkdbErgebnisse(root);
  throwIfTechnical(ergebnisse);
  return ergebnisse;
}

export function createRksv(config: RksvConfig): Rksv {
  const s = config.session;

  return {
    _config: config,

    async uebermittlePaket({ paketNr, vorgaenge, erzwingeAsynchron }): Promise<Quittung> {
      const body = buildRkdbEnvelope({
        tid: s.tid,
        benid: s.benid,
        id: s.id,
        uebermittlung: config.uebermittlung,
        fastnr: config.fastnr,
        paketNr,
        tsErstellung: new Date(),
        erzwingeAsynchron,
        vorgaenge,
      });
      const istAsync = vorgaenge.length > 1 || erzwingeAsynchron === true;
      const ergebnisse = await ruf(config, body);
      if (istAsync) {
        return {
          verarbeitung: 'asynchron',
          hinweis: 'Paket asynchron übernommen; das Ergebnisprotokoll liegt in der DataBox.',
        };
      }
      return { verarbeitung: 'synchron', ergebnisse };
    },

    async statusKasse({ paketNr, kassenidentifikationsnummer }): Promise<StatusErgebnis | undefined> {
      const body = buildStatusEnvelope({
        tid: s.tid,
        benid: s.benid,
        id: s.id,
        uebermittlung: config.uebermittlung,
        fastnr: config.fastnr,
        paketNr,
        tsErstellung: new Date(),
        ziel: { art: 'status_kasse', kassenidentifikationsnummer },
      });
      const ergebnisse = await ruf(config, body);
      return ergebnisse[0]?.status;
    },

    async statusSee({ paketNr, zertifikatsseriennummer }): Promise<StatusErgebnis | undefined> {
      const body = buildStatusEnvelope({
        tid: s.tid,
        benid: s.benid,
        id: s.id,
        uebermittlung: config.uebermittlung,
        fastnr: config.fastnr,
        paketNr,
        tsErstellung: new Date(),
        ziel: { art: 'status_se', zertifikatsseriennummer },
      });
      const ergebnisse = await ruf(config, body);
      return ergebnisse[0]?.status;
    },
  };
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/client.ts packages/rksv/src/client.test.ts
git commit -m "feat(rksv): createRksv mit uebermittlePaket (sync/async) und Statusabfragen"
```

---

### Task 8: Einzelvorgang-Hüllen und Barrel (`see.ts`, `kasse.ts`, `beleg.ts`, `index.ts`)

**Files:**
- Create: `packages/rksv/src/kasse.ts`
- Create: `packages/rksv/src/see.ts`
- Create: `packages/rksv/src/beleg.ts`
- Create: `packages/rksv/src/index.ts`
- Test: `packages/rksv/src/huellen.test.ts`

**Interfaces:**
- Consumes: `Rksv` aus `./client`; `Vorgang`-Typen aus `./vorgaenge`; `Ergebnis`/`Pruefung` aus `./antwort`.
- Produces: Hüllen, die genau einen Vorgang synchron übermitteln und das `Ergebnis` (bzw. dessen `belegpruefung`) direkt liefern. Signaturen (jede mit `paketNr` Pflicht):
  - `kasse.registriere(rksv, { paketNr, kassenidentifikationsnummer, benutzerschluessel, anmerkung? }): Promise<Ergebnis>`
  - `kasse.meldeAusfall(rksv, { paketNr, kassenidentifikationsnummer, begruendung: 1|5|99, beginn: Date }): Promise<Ergebnis>`
  - `kasse.meldeWiederinbetriebnahme(rksv, { paketNr, kassenidentifikationsnummer, ende: Date }): Promise<Ergebnis>`
  - `kasse.nimmAusserBetrieb(rksv, { paketNr, kassenidentifikationsnummer, begruendung: 6|7 }): Promise<Ergebnis>`
  - `see.registriere(rksv, { paketNr, artSe, vdaId, zertifikatsseriennummer? , zertifikat? }): Promise<Ergebnis>`
  - `see.meldeAusfall(rksv, { paketNr, zertifikatsseriennummer, begruendung: 1|2|99, beginn: Date }): Promise<Ergebnis>`
  - `see.meldeWiederinbetriebnahme(rksv, { paketNr, zertifikatsseriennummer, ende: Date }): Promise<Ergebnis>`
  - `see.nimmAusserBetrieb(rksv, { paketNr, zertifikatsseriennummer, begruendung: 6|7 }): Promise<Ergebnis>`
  - `beleg.pruefe(rksv, { paketNr, beleg }): Promise<Pruefung[]>`

  Jede ruft `rksv.uebermittlePaket({ paketNr, vorgaenge: [<einVorgang>] })`; da genau 1 Vorgang und nicht erzwungen async, ist die Quittung immer `synchron` — die Hülle entnimmt `ergebnisse[0]`. Wenn wider Erwarten keine Ergebnisse zurückkommen, wirft sie `RksvError`.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/huellen.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Session } from '@kreiseck/finanzonline-core';
import { createRksv } from './client';
import { kasse } from './kasse';
import { see } from './see';
import { beleg } from './beleg';

function fakeSession(): Session {
  return { id: 'SESSION0001', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
}
function rksvMit(xml: string, capture?: (body: string) => void) {
  const fetchImpl = (async (_u: string | URL | Request, init?: RequestInit) => {
    capture?.(String(init?.body ?? ''));
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
  return createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
}
const resp = (inner: string) => `<Envelope><Body><rkdbResponse><paket_nr>1</paket_nr><ts_erstellung>x</ts_erstellung>${inner}</rkdbResponse></Body></Envelope>`;
const ok = (extra = '') => resp(`<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage>${extra}</result>`);

test('kasse.registriere liefert Ergebnis und sendet registrierung_kasse', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  const erg = await kasse.registriere(rksv, { paketNr: 1, kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) });
  assert.equal(erg.ok, true);
  assert.match(body, /<registrierung_kasse>/);
});

test('kasse.meldeAusfall setzt begruendung/beginn', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  await kasse.meldeAusfall(rksv, { paketNr: 1, kassenidentifikationsnummer: 'K1', begruendung: 5, beginn: new Date('2026-07-20T10:00:00Z') });
  assert.match(body, /<ausfall><begruendung>5<\/begruendung>/);
});

test('kasse.nimmAusserBetrieb setzt ausserbetriebnahme', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  await kasse.nimmAusserBetrieb(rksv, { paketNr: 1, kassenidentifikationsnummer: 'K1', begruendung: 6 });
  assert.match(body, /<ausserbetriebnahme><begruendung>6<\/begruendung>/);
});

test('see.registriere sendet registrierung_se mit vda_id', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  await see.registriere(rksv, { paketNr: 1, artSe: 'HSM_DIENSTLEISTER', vdaId: 'AT9', zertifikatsseriennummer: '1a2b' });
  assert.match(body, /<registrierung_se>.*<vda_id>AT9<\/vda_id>/);
});

test('beleg.pruefe liefert Prüfungsbaum', async () => {
  const rksv = rksvMit(ok('<verificationResultList><verificationResult><verificationId>1</verificationId><version>1</version><verificationName>Struktur</verificationName><verificationState>PASS</verificationState><verificationTimestamp>t</verificationTimestamp></verificationResult></verificationResultList>'));
  const pr = await beleg.pruefe(rksv, { paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr[0]?.name, 'Struktur');
  assert.equal(pr[0]?.status, 'PASS');
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './kasse'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/kasse.ts`:
```ts
import { type Rksv } from './client';
import { type Ergebnis } from './antwort';
import { RksvError, type Vorgang } from './vorgaenge';

async function einzel(rksv: Rksv, paketNr: number, vorgang: Vorgang): Promise<Ergebnis> {
  const q = await rksv.uebermittlePaket({ paketNr, vorgaenge: [vorgang] });
  if (q.verarbeitung !== 'synchron' || q.ergebnisse.length === 0) {
    throw new RksvError('Erwartetes synchrones Ergebnis blieb aus');
  }
  return q.ergebnisse[0]!;
}

export const kasse = {
  registriere(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; benutzerschluessel: string; anmerkung?: string },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'registrierung_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      benutzerschluessel: args.benutzerschluessel,
      anmerkung: args.anmerkung,
    });
  },
  meldeAusfall(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; begruendung: 1 | 5 | 99; beginn: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      ausfall: { begruendung: args.begruendung, beginn: args.beginn },
    });
  },
  meldeWiederinbetriebnahme(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; ende: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'wiederinbetriebnahme_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      ende: args.ende,
    });
  },
  nimmAusserBetrieb(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; begruendung: 6 | 7 },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      ausserbetriebnahme: { begruendung: args.begruendung },
    });
  },
};

export { einzel as _einzel };
```

`packages/rksv/src/see.ts`:
```ts
import { type Rksv } from './client';
import { type Ergebnis } from './antwort';
import { _einzel as einzel } from './kasse';
import { type ArtSe } from './vorgaenge';

export const see = {
  registriere(
    rksv: Rksv,
    args: { paketNr: number; artSe: ArtSe; vdaId: string; zertifikatsseriennummer?: string; zertifikat?: string },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'registrierung_se',
      artSe: args.artSe,
      vdaId: args.vdaId,
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      zertifikat: args.zertifikat,
    });
  },
  meldeAusfall(
    rksv: Rksv,
    args: { paketNr: number; zertifikatsseriennummer: string; begruendung: 1 | 2 | 99; beginn: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_se',
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      ausfall: { begruendung: args.begruendung, beginn: args.beginn },
    });
  },
  meldeWiederinbetriebnahme(
    rksv: Rksv,
    args: { paketNr: number; zertifikatsseriennummer: string; ende: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'wiederinbetriebnahme_se',
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      ende: args.ende,
    });
  },
  nimmAusserBetrieb(
    rksv: Rksv,
    args: { paketNr: number; zertifikatsseriennummer: string; begruendung: 6 | 7 },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_se',
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      ausserbetriebnahme: { begruendung: args.begruendung },
    });
  },
};
```

`packages/rksv/src/beleg.ts`:
```ts
import { type Rksv } from './client';
import { _einzel as einzel } from './kasse';
import { type Pruefung } from './antwort';

export const beleg = {
  async pruefe(rksv: Rksv, args: { paketNr: number; beleg: string }): Promise<Pruefung[]> {
    const erg = await einzel(rksv, args.paketNr, { art: 'belegpruefung', beleg: args.beleg });
    return erg.belegpruefung ?? [];
  },
};
```

`packages/rksv/src/index.ts`:
```ts
export { createRksv, type Rksv, type RksvConfig, type Quittung } from './client';
export { kasse } from './kasse';
export { see } from './see';
export { beleg } from './beleg';
export { RksvError } from './vorgaenge';
export type {
  Vorgang,
  ArtSe,
  RegistrierungKasse,
  RegistrierungSee,
  AusfallKasse,
  AusfallSee,
  WiederinbetriebnahmeKasse,
  WiederinbetriebnahmeSee,
  BelegpruefungVorgang,
} from './vorgaenge';
export type { Ergebnis, Pruefung, StatusErgebnis } from './antwort';
export { RKDB_RC, rcInfo, type RcInfo, type RcKind } from './returncodes';
```

- [ ] **Step 4: Tests + Build**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS (alle Suites).
Run: `npm run build -w @kreiseck/rksv`
Expected: `dist/` mit `index.js`/`index.d.ts`, `dist/code`-Export erst nach Plan B; keine tsc-Fehler, keine Testdateien in `dist`.

> Hinweis: Das `exports`-Feld verweist auf `./dist/code/index.js`, das erst Plan B anlegt. Das ist bis dahin kein Kompilierfehler (nur ein zur Laufzeit nicht aufgelöster Subpath); `@kreiseck/rksv` (Hauptexport) baut und testet unabhängig davon.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/kasse.ts packages/rksv/src/see.ts packages/rksv/src/beleg.ts packages/rksv/src/index.ts packages/rksv/src/huellen.test.ts
git commit -m "feat(rksv): Einzelvorgang-Huellen fuer Kasse/SEE/Beleg und oeffentliches Barrel"
```

---

## Nach diesem Plan

- Plan B (`@kreiseck/rksv/code`, Offline-Belegcode) legt `packages/rksv/src/code/` an und erfüllt den `./code`-Subpath-Export.
- Integrationstests gegen `art_uebermittlung='T'` / `vda_id='AT9'` (opt-in per Env), sobald `tid`/`benid` vorliegen.
- `REGISTRIERUNG.md` für `finanzonline-core`.
