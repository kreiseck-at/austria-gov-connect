import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { base32Decode } from './base32';

// Dieser Test ist der eigentliche Zweck des Umbaus: der Kern muss ohne
// node:crypto, ohne Buffer und ohne process auskommen. Geprueft wird nicht die
// Absicht, sondern das Ergebnis -- ein Zugriff, den jemand spaeter wieder
// hinzufuegt, faellt hier auf.
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
// WAS DIESER WAECHTER NICHT FAENGT: alles, was den Namen erst zur Laufzeit
// zusammensetzt -- `globalThis['Buf' + 'fer']`, ein Zugriff ueber eine Variable
// oder ein dynamisch gebautes Modul-Argument. Gegen absichtliche Umgehung ist
// eine Textsuche machtlos; sie soll das versehentliche Zurueckholen fangen.
// Diese Luecke steht hier, weil ein Waechter, der mehr verspricht als er haelt,
// schlimmer ist als eine benannte Luecke.
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

// Auf beiden Ebenen verboten.
const NODE_IMPORT = /require\(["']node:|from ["']node:/;
const PROCESS = /\bprocess\b/;
// Nur uebersetzt sinnvoll: die eigenen Importe des Kerns heissen require("./…"),
// alles ohne fuehrenden Punkt ist ein fremdes Modul.
const FREMDES_MODUL = /require\(["'][^.]/;
const BUFFER = /\bBuffer\b/;
// Nur in der Quelle sinnvoll: dort gibt es ausschliesslich ESM-Importe, jedes
// require ist von Hand nachgeruestet.
const REQUIRE = /\brequire\s*\(/;

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

test('der uebersetzte Kern laedt nichts ausser seinen eigenen Modulen', () => {
  for (const datei of KERN) {
    const code = uebersetzt(datei);
    assert.doesNotMatch(code, NODE_IMPORT, `${datei} zieht ein Node-Modul`);
    assert.doesNotMatch(code, FREMDES_MODUL, `${datei} laedt ein fremdes Modul`);
    assert.doesNotMatch(code, PROCESS, `${datei} fragt process ab`);
  }
});

test('keine Quelle des Kerns greift nach Node', () => {
  for (const datei of KERN) {
    const ts = datei.replace(/\.js$/, '.ts');
    const code = quelle(datei);
    assert.doesNotMatch(code, NODE_IMPORT, `${ts} zieht ein Node-Modul`);
    assert.doesNotMatch(code, REQUIRE, `${ts} benutzt require`);
    assert.doesNotMatch(code, PROCESS, `${ts} fragt process ab`);
  }
});

test('der Kern benutzt Buffer nicht', () => {
  for (const datei of KERN) {
    assert.doesNotMatch(uebersetzt(datei), BUFFER, `${datei} benutzt Buffer`);
  }
});

test('die Suchmuster greifen', () => {
  // Gegenprobe im Test selbst. pruefe.ts darf und muss Node anfassen (X.509,
  // ES256). Faellt diese Zusicherung, sind die Muster stumpf geworden oder lesen
  // die falschen Dateien -- dann waeren auch die Tests darueber wertlos.
  assert.match(uebersetzt('pruefe.js'), NODE_IMPORT);
  assert.match(uebersetzt('pruefe.js'), FREMDES_MODUL);
  assert.match(uebersetzt('pruefe.js'), BUFFER);
  assert.match(quelle('pruefe.ts'), NODE_IMPORT);

  // Fuer process und fuer ein nachgeruestetes require gibt es im Paket keine
  // Datei, die anschlagen duerfte. Damit diese beiden Muster nicht unbemerkt
  // stumpf werden, sind sie an Musterzeilen festgenagelt.
  assert.match("const c = require('crypto');", REQUIRE);
  assert.match('const c = require("crypto");', FREMDES_MODUL);
  assert.match("const p = globalThis['process'];", PROCESS);
  assert.match('const p = globalThis.process.versions;', PROCESS);
  // Und die Gegenrichtung: die eigenen, relativen Importe des Kerns duerfen
  // nicht anschlagen, sonst waere das Muster unbrauchbar streng.
  assert.doesNotMatch('const d = require("./decode");', FREMDES_MODUL);
});

test('base32Decode liefert ein Uint8Array', () => {
  const b = base32Decode('MZXW6===');
  assert.ok(b instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(b), 'foo');
});
