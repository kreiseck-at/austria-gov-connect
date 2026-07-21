# Plan B — `@kreiseck/rksv/code` (Offline-Belegcode) Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Subpath-Export `@kreiseck/rksv/code` bauen: netzfreies Dekodieren und Prüfen des RKSV-Belegcodes (13 Segmente, OCR-Variante, ES256-Signaturprüfung, SHA-256-Verkettung), abhängig ausschließlich von `node:crypto`.

**Architecture:** Vier kleine, reine Module unter `packages/rksv/src/code/`: `base32` (RFC-4648, für die OCR-Variante), `decode` (Zerlegung + Normalisierung + Besonderheiten), `pruefe` (Struktur/Format + ES256 mit `node:crypto`), `verkettung` (SHA-256-Kette). Kein Import aus dem Core, kein HTTP. Deterministisch testbar; Krypto-Tests erzeugen ihren eigenen P-256-Schlüssel und Belegcode.

**Tech Stack:** TypeScript strict (CommonJS), `node:test`, **nur `node:crypto`** als Laufzeitbezug.

## Global Constraints

- **Verifizierte Quelle:** `docs/design.md` §2.6 (gegen BMF-Mustercode `ManualJWSModule`/`CashBoxUtils` und Detailspezifikation V1.2 §2.4/§2.5 gepinnt). Werte daraus wörtlich, nicht geraten.
- **Isolation ist bindend:** `code/` importiert **nichts** aus `@kreiseck/finanzonline-core`, kein HTTP, kein SOAP — nur `node:crypto` und `node:*`. Ein Test erzwingt das.
- **13 Segmente**, Pattern `(_[^_]+){13}` (führendes `_`, 13 durch `_` getrennte nichtleere Segmente).
- **ES256-Prüfung** (verifiziert): Signing-Input = `eyJhbGciOiJFUzI1NiJ9` + `.` + `BASE64URL(payload)`, `payload` = kanonischer Code **ohne** letztes Segment (Segmente 1–12, Base64-Form), joined mit `_`, führendes `_`. Signatur (Segment 13, Standard-Base64) → 64 Byte `r‖s`; `crypto.verify('sha256', input, { key, dsaEncoding: 'ieee-p1363' }, sig)`.
- **Verkettung** (verifiziert): Hash-Eingang = kompakte JWS des Vorbelegs (`header.BASE64URL(payload).BASE64URL(sig)`); SHA-256, Bytes 0–7, Base64. Startbeleg: Eingang = UTF-8-`Kassen-ID`.
- **Marker:** Segment 10 = `TRA`/`STO` (Training/Storno) statt Umsatzzähler; Segment 13 dekodiert zu `Sicherheitseinrichtung ausgefallen` (SEE-Ausfall).
- **OCR-Variante:** Segmente 10, 12, 13 in Base32 statt Base64; `decode` normalisiert nach Base64.
- **Ergebnisform** spiegelt den amtlichen Webservice: je Einzelprüfung `{ name, status: 'PASS'|'FAIL'|'NOT_EXECUTED', detail? }`. Ohne Schlüssel: Signatur `NOT_EXECUTED`, kein Fehler.
- No Dritt-Deps; `strict` + `noUncheckedIndexedAccess`; Node ≥ 18.18; Apache-2.0.
- No footprint: keine KI-/Assistenten-Marker in Code, Kommentaren, Commits, Dateinamen. Commits ohne Co-Author-/Tool-Trailer.

**Voraussetzung:** `@kreiseck/finanzonline-core` gebaut (`dist/`). `code/` nutzt es zwar nicht, aber der Paket-Testlauf kompiliert das ganze `src`. Falls nötig: `npm run build -w @kreiseck/finanzonline-core` einmal.

---

### Task 1: Base32 (`code/base32.ts`)

**Files:**
- Create: `packages/rksv/src/code/base32.ts`
- Test: `packages/rksv/src/code/base32.test.ts`

**Interfaces:**
- Produces: `base32Decode(s: string): Buffer` und `base32Encode(buf: Buffer): string` (RFC 4648, Alphabet `A–Z2–7`, `=`-Padding). `base32Decode` wirft `Error` bei ungültigem Zeichen.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/code/base32.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode } from './base32';

test('Round-Trip beliebiger Bytes', () => {
  for (const hex of ['', '00', '61', '48656c6c6f', 'deadbeef0102030405']) {
    const buf = Buffer.from(hex, 'hex');
    assert.equal(base32Encode(buf), base32Encode(buf));
    assert.deepEqual(base32Decode(base32Encode(buf)), buf);
  }
});

test('bekannter Vektor RFC 4648: "foobar"', () => {
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI======');
  assert.deepEqual(base32Decode('MZXW6YTBOI======'), Buffer.from('foobar'));
});

test('ignoriert Padding und ist case-insensitiv beim Decodieren', () => {
  assert.deepEqual(base32Decode('mzxw6ytboi======'), Buffer.from('foobar'));
});

test('wirft bei ungültigem Zeichen', () => {
  assert.throws(() => base32Decode('0189'), /Base32/);
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './base32'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/code/base32.ts`:
```ts
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Ungültiges Base32-Zeichen: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function base32Encode(buf: Buffer): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/code/base32.ts packages/rksv/src/code/base32.test.ts
git commit -m "feat(rksv/code): Base32 (RFC 4648) fuer die OCR-Variante des Belegcodes"
```

---

### Task 2: Dekodierung (`code/decode.ts`)

**Files:**
- Create: `packages/rksv/src/code/decode.ts`
- Test: `packages/rksv/src/code/decode.test.ts`

**Interfaces:**
- Consumes: `base32Decode` aus `./base32`.
- Produces:
  - `class RksvCodeError extends Error`
  - `interface Betraege { normal; ermaessigt1; ermaessigt2; null: string; besonders }`
  - `type Besonderheit = 'see-ausfall' | 'trainingsbuchung' | 'stornobuchung'`
  - `interface Beleg { raw; ocr: boolean; rka: { kennzeichen; suite; zda }; kassenId; belegnummer; zeitpunkt; betraege; umsatzzaehler; zertifikatsseriennummer; sigVoriger; signatur; besonderheit?; segmente: string[] }`
  - `function decodeBelegCode(code: string): Beleg`
  - `function toStandardBase64(s: string): string` (URL→Standard, Padding ergänzen) — exportiert, von `pruefe`/`verkettung` genutzt.

  Segmentindex→Feld: 1 rka, 2 kassenId, 3 belegnummer, 4 zeitpunkt, 5–9 Beträge, 10 umsatzzaehler, 11 zertifikatsseriennummer, 12 sigVoriger, 13 signatur. `segmente` enthält die 13 Segmente in **kanonischer (Base64-)Form** (bei OCR normalisiert). OCR-Erkennung: Segment 13 besteht ausschließlich aus dem Base32-Alphabet (`^[A-Z2-7]+=*$`) — eine echte ES256-Signatur in Base64 enthält praktisch immer Kleinbuchstaben/`+`/`/`/`0`/`1`/`8`/`9`. Besonderheiten: `umsatzzaehler === 'TRA'` → trainingsbuchung, `'STO'` → stornobuchung; Signatur dekodiert zu `Sicherheitseinrichtung ausgefallen` → see-ausfall.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/code/decode.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBelegCode, RksvCodeError, toStandardBase64 } from './decode';
import { base32Encode } from './base32';

const SIG_B64 = Buffer.alloc(64, 7).toString('base64'); // 64 Byte, enthält Kleinbuchstaben/+//
const VOR_B64 = Buffer.alloc(8, 1).toString('base64');
const UMS_B64 = Buffer.alloc(8, 2).toString('base64');

function code(over: Partial<Record<number, string>> = {}): string {
  const seg = [
    'R1-AT1', 'KASSE-001', '243', '2026-07-20T14:23:34',
    '10,00', '0,00', '0,00', '0,00', '0,00',
    UMS_B64, '1a2b3c', VOR_B64, SIG_B64,
  ];
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string; // 1-basierte Segmentnummer
  return '_' + seg.join('_');
}

test('zerlegt die 13 Segmente korrekt', () => {
  const b = decodeBelegCode(code());
  assert.equal(b.ocr, false);
  assert.equal(b.rka.kennzeichen, 'R1-AT1');
  assert.equal(b.rka.suite, 'R1');
  assert.equal(b.rka.zda, 'AT1');
  assert.equal(b.kassenId, 'KASSE-001');
  assert.equal(b.belegnummer, '243');
  assert.equal(b.zeitpunkt, '2026-07-20T14:23:34');
  assert.equal(b.betraege.normal, '10,00');
  assert.equal(b.zertifikatsseriennummer, '1a2b3c');
  assert.equal(b.signatur, SIG_B64);
  assert.equal(b.besonderheit, undefined);
  assert.equal(b.segmente.length, 13);
});

test('falsche Segmentanzahl wirft RksvCodeError', () => {
  assert.throws(() => decodeBelegCode('_a_b_c'), RksvCodeError);
  assert.throws(() => decodeBelegCode('kein-code'), RksvCodeError);
});

test('leeres Segment wirft RksvCodeError', () => {
  assert.throws(() => decodeBelegCode(code({ 3: '' })), RksvCodeError);
});

test('Trainingsbuchung: Segment 10 = TRA', () => {
  assert.equal(decodeBelegCode(code({ 10: 'TRA' })).besonderheit, 'trainingsbuchung');
});

test('Stornobuchung: Segment 10 = STO', () => {
  assert.equal(decodeBelegCode(code({ 10: 'STO' })).besonderheit, 'stornobuchung');
});

test('SEE-Ausfall: Segment 13 dekodiert zur Ausfall-Zeichenkette', () => {
  const marker = Buffer.from('Sicherheitseinrichtung ausgefallen').toString('base64');
  assert.equal(decodeBelegCode(code({ 13: marker })).besonderheit, 'see-ausfall');
});

test('OCR-Variante: Base32 in 10/12/13 wird nach Base64 normalisiert', () => {
  const ocr = code({
    10: base32Encode(Buffer.alloc(8, 2)),
    12: base32Encode(Buffer.alloc(8, 1)),
    13: base32Encode(Buffer.alloc(64, 7)),
  });
  const b = decodeBelegCode(ocr);
  assert.equal(b.ocr, true);
  assert.equal(b.umsatzzaehler, UMS_B64);
  assert.equal(b.sigVoriger, VOR_B64);
  assert.equal(b.signatur, SIG_B64);
});

test('toStandardBase64 wandelt URL-Alphabet und ergänzt Padding', () => {
  assert.equal(toStandardBase64('a-b_c'), 'a+b/c=');
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './decode'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/code/decode.ts`:
```ts
import { base32Decode } from './base32';

export class RksvCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RksvCodeError';
  }
}

export interface Betraege {
  normal: string;
  ermaessigt1: string;
  ermaessigt2: string;
  null: string;
  besonders: string;
}

export type Besonderheit = 'see-ausfall' | 'trainingsbuchung' | 'stornobuchung';

export interface Beleg {
  raw: string;
  ocr: boolean;
  rka: { kennzeichen: string; suite: string; zda: string };
  kassenId: string;
  belegnummer: string;
  zeitpunkt: string;
  betraege: Betraege;
  umsatzzaehler: string;
  zertifikatsseriennummer: string;
  sigVoriger: string;
  signatur: string;
  besonderheit?: Besonderheit;
  segmente: string[];
}

const AUSFALL_TEXT = 'Sicherheitseinrichtung ausgefallen';
const BASE32_ONLY = /^[A-Z2-7]+=*$/;

export function toStandardBase64(s: string): string {
  let out = s.replace(/-/g, '+').replace(/_/g, '/');
  while (out.length % 4 !== 0) out += '=';
  return out;
}

function base32ToBase64(s: string): string {
  return base32Decode(s).toString('base64');
}

export function decodeBelegCode(code: string): Beleg {
  const raw = code.trim();
  if (raw[0] !== '_') throw new RksvCodeError('Belegcode muss mit "_" beginnen');
  const parts = raw.split('_');
  // führendes '_' erzeugt ein leeres erstes Element; danach 13 Segmente
  const seg = parts.slice(1);
  if (seg.length !== 13 || seg.some((s) => s.length === 0)) {
    throw new RksvCodeError(`Belegcode muss genau 13 nichtleere Segmente haben (waren ${seg.length})`);
  }

  const ocr = BASE32_ONLY.test(seg[12]!);
  const s10raw = seg[9]!;
  const istMarker = s10raw === 'TRA' || s10raw === 'STO';

  const umsatzzaehler = istMarker ? s10raw : ocr ? base32ToBase64(s10raw) : s10raw;
  const sigVoriger = ocr ? base32ToBase64(seg[11]!) : seg[11]!;
  const signatur = ocr ? base32ToBase64(seg[12]!) : seg[12]!;

  const kennzeichen = seg[0]!;
  const dash = kennzeichen.indexOf('-');
  const suite = dash === -1 ? kennzeichen : kennzeichen.slice(0, dash);
  const zda = dash === -1 ? '' : kennzeichen.slice(dash + 1);

  let besonderheit: Besonderheit | undefined;
  if (s10raw === 'TRA') besonderheit = 'trainingsbuchung';
  else if (s10raw === 'STO') besonderheit = 'stornobuchung';
  else if (Buffer.from(toStandardBase64(signatur), 'base64').toString('utf8') === AUSFALL_TEXT) {
    besonderheit = 'see-ausfall';
  }

  const kanonisch = [...seg];
  kanonisch[9] = umsatzzaehler;
  kanonisch[11] = sigVoriger;
  kanonisch[12] = signatur;

  return {
    raw,
    ocr,
    rka: { kennzeichen, suite, zda },
    kassenId: seg[1]!,
    belegnummer: seg[2]!,
    zeitpunkt: seg[3]!,
    betraege: {
      normal: seg[4]!,
      ermaessigt1: seg[5]!,
      ermaessigt2: seg[6]!,
      null: seg[7]!,
      besonders: seg[8]!,
    },
    umsatzzaehler,
    zertifikatsseriennummer: seg[10]!,
    sigVoriger,
    signatur,
    besonderheit,
    segmente: kanonisch,
  };
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/code/decode.ts packages/rksv/src/code/decode.test.ts
git commit -m "feat(rksv/code): Belegcode dekodieren -- 13 Segmente, OCR-Normalisierung, Besonderheiten"
```

---

### Task 3: Prüfung inkl. ES256 (`code/pruefe.ts`)

**Files:**
- Create: `packages/rksv/src/code/pruefe.ts`
- Test: `packages/rksv/src/code/pruefe.test.ts`

**Interfaces:**
- Consumes: `node:crypto`; `Beleg`, `toStandardBase64` aus `./decode`.
- Produces:
  - `interface Pruefung { name: string; status: 'PASS'|'FAIL'|'NOT_EXECUTED'; detail?: string }`
  - `interface Pruefergebnis { pruefungen: Pruefung[] }`
  - `interface PruefOptionen { zertifikat?: string | Buffer; schluessel?: import('node:crypto').KeyObject | string | Buffer }`
  - `function belegSigningInput(beleg: Beleg): string` — `header + '.' + base64url(payload)`, payload = `'_' + segmente[0..11].join('_')`.
  - `function pruefeBelegCode(beleg: Beleg, opts?: PruefOptionen): Pruefergebnis`

  Prüfungen (Reihenfolge): `Algorithmuskennzeichen` (`^R[0-9]+-[A-Z0-9]+$`), `Datum` (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$`), `Betragsformate` (jeder der 5 Beträge `^-?\d+,\d{2}$`), `Signaturlaenge` (Segment 13 dekodiert zu 64 Byte — außer bei see-ausfall: NOT_EXECUTED), `Signatur` (ES256). `Signatur` = NOT_EXECUTED bei see-ausfall (detail „Signatureinheit ausgefallen") oder wenn weder `zertifikat` noch `schluessel` übergeben; sonst PASS/FAIL.

- [ ] **Step 1: Failing test schreiben** (erzeugt eigenen P-256-Schlüssel und signiert)

`packages/rksv/src/code/pruefe.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { decodeBelegCode } from './decode';
import { pruefeBelegCode, belegSigningInput } from './pruefe';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

// Baut einen gültig signierten Belegcode: Segmente 1..12, dann Signatur über den Signing-Input.
function signedCode(over: Partial<Record<number, string>> = {}): string {
  const seg = [
    'R1-AT1', 'KASSE-001', '243', '2026-07-20T14:23:34',
    '10,00', '0,00', '0,00', '0,00', '0,00',
    Buffer.alloc(8, 2).toString('base64'), '1a2b3c', Buffer.alloc(8, 1).toString('base64'),
  ];
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string; // 1-basiert
  const payload = '_' + seg.join('_');
  const header = 'eyJhbGciOiJFUzI1NiJ9';
  const signingInput = header + '.' + Buffer.from(payload, 'utf8').toString('base64url');
  const sig = sign('sha256', Buffer.from(signingInput, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return payload + '_' + sig.toString('base64');
}

test('belegSigningInput rekonstruiert header.base64url(payload)', () => {
  const beleg = decodeBelegCode(signedCode());
  const input = belegSigningInput(beleg);
  assert.match(input, /^eyJhbGciOiJFUzI1NiJ9\./);
  const payload = Buffer.from(input.split('.')[1]!, 'base64url').toString('utf8');
  assert.match(payload, /^_R1-AT1_KASSE-001_243_/);
});

test('gültige Signatur -> PASS mit öffentlichem Schlüssel', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  const sig = res.pruefungen.find((p) => p.name === 'Signatur');
  assert.equal(sig?.status, 'PASS');
});

test('manipulierter Betrag -> Signatur FAIL', () => {
  const beleg = decodeBelegCode(signedCode());
  beleg.segmente[4] = '99,99'; // Betrag Normal nachträglich ändern
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'FAIL');
});

test('ohne Schlüssel -> Signatur NOT_EXECUTED', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'NOT_EXECUTED');
});

test('Struktur-/Formatprüfungen laufen ohne Schlüssel', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Algorithmuskennzeichen')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Betragsformate')?.status, 'PASS');
});

test('ungültiges Datumsformat -> Datum FAIL', () => {
  const beleg = decodeBelegCode(signedCode({ 4: '20.07.2026' }));
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'FAIL');
});

test('see-ausfall -> Signatur NOT_EXECUTED trotz Schlüssel', () => {
  // Bei SEE-Ausfall steht statt der Signatur der Ausfall-Marker; nicht signieren.
  const marker = Buffer.from('Sicherheitseinrichtung ausgefallen').toString('base64');
  const seg = [
    'R1-AT1', 'KASSE-001', '243', '2026-07-20T14:23:34', '10,00', '0,00', '0,00', '0,00', '0,00',
    Buffer.alloc(8, 2).toString('base64'), '1a2b3c', Buffer.alloc(8, 1).toString('base64'), marker,
  ];
  const beleg = decodeBelegCode('_' + seg.join('_'));
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  const sig = res.pruefungen.find((p) => p.name === 'Signatur');
  assert.equal(sig?.status, 'NOT_EXECUTED');
  assert.match(sig?.detail ?? '', /ausgefallen/i);
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './pruefe'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/code/pruefe.ts`:
```ts
import { createPublicKey, verify, X509Certificate, type KeyObject } from 'node:crypto';
import { type Beleg, toStandardBase64 } from './decode';

export interface Pruefung {
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  detail?: string;
}

export interface Pruefergebnis {
  pruefungen: Pruefung[];
}

export interface PruefOptionen {
  zertifikat?: string | Buffer;
  schluessel?: KeyObject | string | Buffer;
}

const HEADER = 'eyJhbGciOiJFUzI1NiJ9';
const RKA = /^R[0-9]+-[A-Z0-9]+$/;
const DATUM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const BETRAG = /^-?\d+,\d{2}$/;

export function belegSigningInput(beleg: Beleg): string {
  const payload = '_' + beleg.segmente.slice(0, 12).join('_');
  return HEADER + '.' + Buffer.from(payload, 'utf8').toString('base64url');
}

function pruefe(name: string, ok: boolean, detail?: string): Pruefung {
  return { name, status: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) };
}

function verifyKey(opts: PruefOptionen | undefined): KeyObject | undefined {
  if (!opts) return undefined;
  if (opts.schluessel !== undefined) {
    return typeof opts.schluessel === 'object' && 'asymmetricKeyType' in opts.schluessel
      ? (opts.schluessel as KeyObject)
      : createPublicKey(opts.schluessel as string | Buffer);
  }
  if (opts.zertifikat !== undefined) {
    return new X509Certificate(opts.zertifikat).publicKey;
  }
  return undefined;
}

export function pruefeBelegCode(beleg: Beleg, opts?: PruefOptionen): Pruefergebnis {
  const pruefungen: Pruefung[] = [];

  pruefungen.push(pruefe('Algorithmuskennzeichen', RKA.test(beleg.rka.kennzeichen)));
  pruefungen.push(pruefe('Datum', DATUM.test(beleg.zeitpunkt)));
  const b = beleg.betraege;
  const betraegeOk = [b.normal, b.ermaessigt1, b.ermaessigt2, b.null, b.besonders].every((x) => BETRAG.test(x));
  pruefungen.push(pruefe('Betragsformate', betraegeOk));

  if (beleg.besonderheit === 'see-ausfall') {
    pruefungen.push({ name: 'Signaturlaenge', status: 'NOT_EXECUTED', detail: 'Signatureinheit ausgefallen' });
    pruefungen.push({ name: 'Signatur', status: 'NOT_EXECUTED', detail: 'Signatureinheit ausgefallen' });
    return { pruefungen };
  }

  let sigBytes: Buffer | undefined;
  try {
    sigBytes = Buffer.from(toStandardBase64(beleg.signatur), 'base64');
  } catch {
    sigBytes = undefined;
  }
  pruefungen.push(pruefe('Signaturlaenge', sigBytes?.length === 64, sigBytes ? `${sigBytes.length} Byte` : 'nicht dekodierbar'));

  const key = verifyKey(opts);
  if (!key) {
    pruefungen.push({ name: 'Signatur', status: 'NOT_EXECUTED', detail: 'Kein Schlüssel/Zertifikat übergeben' });
    return { pruefungen };
  }
  if (!sigBytes || sigBytes.length !== 64) {
    pruefungen.push({ name: 'Signatur', status: 'FAIL', detail: 'Signaturbytes ungültig' });
    return { pruefungen };
  }

  let ok = false;
  try {
    ok = verify('sha256', Buffer.from(belegSigningInput(beleg), 'utf8'), { key, dsaEncoding: 'ieee-p1363' }, sigBytes);
  } catch (err) {
    pruefungen.push({ name: 'Signatur', status: 'FAIL', detail: (err as Error).message });
    return { pruefungen };
  }
  pruefungen.push(pruefe('Signatur', ok));
  return { pruefungen };
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/code/pruefe.ts packages/rksv/src/code/pruefe.test.ts
git commit -m "feat(rksv/code): Belegpruefung -- Struktur/Format und ES256-Signaturpruefung"
```

---

### Task 4: Verkettung (`code/verkettung.ts`)

**Files:**
- Create: `packages/rksv/src/code/verkettung.ts`
- Test: `packages/rksv/src/code/verkettung.test.ts`

**Interfaces:**
- Consumes: `node:crypto` (`createHash`); `Beleg`, `toStandardBase64` aus `./decode`; `belegSigningInput` aus `./pruefe`; `Pruefung` aus `./pruefe`.
- Produces:
  - `function kompakteJws(beleg: Beleg): string` — `belegSigningInput(beleg) + '.' + base64url(signaturbytes)`.
  - `function verkettungswert(input: string | Beleg): string` — SHA-256 über UTF-8-String (Kassen-ID) bzw. über die kompakte JWS eines Belegs; Bytes 0–7, Standard-Base64.
  - `function pruefeVerkettung(beleg: Beleg, vorheriger?: Beleg): Pruefung` — vergleicht `beleg.sigVoriger` mit dem erwarteten Wert: bei `vorheriger` über dessen kompakte JWS, sonst (Startbeleg) über `beleg.kassenId`.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/code/verkettung.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeBelegCode } from './decode';
import { verkettungswert, pruefeVerkettung, kompakteJws } from './verkettung';

const UMS = Buffer.alloc(8, 2).toString('base64');
const SIG = Buffer.alloc(64, 7).toString('base64');

function code(sigVoriger: string, over: Partial<Record<number, string>> = {}): string {
  const seg = ['R1-AT1', 'KASSE-001', '243', '2026-07-20T14:23:34', '10,00', '0,00', '0,00', '0,00', '0,00', UMS, '1a2b3c', sigVoriger, SIG];
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string;
  return '_' + seg.join('_');
}

function erwartetAusString(s: string): string {
  return createHash('sha256').update(Buffer.from(s, 'utf8')).digest().subarray(0, 8).toString('base64');
}

test('Startbeleg: Verkettungswert über Kassen-ID', () => {
  const kassenId = 'A12347';
  const erwartet = erwartetAusString(kassenId);
  const beleg = decodeBelegCode(code(erwartet, { 2: kassenId }));
  assert.equal(pruefeVerkettung(beleg).status, 'PASS');
});

test('bekannter BMF-Vektor: A12347 -> OeSKQjO4zKI=', () => {
  assert.equal(verkettungswert('A12347'), 'OeSKQjO4zKI=');
});

test('Folgebeleg: Verkettungswert über kompakte JWS des Vorbelegs', () => {
  const vorheriger = decodeBelegCode(code(Buffer.alloc(8, 0).toString('base64')));
  const erwartet = verkettungswert(vorheriger);
  const aktuell = decodeBelegCode(code(erwartet, { 3: '244' }));
  assert.equal(pruefeVerkettung(aktuell, vorheriger).status, 'PASS');
});

test('falscher Verkettungswert -> FAIL', () => {
  const vorheriger = decodeBelegCode(code(Buffer.alloc(8, 0).toString('base64')));
  const aktuell = decodeBelegCode(code(Buffer.alloc(8, 9).toString('base64'), { 3: '244' }));
  assert.equal(pruefeVerkettung(aktuell, vorheriger).status, 'FAIL');
});

test('kompakteJws hat drei durch Punkt getrennte Teile', () => {
  const beleg = decodeBelegCode(code(Buffer.alloc(8, 0).toString('base64')));
  assert.equal(kompakteJws(beleg).split('.').length, 3);
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './verkettung'`.

- [ ] **Step 3: Implementierung schreiben**

`packages/rksv/src/code/verkettung.ts`:
```ts
import { createHash } from 'node:crypto';
import { type Beleg, toStandardBase64 } from './decode';
import { belegSigningInput, type Pruefung } from './pruefe';

export function kompakteJws(beleg: Beleg): string {
  const sigB64url = Buffer.from(toStandardBase64(beleg.signatur), 'base64').toString('base64url');
  return belegSigningInput(beleg) + '.' + sigB64url;
}

export function verkettungswert(input: string | Beleg): string {
  const daten = typeof input === 'string' ? input : kompakteJws(input);
  return createHash('sha256').update(Buffer.from(daten, 'utf8')).digest().subarray(0, 8).toString('base64');
}

export function pruefeVerkettung(beleg: Beleg, vorheriger?: Beleg): Pruefung {
  const erwartet = vorheriger ? verkettungswert(vorheriger) : verkettungswert(beleg.kassenId);
  const ist = beleg.sigVoriger;
  if (ist === erwartet) {
    return { name: 'Verkettung', status: 'PASS' };
  }
  return {
    name: 'Verkettung',
    status: 'FAIL',
    detail: vorheriger ? 'Verkettungswert stimmt nicht mit Vorbeleg überein' : 'Verkettungswert stimmt nicht mit Kassen-ID überein (Startbeleg)',
  };
}
```

- [ ] **Step 4: Test bestehen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS (inkl. bekanntem BMF-Vektor `A12347 → OeSKQjO4zKI=`).

- [ ] **Step 5: Commit**

```bash
git add packages/rksv/src/code/verkettung.ts packages/rksv/src/code/verkettung.test.ts
git commit -m "feat(rksv/code): Belegverkettung (SHA-256 ueber JWS-Vorbeleg bzw. Kassen-ID)"
```

---

### Task 5: Barrel + Isolation + Subpath-Build (`code/index.ts`)

**Files:**
- Create: `packages/rksv/src/code/index.ts`
- Test: `packages/rksv/src/code/isolation.test.ts`

**Interfaces:**
- Produces: `code/index.ts` re-exportiert die öffentliche Offline-API: `decodeBelegCode`, `RksvCodeError`, Typen `Beleg`/`Betraege`/`Besonderheit`; `pruefeBelegCode`, `belegSigningInput`, Typen `Pruefung`/`Pruefergebnis`/`PruefOptionen`; `pruefeVerkettung`, `verkettungswert`, `kompakteJws`; `base32Decode`/`base32Encode`.
- Der Isolationstest stellt sicher, dass **kein** `code/`-Modul aus `@kreiseck/finanzonline-core`, HTTP oder SOAP importiert.

- [ ] **Step 1: Failing test schreiben**

`packages/rksv/src/code/isolation.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as code from './index';

test('code/index exportiert die Offline-API', () => {
  assert.equal(typeof code.decodeBelegCode, 'function');
  assert.equal(typeof code.pruefeBelegCode, 'function');
  assert.equal(typeof code.pruefeVerkettung, 'function');
  assert.equal(typeof code.base32Decode, 'function');
});

test('kein code/-Modul importiert Core/HTTP/SOAP', () => {
  // Test läuft aus test-dist/code/; die Quellen liegen zwei Ebenen höher unter src/code.
  const srcDir = join(__dirname, '..', '..', 'src', 'code');
  for (const f of readdirSync(srcDir)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
    const text = readFileSync(join(srcDir, f), 'utf8');
    assert.ok(!/finanzonline-core/.test(text), `${f} importiert Core`);
    assert.ok(!/node:http|node:https|['"]fetch['"]|soap/i.test(text), `${f} referenziert HTTP/SOAP`);
  }
});
```

- [ ] **Step 2: Test fehlschlagen lassen**

Run: `npm test -w @kreiseck/rksv`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Barrel schreiben**

`packages/rksv/src/code/index.ts`:
```ts
export { decodeBelegCode, RksvCodeError, toStandardBase64, type Beleg, type Betraege, type Besonderheit } from './decode';
export { pruefeBelegCode, belegSigningInput, type Pruefung, type Pruefergebnis, type PruefOptionen } from './pruefe';
export { pruefeVerkettung, verkettungswert, kompakteJws } from './verkettung';
export { base32Decode, base32Encode } from './base32';
```

- [ ] **Step 4: Tests + Subpath-Build prüfen**

Run: `npm test -w @kreiseck/rksv`
Expected: PASS (alle Suites, inkl. Isolation).
Run: `npm run build -w @kreiseck/rksv`
Expected: `dist/code/index.js` + `dist/code/index.d.ts` entstehen; der in `package.json` deklarierte Subpath `@kreiseck/rksv/code` löst jetzt auf. Keine tsc-Fehler, keine Testdateien in `dist`.

- [ ] **Step 5: Verifizieren, dass der Subpath importierbar ist**

Run:
```bash
node -e "const c=require('./packages/rksv/dist/code/index.js'); console.log(typeof c.decodeBelegCode, typeof c.pruefeBelegCode);"
```
Expected: `function function`.

- [ ] **Step 6: Commit**

```bash
git add packages/rksv/src/code/index.ts packages/rksv/src/code/isolation.test.ts
git commit -m "feat(rksv/code): oeffentliches Barrel und Isolationstest fuer den Offline-Belegcode"
```

---

## Nach diesem Plan

- `@kreiseck/rksv/code` ist vollständig; `@kreiseck/rksv` (Ausbaustufe 2) damit abgeschlossen.
- Optional: echte BMF-Mustercode-Testvektoren als zusätzliche Fixtures ergänzen (opt-in), sobald verfügbar.
- Integrationstests des rkdb-Pakets gegen `art_uebermittlung='T'`, sobald `tid`/`benid` vorliegen.
- `REGISTRIERUNG.md` für `finanzonline-core`.
