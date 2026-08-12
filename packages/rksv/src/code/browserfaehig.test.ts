import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { base32Decode } from './base32';

// Dieser Test ist der eigentliche Zweck des Umbaus: der Kern muss ohne
// node:crypto und ohne Buffer auskommen. Geprueft wird nicht die Absicht,
// sondern das Ergebnis -- ein Import, den jemand spaeter wieder hinzufuegt,
// faellt hier auf.
//
// Zwei Ebenen, weil eine nicht reicht:
//
//  - Der uebersetzte Code sagt, was zur Laufzeit wirklich geladen wird. Der
//    Testbau setzt removeComments, damit hier nur ausfuehrbarer Code steht:
//    sonst schluege schon der Kommentar an, der erklaert, warum Buffer nicht
//    vorkommen darf.
//  - Die Quelle sagt, was jemand hingeschrieben hat. Noetig, weil TypeScript
//    einen unbenutzten Import spurlos wegwirft: `import { createHash } from
//    'node:crypto'` ohne Verwendung steht in keiner uebersetzten Datei. Erst
//    wer ihn benutzt, faellt in der uebersetzten Ebene auf -- da soll aber
//    schon die Zeile selbst auffallen.
//
// Die dritte Ebene ist kein Test, sondern der Compiler: `tsc -p
// tsconfig.kern.json` uebersetzt src/code/index.ts mit "types": [], also ohne
// @types/node. Damit faellt auch eine reine Typabhaengigkeit auf (etwa Buffer
// oder KeyObject in einer Signatur), die in keiner uebersetzten Zeile steht.
//
// Der Test laeuft aus test-dist/code/; die uebersetzten Dateien liegen direkt
// neben ihm, die Quellen zwei Ebenen hoeher.
const KERN = [
  'text.js',
  'sha256.js',
  'signaturbasis.js',
  'verkettung.js',
  'base32.js',
  'decode.js',
  'index.js',
];

const QUELLEN = join(__dirname, '..', '..', 'src', 'code');

const NODE_IMPORT = /require\(["']node:|from ["']node:/;
const BUFFER = /\bBuffer\b/;

function lies(pfad: string, name: string): string {
  const code = readFileSync(pfad, 'utf8');
  // Ohne diese Zusicherung waere der Waechter eine Attrappe: gegen eine leere
  // Zeichenkette passt kein Suchmuster, der Test bliebe immer gruen.
  assert.ok(code.length > 0, `${name} ist leer -- der Waechter greift ins Leere`);
  return code;
}

function uebersetzt(datei: string): string {
  return lies(join(__dirname, datei), datei);
}

function quelle(datei: string): string {
  const ts = datei.replace(/\.js$/, '.ts');
  return lies(join(QUELLEN, ts), ts);
}

test('der uebersetzte Kern importiert nichts aus node', () => {
  for (const datei of KERN) {
    assert.doesNotMatch(uebersetzt(datei), NODE_IMPORT, `${datei} zieht ein Node-Modul`);
  }
});

test('keine Quelle des Kerns importiert aus node', () => {
  for (const datei of KERN) {
    const ts = datei.replace(/\.js$/, '.ts');
    assert.doesNotMatch(quelle(datei), NODE_IMPORT, `${ts} zieht ein Node-Modul`);
  }
});

test('der Kern benutzt Buffer nicht', () => {
  for (const datei of KERN) {
    assert.doesNotMatch(uebersetzt(datei), BUFFER, `${datei} benutzt Buffer`);
  }
});

test('die Suchmuster greifen: die Node-gebundene Signaturpruefung faellt durch', () => {
  // Gegenprobe im Test selbst. pruefe.ts darf und muss Node anfassen (X.509,
  // ES256). Faellt diese Zusicherung, sind die Muster oben stumpf geworden oder
  // lesen die falschen Dateien -- dann waeren auch die Tests darueber wertlos.
  assert.match(uebersetzt('pruefe.js'), NODE_IMPORT);
  assert.match(uebersetzt('pruefe.js'), BUFFER);
  assert.match(quelle('pruefe.js'), NODE_IMPORT);
});

test('base32Decode liefert ein Uint8Array', () => {
  const b = base32Decode('MZXW6===');
  assert.ok(b instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(b), 'foo');
});
