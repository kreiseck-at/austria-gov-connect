import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeBelegCode } from './decode';
import { verkettungswert, pruefeVerkettung, kompakteJws } from './verkettung';

const UMS = Buffer.alloc(8, 2).toString('base64');
const SIG = Buffer.alloc(64, 7).toString('base64');

function code(sigVoriger: string, over: Partial<Record<number, string>> = {}): string {
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
    UMS,
    '1a2b3c',
    sigVoriger,
    SIG,
  ];
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string;
  return '_' + seg.join('_');
}

function erwartetAusString(s: string): string {
  return createHash('sha256').update(Buffer.from(s, 'utf8')).digest().subarray(0, 8).toString('base64');
}

test('Startbeleg: Verkettungswert über Kassen-ID', () => {
  const kassenId = 'A12347';
  const erwartet = erwartetAusString(kassenId);
  const beleg = decodeBelegCode(code(erwartet, { 2: kassenId }));
  assert.equal(pruefeVerkettung(beleg).status, 'PASS');
});

test('bekannter BMF-Vektor: A12347 -> OeSKQjO4zKI=', () => {
  assert.equal(verkettungswert('A12347'), 'OeSKQjO4zKI=');
});

test('Folgebeleg: Verkettungswert über kompakte JWS des Vorbelegs', () => {
  const vorheriger = decodeBelegCode(code(Buffer.alloc(8, 0).toString('base64')));
  const erwartet = verkettungswert(vorheriger);
  const aktuell = decodeBelegCode(code(erwartet, { 3: '244' }));
  assert.equal(pruefeVerkettung(aktuell, vorheriger).status, 'PASS');
});

test('falscher Verkettungswert -> FAIL', () => {
  const vorheriger = decodeBelegCode(code(Buffer.alloc(8, 0).toString('base64')));
  const aktuell = decodeBelegCode(code(Buffer.alloc(8, 9).toString('base64'), { 3: '244' }));
  assert.equal(pruefeVerkettung(aktuell, vorheriger).status, 'FAIL');
});

test('kompakteJws hat drei durch Punkt getrennte Teile', () => {
  const beleg = decodeBelegCode(code(Buffer.alloc(8, 0).toString('base64')));
  assert.equal(kompakteJws(beleg).split('.').length, 3);
});
