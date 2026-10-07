import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lohnzettelSaetze, type Lohnzettel } from './lohnzettel';
import { L16_GEPRUEFT, L16_NICHT_GEPRUEFT, pruefeLohnzettel } from './pruefung-e14';
import { L16_PRUEFKATALOG } from './pruefkatalog-l16';
import { BESTAND_OPT, LOHNZETTEL_2026, UEBERMITTLUNG_2026 } from './testdaten-l16.test';

/** Prüft genau einen Lohnzettel und liefert die Codes der Befunde. */
function codes(lz: Lohnzettel): string[] {
  const saetze = lohnzettelSaetze({ ...UEBERMITTLUNG_2026, lohnzettel: [lz] }, BESTAND_OPT.erstellt);
  return pruefeLohnzettel(saetze, '28').map((b) => b.code);
}

const mit = (
  felder: Record<string, string | undefined> = {},
  betraege: Record<string, number | undefined> = {},
): Lohnzettel => ({
  ...LOHNZETTEL_2026,
  felder: { ...LOHNZETTEL_2026.felder, ...felder },
  betraege: { ...LOHNZETTEL_2026.betraege, ...betraege },
});

test('Stimmiger Lohnzettel: keine Befunde', () => {
  assert.deepEqual(codes(LOHNZETTEL_2026), []);
});

test('Jede nachgerechnete Regel steht im Katalog', () => {
  for (const code of L16_GEPRUEFT) assert.ok(L16_PRUEFKATALOG.has(code), code);
  assert.equal(L16_GEPRUEFT.length + L16_NICHT_GEPRUEFT.length, L16_PRUEFKATALOG.size);
});

test('Befund trägt Status, Indikation und Fehlertext des Katalogs', () => {
  const saetze = lohnzettelSaetze(
    { ...UEBERMITTLUNG_2026, lohnzettel: [mit({}, { B230: 600_000 })] },
    BESTAND_OPT.erstellt,
  );
  const befund = pruefeLohnzettel(saetze, '28').find((b) => b.code === 'F4800');
  assert.deepEqual(befund, {
    code: 'F4800',
    lohnzettel: 1,
    status: 'N',
    indikation: 'N',
    meldung: 'Betrag KZ 230 rechnerisch unrichtig',
  });
});

test('Summenregeln mit den Toleranzen des Katalogs', () => {
  // F4800: KZ 230 = insgesamt einbehalten − KZ 225 − KZ 226, ± 1,00 €
  assert.ok(!codes(mit({}, { B230: 685_100 })).includes('F4800'));
  assert.ok(codes(mit({}, { B230: 685_101 })).includes('F4800'));
  // F7004: KZ 260 = einbehaltene LSt − LSt mit festen Sätzen, ± 0,20 €
  assert.ok(!codes(mit({}, { B260: 356_240 })).includes('F7004'));
  assert.ok(codes(mit({}, { B260: 356_241 })).includes('F7004'));
  // F6401: KZ 245 aus KZ 210, 215, 220, 230, 243, ± 1,00 €
  assert.ok(codes(mit({}, { B245: 2_900_000 })).includes('F6401'));
  // F6201: KZ 243 = Summe der übrigen Abzüge (Formel 2026), ± 0,40 €
  assert.ok(codes(mit({}, { B243: 10_000, B245: 2_905_000 })).includes('F6201'));
  assert.ok(!codes(mit({}, { B243: 10_000, BPEN: 10_000, BPEND: 1_000, B245: 2_905_000 })).includes('F6201'));
});

test('Geschlecht und Beschäftigungsform: genau eine Angabe', () => {
  assert.ok(codes(mit({ GESW: 'J', GESM: 'J' })).includes('F2801'));
  assert.ok(codes(mit({ GESW: undefined })).includes('F2801'));
  assert.ok(codes(mit({ TEIL: 'J' })).includes('F3001'));
});

test('Lohnzettelart begrenzt die Regeln: KZ 225 bei Art 3 und 4 unzulässig', () => {
  assert.ok(codes(mit({ ARTL: '03' })).includes('F4402'));
  assert.ok(!codes(LOHNZETTEL_2026).includes('F4402'));
});

test('Unzulässige Lohnzettelart: nur F1100', () => {
  assert.deepEqual(codes(mit({ ARTL: '10' })), ['F1100']);
});

test('Zeitraum: Ende vor Beginn, Übermittlung vor dem Ende, Aufrollungszeitraum', () => {
  assert.ok(codes(mit({ BELZ: '0107', ENLZ: '3006' })).includes('F1603'));
  // DTUE 15.01.2027 — ein Lohnzettel bis 31.12.2026 ist nicht „vor dem Ende" übermittelt
  assert.ok(!codes(LOHNZETTEL_2026).includes('F1703'));
  const mai = lohnzettelSaetze(UEBERMITTLUNG_2026, new Date('2027-05-04T10:00:00+02:00'));
  assert.deepEqual(
    pruefeLohnzettel(mai, '28').map((b) => b.code),
    ['F1706'],
  );
});

test('Plausibilitätsgrenzen in Euro', () => {
  assert.ok(codes(mit({}, { B215: 930_001, SB681: 930_001 })).includes('F3805'));
  assert.ok(codes(mit({}, { SB681: 720_001, B215: 720_001 })).includes('F9710'));
  assert.ok(codes(mit({}, { MARAB: 100_001 })).includes('F9743'));
});

test('Kinderblock: Codes je Kind (KA…, KB…) und Abgleich mit der Anzahl', () => {
  const kind = {
    KFAM: 'Weinzierl',
    KVON: 'Livia',
    KSTAAT: 'A',
    KVSNR: '1234010180',
    KAFBZ: 'J',
    KBGFP: '01',
    KEGFP: '12',
  };
  // Familienbonus Plus 2.000 € senkt die Jahressteuer nach Tarif auf
  // max(0; 3.798,40 − 2.000) − 496 + 259,80 = 1.562,20 — sonst schlüge F7003 an.
  const ok: Lohnzettel = {
    ...mit({ BFABO: 'J', KFABO: '1' }, { FABO: 200_000, BIEL: 156_220, B260: 156_220 }),
    kinder: [kind],
  };
  assert.deepEqual(codes(ok), []);
  // FABO über 12 × 166,68 €
  assert.ok(codes({ ...ok, betraege: { ...ok.betraege, FABO: 200_017 } }).includes('F9230'));
  // zweites Kind ohne Antragsteller, Anzahl nicht nachgezogen
  const zwei = codes({ ...ok, kinder: [kind, { ...kind, KAFBZ: undefined }] });
  assert.ok(zwei.includes('KB42'));
  assert.ok(zwei.includes('F9213'));
  assert.ok(!zwei.includes('KA42'));
});

test('Version 29: kein Katalog, keine Prüfung', () => {
  const saetze = lohnzettelSaetze({ ...UEBERMITTLUNG_2026, version: '29', jahr: 2027 }, BESTAND_OPT.erstellt);
  assert.throws(() => pruefeLohnzettel(saetze, '29'), /kein Prüfkatalog/);
});
