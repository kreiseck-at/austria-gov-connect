import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as code from './index';
import * as signatur from './signatur';

test('code/index exportiert die Offline-API', () => {
  assert.equal(typeof code.decodeBelegCode, 'function');
  assert.equal(typeof code.pruefeVerkettung, 'function');
  assert.equal(typeof code.base32Decode, 'function');
  assert.equal(typeof code.belegSigningInput, 'function');
});

test('code/signatur exportiert die Node-gebundene Signaturpruefung', () => {
  // pruefeBelegCode lag bis 0.9.0 in code/index. Es haengt an node:crypto und
  // ist deshalb in den eigenen Einstiegspunkt gewandert, damit der Kern im
  // Browser laeuft.
  assert.equal(typeof signatur.pruefeBelegCode, 'function');
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
