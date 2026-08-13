import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buchungsmarker, decodeBelegCode, RksvCodeError, toStandardBase64 } from './decode';
import { base32Encode } from './base32';

const SIG_B64 = Buffer.alloc(64, 7).toString('base64'); // 64 Byte, enthält Kleinbuchstaben/+//
const VOR_B64 = Buffer.alloc(8, 1).toString('base64');
const UMS_B64 = Buffer.alloc(8, 2).toString('base64');

function code(over: Partial<Record<number, string>> = {}): string {
  const seg = [
    'R1-AT1',
    'KASSE-001',
    '243',
    '2026-07-20T14:23:34',
    '10,00',
    '0,00',
    '0,00',
    '0,00',
    '0,00',
    UMS_B64,
    '1a2b3c',
    VOR_B64,
    SIG_B64,
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

test('Trainingsbuchung: Segment 10 = VFJB (base64 von TRA)', () => {
  const b = decodeBelegCode(code({ 10: 'VFJB' }));
  assert.equal(b.besonderheit, 'trainingsbuchung');
  assert.equal(b.umsatzzaehler, 'VFJB');
});

test('Stornobuchung: Segment 10 = U1RP (base64 von STO)', () => {
  const b = decodeBelegCode(code({ 10: 'U1RP' }));
  assert.equal(b.besonderheit, 'stornobuchung');
  assert.equal(b.umsatzzaehler, 'U1RP');
});

test('buchungsmarker kennt beide Schreibweisen und sonst nichts', () => {
  assert.equal(buchungsmarker('VFJB'), 'trainingsbuchung');
  assert.equal(buchungsmarker('TRA'), 'trainingsbuchung');
  assert.equal(buchungsmarker('U1RP'), 'stornobuchung');
  assert.equal(buchungsmarker('STO'), 'stornobuchung');
  assert.equal(buchungsmarker(UMS_B64), undefined);
  assert.equal(buchungsmarker(''), undefined);
  // Nicht die base32-Form: die wird vor der Erkennung nach base64 umkodiert.
  assert.equal(buchungsmarker('KRJEC==='), undefined);
});

test('OCR-Variante: der base32-Marker wird als Buchung erkannt', () => {
  // base32('TRA') = KRJEC===, base32('STO') = KNKE6=== -- genau das, was in der
  // OCR-Fassung der BMF-Testsuite steht.
  const ocr = (feld: string) =>
    decodeBelegCode(
      code({ 10: feld, 12: base32Encode(Buffer.alloc(8, 1)), 13: base32Encode(Buffer.alloc(64, 7)) }),
    );

  assert.equal(base32Encode(Buffer.from('TRA', 'utf8')), 'KRJEC===');
  assert.equal(base32Encode(Buffer.from('STO', 'utf8')), 'KNKE6===');

  const t = ocr('KRJEC===');
  assert.equal(t.ocr, true);
  assert.equal(t.besonderheit, 'trainingsbuchung');
  assert.equal(t.umsatzzaehler, 'VFJB');

  const s = ocr('KNKE6===');
  assert.equal(s.besonderheit, 'stornobuchung');
  assert.equal(s.umsatzzaehler, 'U1RP');
});

test('OCR-Variante: literales TRA bleibt unangetastet und wird erkannt', () => {
  // Ein Erzeuger, der das Kuerzel literal schreibt, meint keine base32-Daten:
  // Dekodieren machte aus "TRA" ein sinnloses Byte. Deshalb durchgereicht.
  const b = decodeBelegCode(
    code({ 10: 'TRA', 12: base32Encode(Buffer.alloc(8, 1)), 13: base32Encode(Buffer.alloc(64, 7)) }),
  );
  assert.equal(b.ocr, true);
  assert.equal(b.besonderheit, 'trainingsbuchung');
  assert.equal(b.umsatzzaehler, 'TRA');
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
