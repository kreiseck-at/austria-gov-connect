import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { decodeBelegCode, RksvCodeError } from './decode';
import { pruefeBelegCode } from './pruefe';
import { pruefeVerkettung, verkettungswert } from './verkettung';
import { base32Encode } from './base32';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const { publicKey: fremderPublicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const UMS_B64 = Buffer.alloc(8, 2).toString('base64');
const VOR_B64 = Buffer.alloc(8, 1).toString('base64');
const SIG_B64 = Buffer.alloc(64, 7).toString('base64');

const BASE_SEG = [
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

// Baut einen unsignierten Rohcode aus BASE_SEG mit optionalen 1-basierten Overrides.
function rawCode(over: Partial<Record<number, string>> = {}): string {
  const seg = [...BASE_SEG];
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string;
  return '_' + seg.join('_');
}

// Baut einen korrekt signierten Code (Segmente 1..12 vom Aufrufer, Signatur wird berechnet).
function signedCode(over: Partial<Record<number, string>> = {}): string {
  const seg = BASE_SEG.slice(0, 12);
  for (const [k, v] of Object.entries(over)) seg[Number(k) - 1] = v as string;
  const payload = '_' + seg.join('_');
  const header = 'eyJhbGciOiJFUzI1NiJ9';
  const signingInput = header + '.' + Buffer.from(payload, 'utf8').toString('base64url');
  const sig = sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return payload + '_' + sig.toString('base64');
}

// ---------------------------------------------------------------------------
// decode: malformte Eingaben
// ---------------------------------------------------------------------------

test('decode: leere Zeichenkette wirft RksvCodeError', () => {
  assert.throws(() => decodeBelegCode(''), RksvCodeError);
});

test('decode: fehlendes fuehrendes "_" wirft RksvCodeError', () => {
  assert.throws(() => decodeBelegCode(BASE_SEG.join('_')), RksvCodeError);
});

test('decode: 12 Segmente (eines zu wenig) wirft RksvCodeError', () => {
  const code = '_' + BASE_SEG.slice(0, 12).join('_');
  assert.throws(() => decodeBelegCode(code), RksvCodeError);
});

test('decode: 14 Segmente (eines zu viel) wirft RksvCodeError', () => {
  const code = '_' + [...BASE_SEG, 'EXTRA'].join('_');
  assert.throws(() => decodeBelegCode(code), RksvCodeError);
});

test('decode: leeres Segment in der Mitte wirft RksvCodeError', () => {
  assert.throws(() => decodeBelegCode(rawCode({ 7: '' })), RksvCodeError);
});

test('decode: Signaturfeld mit ungueltigem Base32-Zeichen -> ocr=false', () => {
  const fastBase32 = base32Encode(Buffer.alloc(8, 1));
  const korrupt = '1' + fastBase32.slice(1); // '1' ist kein gueltiges Base32-Zeichen
  const b = decodeBelegCode(rawCode({ 13: korrupt }));
  assert.equal(b.ocr, false);
  assert.equal(b.signatur, korrupt);
});

test('decode: normaler Base64-Beleg -> ocr=false', () => {
  const b = decodeBelegCode(rawCode());
  assert.equal(b.ocr, false);
});

// ---------------------------------------------------------------------------
// decode: Besonderheiten
// ---------------------------------------------------------------------------

test('decode: TRA -> trainingsbuchung, Umsatzzaehler bleibt "TRA"', () => {
  const b = decodeBelegCode(rawCode({ 10: 'TRA' }));
  assert.equal(b.besonderheit, 'trainingsbuchung');
  assert.equal(b.umsatzzaehler, 'TRA');
});

test('decode: STO -> stornobuchung, Umsatzzaehler bleibt "STO"', () => {
  const b = decodeBelegCode(rawCode({ 10: 'STO' }));
  assert.equal(b.besonderheit, 'stornobuchung');
  assert.equal(b.umsatzzaehler, 'STO');
});

test('decode: SEE-Ausfall-Marker in Segment 13 -> besonderheit see-ausfall', () => {
  const marker = Buffer.from('Sicherheitseinrichtung ausgefallen').toString('base64');
  const b = decodeBelegCode(rawCode({ 13: marker }));
  assert.equal(b.besonderheit, 'see-ausfall');
});

test('decode: rka.kennzeichen ohne Bindestrich -> suite = volles Kennzeichen, zda leer', () => {
  const b = decodeBelegCode(rawCode({ 1: 'R1AT1' }));
  assert.equal(b.rka.suite, 'R1AT1');
  assert.equal(b.rka.zda, '');
  assert.equal(b.besonderheit, undefined);
});

// ---------------------------------------------------------------------------
// decode: OCR-Erkennung
// ---------------------------------------------------------------------------

test('decode: OCR-Variante (Base32 in 10/12/13) normalisiert korrekt und ocr=true', () => {
  const ocr = rawCode({
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

// ---------------------------------------------------------------------------
// pruefe: Formatpruefungen unabhaengig voneinander
// ---------------------------------------------------------------------------

test('pruefe: ungueltiges Algorithmuskennzeichen -> FAIL, Datum/Betragsformate unabhaengig weiter PASS', () => {
  const beleg = decodeBelegCode(signedCode({ 1: 'X1-AT1' }));
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Algorithmuskennzeichen')?.status, 'FAIL');
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Betragsformate')?.status, 'PASS');
});

test('pruefe: ungueltiges Datum -> FAIL, Algorithmuskennzeichen/Betragsformate unabhaengig weiter PASS', () => {
  const beleg = decodeBelegCode(signedCode({ 4: '20.07.2026' }));
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'FAIL');
  assert.equal(res.pruefungen.find((p) => p.name === 'Algorithmuskennzeichen')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Betragsformate')?.status, 'PASS');
});

test('pruefe: Betrag mit Punkt statt Komma ("10.00") -> Betragsformate FAIL, andere unabhaengig weiter PASS', () => {
  const beleg = decodeBelegCode(signedCode({ 5: '10.00' }));
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Betragsformate')?.status, 'FAIL');
  assert.equal(res.pruefungen.find((p) => p.name === 'Algorithmuskennzeichen')?.status, 'PASS');
  assert.equal(res.pruefungen.find((p) => p.name === 'Datum')?.status, 'PASS');
});

test('pruefe: Betrag mit nur einer Nachkommastelle ("10,0") -> Betragsformate FAIL', () => {
  const beleg = decodeBelegCode(signedCode({ 5: '10,0' }));
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Betragsformate')?.status, 'FAIL');
});

// ---------------------------------------------------------------------------
// pruefe: Signaturmatrix
// ---------------------------------------------------------------------------

test('pruefe: gueltige Signatur -> PASS', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'PASS');
});

test('pruefe: manipulierte Belegnummer nach der Signatur -> Signatur FAIL', () => {
  const beleg = decodeBelegCode(signedCode());
  beleg.segmente[2] = '999'; // Belegnummer nachtraeglich veraendert
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'FAIL');
});

test('pruefe: falscher oeffentlicher Schluessel -> Signatur FAIL', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg, { schluessel: fremderPublicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'FAIL');
});

test('pruefe: kein Schluessel/Zertifikat -> Signatur NOT_EXECUTED', () => {
  const beleg = decodeBelegCode(signedCode());
  const res = pruefeBelegCode(beleg);
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'NOT_EXECUTED');
});

test('pruefe: SEE-Ausfall -> Signaturlaenge und Signatur NOT_EXECUTED trotz vorhandenem Schluessel', () => {
  const marker = Buffer.from('Sicherheitseinrichtung ausgefallen').toString('base64');
  const beleg = decodeBelegCode(rawCode({ 13: marker }));
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signaturlaenge')?.status, 'NOT_EXECUTED');
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'NOT_EXECUTED');
});

test('pruefe: Signaturfeld dekodiert zu != 64 Byte -> Signaturlaenge FAIL und Signatur FAIL', () => {
  const kurzeSignatur = Buffer.alloc(32, 5).toString('base64');
  const beleg = decodeBelegCode(rawCode({ 13: kurzeSignatur }));
  const res = pruefeBelegCode(beleg, { schluessel: publicKey });
  assert.equal(res.pruefungen.find((p) => p.name === 'Signaturlaenge')?.status, 'FAIL');
  assert.equal(res.pruefungen.find((p) => p.name === 'Signatur')?.status, 'FAIL');
});

// ---------------------------------------------------------------------------
// verkettung
// ---------------------------------------------------------------------------

test('verkettung: Startbeleg mit falschem Verkettungswert -> FAIL', () => {
  const kassenId = 'KASSE-999';
  const falsch = createHash('sha256')
    .update(Buffer.from('anderer-wert', 'utf8'))
    .digest()
    .subarray(0, 8)
    .toString('base64');
  const beleg = decodeBelegCode(rawCode({ 2: kassenId, 12: falsch }));
  assert.equal(pruefeVerkettung(beleg).status, 'FAIL');
});

test('verkettung: Startbeleg mit korrektem Verkettungswert -> PASS', () => {
  const kassenId = 'KASSE-999';
  const erwartet = verkettungswert(kassenId);
  const beleg = decodeBelegCode(rawCode({ 2: kassenId, 12: erwartet }));
  assert.equal(pruefeVerkettung(beleg).status, 'PASS');
});
