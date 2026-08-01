import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  erstelleMbgmPaket,
  VERRECHNUNGSGRUNDLAGE,
  type Beitragsgrundlagenmeldung,
  type PaketOptionen,
} from './mbgm';
import { EldaError } from './errors';

const OPT: PaketOptionen = {
  verfahren: 'selbstabrechnung',
  paketreferenzwert: 'PAKET-2026-07',
  beitragskontonummer: '1234567890',
  dienstgebername: 'Musterbetrieb',
  beitragszeitraum: '072026',
  jaehrlicheAbrechnungGeringfuegiger: false,
};

const MELDUNG: Beitragsgrundlagenmeldung = {
  referenzwert: 'M-0001',
  versicherungsnummer: '1234010180',
  familienname: 'Musterfrau',
  vorname: 'Oryna',
  verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
  tarifbloecke: [
    {
      beschaeftigtengruppe: 'B002',
      beginnDerVerrechnung: 1,
      basen: [
        {
          typ: 'AB',
          betragCent: 179777,
          positionen: [{ typ: 'T01', prozentsatz: 38.15, betragCent: 68584 }],
        },
      ],
    },
  ],
};

test('die Satzfolge steht in der Reihenfolge, die das Dokument verlangt', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PS', 'G1', 'T1', 'BS', 'V1', 'PE'],
  );
});

test('das Vorschreibeverfahren erzeugt durchgehend die anderen Satzarten', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], { ...OPT, verfahren: 'vorschreibung' });
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PV', 'G2', 'T1', 'BV', 'V2', 'PE'],
  );
});

test('Gesamtsumme und Anzahl werden gerechnet, nicht entgegengenommen', () => {
  const zwei = erstelleMbgmPaket([MELDUNG, { ...MELDUNG, referenzwert: 'M-0002' }], OPT);
  const paket = zwei[0];
  assert.equal(paket?.werte.ANZM, '2');
  assert.equal(paket?.werte.GSUM, String(68584 * 2));
  assert.equal(paket?.werte.GSVZ, '+');
  // Der Ende-Satz traegt nur Referenzwert und Anzahl.
  const ende = zwei[zwei.length - 1];
  assert.equal(ende?.satzart, 'PE');
  assert.equal(ende?.werte.ANZM, '2');
  assert.equal(ende?.werte.BKNR, undefined);
});

test('ein negativer Beitrag setzt das Vorzeichenfeld, nicht ein Minus im Betrag', () => {
  const saetze = erstelleMbgmPaket(
    [
      {
        ...MELDUNG,
        tarifbloecke: [
          {
            ...MELDUNG.tarifbloecke[0]!,
            basen: [
              {
                typ: 'AB',
                betragCent: 179777,
                positionen: [{ typ: 'A01', prozentsatz: -3, betragCent: -5393 }],
              },
            ],
          },
        ],
      },
    ],
    OPT,
  );
  const pos = saetze.find((s) => s.satzart === 'V1');
  assert.equal(pos?.werte.RSVZ, '-');
  assert.equal(pos?.werte.RSUM, '5393', 'der Betrag selbst bleibt vorzeichenlos');
  assert.equal(pos?.werte.VPVZ, '-');
  assert.equal(pos?.werte.VPTA, '3000', '3 % sind 3000 Tausendstel');
});

test('der Prozentsatz wird auf drei Nachkommastellen abgebildet', () => {
  const mit = (p: number) =>
    erstelleMbgmPaket(
      [
        {
          ...MELDUNG,
          tarifbloecke: [
            {
              ...MELDUNG.tarifbloecke[0]!,
              basen: [
                { typ: 'AB', betragCent: 1, positionen: [{ typ: 'T01', prozentsatz: p, betragCent: 0 }] },
              ],
            },
          ],
        },
      ],
      OPT,
    ).find((s) => s.satzart === 'V1')?.werte.VPTA;
  assert.equal(mit(12.75), '12750');
  assert.equal(mit(0.125), '125');
  assert.equal(mit(38.15), '38150');
});

test('ein zu grosser Prozentsatz wird abgewiesen statt gekuerzt', () => {
  assert.throws(
    () =>
      erstelleMbgmPaket(
        [
          {
            ...MELDUNG,
            tarifbloecke: [
              {
                ...MELDUNG.tarifbloecke[0]!,
                basen: [
                  {
                    typ: 'AB',
                    betragCent: 1,
                    positionen: [{ typ: 'T01', prozentsatz: 1000, betragCent: 0 }],
                  },
                ],
              },
            ],
          },
        ],
        OPT,
      ),
    /999,999/,
  );
});

test('Bruchteile eines Cent werden abgewiesen', () => {
  assert.throws(
    () =>
      erstelleMbgmPaket(
        [
          {
            ...MELDUNG,
            tarifbloecke: [
              { ...MELDUNG.tarifbloecke[0]!, basen: [{ typ: 'AB', betragCent: 179777.5, positionen: [] }] },
            ],
          },
        ],
        OPT,
      ),
    /ganze Zahl/,
  );
});

test('weder VSNR noch REFV: die Alternativgruppe wird erzwungen', () => {
  const ohne = { ...MELDUNG, versicherungsnummer: undefined };
  assert.throws(
    () => erstelleMbgmPaket([ohne], OPT),
    (e: unknown) => {
      assert.ok(e instanceof EldaError);
      assert.match(e.message, /VSNR-Anforderung/);
      return true;
    },
  );
  // Mit REFV statt VSNR geht es durch.
  const mitRefv = { ...ohne, referenzVsnrAnforderung: 'VSNR-ANF-1' };
  const saetze = erstelleMbgmPaket([mitRefv], OPT);
  const g1 = saetze.find((s) => s.satzart === 'G1');
  assert.equal(g1?.werte.REFV, 'VSNR-ANF-1');
  assert.equal(g1?.werte.VSNR, undefined);
});

test('ohne Versicherungszeit muss der Verrechnungsbeginn 1 sein', () => {
  const ohneZeit = {
    ...MELDUNG,
    verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_OHNE_ZEIT,
    tarifbloecke: [{ ...MELDUNG.tarifbloecke[0]!, beginnDerVerrechnung: 15 }],
  };
  assert.throws(() => erstelleMbgmPaket([ohneZeit], OPT), /D\.63/);
  const gut = { ...ohneZeit, tarifbloecke: [{ ...MELDUNG.tarifbloecke[0]!, beginnDerVerrechnung: 1 }] };
  assert.doesNotThrow(() => erstelleMbgmPaket([gut], OPT));
});

test('ein Basistyp darf im Tarifblock nur einmal vorkommen', () => {
  const doppelt = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        basen: [
          { typ: 'AB' as const, betragCent: 1, positionen: [] },
          { typ: 'AB' as const, betragCent: 2, positionen: [] },
        ],
      },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([doppelt], OPT), /nur einmal verwendet/);
});

test('KEUE ist im Tarifblock ohne Verrechnung gesperrt', () => {
  const t4 = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        ohneVerrechnung: true,
        enthaeltKuendigungsentschaedigungOderUrlaubsersatz: true,
      },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([t4], OPT), /gesperrt/);
  const gut = { ...MELDUNG, tarifbloecke: [{ ...MELDUNG.tarifbloecke[0]!, ohneVerrechnung: true }] };
  const saetze = erstelleMbgmPaket([gut], OPT);
  assert.equal(saetze.find((s) => s.satzart.startsWith('T'))?.satzart, 'T4');
});

test('hoechstens fuenf Ergaenzungen', () => {
  const sechs = {
    ...MELDUNG,
    tarifbloecke: [{ ...MELDUNG.tarifbloecke[0]!, ergaenzungen: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06'] }],
  };
  assert.throws(() => erstelleMbgmPaket([sechs], OPT), /fünf Ergänzungen/);
});

test('der Beitragszeitraum muss MMJJJJ sein', () => {
  assert.throws(() => erstelleMbgmPaket([MELDUNG], { ...OPT, beitragszeitraum: '72026' }), /MMJJJJ/);
  assert.throws(() => erstelleMbgmPaket([MELDUNG], { ...OPT, beitragszeitraum: '2026-07' }), /MMJJJJ/);
});

test('unbekannte Codes werden abgewiesen', () => {
  const falsch = {
    ...MELDUNG,
    tarifbloecke: [
      { ...MELDUNG.tarifbloecke[0]!, basen: [{ typ: 'XX' as never, betragCent: 1, positionen: [] }] },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([falsch], OPT), /Verrechnungsbasis-Typ/);
});
