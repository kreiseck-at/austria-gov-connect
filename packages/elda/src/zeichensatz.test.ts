import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nachIso885915, pruefeVorrat } from './zeichensatz';
import { EldaError } from './errors';

test('ISO-8859-15: Umlaute und ß werden ein Byte', () => {
  assert.deepEqual(nachIso885915('Müller', 'FANA'), Buffer.from([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]));
  assert.deepEqual(nachIso885915('ß', 'FANA'), Buffer.from([0xdf]));
});

test('ISO-8859-15: das Eurozeichen liegt auf 0xA4 — der Unterschied zu ISO-8859-1', () => {
  assert.deepEqual(nachIso885915('€', 'DGNA'), Buffer.from([0xa4]));
  // ¤ belegt in ISO-8859-1 dieselbe Position und ist in ISO-8859-15 nicht darstellbar
  assert.throws(() => nachIso885915('¤', 'DGNA'), EldaError);
});

test('ISO-8859-15: die weiteren sieben Abweichungen', () => {
  for (const [zeichen, byte] of [
    ['Š', 0xa6],
    ['š', 0xa8],
    ['Ž', 0xb4],
    ['ž', 0xb8],
    ['Œ', 0xbc],
    ['œ', 0xbd],
    ['Ÿ', 0xbe],
  ] as const) {
    assert.deepEqual(nachIso885915(zeichen, 'DGNA'), Buffer.from([byte]), `${zeichen}`);
  }
  for (const zeichen of ['¦', '¨', '´', '¸', '¼', '½', '¾']) {
    assert.throws(() => nachIso885915(zeichen, 'DGNA'), EldaError, `${zeichen} darf nicht darstellbar sein`);
  }
});

test('ISO-8859-15: nicht darstellbares Zeichen wirft mit Feld, Zeichen und Position', () => {
  assert.throws(
    () => nachIso885915('Đorđević', 'FANA'),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /FANA/);
      assert.match((err as Error).message, /Đ/);
      assert.match((err as Error).message, /1\b/); // Position im Text
      return true;
    },
  );
});

test('Vorrat Personenname: nur der enge Zeichensatz ist zulässig', () => {
  for (const gut of ['Maier', "O'Brien", 'Müller-Groß', 'Anna Maria', 'St. Georgen', 'Meier2']) {
    assert.doesNotThrow(() => pruefeVorrat(gut, 'personenname', 'FANA'), gut);
  }
  for (const schlecht of ['Đorđević', 'Nowak,', 'Šimek', 'Renée', 'a/b']) {
    assert.throws(() => pruefeVorrat(schlecht, 'personenname', 'FANA'), EldaError, schlecht);
  }
});

test('Vorrat Unternehmen: Interpunktion erlaubt, ausgeschlossene Codepunkte nicht', () => {
  for (const gut of ['Muster & Co. KG', 'Straße 1/3', 'A-1010 Wien', 'Ärzte GmbH']) {
    assert.doesNotThrow(() => pruefeVorrat(gut, 'unternehmen', 'DGNA'), gut);
  }
  // 188..190 und 225 sind laut Zeichensatz-Dokument nicht Teil des Vorrats
  for (const schlecht of ['¼', '½', '¾', 'á']) {
    assert.throws(() => pruefeVorrat(schlecht, 'unternehmen', 'DGNA'), EldaError, schlecht);
  }
});

test('Vorrat frei: prüft nur die Darstellbarkeit', () => {
  assert.doesNotThrow(() => pruefeVorrat('á', 'frei', 'INF1'));
  assert.throws(() => pruefeVorrat('đ', 'frei', 'INF1'), EldaError);
});
