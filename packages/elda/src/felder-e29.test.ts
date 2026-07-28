import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FELDER_E29, SATZLAENGE_E29, IDENTIFIKATIONSTEIL, LAENGE_IDENTIFIKATIONSTEIL } from './felder-e29';
import { pruefeFeldtabelle } from './festsatz';

test('E.29: 39 Felder, lückenlos bis Position 772', () => {
  assert.equal(FELDER_E29.length, 39);
  assert.equal(SATZLAENGE_E29, 772);
  assert.doesNotThrow(() => pruefeFeldtabelle(FELDER_E29, SATZLAENGE_E29));
});

test('E.29: Stichproben gegen das Dokument', () => {
  const nach = (name: string) => FELDER_E29.find((f) => f.name === name);
  assert.deepEqual(nach('IDTEIL'), { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' });
  assert.deepEqual(nach('BKNR'), { nr: 4, name: 'BKNR', pos: 101, laenge: 10, typ: 'a/n' });
  assert.equal(nach('DGNA')?.pos, 111);
  assert.equal(nach('DGNA')?.klasse, 'unternehmen');
  assert.equal(nach('VSNR')?.pos, 315);
  assert.equal(nach('VSNR')?.typ, 'n');
  assert.equal(nach('FANA')?.klasse, 'personenname');
  assert.equal(nach('VONA')?.klasse, 'personenname');
  assert.deepEqual(nach('VWAZ'), { nr: 39, name: 'VWAZ', pos: 769, laenge: 4, typ: 'n' });
});

test('Identifikationsteil: 20 Zeichen, fünf Felder', () => {
  assert.equal(LAENGE_IDENTIFIKATIONSTEIL, 20);
  assert.equal(IDENTIFIKATIONSTEIL.length, 5);
  assert.doesNotThrow(() => pruefeFeldtabelle(IDENTIFIKATIONSTEIL, LAENGE_IDENTIFIKATIONSTEIL));
  assert.deepEqual(
    IDENTIFIKATIONSTEIL.map((f) => f.name),
    ['SART', 'SANR', 'UVST', 'OBUS', 'VSTR'],
  );
});

test('Feldnummern sind lückenlos 1..39', () => {
  assert.deepEqual(
    FELDER_E29.map((f) => f.nr),
    Array.from({ length: 39 }, (_, i) => i + 1),
  );
});
