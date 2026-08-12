import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode } from './base32';

// base32Decode liefert seit 0.10.0 ein Uint8Array statt eines Buffer, damit die
// Dekodierung ohne Node auskommt. deepEqual prueft auch den Prototyp, deshalb
// stehen die Erwartungen als Uint8Array da -- die Bytes selbst sind unveraendert.
function bytes(b: Buffer): Uint8Array {
  return new Uint8Array(b);
}

test('Round-Trip beliebiger Bytes', () => {
  for (const hex of ['', '00', '61', '48656c6c6f', 'deadbeef0102030405']) {
    const buf = Buffer.from(hex, 'hex');
    assert.equal(base32Encode(buf), base32Encode(buf));
    assert.deepEqual(base32Decode(base32Encode(buf)), bytes(buf));
  }
});

test('bekannter Vektor RFC 4648: "foobar"', () => {
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI======');
  assert.deepEqual(base32Decode('MZXW6YTBOI======'), bytes(Buffer.from('foobar')));
});

test('ignoriert Padding und ist case-insensitiv beim Decodieren', () => {
  assert.deepEqual(base32Decode('mzxw6ytboi======'), bytes(Buffer.from('foobar')));
});

test('wirft bei ungültigem Zeichen', () => {
  assert.throws(() => base32Decode('0189'), /Base32/);
});
