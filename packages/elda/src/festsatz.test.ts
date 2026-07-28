import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueSatz, pruefeFeldtabelle, type Feld } from './festsatz';
import { EldaError } from './errors';

const FELDER: readonly Feld[] = [
  { nr: 1, name: 'SART', pos: 1, laenge: 2, typ: 'a/n' },
  { nr: 2, name: 'SANR', pos: 3, laenge: 5, typ: 'n' },
  { nr: 3, name: 'NAME', pos: 8, laenge: 6, typ: 'a', klasse: 'personenname' },
];
const LAENGE = 13;

test('a/n und a: linksbündig, mit Blanks aufgefüllt', () => {
  const satz = baueSatz(FELDER, { SART: 'M3', SANR: '7', NAME: 'Maier' }, LAENGE);
  assert.equal(satz.toString('latin1'), 'M300007Maier ');
});

test('n: rechtsbündig mit führenden Nullen, Grundstellung ist 0', () => {
  const satz = baueSatz(FELDER, { SART: 'M3', NAME: 'Ott' }, LAENGE);
  assert.equal(satz.toString('latin1'), 'M300000Ott   ');
});

test('a/n: Grundstellung ist blank', () => {
  const satz = baueSatz(FELDER, { SANR: '1' }, LAENGE);
  assert.equal(satz.toString('latin1').slice(0, 2), '  ');
});

test('zu langer Wert wirft, statt abzuschneiden', () => {
  assert.throws(
    () => baueSatz(FELDER, { NAME: 'Mustermann' }, LAENGE),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /NAME/);
      assert.match((err as Error).message, /6/);
      return true;
    },
  );
});

test('unbekannter Feldname wirft, statt ignoriert zu werden', () => {
  assert.throws(() => baueSatz(FELDER, { GIBTESNICHT: 'x' }, LAENGE), EldaError);
});

test('numerisches Feld akzeptiert nur Ziffern', () => {
  assert.throws(() => baueSatz(FELDER, { SANR: '12a' }, LAENGE), EldaError);
});

test('Feldklasse wird durchgereicht: unzulässiges Zeichen im Personennamen wirft', () => {
  assert.throws(() => baueSatz(FELDER, { NAME: 'Šimek' }, LAENGE), EldaError);
});

test('das Ergebnis ist ISO-8859-15-kodiert und genau satzlang', () => {
  const satz = baueSatz(FELDER, { SART: 'M3', NAME: 'Groß' }, LAENGE);
  assert.equal(satz.length, LAENGE);
  assert.equal(satz[10], 0xdf); // ß an Position 11
});

test('pruefeFeldtabelle: lückenlos, überschneidungsfrei, Summe ergibt die Satzlänge', () => {
  assert.doesNotThrow(() => pruefeFeldtabelle(FELDER, LAENGE));
  assert.throws(() => pruefeFeldtabelle(FELDER, LAENGE + 1), EldaError);
  const luecke: Feld[] = [
    { nr: 1, name: 'A', pos: 1, laenge: 2, typ: 'a/n' },
    { nr: 2, name: 'B', pos: 4, laenge: 2, typ: 'a/n' },
  ];
  assert.throws(() => pruefeFeldtabelle(luecke, 5), EldaError);
});

test('baueSatz prüft die Feldtabelle bei jedem Aufruf, nicht nur einmalig', () => {
  const luecke: Feld[] = [
    { nr: 1, name: 'A', pos: 1, laenge: 2, typ: 'a/n' },
    { nr: 2, name: 'B', pos: 4, laenge: 2, typ: 'a/n' },
  ];
  assert.throws(() => baueSatz(luecke, { A: 'x' }, 5), EldaError);
});

// Zerlegte und vorkomponierte Fassung von 'ü': Grundbuchstabe 'u' (U+0075)
// gefolgt vom kombinierenden Trema (U+0308) stellt dieselbe Zeichenfolge dar
// wie das vorkomponierte 'ü' (U+00FC), hat aber zwei code units statt einer.
// Genau die Form, die z. B. das macOS-Dateisystem liefert (siehe
// zeichensatz.test.ts). Bewusst über \u-Escapes gebaut, damit keine
// Editor- oder Tool-Normalisierung die beiden Fassungen unbemerkt angleicht.
const UE_ZERLEGT = 'u\u0308';
const UE_VORKOMPONIERT = '\u00fc';

test('Zerlegungsform: NFC-Fassung passt genau ins Feld und liefert dieselben Bytes wie die vorkomponierte Fassung', () => {
  // 'M' + zerlegtes 'ü' + 'ller' ist 7 code units lang, aber nach
  // NFC-Normalisierung 6 Zeichen (M-ü-l-l-e-r) — genau die Feldlänge von NAME.
  const zerlegt = baueSatz(FELDER, { SART: 'M3', NAME: `M${UE_ZERLEGT}ller` }, LAENGE);
  const vorkomponiert = baueSatz(FELDER, { SART: 'M3', NAME: `M${UE_VORKOMPONIERT}ller` }, LAENGE);
  assert.deepEqual(zerlegt, vorkomponiert);
});

test('Zerlegungsform: auch nach Normalisierung zu langer Wert wirft, Meldung nennt die normalisierte Länge', () => {
  // 'M' + zerlegtes 'ü' + 'llerin' ist 9 code units lang, nach
  // NFC-Normalisierung 8 Zeichen (M-ü-l-l-e-r-i-n) — immer noch zu lang für
  // das 6 Zeichen lange Feld NAME. Die Meldung muss die NORMALISIERTE Länge
  // (8) nennen, nicht die Länge der Zerlegungsform (9).
  assert.throws(
    () => baueSatz(FELDER, { SART: 'M3', NAME: `M${UE_ZERLEGT}llerin` }, LAENGE),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /NAME/);
      assert.match((err as Error).message, /8/);
      return true;
    },
  );
});

test('Zerlegungsform: Satz ist exakt satzlang, Folgefeld beginnt an seiner dokumentierten Position', () => {
  const felderMitFolgefeld: readonly Feld[] = [
    { nr: 1, name: 'NAME', pos: 1, laenge: 6, typ: 'a', klasse: 'personenname' },
    { nr: 2, name: 'FLAG', pos: 7, laenge: 1, typ: 'a/n' },
  ];
  const satz = baueSatz(felderMitFolgefeld, { NAME: `M${UE_ZERLEGT}ller`, FLAG: 'X' }, 7);
  assert.equal(satz.length, 7);
  assert.equal(satz.toString('latin1'), `M${UE_VORKOMPONIERT}llerX`);
});
