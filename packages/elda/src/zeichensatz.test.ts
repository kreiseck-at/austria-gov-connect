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

test('ISO-8859-15: NFD-Eingabe (zerlegter Umlaut) wird akzeptiert wie die vorkomponierte Form', () => {
  // 'u' (U+0075) + kombinierende Trema (U+0308) statt des vorkomponierten 'ü' (U+00FC) —
  // so liefern u. a. macOS-Dateisysteme Umlaute. Dieselbe Zeichenfolge, nur anders kodiert.
  const nfd = 'Müller';
  const nfc = 'Müller';
  assert.notEqual(nfd, nfc, 'Testvoraussetzung: nfd liegt tatsächlich zerlegt vor');
  assert.deepEqual(nachIso885915(nfd, 'FANA'), nachIso885915(nfc, 'FANA'));
  assert.doesNotThrow(() => pruefeVorrat(nfd, 'personenname', 'FANA'));
});

test('ISO-8859-15: leere Eingabe liefert einen leeren Buffer und wirft nicht', () => {
  assert.deepEqual(nachIso885915('', 'FANA'), Buffer.alloc(0));
  assert.doesNotThrow(() => pruefeVorrat('', 'personenname', 'FANA'));
  assert.doesNotThrow(() => pruefeVorrat('', 'unternehmen', 'DGNA'));
  assert.doesNotThrow(() => pruefeVorrat('', 'frei', 'INF1'));
});

test('ISO-8859-15: ein Zeichen außerhalb der BMP (Emoji) ist nicht darstellbar und wirft mit Feldnamen', () => {
  assert.throws(
    () => nachIso885915('😀', 'FANA'),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /FANA/);
      return true;
    },
  );
});

test('ISO-8859-15: ein Surrogatpaar zählt als EIN Zeichen, nicht als zwei', () => {
  // Das Emoji besteht aus zwei UTF-16-Code-Units (Surrogatpaar), aber aus genau einem
  // Codepoint. `[...text]` iteriert über Codepoints — die Fehlermeldung muss deshalb
  // Position 1 nennen und das vollständige Emoji zitieren. Eine künftige Implementierung,
  // die stattdessen über UTF-16-Code-Units iteriert (etwa `text.length`/`text[i]` statt
  // `[...text]`), würde nur die verwaiste halbe Surrogat-Codeeinheit zitieren — dieser
  // Test schlägt dann fehl, weil die Meldung das vollständige Emoji nicht mehr enthält.
  assert.throws(
    () => nachIso885915('😀', 'FANA'),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /😀/);
      assert.match((err as Error).message, /Position 1\b/);
      return true;
    },
  );
});
