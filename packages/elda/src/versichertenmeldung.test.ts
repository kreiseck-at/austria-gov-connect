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
  erstelleBestand,
  type MeldungsFelder,
} from './versichertenmeldung';
import { EldaError } from './errors';
import { FELDER_E29 } from './felder-e29';
import type { BestandOptionen } from './bestand';

const BASIS = { REFW: 'REF-1', BKNR: '1234567', DGNA: 'Muster GmbH', VSNR: '1234010180' };

/** Rahmenangaben für einen Bestand, wie in bestand.test.ts — nur hier lokal, um Durchstich-Tests unabhängig zu halten. */
const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '11',
  datentraegernummer: '000001',
  erstellt: new Date('2026-02-03T09:30:15+01:00'),
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

test('jede Satzart trägt ihren Code', () => {
  assert.equal(
    anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', BBER: '05', GERF: 'N', FRDV: 'N' })
      .satzart,
    'M3',
  );
  assert.equal(
    abmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', GERF: 'N', AGRD: '01' }).satzart,
    'M4',
  );
  assert.equal(aenderungsmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026' }).satzart, 'M6');
  assert.equal(
    richtigstellungAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026', RDAT: '02022026' }).satzart,
    'M8',
  );
  assert.equal(
    richtigstellungAbmeldung({
      ...BASIS,
      REFU: 'U',
      ADAT: '01022026',
      RDAT: '02022026',
      GERF: 'N',
      AGRD: '01',
    }).satzart,
    'M9',
  );
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
    () =>
      anmeldung({
        ...BASIS,
        FANA: 'Maier',
        VONA: 'Anna',
        ADAT: '01012026',
        BBER: '01',
        GERF: 'N',
        FRDV: 'N',
      }),
    (err: unknown) => {
      assert.match((err as Error).message, /F7115/);
      return true;
    },
  );
});

test('der Satz enthält die Werte an den Positionen des Dokuments', () => {
  const satz = anmeldung({
    ...BASIS,
    FANA: 'Maier',
    VONA: 'Anna',
    ADAT: '01022026',
    BBER: '05',
    GERF: 'N',
    FRDV: 'N',
  });
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

test('wochenarbeitszeit: gebrochene Stunden- oder Minutenangaben werfen statt falsch zu runden', () => {
  // 1,005 Stunden * 100 landet in Gleitkomma bei 100,49999999999999 statt 100,5 und würde ohne
  // diese Prüfung auf '0100' statt korrekt '0101' abrunden — siehe JSDoc von wochenarbeitszeit.
  assert.throws(() => wochenarbeitszeit(1.005), EldaError);
  assert.throws(() => wochenarbeitszeit(1, 0.5), EldaError);
});

// A1 (Review): Nichts außer diesem Test hält die 38 Feldnamen von MeldungsFelder gegen die
// Feldtabelle fest. Ein verschriebener oder fehlender Name (z. B. VWAZ -> VWZA) lässt den
// zugehörigen Wert beim Spreizen in das Werteobjekt stillschweigend fallen, ohne dass eine der
// bisherigen Satzart-Prüfungen das bemerkt, weil keiner der bisherigen Tests jedes Feld befüllt.
// Required<MeldungsFelder> zwingt TypeScript bereits beim Kompilieren dazu, dass genau die
// Schlüssel unten existieren; der Mengenvergleich zur Laufzeit sichert zusätzlich ab, dass sich
// FELDER_E29 und MeldungsFelder nicht auseinanderentwickeln, ohne dass ein Test das anzeigt.
test('MeldungsFelder deckt exakt die Feldnamen aus FELDER_E29 ohne IDTEIL ab', () => {
  const alle: Required<MeldungsFelder> = {
    REFW: 'x',
    REFU: 'x',
    BKNR: 'x',
    DGNA: 'x',
    DTEL: 'x',
    MAIL: 'x',
    INF1: 'x',
    INF2: 'x',
    VSNR: 'x',
    GEBD: 'x',
    REFV: 'x',
    FANA: 'x',
    VONA: 'x',
    ADAT: 'x',
    BDAT: 'x',
    RDAT: 'x',
    BBER: 'x',
    GERF: 'x',
    FRDV: 'x',
    EBSV: 'x',
    AGRD: 'x',
    SAGR: 'x',
    KEAB: 'x',
    KEBI: 'x',
    UEAB: 'x',
    UEBI: 'x',
    BVAB: 'x',
    BVEN: 'x',
    BVJN: 'x',
    UMDA: 'x',
    RUMD: 'x',
    SOUM: 'x',
    ZTUM: 'x',
    ZKUM: 'x',
    RWUM: 'x',
    RUUM: 'x',
    BKUM: 'x',
    VWAZ: 'x',
  };
  const erwartet = new Set(FELDER_E29.map((f) => f.name).filter((name) => name !== 'IDTEIL'));
  assert.deepEqual(new Set(Object.keys(alle)), erwartet);
});

// A2 (Review): erstelleBestand war bisher in keiner Testdatei erreicht. Baut eine vollständige
// Anmeldung (inkl. VWAZ) und prüft den Durchstich bis auf Byteebene: Gesamtlänge von drei Sätzen
// (Vorlauf-, Meldungs-, Schlusssatz) sowie VWAZ an seiner dokumentierten Position (Feldtabelle
// E.29: pos 769, Länge 4) innerhalb des zweiten Satzes.
test('erstelleBestand: Anmeldung landet vollständig und an der richtigen Byteposition im Bestand', () => {
  const satz = anmeldung({
    ...BASIS,
    FANA: 'Maier',
    VONA: 'Anna',
    ADAT: '01022026',
    BBER: '01',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: wochenarbeitszeit(40),
  });
  const bestand = erstelleBestand([satz], OPT);
  assert.equal(bestand.length, 772 * 3);
  const meldungssatzStart = 772;
  const vwazStart = meldungssatzStart + (769 - 1);
  assert.equal(bestand.subarray(vwazStart, vwazStart + 4).toString('latin1'), '4000');
});

// A4 (Review): Aus TypeScript heraus verhindert Required<MeldungsFelder>/MeldungsFelder selbst
// keinen unbekannten Feldnamen bei einem Typbruch (hier über `as unknown as`, stellvertretend für
// einen Aufruf aus JavaScript oder einen verschriebenen Feldnamen). Der Builder nimmt die
// Abweisung bewusst nicht vorweg — sie geschieht erst in baueSatz, also erst beim tatsächlichen
// Bau des Bestands, aber immer noch bevor auch nur ein Byte geschrieben wird.
test('ein unbekanntes Feld übersteht den Builder, wird aber vor dem Schreiben abgewiesen', () => {
  const felder = {
    ...BASIS,
    FANA: 'Maier',
    VONA: 'Anna',
    ADAT: '01022026',
    BBER: '05',
    GERF: 'N',
    FRDV: 'N',
    UNBEKANNTESFELD: 'x',
  } as unknown as MeldungsFelder;
  const satz = anmeldung(felder);
  assert.throws(
    () => erstelleBestand([satz], OPT),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /UNBEKANNTESFELD/);
      return true;
    },
  );
});
