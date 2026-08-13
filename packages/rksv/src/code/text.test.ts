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

test('base64ZuBytes bricht an der Auffuellung ab wie Buffer', () => {
  // Buffer.from(s, 'base64') hoert am ersten '=' auf zu lesen. Bei wohlgeformtem
  // Base64 steht '=' nur am Ende, dort sind beide Fassungen ohnehin gleich --
  // die Abweichung zeigt sich erst bei einem '=' mitten in der Zeichenkette,
  // also bei manipulierten oder beschaedigten Belegcodes. Genau diese Eingabe
  // fehlte, deshalb ist die Abweichung niemandem aufgefallen: eine nachsichtige
  // Fassung liest ueber das '=' hinweg, erkennt dadurch den Ausfalltext in einem
  // verfaelschten Code und laesst die Signaturpruefungen still aus.
  const faelle = [
    'U2ljaGVy=aGVpdHNlaW5yaWNodHVuZyBhdXNnZWZhbGxlbg==',
    '=',
    '=QUJD',
    'QQ==QQ==',
    'AA=A',
    'QUJD',
    'QQ==',
    'QUJDRA==',
    'QUJ\nDRA==',
    'QUJD RA==',
  ];
  for (const s of faelle) {
    assert.deepEqual(base64ZuBytes(s), new Uint8Array(Buffer.from(s, 'base64')), JSON.stringify(s));
  }
});

test('base64ZuBytes vertraegt Base64url-Zeichen', () => {
  const b = new Uint8Array([251, 255, 190, 62, 63]);
  const url = bytesZuBase64Url(b);
  assert.deepEqual(base64ZuBytes(url.replace(/-/g, '+').replace(/_/g, '/')), b);
});
