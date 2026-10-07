import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  erstelleLohnzettelBestand,
  lohnzettelSaetze,
  VSTR_LOHNZETTEL,
  type LohnzettelUebermittlung,
} from './lohnzettel';
import { FELDER_L1 } from './felder-e14';
import { BESTAND_OPT, LOHNZETTEL_2026, UEBERMITTLUNG_2026 } from './testdaten-l16.test';

const zeilen = (bestand: Buffer) => bestand.toString('latin1').split('\r\n');

/** Ausschnitt eines Satzes nach Position und Länge laut Feldtabelle (1-basiert). */
const feld = (satz: string, name: string, version: '28' | '29' = '28') => {
  const f = FELDER_L1[version].find((x) => x.name === name)!;
  return satz.slice(f.pos - 1, f.pos - 1 + f.laenge);
};

const fehler = (teil: string) => (e: unknown) => e instanceof Error && e.message.includes(teil);

test('Bestand LF: Vorlauf, Informationssatz, Lohnzettel, Schlusssatz in den Längen aus E.2/E.13/E.14', () => {
  const z = zeilen(erstelleLohnzettelBestand(UEBERMITTLUNG_2026, BESTAND_OPT));
  assert.deepEqual(
    z.map((s) => s.length),
    [3500, 1100, 3500, 3500],
  );
  // Vorlaufsatz: Projekt TM, Bestand LF, Version 28 (Feld VERS auf Position 150)
  assert.equal(z[0]!.slice(20, 24), 'TMLF');
  assert.equal(z[0]!.slice(149, 151), '28');
  // Identifikationsteil: Satzart, laufende Nummer, UVST ED, VSTR 94
  assert.equal(z[1]!.slice(0, 2), 'I1');
  assert.equal(z[2]!.slice(0, 2), 'L1');
  for (const s of z) assert.equal(s.slice(18, 20), VSTR_LOHNZETTEL);
  assert.equal(z[3]!.slice(20, 26), '000004');
});

test('Informationssatz: Finanz-Satzart, Art der Daten, Strukturversion, Jahr und Anzahl', () => {
  const [i1] = lohnzettelSaetze(UEBERMITTLUNG_2026, BESTAND_OPT.erstellt);
  assert.equal(i1!.werte.FSART, 'I');
  assert.equal(i1!.werte.ARTD, 'LZ');
  assert.equal(i1!.werte.STVE, '03');
  assert.equal(i1!.werte.JAHR, '2026');
  assert.equal(i1!.werte.ANZA, '1');
  assert.equal(i1!.werte.GESA, '1');
});

test('DTUE/ZTUE: gleiche Wiener Ortszeit in Informationssatz und Lohnzettel (E.13 Feld 12)', () => {
  const [i1, l1] = lohnzettelSaetze(UEBERMITTLUNG_2026, BESTAND_OPT.erstellt);
  assert.equal(i1!.werte.DTUE, '20270115');
  assert.equal(i1!.werte.ZTUE, '093005');
  assert.equal(l1!.werte.DTUE, i1!.werte.DTUE);
  assert.equal(l1!.werte.ZTUE, i1!.werte.ZTUE);
  // Sommerzeit: 12:00 UTC am 15.07. ist 14:00 in Wien
  const [sommer] = lohnzettelSaetze(UEBERMITTLUNG_2026, new Date('2026-07-15T12:00:00Z'));
  assert.equal(sommer!.werte.ZTUE, '140000');
});

test('Lohnzettel: JALZ und STNRA kommen aus der Übermittlung, Beträge mit Vorzeichen', () => {
  const z = zeilen(erstelleLohnzettelBestand(UEBERMITTLUNG_2026, BESTAND_OPT));
  const l1 = z[2]!;
  assert.equal(feld(l1, 'JALZ'), '2026');
  assert.equal(feld(l1, 'STNRA'), '911234565');
  assert.equal(feld(l1, 'V210'), '+');
  assert.equal(feld(l1, 'B210'), '0004200000');
  // Betrag 0: Vorzeichen blank, Betrag Grundstellung 0 (Regel unter der Feldtabelle E.14)
  assert.equal(feld(l1, 'V215'), ' ');
  assert.equal(feld(l1, 'B215'), '0000000000');
  assert.equal(feld(l1, 'REFN').trimEnd(), 'DV-2026-0001');
  assert.equal(feld(l1, 'REFN_175').trimEnd(), 'L16-0001');
});

test('Negative Beträge: nur wo die Feldtabelle „-" zulässt', () => {
  const mit = (
    betraege: Record<string, number>,
    version: '28' | '29',
    jahr = version === '28' ? 2026 : 2027,
  ) =>
    lohnzettelSaetze(
      { ...UEBERMITTLUNG_2026, version, jahr, lohnzettel: [{ ...LOHNZETTEL_2026, betraege }] },
      BESTAND_OPT.erstellt,
    );
  assert.equal(mit({ B243: -1234 }, '28')[1]!.werte.V243, '-');
  assert.throws(() => mit({ B210: -1 }, '28'), fehler('V210'));
  assert.throws(() => mit({ BIEL: -1 }, '28'), fehler('VIEL'));
  assert.equal(mit({ BIEL: -1 }, '29')[1]!.werte.VIEL, '-');
  assert.throws(() => mit({ BSBKFZ: -1 }, '28'), fehler('kein Vorzeichenfeld'));
});

test('Beträge nur ganzzahlig in Cent', () => {
  const u: LohnzettelUebermittlung = {
    ...UEBERMITTLUNG_2026,
    lohnzettel: [{ ...LOHNZETTEL_2026, betraege: { B210: 0.2845 * 95000 } }],
  };
  assert.throws(() => lohnzettelSaetze(u, BESTAND_OPT.erstellt), fehler('ganzzahlig'));
});

test('Version und Jahr: Version 29 gilt fachlich erst ab 2027, Version 28 ab 2024', () => {
  assert.throws(
    () => lohnzettelSaetze({ ...UEBERMITTLUNG_2026, version: '29' }, BESTAND_OPT.erstellt),
    fehler('ab 01.01.2027'),
  );
  assert.throws(
    () => lohnzettelSaetze({ ...UEBERMITTLUNG_2026, jahr: 2023 }, BESTAND_OPT.erstellt),
    fehler('ab 01.01.2024'),
  );
  const z = zeilen(
    erstelleLohnzettelBestand({ ...UEBERMITTLUNG_2026, version: '29', jahr: 2027 }, BESTAND_OPT),
  );
  assert.equal(z[0]!.slice(149, 151), '29');
});

test('GESA darf nicht kleiner als die Anzahl der Lohnzettel sein (E.13 Feld 23)', () => {
  const u = {
    ...UEBERMITTLUNG_2026,
    lohnzettel: [
      LOHNZETTEL_2026,
      { ...LOHNZETTEL_2026, felder: { ...LOHNZETTEL_2026.felder, REFN: 'DV-2026-0002' } },
    ],
  };
  assert.throws(() => lohnzettelSaetze(u, BESTAND_OPT.erstellt), fehler('GESA'));
  const ok = lohnzettelSaetze({ ...u, arbeitgeber: { ...u.arbeitgeber, GESA: 2 } }, BESTAND_OPT.erstellt);
  assert.equal(ok[0]!.werte.ANZA, '2');
});

test('Pflichtangaben und Felder, die der Bau selbst setzt', () => {
  const mitFeldern = (felder: Record<string, string | undefined>) =>
    lohnzettelSaetze(
      {
        ...UEBERMITTLUNG_2026,
        lohnzettel: [{ ...LOHNZETTEL_2026, felder: { ...LOHNZETTEL_2026.felder, ...felder } }],
      },
      BESTAND_OPT.erstellt,
    );
  assert.throws(() => mitFeldern({ REFN: '' }), fehler('REFN ist laut Kapitel E.14.1 zwingend'));
  assert.throws(() => mitFeldern({ ENLZ: undefined }), fehler('ENLZ'));
  assert.throws(() => mitFeldern({ DTUE: '20270101' }), fehler('setzt der Bau selbst'));
  assert.throws(() => mitFeldern({ V210: '+' }), fehler('gehört in `betraege`'));
  assert.throws(() => mitFeldern({ STAT: 'X' }), fehler('keine Angabe'));
  assert.throws(() => mitFeldern({ JALZ: '2025' }), fehler('F1704'));
  assert.throws(() => mitFeldern({ STNRA: '911234566' }), fehler('F9900'));
  assert.doesNotThrow(() => mitFeldern({ JALZ: '2026', STNRA: '911234565' }));
  // Stellenfolge TTMM: '101' wird nicht zu '0101' aufgefüllt
  assert.throws(
    () =>
      erstelleLohnzettelBestand(
        {
          ...UEBERMITTLUNG_2026,
          lohnzettel: [{ ...LOHNZETTEL_2026, felder: { ...LOHNZETTEL_2026.felder, BELZ: '101' } }],
        },
        BESTAND_OPT,
      ),
    fehler('TTMM'),
  );
});

test('Kinderblock: bis zu 15 Kinder, Felder mit Kindnummer', () => {
  const kind = {
    KFAM: 'Weinzierl',
    KVON: 'Livia',
    KSTAAT: 'A',
    KVSNR: '1234010180',
    KAFBZ: 'J',
    KBGFP: '01',
    KEGFP: '12',
  };
  const [, l1] = lohnzettelSaetze(
    {
      ...UEBERMITTLUNG_2026,
      lohnzettel: [{ ...LOHNZETTEL_2026, kinder: [kind, { ...kind, KVON: 'Mirela' }] }],
    },
    BESTAND_OPT.erstellt,
  );
  assert.equal(l1!.werte.KFAM_K1, 'Weinzierl');
  assert.equal(l1!.werte.KVON_K2, 'Mirela');
  const zuViele = Array.from({ length: 16 }, () => kind);
  assert.throws(
    () =>
      lohnzettelSaetze(
        { ...UEBERMITTLUNG_2026, lohnzettel: [{ ...LOHNZETTEL_2026, kinder: zuViele }] },
        BESTAND_OPT.erstellt,
      ),
    fehler('16 Kinder'),
  );
  // KBVFP (25 % FABO Plus) gibt es erst in Version 29
  assert.throws(
    () =>
      lohnzettelSaetze(
        { ...UEBERMITTLUNG_2026, lohnzettel: [{ ...LOHNZETTEL_2026, kinder: [{ ...kind, KBVFP: '01' }] }] },
        BESTAND_OPT.erstellt,
      ),
    fehler('KBVFP'),
  );
});
