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
  assert.equal(toStandardBase64('a-b_c'), 'a+b/c===');
});
