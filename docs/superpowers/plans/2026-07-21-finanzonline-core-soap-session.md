# finanzonline-core: SOAP-Layer + Session — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das npm-Workspace-Gerüst und das Paket `@kreiseck/finanzonline-core` aufbauen — selbstgeschriebener SOAP-Layer (Envelope, Parser, Fault) plus zustandslose `login`/`logout`-Session gegen den FinanzOnline Session-Webservice.

**Architecture:** Ein generischer, fachlogik-freier SOAP-Layer (`escape` → `envelope` → `parse` → `fault`) trägt einen `transport` (HTTP über `fetch`, Timeout, konservative Wiederholung). Darauf sitzt `session.ts` mit den verifizierten FinanzOnline-Konstanten und der Returncode-Behandlung. Jede Ebene ist ohne Netz deterministisch testbar; `transport` bekommt `fetch` injiziert.

**Tech Stack:** TypeScript (strict, Kompilat CommonJS + `.d.ts`), `tsc` ohne Bundler, Tests mit `node:test` + `node:assert/strict`, keine Laufzeitabhängigkeiten (HTTP über globales `fetch`, sonst nur `node:*`).

## Global Constraints

- **Keine Laufzeitabhängigkeiten.** Nur `node:*` und globales `fetch`/`AbortController`/`Response`. `typescript` und `@types/node` sind reine devDependencies.
- **Node ≥ 18.18** (lokales Dev-Env ist 18.20.5). Kein experimentelles Flag.
- **TypeScript `strict: true`**, Kompilat CommonJS, `declaration` + `sourceMap` an.
- **Lizenz Apache-2.0**, `"license": "Apache-2.0"` (SPDX) in jeder `package.json`.
- **No footprint:** keine Hinweise auf KI/Assistenten in Code, Kommentaren, Commits, Dateinamen. Commits ohne Co-Author-/Tool-Trailer.
- **Feldreihenfolge ist bindend** (document/literal). Envelope-Felder werden als geordnetes Array übergeben, nie als ungeordnetes Objekt.
- **Verifizierte Session-Fakten** (Quelle: `sessionService.wsdl`, `session.xsd`, BMF-Session-Webservice-PDF; siehe `docs/design.md` §2.1):
  - Endpoint `https://finanzonline.bmf.gv.at/fonws/ws/session`, Namespace `https://finanzonline.bmf.gv.at/fon/ws/session`.
  - SOAP 1.1, `Content-Type: text/xml; charset=utf-8`, `SOAPAction` gesetzt (Wert in Anführungszeichen).
  - Body-Wurzelelement `loginRequest` / `logoutRequest` (nicht `login`/`logout`); soapAction `login` / `logout`.
  - `loginRequest` (Reihenfolge): `tid` `[0-9A-Za-z]{8,12}`, `benid` Länge 5–12 (kein Muster), `pin` Länge 5–128, `herstellerid` `[0-9A-Za-z]{10,24}`.
  - `loginResponse` (Reihenfolge): `id` (String), `rc` (int), `msg?`.
  - `logoutRequest` (Reihenfolge): `tid` `[0-9A-Za-z]{8,12}`, `benid` `[0-9A-Za-z]{5,12}` (mit Muster), `id` `[0-9A-Za-z]{10,24}`.
  - `logoutResponse` (Reihenfolge): `rc` (int), `msg?` (kein `id`).
  - Returncodes: `0` ok; `-1` abgelaufen; `-2` Wartung; `-3` technisch; `-4` Zugangsdaten; `-5` Benutzer nach Fehlversuchen gesperrt; `-6` Benutzer gesperrt; `-7` kein Webservice-Benutzer; `-8` Teilnehmer gesperrt/nicht berechtigt.
- **Wurf-Regel:** technische Fehler (Netz, SOAP-Fault, unparsebare Antwort) und **jeder** negative Session-`rc` werfen. `rc = -1` bekommt einen eigenen Fehlertyp. Kein automatischer Neu-Login.

---

### Task 1: Workspace- und Paketgerüst

**Files:**
- Create: `package.json` (Repo-Root)
- Create: `tsconfig.base.json` (Repo-Root)
- Create: `.gitignore` (Repo-Root)
- Create: `packages/finanzonline-core/package.json`
- Create: `packages/finanzonline-core/tsconfig.json`
- Create: `packages/finanzonline-core/tsconfig.test.json`
- Create: `packages/finanzonline-core/src/smoke.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: lauffähige Toolchain — `npm test -w @kreiseck/finanzonline-core` kompiliert `src` nach `.test-dist` und lässt `node:test` laufen.

- [ ] **Step 1: Root-`package.json` anlegen**

`package.json`:
```json
{
  "name": "austria-gov-connect",
  "version": "0.0.0",
  "private": true,
  "license": "Apache-2.0",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Basis-`tsconfig` anlegen**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: `.gitignore` anlegen**

`.gitignore`:
```
node_modules/
dist/
test-dist/
*.tsbuildinfo
```

- [ ] **Step 4: Paket-`package.json` anlegen**

`packages/finanzonline-core/package.json`:
```json
{
  "name": "@kreiseck/finanzonline-core",
  "version": "0.0.0",
  "description": "FinanzOnline Session- und SOAP-Transport für Node",
  "license": "Apache-2.0",
  "type": "commonjs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "engines": { "node": ">=18.18" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "tsc -p tsconfig.test.json && node --test $(find test-dist -name '*.test.js')",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0"
  }
}
```

- [ ] **Step 5: Paket-`tsconfig`e anlegen**

`packages/finanzonline-core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/finanzonline-core/tsconfig.test.json`:
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

> Hinweis: `npm test` kompiliert `src` (inkl. `*.test.ts`) nach `test-dist` und übergibt die gefundenen `*.test.js` **explizit** an `node --test` (`$(find test-dist -name '*.test.js')`). Explizite Dateiübergabe statt Auto-Discovery — so kann kein „0 Tests, trotzdem grün" entstehen. `node:test` läuft auf Node 18 mit einer Experimental-Warnung, die Tests selbst sind stabil. `dist` (Produktions-Build) enthält keine Testdateien.

- [ ] **Step 6: Smoke-Test schreiben**

`packages/finanzonline-core/src/smoke.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Toolchain läuft', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 7: Abhängigkeiten installieren**

Run: `npm install`
Expected: legt `node_modules` an, verlinkt den Workspace `@kreiseck/finanzonline-core`, keine Fehler.

- [ ] **Step 8: Test laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS — `# pass 1`, `# fail 0`.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.base.json .gitignore packages/finanzonline-core package-lock.json
git commit -m "feat(finanzonline-core): npm-Workspace und Paketgeruest mit node:test-Toolchain"
```

---

### Task 2: Fehlerhierarchie (`errors.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/errors.ts`
- Test: `packages/finanzonline-core/src/errors.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `class FonError extends Error`
  - `class FonTransportError extends FonError`
  - `class FonProtocolError extends FonError`
  - `class FonSoapFaultError extends FonError { readonly faultcode: string; readonly detail?: string }` — Konstruktor `(message: string, faultcode: string, detail?: string)`
  - `class FonSessionError extends FonError { readonly rc: number; readonly serverMsg?: string }` — Konstruktor `(rc: number, serverMsg?: string)`
  - `class FonSessionExpiredError extends FonSessionError` (für `rc === -1`)
  - `const SESSION_RC_MESSAGES: Record<number, string>`
  - `function sessionErrorFor(rc: number, serverMsg?: string): FonSessionError`

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/errors.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FonError,
  FonSessionError,
  FonSessionExpiredError,
  sessionErrorFor,
} from './errors';

test('sessionErrorFor(-1) liefert FonSessionExpiredError', () => {
  const err = sessionErrorFor(-1);
  assert.ok(err instanceof FonSessionExpiredError);
  assert.ok(err instanceof FonSessionError);
  assert.ok(err instanceof FonError);
  assert.equal(err.rc, -1);
  assert.equal(err.name, 'FonSessionExpiredError');
  assert.match(err.message, /abgelaufen/i);
});

test('sessionErrorFor(-4) liefert generische FonSessionError, nicht Expired', () => {
  const err = sessionErrorFor(-4);
  assert.ok(err instanceof FonSessionError);
  assert.ok(!(err instanceof FonSessionExpiredError));
  assert.equal(err.rc, -4);
});

test('sessionErrorFor kennt -5 bis -8', () => {
  for (const rc of [-5, -6, -7, -8]) {
    assert.match(sessionErrorFor(rc).message, /gesperrt|berechtigt|Webservice-Benutzer/i);
  }
});

test('serverMsg wird an die Meldung angehängt', () => {
  const err = sessionErrorFor(-3, 'Details vom BMF');
  assert.equal(err.serverMsg, 'Details vom BMF');
  assert.match(err.message, /Details vom BMF/);
});

test('unbekannter rc bekommt Fallback-Meldung', () => {
  assert.match(sessionErrorFor(-99).message, /rc=-99/);
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './errors'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/finanzonline-core/src/errors.ts`:
```ts
export class FonError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class FonTransportError extends FonError {}

export class FonProtocolError extends FonError {}

export class FonSoapFaultError extends FonError {
  readonly faultcode: string;
  readonly detail?: string;
  constructor(message: string, faultcode: string, detail?: string) {
    super(message);
    this.faultcode = faultcode;
    this.detail = detail;
  }
}

export const SESSION_RC_MESSAGES: Record<number, string> = {
  [-1]: 'Session ungültig oder abgelaufen',
  [-2]: 'Webservice wegen Wartungsarbeiten nicht verfügbar',
  [-3]: 'Technischer Fehler im Webservice',
  [-4]: 'Zugangsdaten ungültig',
  [-5]: 'Benutzer nach mehreren Fehlversuchen gesperrt',
  [-6]: 'Benutzer gesperrt',
  [-7]: 'Kein Webservice-Benutzer',
  [-8]: 'Teilnehmer für FinanzOnline gesperrt oder nicht berechtigt',
};

export class FonSessionError extends FonError {
  readonly rc: number;
  readonly serverMsg?: string;
  constructor(rc: number, serverMsg?: string) {
    const base = SESSION_RC_MESSAGES[rc] ?? `Session-Fehler (rc=${rc})`;
    super(serverMsg ? `${base}: ${serverMsg}` : base);
    this.rc = rc;
    this.serverMsg = serverMsg;
  }
}

export class FonSessionExpiredError extends FonSessionError {}

export function sessionErrorFor(rc: number, serverMsg?: string): FonSessionError {
  return rc === -1
    ? new FonSessionExpiredError(rc, serverMsg)
    : new FonSessionError(rc, serverMsg);
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/finanzonline-core/src/errors.ts packages/finanzonline-core/src/errors.test.ts
git commit -m "feat(finanzonline-core): Fehlerhierarchie mit Session-Returncode-Mapping"
```

---

### Task 3: XML-Text-Maskierung (`soap/escape.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/soap/escape.ts`
- Test: `packages/finanzonline-core/src/soap/escape.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `function escapeXmlText(value: string): string` — maskiert `&`, `<`, `>` in Element-Textinhalten.

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/soap/escape.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXmlText } from './escape';

test('maskiert Ampersand zuerst, dann Klammern', () => {
  assert.equal(escapeXmlText('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
});

test('erzeugt keine doppelte Maskierung', () => {
  assert.equal(escapeXmlText('&amp;'), '&amp;amp;');
});

test('lässt harmlosen Text unverändert', () => {
  assert.equal(escapeXmlText('KASSE-001'), 'KASSE-001');
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './escape'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/finanzonline-core/src/soap/escape.ts`:
```ts
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/finanzonline-core/src/soap/escape.ts packages/finanzonline-core/src/soap/escape.test.ts
git commit -m "feat(finanzonline-core): XML-Textmaskierung fuer SOAP-Envelope"
```

---

### Task 4: SOAP-Envelope-Builder (`soap/envelope.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/soap/envelope.ts`
- Test: `packages/finanzonline-core/src/soap/envelope.test.ts`

**Interfaces:**
- Consumes: `escapeXmlText` aus `./escape`.
- Produces:
  - `interface EnvelopeField { name: string; value: string }`
  - `interface EnvelopeSpec { namespace: string; bodyElement: string; fields: EnvelopeField[] }`
  - `function buildEnvelope(spec: EnvelopeSpec): string`

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/soap/envelope.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvelope } from './envelope';

const NS = 'https://finanzonline.bmf.gv.at/fon/ws/session';

test('baut vollständigen SOAP-1.1-Envelope mit Default-Namespace am Body-Element', () => {
  const xml = buildEnvelope({
    namespace: NS,
    bodyElement: 'loginRequest',
    fields: [
      { name: 'tid', value: 'ABCD1234' },
      { name: 'benid', value: 'benutzer' },
    ],
  });
  assert.equal(
    xml,
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soapenv:Body>' +
      `<loginRequest xmlns="${NS}">` +
      '<tid>ABCD1234</tid>' +
      '<benid>benutzer</benid>' +
      '</loginRequest>' +
      '</soapenv:Body>' +
      '</soapenv:Envelope>',
  );
});

test('erhält die Feldreihenfolge exakt', () => {
  const xml = buildEnvelope({
    namespace: NS,
    bodyElement: 'x',
    fields: [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
      { name: 'c', value: '3' },
    ],
  });
  assert.ok(xml.indexOf('<a>1</a>') < xml.indexOf('<b>2</b>'));
  assert.ok(xml.indexOf('<b>2</b>') < xml.indexOf('<c>3</c>'));
});

test('maskiert Sonderzeichen in Werten', () => {
  const xml = buildEnvelope({
    namespace: NS,
    bodyElement: 'x',
    fields: [{ name: 'pin', value: 'a&b<c' }],
  });
  assert.match(xml, /<pin>a&amp;b&lt;c<\/pin>/);
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './envelope'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/finanzonline-core/src/soap/envelope.ts`:
```ts
import { escapeXmlText } from './escape';

export interface EnvelopeField {
  name: string;
  value: string;
}

export interface EnvelopeSpec {
  namespace: string;
  bodyElement: string;
  fields: EnvelopeField[];
}

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';

export function buildEnvelope(spec: EnvelopeSpec): string {
  const body = spec.fields
    .map((f) => `<${f.name}>${escapeXmlText(f.value)}</${f.name}>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV}">` +
    '<soapenv:Body>' +
    `<${spec.bodyElement} xmlns="${spec.namespace}">${body}</${spec.bodyElement}>` +
    '</soapenv:Body>' +
    '</soapenv:Envelope>'
  );
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/finanzonline-core/src/soap/envelope.ts packages/finanzonline-core/src/soap/envelope.test.ts
git commit -m "feat(finanzonline-core): SOAP-1.1-Envelope-Builder mit bindender Feldreihenfolge"
```

---

### Task 5: XML-Parser (`soap/parse.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/soap/parse.ts`
- Test: `packages/finanzonline-core/src/soap/parse.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `interface XmlNode { name: string; prefix?: string; attrs: Record<string, string>; children: XmlNode[]; text: string }` (`name` = lokaler Name ohne Präfix)
  - `function parseXml(xml: string): XmlNode` — liefert das Wurzelelement; wirft `Error` bei fehlerhaftem XML
  - `function firstChild(node: XmlNode, localName: string): XmlNode | undefined`
  - `function childText(node: XmlNode, localName: string): string | undefined`
  - `function findDescendant(node: XmlNode, localName: string): XmlNode | undefined` (prüft auch den Knoten selbst)

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/soap/parse.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, firstChild, childText, findDescendant } from './parse';

test('parst verschachtelte Elemente und Textinhalte', () => {
  const root = parseXml('<a><b>hallo</b><c>welt</c></a>');
  assert.equal(root.name, 'a');
  assert.equal(childText(root, 'b'), 'hallo');
  assert.equal(childText(root, 'c'), 'welt');
});

test('überspringt XML-Deklaration und Kommentare', () => {
  const root = parseXml('<?xml version="1.0"?><!-- Kommentar --><a><b>x</b></a>');
  assert.equal(root.name, 'a');
  assert.equal(childText(root, 'b'), 'x');
});

test('trennt Namespace-Präfix vom lokalen Namen ab', () => {
  const root = parseXml(
    '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body><loginResponse><id>S1</id></loginResponse></soapenv:Body></soapenv:Envelope>',
  );
  assert.equal(root.name, 'Envelope');
  assert.equal(root.prefix, 'soapenv');
  const resp = findDescendant(root, 'loginResponse');
  assert.ok(resp);
  assert.equal(childText(resp, 'id'), 'S1');
});

test('dekodiert Entities in Textinhalten', () => {
  const root = parseXml('<a>a &amp; b &lt; c &#65; &#x42;</a>');
  assert.equal(root.text, 'a & b < c A B');
});

test('verarbeitet selbstschließende Elemente', () => {
  const root = parseXml('<a><b/><c>x</c></a>');
  assert.equal(root.children.length, 2);
  assert.equal(firstChild(root, 'b')?.children.length, 0);
  assert.equal(childText(root, 'c'), 'x');
});

test('liest Attribute inklusive Entity-Dekodierung', () => {
  const root = parseXml('<a b="1" c="x &amp; y">t</a>');
  assert.equal(root.attrs['b'], '1');
  assert.equal(root.attrs['c'], 'x & y');
});

test('behandelt CDATA als Rohtext', () => {
  const root = parseXml('<a><![CDATA[<nicht &amp; geparst>]]></a>');
  assert.equal(root.text, '<nicht &amp; geparst>');
});

test('findet Attributende auch bei > im Attributwert', () => {
  const root = parseXml('<a b="1 > 0">t</a>');
  assert.equal(root.attrs['b'], '1 > 0');
  assert.equal(root.text, 't');
});

test('wirft bei nicht geschlossenem Tag', () => {
  assert.throws(() => parseXml('<a><b></a>'), /Mismatched|Unterminated/);
});

test('wirft bei fehlendem Wurzelelement', () => {
  assert.throws(() => parseXml('<!-- nur ein Kommentar -->'), /No root element/);
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './parse'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/finanzonline-core/src/soap/parse.ts`:
```ts
export interface XmlNode {
  name: string;
  prefix?: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const replacement = NAMED_ENTITIES[body];
    return replacement !== undefined ? replacement : match;
  });
}

function splitName(raw: string): { prefix?: string; name: string } {
  const i = raw.indexOf(':');
  return i === -1 ? { name: raw } : { prefix: raw.slice(0, i), name: raw.slice(i + 1) };
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

// Findet die Position des schließenden '>' eines Tags ab `start`,
// wobei '>' innerhalb von Attributwerten (in Quotes) ignoriert wird.
function findTagEnd(xml: string, start: number): number {
  let quote: string | null = null;
  for (let j = start; j < xml.length; j++) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return j;
    }
  }
  return -1;
}

function parseStartTag(inner: string): XmlNode {
  let k = 0;
  const len = inner.length;
  while (k < len && isSpace(inner[k]!)) k++;
  const nameStart = k;
  while (k < len && !isSpace(inner[k]!)) k++;
  const { prefix, name } = splitName(inner.slice(nameStart, k));
  const attrs: Record<string, string> = {};

  while (k < len) {
    while (k < len && isSpace(inner[k]!)) k++;
    if (k >= len) break;
    const attrStart = k;
    while (k < len && inner[k] !== '=' && !isSpace(inner[k]!)) k++;
    const attrRaw = inner.slice(attrStart, k);
    while (k < len && isSpace(inner[k]!)) k++;
    if (inner[k] !== '=') {
      if (attrRaw) attrs[splitName(attrRaw).name] = '';
      continue;
    }
    k++; // '='
    while (k < len && isSpace(inner[k]!)) k++;
    const quote = inner[k];
    let value = '';
    if (quote === '"' || quote === "'") {
      k++;
      const valueStart = k;
      while (k < len && inner[k] !== quote) k++;
      value = inner.slice(valueStart, k);
      k++; // schließendes Quote
    } else {
      const valueStart = k;
      while (k < len && !isSpace(inner[k]!)) k++;
      value = inner.slice(valueStart, k);
    }
    attrs[splitName(attrRaw).name] = decodeEntities(value);
  }

  return { name, prefix, attrs, children: [], text: '' };
}

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  const n = xml.length;

  while (i < n) {
    if (xml[i] !== '<') {
      const lt = xml.indexOf('<', i);
      const end = lt === -1 ? n : lt;
      const raw = xml.slice(i, end);
      if (raw.trim().length > 0) {
        stack[stack.length - 1]!.text += decodeEntities(raw);
      }
      i = end;
      continue;
    }

    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i);
      if (end === -1) throw new Error('Unterminated processing instruction');
      i = end + 2;
      continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i);
      if (end === -1) throw new Error('Unterminated comment');
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i);
      if (end === -1) throw new Error('Unterminated CDATA');
      stack[stack.length - 1]!.text += xml.slice(i + 9, end);
      i = end + 3;
      continue;
    }
    if (xml.startsWith('</', i)) {
      const end = xml.indexOf('>', i);
      if (end === -1) throw new Error('Unterminated end tag');
      const { name } = splitName(xml.slice(i + 2, end).trim());
      const top = stack.pop();
      if (!top || top === root) throw new Error(`Unexpected end tag </${name}>`);
      if (top.name !== name) {
        throw new Error(`Mismatched end tag: expected </${top.name}>, got </${name}>`);
      }
      i = end + 1;
      continue;
    }

    const end = findTagEnd(xml, i + 1);
    if (end === -1) throw new Error('Unterminated start tag');
    let inner = xml.slice(i + 1, end);
    const selfClose = inner.endsWith('/');
    if (selfClose) inner = inner.slice(0, -1);
    const node = parseStartTag(inner);
    stack[stack.length - 1]!.children.push(node);
    if (!selfClose) stack.push(node);
    i = end + 1;
  }

  if (stack.length !== 1) throw new Error('Unterminated element(s) in XML');
  const top = root.children[0];
  if (!top) throw new Error('No root element found');
  return top;
}

export function firstChild(node: XmlNode, localName: string): XmlNode | undefined {
  return node.children.find((c) => c.name === localName);
}

export function childText(node: XmlNode, localName: string): string | undefined {
  return firstChild(node, localName)?.text;
}

export function findDescendant(node: XmlNode, localName: string): XmlNode | undefined {
  if (node.name === localName) return node;
  for (const child of node.children) {
    const found = findDescendant(child, localName);
    if (found) return found;
  }
  return undefined;
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS (alle parse-Tests grün).

- [ ] **Step 5: Commit**

```bash
git add packages/finanzonline-core/src/soap/parse.ts packages/finanzonline-core/src/soap/parse.test.ts
git commit -m "feat(finanzonline-core): abhaengigkeitsfreier XML-Parser fuer flache SOAP-Antworten"
```

---

### Task 6: SOAP-Fault-Erkennung (`soap/fault.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/soap/fault.ts`
- Test: `packages/finanzonline-core/src/soap/fault.test.ts`

**Interfaces:**
- Consumes: `XmlNode`, `findDescendant`, `firstChild`, `childText` aus `./parse`.
- Produces:
  - `interface SoapFault { faultcode: string; faultstring: string; detail?: string }`
  - `function detectFault(root: XmlNode): SoapFault | undefined`

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/soap/fault.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from './parse';
import { detectFault } from './fault';

const OK = parseXml(
  '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body><loginResponse><rc>0</rc></loginResponse></soapenv:Body></soapenv:Envelope>',
);

const FAULT = parseXml(
  '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body><soapenv:Fault>' +
    '<faultcode>soapenv:Server</faultcode>' +
    '<faultstring>Interner Fehler</faultstring>' +
    '<detail>Stacktrace</detail>' +
    '</soapenv:Fault></soapenv:Body></soapenv:Envelope>',
);

test('gibt bei fehlerfreier Antwort undefined zurück', () => {
  assert.equal(detectFault(OK), undefined);
});

test('erkennt SOAP-Fault und extrahiert Felder', () => {
  const fault = detectFault(FAULT);
  assert.ok(fault);
  assert.equal(fault.faultcode, 'soapenv:Server');
  assert.equal(fault.faultstring, 'Interner Fehler');
  assert.equal(fault.detail, 'Stacktrace');
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './fault'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/finanzonline-core/src/soap/fault.ts`:
```ts
import { type XmlNode, findDescendant, firstChild, childText } from './parse';

export interface SoapFault {
  faultcode: string;
  faultstring: string;
  detail?: string;
}

export function detectFault(root: XmlNode): SoapFault | undefined {
  const fault = findDescendant(root, 'Fault');
  if (!fault) return undefined;
  const detail = firstChild(fault, 'detail')?.text;
  return {
    faultcode: childText(fault, 'faultcode') ?? '',
    faultstring: childText(fault, 'faultstring') ?? '',
    detail: detail && detail.length > 0 ? detail : undefined,
  };
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/finanzonline-core/src/soap/fault.ts packages/finanzonline-core/src/soap/fault.test.ts
git commit -m "feat(finanzonline-core): SOAP-1.1-Fault-Erkennung"
```

---

### Task 7: HTTP-Transport (`transport.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/transport.ts`
- Test: `packages/finanzonline-core/src/transport.test.ts`

**Interfaces:**
- Consumes: `parseXml`, `XmlNode` aus `./soap/parse`; `detectFault` aus `./soap/fault`; `FonTransportError`, `FonSoapFaultError`, `FonProtocolError` aus `./errors`.
- Produces:
  - `interface TransportOptions { timeoutMs?: number; retries?: number; fetchImpl?: typeof fetch }`
  - `interface SoapCallSpec { endpoint: string; soapAction: string; body: string }`
  - `function callSoap(spec: SoapCallSpec, opts?: TransportOptions): Promise<XmlNode>`

  Verhalten: POST mit `Content-Type: text/xml; charset=utf-8` und `SOAPAction: "<action>"` (in Anführungszeichen). Timeout über `AbortController` (Default 30000 ms). `retries` (Default **0**) gilt **ausschließlich** für Netz-/Timeout-Fehler vor Erhalt einer Antwort — nie nach einer Server-Antwort, um verdeckte Doppelübermittlung auszuschließen. Antwort wird als Text gelesen und geparst: Parse-Fehler → `FonProtocolError`; SOAP-Fault (unabhängig vom HTTP-Status) → `FonSoapFaultError`; HTTP-Status außerhalb 2xx ohne Fault → `FonProtocolError`; sonst Wurzelknoten zurück.

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/transport.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callSoap } from './transport';
import { childText } from './soap/parse';
import { FonTransportError, FonSoapFaultError, FonProtocolError } from './errors';

function okResponse(): typeof fetch {
  return (async (_url, init) => {
    // Header und Body prüfen wir im dedizierten Test unten
    void init;
    return new Response(
      '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body>' +
        '<loginResponse><id>S1</id><rc>0</rc></loginResponse>' +
        '</soapenv:Body></soapenv:Envelope>',
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

test('setzt SOAPAction und Content-Type korrekt', async () => {
  let seenAction: string | null = null;
  let seenType: string | null = null;
  const fetchImpl = (async (_url, init) => {
    const h = new Headers(init?.headers);
    seenAction = h.get('SOAPAction');
    seenType = h.get('Content-Type');
    return new Response(
      '<Envelope><Body><loginResponse><rc>0</rc></loginResponse></Body></Envelope>',
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  await callSoap(
    { endpoint: 'https://example.test', soapAction: 'login', body: '<x/>' },
    { fetchImpl },
  );
  assert.equal(seenAction, '"login"');
  assert.equal(seenType, 'text/xml; charset=utf-8');
});

test('gibt bei rc=0 den geparsten Wurzelknoten zurück', async () => {
  const root = await callSoap(
    { endpoint: 'https://example.test', soapAction: 'login', body: '<x/>' },
    { fetchImpl: okResponse() },
  );
  assert.equal(root.name, 'Envelope');
});

test('wirft FonSoapFaultError bei SOAP-Fault trotz HTTP 500', async () => {
  const fetchImpl = (async () =>
    new Response(
      '<Envelope><Body><Fault><faultcode>Server</faultcode>' +
        '<faultstring>kaputt</faultstring></Fault></Body></Envelope>',
      { status: 500 },
    )) as unknown as typeof fetch;
  await assert.rejects(
    () => callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl }),
    (err: unknown) => err instanceof FonSoapFaultError && err.faultcode === 'Server',
  );
});

test('wirft FonProtocolError bei unparsebarer Antwort', async () => {
  const fetchImpl = (async () => new Response('kein xml', { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(
    () => callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl }),
    FonProtocolError,
  );
});

test('wirft FonProtocolError bei HTTP 404 ohne Fault', async () => {
  const fetchImpl = (async () => new Response('<html>404</html>', { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(
    () => callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl }),
    FonProtocolError,
  );
});

test('wirft FonTransportError bei Netzfehler und respektiert retries', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    throw new Error('ECONNRESET');
  }) as unknown as typeof fetch;
  await assert.rejects(
    () =>
      callSoap(
        { endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' },
        { fetchImpl, retries: 2 },
      ),
    FonTransportError,
  );
  assert.equal(calls, 3); // 1 Versuch + 2 Wiederholungen
});

test('erfolgreiche Antwort wird nach rc-freiem Parsen weitergereicht', async () => {
  const root = await callSoap(
    { endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' },
    { fetchImpl: okResponse() },
  );
  const resp = root.children[0]?.children[0];
  assert.equal(childText(resp!, 'id'), 'S1');
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './transport'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/finanzonline-core/src/transport.ts`:
```ts
import { parseXml, type XmlNode } from './soap/parse';
import { detectFault } from './soap/fault';
import { FonTransportError, FonSoapFaultError, FonProtocolError } from './errors';

export interface TransportOptions {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

export interface SoapCallSpec {
  endpoint: string;
  soapAction: string;
  body: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function callSoap(
  spec: SoapCallSpec,
  opts: TransportOptions = {},
): Promise<XmlNode> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 0;
  const doFetch = opts.fetchImpl ?? fetch;

  let status = 0;
  let responseText = '';
  let attempt = 0;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(spec.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${spec.soapAction}"`,
        },
        body: spec.body,
        signal: controller.signal,
      });
      status = res.status;
      responseText = await res.text();
      clearTimeout(timer);
      break;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < retries) {
        attempt++;
        continue;
      }
      const reason = controller.signal.aborted
        ? `Zeitüberschreitung nach ${timeoutMs} ms`
        : (err as Error).message;
      throw new FonTransportError(`Übertragung fehlgeschlagen: ${reason}`, { cause: err });
    }
  }

  let root: XmlNode;
  try {
    root = parseXml(responseText);
  } catch (err) {
    throw new FonProtocolError(
      `Antwort ist kein gültiges XML (HTTP ${status}): ${(err as Error).message}`,
    );
  }

  const fault = detectFault(root);
  if (fault) {
    throw new FonSoapFaultError(fault.faultstring || 'SOAP-Fault', fault.faultcode, fault.detail);
  }
  if (status < 200 || status >= 300) {
    throw new FonProtocolError(`Unerwarteter HTTP-Status ${status} ohne SOAP-Fault`);
  }
  return root;
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/finanzonline-core/src/transport.ts packages/finanzonline-core/src/transport.test.ts
git commit -m "feat(finanzonline-core): HTTP-SOAP-Transport mit Timeout und sicherer Wiederholungsstrategie"
```

---

### Task 8: Endpoints + Session (`endpoints.ts`, `session.ts`, `index.ts`)

**Files:**
- Create: `packages/finanzonline-core/src/endpoints.ts`
- Create: `packages/finanzonline-core/src/session.ts`
- Create: `packages/finanzonline-core/src/index.ts`
- Test: `packages/finanzonline-core/src/session.test.ts`

**Interfaces:**
- Consumes: `SESSION_ENDPOINT`, `SESSION_NAMESPACE` aus `./endpoints`; `buildEnvelope` aus `./soap/envelope`; `callSoap`, `TransportOptions` aus `./transport`; `findDescendant`, `childText`, `XmlNode` aus `./soap/parse`; `FonError`, `FonProtocolError`, `sessionErrorFor` aus `./errors`.
- Produces:
  - `endpoints.ts`: `SESSION_ENDPOINT`, `SESSION_NAMESPACE`, `RKDB_ENDPOINT`, `RKDB_NAMESPACE` (Konstanten)
  - `session.ts`:
    - `interface SessionConfig { tid: string; benid: string; pin: string; herstellerid: string; transport?: TransportOptions }`
    - `interface Session { readonly id: string; logout(): Promise<void> }`
    - `function createSession(config: SessionConfig): Promise<Session>`
  - `index.ts`: re-exportiert `createSession`, `SessionConfig`, `Session`, alle Fehlerklassen, `SESSION_RC_MESSAGES`, die Endpoint-Konstanten sowie `buildEnvelope`, `callSoap`, `parseXml` für fortgeschrittene Nutzung.

- [ ] **Step 1: Failing test schreiben**

`packages/finanzonline-core/src/session.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from './session';
import { FonError, FonSessionError, FonSessionExpiredError } from './errors';

const VALID = {
  tid: 'ABCD1234',
  benid: 'benutzer1',
  pin: 'geheim123',
  herstellerid: 'ATU12345678',
};

function respond(xml: string, capture?: (body: string, action: string) => void): typeof fetch {
  return (async (_url, init) => {
    const h = new Headers(init?.headers);
    capture?.(String(init?.body ?? ''), h.get('SOAPAction') ?? '');
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
}

const loginOk = (id: string) =>
  `<Envelope><Body><loginResponse><id>${id}</id><rc>0</rc></loginResponse></Body></Envelope>`;

test('createSession sendet loginRequest in bindender Feldreihenfolge', async () => {
  let body = '';
  let action = '';
  const session = await createSession({
    ...VALID,
    transport: { fetchImpl: respond(loginOk('SESSION0001'), (b, a) => {
      body = b;
      action = a;
    }) },
  });
  assert.equal(session.id, 'SESSION0001');
  assert.equal(action, '"login"');
  assert.match(body, /<loginRequest xmlns="https:\/\/finanzonline\.bmf\.gv\.at\/fon\/ws\/session">/);
  assert.ok(body.indexOf('<tid>') < body.indexOf('<benid>'));
  assert.ok(body.indexOf('<benid>') < body.indexOf('<pin>'));
  assert.ok(body.indexOf('<pin>') < body.indexOf('<herstellerid>'));
});

test('rc=-1 wirft FonSessionExpiredError', async () => {
  await assert.rejects(
    () =>
      createSession({
        ...VALID,
        transport: {
          fetchImpl: respond('<Envelope><Body><loginResponse><rc>-1</rc></loginResponse></Body></Envelope>'),
        },
      }),
    FonSessionExpiredError,
  );
});

test('rc=-4 wirft FonSessionError (nicht Expired)', async () => {
  await assert.rejects(
    () =>
      createSession({
        ...VALID,
        transport: {
          fetchImpl: respond('<Envelope><Body><loginResponse><rc>-4</rc><msg>ungültig</msg></loginResponse></Body></Envelope>'),
        },
      }),
    (err: unknown) =>
      err instanceof FonSessionError && !(err instanceof FonSessionExpiredError) && err.rc === -4,
  );
});

test('ungültige tid wird lokal abgewiesen, ohne fetch aufzurufen', async () => {
  let called = false;
  await assert.rejects(
    () =>
      createSession({
        ...VALID,
        tid: 'zu-kurz',
        transport: {
          fetchImpl: (async () => {
            called = true;
            return new Response('', { status: 200 });
          }) as unknown as typeof fetch,
        },
      }),
    FonError,
  );
  assert.equal(called, false);
});

test('logout sendet logoutRequest mit tid, benid, id', async () => {
  let logoutBody = '';
  let logoutAction = '';
  let call = 0;
  const fetchImpl = (async (_url, init) => {
    call++;
    const h = new Headers(init?.headers);
    if (call === 1) return new Response(loginOk('SESSION0001'), { status: 200 });
    logoutBody = String(init?.body ?? '');
    logoutAction = h.get('SOAPAction') ?? '';
    return new Response('<Envelope><Body><logoutResponse><rc>0</rc></logoutResponse></Body></Envelope>', {
      status: 200,
    });
  }) as unknown as typeof fetch;

  const session = await createSession({ ...VALID, transport: { fetchImpl } });
  await session.logout();
  assert.equal(logoutAction, '"logout"');
  assert.match(logoutBody, /<logoutRequest /);
  assert.match(logoutBody, /<id>SESSION0001<\/id>/);
  assert.ok(logoutBody.indexOf('<tid>') < logoutBody.indexOf('<benid>'));
  assert.ok(logoutBody.indexOf('<benid>') < logoutBody.indexOf('<id>'));
});
```

- [ ] **Step 2: Test zum Fehlschlagen laufen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Endpoints-Konstanten schreiben**

`packages/finanzonline-core/src/endpoints.ts`:
```ts
export const SESSION_ENDPOINT = 'https://finanzonline.bmf.gv.at/fonws/ws/session';
export const SESSION_NAMESPACE = 'https://finanzonline.bmf.gv.at/fon/ws/session';
export const RKDB_ENDPOINT = 'https://finanzonline.bmf.gv.at/fonws/ws/rkdb';
export const RKDB_NAMESPACE = 'https://finanzonline.bmf.gv.at/rkdb';
```

- [ ] **Step 4: Session-Implementierung schreiben**

`packages/finanzonline-core/src/session.ts`:
```ts
import { SESSION_ENDPOINT, SESSION_NAMESPACE } from './endpoints';
import { buildEnvelope } from './soap/envelope';
import { callSoap, type TransportOptions } from './transport';
import { type XmlNode, findDescendant, childText } from './soap/parse';
import { FonError, FonProtocolError, sessionErrorFor } from './errors';

export interface SessionConfig {
  tid: string;
  benid: string;
  pin: string;
  herstellerid: string;
  transport?: TransportOptions;
}

export interface Session {
  readonly id: string;
  logout(): Promise<void>;
}

const TID = /^[0-9A-Za-z]{8,12}$/;
const HERSTELLER = /^[0-9A-Za-z]{10,24}$/;
const BENID_LOGOUT = /^[0-9A-Za-z]{5,12}$/;
const SESSION_ID = /^[0-9A-Za-z]{10,24}$/;

function requireMatch(value: string, re: RegExp, field: string): void {
  if (!re.test(value)) {
    throw new FonError(`Ungültiges Feld ${field}: entspricht nicht ${re.source}`);
  }
}

function requireLength(value: string, min: number, max: number, field: string): void {
  if (value.length < min || value.length > max) {
    throw new FonError(`Ungültiges Feld ${field}: Länge muss zwischen ${min} und ${max} liegen`);
  }
}

function readRc(root: XmlNode, responseElement: string): { rc: number; msg?: string } {
  const resp = findDescendant(root, responseElement);
  if (!resp) throw new FonProtocolError(`Antwort enthält kein ${responseElement}`);
  const rcText = childText(resp, 'rc');
  if (rcText === undefined) throw new FonProtocolError(`Antwort ${responseElement} ohne rc`);
  const rc = Number.parseInt(rcText, 10);
  if (Number.isNaN(rc)) throw new FonProtocolError(`rc ist keine Zahl: "${rcText}"`);
  return { rc, msg: childText(resp, 'msg') };
}

export async function createSession(config: SessionConfig): Promise<Session> {
  requireMatch(config.tid, TID, 'tid');
  requireLength(config.benid, 5, 12, 'benid');
  requireLength(config.pin, 5, 128, 'pin');
  requireMatch(config.herstellerid, HERSTELLER, 'herstellerid');

  const loginBody = buildEnvelope({
    namespace: SESSION_NAMESPACE,
    bodyElement: 'loginRequest',
    fields: [
      { name: 'tid', value: config.tid },
      { name: 'benid', value: config.benid },
      { name: 'pin', value: config.pin },
      { name: 'herstellerid', value: config.herstellerid },
    ],
  });

  const root = await callSoap(
    { endpoint: SESSION_ENDPOINT, soapAction: 'login', body: loginBody },
    config.transport,
  );

  const { rc, msg } = readRc(root, 'loginResponse');
  if (rc !== 0) throw sessionErrorFor(rc, msg);

  const resp = findDescendant(root, 'loginResponse');
  const id = resp ? childText(resp, 'id') : undefined;
  if (!id) throw new FonProtocolError('loginResponse ohne id trotz rc=0');
  const sessionId = id;

  let loggedOut = false;
  return {
    id: sessionId,
    async logout(): Promise<void> {
      if (loggedOut) return;
      requireMatch(config.tid, TID, 'tid');
      requireMatch(config.benid, BENID_LOGOUT, 'benid');
      requireMatch(sessionId, SESSION_ID, 'id');

      const logoutBody = buildEnvelope({
        namespace: SESSION_NAMESPACE,
        bodyElement: 'logoutRequest',
        fields: [
          { name: 'tid', value: config.tid },
          { name: 'benid', value: config.benid },
          { name: 'id', value: sessionId },
        ],
      });

      const res = await callSoap(
        { endpoint: SESSION_ENDPOINT, soapAction: 'logout', body: logoutBody },
        config.transport,
      );
      const out = readRc(res, 'logoutResponse');
      loggedOut = true;
      if (out.rc !== 0) throw sessionErrorFor(out.rc, out.msg);
    },
  };
}
```

- [ ] **Step 5: Öffentliches Barrel `index.ts` schreiben**

`packages/finanzonline-core/src/index.ts`:
```ts
export { createSession, type Session, type SessionConfig } from './session';
export {
  SESSION_ENDPOINT,
  SESSION_NAMESPACE,
  RKDB_ENDPOINT,
  RKDB_NAMESPACE,
} from './endpoints';
export {
  FonError,
  FonTransportError,
  FonProtocolError,
  FonSoapFaultError,
  FonSessionError,
  FonSessionExpiredError,
  SESSION_RC_MESSAGES,
} from './errors';
export { buildEnvelope, type EnvelopeField, type EnvelopeSpec } from './soap/envelope';
export { callSoap, type TransportOptions, type SoapCallSpec } from './transport';
export { parseXml, type XmlNode } from './soap/parse';
export { detectFault, type SoapFault } from './soap/fault';
```

- [ ] **Step 6: Test bestehen lassen**

Run: `npm test -w @kreiseck/finanzonline-core`
Expected: PASS (alle Suites grün).

- [ ] **Step 7: Produktions-Build prüfen**

Run: `npm run build -w @kreiseck/finanzonline-core`
Expected: erzeugt `dist/` mit `index.js`, `index.d.ts` und Sourcemaps, keine Testdateien in `dist`, keine tsc-Fehler.

- [ ] **Step 8: Commit**

```bash
git add packages/finanzonline-core/src/endpoints.ts packages/finanzonline-core/src/session.ts packages/finanzonline-core/src/index.ts packages/finanzonline-core/src/session.test.ts
git commit -m "feat(finanzonline-core): zustandslose login/logout-Session mit Eingabevalidierung und rc-Behandlung"
```

---

## Nächste Ausbaustufe (nicht Teil dieses Plans)

- `@kreiseck/rksv` (rkdb-Paket, Vorgangsarten, synchron/asynchron, Belegprüfung) — eigener Plan; baut auf `callSoap`, `buildEnvelope`, `parseXml`.
- Offline-Belegcode `@kreiseck/rksv/code` — eigener Plan, netzfrei.
- `REGISTRIERUNG.md` für `finanzonline-core`.
- Optionaler Integrationstest gegen `art_uebermittlung='T'` (opt-in per Env), nicht Teil des Standardlaufs.
