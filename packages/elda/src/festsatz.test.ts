import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueSatz, pruefeFeldtabelle, type Feld } from './festsatz';
import { EldaError } from './errors';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';

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

// ---------------------------------------------------------------------------
// Formatvorgabe numerischer Felder (Feld.format)
// ---------------------------------------------------------------------------

/**
 * Die dreizehn Datumsfelder der Versichertenmeldung. Die Feldtabelle in Kapitel E.29
 * (Seiten 299–301) druckt unter jedem von ihnen `TTMMJJJJ` ab.
 *
 * Nur fuenf davon — ADAT, RDAT, UMDA, RUMD und GEBD — haben im Pruefkatalog (Blatt VR)
 * ueberhaupt eine Formatzeile (F7061/F7066/F7104/F7106/F7030). Fuer die uebrigen acht
 * (BDAT, EBSV, KEAB, KEBI, UEAB, UEBI, BVAB, BVEN) fuehrt der Katalog keine einzige Zeile:
 * Ein dort falsch formatierter Wert faellt weder hier noch bei ELDA auf, sondern wird als
 * gueltiges — nur eben anderes — Datum uebermittelt. Deshalb greift die Formatpruefung an
 * der Serialisierung und damit fuer alle dreizehn gleich.
 */
const DATUMSFELDER_E29 = [
  'GEBD',
  'ADAT',
  'BDAT',
  'RDAT',
  'EBSV',
  'KEAB',
  'KEBI',
  'UEAB',
  'UEBI',
  'BVAB',
  'BVEN',
  'UMDA',
  'RUMD',
] as const;

/** Die acht Datumsfelder ohne jede Formatzeile im Pruefkatalog — sie tragen das volle Risiko. */
const DATUMSFELDER_OHNE_KATALOGREGEL = [
  'BDAT',
  'EBSV',
  'KEAB',
  'KEBI',
  'UEAB',
  'UEBI',
  'BVAB',
  'BVEN',
] as const;

const e29 = (werte: Record<string, string>) => baueSatz(FELDER_E29, werte, SATZLAENGE_E29);

/** Liest ein Feld ueber seine im Dokument abgedruckte Position aus einem E.29-Satz. */
const feldWert = (satz: Buffer, pos: number, laenge: number) =>
  satz.subarray(pos - 1, pos - 1 + laenge).toString('latin1');

test('C1: der 10.03.2026 ohne fuehrende Null wird abgewiesen, nicht zum 01.03.2026 aufgefuellt', () => {
  // Der demonstrierte Fall: Ein Aufrufer formatiert 10.03.2026 ohne fuehrende Null des
  // Monats. Frueher lieferte fuelle() daraus '01032026' — den 01.03.2026, neun Tage frueher,
  // ohne Fehler und ohne dass ELDA es beanstandet haette.
  assert.throws(
    () => e29({ BVAB: '1032026' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /BVAB/);
      assert.match((err as Error).message, /TTMMJJJJ/);
      return true;
    },
  );
  // Gegenprobe: derselbe Tag korrekt formatiert geht durch und steht unveraendert im Satz.
  assert.equal(feldWert(e29({ BVAB: '10032026' }), 603, 8), '10032026');
});

test('C1: jedes der acht Datumsfelder ohne Katalogregel weist ein unvollstaendiges Datum ab', () => {
  for (const feld of DATUMSFELDER_OHNE_KATALOGREGEL) {
    // Siebenstellig: aus '1032026' waere '01032026' geworden.
    assert.throws(() => e29({ [feld]: '1032026' }), EldaError, `${feld}: siebenstellig`);
    // Sechsstellig: aus '532026' (5.3.2026) waere '00532026' geworden — Tag 00, Monat 53.
    assert.throws(() => e29({ [feld]: '532026' }), EldaError, `${feld}: sechsstellig`);
  }
});

test('C1: die Formatpruefung gilt fuer alle dreizehn Datumsfelder, korrekte Werte bleiben unveraendert', () => {
  for (const feld of DATUMSFELDER_E29) {
    assert.throws(() => e29({ [feld]: '1122026' }), EldaError, `${feld}: siebenstellig`);
    // Ein korrekt formatiertes Datum passiert und wird nicht veraendert.
    const satz = e29({ [feld]: '01122026' });
    const eintrag = FELDER_E29.find((f) => f.name === feld)!;
    assert.equal(feldWert(satz, eintrag.pos, eintrag.laenge), '01122026', feld);
  }
});

test('C1: die Versicherungsnummer wird nicht auf zehn Stellen aufgefuellt', () => {
  // Die Feldtabelle druckt unter VSNR 'LLLPTTMMJJ' ab — jede Stelle traegt Bedeutung.
  // Eine neunstellige Eingabe wuerde mit einer fuehrenden Null zur Nummer eines anderen
  // Versicherten.
  assert.throws(
    () => e29({ VSNR: '123401018' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /VSNR/);
      assert.match((err as Error).message, /LLLPTTMMJJ/);
      return true;
    },
  );
  assert.equal(feldWert(e29({ VSNR: '1234010180' }), 315, 10), '1234010180');
});

test('C1/I6: die Formatmeldung nennt das Feld und die Stellenzahl, nie den Wert selbst', () => {
  // Geburtsdatum und Versicherungsnummer sind Personendaten; Fehlermeldungen landen in
  // Logs und Fehler-Trackern.
  for (const [feld, wert] of [
    ['GEBD', '1011990'],
    ['VSNR', '123401018'],
  ] as const) {
    assert.throws(
      () => e29({ [feld]: wert }),
      (err: unknown) => {
        const text = (err as Error).message;
        assert.ok(err instanceof EldaError);
        assert.match(text, new RegExp(feld));
        assert.ok(!text.includes(wert), `${feld}: der Wert steht in der Meldung — ${text}`);
        return true;
      },
    );
  }
});

test('I5: ein numerisches Feld aus lauter Nullen ist die Grundstellung, unabhaengig von der Stellenzahl', () => {
  // Fuer ein Feld mit Formatvorgabe darf die Grundstellung nicht an der Stellenzahl
  // scheitern: '0', '00000000' und '' bezeichnen alle denselben Inhalt.
  for (const wert of ['', '0', '00', '00000000']) {
    assert.equal(feldWert(e29({ BVAB: wert }), 603, 8), '00000000', JSON.stringify(wert));
  }
  for (const wert of ['', '0', '0000000000']) {
    assert.equal(feldWert(e29({ VSNR: wert }), 315, 10), '0000000000', JSON.stringify(wert));
  }
  // Ohne Formatvorgabe bleibt es beim Auffuellen mit fuehrenden Nullen (Kapitel E.1).
  assert.equal(feldWert(e29({ VWAZ: '156' }), 769, 4), '0156');
});

test('M8: numerische Werte werden getrimmt, statt als Ziffernfehler zu werfen', () => {
  // Ein aus einem Festsatz zurueckgelesener Wert kommt mit Fuellzeichen an. pruefeInhalt
  // trimmt ihn bereits — fuelle tat es nicht und warf dann beim Bau des Bestands.
  assert.equal(feldWert(e29({ VSNR: ' 1234010180 ' }), 315, 10), '1234010180');
  assert.equal(feldWert(e29({ BVAB: '  10032026' }), 603, 8), '10032026');
  assert.equal(baueSatz(FELDER, { SANR: ' 42 ' }, LAENGE).toString('latin1').slice(2, 7), '00042');
});

test('I6: der Ziffernfehler nennt ein einzelnes Zeichen mit Position, nicht den ganzen Wert', () => {
  assert.throws(
    () => e29({ VSNR: '12340101X0' }),
    (err: unknown) => {
      const text = (err as Error).message;
      assert.ok(err instanceof EldaError);
      assert.match(text, /VSNR/);
      assert.match(text, /'X'/);
      assert.match(text, /Position 9/);
      assert.ok(!text.includes('12340101X0'), `der Wert steht in der Meldung — ${text}`);
      return true;
    },
  );
});
