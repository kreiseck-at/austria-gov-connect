import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256 } from './sha256';

const alsHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const referenz = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('stimmt mit node:crypto ueber alle Laengen 0 bis 200 ueberein', () => {
  for (let n = 0; n <= 200; n++) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = (i * 31 + 7) % 256;
    assert.equal(alsHex(sha256(b)), referenz(b), `Laenge ${n}`);
  }
});

test('stimmt an den Raendern der Auffuellung nach FIPS 180-4', () => {
  // Bei 55/56 und 119/120 Byte kippt die Auffuellung in einen zusaetzlichen
  // Block -- dort scheitern fehlerhafte Umsetzungen zuerst.
  for (const n of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129]) {
    const b = new Uint8Array(n).fill(0xab);
    assert.equal(alsHex(sha256(b)), referenz(b), `Laenge ${n}`);
  }
});

test('liefert immer 32 Byte und 64 Hex-Zeichen, auch mit fuehrender Null', () => {
  for (let i = 0; i < 500; i++) {
    const b = utf8('x' + i);
    const h = sha256(b);
    assert.equal(h.length, 32);
    assert.match(alsHex(h), /^[0-9a-f]{64}$/);
  }
  function utf8(s: string) {
    return new TextEncoder().encode(s);
  }
});
