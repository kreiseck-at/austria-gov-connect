import { test } from 'node:test';
import assert from 'node:assert/strict';
import { l16Geschlecht, geschlechtCodeElda, GESCHLECHTER } from './geschlecht';
import { lohnzettelSaetze, erstelleLohnzettelBestand } from './lohnzettel';
import { BESTAND_OPT, LOHNZETTEL_2026, UEBERMITTLUNG_2026 } from './testdaten-l16.test';
import { pruefeLohnzettel } from './pruefung-e14';

// Werte wie @kreiseck/validator `Gender` (Personenstand): m, f, d, i, o.
const TABELLE = [
  { code: 'm', l16: { GESM: 'J' }, elda: '1' },
  { code: 'f', l16: { GESW: 'J' }, elda: '2' },
  { code: 'd', l16: { GESD: 'J' }, elda: '3' },
  { code: 'i', l16: { GESD: 'J' }, elda: '6' },
  { code: 'o', l16: { GESD: 'J' }, elda: '4' },
] as const;

test('GESCHLECHTER sind die fünf Werte des Personenstands in fester Reihenfolge', () => {
  assert.deepEqual(GESCHLECHTER, ['m', 'f', 'd', 'i', 'o']);
});

test('L16: genau ein Feld J – inter und offen wie divers (Formular L 16 „inter/divers/offen“)', () => {
  for (const z of TABELLE) assert.deepEqual(l16Geschlecht(z.code), z.l16, z.code);
});

test('ELDA GESL: 1 männlich, 2 weiblich, 3 divers, 6 inter, 4 offen', () => {
  for (const z of TABELLE) assert.equal(geschlechtCodeElda(z.code), z.elda, z.code);
});

test('unbekannt oder leer wirft – kein stilles Leerfeld (sonst W 2801)', () => {
  for (const falsch of ['', 'x', 'w', 'M', 'keine Angabe', 'constructor', undefined, null] as unknown[]) {
    assert.throws(() => l16Geschlecht(falsch as string), /Geschlecht/, String(falsch));
    assert.throws(() => geschlechtCodeElda(falsch as string), /Geschlecht/, String(falsch));
  }
});

test('im L1-Satz: genau ein J an Stelle 280–282, die Prüfung meldet kein F2801', () => {
  for (const z of TABELLE) {
    const felder: Record<string, string | undefined> = {
      ...LOHNZETTEL_2026.felder,
      GESW: undefined,
      GESM: undefined,
      GESD: undefined,
    };
    const lz = { ...LOHNZETTEL_2026, felder: { ...felder, ...l16Geschlecht(z.code) } };
    const u = { ...UEBERMITTLUNG_2026, lohnzettel: [lz] };
    const codes = pruefeLohnzettel(lohnzettelSaetze(u, BESTAND_OPT.erstellt), '28').map((b) => b.code);
    assert.ok(!codes.includes('F2801'), `${z.code}: ${codes.join(',')}`);
    const l1 = erstelleLohnzettelBestand(u, BESTAND_OPT)
      .toString('latin1')
      .split('\r\n')
      .find((x) => x.startsWith('L1'))!;
    const feld = l1.slice(279, 282);
    assert.equal(feld.replace(/ /g, ''), 'J', `${z.code}: ${JSON.stringify(feld)}`);
    assert.equal(
      feld.indexOf('J'),
      { GESW: 0, GESM: 1, GESD: 2 }[Object.keys(z.l16)[0] as 'GESW' | 'GESM' | 'GESD'],
      z.code,
    );
  }
});
