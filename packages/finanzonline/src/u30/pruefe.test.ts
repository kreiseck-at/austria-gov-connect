import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonError } from '@kreiseck/finanzonline-core';
import { pruefeU30 } from './pruefe';
import { U30PruefError, type U30Fehler } from './fehler';
import type { U30Erklaerung, U30Paket } from './typen';

// Ersatzdaten: Melisse Nails e.U., Steuernummer 91-123/4565.
const STNR = '911234565';
const STNR2 = '911234573'; // zweite gültige Ersatz-Steuernummer (Luhn)
const jetzt = new Date('2026-11-10T08:00:00Z');

const Q1 = {
  kz000: 98417,
  kz022: 98417,
  kz057: 21444,
  kz070: 197538,
  kz072: 197538,
  kz060: 119597,
  kz065: 39508,
  kz066: 21444,
};
const Q2 = {
  kz000: 584750,
  kz022: 584750,
  kz057: 20510,
  kz070: 138262,
  kz072: 138262,
  kz060: 118044,
  kz065: 27652,
  kz066: 20510,
};
const Q3 = {
  kz000: 1489092,
  kz022: 1489092,
  kz057: 35227,
  kz070: 643490,
  kz072: 643490,
  kz060: 79284,
  kz065: 128698,
  kz066: 35227,
};

const erklaerung = (e: Partial<U30Erklaerung> = {}): U30Erklaerung => ({
  steuernummer: STNR,
  zeitraum: { jahr: 2026, quartal: 3 },
  kennzahlen: Q3,
  ...e,
});
const paket = (e: Partial<U30Erklaerung> = {}, p: Partial<U30Paket> = {}): U30Paket => ({
  paketNr: 1003,
  erklaerungen: [erklaerung(e)],
  ...p,
});
const codes = (f: U30Fehler[]): string[] => f.map((x) => x.code).sort();
const pruefe = (p: U30Paket, j: Date = jetzt): string[] => codes(pruefeU30(p, { jetzt: j }));

test('Pilotfälle Q1, Q2 (berichtigt) und Q3 sind gültig', () => {
  assert.deepEqual(
    pruefe(paket({ zeitraum: { jahr: 2026, quartal: 1 }, kennzahlen: Q1, berichtigung: true })),
    [],
  );
  assert.deepEqual(
    pruefe(paket({ zeitraum: { jahr: 2026, quartal: 2 }, kennzahlen: Q2, berichtigung: true })),
    [],
  );
  assert.deepEqual(pruefe(paket()), []);
});

test('Nullmeldung, Monat, Steuerfreies, Eigenverbrauch/Übergang, Höchstbetrag sind gültig', () => {
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 0 } })), []);
  assert.deepEqual(pruefe(paket({ zeitraum: { jahr: 2026, monat: 10 } })), []);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 100000, kz017: 40000, kz022: 60000 } })), []);
  assert.deepEqual(
    pruefe(paket({ kennzahlen: { kz000: 100000, kz001: 5000, kz021: 20000, kz022: 85000 } })),
    [],
  );
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 999999999999999, kz022: 999999999999999 } })), []);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 0, kz090: -100, kz063: -5, kz067: 7 } })), []);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 1000, kz020: 1000 }, vst: '27a' })), []);
});

test('Zeitraum', () => {
  assert.deepEqual(pruefe(paket({ zeitraum: { jahr: 2026, quartal: 4 } })), ['ZEITRAUM_NICHT_ABGESCHLOSSEN']);
  assert.deepEqual(pruefe(paket({ zeitraum: { jahr: 2026, monat: 11 } })), ['ZEITRAUM_NICHT_ABGESCHLOSSEN']);
  assert.deepEqual(pruefe(paket({ zeitraum: { jahr: 2021, quartal: 4 }, kennzahlen: { kz000: 0 } })), [
    'ZEITRAUM_NICHT_UNTERSTUETZT',
  ]);
  assert.deepEqual(
    pruefe(
      paket({ zeitraum: { jahr: 2022, quartal: 1 }, kennzahlen: { kz000: 0 } }),
      new Date('2028-03-01T10:00:00Z'),
    ),
    ['ZEITRAUM_ZU_ALT'],
  );
  assert.deepEqual(pruefe(paket({ zeitraum: { jahr: 2026 } as never })), ['ZEITRAUM_UNGUELTIG']);
  // laufender Monat in Wiener Zeit: am 31.10. 23:30 UTC ist in Wien schon November
  assert.deepEqual(
    pruefe(paket({ zeitraum: { jahr: 2026, monat: 10 } }), new Date('2026-10-31T23:30:00Z')),
    [],
  );
  assert.deepEqual(pruefe(paket({ zeitraum: { jahr: 2026, monat: 10 } }), new Date('2026-10-31T22:30:00Z')), [
    'ZEITRAUM_NICHT_ABGESCHLOSSEN',
  ]);
});

test('Steuernummer und Übermittler', () => {
  assert.deepEqual(pruefe(paket({ steuernummer: '911234566' })), ['STEUERNUMMER_PRUEFZIFFER']);
  assert.deepEqual(pruefe(paket({ steuernummer: '91-123/4565' })), ['STEUERNUMMER_UNGUELTIG']);
  assert.deepEqual(pruefe(paket({ steuernummer: '000000000' })), ['STEUERNUMMER_UNGUELTIG']);
  assert.deepEqual(pruefe(paket({ steuernummer: 911234565 as never })), ['STEUERNUMMER_UNGUELTIG']);
  assert.deepEqual(pruefe(paket({}, { uebermittler: '911234566' })), ['UEBERMITTLER_UNGUELTIG']);
  assert.deepEqual(pruefe(paket({}, { uebermittler: STNR2 })), []); // Parteienvertreter-Fall: erlaubt
  const zwei = paket(
    {},
    {
      erklaerungen: [erklaerung(), erklaerung({ steuernummer: STNR2 })],
    },
  );
  assert.deepEqual(pruefe(zwei), ['UEBERMITTLER_FEHLT']);
  assert.deepEqual(pruefe({ ...zwei, uebermittler: STNR }), []);
});

test('Paket', () => {
  for (const paketNr of [0, 1.5, 1000000000, -1, Number.NaN]) {
    assert.deepEqual(pruefe(paket({}, { paketNr })), ['PAKETNR_UNGUELTIG'], String(paketNr));
  }
  assert.deepEqual(pruefe(paket({}, { paketNr: 999999999 })), []);
  assert.deepEqual(pruefe(paket({}, { erklaerungen: [] })), ['ERKLAERUNGEN_ANZAHL']);
  assert.deepEqual(pruefe(paket({}, { erklaerungen: undefined as never })), ['ERKLAERUNGEN_ANZAHL']);
  assert.deepEqual(pruefe(paket({ satzNr: 0 })), ['SATZNR_UNGUELTIG']);
  assert.deepEqual(
    pruefe(
      paket(
        {},
        {
          erklaerungen: [
            erklaerung({ satzNr: 2 }),
            erklaerung({ zeitraum: { jahr: 2026, quartal: 2 }, kennzahlen: Q2 }),
          ],
        },
      ),
    ),
    ['SATZNR_DOPPELT'],
  );
  assert.deepEqual(pruefe(paket({}, { erklaerungen: [erklaerung(), erklaerung()] })), ['ERKLAERUNG_DOPPELT']);
});

test('Kennzahlen: unbekannt, keine Ganzzahl, Vorzeichen, zu groß', () => {
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 0, kz009: 1 } as never })), ['KENNZAHL_UNBEKANNT']);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 1000, kz022: 12.5 } })), ['BETRAG_KEINE_GANZZAHL']);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: '1000' } as never })), ['BETRAG_KEINE_GANZZAHL']);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: Number.NaN } })), ['BETRAG_KEINE_GANZZAHL']);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 0, kz060: -1 } })), ['BETRAG_NEGATIV']);
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: -1 } })), ['BETRAG_NEGATIV']);
  assert.deepEqual(
    pruefe(paket({ kennzahlen: { kz000: 1_000_000_000_000_000, kz022: 1_000_000_000_000_000 } })),
    ['BETRAG_ZU_GROSS', 'BETRAG_ZU_GROSS'],
  );
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 0, kz090: -1_000_000_000_000_000 } })), [
    'BETRAG_ZU_GROSS',
  ]);
  const f = pruefeU30(paket({ kennzahlen: { kz000: 0, kz060: -1 } }), { jetzt });
  assert.equal(f[0]?.kennzahl, 'kz060');
  assert.equal(f[0]?.erklaerung, 0);
});

test('BMF-Prüfregeln (Prüfungen UVA ab 7/2026)', () => {
  const faelle: Array<[Record<string, number>, string[]]> = [
    [{}, ['KZ000_FEHLT']],
    [{ kz000: 1000, kz011: 2000 }, ['STEUERFREI_UEBER_STEUERBAR', 'SUMME_STEUERPFLICHTIG_UNGLEICH']],
    [{ kz000: 100000, kz022: 90000 }, ['SUMME_STEUERPFLICHTIG_UNGLEICH']],
    [{ kz000: 0, kz065: 100 }, ['IGE_OHNE_KZ070']],
    [{ kz000: 0, kz071: 100 }, ['IGE_OHNE_KZ070', 'KZ071_UEBER_KZ070', 'SUMME_IGE_UNGLEICH']],
    [{ kz000: 0, kz070: 100, kz071: 200 }, ['KZ071_UEBER_KZ070', 'SUMME_IGE_UNGLEICH']],
    [{ kz000: 0, kz070: 1000, kz072: 900 }, ['SUMME_IGE_UNGLEICH']],
    [{ kz000: 0, kz070: 1000, kz071: 100, kz072: 400, kz125: 500 }, []],
    [{ kz000: 0, kz066: 100 }, ['KZ066_OHNE_KZ057']],
    [{ kz000: 0, kz057: 100, kz066: 101 }, ['KZ066_UEBER_KZ057']],
    [{ kz000: 0, kz082: 1 }, ['KZ082_OHNE_KZ048']],
    [{ kz000: 0, kz048: 1, kz082: 2 }, ['KZ082_UEBER_KZ048']],
    [{ kz000: 0, kz087: 1 }, ['KZ087_OHNE_KZ044']],
    [{ kz000: 0, kz044: 1, kz087: 2 }, ['KZ087_UEBER_KZ044']],
    [{ kz000: 0, kz089: 1 }, ['KZ089_OHNE_KZ032']],
    [{ kz000: 0, kz032: 1, kz089: 2 }, ['KZ089_UEBER_KZ032']],
    [{ kz000: 1000, kz020: 1000 }, ['KZ020_OHNE_VST']],
  ];
  for (const [kennzahlen, erwartet] of faelle) {
    assert.deepEqual(pruefe(paket({ kennzahlen })), [...erwartet].sort(), JSON.stringify(kennzahlen));
  }
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 0 }, vst: '7' })), ['VST_OHNE_KZ020']);
  for (const vst of ['abc', '12345', 'a1', '']) {
    assert.deepEqual(
      pruefe(paket({ kennzahlen: { kz000: 1000, kz020: 1000 }, vst })),
      ['VST_UNGUELTIG'],
      vst,
    );
  }
});

test('ARE bei Berichtigung unzulässig', () => {
  assert.deepEqual(pruefe(paket({ berichtigung: true, ueberschussVerwenden: true })), [
    'ARE_BEI_BERICHTIGUNG',
  ]);
  assert.deepEqual(pruefe(paket({ ueberschussVerwenden: true })), []);
  assert.deepEqual(pruefe(paket({ berichtigung: true })), []);
});

test('KZ 124/125 erst ab 07/2026', () => {
  assert.deepEqual(
    pruefe(paket({ zeitraum: { jahr: 2026, quartal: 2 }, kennzahlen: { kz000: 1000, kz124: 1000 } })),
    ['KZ124_125_ZU_FRUEH'],
  );
  assert.deepEqual(
    pruefe(paket({ zeitraum: { jahr: 2026, monat: 6 }, kennzahlen: { kz000: 0, kz070: 100, kz125: 100 } })),
    ['KZ124_125_ZU_FRUEH'],
  );
  assert.deepEqual(pruefe(paket({ kennzahlen: { kz000: 1000, kz124: 1000 } })), []);
});

test('KUNDENINFO', () => {
  assert.deepEqual(pruefe(paket({ kundeninfo: 'AGC äöüß ÄÖÜ <&>' })), []);
  for (const k of ['Kunde 🙂', 'Rechnung €', 'a\nb', 'Tab\t', 'x\u0085']) {
    assert.deepEqual(pruefe(paket({ kundeninfo: k })), ['KUNDENINFO_ZEICHEN'], JSON.stringify(k));
  }
  assert.deepEqual(pruefe(paket({ kundeninfo: 'x'.repeat(50) })), []);
  assert.deepEqual(pruefe(paket({ kundeninfo: 'x'.repeat(51) })), ['KUNDENINFO_ZU_LANG']);
  assert.deepEqual(pruefe(paket({ kundeninfo: 4711 as never })), ['KUNDENINFO_ZEICHEN']);
});

test('erwartete Steuer je Satz (Kontrolle)', () => {
  assert.deepEqual(pruefe(paket({ erwarteteSteuer: { kz022: 297818, kz072: 128698 } })), []);
  assert.deepEqual(pruefe(paket({ erwarteteSteuer: { kz022: 297819 } })), ['STEUER_WEICHT_AB']);
  assert.deepEqual(pruefe(paket({ erwarteteSteuer: { kz029: 0 } })), []);
  assert.deepEqual(pruefe(paket({ erwarteteSteuer: { kz029: 5 } })), ['STEUER_WEICHT_AB']);
  assert.deepEqual(pruefe(paket({ erwarteteSteuer: { kz057: 1 } as never })), ['ERWARTETE_STEUER_KEIN_SATZ']);
  assert.deepEqual(pruefe(paket({ erwarteteSteuer: { kz022: 1.5 } })), ['BETRAG_KEINE_GANZZAHL']);
  const f = pruefeU30(paket({ erwarteteSteuer: { kz022: 297819 } }), { jetzt });
  assert.equal(f[0]?.kennzahl, 'kz022');
  assert.match(f[0]?.nachricht ?? '', /2\.978,19/);
  assert.match(f[0]?.nachricht ?? '', /2\.978,18/);
});

test('alle Fehler auf einmal, je mit Index der Erklärung', () => {
  const f = pruefeU30(
    paket({
      steuernummer: '911234566',
      zeitraum: { jahr: 2026, monat: 11 },
      kennzahlen: { kz000: 0, kz009: 1 } as never,
    }),
    { jetzt },
  );
  assert.deepEqual(codes(f), [
    'KENNZAHL_UNBEKANNT',
    'STEUERNUMMER_PRUEFZIFFER',
    'ZEITRAUM_NICHT_ABGESCHLOSSEN',
  ]);
  for (const x of f) {
    assert.equal(x.erklaerung, 0);
    assert.ok(x.nachricht.length > 0);
  }
});

test('ohne jetzt wird die aktuelle Zeit verwendet (Zeitraum in der Zukunft)', () => {
  assert.deepEqual(codes(pruefeU30(paket({ zeitraum: { jahr: 9999, monat: 1 } }))), [
    'ZEITRAUM_NICHT_ABGESCHLOSSEN',
  ]);
});

test('U30PruefError trägt die Fehlerliste', () => {
  const fehler = pruefeU30(paket({ steuernummer: '911234566' }), { jetzt });
  const e = new U30PruefError(fehler);
  assert.ok(e instanceof FonError);
  assert.equal(e.name, 'U30PruefError');
  assert.deepEqual(e.fehler, fehler);
  assert.match(e.message, /STEUERNUMMER_PRUEFZIFFER/);
});

// --- Fix-Durchgang nach Review ---

test('Kennzahlen nur aus eigenen Eigenschaften: Getter-Klasse und Prototyp zählen nicht', () => {
  class K {
    get kz000(): number {
      return 100000;
    }
    get kz022(): number {
      return 12.5;
    }
  }
  assert.deepEqual(pruefe(paket({ kennzahlen: new K() as never })), ['KZ000_FEHLT']);
  const ueberPrototyp = Object.create({ kz000: 100000, kz022: 90000 }) as Record<string, number>;
  assert.deepEqual(pruefe(paket({ kennzahlen: ueberPrototyp })), ['KZ000_FEHLT']);
});

test('Schalter müssen boolean sein', () => {
  assert.deepEqual(pruefe(paket({ ueberschussVerwenden: 'true' as never })), ['SCHALTER_UNGUELTIG']);
  assert.deepEqual(pruefe(paket({ rechnungskopien: 'J' as never })), ['SCHALTER_UNGUELTIG']);
  assert.deepEqual(pruefe(paket({ berichtigung: 1 as never, ueberschussVerwenden: true })), [
    'SCHALTER_UNGUELTIG',
  ]);
  assert.deepEqual(
    pruefe(paket({ berichtigung: false, ueberschussVerwenden: false, rechnungskopien: false })),
    [],
  );
});

test('unbekannte Felder in Erklärung und Paket werden gemeldet', () => {
  assert.deepEqual(pruefe(paket({ kundenInfo: 'Q3' } as never)), ['FELD_UNBEKANNT']);
  assert.deepEqual(pruefe(paket({}, { paketnr: 1 } as never)), ['FELD_UNBEKANNT']);
});

test('überlappende Zeiträume derselben Steuernummer im Paket → ERKLAERUNG_DOPPELT', () => {
  assert.deepEqual(
    pruefe(paket({}, { erklaerungen: [erklaerung(), erklaerung({ zeitraum: { jahr: 2026, monat: 9 } })] })),
    ['ERKLAERUNG_DOPPELT'],
  );
  assert.deepEqual(
    pruefe(
      paket(
        {},
        {
          erklaerungen: [
            erklaerung(),
            erklaerung({ zeitraum: { jahr: 2026, monat: 6 }, kennzahlen: { kz000: 0 } }),
          ],
        },
      ),
    ),
    [],
  );
});

test('pruefeU30 wirft nicht bei kaputter Eingabe', () => {
  assert.deepEqual(codes(pruefeU30(null as never, { jetzt })), ['ERKLAERUNGEN_ANZAHL', 'PAKETNR_UNGUELTIG']);
});
