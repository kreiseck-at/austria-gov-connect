# @kreiseck/elda v2 — Versichertenmeldung reduziert (E.29) Implementation Plan

> **Umsetzung:** Task für Task, test-first. Jeder Task beginnt mit einem
> fehlschlagenden Test und endet mit grüner Suite und einem Commit. Schritte sind
> als Checkbox (`- [ ]`) geführt.

**Goal:** `@kreiseck/elda` erzeugt Versichertenmeldungen als Festsatz-Datenbestand
— An-, Ab-, Änderungsmeldung, Richtigstellung und Storno — der unverändert in das
bestehende `senden` aus v1 geht.

**Architecture:** Von unten nach oben: ein Zeichensatz-Modul (ISO-8859-15 plus
Zeichenvorräte), darüber eine generische Festsatz-Serialisierung, darüber die
reinen Datenabbilder der Dokumentkapitel (Feldtabelle, Pflichtmatrix,
Prüfregeln), darüber die sieben Satzart-Builder und der Bestandsumschlag. Die
unteren beiden Schichten sind meldungsunabhängig und für spätere Stufen (mBGM,
VSNR-Anforderung) wiederverwendbar.

**Tech Stack:** Node ≥20.18, TypeScript (CJS via `tsc`), `node:test`,
`@kreiseck/finanzonline-core`. Keine weiteren Laufzeitabhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-07-29-elda-versichertenmeldung-design.md`

## Quellen — im Workspace hinterlegt

Die maßgeblichen Auszüge liegen unter
`.superpowers/sdd/2026-07-29-elda-versichertenmeldung/quellen/`:

| Datei | Inhalt |
|---|---|
| `dm-org-42.7.0.pdf` | Vollständige Organisationsbeschreibung, 623 Seiten (Version 42.7.0, 07/2026) |
| `e29-feldtabelle.txt` | Kapitel E.29, Seiten 300–302: die 39 Felder |
| `e29-pflichtmatrix-teil1.txt` | Kapitel E.29.1, Seite 303: Felder 2–34 |
| `e29-pflichtmatrix-teil2.txt` | Kapitel E.29.1, Seite 304: Felder 35–39 + Legende |
| `e29-erstellvorschriften.txt` | Kapitel E.29.2, Seiten 305–336: Regeln und 26 Beispiele |
| `zeichensaetze.txt` | Zeichensatz-Dokument, zulässiger Vorrat je Feldklasse |
| `vorlauf-schlusssatz.txt` | Kapitel E.2 und E.3 |

Bei jedem Zweifel gilt das PDF, nicht der Textauszug: `pdftotext` kann Zeilen
verschlucken. Wo unten „gegen die Quelle prüfen" steht, ist genau das gemeint.

## Global Constraints

- **Nichts raten.** Jede Feldposition, Länge, Pflichtstufe und jeder Zeichenvorrat
  stammt belegbar aus den Quellen oben. Eine Regel, die nur in Prosa ohne
  durchgerechnetes Beispiel steht, wird NICHT kodiert.
- **Kein stiller Datenverlust.** Ein nicht darstellbares Zeichen, ein zu langer
  Wert oder ein fehlendes Pflichtfeld wirft. Niemals abschneiden, ersetzen oder
  stillschweigend auffüllen.
- **Keine neuen Laufzeitabhängigkeiten.** Nur `@kreiseck/finanzonline-core` und
  Node-Builtins.
- **Kein bestehender Test wird abgeschwächt oder gelöscht.** Aktuell 84 Tests.
- Doku, Kommentare und Commit-Nachrichten auf Deutsch, im Stil der Nachbarpakete.
- **Committete Artefakte sind ununterscheidbar von handgeschriebener Arbeit** —
  Code, Kommentare, Doku, Dateinamen und Commit-Nachrichten. Keine
  `Co-Authored-By`-Trailer.
- Alle Kommandos ab Repo-Root. Node 22 voranstellen:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`
- Testkommando: `npm test -w @kreiseck/elda`. Bei unplausibler Testanzahl vorher
  `rm -rf packages/elda/test-dist packages/elda/dist` (beide gitignored, niemals
  committen). Vor jedem Commit zusätzlich `npm run build -w @kreiseck/elda`,
  `npm run format:check` und `npx eslint packages/elda/src`.

## Dateistruktur nach Abschluss

| Datei | Verantwortung |
|---|---|
| `src/zeichensatz.ts` | ISO-8859-15-Kodierung, Zeichenvorrat je Feldklasse |
| `src/festsatz.ts` | Generische Satz-Serialisierung aus Feldtabelle und Werten |
| `src/felder-e29.ts` | Die 39 Felder aus E.29 als Daten |
| `src/pflicht-e29.ts` | Die Pflichtmatrix aus E.29.1 als Daten |
| `src/pruefung-e29.ts` | Die abbildbaren Regeln aus dem Prüfkatalog, Blatt `VR` |
| `src/bestand.ts` | Vorlaufsatz, Satznummerierung, Schlusssatz |
| `src/versichertenmeldung.ts` | Die sieben Satzart-Builder |
| `src/index.ts` | Barrel, erweitert |

---

### Task 1: Zeichensatz

**Files:**
- Create: `packages/elda/src/zeichensatz.ts`
- Create: `packages/elda/src/zeichensatz.test.ts`

**Interfaces:**
- Consumes: `EldaError` aus `./errors`.
- Produces:
  - `type Feldklasse = 'personenname' | 'unternehmen' | 'frei'`
  - `function pruefeVorrat(text: string, klasse: Feldklasse, feld: string): void`
  - `function nachIso885915(text: string, feld: string): Buffer`

- [ ] **Step 1: Quelle gegenprüfen**

Öffne `quellen/zeichensaetze.txt` (bei Zweifel die PDF-Fassung
`https://www.elda.at/cdscontent/load?contentid=10008.726038`) und prüfe die
Tabelle **ISO8859-15** — nicht die CP850-Tabelle darüber. Zwei Stellen sind
überraschend und müssen ausdrücklich bestätigt werden, bevor du sie kodierst:

1. Im Vorrat „Unternehmensnamen, Adressen" fehlen die Codepunkte **188, 189, 190**
   (die Bereiche springen von `160..187` auf `191..195`).
2. Im selben Vorrat fehlt **225** (die Aufzählung nennt `224`, dann `226`).

Halte im Commit-Text fest, dass du beides gegen die Quelle bestätigt hast. Weicht
die Quelle ab, gilt sie — passe die Konstanten an und vermerke es.

- [ ] **Step 2: Failing test**

`packages/elda/src/zeichensatz.test.ts`:
```ts
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
  for (const [zeichen, byte] of [['Š', 0xa6], ['š', 0xa8], ['Ž', 0xb4], ['ž', 0xb8], ['Œ', 0xbc], ['œ', 0xbd], ['Ÿ', 0xbe]] as const) {
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
```

- [ ] **Step 3: Run → FAIL**

Run: `npm test -w @kreiseck/elda`
Expected: FAIL — `./zeichensatz` existiert nicht.

- [ ] **Step 4: Implementieren**

`packages/elda/src/zeichensatz.ts`:
```ts
import { EldaError } from './errors';

/**
 * Feldklasse im Sinne des ELDA-Zeichensatz-Dokuments. ELDA schränkt den
 * zulässigen Zeichenvorrat je nach Art des Feldes ein — für Personennamen
 * deutlich enger als für Unternehmensnamen und Adressen.
 */
export type Feldklasse = 'personenname' | 'unternehmen' | 'frei';

/**
 * Die acht Codepunkte, an denen ISO-8859-15 von ISO-8859-1 abweicht.
 * Node kennt nur `latin1` (= ISO-8859-1), deshalb diese Tabelle darüber.
 */
const ABWEICHUNGEN: ReadonlyMap<string, number> = new Map([
  ['€', 0xa4],
  ['Š', 0xa6],
  ['š', 0xa8],
  ['Ž', 0xb4],
  ['ž', 0xb8],
  ['Œ', 0xbc],
  ['œ', 0xbd],
  ['Ÿ', 0xbe],
]);

/** Zeichen, die ISO-8859-1 an denselben Positionen führt und die es in ISO-8859-15 daher nicht gibt. */
const NUR_ISO_8859_1: ReadonlySet<string> = new Set(['¤', '¦', '¨', '´', '¸', '¼', '½', '¾']);

function bereich(von: number, bis: number): number[] {
  const werte: number[] = [];
  for (let i = von; i <= bis; i++) werte.push(i);
  return werte;
}

/**
 * Zulässiger Zeichenvorrat für Personennamen laut Zeichensatz-Dokument
 * (ZOV-Vorrat UNT_ISO): Leerzeichen, Apostroph, Bindestrich, Punkt, Ziffern,
 * Groß- und Kleinbuchstaben sowie Ä Ö Ü ß ä ö ü. Mehr nicht — ein Name mit
 * anderen diakritischen Zeichen ist über ELDA nicht übermittelbar.
 */
const VORRAT_PERSONENNAME: ReadonlySet<number> = new Set([
  0x20, 0x27, 0x2d, 0x2e,
  ...bereich(48, 57),
  ...bereich(65, 90),
  ...bereich(97, 122),
  196, 214, 220, 223, 228, 246, 252,
]);

/**
 * Zulässiger Zeichenvorrat für Unternehmensnamen und Adressen laut
 * Zeichensatz-Dokument. Deutlich weiter als bei Personennamen, aber nicht der
 * volle Zeichensatz: 188–190 und 225 sind ausgenommen.
 */
const VORRAT_UNTERNEHMEN: ReadonlySet<number> = new Set([
  ...bereich(32, 126),
  ...bereich(160, 187),
  ...bereich(191, 224),
  ...bereich(226, 255),
]);

function vorratFuer(klasse: Feldklasse): ReadonlySet<number> | undefined {
  if (klasse === 'personenname') return VORRAT_PERSONENNAME;
  if (klasse === 'unternehmen') return VORRAT_UNTERNEHMEN;
  return undefined;
}

/** Codepunkt eines Zeichens in ISO-8859-15, oder `undefined`, wenn nicht darstellbar. */
function codepunkt(zeichen: string): number | undefined {
  const abweichung = ABWEICHUNGEN.get(zeichen);
  if (abweichung !== undefined) return abweichung;
  if (NUR_ISO_8859_1.has(zeichen)) return undefined;
  const code = zeichen.codePointAt(0);
  return code !== undefined && code <= 0xff ? code : undefined;
}

/**
 * Prüft, ob jedes Zeichen im zulässigen Vorrat der Feldklasse liegt. Wirft mit
 * Feldname, Zeichen und Position, statt still zu ersetzen: Wie ein Name zu
 * schreiben ist, wenn der Vorrat ihn nicht hergibt, ist eine fachliche
 * Entscheidung des Dienstgebers, keine Ersetzungstabelle im Code.
 */
export function pruefeVorrat(text: string, klasse: Feldklasse, feld: string): void {
  const vorrat = vorratFuer(klasse);
  const zeichen = [...text];
  for (let i = 0; i < zeichen.length; i++) {
    const z = zeichen[i]!;
    const code = codepunkt(z);
    if (code === undefined) {
      throw new EldaError(
        `Feld ${feld}: Zeichen '${z}' an Position ${i + 1} ist in ISO-8859-15 nicht darstellbar. ` +
          'ELDA erwartet Fixlängen-Dateien in ISO-8859-15; eine Ersatzschreibweise ist fachlich zu wählen.',
      );
    }
    if (vorrat && !vorrat.has(code)) {
      throw new EldaError(
        `Feld ${feld}: Zeichen '${z}' an Position ${i + 1} gehört nicht zum zulässigen Zeichenvorrat ` +
          `für ${klasse === 'personenname' ? 'Personennamen' : 'Unternehmensnamen und Adressen'}.`,
      );
    }
  }
}

/**
 * Kodiert Text nach ISO-8859-15. Nicht darstellbare Zeichen werfen — es wird
 * nichts ersetzt und nichts weggelassen.
 */
export function nachIso885915(text: string, feld: string): Buffer {
  const zeichen = [...text];
  const bytes = Buffer.alloc(zeichen.length);
  for (let i = 0; i < zeichen.length; i++) {
    const z = zeichen[i]!;
    const code = codepunkt(z);
    if (code === undefined) {
      throw new EldaError(
        `Feld ${feld}: Zeichen '${z}' an Position ${i + 1} ist in ISO-8859-15 nicht darstellbar.`,
      );
    }
    bytes[i] = code;
  }
  return bytes;
}
```

Hinweis zur Länge: Ein Zeichen ergibt genau ein Byte, weil jeder zulässige
Codepunkt ≤ 0xFF ist. Deshalb darf `Buffer.alloc(zeichen.length)` verwendet
werden — die Satzpositionen bleiben stimmig.

- [ ] **Step 5: Run → PASS**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 6: Prüfen und committen**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/zeichensatz.ts packages/elda/src/zeichensatz.test.ts
git commit -m "feat(elda): ISO-8859-15-Kodierung und Zeichenvorrat je Feldklasse"
```

---

### Task 2: Festsatz-Serialisierung

**Files:**
- Create: `packages/elda/src/festsatz.ts`
- Create: `packages/elda/src/festsatz.test.ts`

**Interfaces:**
- Consumes: `pruefeVorrat`/`nachIso885915`/`Feldklasse` aus `./zeichensatz`,
  `EldaError` aus `./errors`.
- Produces:
  - `type Feldtyp = 'a/n' | 'a' | 'n'`
  - `interface Feld { nr: number; name: string; pos: number; laenge: number; typ: Feldtyp; klasse?: Feldklasse }`
  - `type Werte = Readonly<Record<string, string | undefined>>`
  - `function pruefeFeldtabelle(felder: readonly Feld[], satzlaenge: number): void`
  - `function baueSatz(felder: readonly Feld[], werte: Werte, satzlaenge: number): Buffer`

- [ ] **Step 1: Failing test**

`packages/elda/src/festsatz.test.ts`:
```ts
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
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 3: Implementieren**

`packages/elda/src/festsatz.ts`:
```ts
import { EldaError } from './errors';
import { nachIso885915, pruefeVorrat, type Feldklasse } from './zeichensatz';

/**
 * Feldtyp laut Kapitel E.1 der Organisationsbeschreibung:
 * - `a/n` alphanumerisch: linksbündig, Grundstellung blank
 * - `a`   alphabetisch: dieselbe Ausrichtung, engerer Zeichenvorrat
 * - `n`   numerisch: rechtsbündig, Grundstellung 0, führende Nullen,
 *         keine Interpunktion — auch kein Dezimalkomma
 */
export type Feldtyp = 'a/n' | 'a' | 'n';

/** Ein Feld einer Satzart: Position und Länge stammen aus der Feldtabelle des jeweiligen Kapitels. */
export interface Feld {
  /** Feldnummer laut Dokument, dient der Rückverfolgbarkeit. */
  nr: number;
  /** Kurzname laut Dokument, z. B. `BKNR`. Zugleich Schlüssel im Werte-Objekt. */
  name: string;
  /** Startposition im Satz, 1-basiert wie im Dokument. */
  pos: number;
  /** Feldlänge in Zeichen. */
  laenge: number;
  typ: Feldtyp;
  /** Zeichenvorrat-Klasse; ohne Angabe wird nur auf Darstellbarkeit geprüft. */
  klasse?: Feldklasse;
}

/** Werte je Feldname. Ein fehlender oder `undefined`-Wert bedeutet Grundstellung. */
export type Werte = Readonly<Record<string, string | undefined>>;

/**
 * Prüft eine Feldtabelle gegen sich selbst: lückenlos ab Position 1, ohne
 * Überschneidung, und endend auf der angegebenen Satzlänge. Damit fällt ein
 * Übertragungsfehler aus dem Dokument auf, bevor er Sätze verfälscht.
 */
export function pruefeFeldtabelle(felder: readonly Feld[], satzlaenge: number): void {
  let erwartet = 1;
  for (const f of felder) {
    if (f.pos !== erwartet) {
      throw new EldaError(
        `Feldtabelle: Feld ${f.name} (Nr. ${f.nr}) beginnt auf Position ${f.pos}, erwartet war ${erwartet}.`,
      );
    }
    if (f.laenge < 1) {
      throw new EldaError(`Feldtabelle: Feld ${f.name} hat eine Länge von ${f.laenge}.`);
    }
    erwartet += f.laenge;
  }
  if (erwartet - 1 !== satzlaenge) {
    throw new EldaError(
      `Feldtabelle endet auf Position ${erwartet - 1}, die Satzlänge ist aber ${satzlaenge}.`,
    );
  }
}

function fuelle(wert: string | undefined, feld: Feld): string {
  const roh = wert ?? '';
  if (roh.length > feld.laenge) {
    throw new EldaError(
      `Feld ${feld.name}: Wert ist ${roh.length} Zeichen lang, zulässig sind ${feld.laenge}. ` +
        'Der Wert wird nicht abgeschnitten — er ist fachlich zu kürzen.',
    );
  }
  if (feld.typ === 'n') {
    if (roh !== '' && !/^\d+$/.test(roh)) {
      throw new EldaError(
        `Feld ${feld.name}: numerisches Feld enthält '${roh}'. Zulässig sind ausschließlich Ziffern ` +
          '(keine Vorzeichen, keine Interpunktion, kein Dezimalkomma).',
      );
    }
    return roh.padStart(feld.laenge, '0');
  }
  pruefeVorrat(roh, feld.klasse ?? 'frei', feld.name);
  return roh.padEnd(feld.laenge, ' ');
}

/**
 * Baut einen Satz aus Feldtabelle und Werten. Das Ergebnis ist genau
 * `satzlaenge` Bytes lang und in ISO-8859-15 kodiert — der von ELDA für
 * Fixlängen-Dateien vorgeschriebene Zeichensatz.
 */
export function baueSatz(felder: readonly Feld[], werte: Werte, satzlaenge: number): Buffer {
  const bekannt = new Set(felder.map((f) => f.name));
  for (const name of Object.keys(werte)) {
    if (!bekannt.has(name)) {
      throw new EldaError(`Unbekanntes Feld '${name}' — es gehört nicht zu dieser Satzart.`);
    }
  }
  pruefeFeldtabelle(felder, satzlaenge);
  const teile = felder.map((f) => nachIso885915(fuelle(werte[f.name], f), f.name));
  const satz = Buffer.concat(teile);
  if (satz.length !== satzlaenge) {
    throw new EldaError(`Satz ist ${satz.length} Bytes lang, erwartet waren ${satzlaenge}.`);
  }
  return satz;
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/festsatz.ts packages/elda/src/festsatz.test.ts
git commit -m "feat(elda): generische Festsatz-Serialisierung"
```

---

### Task 3: Feldtabelle E.29

**Files:**
- Create: `packages/elda/src/felder-e29.ts`
- Create: `packages/elda/src/felder-e29.test.ts`

**Interfaces:**
- Consumes: `Feld`/`pruefeFeldtabelle` aus `./festsatz`.
- Produces: `FELDER_E29: readonly Feld[]`, `SATZLAENGE_E29 = 772`,
  `IDENTIFIKATIONSTEIL: readonly Feld[]`, `LAENGE_IDENTIFIKATIONSTEIL = 20`.

Die Werte stammen aus `quellen/e29-feldtabelle.txt` (Kapitel E.29, Seiten
300–302) und `quellen/vorlauf-schlusssatz.txt` (Kapitel E.1). Feld 1 ist der
Identifikationsteil; er wird hier als ein Feld der Länge 20 geführt und in
Task 6 eigenständig gebaut.

- [ ] **Step 1: Failing test**

`packages/elda/src/felder-e29.test.ts`:
```ts
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
  assert.deepEqual(IDENTIFIKATIONSTEIL.map((f) => f.name), ['SART', 'SANR', 'UVST', 'OBUS', 'VSTR']);
});

test('Feldnummern sind lückenlos 1..39', () => {
  assert.deepEqual(
    FELDER_E29.map((f) => f.nr),
    Array.from({ length: 39 }, (_, i) => i + 1),
  );
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementieren**

`packages/elda/src/felder-e29.ts`:
```ts
import type { Feld } from './festsatz';

/** Länge des Identifikationsteils laut Kapitel E.1 — in allen Satzarten gleich. */
export const LAENGE_IDENTIFIKATIONSTEIL = 20;

/**
 * Identifikationsteil laut Kapitel E.1. Jeder Satz — Vorlaufsatz, Meldungssatz
 * und Schlusssatz — beginnt mit diesen 20 Zeichen. Alle Angaben sind zwingend.
 */
export const IDENTIFIKATIONSTEIL: readonly Feld[] = [
  { nr: 1, name: 'SART', pos: 1, laenge: 2, typ: 'a/n' },
  { nr: 2, name: 'SANR', pos: 3, laenge: 7, typ: 'n' },
  { nr: 3, name: 'UVST', pos: 10, laenge: 2, typ: 'a/n' },
  { nr: 4, name: 'OBUS', pos: 12, laenge: 7, typ: 'n' },
  { nr: 5, name: 'VSTR', pos: 19, laenge: 2, typ: 'a/n' },
];

/** Satzlänge der Versichertenmeldung reduziert (Kapitel E.29). */
export const SATZLAENGE_E29 = 772;

/**
 * Die 39 Felder der Versichertenmeldung reduziert, Kapitel E.29 der
 * Organisationsbeschreibung (Version 42.7.0, Satzstruktur-Version 03, zwingend
 * ab 01.02.2026). Reines Datenabbild — Position, Länge und Typ stehen so im
 * Dokument.
 */
export const FELDER_E29: readonly Feld[] = [
  { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
  { nr: 2, name: 'REFW', pos: 21, laenge: 40, typ: 'a/n' },
  { nr: 3, name: 'REFU', pos: 61, laenge: 40, typ: 'a/n' },
  { nr: 4, name: 'BKNR', pos: 101, laenge: 10, typ: 'a/n' },
  { nr: 5, name: 'DGNA', pos: 111, laenge: 70, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 6, name: 'DTEL', pos: 181, laenge: 50, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 7, name: 'MAIL', pos: 231, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 8, name: 'INF1', pos: 291, laenge: 12, typ: 'a/n' },
  { nr: 9, name: 'INF2', pos: 303, laenge: 12, typ: 'a/n' },
  { nr: 10, name: 'VSNR', pos: 315, laenge: 10, typ: 'n' },
  { nr: 11, name: 'GEBD', pos: 325, laenge: 8, typ: 'n' },
  { nr: 12, name: 'REFV', pos: 333, laenge: 40, typ: 'a/n' },
  { nr: 13, name: 'FANA', pos: 373, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 14, name: 'VONA', pos: 443, laenge: 70, typ: 'a', klasse: 'personenname' },
  { nr: 15, name: 'ADAT', pos: 513, laenge: 8, typ: 'n' },
  { nr: 16, name: 'BDAT', pos: 521, laenge: 8, typ: 'n' },
  { nr: 17, name: 'RDAT', pos: 529, laenge: 8, typ: 'n' },
  { nr: 18, name: 'BBER', pos: 537, laenge: 2, typ: 'a/n' },
  { nr: 19, name: 'GERF', pos: 539, laenge: 1, typ: 'a/n' },
  { nr: 20, name: 'FRDV', pos: 540, laenge: 1, typ: 'a/n' },
  { nr: 21, name: 'EBSV', pos: 541, laenge: 8, typ: 'n' },
  { nr: 22, name: 'AGRD', pos: 549, laenge: 2, typ: 'a/n' },
  { nr: 23, name: 'SAGR', pos: 551, laenge: 20, typ: 'a/n', klasse: 'unternehmen' },
  { nr: 24, name: 'KEAB', pos: 571, laenge: 8, typ: 'n' },
  { nr: 25, name: 'KEBI', pos: 579, laenge: 8, typ: 'n' },
  { nr: 26, name: 'UEAB', pos: 587, laenge: 8, typ: 'n' },
  { nr: 27, name: 'UEBI', pos: 595, laenge: 8, typ: 'n' },
  { nr: 28, name: 'BVAB', pos: 603, laenge: 8, typ: 'n' },
  { nr: 29, name: 'BVEN', pos: 611, laenge: 8, typ: 'n' },
  { nr: 30, name: 'BVJN', pos: 619, laenge: 1, typ: 'a/n' },
  { nr: 31, name: 'UMDA', pos: 620, laenge: 8, typ: 'n' },
  { nr: 32, name: 'RUMD', pos: 628, laenge: 8, typ: 'n' },
  { nr: 33, name: 'SOUM', pos: 636, laenge: 1, typ: 'a/n' },
  { nr: 34, name: 'ZTUM', pos: 637, laenge: 2, typ: 'a/n' },
  { nr: 35, name: 'ZKUM', pos: 639, laenge: 10, typ: 'a/n' },
  { nr: 36, name: 'RWUM', pos: 649, laenge: 40, typ: 'a/n' },
  { nr: 37, name: 'RUUM', pos: 689, laenge: 40, typ: 'a/n' },
  { nr: 38, name: 'BKUM', pos: 729, laenge: 40, typ: 'a/n' },
  { nr: 39, name: 'VWAZ', pos: 769, laenge: 4, typ: 'n' },
];
```

Die Zuordnung der Feldklassen ist eine Auslegung des Zeichensatz-Dokuments und
im Code als solche zu kommentieren: `FANA`/`VONA` sind Personennamen,
`DGNA`/`DTEL`/`MAIL`/`SAGR` fallen unter Unternehmensnamen und Adressen, alle
übrigen alphanumerischen Felder tragen keine Klasse und werden nur auf
Darstellbarkeit geprüft.

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/felder-e29.ts packages/elda/src/felder-e29.test.ts
git commit -m "feat(elda): Feldtabelle der Versichertenmeldung reduziert (E.29)"
```

---

### Task 4: Pflichtmatrix E.29.1

**Files:**
- Create: `packages/elda/src/pflicht-e29.ts`
- Create: `packages/elda/src/pflicht-e29.test.ts`

**Interfaces:**
- Consumes: `FELDER_E29` aus `./felder-e29`, `EldaError` aus `./errors`.
- Produces:
  - `type Satzart = 'M3' | 'M4' | 'M6' | 'M8' | 'M9' | 'S3' | 'S4'`
  - `type Pflichtstufe = 'Z' | 'Z1' | 'Z3' | 'V' | '-'`
  - `PFLICHT_E29: Readonly<Record<Satzart, Readonly<Record<string, Pflichtstufe>>>>`
  - `function pruefePflicht(satzart: Satzart, werte: Readonly<Record<string, string | undefined>>): void`

Die Matrix steht in `quellen/e29-pflichtmatrix-teil1.txt` (Felder 2–34) und
`quellen/e29-pflichtmatrix-teil2.txt` (Felder 35–39 samt Legende).

- [ ] **Step 1: Failing test**

`packages/elda/src/pflicht-e29.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PFLICHT_E29, pruefePflicht, type Satzart } from './pflicht-e29';
import { FELDER_E29 } from './felder-e29';
import { EldaError } from './errors';

const SATZARTEN: Satzart[] = ['M3', 'M4', 'M6', 'M8', 'M9', 'S3', 'S4'];

test('jede Satzart deckt jedes Feld ab (außer dem Identifikationsteil)', () => {
  const felder = FELDER_E29.filter((f) => f.name !== 'IDTEIL').map((f) => f.name);
  for (const sa of SATZARTEN) {
    for (const name of felder) {
      assert.ok(PFLICHT_E29[sa][name], `${sa}/${name} fehlt in der Matrix`);
    }
  }
});

test('Stichproben gegen das Dokument', () => {
  assert.equal(PFLICHT_E29.M3.REFW, 'Z');
  assert.equal(PFLICHT_E29.M3.REFU, '-');
  assert.equal(PFLICHT_E29.M8.REFU, 'Z');
  assert.equal(PFLICHT_E29.M3.BBER, 'Z');
  assert.equal(PFLICHT_E29.M4.BBER, '-');
  assert.equal(PFLICHT_E29.M6.GERF, 'V');
  assert.equal(PFLICHT_E29.M3.VWAZ, 'Z1');
  assert.equal(PFLICHT_E29.M8.VWAZ, 'Z1');
  assert.equal(PFLICHT_E29.M4.VWAZ, '-');
  assert.equal(PFLICHT_E29.S4.RWUM, 'Z1');
});

test('fehlendes Z-Feld wirft und nennt Satzart und Feld', () => {
  assert.throws(
    () => pruefePflicht('M3', { REFW: '', BKNR: '1234567', DGNA: 'Muster' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /M3/);
      assert.match((err as Error).message, /REFW/);
      return true;
    },
  );
});

test('belegtes Feld in Grundstellung wirft', () => {
  assert.throws(() => pruefePflicht('M3', vollstaendigM3({ REFU: 'X' })), EldaError);
});

test('Z1, Z3 und V werden nicht erzwungen', () => {
  assert.doesNotThrow(() => pruefePflicht('M3', vollstaendigM3({})));
  assert.doesNotThrow(() => pruefePflicht('M6', { REFW: 'R', BKNR: '1', DGNA: 'M', ADAT: '01012026' }));
});

/** Minimal vollständige M3-Werte für die Pflichtprüfung. */
function vollstaendigM3(extra: Record<string, string>): Record<string, string> {
  return {
    REFW: 'REF-1',
    BKNR: '1234567',
    DGNA: 'Muster GmbH',
    FANA: 'Maier',
    VONA: 'Anna',
    ADAT: '01022026',
    BBER: '01',
    GERF: 'N',
    FRDV: 'N',
    ...extra,
  };
}
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementieren**

`packages/elda/src/pflicht-e29.ts`:
```ts
import { EldaError } from './errors';

/** Satzarten der Versichertenmeldung reduziert (Kapitel E.29, Feld SART). */
export type Satzart = 'M3' | 'M4' | 'M6' | 'M8' | 'M9' | 'S3' | 'S4';

/** Klartext je Satzart, für Fehlermeldungen und Doku. */
export const SATZART_TEXT: Readonly<Record<Satzart, string>> = {
  M3: 'Anmeldung',
  M4: 'Abmeldung',
  M6: 'Änderungsmeldung',
  M8: 'Richtigstellung Anmeldung',
  M9: 'Richtigstellung Abmeldung',
  S3: 'Storno Anmeldung',
  S4: 'Storno Abmeldung',
};

/**
 * Pflichtstufen laut Legende zu Kapitel E.29.1:
 * - `Z`  Angabe zwingend
 * - `Z1` zwingend, wenn zutreffend
 * - `Z3` Angabe möglich
 * - `V`  zwingende Angabe bei Veränderung
 * - `-`  keine Angabe, Feld in Grundstellung
 */
export type Pflichtstufe = 'Z' | 'Z1' | 'Z3' | 'V' | '-';

type Zeile = Readonly<Record<Satzart, Pflichtstufe>>;

function zeile(m3: Pflichtstufe, m4: Pflichtstufe, m6: Pflichtstufe, m8: Pflichtstufe, m9: Pflichtstufe, s3: Pflichtstufe, s4: Pflichtstufe): Zeile {
  return { M3: m3, M4: m4, M6: m6, M8: m8, M9: m9, S3: s3, S4: s4 };
}

/**
 * Die Matrix aus Kapitel E.29.1, Feld für Feld und Satzart für Satzart. Reines
 * Datenabbild des Dokuments — die Reihenfolge folgt der Feldnummer.
 */
const MATRIX: Readonly<Record<string, Zeile>> = {
  REFW: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  REFU: zeile('-', '-', '-', 'Z', 'Z', 'Z', 'Z'),
  BKNR: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  DGNA: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  DTEL: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  MAIL: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  INF1: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  INF2: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  VSNR: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  GEBD: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  REFV: zeile('Z1', 'Z1', 'Z1', 'Z1', '-', '-', '-'),
  FANA: zeile('Z', 'Z', 'Z', '-', '-', '-', '-'),
  VONA: zeile('Z', 'Z', 'Z', '-', '-', '-', '-'),
  ADAT: zeile('Z1', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  BDAT: zeile('-', '-', 'Z1', '-', '-', '-', '-'),
  RDAT: zeile('-', '-', '-', 'Z', 'Z', '-', '-'),
  BBER: zeile('Z', '-', '-', '-', '-', '-', '-'),
  GERF: zeile('Z', 'Z', 'V', '-', 'Z', '-', '-'),
  FRDV: zeile('Z', '-', '-', '-', '-', '-', '-'),
  EBSV: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  AGRD: zeile('-', 'Z', '-', '-', 'Z', '-', '-'),
  SAGR: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  KEAB: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  KEBI: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  UEAB: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  UEBI: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  BVAB: zeile('Z1', '-', '-', 'Z1', '-', '-', '-'),
  BVEN: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  BVJN: zeile('-', '-', 'V', '-', '-', '-', '-'),
  UMDA: zeile('-', 'Z1', '-', '-', 'Z1', '-', 'Z1'),
  RUMD: zeile('-', '-', '-', '-', 'Z1', '-', '-'),
  SOUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  ZTUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  ZKUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  RWUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', 'Z1'),
  RUUM: zeile('-', '-', '-', '-', 'Z1', '-', 'Z1'),
  BKUM: zeile('-', '-', '-', '-', 'Z1', '-', '-'),
  VWAZ: zeile('Z1', '-', '-', 'Z1', '-', '-', '-'),
};

/** Die Matrix nach Satzart aufgeschlüsselt, wie sie das API nach außen zeigt. */
export const PFLICHT_E29: Readonly<Record<Satzart, Readonly<Record<string, Pflichtstufe>>>> =
  (['M3', 'M4', 'M6', 'M8', 'M9', 'S3', 'S4'] as const).reduce(
    (acc, sa) => {
      acc[sa] = Object.fromEntries(Object.entries(MATRIX).map(([feld, z]) => [feld, z[sa]]));
      return acc;
    },
    {} as Record<Satzart, Record<string, Pflichtstufe>>,
  );

function belegt(wert: string | undefined): boolean {
  return wert !== undefined && wert.trim() !== '';
}

/**
 * Prüft die objektiv entscheidbaren Stufen der Matrix: `Z` muss belegt sein,
 * `-` muss leer bleiben. `Z1` und `V` hängen an einer fachlichen Bedingung, die
 * dieses Paket nicht kennt, und werden deshalb nicht erzwungen; `Z3` ist
 * freigestellt.
 */
export function pruefePflicht(
  satzart: Satzart,
  werte: Readonly<Record<string, string | undefined>>,
): void {
  for (const [feld, stufen] of Object.entries(MATRIX)) {
    const stufe = stufen[satzart];
    if (stufe === 'Z' && !belegt(werte[feld])) {
      throw new EldaError(
        `Satzart ${satzart} (${SATZART_TEXT[satzart]}): Feld ${feld} ist zwingend anzugeben.`,
      );
    }
    if (stufe === '-' && belegt(werte[feld])) {
      throw new EldaError(
        `Satzart ${satzart} (${SATZART_TEXT[satzart]}): Feld ${feld} ist in Grundstellung zu übermitteln, ` +
          'eine Angabe ist hier nicht zulässig.',
      );
    }
  }
}
```

Hinweis zu `VSNR` und `GEBD`: Die Matrix im Dokument führt beide Felder in einer
zusammengefassten Zelle. Der Prüfkatalog löst das in Task 5 auf — mindestens
eines der beiden muss belegt sein. Trage sie hier trotzdem als `Z` ein, wie das
Dokument es zeigt, und lass die tatsächliche Bedingung von der Regel `F7051`
prüfen. Falls diese Doppelführung zu einem Widerspruch in den Tests führt,
melde es und ändere nichts eigenmächtig.

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/pflicht-e29.ts packages/elda/src/pflicht-e29.test.ts
git commit -m "feat(elda): Pflichtmatrix der Versichertenmeldung (E.29.1)"
```

---

### Task 5: Prüfregeln aus dem Prüfkatalog

**Files:**
- Create: `packages/elda/src/pruefung-e29.ts`
- Create: `packages/elda/src/pruefung-e29.test.ts`

**Interfaces:**
- Consumes: `Satzart` aus `./pflicht-e29`, `EldaError` aus `./errors`.
- Produces: `function pruefeInhalt(satzart: Satzart, werte: Readonly<Record<string, string | undefined>>): void`

Quelle ist der Prüfkatalog zur 42. Ergänzung, Blatt `VR`
(`https://www.elda.at/cdscontent/load?contentid=10008.799619`). Umgesetzt werden
ausschließlich die Regeln, die sich ohne fachliche Zusatzkenntnis entscheiden
lassen. Jede Regel trägt ihren Fehlercode im Meldungstext, damit sich eine
spätere Rückmeldung von ELDA zuordnen lässt.

| Code | Regel |
|---|---|
| F7000 | `BKNR` darf nicht leer sein |
| F7030 | `GEBD` muss `TTMMJJJJ`, `00MMJJJJ` oder `0000JJJJ` sein |
| F7051 | `VSNR` oder `GEBD` — mindestens eines muss belegt sein |
| F7060 | `ADAT` darf bei `M4`, `M6`, `M8`, `M9`, `S3`, `S4` nicht leer sein |
| F7062 | `ADAT` darf nicht vor dem 01.01.2019 liegen |
| F7065 | `RDAT` darf bei `M8`, `M9` nicht leer sein |
| F7067 | `RDAT` darf nicht vor dem 01.01.2019 liegen |
| F7069 | `BBER` muss zwischen `01` und `13` liegen |
| F7107 | `SOUM` muss `J` oder leer sein |
| F7114 | `ZTUM` muss zwischen `11` und `19` liegen |
| F7116 | `VWAZ` muss vierstellig sein |
| F7115 | `VWAZ` ist bei `M3` zwingend, wenn `ADAT` nach dem 31.12.2025 liegt und `BBER` einen der Werte `01`, `02`, `03`, `04`, `11` trägt |

Nicht umgesetzt, weil sie Wissen erfordern, das dem Paket nicht vorliegt:
Gültigkeit der Beitragskontonummer je Versicherungsträger (F7001–F7009, F7097–F7100
— die Längenregeln hängen am konkreten Träger und sind nur als Warnung geführt),
die Prüfziffer der Versicherungsnummer (F7020 — das Verfahren steht in keiner der
Quellen), sowie sämtliche Regeln zur Ummeldung (F7104–F7113) und zu
`AGRD`/`EBSV` (F7111), die fachliche Kombinationen bewerten. Sie werden in der
README aufgezählt, damit der Aufrufer weiß, was ELDA zusätzlich prüft.

- [ ] **Step 1: Failing test**

`packages/elda/src/pruefung-e29.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeInhalt } from './pruefung-e29';
import { EldaError } from './errors';

const wirft = (satzart: Parameters<typeof pruefeInhalt>[0], werte: Record<string, string>, code: string) => {
  assert.throws(
    () => pruefeInhalt(satzart, werte),
    (err: unknown) => {
      assert.ok(err instanceof EldaError, `${code}: erwartet EldaError`);
      assert.match((err as Error).message, new RegExp(code), `${code} soll im Text stehen`);
      return true;
    },
    code,
  );
};

test('F7000: leere Beitragskontonummer', () => {
  wirft('M3', { BKNR: '', ADAT: '01022026', VSNR: '1234010180' }, 'F7000');
});

test('F7030: Geburtsdatum in zulässiger Form', () => {
  assert.doesNotThrow(() => pruefeInhalt('M3', { BKNR: '1', GEBD: '01011980', ADAT: '01022026', BBER: '05' }));
  assert.doesNotThrow(() => pruefeInhalt('M3', { BKNR: '1', GEBD: '00051980', ADAT: '01022026', BBER: '05' }));
  assert.doesNotThrow(() => pruefeInhalt('M3', { BKNR: '1', GEBD: '00001980', ADAT: '01022026', BBER: '05' }));
  wirft('M3', { BKNR: '1', GEBD: '32011980', ADAT: '01022026', BBER: '05' }, 'F7030');
});

test('F7051: weder VSNR noch GEBD', () => {
  wirft('M3', { BKNR: '1', ADAT: '01022026', BBER: '05' }, 'F7051');
});

test('F7060 und F7062: An-/Abmeldedatum', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '' }, 'F7060');
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '31122018' }, 'F7062');
  assert.doesNotThrow(() => pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01012019' }));
});

test('F7065 und F7067: richtiges An-/Abmeldedatum bei Richtigstellung', () => {
  wirft('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '' }, 'F7065');
  wirft('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '31122018' }, 'F7067');
});

test('F7069: Beschäftigungsbereich 01 bis 13', () => {
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '14' }, 'F7069');
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '00' }, 'F7069');
  assert.doesNotThrow(() => pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '13' }));
});

test('F7107: Sonderfall Ummeldung nur J oder leer', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', SOUM: 'N' }, 'F7107');
});

test('F7114: Zielversicherungsträger 11 bis 19', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', ZTUM: '20' }, 'F7114');
});

test('F7115: VWAZ bei Anmeldung ab 2026 für die betroffenen Beschäftigungsbereiche', () => {
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01' }, 'F7115');
  // vor der Stichtagsgrenze nicht gefordert
  assert.doesNotThrow(() => pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '31122025', BBER: '01' }));
  // nicht betroffener Beschäftigungsbereich
  assert.doesNotThrow(() => pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '05' }));
});

test('F7116: VWAZ vierstellig', () => {
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', VWAZ: '156' }, 'F7116');
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', VWAZ: '1567' }),
  );
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementieren**

`packages/elda/src/pruefung-e29.ts`:
```ts
import { EldaError } from './errors';
import type { Satzart } from './pflicht-e29';

type Werte = Readonly<Record<string, string | undefined>>;

function belegt(wert: string | undefined): boolean {
  return wert !== undefined && wert.trim() !== '';
}

function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

/** Wandelt ein Datum der Form TTMMJJJJ in eine vergleichbare Zahl JJJJMMTT. */
function alsZahl(datum: string): number {
  return Number(datum.slice(4, 8) + datum.slice(2, 4) + datum.slice(0, 2));
}

/**
 * Zulässige Formen des Geburtsdatums laut Prüfkatalog: vollständiges Datum,
 * unbekannter Tag (`00MMJJJJ`) oder nur das Jahr (`0000JJJJ`).
 */
function gueltigesGeburtsdatum(gebd: string): boolean {
  if (!/^\d{8}$/.test(gebd)) return false;
  const tt = Number(gebd.slice(0, 2));
  const mm = Number(gebd.slice(2, 4));
  const jjjj = Number(gebd.slice(4, 8));
  if (jjjj < 1000) return false;
  if (tt === 0 && mm === 0) return true;
  if (tt === 0) return mm >= 1 && mm <= 12;
  return tt >= 1 && tt <= 31 && mm >= 1 && mm <= 12;
}

function gueltigesDatum(wert: string): boolean {
  if (!/^\d{8}$/.test(wert)) return false;
  const tt = Number(wert.slice(0, 2));
  const mm = Number(wert.slice(2, 4));
  return tt >= 1 && tt <= 31 && mm >= 1 && mm <= 12;
}

/** Beschäftigungsbereiche, für die VWAZ ab 01.01.2026 zwingend ist (Prüfkatalog F7115). */
const VWAZ_PFLICHT_BBER: ReadonlySet<string> = new Set(['01', '02', '03', '04', '11']);

/** Satzarten, bei denen ADAT laut Prüfkatalog nicht leer sein darf (F7060). */
const ADAT_PFLICHT: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M6', 'M8', 'M9', 'S3', 'S4']);

/**
 * Prüft den Satzinhalt gegen die Regeln des ELDA-Prüfkatalogs, Blatt `VR`,
 * soweit sie sich ohne fachliche Zusatzkenntnis entscheiden lassen. Der
 * Fehlercode des Katalogs steht im Meldungstext, damit sich eine spätere
 * Rückmeldung von ELDA zuordnen lässt.
 *
 * Nicht geprüft werden unter anderem die Prüfziffer der Versicherungsnummer
 * (das Verfahren ist in den Quellen nicht beschrieben), die trägerabhängige
 * Länge der Beitragskontonummer und die Regeln rund um die Ummeldung. ELDA
 * prüft diese serverseitig.
 */
export function pruefeInhalt(satzart: Satzart, werte: Werte): void {
  if (!belegt(werte.BKNR)) wirf('F7000', 'Die Beitragskontonummer (BKNR) darf nicht leer sein.');

  if (belegt(werte.GEBD) && !gueltigesGeburtsdatum(werte.GEBD!)) {
    wirf('F7030', `Das Geburtsdatum (GEBD) '${werte.GEBD}' ist ungültig. Zulässig: TTMMJJJJ, 00MMJJJJ oder 0000JJJJ.`);
  }

  const vsnrBelegt = belegt(werte.VSNR) && werte.VSNR !== '0000000000';
  if (!vsnrBelegt && !belegt(werte.GEBD)) {
    wirf('F7051', 'Es muss mindestens eines der Felder Versicherungsnummer (VSNR) oder Geburtsdatum (GEBD) belegt sein.');
  }

  if (ADAT_PFLICHT.has(satzart) && !belegt(werte.ADAT)) {
    wirf('F7060', `Das An-/Abmelde- bzw. Änderungsdatum (ADAT) darf bei Satzart ${satzart} nicht leer sein.`);
  }
  if (belegt(werte.ADAT)) {
    if (!gueltigesDatum(werte.ADAT!)) wirf('F7061', `Das Datum (ADAT) '${werte.ADAT}' ist ungültig. Erwartet: TTMMJJJJ.`);
    if (alsZahl(werte.ADAT!) < 20190101) wirf('F7062', 'Das Datum (ADAT) darf nicht vor dem 01.01.2019 liegen.');
  }

  if (satzart === 'M8' || satzart === 'M9') {
    if (!belegt(werte.RDAT)) wirf('F7065', 'Das richtige An-/Abmeldedatum (RDAT) darf bei einer Richtigstellung nicht leer sein.');
    if (!gueltigesDatum(werte.RDAT!)) wirf('F7066', `Das Datum (RDAT) '${werte.RDAT}' ist ungültig. Erwartet: TTMMJJJJ.`);
    if (alsZahl(werte.RDAT!) < 20190101) wirf('F7067', 'Das Datum (RDAT) darf nicht vor dem 01.01.2019 liegen.');
  }

  if (belegt(werte.BBER) && !/^(0[1-9]|1[0-3])$/.test(werte.BBER!)) {
    wirf('F7069', `Der Beschäftigungsbereich (BBER) '${werte.BBER}' ist ungültig. Zulässig sind 01 bis 13.`);
  }

  if (belegt(werte.SOUM) && werte.SOUM !== 'J') {
    wirf('F7107', `Der Sonderfall Ummeldung (SOUM) '${werte.SOUM}' ist ungültig. Zulässig sind 'J' oder leer.`);
  }

  if (belegt(werte.ZTUM) && !/^1[1-9]$/.test(werte.ZTUM!)) {
    wirf('F7114', `Der Zielversicherungsträger Ummeldung (ZTUM) '${werte.ZTUM}' ist ungültig. Zulässig sind 11 bis 19.`);
  }

  if (belegt(werte.VWAZ) && !/^\d{4}$/.test(werte.VWAZ!)) {
    wirf('F7116', `Das Ausmaß der wöchentlichen Arbeitszeit (VWAZ) '${werte.VWAZ}' muss vierstellig sein.`);
  }
  if (
    satzart === 'M3' &&
    !belegt(werte.VWAZ) &&
    belegt(werte.ADAT) &&
    alsZahl(werte.ADAT!) > 20251231 &&
    belegt(werte.BBER) &&
    VWAZ_PFLICHT_BBER.has(werte.BBER!)
  ) {
    wirf(
      'F7115',
      'Bei einer Anmeldung mit Meldedatum nach dem 31.12.2025 ist das Ausmaß der vereinbarten ' +
        `wöchentlichen Arbeitszeit (VWAZ) anzugeben, wenn der Beschäftigungsbereich '${werte.BBER}' beträgt.`,
    );
  }
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/pruefung-e29.ts packages/elda/src/pruefung-e29.test.ts
git commit -m "feat(elda): Inhaltsregeln aus dem ELDA-Pruefkatalog (Blatt VR)"
```

---

### Task 6: Bestand — Vorlaufsatz, Nummerierung, Schlusssatz

**Files:**
- Create: `packages/elda/src/bestand.ts`
- Create: `packages/elda/src/bestand.test.ts`

**Interfaces:**
- Consumes: `baueSatz`/`Feld` aus `./festsatz`, `IDENTIFIKATIONSTEIL`/
  `LAENGE_IDENTIFIKATIONSTEIL` aus `./felder-e29`, `EldaError` aus `./errors`.
- Produces:
  - `interface Hersteller { name: string; kfz: string; plz: string; ort: string; strasse: string; telefon?: string; softwareId?: string; mail: string }`
  - `interface BestandOptionen { seriennummer: string; versicherungstraeger: string; datenuebernehmer?: string; datentraegernummer: string; erstellt: Date; testdaten: boolean; hersteller: Hersteller }`
  - `interface RohSatz { satzart: string; werte: Readonly<Record<string, string | undefined>>; felder: readonly Feld[]; satzlaenge: number }`
  - `function baueIdentifikationsteil(satzart: string, satznummer: number, opt: BestandOptionen): string`
  - `function baueBestand(saetze: readonly RohSatz[], opt: BestandOptionen): Buffer`

Vorlauf- und Schlusssatz stehen in `quellen/vorlauf-schlusssatz.txt`
(Kapitel E.2 und E.3). Beide werden über ihr Reserve-Feld auf die Satzlänge der
Datensätze aufgefüllt; innerhalb eines Bestands sind damit alle Sätze gleich lang.

- [ ] **Step 1: Failing test**

`packages/elda/src/bestand.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueBestand, baueIdentifikationsteil, type BestandOptionen, type RohSatz } from './bestand';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';
import { EldaError } from './errors';

const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '11',
  datentraegernummer: '000001',
  erstellt: new Date(Date.UTC(2026, 1, 3, 9, 30, 15)),
  testdaten: true,
  hersteller: {
    name: 'Kreiseck',
    kfz: 'A',
    plz: '1010',
    ort: 'Wien',
    strasse: 'Teststrasse 1',
    mail: 'test@example.at',
  },
};

const satz = (werte: Record<string, string>): RohSatz => ({
  satzart: 'M3',
  werte,
  felder: FELDER_E29,
  satzlaenge: SATZLAENGE_E29,
});

test('Identifikationsteil: 20 Zeichen mit Satzart, Nummer, Trägern und Seriennummer', () => {
  const id = baueIdentifikationsteil('M3', 2, OPT);
  assert.equal(id.length, 20);
  assert.equal(id.slice(0, 2), 'M3');
  assert.equal(id.slice(2, 9), '0000002');
  assert.equal(id.slice(11, 18), '1234567');
  assert.equal(id.slice(18, 20), '11');
});

test('Bestand: Vorlaufsatz, Datensätze, Schlusssatz — alle gleich lang', () => {
  const bestand = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' })], OPT);
  assert.equal(bestand.length, SATZLAENGE_E29 * 4);
  const zeile = (i: number) => bestand.subarray(i * SATZLAENGE_E29, (i + 1) * SATZLAENGE_E29).toString('latin1');
  assert.equal(zeile(0).slice(0, 2), '00', 'Vorlaufsatz trägt Satzart 00');
  assert.equal(zeile(1).slice(0, 2), 'M3');
  assert.equal(zeile(2).slice(0, 2), 'M3');
  assert.equal(zeile(3).slice(0, 2), '99', 'Schlusssatz trägt Satzart 99');
});

test('Satznummern beginnen bei 1 und steigen lückenlos', () => {
  const bestand = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' })], OPT);
  const nummer = (i: number) =>
    bestand.subarray(i * SATZLAENGE_E29 + 2, i * SATZLAENGE_E29 + 9).toString('latin1');
  assert.deepEqual([nummer(0), nummer(1), nummer(2), nummer(3)], ['0000001', '0000002', '0000003', '0000004']);
});

test('Vorlaufsatz: PROJ folgt dem Testdaten-Kennzeichen, BEST ist VR', () => {
  const test = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(test.slice(20, 22), 'TM');
  assert.equal(test.slice(22, 24), 'VR');
  const echt = baueBestand([satz({ REFW: 'R' })], { ...OPT, testdaten: false }).toString('latin1');
  assert.equal(echt.slice(20, 22), 'DM');
});

test('Vorlaufsatz: Erstellungsdatum und -zeit', () => {
  const b = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(b.slice(30, 38), '03022026');
  assert.equal(b.slice(38, 44), '093015');
});

test('Schlusssatz: Satzanzahl zählt die Datensätze ohne Umschlag', () => {
  const b = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' }), satz({ REFW: 'R3' })], OPT);
  const schluss = b.subarray(4 * SATZLAENGE_E29).toString('latin1');
  assert.equal(schluss.slice(20, 26), '000003');
});

test('leerer Bestand wirft, statt einen sinnlosen Umschlag zu liefern', () => {
  assert.throws(() => baueBestand([], OPT), EldaError);
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementieren**

`packages/elda/src/bestand.ts`:
```ts
import { EldaError } from './errors';
import { baueSatz, type Feld } from './festsatz';
import { IDENTIFIKATIONSTEIL, LAENGE_IDENTIFIKATIONSTEIL } from './felder-e29';

/** Angaben zum Hersteller der übermittelnden Software (Vorlaufsatz, Kapitel E.2). */
export interface Hersteller {
  /** Herstellername. */
  name: string;
  /** Internationales Kraftfahrzeugkennzeichen, z. B. `A`. */
  kfz: string;
  plz: string;
  ort: string;
  strasse: string;
  /** Optional laut Dokument. */
  telefon?: string;
  /** Software-Identifikationsnummer; optional laut Dokument. */
  softwareId?: string;
  /** Mailadresse des Herstellers; steht im Schlusssatz. */
  mail: string;
}

/** Rahmenangaben eines Datenbestands. */
export interface BestandOptionen {
  /** Seriennummer zum Datensammelsystem (Feld OBUS im Identifikationsteil). */
  seriennummer: string;
  /** Zuständiger Versicherungsträger (Feld VSTR). */
  versicherungstraeger: string;
  /** Datenübernehmender Versicherungsträger (Feld UVST); ohne Angabe gleich `versicherungstraeger`. */
  datenuebernehmer?: string;
  /** Datenträgernummer, laufende Nummerierung der übermittelten Bestände. */
  datentraegernummer: string;
  /** Erstellungszeitpunkt; liefert Datum und Zeit im Vorlaufsatz. */
  erstellt: Date;
  /** `true` setzt PROJ auf `TM` (Testdaten), `false` auf `DM`. */
  testdaten: boolean;
  hersteller: Hersteller;
}

/** Ein noch nicht umschlossener Satz samt seiner Feldtabelle. */
export interface RohSatz {
  satzart: string;
  werte: Readonly<Record<string, string | undefined>>;
  felder: readonly Feld[];
  satzlaenge: number;
}

/** Bestandsbezeichnung für Versichertenmeldungen ab 2019 (Kapitel E.2, Feld BEST). */
const BEST_VERSICHERTENMELDUNG = 'VR';

/** Versionsnummer der Satzstrukturen laut Kapitel E.29 (Version 03). */
const VERSION_SATZSTRUKTUR = '03';

function zweistellig(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Baut den 20 Zeichen langen Identifikationsteil laut Kapitel E.1. Die
 * Satznummer ist je Bestand bei 1 beginnend und lückenlos aufsteigend — der
 * Vorlaufsatz trägt die 1.
 */
export function baueIdentifikationsteil(satzart: string, satznummer: number, opt: BestandOptionen): string {
  return baueSatz(
    IDENTIFIKATIONSTEIL,
    {
      SART: satzart,
      SANR: String(satznummer),
      UVST: opt.datenuebernehmer ?? opt.versicherungstraeger,
      OBUS: opt.seriennummer,
      VSTR: opt.versicherungstraeger,
    },
    LAENGE_IDENTIFIKATIONSTEIL,
  ).toString('latin1');
}

function vorlaufFelder(satzlaenge: number): readonly Feld[] {
  return [
    { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
    { nr: 2, name: 'PROJ', pos: 21, laenge: 2, typ: 'a/n' },
    { nr: 3, name: 'BEST', pos: 23, laenge: 2, typ: 'a/n' },
    { nr: 4, name: 'DTNR', pos: 25, laenge: 6, typ: 'a/n' },
    { nr: 5, name: 'EDAT', pos: 31, laenge: 8, typ: 'n' },
    { nr: 6, name: 'EZEI', pos: 39, laenge: 6, typ: 'n' },
    { nr: 7, name: 'HRST', pos: 45, laenge: 45, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 8, name: 'HKFZ', pos: 90, laenge: 3, typ: 'a/n' },
    { nr: 9, name: 'HPLZ', pos: 93, laenge: 7, typ: 'a/n' },
    { nr: 10, name: 'HORT', pos: 100, laenge: 20, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 11, name: 'HSTR', pos: 120, laenge: 30, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 12, name: 'VERS', pos: 150, laenge: 2, typ: 'n' },
    { nr: 13, name: 'HTEL', pos: 152, laenge: 20, typ: 'a/n' },
    { nr: 14, name: 'SOID', pos: 172, laenge: 70, typ: 'a/n' },
    { nr: 15, name: 'VNMF', pos: 242, laenge: 5, typ: 'a/n' },
    { nr: 16, name: 'RESE', pos: 247, laenge: satzlaenge - 246, typ: 'a/n' },
  ];
}

function schlussFelder(satzlaenge: number): readonly Feld[] {
  return [
    { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
    { nr: 2, name: 'SANZ', pos: 21, laenge: 6, typ: 'n' },
    { nr: 3, name: 'ELNR', pos: 27, laenge: 6, typ: 'n' },
    { nr: 4, name: 'HEMA', pos: 33, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 5, name: 'RESE', pos: 93, laenge: satzlaenge - 92, typ: 'a/n' },
  ];
}

/**
 * Klammert Meldungssätze zu einem Datenbestand: Vorlaufsatz, die Sätze mit
 * fortlaufender Satznummer, Schlusssatz mit der Anzahl der Datensätze. Das
 * Ergebnis ist ISO-8859-15-kodiert und kann unverändert als Dateiinhalt an
 * `senden` übergeben werden.
 */
export function baueBestand(saetze: readonly RohSatz[], opt: BestandOptionen): Buffer {
  if (saetze.length === 0) {
    throw new EldaError('Ein Datenbestand ohne Meldungssätze ergibt keinen Sinn und wird nicht erzeugt.');
  }
  const satzlaenge = Math.max(...saetze.map((s) => s.satzlaenge));

  const d = opt.erstellt;
  const edat = `${zweistellig(d.getUTCDate())}${zweistellig(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
  const ezei = `${zweistellig(d.getUTCHours())}${zweistellig(d.getUTCMinutes())}${zweistellig(d.getUTCSeconds())}`;

  const teile: Buffer[] = [];
  let nummer = 1;

  teile.push(
    baueSatz(
      vorlaufFelder(satzlaenge),
      {
        IDTEIL: baueIdentifikationsteil('00', nummer++, opt),
        PROJ: opt.testdaten ? 'TM' : 'DM',
        BEST: BEST_VERSICHERTENMELDUNG,
        DTNR: opt.datentraegernummer,
        EDAT: edat,
        EZEI: ezei,
        HRST: opt.hersteller.name,
        HKFZ: opt.hersteller.kfz,
        HPLZ: opt.hersteller.plz,
        HORT: opt.hersteller.ort,
        HSTR: opt.hersteller.strasse,
        VERS: VERSION_SATZSTRUKTUR,
        HTEL: opt.hersteller.telefon,
        SOID: opt.hersteller.softwareId,
      },
      satzlaenge,
    ),
  );

  for (const s of saetze) {
    teile.push(
      baueSatz(s.felder, { ...s.werte, IDTEIL: baueIdentifikationsteil(s.satzart, nummer++, opt) }, s.satzlaenge),
    );
  }

  teile.push(
    baueSatz(
      schlussFelder(satzlaenge),
      {
        IDTEIL: baueIdentifikationsteil('99', nummer, opt),
        SANZ: String(saetze.length),
        ELNR: opt.seriennummer,
        HEMA: opt.hersteller.mail,
      },
      satzlaenge,
    ),
  );

  return Buffer.concat(teile);
}
```

Zwei Punkte, die der Umsetzende gegen `quellen/vorlauf-schlusssatz.txt` prüfen
muss, bevor er grün meldet: die Satzart des Schlusssatzes (oben `99`
angenommen) und ob `ELNR` tatsächlich die Seriennummer trägt. Beide stehen in
Kapitel E.2/E.3 beziehungsweise D.1. Weicht die Quelle ab, gilt die Quelle —
Code und Test anpassen und die Abweichung im Bericht nennen.

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/bestand.ts packages/elda/src/bestand.test.ts
git commit -m "feat(elda): Datenbestand mit Vorlauf- und Schlusssatz"
```

---

### Task 7: Die sieben Satzart-Builder

**Files:**
- Create: `packages/elda/src/versichertenmeldung.ts`
- Create: `packages/elda/src/versichertenmeldung.test.ts`

**Interfaces:**
- Consumes: `FELDER_E29`/`SATZLAENGE_E29` aus `./felder-e29`,
  `pruefePflicht`/`Satzart` aus `./pflicht-e29`, `pruefeInhalt` aus
  `./pruefung-e29`, `RohSatz`/`BestandOptionen`/`baueBestand` aus `./bestand`.
- Produces:
  - `interface MeldungsFelder` — alle 38 fachlichen Felder als optionale Strings, `IDTEIL` ausgenommen
  - `function anmeldung(f: MeldungsFelder): RohSatz`
  - `function abmeldung(f: MeldungsFelder): RohSatz`
  - `function aenderungsmeldung(f: MeldungsFelder): RohSatz`
  - `function richtigstellungAnmeldung(f: MeldungsFelder): RohSatz`
  - `function richtigstellungAbmeldung(f: MeldungsFelder): RohSatz`
  - `function stornoAnmeldung(f: MeldungsFelder): RohSatz`
  - `function stornoAbmeldung(f: MeldungsFelder): RohSatz`
  - `function erstelleBestand(meldungen: readonly RohSatz[], opt: BestandOptionen): Buffer`
  - `function wochenarbeitszeit(stunden: number, minuten?: number): string`

- [ ] **Step 1: Failing test**

`packages/elda/src/versichertenmeldung.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anmeldung,
  abmeldung,
  aenderungsmeldung,
  richtigstellungAnmeldung,
  richtigstellungAbmeldung,
  stornoAnmeldung,
  stornoAbmeldung,
  wochenarbeitszeit,
} from './versichertenmeldung';
import { EldaError } from './errors';

const BASIS = { REFW: 'REF-1', BKNR: '1234567', DGNA: 'Muster GmbH', VSNR: '1234010180' };

test('jede Satzart trägt ihren Code', () => {
  assert.equal(anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', BBER: '05', GERF: 'N', FRDV: 'N' }).satzart, 'M3');
  assert.equal(abmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', GERF: 'N', AGRD: '01' }).satzart, 'M4');
  assert.equal(aenderungsmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026' }).satzart, 'M6');
  assert.equal(richtigstellungAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026', RDAT: '02022026' }).satzart, 'M8');
  assert.equal(richtigstellungAbmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026', RDAT: '02022026', GERF: 'N', AGRD: '01' }).satzart, 'M9');
  assert.equal(stornoAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026' }).satzart, 'S3');
  assert.equal(stornoAbmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026' }).satzart, 'S4');
});

test('Anmeldung ohne Pflichtfeld wirft', () => {
  assert.throws(
    () => anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', GERF: 'N', FRDV: 'N' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /BBER/);
      return true;
    },
  );
});

test('Storno erlaubt keinen Familiennamen (Feld in Grundstellung)', () => {
  assert.throws(() => stornoAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026', FANA: 'Maier' }), EldaError);
});

test('Inhaltsregeln greifen zusätzlich zur Pflichtmatrix', () => {
  assert.throws(
    () => anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01012026', BBER: '01', GERF: 'N', FRDV: 'N' }),
    (err: unknown) => {
      assert.match((err as Error).message, /F7115/);
      return true;
    },
  );
});

test('der Satz enthält die Werte an den Positionen des Dokuments', () => {
  const satz = anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', BBER: '05', GERF: 'N', FRDV: 'N' });
  assert.equal(satz.werte.BKNR, '1234567');
  assert.equal(satz.satzlaenge, 772);
  assert.equal(satz.felder.length, 39);
});

test('wochenarbeitszeit: 15 Stunden 40 Minuten ergeben 1567 (Beispiel aus E.29.2)', () => {
  assert.equal(wochenarbeitszeit(15, 40), '1567');
  assert.equal(wochenarbeitszeit(38, 30), '3850');
  assert.equal(wochenarbeitszeit(40), '4000');
  assert.equal(wochenarbeitszeit(8, 20), '0833');
});

test('wochenarbeitszeit: unsinnige Eingaben werfen', () => {
  assert.throws(() => wochenarbeitszeit(-1), EldaError);
  assert.throws(() => wochenarbeitszeit(10, 60), EldaError);
  assert.throws(() => wochenarbeitszeit(100), EldaError);
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementieren**

`packages/elda/src/versichertenmeldung.ts`:
```ts
import { EldaError } from './errors';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';
import { pruefePflicht, type Satzart } from './pflicht-e29';
import { pruefeInhalt } from './pruefung-e29';
import { baueBestand, type BestandOptionen, type RohSatz } from './bestand';

/**
 * Die fachlichen Felder einer Versichertenmeldung, benannt wie in Kapitel E.29.
 * Alle Werte sind Zeichenketten in der Form, die das Dokument vorgibt — Datumsfelder
 * als `TTMMJJJJ`, Kennzeichen als `J`/`N`. Der Identifikationsteil gehört nicht
 * dazu; er entsteht beim Bau des Bestands.
 */
export interface MeldungsFelder {
  /** Referenzwert: eindeutige Identifikation dieser Meldung. Zwingend bei allen Satzarten. */
  REFW?: string;
  /** Referenzwert der Meldung, die storniert oder richtiggestellt werden soll. */
  REFU?: string;
  /** Beitragskontonummer beim zuständigen Versicherungsträger. */
  BKNR?: string;
  /** Dienstgebername. */
  DGNA?: string;
  /** Telefonnummer des Dienstgebers. */
  DTEL?: string;
  /** Mailadresse des Dienstgebers. */
  MAIL?: string;
  /** Erstes freies Informationsfeld, z. B. die betriebsinterne Personalnummer. */
  INF1?: string;
  /** Zweites freies Informationsfeld. */
  INF2?: string;
  /** Versicherungsnummer in der Form LLLPTTMMJJ. */
  VSNR?: string;
  /** Geburtsdatum TTMMJJJJ; auch 00MMJJJJ oder 0000JJJJ zulässig. */
  GEBD?: string;
  /** Referenzwert der VSNR-Anforderung. */
  REFV?: string;
  /** Familienname. */
  FANA?: string;
  /** Vorname. */
  VONA?: string;
  /** An-/Abmelde- bzw. Änderungsdatum TTMMJJJJ. */
  ADAT?: string;
  /** Änderungsdatum BIS TTMMJJJJ. */
  BDAT?: string;
  /** Richtiges An-/Abmeldedatum TTMMJJJJ. */
  RDAT?: string;
  /** Beschäftigungsbereich, 01 bis 13. */
  BBER?: string;
  /** Geringfügigkeit, `J` oder `N`. */
  GERF?: string;
  /** Freier Dienstvertrag, `J` oder `N`. */
  FRDV?: string;
  /** Ende des Beschäftigungsverhältnisses TTMMJJJJ. */
  EBSV?: string;
  /** Abmeldegrund, Code. */
  AGRD?: string;
  /** Abmeldegrund, Text. */
  SAGR?: string;
  /** Kündigungsentschädigung ab TTMMJJJJ. */
  KEAB?: string;
  /** Kündigungsentschädigung bis TTMMJJJJ. */
  KEBI?: string;
  /** Urlaubsersatzleistung ab TTMMJJJJ. */
  UEAB?: string;
  /** Urlaubsersatzleistung bis TTMMJJJJ. */
  UEBI?: string;
  /** Betriebliche Vorsorge ab TTMMJJJJ. */
  BVAB?: string;
  /** Betriebliche Vorsorge Ende TTMMJJJJ. */
  BVEN?: string;
  /** Betriebliche Vorsorge, Kennzeichen. */
  BVJN?: string;
  /** Ummeldedatum TTMMJJJJ. */
  UMDA?: string;
  /** Richtiges Ummeldedatum TTMMJJJJ. */
  RUMD?: string;
  /** Sonderfall Ummeldung, `J` oder leer. */
  SOUM?: string;
  /** Zielversicherungsträger der Ummeldung, 11 bis 19. */
  ZTUM?: string;
  /** Beitragskontonummer der Ummeldung. */
  ZKUM?: string;
  /** Referenzwert der Ummeldung. */
  RWUM?: string;
  /** Referenzwert der ursprünglichen Meldung am Zielbeitragskonto. */
  RUUM?: string;
  /** Referenzwert Ummeldung bei Sonderfall Zielbeitragskontoänderung. */
  BKUM?: string;
  /** Ausmaß der vereinbarten wöchentlichen Arbeitszeit, vierstellig — siehe {@link wochenarbeitszeit}. */
  VWAZ?: string;
}

function baue(satzart: Satzart, felder: MeldungsFelder): RohSatz {
  const werte: Record<string, string | undefined> = { ...felder };
  pruefePflicht(satzart, werte);
  pruefeInhalt(satzart, werte);
  return { satzart, werte, felder: FELDER_E29, satzlaenge: SATZLAENGE_E29 };
}

/** Anmeldung (Satzart M3). Vor Arbeitsantritt zu übermitteln. */
export function anmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M3', felder);
}

/** Abmeldung (Satzart M4). */
export function abmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M4', felder);
}

/** Änderungsmeldung (Satzart M6). */
export function aenderungsmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M6', felder);
}

/** Richtigstellung einer Anmeldung (Satzart M8). */
export function richtigstellungAnmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M8', felder);
}

/** Richtigstellung einer Abmeldung (Satzart M9). */
export function richtigstellungAbmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M9', felder);
}

/** Storno einer Anmeldung (Satzart S3). */
export function stornoAnmeldung(felder: MeldungsFelder): RohSatz {
  return baue('S3', felder);
}

/** Storno einer Abmeldung (Satzart S4). */
export function stornoAbmeldung(felder: MeldungsFelder): RohSatz {
  return baue('S4', felder);
}

/**
 * Rechnet Stunden und Minuten in das Format des Feldes `VWAZ` um: Stunden mit
 * kaufmännischer Rundung auf zwei Nachkommastellen, als vier Ziffern ohne
 * Dezimaltrenner. Das Dokument nennt als Beispiel 15 Stunden und 40 Minuten,
 * die als `1567` zu übermitteln sind.
 */
export function wochenarbeitszeit(stunden: number, minuten = 0): string {
  if (!Number.isFinite(stunden) || !Number.isFinite(minuten) || stunden < 0 || minuten < 0 || minuten > 59) {
    throw new EldaError(
      `Ungültige Arbeitszeit: ${stunden} Stunden, ${minuten} Minuten. Stunden ab 0, Minuten 0 bis 59.`,
    );
  }
  const hundertstel = Math.round((stunden + minuten / 60) * 100);
  if (hundertstel > 9999) {
    throw new EldaError(`Die wöchentliche Arbeitszeit ${stunden}:${minuten} passt nicht in vier Ziffern.`);
  }
  return String(hundertstel).padStart(4, '0');
}

/**
 * Klammert Meldungen zu einem übertragbaren Datenbestand. Das Ergebnis geht
 * unverändert als `inhalt` an `senden`.
 */
export function erstelleBestand(meldungen: readonly RohSatz[], opt: BestandOptionen): Buffer {
  return baueBestand(meldungen, opt);
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/versichertenmeldung.ts packages/elda/src/versichertenmeldung.test.ts
git commit -m "feat(elda): Builder fuer die sieben Satzarten der Versichertenmeldung"
```

---

### Task 8: Die Beispiele aus dem Dokument als Tests

**Files:**
- Create: `packages/elda/src/beispiele-e29.test.ts`

**Interfaces:**
- Consumes: alle Builder aus `./versichertenmeldung`.

Dies ist der Task, der dieser Stufe ihre Belastbarkeit gibt: Die Tests prüfen
nicht unsere Lesart gegen sich selbst, sondern gegen das Dokument.

- [ ] **Step 1: Beispiele erfassen**

Gehe `quellen/e29-erstellvorschriften.txt` (Kapitel E.29.2, Seiten 305–336)
vollständig durch. Die Datei enthält 26 mit „Beispiel" überschriebene Fälle und
28 Tabellen der Form „Feldname | Feldbezeichnung | Wert", verteilt über die
Abschnitte `Satzart M3` bis `Satzart S4`. Erfasse **jeden** dieser Fälle als
Testfall. Bei Zweifeln an einer Zahl gilt das PDF unter `quellen/`, nicht der
Textauszug.

Für jeden Fall gilt:
- Der Testname nennt Satzart und Fundstelle, z. B.
  `'E.29.2 / M8, Beispiel 1: Beginn der BV liegt vor dem Anmeldedatum'`.
- Der Test ruft den passenden Builder mit den Werten des Beispiels auf und
  ergänzt nur, was die Pflichtmatrix zusätzlich verlangt (Referenzwert,
  Beitragskontonummer, Dienstgebername, Versicherungsnummer). Diese Ergänzungen
  sind im Test als solche zu kommentieren.
- Der Test sichert die Feldwerte des Beispiels im erzeugten Satz zu.

Beispiel für die Form, hier der im Dokument unter „Satzart M8" gezeigte Fall
(ADAT bleibt das ursprüngliche, falsche Datum; RDAT trägt das richtige; ein
leeres BVAB storniert die Zeit der betrieblichen Vorsorge):

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { richtigstellungAnmeldung } from './versichertenmeldung';

// Ergänzt gegenüber dem Dokument, weil die Pflichtmatrix sie verlangt:
// REFW, REFU, BKNR, DGNA, VSNR.
const RAHMEN = { REFW: 'REF-1', REFU: 'REF-0', BKNR: '1234567', DGNA: 'Muster GmbH', VSNR: '1234010180' };

test('E.29.2 / M8, Beispiel 1: Beginn der BV liegt vor dem Anmeldedatum', () => {
  const satz = richtigstellungAnmeldung({
    ...RAHMEN,
    ADAT: '25042019', // Anmeldedatum laut Beispiel
    RDAT: '28042019', // Richtiges An-/Abmeldedatum laut Beispiel
    // BVAB bleibt unbelegt — laut Dokument bleibt die BV damit unverändert
  });
  assert.equal(satz.werte.ADAT, '25042019');
  assert.equal(satz.werte.RDAT, '28042019');
  assert.equal(satz.werte.BVAB, undefined);
});
```

- [ ] **Step 2: Run → alle neuen Tests laufen**

Run: `npm test -w @kreiseck/elda`

Erwartung: Jeder erfasste Fall ist grün. **Wird ein Fall rot, ist das ein
Befund, kein Ärgernis** — entweder ist unsere Pflichtmatrix oder eine
Inhaltsregel falsch abgeschrieben, oder das Beispiel deckt eine Regel auf, die
wir noch nicht kennen. Weiche den Test in diesem Fall NICHT auf. Halte
stattdessen im Bericht fest: welcher Fall, welche Erwartung, welches Ergebnis,
und welche Fundstelle im Dokument dagegen spricht.

- [ ] **Step 3: Abdeckung belegen**

Zähle im Bericht, wie viele der 26 Beispiele als Test vorliegen, und begründe
jeden nicht erfassten Fall einzeln (z. B. „Beispiel betrifft die mBGM und liegt
außerhalb dieser Stufe").

- [ ] **Step 4: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/beispiele-e29.test.ts
git commit -m "test(elda): Beispiele aus E.29.2 der Organisationsbeschreibung"
```

---

### Task 9: Barrel, README, Version

**Files:**
- Modify: `packages/elda/src/index.ts`
- Modify: `packages/elda/src/index.test.ts`
- Modify: `packages/elda/README.md`
- Modify: `packages/elda/package.json` (Version `0.2.0` → `0.3.0`)
- Modify: `CHANGELOG.md` (Repo-Root)

- [ ] **Step 1: Failing test für die Oberfläche**

An `packages/elda/src/index.test.ts` anhängen:
```ts
test('index exportiert die Meldungs-Builder', () => {
  for (const name of [
    'anmeldung',
    'abmeldung',
    'aenderungsmeldung',
    'richtigstellungAnmeldung',
    'richtigstellungAbmeldung',
    'stornoAnmeldung',
    'stornoAbmeldung',
    'erstelleBestand',
    'wochenarbeitszeit',
  ]) {
    assert.equal(typeof (elda as Record<string, unknown>)[name], 'function', name);
  }
});

test('index exportiert die Satzart-Tabellen, aber kein Innenleben', () => {
  assert.ok(elda.PFLICHT_E29.M3);
  assert.ok(elda.SATZART_TEXT.M3);
  for (const intern of ['baueSatz', 'nachIso885915', 'pruefeVorrat', 'FELDER_E29', 'pruefeInhalt']) {
    assert.equal((elda as Record<string, unknown>)[intern], undefined, `sollte intern sein: ${intern}`);
  }
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Barrel erweitern**

An `packages/elda/src/index.ts` anhängen:
```ts
export {
  anmeldung,
  abmeldung,
  aenderungsmeldung,
  richtigstellungAnmeldung,
  richtigstellungAbmeldung,
  stornoAnmeldung,
  stornoAbmeldung,
  erstelleBestand,
  wochenarbeitszeit,
  type MeldungsFelder,
} from './versichertenmeldung';
export { PFLICHT_E29, SATZART_TEXT, type Satzart, type Pflichtstufe } from './pflicht-e29';
export type { BestandOptionen, Hersteller, RohSatz } from './bestand';
```

`festsatz`, `zeichensatz`, `felder-e29` und `pruefung-e29` bleiben intern.

- [ ] **Step 4: README erweitern**

`packages/elda/README.md` bekommt einen Abschnitt „Meldungen erzeugen" vor dem
bisherigen v2-Ausblick. Er MUSS enthalten:

- Ein durchgehendes Beispiel: Anmeldung bauen, Bestand klammern, an `senden`
  übergeben.
- Die Tabelle der sieben Satzarten mit ihren Codes.
- Den Hinweis auf `wochenarbeitszeit` samt dem Dokumentbeispiel (15 Stunden 40
  Minuten ergeben `1567`) und darauf, dass `VWAZ` bei Anmeldungen ab 2026 für
  die Beschäftigungsbereiche 01, 02, 03, 04 und 11 verlangt wird.
- Den Zeichensatz-Abschnitt: ISO-8859-15, der enge Vorrat für Personennamen,
  und dass ein nicht darstellbarer Name wirft statt ersetzt zu werden.
- Den Abschnitt „Was geprüft wird — und was nicht": Pflichtstufen `Z` und `-`
  werden erzwungen, `Z1` und `V` nicht; die umgesetzten Prüfkatalog-Regeln mit
  ihren Codes; und die ausdrücklich nicht umgesetzten (Prüfziffer der
  Versicherungsnummer, trägerabhängige Länge der Beitragskontonummer,
  Ummelde-Kombinationen), die ELDA serverseitig prüft.
- Den Hinweis, dass die Erstellvorschriften aus E.29.2 fachliche Regeln
  enthalten, deren Verletzung eine strukturell einwandfreie, inhaltlich falsche
  Meldung erzeugt — mit dem Beispiel, dass ein unbelegtes `BVAB` bei einer
  Richtigstellung die Zeit der betrieblichen Vorsorge storniert.
- Eine Ergänzung im Abschnitt „Reifegrad": auch diese Stufe ist nie gegen echtes
  ELDA gelaufen; die Tests stützen sich auf die Beispiele der
  Organisationsbeschreibung.
- Die Quellenangabe: Organisationsbeschreibung „Datenaustausch mit Dienstgebern",
  42. Ergänzung, Version 42.7.0 (07/2026), Kapitel E.29; Prüfkatalog zur
  42. Ergänzung, Blatt `VR`; Zeichensatz-Dokument.

- [ ] **Step 5: Version und CHANGELOG**

`packages/elda/package.json`: `"version": "0.3.0"`.

In `CHANGELOG.md` unter `## @kreiseck/elda` einen Eintrag `### 0.3.0` in der
Konvention der Nachbarpakete ergänzen: Meldungs-Builder für die sieben
Satzarten der Versichertenmeldung reduziert, Bestandsumschlag, ISO-8859-15,
Pflichtmatrix und Prüfkatalog-Regeln; ausdrücklich additiv, keine Bruchstelle
gegenüber 0.2.0.

- [ ] **Step 6: README-Beispiele gegen die echte API prüfen**

```bash
npm run build -w @kreiseck/elda
```
Danach jeden Schnipsel gegen `packages/elda/dist/index.d.ts` abgleichen. Ein
Schnipsel, der nicht kompilieren würde, ist ein Fehler.

- [ ] **Step 7: Run → PASS und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src && npm test
git add packages/elda/src/index.ts packages/elda/src/index.test.ts packages/elda/README.md packages/elda/package.json CHANGELOG.md
git commit -m "feat(elda): Versichertenmeldungen erzeugen (v0.3.0)"
```

---

## Selbst-Review (durchgeführt)

- **Spec-Abdeckung:** Zeichensatz und Vorrat (Task 1), Festsatz-Serialisierung
  (Task 2), Feldtabelle E.29 (Task 3), Pflichtmatrix E.29.1 (Task 4),
  Prüfkatalog (Task 5), Bestandsumschlag mit `VR` und `PROJ` (Task 6), die
  sieben Builder samt `VWAZ`-Umrechnung (Task 7), die Beispiele des Dokuments
  als Tests (Task 8), Barrel und Doku (Task 9). Die Grenze „kodiert wird, was
  das Dokument durchrechnet" trägt Task 5 (nur entscheidbare Regeln) und Task 8
  (Beispiele als Prüfstein).
- **Platzhalter:** keine. Task 8 gibt statt fertigem Code eine Erfassungsregel
  samt Musterfall vor, weil die 26 Fälle aus der Quelle zu übernehmen sind —
  das Muster zeigt Form, Benennung und Kommentierung vollständig.
- **Typkonsistenz:** `Feld`/`Werte` aus Task 2 werden in den Tasks 3, 6, 7
  unverändert benutzt; `Satzart` entsteht in Task 4 und wird in 5 und 7
  konsumiert; `RohSatz`/`BestandOptionen` entstehen in Task 6 und werden in 7
  und 9 exportiert; `MeldungsFelder` trägt genau die 38 fachlichen Feldnamen
  aus Task 3.
- **Bewusst offen gelassen** (im Code und in der README zu vermerken): das
  Prüfziffernverfahren der Versicherungsnummer steht in keiner der Quellen;
  die trägerabhängigen Beitragskonto-Längen sind im Prüfkatalog nur als Warnung
  geführt; die Satzart des Schlusssatzes und die Belegung von `ELNR` sind in
  Task 6 gegen die Quelle zu bestätigen.
