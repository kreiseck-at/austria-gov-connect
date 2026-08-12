import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utf8Bytes, bytesZuBase64, bytesZuBase64Url, base64ZuBytes, bytesZuUtf8 } from './text';

test('utf8Bytes und bytesZuUtf8 sind zueinander invers, auch bei Umlauten', () => {
  for (const s of ['', 'a', 'Grüße', 'Türk Şirket Łódź', '€ 1,00', '\u0000\u007f']) {
    assert.equal(bytesZuUtf8(utf8Bytes(s)), s);
  }
});

test('bytesZuBase64 stimmt mit Buffer ueberein', () => {
  // Buffer ist hier nur der Massstab, nicht die Umsetzung.
  for (let n = 0; n <= 32; n++) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = (i * 37 + 11) % 256;
    assert.equal(bytesZuBase64(b), Buffer.from(b).toString('base64'), `Laenge ${n}`);
    assert.equal(bytesZuBase64Url(b), Buffer.from(b).toString('base64url'), `Laenge ${n}`);
  }
});

test('base64ZuBytes ist die Umkehrung, auch bei Auffuellzeichen', () => {
  for (let n = 0; n <= 32; n++) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = (i * 53 + 7) % 256;
    assert.deepEqual(base64ZuBytes(bytesZuBase64(b)), b, `Laenge ${n}`);
  }
});

test('base64ZuBytes vertraegt Base64url-Zeichen', () => {
  const b = new Uint8Array([251, 255, 190, 62, 63]);
  const url = bytesZuBase64Url(b);
  assert.deepEqual(base64ZuBytes(url.replace(/-/g, '+').replace(/_/g, '/')), b);
});
