import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  antragZwischenstaatlich,
  stornoAntragZwischenstaatlich,
  erstelleEsBestand,
  type AntragFelder,
  type EsDienstgeber,
} from './zwischenstaatlich';
import { FELDER_E27, SATZLAENGE_E27 } from './felder-e27';
import { pruefeFeldtabelle } from './festsatz';
import { PFLICHT_E27, PFLICHT_E27_STORNO } from './pflicht-e27';
import { SATZTRENNER, type BestandOptionen } from './bestand';
import { EldaError } from './errors';

// Erfundene Daten: Ersatznamen und BKNR aus dem gemeinsamen Satz der Repos.
const UUID_A = '0f8b6c1e-3d2a-4c5b-9e7f-1a2b3c4d5e6f';
const UUID_B = '6a1d0c2b-7e8f-4a9b-8c0d-2e3f4a5b6c7d';
const UUID_C = 'c3d4e5f6-0718-4293-a4b5-c6d7e8f90a1b';

const PERSON = {
  VONA: 'Mirela',
  FANA: 'Weinzierl',
  GESL: '2',
  GEBD: '01011980',
  VSNR: '1234010180',
  STSL: 'AT',
  STRA: 'Musterstraße 1',
  WKFZ: 'AT',
  PLZL: '5020',
  WORT: 'Salzburg',
};

const DG: EsDienstgeber = {
  DGNA: 'Max Hollerer GmbH',
  BKNR: '4711815',
  VTBK: '15',
  DGSTR: 'Hauptplatz 3',
  DGKFZ: 'AT',
  DGPLZ: '8010',
  DGORT: 'Graz',
  DGWS: '04',
  BBEG: '01032027',
  BEND: '30062027',
};

const E1: AntragFelder = {
  UIDM: UUID_A,
  ...PERSON,
  dienstgeber: [DG],
  DGPS: 'J',
  AGSTAAT: 'DE',
  BFEST: 'J',
  AGNA: 'Beispiel Montage GmbH',
  AGSTR: 'Beispielweg 2',
  AGPLZ: '80331',
  AGORT: 'München',
  ANABL: 'N',
  BUEL: 'N',
  ANFL: 'N',
};

const MEHRSTAATEN = {
  ANKZ: 'N',
  BEAT: 'N',
};

const E2: AntragFelder = {
  UIDM: UUID_B,
  ...PERSON,
  dienstgeber: [{ ...DG, ...MEHRSTAATEN }],
  ANATJ: 'J',
  arbeitsorte: [
    {
      AOST: 'AT',
      AOKBS: 'J',
      AOFNSN: 'Max Hollerer GmbH',
      AOSTRA: 'Hauptplatz 3',
      AOPLZL: '8010',
      AOORT: 'Graz',
    },
    { AOST: 'SI', AOKBS: 'N' },
  ],
  AZRV: '01032027',
  AZRB: '29022028',
  ANFL: 'N',
};

const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '15',
  datentraegernummer: '000001',
  erstellt: new Date('2027-02-03T09:30:15+01:00'),
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

const fehlercode = (fn: () => unknown, code: string): void =>
  assert.throws(fn, (e: unknown) => e instanceof EldaError && e.message.startsWith(`${code}:`), code);

const wirft = (fn: () => unknown, muster: RegExp): void =>
  assert.throws(fn, (e: unknown) => e instanceof EldaError && muster.test(e.message));

/** Liest Feld `name` aus einem gebauten Satz (ohne Identifikationsteil-Bezug). */
function feld(satz: string, name: string): string {
  const f = FELDER_E27.find((x) => x.name === name)!;
  return satz.slice(f.pos - 1, f.pos - 1 + f.laenge);
}

test('Feldtabelle E.27: lückenlos, 9028 Zeichen, Blockgrenzen wie im Dokument', () => {
  pruefeFeldtabelle(FELDER_E27, SATZLAENGE_E27);
  const pos = (name: string): number => FELDER_E27.find((f) => f.name === name)!.pos;
  // Abgedruckte Positionen der Felder nach den Blöcken (Seiten 292–294).
  assert.equal(pos('DGNA_1'), 435);
  assert.equal(pos('DGPS'), 2430);
  assert.equal(pos('STFNA_1'), 2718);
  assert.equal(pos('UIDM'), 3828);
  assert.equal(pos('AOST_1'), 4099);
  assert.equal(pos('AZRV'), 8995);
  // Blocklängen 399, 370, 153.
  assert.equal(pos('DGNA_2') - pos('DGNA_1'), 399);
  assert.equal(pos('STFNA_2') - pos('STFNA_1'), 370);
  assert.equal(pos('AOST_2') - pos('AOST_1'), 153);
  assert.equal(pos('AOST_32'), 4099 + 31 * 153);
});

test('Pflichtmatrix: Storno lässt nur MART, UIDM, UIDU und BKNR zu', () => {
  for (const sa of ['E1', 'E2', 'E3', 'E4', 'E5', 'EA'] as const) {
    const belegbar = Object.entries(PFLICHT_E27_STORNO[sa])
      .filter(([, s]) => s !== '-')
      .map(([f]) => f);
    assert.deepEqual(belegbar.sort(), ['BKNR', 'MART', 'UIDM', 'UIDU']);
    assert.equal(PFLICHT_E27[sa].UIDU, '-', `UIDU bei ${sa} in der Meldung`);
  }
});

test('E1 Entsendung: Satz mit 9028 Zeichen, Felder an ihrer Stelle', () => {
  const satz = antragZwischenstaatlich('E1', E1);
  assert.equal(satz.satzart, 'E1');
  assert.equal(satz.satzlaenge, 9028);
  const bestand = erstelleEsBestand([satz], OPT).toString('latin1');
  const zeilen = bestand.split(SATZTRENNER.toString('latin1'));
  assert.equal(zeilen.length, 3);
  const [vorlauf, antrag] = zeilen as [string, string];
  assert.equal(vorlauf.length, 9028, 'Vorlaufsatz trägt die Satzlänge des Bestands');
  assert.equal(vorlauf.slice(22, 24), 'ES');
  assert.equal(vorlauf.slice(149, 151), '08');
  assert.equal(antrag.length, 9028);
  assert.equal(antrag.slice(0, 2), 'E1');
  assert.equal(antrag.slice(18, 20), '15');
  assert.equal(feld(antrag, 'MART'), '01');
  assert.equal(feld(antrag, 'FANA').trimEnd(), 'Weinzierl');
  assert.equal(feld(antrag, 'BKNR_1'), '4711815   ');
  assert.equal(feld(antrag, 'VTBK_1'), '15');
  assert.equal(feld(antrag, 'AGSTAAT'), 'DE');
  assert.equal(feld(antrag, 'UIDM').trimEnd(), UUID_A);
  assert.equal(feld(antrag, 'UIDU').trim(), '');
  assert.equal(feld(antrag, 'DGNA_2').trim(), '', 'zweiter Dienstgeberplatz bleibt leer');
});

test('E2: ein Dienstgeber, Arbeitsorte, ANATJ verlangt Österreich unter den Arbeitsorten', () => {
  antragZwischenstaatlich('E2', E2);
  fehlercode(
    () => antragZwischenstaatlich('E2', { ...E2, arbeitsorte: [{ AOST: 'SI', AOKBS: 'N' }] }),
    'F7650',
  );
  wirft(() => antragZwischenstaatlich('E2', { ...E2, arbeitsorte: [] }), /Block Arbeitsort ist 0-mal belegt/);
});

test('E3: mindestens zwei Dienstgeber, MARGDG zwingend', () => {
  const zweiter: EsDienstgeber = {
    ...DG,
    ...MEHRSTAATEN,
    DGNA: 'Kleiderservice Nadler KG',
    BKNR: undefined,
    VTBK: undefined,
    DGKFZ: 'SI',
    DGSTR: 'Testna ulica 4',
    DGPLZ: '1000',
    DGORT: 'Ljubljana',
    MARGDG: 'N',
  };
  const e3 = { ...E2, dienstgeber: [{ ...DG, ...MEHRSTAATEN, MARGDG: 'N' }, zweiter] };
  antragZwischenstaatlich('E3', e3);
  wirft(
    () => antragZwischenstaatlich('E3', { ...e3, dienstgeber: [e3.dienstgeber[0]!] }),
    /1-mal belegt, zulässig 2 bis 5/,
  );
  wirft(
    () => antragZwischenstaatlich('E3', { ...e3, dienstgeber: [{ ...DG, ...MEHRSTAATEN }, zweiter] }),
    /MARGDG_1 ist zwingend/,
  );
});

test('E4: selbständige Tätigkeit und AUET sind zwingend', () => {
  const e4: AntragFelder = {
    ...E2,
    dienstgeber: [{ ...DG, ...MEHRSTAATEN, MARGDG: 'N' }],
    selbstaendig: [
      {
        STFNA: "Blumen G'schenk e.U.",
        STSTR: 'Marktgasse 5',
        STKFZ: 'SI',
        STPLZ: '2000',
        STORT: 'Maribor',
        STAS: '01012025',
        START: 'Blumenhandel',
        MARGST: 'N',
      },
    ],
    arbeitsorte: [
      { AOST: 'AT', AOKBS: 'N', AUET: 'U' },
      { AOST: 'SI', AOKBS: 'N', AUET: 'S' },
    ],
  };
  antragZwischenstaatlich('E4', e4);
  wirft(
    () => antragZwischenstaatlich('E4', { ...e4, selbstaendig: [] }),
    /selbständige Tätigkeit ist 0-mal belegt/,
  );
  fehlercode(
    () => antragZwischenstaatlich('E4', { ...e4, arbeitsorte: [{ AOST: 'AT', AOKBS: 'N', AUET: 'X' }] }),
    'F7652_1',
  );
});

test('E5: Staat mit bilateralem Abkommen, kein Wirtschaftssektor', () => {
  const e5: AntragFelder = {
    ...E1,
    dienstgeber: [{ ...DG, DGWS: undefined }],
    DGPS: undefined,
    ANABL: undefined,
    BUEL: undefined,
    ANFL: undefined,
    AGSTAAT: 'RS',
    AGORT: 'Beograd',
    AGPLZ: '11000',
    ANIV: 'N',
  };
  antragZwischenstaatlich('E5', e5);
  fehlercode(() => antragZwischenstaatlich('E5', { ...e5, AGSTAAT: 'DE' }), 'F7611');
  // Japan erst für Entsendungen ab 01.12.2025 (Prüfkatalog F7527).
  fehlercode(
    () =>
      antragZwischenstaatlich('E5', {
        ...e5,
        AGSTAAT: 'JP',
        dienstgeber: [{ ...DG, DGWS: undefined, BBEG: '01112025', BEND: '31122025' }],
      }),
    'F7527',
  );
  wirft(() => antragZwischenstaatlich('E5', { ...e5, dienstgeber: [DG] }), /DGWS_1 ist in Grundstellung/);
});

test('EA: Telearbeit geht an den Dachverband (VSTR 99)', () => {
  const ea: AntragFelder = {
    UIDM: UUID_C,
    ...PERSON,
    dienstgeber: [{ ...DG, BBEG: undefined, BEND: undefined }],
    arbeitsorte: [
      {
        AOST: 'DE',
        AOKBS: 'J',
        AOFNSN: 'Wohnung',
        AOSTRA: 'Beispielweg 2',
        AOPLZL: '83395',
        AOORT: 'Freilassing',
      },
    ],
    AUSMTE: 'J',
    ANTVON: '01012027',
    ANTBIS: '31122028',
  };
  const satz = antragZwischenstaatlich('EA', ea);
  erstelleEsBestand([satz], { ...OPT, versicherungstraeger: '99' });
  wirft(() => erstelleEsBestand([satz], OPT), /VSTR muss 99 sein/);
  wirft(() => antragZwischenstaatlich('EA', { ...ea, GEBO: 'Salzburg' }), /GEBO ist in Grundstellung/);
});

test('E1: Österreich als Entsendestaat, AGSTAAT außerhalb der Tabelle, Japan ist kein E1-Staat', () => {
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, AGSTAAT: 'AT' }), 'F7611');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, AGSTAAT: 'JP' }), 'F7611');
});

test('E1: Pflichtfelder, Blöcke und Bedingungen', () => {
  wirft(() => antragZwischenstaatlich('E1', { ...E1, AGSTAAT: undefined }), /AGSTAAT ist zwingend/);
  wirft(
    () => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [DG, DG] }),
    /2-mal belegt, zulässig genau 1/,
  );
  wirft(() => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [] }), /0-mal belegt/);
  wirft(
    () => antragZwischenstaatlich('E1', { ...E1, arbeitsorte: [{ AOST: 'DE' }] }),
    /AOST_1 ist in Grundstellung/,
  );
  wirft(
    () => antragZwischenstaatlich('E1', { ...E1, UIDU: UUID_B } as AntragFelder),
    /UIDU ist in Grundstellung/,
  );
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, AGNA: undefined }), 'F7511');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, ANABL: 'J' }), 'F7629');
  antragZwischenstaatlich('E1', { ...E1, ANABL: 'J', ANABLJ: 'Ablöse nach Krankheit' });
  // Ohne feste Beschäftigungsstelle braucht es keine Anschrift im Beschäftigungsstaat.
  antragZwischenstaatlich('E1', {
    ...E1,
    BFEST: 'N',
    AGNA: undefined,
    AGSTR: undefined,
    AGPLZ: undefined,
    AGORT: undefined,
  });
});

test('Inhaltsregeln des Prüfkatalogs (Blatt ES und Allgemein)', () => {
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, GESL: '5' }), 'F0082');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, GEBD: '31022000' }), 'F7587');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, VSNR: '1234011680' }), 'F7589');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, WKFZ: 'A' }), 'F7616');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, UIDM: 'keine-uuid' }), 'F7662');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, BFEST: 'X' }), 'F7526');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, ANFL: 'J' }), 'F7663');
  antragZwischenstaatlich('E1', { ...E1, ANFL: 'J', STSL: 'SY' });
  fehlercode(
    () => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, BEND: '28022027' }] }),
    'F7524_1',
  );
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, DGWS: '13' }] }), 'F7509_1');
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, DGKFZ: 'A' }] }), 'F7506_1');
});

test('Beitragskontonummer und beitragskontoführender Träger', () => {
  // Länge je Träger (F0162–F0171): bei 14 acht oder zehn Stellen.
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, VTBK: '14' }] }), 'F0165');
  antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, VTBK: '14', BKNR: '47118150' }] });
  antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, BKNR: '1471181500' }] });
  // „NEU" nur bei E1, E2, E5 (F0011).
  antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, BKNR: 'NEU' }] });
  const e3 = {
    ...E2,
    dienstgeber: [
      { ...DG, ...MEHRSTAATEN, MARGDG: 'N', BKNR: 'NEU' },
      { ...DG, ...MEHRSTAATEN, MARGDG: 'N' },
    ],
  };
  fehlercode(() => antragZwischenstaatlich('E3', e3), 'F0011');
  fehlercode(
    () => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, BKNR: ' 4711815' }] }),
    'F0012',
  );
  // VTBK: 05 nur bei E1 (F7661_n bzw. F7660_n).
  antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, VTBK: '05', BKNR: '12345' }] });
  fehlercode(
    () => antragZwischenstaatlich('E2', { ...E2, dienstgeber: [{ ...DG, ...MEHRSTAATEN, VTBK: '05' }] }),
    'F7660_1',
  );
  fehlercode(() => antragZwischenstaatlich('E1', { ...E1, dienstgeber: [{ ...DG, VTBK: '20' }] }), 'F7661_1');
  // E2–E4: Sitz in Österreich verlangt BKNR (F0183) und VTBK (F7661); BKNR verlangt VTBK (F7664_n).
  fehlercode(
    () =>
      antragZwischenstaatlich('E2', {
        ...E2,
        dienstgeber: [{ ...DG, ...MEHRSTAATEN, BKNR: undefined, VTBK: undefined }],
      }),
    'F0183',
  );
  fehlercode(
    () => antragZwischenstaatlich('E2', { ...E2, dienstgeber: [{ ...DG, ...MEHRSTAATEN, VTBK: undefined }] }),
    'F7661',
  );
  fehlercode(
    () =>
      antragZwischenstaatlich('E2', {
        ...E2,
        dienstgeber: [{ ...DG, ...MEHRSTAATEN, DGKFZ: 'SI', VTBK: undefined }],
      }),
    'F7664_1',
  );
  // Heimatbasis bei Flug-/Kabinenbesatzung (F7599_n, F7563_n).
  fehlercode(
    () => antragZwischenstaatlich('E2', { ...E2, dienstgeber: [{ ...DG, ...MEHRSTAATEN, ANKZ: 'J' }] }),
    'F7599_1',
  );
  fehlercode(
    () =>
      antragZwischenstaatlich('E2', {
        ...E2,
        dienstgeber: [{ ...DG, ...MEHRSTAATEN, ANKZ: 'J', STAATHB: 'US' }],
      }),
    'F7563_1',
  );
});

test('Storno: neue UIDM, UIDU des Antrags, sonst Grundstellung', () => {
  const s = stornoAntragZwischenstaatlich('E1', { UIDM: UUID_B, UIDU: UUID_A });
  assert.equal(s.werte.MART, '02');
  const mitBknr = stornoAntragZwischenstaatlich('E1', { UIDM: UUID_B, UIDU: UUID_A, BKNR: ['4711815'] });
  assert.equal(mitBknr.werte.BKNR_1, '4711815');
  fehlercode(() => stornoAntragZwischenstaatlich('E1', { UIDM: UUID_A, UIDU: UUID_A }), 'F7634');
  wirft(() => stornoAntragZwischenstaatlich('E1', { UIDM: UUID_B } as never), /UIDU ist zwingend/);
  wirft(
    () => stornoAntragZwischenstaatlich('E1', { UIDM: UUID_B, UIDU: UUID_A, VONA: 'Mirela' } as never),
    /VONA ist in Grundstellung/,
  );
  // Kapitel D.68 druckt diese UUID als Beispiel ab.
  stornoAntragZwischenstaatlich('E1', { UIDM: '550e8400-e29b-11d4-a716-446655440000', UIDU: UUID_A });
});

test('Bestand: zuständiger Träger je Satzart, UIDM eindeutig, nur E.27-Sätze', () => {
  const e1 = antragZwischenstaatlich('E1', E1);
  const e2 = antragZwischenstaatlich('E2', E2);
  erstelleEsBestand([e1, e2], OPT);
  wirft(() => erstelleEsBestand([e1], { ...OPT, versicherungstraeger: '99' }), /nur für die Satzart EA/);
  erstelleEsBestand([e1], { ...OPT, versicherungstraeger: '05' });
  wirft(() => erstelleEsBestand([e2], { ...OPT, versicherungstraeger: '05' }), /nur die Satzart E1/);
  wirft(() => erstelleEsBestand([e1], { ...OPT, versicherungstraeger: '08' }), /nicht vorgesehen/);
  fehlercode(() => erstelleEsBestand([e1, antragZwischenstaatlich('E1', E1)], OPT), 'F7634');
  wirft(() => erstelleEsBestand([{ ...e1, felder: [] }], OPT), /gehört nicht zu Kapitel E.27/);
});

test('Builder lehnt unbekannte Felder und Satzarten ab', () => {
  wirft(() => antragZwischenstaatlich('E1', { ...E1, REFW: 'x' } as never), /Unbekanntes Feld 'REFW'/);
  wirft(() => antragZwischenstaatlich('E9' as never, E1), /Satzart 'E9'/);
  wirft(
    () =>
      antragZwischenstaatlich('E2', {
        ...E2,
        arbeitsorte: Array.from({ length: 33 }, () => ({ AOST: 'AT', AOKBS: 'N' })),
      }),
    /32 Plätze/,
  );
});
