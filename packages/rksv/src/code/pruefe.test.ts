import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { decodeBelegCode } from './decode';
import { pruefeBelegCode, belegSigningInput } from './pruefe';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

// Baut einen gültig signierten Belegcode: Segmente 1..12, dann Signatur über den Signing-Input.
function signedCode(over: Partial<Record<number, string>> = {}): string {
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
    Buffer.alloc(8, 2).toString('base64'),
    '1a2b3c',
    Buffer.alloc(8, 1).toString('base64'),
  ];
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string; // 1-basiert
  const payload = '_' + seg.join('_');
  const header = 'eyJhbGciOiJFUzI1NiJ9';
  const signingInput = header + '.' + Buffer.from(payload, 'utf8').toString('base64url');
  const sig = sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return payload + '_' + sig.toString('base64');
}

test('belegSigningInput rekonstruiert header.base64url(payload)', () => {
  const beleg = decodeBelegCode(signedCode());
  const input = belegSigningInput(beleg);
  assert.match(input, /^eyJhbGciOiJFUzI1NiJ9\./);
  const payload = Buffer.from(input.split('.')[1]!, 'base64url').toString('utf8');
  assert.match(payload, /^_R1-AT1_KASSE-001_243_/);
});

test('gültige Signatur -> PASS mit öffentlichem Schlüssel', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  const sig = res.pruefungen.find((p) => p.name === 'Signatur');
  assert.equal(sig?.status, 'PASS');
});

test('manipulierter Betrag -> Signatur FAIL', () => {
  const beleg = decodeBelegCode(signedCode());
  beleg.segmente[4] = '99,99'; // Betrag Normal nachträglich ändern
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'FAIL');
});

test('ohne Schlüssel -> Signatur NOT_EXECUTED', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'NOT_EXECUTED');
});

test('Struktur-/Formatprüfungen laufen ohne Schlüssel', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Algorithmuskennzeichen')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Betragsformate')?.status, 'PASS');
});

test('ungültiges Datumsformat -> Datum FAIL', () => {
  const beleg = decodeBelegCode(signedCode({ 4: '20.07.2026' }));
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'FAIL');
});

test('see-ausfall -> Signatur NOT_EXECUTED trotz Schlüssel', () => {
  // Bei SEE-Ausfall steht statt der Signatur der Ausfall-Marker; nicht signieren.
  const marker = Buffer.from('Sicherheitseinrichtung ausgefallen').toString('base64');
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
    Buffer.alloc(8, 2).toString('base64'),
    '1a2b3c',
    Buffer.alloc(8, 1).toString('base64'),
    marker,
  ];
  const beleg = decodeBelegCode('_' + seg.join('_'));
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  const sig = res.pruefungen.find((p) => p.name === 'Signatur');
  assert.equal(sig?.status, 'NOT_EXECUTED');
  assert.match(sig?.detail ?? '', /ausgefallen/i);
});
