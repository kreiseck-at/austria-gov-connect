import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueU30Xml } from './xml';
import { U30PruefError } from './fehler';
import type { U30Erklaerung, U30Paket } from './typen';
import { golden, pruefeGegenXsd } from './xsd-hilfe.test';

// Ersatzdaten: Melisse Nails e.U., Steuernummer 91-123/4565. Beträge der Pilotfälle echt.
const STNR = '911234565';
const jetzt = new Date('2026-11-10T08:00:00Z'); // 09:00 Wiener Zeit
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

const e = (x: Partial<U30Erklaerung>): U30Erklaerung => ({
  steuernummer: STNR,
  zeitraum: { jahr: 2026, quartal: 3 },
  kennzahlen: { kz000: 0 },
  ...x,
});
const paket = (paketNr: number, erklaerungen: U30Erklaerung[]): U30Paket => ({
  paketNr,
  erklaerungen,
  erstellt: jetzt,
});

const GOLDEN: Array<[string, U30Paket]> = [
  [
    'pilot-q1-2026.xml',
    paket(1001, [
      e({ zeitraum: { jahr: 2026, quartal: 1 }, kennzahlen: Q1, kundeninfo: 'Q1-2026', berichtigung: true }),
    ]),
  ],
  [
    'pilot-q2-2026.xml',
    paket(1002, [
      e({ zeitraum: { jahr: 2026, quartal: 2 }, kennzahlen: Q2, kundeninfo: 'Q2-2026', berichtigung: true }),
    ]),
  ],
  ['pilot-q3-2026.xml', paket(1003, [e({ kennzahlen: Q3, kundeninfo: 'Q3-2026' })])],
  ['nullmeldung-q3-2026.xml', paket(1004, [e({})])],
  [
    'monat-10-2026-49.xml',
    paket(1005, [
      e({
        zeitraum: { jahr: 2026, monat: 10 },
        kennzahlen: { kz000: 100000, kz022: 50000, kz124: 50000, kz060: 1000 },
      }),
    ]),
  ],
  ['umlaut-kundeninfo.xml', paket(1006, [e({ kundeninfo: 'Prüfung & Ä' })])],
  [
    'zwei-erklaerungen.xml',
    paket(1007, [e({ zeitraum: { jahr: 2026, quartal: 2 }, kennzahlen: Q2 }), e({ kennzahlen: Q3 })]),
  ],
];

for (const [datei, p] of GOLDEN) {
  test(`Golden: ${datei} byte-genau und XSD-gültig`, async () => {
    const xml = baueU30Xml(p, { jetzt });
    assert.equal(xml, golden(datei));
    const xsd = await pruefeGegenXsd(xml);
    assert.equal(xsd.gueltig, true, xsd.fehler.join('\n'));
  });
}

test('XSD-Prüfung greift: KZ029 = 0.00 ist ungültig', async () => {
  const kaputt = golden('nullmeldung-q3-2026.xml').replace(
    '</KZ000>',
    '</KZ000><VERSTEUERT><KZ029 type="kz">0.00</KZ029></VERSTEUERT>',
  );
  const xsd = await pruefeGegenXsd(kaputt);
  assert.equal(xsd.gueltig, false);
});

test('XSD-Prüfung greift: KZ124 vor 07/2026 ist gegen das Schema 01/2022 ungültig', async () => {
  const kaputt = golden('pilot-q2-2026.xml').replace('</KZ022>', '</KZ022><KZ124 type="kz">1.00</KZ124>');
  const xsd = await pruefeGegenXsd(kaputt);
  assert.equal(xsd.schema, '01/2022');
  assert.equal(xsd.gueltig, false);
});

test('alle 45 Kennzahlen in XSD-Reihenfolge (Schema ab 07/2026)', async () => {
  const alle = {
    kz000: 15,
    kz001: 1,
    kz021: 1,
    kz011: 1,
    kz012: 1,
    kz015: 1,
    kz017: 1,
    kz018: 1,
    kz019: 1,
    kz016: 1,
    kz020: 1,
    kz022: 1,
    kz124: 1,
    kz029: 1,
    kz006: 1,
    kz037: 1,
    kz052: 1,
    kz007: 1,
    kz056: 1,
    kz057: 1,
    kz048: 1,
    kz044: 1,
    kz032: 1,
    kz070: 10,
    kz071: 1,
    kz072: 5,
    kz125: 1,
    kz073: 1,
    kz008: 1,
    kz088: 1,
    kz076: 1,
    kz077: 1,
    kz060: 1,
    kz061: 1,
    kz083: 1,
    kz065: 1,
    kz066: 1,
    kz082: 1,
    kz087: 1,
    kz089: 1,
    kz064: 1,
    kz062: 1,
    kz063: -1,
    kz067: -1,
    kz090: -1,
  };
  const xml = baueU30Xml(
    paket(2000, [e({ kennzahlen: alle, vst: '27a', ueberschussVerwenden: true, rechnungskopien: true })]),
    { jetzt },
  );
  assert.equal((xml.match(/<KZ\d{3} type="kz">/g) ?? []).length, 45);
  assert.match(
    xml,
    /<KZ016 type="kz">0\.01<\/KZ016><VST>27a<\/VST><KZ020 type="kz">0\.01<\/KZ020><\/STEUERFREI>/,
  );
  assert.match(xml, /<KZ090 type="kz">-0\.01<\/KZ090><ARE>J<\/ARE><REPO>J<\/REPO><\/VORSTEUER>/);
  const xsd = await pruefeGegenXsd(xml);
  assert.equal(xsd.gueltig, true, xsd.fehler.join('\n'));
});

test('Kennzahl 0 wird weggelassen, KZ 000 mit 0 nicht', async () => {
  const xml = baueU30Xml(paket(2001, [e({ kennzahlen: { kz000: 0, kz022: 0, kz060: 0, kz070: 0 } })]), {
    jetzt,
  });
  assert.equal(
    xml,
    golden('nullmeldung-q3-2026.xml').replace('<PAKET_NR>1004</PAKET_NR>', '<PAKET_NR>2001</PAKET_NR>'),
  );
  assert.equal(
    (
      await pruefeGegenXsd(
        baueU30Xml(paket(2001, [e({ kennzahlen: { kz000: 0, kz022: 0, kz060: 0, kz070: 0 } })]), { jetzt }),
      )
    ).gueltig,
    true,
  );
});

test('Erstellungszeit in Wiener Zeit (Sommerzeit)', async () => {
  const p: U30Paket = { paketNr: 2002, erklaerungen: [e({})], erstellt: new Date('2026-07-01T21:59:58Z') };
  const xml = baueU30Xml(p, { jetzt });
  assert.match(
    xml,
    /<DATUM_ERSTELLUNG type="datum">2026-07-01<\/DATUM_ERSTELLUNG><UHRZEIT_ERSTELLUNG type="uhrzeit">23:59:58<\/UHRZEIT_ERSTELLUNG>/,
  );
  assert.equal((await pruefeGegenXsd(baueU30Xml(p, { jetzt }))).gueltig, true);
});

test('Parteienvertreter: IDENTIFIKATIONSBEGRIFF = uebermittler, FASTNR = Klient', async () => {
  const p: U30Paket = { paketNr: 2003, uebermittler: '911234573', erklaerungen: [e({})], erstellt: jetzt };
  const xml = baueU30Xml(p, { jetzt });
  assert.match(xml, /<IDENTIFIKATIONSBEGRIFF>911234573<\/IDENTIFIKATIONSBEGRIFF>/);
  assert.match(xml, /<FASTNR>911234565<\/FASTNR>/);
  assert.equal((await pruefeGegenXsd(baueU30Xml(p, { jetzt }))).gueltig, true);
});

test('ungültiges Paket: U30PruefError, kein XML', () => {
  assert.throws(
    () => baueU30Xml(paket(1003, [e({ steuernummer: '911234566' })]), { jetzt }),
    (err: unknown) => err instanceof U30PruefError && err.fehler[0]?.code === 'STEUERNUMMER_PRUEFZIFFER',
  );
});

test('Momentaufnahme: ein Getter wird genau einmal gelesen, Prüfung und XML sehen denselben Wert', async () => {
  let lesungen = 0;
  const kennzahlen = { kz000: 100000 } as Record<string, number>;
  Object.defineProperty(kennzahlen, 'kz022', {
    enumerable: true,
    get() {
      lesungen += 1;
      return lesungen === 1 ? 100000 : 12.5;
    },
  });
  const xml = baueU30Xml(paket(2004, [e({ kennzahlen })]), { jetzt });
  assert.equal(lesungen, 1);
  assert.match(xml, /<KZ022 type="kz">1000\.00<\/KZ022>/);
  const xsd = await pruefeGegenXsd(xml);
  assert.equal(xsd.gueltig, true, xsd.fehler.join('\n'));
});

test('Prototyp-Kennzahlen gelangen nie ins XML', () => {
  const k = Object.create({ kz022: 50 }) as Record<string, number>;
  k['kz000'] = 0;
  const xml = baueU30Xml(paket(2005, [e({ kennzahlen: k })]), { jetzt });
  assert.doesNotMatch(xml, /KZ022/);
});
