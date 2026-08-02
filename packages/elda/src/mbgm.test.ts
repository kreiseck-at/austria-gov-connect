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
                positionen: [
                  // T01 ist zur allgemeinen Beitragsgrundlage zwingend (D.60);
                  // der Abschlag kommt daneben.
                  { typ: 'T01', prozentsatz: 39.6, betragCent: 71191 },
                  { typ: 'A01', prozentsatz: -3, betragCent: -5393 },
                ],
              },
            ],
          },
        ],
      },
    ],
    OPT,
  );
  const pos = saetze.filter((s) => s.satzart === 'V1')[1];
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
              {
                ...MELDUNG.tarifbloecke[0]!,
                basen: [
                  {
                    typ: 'AB',
                    betragCent: 179777.5,
                    positionen: [{ typ: 'T01', prozentsatz: 1, betragCent: 1 }],
                  },
                ],
              },
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
          {
            typ: 'AB' as const,
            betragCent: 1,
            positionen: [{ typ: 'T01' as const, prozentsatz: 1, betragCent: 1 }],
          },
          {
            typ: 'AB' as const,
            betragCent: 2,
            positionen: [{ typ: 'T01' as const, prozentsatz: 1, betragCent: 1 }],
          },
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
        // Ein Tarifblock ohne Verrechnung traegt keine Basis (E.32.2.2.3) --
        // sonst schlaegt diese Regel zuerst an und der Test prueft nicht mehr,
        // was er pruefen will.
        basen: [],
        enthaeltKuendigungsentschaedigungOderUrlaubsersatz: true,
      },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([t4], OPT), /gesperrt/);
  const gut = {
    ...MELDUNG,
    tarifbloecke: [{ ...MELDUNG.tarifbloecke[0]!, ohneVerrechnung: true, basen: [] }],
  };
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

// --- Regeln aus E.32.2.2.3 bis .5 -----------------------------------------

test('ein Tarifblock ohne Verrechnung darf keine Basis tragen', () => {
  // E.32.2.2.3: "Diese beinhalten keine Verrechnung, daher ist nachfolgend
  // keine Uebermittlung einer Verrechnungsbasis zulaessig."
  const mitBasis = {
    ...MELDUNG,
    tarifbloecke: [{ ...MELDUNG.tarifbloecke[0]!, ohneVerrechnung: true }],
  };
  assert.throws(() => erstelleMbgmPaket([mitBasis], OPT), /keine Verrechnung/);
});

test('die Verrechnungsposition muss zur Basis passen', () => {
  // D.60: Zur Beitragsgrundlage zur BV gehoert ausschliesslich V01.
  const falsch = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        basen: [
          {
            typ: 'BV' as const,
            betragCent: 1000,
            positionen: [{ typ: 'T01' as const, prozentsatz: 1, betragCent: 10 }],
          },
        ],
      },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([falsch], OPT), /nicht zulässig \(D\.60\)/);

  const richtig = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        basen: [
          {
            typ: 'BV' as const,
            betragCent: 1000,
            positionen: [{ typ: 'V01' as const, prozentsatz: 1.53, betragCent: 15 }],
          },
        ],
      },
    ],
  };
  assert.doesNotThrow(() => erstelleMbgmPaket([richtig], OPT));
});

test('eine zwingende Verrechnungsposition darf nicht fehlen', () => {
  const ohneStandard = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        basen: [
          {
            typ: 'AB' as const,
            betragCent: 1000,
            positionen: [{ typ: 'A01' as const, prozentsatz: -3, betragCent: -30 }],
          },
        ],
      },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([ohneStandard], OPT), /fehlt die zwingende/);
});

test('fuer Basistypen ohne Zuordnung im Dokument wird nicht geprueft', () => {
  // KE, UH und RP fuehrt D.60 in keiner der beiden Tabellen. Eine Ablehnung
  // waere geraten -- also wird dort nichts geprueft.
  const ke = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        basen: [
          {
            typ: 'KE' as const,
            betragCent: 1000,
            positionen: [{ typ: 'T01' as const, prozentsatz: 1, betragCent: 10 }],
          },
        ],
      },
    ],
  };
  assert.doesNotThrow(() => erstelleMbgmPaket([ke], OPT));
});

test('die Hoechstanzahlen werden schon beim Bauen erzwungen', () => {
  const zuVieleBloecke = {
    ...MELDUNG,
    tarifbloecke: Array.from({ length: 16 }, () => MELDUNG.tarifbloecke[0]!),
  };
  assert.throws(() => erstelleMbgmPaket([zuVieleBloecke], OPT), /höchstens 15/);

  const zuVieleBasen = {
    ...MELDUNG,
    tarifbloecke: [
      {
        ...MELDUNG.tarifbloecke[0]!,
        basen: Array.from({ length: 11 }, (_, i) => ({
          typ: (['AB', 'SZ', 'UU', 'AZ', 'SA', 'BV', 'BB', 'SE', 'SW', 'EH', 'AA'] as const)[i]!,
          betragCent: 1,
          positionen: [],
        })),
      },
    ],
  };
  assert.throws(() => erstelleMbgmPaket([zuVieleBasen], OPT), /höchstens 10/);
});

// --- Beschaeftigungsfolgen und Storno --------------------------------------

test('die Beschaeftigungsfolge bestimmt mBGM- UND Tarifblock-Satzart', () => {
  const bau = (folge: 'regelmaessig' | 'fallweise' | 'kuerzerAlsEinMonat', zeit: object) =>
    erstelleMbgmPaket(
      [
        {
          ...MELDUNG,
          folge,
          tarifbloecke: [
            {
              beschaeftigtengruppe: 'B002',
              ...zeit,
              basen: [
                {
                  typ: 'AB' as const,
                  betragCent: 10_000,
                  positionen: [{ typ: 'T01' as const, prozentsatz: 1.3, betragCent: 130 }],
                },
              ],
            },
          ],
        },
      ],
      OPT,
    ).map((s) => s.satzart);

  assert.deepEqual(bau('regelmaessig', { beginnDerVerrechnung: 1 }), ['PS', 'G1', 'T1', 'BS', 'V1', 'PE']);
  assert.deepEqual(bau('fallweise', { beschaeftigungstag: 2 }), ['PS', 'G3', 'T2', 'BS', 'V1', 'PE']);
  assert.deepEqual(bau('kuerzerAlsEinMonat', { ersterTag: 5, letzterTag: 10 }), [
    'PS',
    'G5',
    'T3',
    'BS',
    'V1',
    'PE',
  ]);
});

test('das Zeitfeld muss zur Beschaeftigungsfolge passen', () => {
  const mit = (folge: 'regelmaessig' | 'fallweise' | 'kuerzerAlsEinMonat', zeit: object) => () =>
    erstelleMbgmPaket(
      [{ ...MELDUNG, folge, tarifbloecke: [{ beschaeftigtengruppe: 'B002', ...zeit, basen: [] }] }],
      OPT,
    );
  // Fehlendes Feld.
  assert.throws(mit('fallweise', {}), /FTAG/);
  assert.throws(mit('kuerzerAlsEinMonat', {}), /BTAB\/BTBS/);
  assert.throws(mit('regelmaessig', {}), /VVON/);
  // Ueberzaehliges Feld -- landete sonst stillschweigend nirgends.
  assert.throws(mit('fallweise', { beschaeftigungstag: 2, beginnDerVerrechnung: 1 }), /VVON gehört nicht/);
  assert.throws(
    mit('regelmaessig', { beginnDerVerrechnung: 1, beschaeftigungstag: 2 }),
    /gehören nicht zur regelmäßigen/,
  );
  // Verdrehter Zeitraum.
  assert.throws(mit('kuerzerAlsEinMonat', { ersterTag: 10, letzterTag: 5 }), /liegt vor dem ersten/);
});

test('ein Storno besteht nur aus dem mBGM-Satz', () => {
  const saetze = erstelleMbgmPaket(
    [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-0001',
        versicherungsnummer: '1234010180',
        summeCent: 79_200,
      },
    ],
    OPT,
  );
  assert.deepEqual(
    saetze.map((s) => s.satzart),
    ['PS', 'R1', 'PE'],
  );
  const r1 = saetze[1];
  assert.equal(r1?.werte.REFU, 'M-0001');
  assert.equal(r1?.werte.VSNR, '1234010180');
  assert.equal(r1?.werte.VSUM, '79200');
  assert.equal(r1?.werte.FANA, undefined, 'Name ist beim Storno gesperrt');
  assert.equal(r1?.werte.VERG, undefined, 'Verrechnungsgrundlage ebenso');
});

test('der Storno-Betrag wird von der Gesamtsumme abgezogen', () => {
  const saetze = erstelleMbgmPaket(
    [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'ALT',
        versicherungsnummer: '1234010180',
        summeCent: 50_000,
      },
      MELDUNG, // 68.584 Cent (179.777 x 38,15 %)
    ],
    OPT,
  );
  assert.equal(saetze[0]?.werte.GSUM, String(68_584 - 50_000));
  assert.equal(saetze[0]?.werte.GSVZ, '+');
  assert.equal(saetze[0]?.werte.ANZM, '2');
});

test('ein ueberwiegender Storno kehrt das Vorzeichen der Gesamtsumme um', () => {
  const saetze = erstelleMbgmPaket(
    [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'ALT',
        versicherungsnummer: '1234010180',
        summeCent: 100_000,
      },
      MELDUNG,
    ],
    OPT,
  );
  assert.equal(saetze[0]?.werte.GSVZ, '-');
  assert.equal(saetze[0]?.werte.GSUM, String(100_000 - 68_584));
});

test('die Storno-Summe darf nicht negativ sein', () => {
  // "Durch die vorangehende Festlegung ist damit der Betrag einer Storno mBGM
  // immer groesser oder gleich 0." Abgezogen wird erst beim Paket.
  assert.throws(
    () =>
      erstelleMbgmPaket(
        [
          {
            referenzwert: 'S',
            referenzUrspruenglicheMeldung: 'A',
            versicherungsnummer: '1234010180',
            summeCent: -1,
          },
        ],
        OPT,
      ),
    /größer oder gleich 0/,
  );
});

test('beim Storno ist die Versicherungsnummer einzeln zwingend', () => {
  assert.throws(
    () =>
      erstelleMbgmPaket(
        [{ referenzwert: 'S', referenzUrspruenglicheMeldung: 'A', versicherungsnummer: '', summeCent: 0 }],
        OPT,
      ),
    /einzeln zwingend/,
  );
  assert.throws(
    () =>
      erstelleMbgmPaket(
        [
          {
            referenzwert: 'S',
            referenzUrspruenglicheMeldung: '',
            versicherungsnummer: '1234010180',
            summeCent: 0,
          },
        ],
        OPT,
      ),
    /D\.44/,
  );
});

test('im Vorschreibeverfahren gibt es keinen fallweisen Tarifblock ohne Verrechnung', () => {
  // Die Abfolgetabelle fuehrt zu G4 ausschliesslich T2 (Seite 363).
  assert.throws(
    () =>
      erstelleMbgmPaket(
        [
          {
            ...MELDUNG,
            folge: 'fallweise',
            tarifbloecke: [
              { beschaeftigtengruppe: 'B010', beschaeftigungstag: 2, ohneVerrechnung: true, basen: [] },
            ],
          },
        ],
        { ...OPT, verfahren: 'vorschreibung' },
      ),
    /kein Tarifblock ohne Verrechnung/,
  );
});
