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

// ---------------------------------------------------------------------------
// Die Grenzen der beiden Zeichenvorraete, Codepunkt fuer Codepunkt
// ---------------------------------------------------------------------------

/**
 * Die acht Positionen, an denen ISO-8859-15 von ISO-8859-1 abweicht — hier in der
 * Gegenrichtung (Codepunkt -> Zeichen), um zu jedem Bytewert das Zeichen zu bilden, das
 * ISO-8859-15 dort fuehrt.
 */
const ISO_8859_15_ABWEICHUNGEN: Readonly<Record<number, string>> = {
  0xa4: '€',
  0xa6: 'Š',
  0xa8: 'š',
  0xb4: 'Ž',
  0xb8: 'ž',
  0xbc: 'Œ',
  0xbd: 'œ',
  0xbe: 'Ÿ',
};

/** Das Zeichen, das ISO-8859-15 auf dem angegebenen Bytewert fuehrt. */
function zeichenFuer(code: number): string {
  return ISO_8859_15_ABWEICHUNGEN[code] ?? String.fromCharCode(code);
}

/**
 * Zeichenvorrat fuer Personennamen laut dem Zeichensatz-Dokument, Abschnitt ISO8859-15,
 * Tabelle „Personennamen (zulaessig lt. ZOV-Vorrat UNT_ISO)" — Zeile fuer Zeile abgeschrieben:
 * 32, 39, 45, 46, 48..57 (Ziffern), 65..90 (Grossbuchstaben), 97..122 (Kleinbuchstaben),
 * 196 (Ä), 214 (Ö), 220 (Ü), 223 (ß), 228 (ä), 246 (ö), 252 (ü). Mehr nicht — die Ziffern
 * stehen dort ausdruecklich, die Umlaute einzeln und ohne die uebrigen Akzentbuchstaben.
 */
const PERSONENNAME_ERWARTET: ReadonlySet<number> = new Set([
  32,
  39,
  45,
  46,
  ...Array.from({ length: 10 }, (_, i) => 48 + i),
  ...Array.from({ length: 26 }, (_, i) => 65 + i),
  ...Array.from({ length: 26 }, (_, i) => 97 + i),
  196,
  214,
  220,
  223,
  228,
  246,
  252,
]);

/**
 * Zeichenvorrat fuer Unternehmensnamen und Adressen laut derselben Quelle, Tabelle
 * „Unternehmensnamen, Adressen (zulaessig lt. ZOV-Vorrat UNT_ISO)". Die Tabelle listet dort
 * 32, 33..47, 48..57, 58..64, 65..90, 91..96, 97..122, 123..126 — zusammen also lueckenlos
 * 32..126 — sowie 160..187, 191..195, 196, 197..213, 214, 215..219, 220, 221, 222, 223, 224
 * (zusammen 160..187 und 191..224) und 226, 227, 228, 229..245, 246, 247..251, 252, 253..255
 * (zusammen 226..255).
 *
 * Ausgenommen sind damit 127..159 sowie 188, 189, 190 und 225: Die Aufzaehlung springt von
 * 187 auf 191 und von 224 auf 226. Das ist keine Auslassung dieser Abschrift, sondern steht
 * so im Dokument.
 */
const UNTERNEHMEN_ERWARTET: ReadonlySet<number> = new Set([
  ...Array.from({ length: 126 - 32 + 1 }, (_, i) => 32 + i),
  ...Array.from({ length: 187 - 160 + 1 }, (_, i) => 160 + i),
  ...Array.from({ length: 224 - 191 + 1 }, (_, i) => 191 + i),
  ...Array.from({ length: 255 - 226 + 1 }, (_, i) => 226 + i),
]);

test('Vorrat Personenname: jeder Codepunkt von 32 bis 255 steht einzeln fest', () => {
  // Haelt die Grenzen fest: Ein verschobener Bereich (etwa 97..121 statt 97..122) oder eine
  // versehentlich ergaenzte Position faellt hier auf und nicht erst bei ELDA.
  for (let code = 32; code <= 255; code++) {
    const z = zeichenFuer(code);
    if (PERSONENNAME_ERWARTET.has(code)) {
      assert.doesNotThrow(() => pruefeVorrat(z, 'personenname', 'FANA'), `${code} soll zulaessig sein`);
    } else {
      assert.throws(
        () => pruefeVorrat(z, 'personenname', 'FANA'),
        EldaError,
        `${code} ('${z}') soll unzulaessig sein`,
      );
    }
  }
});

test('Vorrat Unternehmen: jeder Codepunkt von 32 bis 255 steht einzeln fest', () => {
  for (let code = 32; code <= 255; code++) {
    const z = zeichenFuer(code);
    if (UNTERNEHMEN_ERWARTET.has(code)) {
      assert.doesNotThrow(() => pruefeVorrat(z, 'unternehmen', 'DGNA'), `${code} soll zulaessig sein`);
    } else {
      assert.throws(
        () => pruefeVorrat(z, 'unternehmen', 'DGNA'),
        EldaError,
        `${code} ('${z}') soll unzulaessig sein`,
      );
    }
  }
});

test('Vorrat: die Raender der Tabellen liegen genau dort, wo das Dokument sie zieht', () => {
  // Ausdrueckliche Gegenproben zu den vier Sprungstellen der Unternehmens-Tabelle …
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(126), 'unternehmen', 'DGNA'));
  assert.throws(() => pruefeVorrat(zeichenFuer(127), 'unternehmen', 'DGNA'), EldaError);
  assert.throws(() => pruefeVorrat(zeichenFuer(159), 'unternehmen', 'DGNA'), EldaError);
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(160), 'unternehmen', 'DGNA'));
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(187), 'unternehmen', 'DGNA'));
  for (const code of [188, 189, 190]) {
    assert.throws(() => pruefeVorrat(zeichenFuer(code), 'unternehmen', 'DGNA'), EldaError, `${code}`);
  }
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(191), 'unternehmen', 'DGNA'));
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(224), 'unternehmen', 'DGNA'));
  assert.throws(() => pruefeVorrat(zeichenFuer(225), 'unternehmen', 'DGNA'), EldaError);
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(226), 'unternehmen', 'DGNA'));
  assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(255), 'unternehmen', 'DGNA'));

  // … und zu denen der Personennamen-Tabelle.
  for (const code of [47, 58, 64, 91, 96, 123]) {
    assert.throws(() => pruefeVorrat(zeichenFuer(code), 'personenname', 'FANA'), EldaError, `${code}`);
  }
  for (const code of [48, 57, 65, 90, 97, 122]) {
    assert.doesNotThrow(() => pruefeVorrat(zeichenFuer(code), 'personenname', 'FANA'), `${code}`);
  }
});
