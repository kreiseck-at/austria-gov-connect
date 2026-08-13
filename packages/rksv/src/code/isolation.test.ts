import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as code from './index';
import * as signatur from './signatur';
import { sha256 } from './sha256';

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

test('jeder Einstiegspunkt der exports-Karte hat eine Quelle', () => {
  // Was nicht in der exports-Karte steht, ist von aussen nicht erreichbar: Node
  // antwortet mit ERR_PACKAGE_PATH_NOT_EXPORTED, auch wenn die Datei im Paket
  // liegt. Genau so war es bis 0.10.0 mit ./code/sha256 -- die reine SHA-256 lag
  // in dist, kam aber bei niemandem an.
  const wurzel = join(__dirname, '..', '..');
  const pkg = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')) as {
    exports: Record<string, { types: string; default: string }>;
  };

  for (const [pfad, ziel] of Object.entries(pkg.exports)) {
    // dist/ entsteht erst beim Bauen; geprueft wird deshalb die Quelle dahinter.
    const quelle = ziel.default.replace(/^\.\/dist\//, '').replace(/\.js$/, '.ts');
    assert.ok(readFileSync(join(wurzel, 'src', quelle), 'utf8').length > 0, `${pfad}: ${quelle} fehlt`);
  }

  assert.ok('./code/sha256' in pkg.exports, 'Einstiegspunkt ./code/sha256 fehlt');
  assert.equal(typeof sha256, 'function');
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
