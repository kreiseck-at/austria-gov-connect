# @kreiseck/elda Transfer-Webservice v1 Implementation Plan

> **Umsetzung:** Task für Task, test-first. Jeder Task beginnt mit einem
> fehlschlagenden Test und endet mit grüner Suite und einem Commit. Schritte sind
> als Checkbox (`- [ ]`) geführt.

**Goal:** Ein neues Monorepo-Paket `@kreiseck/elda` bauen, das den ELDA
Transfer-Webservice v4 (senden / ruecksendungenAuflisten / empfangen) zu 100 %
abdeckt — voll unit-getestet und dokumentiert.

**Architecture:** Selbstgeschriebener SOAP-Client mit eigenem (verschachteltem)
Envelope-Builder; HTTP-Transport, XML-Parsing und Fault-Erkennung werden aus
`@kreiseck/finanzonline-core` wiederverwendet. Die Datei wird als inline
`base64Binary` im `<payload>`-Element gesendet (Standard-SOAP-Darstellung); die
MTOM-Variante ist ein klar umrissener Live-Folge-Check (braucht ELDA-Testzugang).

**Tech Stack:** Node ≥20.18, TypeScript (CJS via `tsc`), `node:test`,
`node:crypto` (SHA-512, `randomUUID`), `@kreiseck/finanzonline-core` (SOAP-Helfer).

## Global Constraints

- **Keine Laufzeitabhängigkeiten** außer `@kreiseck/finanzonline-core`. Keine
  weiteren npm-Pakete.
- **100 % API-Abdeckung, nichts geraten/übersprungen:** alle 3 Methoden, alle
  Request-/Result-Felder, alle Status-Codes der Transfer-Webservice-Spec V4.
- **Vollständige Doku:** JSDoc an jedem exportierten Symbol + README mit
  End-to-End-Beispiel und Status-Code-Tabelle.
- Namespace exakt `http://v4.transfer.ws.elda.at/`.
- `kundenpasswort` wird intern zu **SHA-512 hex lowercase** gehasht (Klartext rein).
- `created` = `new Date().toISOString()` (Format `yyyy-MM-ddTHH:mm:ss.SSSZ`).
- Fachliche Status-Codes werden NICHT geworfen — sie stehen im Ergebnis (`ok`,
  `statusCode`, `meldung`). Nur echte SOAP-Faults werfen.
- Lizenz Apache-2.0. Alle Kommandos ab Repo-Root; für Projekt-Kommandos Node 22:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`.

---

### Task 1: Paket-Gerüst

**Files:**
- Create: `packages/elda/package.json`
- Create: `packages/elda/tsconfig.json`
- Create: `packages/elda/tsconfig.test.json`
- Create: `packages/elda/NOTICE`
- Create: `packages/elda/src/index.ts`
- Create: `packages/elda/src/smoke.test.ts`

**Interfaces:**
- Produces: das baubare, testbare Paket `@kreiseck/elda` mit Dependency auf
  `@kreiseck/finanzonline-core`.

- [ ] **Step 1: package.json anlegen**

```json
{
  "name": "@kreiseck/elda",
  "version": "0.1.0",
  "description": "ELDA Transfer-Webservice (österreichische Sozialversicherung) für Node",
  "license": "Apache-2.0",
  "author": "Kreiseck",
  "homepage": "https://github.com/kreiseck-at/austria-gov-connect/tree/main/packages/elda#readme",
  "repository": { "type": "git", "url": "git+https://github.com/kreiseck-at/austria-gov-connect.git", "directory": "packages/elda" },
  "bugs": "https://github.com/kreiseck-at/austria-gov-connect/issues",
  "keywords": ["elda", "sozialversicherung", "ögk", "österreich", "austria", "soap", "webservice", "lohnverrechnung"],
  "type": "commonjs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md", "NOTICE"],
  "engines": { "node": ">=20.18.0" },
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "tsc -p tsconfig.test.json && node --test $(find test-dist -name '*.test.js')",
    "prepublishOnly": "npm run build"
  },
  "dependencies": { "@kreiseck/finanzonline-core": "^0.1.5" },
  "devDependencies": { "typescript": "^5.4.0", "@types/node": "^22.0.0" }
}
```

- [ ] **Step 2: tsconfig.json + tsconfig.test.json anlegen** (1:1 wie finanzonline-core)

`packages/elda/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```
`packages/elda/tsconfig.test.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "test-dist", "declaration": false, "declarationMap": false },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: NOTICE + leeren index.ts + Smoke-Test anlegen**

`packages/elda/NOTICE`:
```
@kreiseck/elda
Copyright Kreiseck
Licensed under the Apache License, Version 2.0.
```
`packages/elda/src/index.ts`:
```ts
export const ELDA_PAKET = '@kreiseck/elda';
```
`packages/elda/src/smoke.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_PAKET } from './index';

test('smoke: Paket lädt', () => {
  assert.equal(ELDA_PAKET, '@kreiseck/elda');
});
```

- [ ] **Step 4: Install + Test**

Run (Repo-Root): `npm install && npm test -w @kreiseck/elda`
Expected: install verlinkt das Workspace-Paket; `# pass 1 # fail 0`.

- [ ] **Step 5: Commit**

```bash
git add packages/elda/package.json packages/elda/tsconfig.json packages/elda/tsconfig.test.json packages/elda/NOTICE packages/elda/src/index.ts packages/elda/src/smoke.test.ts
git commit -m "feat(elda): Paket-Geruest (@kreiseck/elda)"
```

---

### Task 2: Endpoints & Namespace

**Files:**
- Create: `packages/elda/src/endpoints.ts`
- Create: `packages/elda/src/endpoints.test.ts`

**Interfaces:**
- Produces: `type EldaUmgebung = 'produktion' | 'kundentest' | 'sit'`,
  `ELDA_ENDPOINTS: Record<EldaUmgebung, string>`,
  `ELDA_NAMESPACE = 'http://v4.transfer.ws.elda.at/'`.

- [ ] **Step 1: Failing test**

`packages/elda/src/endpoints.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_ENDPOINTS, ELDA_NAMESPACE } from './endpoints';

test('Endpoints je Umgebung + Namespace', () => {
  assert.equal(ELDA_ENDPOINTS.produktion, 'https://online.elda.at/eldaws/transfer/v4/TransferService');
  assert.equal(ELDA_ENDPOINTS.kundentest, 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
  assert.equal(ELDA_ENDPOINTS.sit, 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService');
  assert.equal(ELDA_NAMESPACE, 'http://v4.transfer.ws.elda.at/');
});
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module './endpoints'`)
Run: `npm test -w @kreiseck/elda`

- [ ] **Step 3: Implement**

`packages/elda/src/endpoints.ts`:
```ts
/** ELDA-Betriebsumgebung. */
export type EldaUmgebung = 'produktion' | 'kundentest' | 'sit';

/** Transfer-Webservice-v4-Endpoints je Umgebung (alle Methoden gehen dorthin). */
export const ELDA_ENDPOINTS: Record<EldaUmgebung, string> = {
  produktion: 'https://online.elda.at/eldaws/transfer/v4/TransferService',
  kundentest: 'https://online-test.elda.at/eldaws/transfer/v4/TransferService',
  sit: 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService',
};

/** SOAP-Namespace des Transfer-Webservice v4. */
export const ELDA_NAMESPACE = 'http://v4.transfer.ws.elda.at/';
```

- [ ] **Step 4: Run → PASS**
Run: `npm test -w @kreiseck/elda`

- [ ] **Step 5: Commit**
```bash
git add packages/elda/src/endpoints.ts packages/elda/src/endpoints.test.ts
git commit -m "feat(elda): Endpoints + Namespace"
```

---

### Task 3: Status-Codes

**Files:**
- Create: `packages/elda/src/status.ts`
- Create: `packages/elda/src/status.test.ts`

**Interfaces:**
- Produces: `ELDA_STATUS: Record<string, string>` (Code→Klartext),
  `istOk(statusCode: string): boolean` (`statusCode === '000'`).

- [ ] **Step 1: Failing test**

`packages/elda/src/status.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_STATUS, istOk } from './status';

test('Status-Codes vollständig (Spec V4)', () => {
  for (const code of ['000','500','551','552','553','554','555','557','558','559','401','402','403','404','405','406','407','408']) {
    assert.ok(ELDA_STATUS[code], `fehlt: ${code}`);
  }
  assert.ok(istOk('000'));
  assert.ok(!istOk('403'));
});
```

- [ ] **Step 2: Run → FAIL**
Run: `npm test -w @kreiseck/elda`

- [ ] **Step 3: Implement**

`packages/elda/src/status.ts`:
```ts
/**
 * Status-Codes des ELDA Transfer-Webservice v4 (1:1 aus der
 * Schnittstellenbeschreibung V4). Steht im `serviceResult.statusCode` jeder Antwort.
 */
export const ELDA_STATUS: Record<string, string> = {
  '000': 'OK',
  '500': 'Interner Verarbeitungsfehler',
  '551': 'Request abgelaufen (created älter als 60 Sekunden)',
  '552': 'Nonce wurde bereits verwendet',
  '553': 'Seriennummer für dieses Service nicht berechtigt',
  '554': 'Nonce nicht gesetzt',
  '555': 'created nicht gesetzt',
  '557': 'API-Key ungültig',
  '558': 'Seriennummer und/oder Kundenpasswort falsch',
  '559': 'Unerlaubter Content-Type',
  '401': 'dateiName zu lang (max 255)',
  '402': 'dateiName nicht gesetzt',
  '403': 'Datei nicht verarbeitet (auslösender Fehlercode in der Meldung)',
  '404': 'Datei wird noch verarbeitet (Verarbeitung > 40 Sekunden)',
  '405': 'Datei ist Duplikat (Protokollnummer des Originals in der Meldung)',
  '406': 'Datei mit Protokollnummer nicht vorhanden',
  '407': 'Keine Berechtigung, Datei zu empfangen (Seriennummer stimmt nicht überein)',
  '408': 'Datei laut Protokollnummer wurde bereits empfangen',
};

/** True, wenn der Aufruf technisch ok war (`statusCode === '000'`). */
export function istOk(statusCode: string): boolean {
  return statusCode === '000';
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**
```bash
git add packages/elda/src/status.ts packages/elda/src/status.test.ts
git commit -m "feat(elda): vollstaendige Status-Code-Tabelle"
```

---

### Task 4: SecurityParameters

**Files:**
- Create: `packages/elda/src/security.ts`
- Create: `packages/elda/src/security.test.ts`

**Interfaces:**
- Produces:
  - `interface SecurityFelder { apiKey: string; created: string; kundenpasswort: string; nonce: string; seriennummer: string; }`
  - `interface SecurityQuelle { seriennummer: string; kundenpasswort: string; apiKey: string; }`
  - `function baueSecurity(q: SecurityQuelle, opts?: { nonce?: string; created?: string }): SecurityFelder`
    — hasht `kundenpasswort` zu SHA-512 hex lowercase; `nonce` default `randomUUID()`;
    `created` default `new Date().toISOString()`. `opts` macht es testbar/deterministisch.

- [ ] **Step 1: Failing test**

`packages/elda/src/security.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baueSecurity } from './security';

test('baueSecurity: SHA-512 hex lowercase + Felder', () => {
  const s = baueSecurity(
    { seriennummer: 'S1', kundenpasswort: 'geheim', apiKey: 'K1' },
    { nonce: 'N1', created: '2026-07-25T07:00:00.000Z' },
  );
  assert.equal(s.seriennummer, 'S1');
  assert.equal(s.apiKey, 'K1');
  assert.equal(s.nonce, 'N1');
  assert.equal(s.created, '2026-07-25T07:00:00.000Z');
  assert.equal(s.kundenpasswort, createHash('sha512').update('geheim', 'utf8').digest('hex'));
  assert.match(s.kundenpasswort, /^[0-9a-f]{128}$/); // hex lowercase, 512 bit
});

test('baueSecurity: Defaults nonce (UUID) + created (ISO)', () => {
  const a = baueSecurity({ seriennummer: 'S', kundenpasswort: 'p', apiKey: 'K' });
  const b = baueSecurity({ seriennummer: 'S', kundenpasswort: 'p', apiKey: 'K' });
  assert.match(a.nonce, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.nonce, b.nonce); // eindeutig
  assert.match(a.created, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

`packages/elda/src/security.ts`:
```ts
import { createHash, randomUUID } from 'node:crypto';

/** Gehashte Security-Felder, wie sie in den SOAP-Request gehen. */
export interface SecurityFelder {
  apiKey: string;
  created: string;
  kundenpasswort: string; // SHA-512 hex lowercase
  nonce: string;
  seriennummer: string;
}

/** Rohe Zugangsdaten (Kundenpasswort im Klartext). */
export interface SecurityQuelle {
  seriennummer: string;
  kundenpasswort: string;
  apiKey: string;
}

/**
 * Baut die `securityParameters` für einen Request. `kundenpasswort` wird zu
 * SHA-512 hex lowercase gehasht (ELDA-Vorgabe). `nonce` (Replay-Schutz) ist per
 * Default ein `randomUUID()`, `created` ein ISO-Zeitstempel (Request ~60 s gültig).
 * `opts` erlaubt deterministische Werte für Tests.
 */
export function baueSecurity(
  q: SecurityQuelle,
  opts: { nonce?: string; created?: string } = {},
): SecurityFelder {
  return {
    apiKey: q.apiKey,
    created: opts.created ?? new Date().toISOString(),
    kundenpasswort: createHash('sha512').update(q.kundenpasswort, 'utf8').digest('hex'),
    nonce: opts.nonce ?? randomUUID(),
    seriennummer: q.seriennummer,
  };
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**
```bash
git add packages/elda/src/security.ts packages/elda/src/security.test.ts
git commit -m "feat(elda): securityParameters (SHA-512, nonce, created)"
```

---

### Task 5: SOAP-Envelope-Builder

**Files:**
- Create: `packages/elda/src/envelope.ts`
- Create: `packages/elda/src/envelope.test.ts`

**Interfaces:**
- Consumes: `SecurityFelder` (Task 4), `ELDA_NAMESPACE` (Task 2),
  `escapeXmlText` (aus `@kreiseck/finanzonline-core`).
- Produces:
  - `interface EldaFeld { name: string; value: string; }`
  - `function baueEldaEnvelope(methode: string, security: SecurityFelder, felder: EldaFeld[]): string`
    — SOAP-1.1-Envelope: `<v4:{methode}><arg0><securityParameters>…</securityParameters>{felder…}</arg0></v4:{methode}>`.
    securityParameters-Reihenfolge: apiKey, created, kundenpasswort, nonce, seriennummer.

- [ ] **Step 1: Failing test**

`packages/elda/src/envelope.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueEldaEnvelope } from './envelope';

const sec = { apiKey: 'K1', created: 'C', kundenpasswort: 'H', nonce: 'N', seriennummer: 'S' };

test('baueEldaEnvelope: verschachtelte arg0/securityParameters-Struktur', () => {
  const xml = baueEldaEnvelope('senden', sec, [
    { name: 'dateiName', value: 'm.xml' },
    { name: 'payload', value: 'BASE64' },
  ]);
  assert.match(xml, /<v4:senden xmlns:v4="http:\/\/v4\.transfer\.ws\.elda\.at\/">/);
  assert.match(xml, /<arg0><securityParameters><apiKey>K1<\/apiKey><created>C<\/created><kundenpasswort>H<\/kundenpasswort><nonce>N<\/nonce><seriennummer>S<\/seriennummer><\/securityParameters><dateiName>m\.xml<\/dateiName><payload>BASE64<\/payload><\/arg0>/);
  assert.match(xml, /<\/v4:senden>/);
});

test('baueEldaEnvelope: keine Zusatzfelder (ruecksendungenAuflisten)', () => {
  const xml = baueEldaEnvelope('ruecksendungenAuflisten', sec, []);
  assert.match(xml, /<arg0><securityParameters>.*<\/securityParameters><\/arg0>/);
});

test('baueEldaEnvelope: escaped Sonderzeichen im Wert', () => {
  const xml = baueEldaEnvelope('senden', sec, [{ name: 'dateiName', value: 'a&b<c' }]);
  assert.match(xml, /<dateiName>a&amp;b&lt;c<\/dateiName>/);
});
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

`packages/elda/src/envelope.ts`:
```ts
import { escapeXmlText } from '@kreiseck/finanzonline-core';
import { ELDA_NAMESPACE } from './endpoints';
import type { SecurityFelder } from './security';

/** Ein methodenspezifisches Feld unter `arg0` (z. B. dateiName, payload, protokollnummer). */
export interface EldaFeld {
  name: string;
  value: string;
}

function el(name: string, value: string): string {
  return `<${name}>${escapeXmlText(value)}</${name}>`;
}

/**
 * Baut den SOAP-1.1-Envelope für eine Transfer-Webservice-Methode. Die
 * Methoden-Wrapper (`<v4:{methode}>`) ist namespace-qualifiziert; `arg0`,
 * `securityParameters` und die Felder sind (JAX-WS-typisch) unqualifiziert.
 */
export function baueEldaEnvelope(methode: string, security: SecurityFelder, felder: EldaFeld[]): string {
  const sec =
    '<securityParameters>' +
    el('apiKey', security.apiKey) +
    el('created', security.created) +
    el('kundenpasswort', security.kundenpasswort) +
    el('nonce', security.nonce) +
    el('seriennummer', security.seriennummer) +
    '</securityParameters>';
  const rest = felder.map((f) => el(f.name, f.value)).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soapenv:Body>' +
    `<v4:${methode} xmlns:v4="${ELDA_NAMESPACE}"><arg0>${sec}${rest}</arg0></v4:${methode}>` +
    '</soapenv:Body>' +
    '</soapenv:Envelope>'
  );
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**
```bash
git add packages/elda/src/envelope.ts packages/elda/src/envelope.test.ts
git commit -m "feat(elda): SOAP-Envelope-Builder (arg0/securityParameters)"
```

---

### Task 6: Rücksendungs-Zuordnung

**Files:**
- Create: `packages/elda/src/zuordnung.ts`
- Create: `packages/elda/src/zuordnung.test.ts`

**Interfaces:**
- Consumes: `Ruecksendung` (in dieser Datei definiert, von Task 7 re-exportiert).
- Produces:
  - `interface Ruecksendung { protokollnummer: string; dateiName: string; }`
  - `function zuordnung(sendungsProtokollnummer: string, ruecksendungen: Ruecksendung[]): Ruecksendung | undefined`
    — findet die Rücksendung, deren `dateiName` die Sendungs-Protokollnummer enthält (FAQ 8.1).

- [ ] **Step 1: Failing test**

`packages/elda/src/zuordnung.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zuordnung } from './zuordnung';

test('zuordnung: findet Rücksendung mit Sendungs-Protokollnummer im dateiName', () => {
  const rs = [
    { protokollnummer: '999', dateiName: 'fehler_155764331.xml' },
    { protokollnummer: '888', dateiName: 'ok_155764332.xml' },
  ];
  assert.equal(zuordnung('155764332', rs)?.protokollnummer, '888');
  assert.equal(zuordnung('155764331', rs)?.protokollnummer, '999');
});

test('zuordnung: kein Match -> undefined', () => {
  assert.equal(zuordnung('123', [{ protokollnummer: '1', dateiName: 'x.xml' }]), undefined);
});
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

`packages/elda/src/zuordnung.ts`:
```ts
/** Eine abholbereite Rücksendung (Protokollnummer + Dateiname). */
export interface Ruecksendung {
  protokollnummer: string;
  dateiName: string;
}

/**
 * Ordnet eine Sendung ihrer Rücksendung zu: laut ELDA steckt die Protokollnummer
 * der ursprünglichen Sendung im `dateiName` der Rücksendung (FAQ 8.1). Liefert die
 * erste passende Rücksendung oder `undefined`.
 */
export function zuordnung(
  sendungsProtokollnummer: string,
  ruecksendungen: Ruecksendung[],
): Ruecksendung | undefined {
  return ruecksendungen.find((r) => r.dateiName.includes(sendungsProtokollnummer));
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**
```bash
git add packages/elda/src/zuordnung.ts packages/elda/src/zuordnung.test.ts
git commit -m "feat(elda): Ruecksendungs-Zuordnung (FAQ 8.1)"
```

---

### Task 7: Transfer-Client (senden / ruecksendungenAuflisten / empfangen)

**Files:**
- Create: `packages/elda/src/transfer.ts`
- Create: `packages/elda/src/transfer.test.ts`

**Interfaces:**
- Consumes: `baueSecurity`/`SecurityQuelle` (Task 4), `baueEldaEnvelope`/`EldaFeld`
  (Task 5), `ELDA_ENDPOINTS`/`EldaUmgebung` (Task 2), `Ruecksendung` (Task 6),
  `istOk` (Task 3); aus core: `callSoap`, `TransportOptions`, `parseXml`,
  `findDescendant`, `childText`, `firstChild`.
- Produces: `createEldaTransfer(config: EldaConfig): EldaTransfer` samt
  `EldaConfig`, `EldaTransfer`, `SendenErgebnis`, `EmpfangenErgebnis`.

- [ ] **Step 1: Failing test**

`packages/elda/src/transfer.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEldaTransfer } from './transfer';

const cfg = (fetchImpl: unknown) => ({
  seriennummer: 'S1', kundenpasswort: 'p', apiKey: 'K1', umgebung: 'kundentest' as const,
  transport: { fetchImpl: fetchImpl as typeof fetch },
});
const soap = (inner: string) =>
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;

test('senden: parst statusCode/protokollnummer/dateiId + baut Request an Kundentest', async () => {
  let sentTo = ''; let body = '';
  const resp = soap('<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><dateiId>199565708</dateiId><eldaZeitstempel>2026-07-25T07:00:00.000+02:00</eldaZeitstempel><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>');
  const fetchImpl = async (url: string, init: { body: string }) => { sentTo = url; body = init.body; return new Response(resp, { status: 200 }); };
  const elda = createEldaTransfer(cfg(fetchImpl));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: Buffer.from('<x/>') });
  assert.equal(sentTo, 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
  assert.match(body, /<v4:senden/);
  assert.match(body, /<payload>PHgvPg==<\/payload>/); // base64 von "<x/>"
  assert.equal(r.ok, true);
  assert.equal(r.statusCode, '000');
  assert.equal(r.protokollnummer, '155764331');
  assert.equal(r.dateiId, '199565708');
});

test('senden: fachlicher Fehler wird NICHT geworfen (ok:false + meldung)', async () => {
  const resp = soap('<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>fehlerCode: E1</messages><statusCode>403</statusCode></serviceResult><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '403');
  assert.equal(r.meldung, 'fehlerCode: E1');
});

test('ruecksendungenAuflisten: parst mehrere ruecksendungen', async () => {
  const resp = soap('<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><ruecksendungen><dateiName>fehler_155764331</dateiName><protokollnummer>155764332</protokollnummer></ruecksendungen><ruecksendungen><dateiName>ok_155764340</dateiName><protokollnummer>155764341</protokollnummer></ruecksendungen></return></ns2:ruecksendungenAuflistenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const list = await elda.ruecksendungenAuflisten();
  assert.equal(list.length, 2);
  assert.equal(list[0]?.protokollnummer, '155764332');
  assert.equal(list[0]?.dateiName, 'fehler_155764331');
  assert.equal(list[1]?.protokollnummer, '155764341');
});

test('empfangen: parst statusCode + datei-Metadaten + inline base64 inhalt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(`<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>199565708</id><name>mitteilung.xml</name><dateiTyp>1</dateiTyp><md5>abc</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`);
  let body = '';
  const elda = createEldaTransfer(cfg(async (_u: string, init: { body: string }) => { body = init.body; return new Response(resp, { status: 200 }); }));
  const r = await elda.empfangen('155764332');
  assert.match(body, /<protokollnummer>155764332<\/protokollnummer>/);
  assert.equal(r.ok, true);
  assert.equal(r.datei?.name, 'mitteilung.xml');
  assert.equal(r.datei?.md5, 'abc');
  assert.equal(r.datei?.inhalt.toString('utf8'), '<protokoll/>');
});

test('empfangen: nicht vorhanden -> ok:false, kein datei', async () => {
  const resp = soap('<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>Keine Rücksendung mit Protokollnummer 1 vorhanden.</messages><statusCode>406</statusCode></serviceResult></return></ns2:empfangenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '406');
  assert.equal(r.datei, undefined);
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**

`packages/elda/src/transfer.ts`:
```ts
import {
  callSoap,
  parseXml,
  findDescendant,
  firstChild,
  childText,
  type TransportOptions,
  type XmlNode,
} from '@kreiseck/finanzonline-core';
import { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
import { baueSecurity, type SecurityQuelle } from './security';
import { baueEldaEnvelope, type EldaFeld } from './envelope';
import { istOk } from './status';
import type { Ruecksendung } from './zuordnung';

/** Konfiguration für {@link createEldaTransfer}. */
export interface EldaConfig extends SecurityQuelle {
  /** Standard: 'produktion'. */
  umgebung?: EldaUmgebung;
  /** Optionaler Endpoint-Override (sonst aus `umgebung`). */
  endpoint?: string;
  transport?: TransportOptions;
}

/** Ergebnis von {@link EldaTransfer.senden}. `ok` = `statusCode === '000'` (= von ELDA EMPFANGEN). */
export interface SendenErgebnis {
  statusCode: string;
  ok: boolean;
  protokollnummer?: string;
  dateiId?: string;
  eldaZeitstempel?: string;
  meldung?: string;
}

/** Ergebnis von {@link EldaTransfer.empfangen}. */
export interface EmpfangenErgebnis {
  statusCode: string;
  ok: boolean;
  datei?: { id?: string; name?: string; inhalt: Buffer; dateiTyp?: number; md5?: string };
  meldung?: string;
}

/** ELDA-Transfer-Client. */
export interface EldaTransfer {
  /**
   * Überträgt eine Datei (= eine Meldung) an ELDA. `inhalt` ist der Datei-Payload
   * (String oder Buffer), wird base64-kodiert. `statusCode '000'` heißt „von ELDA
   * EMPFANGEN" — die fachliche Verarbeitung kommt asynchron über {@link empfangen}.
   */
  senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<SendenErgebnis>;
  /** Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle). */
  ruecksendungenAuflisten(): Promise<Ruecksendung[]>;
  /** Holt EINE Rücksendung per Protokollnummer. Einmalig — danach nicht mehr abrufbar. */
  empfangen(protokollnummer: string | number): Promise<EmpfangenErgebnis>;
}

function statusUndMeldung(resp: XmlNode): { statusCode: string; meldung?: string } {
  const sr = findDescendant(resp, 'serviceResult');
  const statusCode = (sr && childText(sr, 'statusCode')) || '';
  const meldung = sr ? childText(sr, 'messages') : undefined;
  return { statusCode, meldung };
}

/** Baut den ELDA-Transfer-Client. Zustandslos außer der übergebenen Konfiguration. */
export function createEldaTransfer(config: EldaConfig): EldaTransfer {
  const endpoint = config.endpoint ?? ELDA_ENDPOINTS[config.umgebung ?? 'produktion'];
  const quelle: SecurityQuelle = {
    seriennummer: config.seriennummer,
    kundenpasswort: config.kundenpasswort,
    apiKey: config.apiKey,
  };

  async function ruf(methode: string, felder: EldaFeld[]): Promise<XmlNode> {
    const body = baueEldaEnvelope(methode, baueSecurity(quelle), felder);
    return callSoap({ endpoint, soapAction: methode, body }, config.transport);
  }

  return {
    async senden(args): Promise<SendenErgebnis> {
      const inhalt = typeof args.inhalt === 'string' ? Buffer.from(args.inhalt, 'utf8') : args.inhalt;
      const root = await ruf('senden', [
        { name: 'dateiName', value: args.dateiName },
        { name: 'payload', value: inhalt.toString('base64') },
      ]);
      const resp = findDescendant(root, 'return') ?? root;
      const { statusCode, meldung } = statusUndMeldung(resp);
      const erg: SendenErgebnis = { statusCode, ok: istOk(statusCode) };
      const protokollnummer = childText(resp, 'protokollnummer');
      if (protokollnummer) erg.protokollnummer = protokollnummer;
      const dateiId = childText(resp, 'dateiId');
      if (dateiId) erg.dateiId = dateiId;
      const eldaZeitstempel = childText(resp, 'eldaZeitstempel');
      if (eldaZeitstempel) erg.eldaZeitstempel = eldaZeitstempel;
      if (meldung) erg.meldung = meldung;
      return erg;
    },

    async ruecksendungenAuflisten(): Promise<Ruecksendung[]> {
      const root = await ruf('ruecksendungenAuflisten', []);
      const resp = findDescendant(root, 'return') ?? root;
      return resp.children
        .filter((c) => c.name === 'ruecksendungen')
        .map((c) => ({
          protokollnummer: childText(c, 'protokollnummer') ?? '',
          dateiName: childText(c, 'dateiName') ?? '',
        }));
    },

    async empfangen(protokollnummer): Promise<EmpfangenErgebnis> {
      const root = await ruf('empfangen', [{ name: 'protokollnummer', value: String(protokollnummer) }]);
      const resp = findDescendant(root, 'return') ?? root;
      const { statusCode, meldung } = statusUndMeldung(resp);
      const erg: EmpfangenErgebnis = { statusCode, ok: istOk(statusCode) };
      const datei = findDescendant(resp, 'datei');
      if (datei) {
        const inhaltB64 = childText(datei, 'payload') ?? '';
        const d: EmpfangenErgebnis['datei'] = { inhalt: Buffer.from(inhaltB64, 'base64') };
        const id = childText(datei, 'id');
        if (id) d.id = id;
        const name = childText(datei, 'name');
        if (name) d.name = name;
        const md5 = childText(datei, 'md5');
        if (md5) d.md5 = md5;
        const dateiTyp = childText(datei, 'dateiTyp');
        if (dateiTyp) d.dateiTyp = Number.parseInt(dateiTyp, 10);
        erg.datei = d;
      }
      if (meldung) erg.meldung = meldung;
      return erg;
    },
  };
}
```

Note zu `firstChild`-Import: wird hier nicht benutzt — aus dem Import entfernen,
falls der Linter `noUnusedLocals` meldet (nur `callSoap, parseXml, findDescendant,
childText, TransportOptions, XmlNode` bleiben; `parseXml` wird von `callSoap`
intern genutzt und ist hier ebenfalls entfernbar — der Implementer entfernt beim
Grün-Machen jeden Import, den `tsc` als unbenutzt meldet).

- [ ] **Step 4: Run → PASS** (`npm test -w @kreiseck/elda`)
- [ ] **Step 5: Commit**
```bash
git add packages/elda/src/transfer.ts packages/elda/src/transfer.test.ts
git commit -m "feat(elda): Transfer-Client (senden/ruecksendungenAuflisten/empfangen)"
```

---

### Task 8: Barrel-Export + README (Doku + Beispiele)

**Files:**
- Modify: `packages/elda/src/index.ts`
- Create: `packages/elda/README.md`
- Create: `packages/elda/src/index.test.ts`

**Interfaces:**
- Produces: vollständiger öffentlicher Export + Doku.

- [ ] **Step 1: Failing test (API-Oberfläche)**

`packages/elda/src/index.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as elda from './index';

test('index exportiert die öffentliche API', () => {
  assert.equal(typeof elda.createEldaTransfer, 'function');
  assert.equal(typeof elda.baueSecurity, 'function');
  assert.equal(typeof elda.zuordnung, 'function');
  assert.equal(typeof elda.istOk, 'function');
  assert.ok(elda.ELDA_ENDPOINTS.produktion);
  assert.ok(elda.ELDA_STATUS['000']);
  assert.equal(elda.ELDA_NAMESPACE, 'http://v4.transfer.ws.elda.at/');
});
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: index.ts füllen**

`packages/elda/src/index.ts` (ersetzt den Stub):
```ts
export { ELDA_ENDPOINTS, ELDA_NAMESPACE, type EldaUmgebung } from './endpoints';
export { ELDA_STATUS, istOk } from './status';
export { baueSecurity, type SecurityFelder, type SecurityQuelle } from './security';
export { baueEldaEnvelope, type EldaFeld } from './envelope';
export { zuordnung, type Ruecksendung } from './zuordnung';
export {
  createEldaTransfer,
  type EldaConfig,
  type EldaTransfer,
  type SendenErgebnis,
  type EmpfangenErgebnis,
} from './transfer';
```
(Der `smoke.test.ts` referenziert `ELDA_PAKET` nicht mehr → in Step 3 auch
`smoke.test.ts` löschen: `git rm packages/elda/src/smoke.test.ts`.)

- [ ] **Step 4: README schreiben**

`packages/elda/README.md` — MUSS enthalten: Kurzbeschreibung; Installation;
Zugangsdaten (Seriennummer/Kundenpasswort/API-Key — API-Key bei ELDA anfordern;
Umgebungen); das vollständige End-to-End-Beispiel unten; die Status-Code-Tabelle
(aus `ELDA_STATUS`); den prominenten Hinweis „`senden 000` = empfangen, nicht
verarbeitet — Rückmeldung asynchron über `empfangen`"; den MTOM-Hinweis (siehe
Folge-Check); und einen Abschnitt „v2: Meldungs-Builder (Anmeldung/Abmeldung/mBGM)
folgen nach SV-Datensatzbeschreibung".

Beispiel-Block für die README:
```ts
import { createEldaTransfer, zuordnung } from '@kreiseck/elda';

const elda = createEldaTransfer({
  seriennummer: 'DEINE_SERIENNUMMER',
  kundenpasswort: 'DEIN_KUNDENPASSWORT', // Klartext; wird intern SHA-512-gehasht
  apiKey: 'DEIN_API_KEY',                // bei ELDA anfordern
  umgebung: 'kundentest',                // 'produktion' | 'kundentest' | 'sit'
});

// 1) Meldung (Datei-XML) senden
const gesendet = await elda.senden({ dateiName: 'mbgm.xml', inhalt: meldungsXml });
if (!gesendet.ok) throw new Error(`Senden fehlgeschlagen: ${gesendet.statusCode} ${gesendet.meldung}`);
const meineNr = gesendet.protokollnummer!; // merken!

// 2) später: Rücksendung (Verarbeitungsprotokoll) abholen
const liste = await elda.ruecksendungenAuflisten();
const rs = zuordnung(meineNr, liste); // findet die zu meiner Sendung gehörende Rücksendung
if (rs) {
  const antwort = await elda.empfangen(rs.protokollnummer);
  // antwort.datei.inhalt = Buffer mit dem Protokoll-XML -> parsen
}
```

- [ ] **Step 5: Run → PASS + Commit**
Run: `npm test -w @kreiseck/elda`
```bash
git rm packages/elda/src/smoke.test.ts
git add packages/elda/src/index.ts packages/elda/src/index.test.ts packages/elda/README.md
git commit -m "feat(elda): Barrel-Export + README (Doku + End-to-End-Beispiel)"
```

---

## Folge-Check (nach v1, braucht ELDA-Testzugang — NICHT Teil dieses Plans)

Sobald echte ELDA-Kundentest-Zugangsdaten (Seriennummer + API-Key) vorliegen: einen
opt-in Live-Test gegen `kundentest` fahren und **verifizieren**: (a) ob der `payload`
als inline-`base64Binary` akzeptiert wird oder **MTOM/multipart** nötig ist (dann
Sende-/Empfangs-Marshalling anpassen); (b) den erwarteten `SOAPAction`-Header;
(c) das `created`-Format. Erst danach den Sendepfad als „produktionsreif" markieren.
Bis dahin ist die Logik vollständig unit-getestet.

## Selbst-Review (durchgeführt)

- **Spec-Abdeckung:** 3 Methoden (Task 7), securityParameters/SHA-512 (Task 4), alle
  Status-Codes (Task 3), Endpoints/Umgebungen (Task 2), Korrelation (Task 6),
  Envelope (Task 5), öffentliches API + Doku/Beispiele (Task 8). MTOM als
  dokumentierter Folge-Check. Meldungs-Builder bewusst v2 (Spec-Scope).
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typkonsistenz:** `SecurityFelder`/`SecurityQuelle`, `EldaFeld`, `Ruecksendung`,
  `EldaConfig`/`SendenErgebnis`/`EmpfangenErgebnis` durchgängig gleich benannt.
