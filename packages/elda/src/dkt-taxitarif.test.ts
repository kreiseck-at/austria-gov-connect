import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alsMehrfachtransportAbzurechnen, taxiEinzelfahrt, taxiMehrfachtransport } from './dkt-taxitarif';
import { erstelleDktAbrechnung } from './dkt-abrechnung';
import { liesDktBestand } from './dkt-lesen';

// Beträge aus der „TARIFLISTE Krankenbeförderung durch Vertragstaxi, gültig ab
// 01.01.2025" (ÖGK an den Fachverband, 16.12.2024, Seite 3).
const DATUM = '2026-10-14';

test('Tarifliste: km-Tarif 050 mit 1,86 € je Kilometer', () => {
  assert.deepEqual(taxiEinzelfahrt({ datum: DATUM, kilometer: 20 }), {
    position: '050',
    bezeichnung: 'km-Tarif',
    tarifCent: 186,
    anzahl: 20,
    betragCent: 3720,
  });
});

test('Tarifliste: km-Tarif +15 % Rollstuhl ist Position 051 mit 2,14 €', () => {
  const l = taxiEinzelfahrt({ datum: DATUM, kilometer: 20, rollstuhl: true });
  assert.deepEqual([l.position, l.tarifCent, l.betragCent], ['051', 214, 4280]);
  assert.equal(l.bezeichnung, 'km-Tarif +15 % Rollstuhl');
});

test('Mindestpauschale 054 (10,35 €), solange Kilometer × km-Tarif darunter liegt', () => {
  // 5 km × 1,86 = 9,30 < 10,35 → Pauschale; 6 km × 1,86 = 11,16 → km-Tarif
  const kurz = taxiEinzelfahrt({ datum: DATUM, kilometer: 5 });
  assert.deepEqual([kurz.position, kurz.tarifCent, kurz.anzahl, kurz.betragCent], ['054', 1035, 1, 1035]);
  assert.equal(taxiEinzelfahrt({ datum: DATUM, kilometer: 6 }).position, '050');
  // Rollstuhl: 5 km × 2,14 = 10,70 < 11,90 → 055; 6 km × 2,14 = 12,84 → 051
  assert.deepEqual(
    [5, 6].map((km) => taxiEinzelfahrt({ datum: DATUM, kilometer: km, rollstuhl: true }).position),
    ['055', '051'],
  );
});

test('Ortspauschalen der Landeshauptstädte, Positionen 056–071', () => {
  const erwartet: [Parameters<typeof taxiEinzelfahrt>[0]['ortspauschale'], string, number, string, number][] =
    [
      ['Bregenz', '056', 1242, '057', 1428],
      ['Eisenstadt', '058', 1242, '059', 1428],
      ['Salzburg', '060', 1242, '061', 1428],
      ['Graz', '062', 1449, '063', 1666],
      ['Innsbruck', '064', 1449, '065', 1666],
      ['Klagenfurt', '066', 1449, '067', 1666],
      ['St. Pölten', '068', 1449, '069', 1666],
      ['Linz', '070', 1656, '071', 1904],
    ];
  for (const [stadt, pos, cent, posR, centR] of erwartet) {
    const l = taxiEinzelfahrt({ datum: DATUM, kilometer: 4, ortspauschale: stadt });
    assert.deepEqual([l.position, l.tarifCent, l.anzahl, l.betragCent], [pos, cent, 1, cent], String(stadt));
    const r = taxiEinzelfahrt({ datum: DATUM, kilometer: 4, ortspauschale: stadt, rollstuhl: true });
    assert.deepEqual([r.position, r.tarifCent], [posR, centR], String(stadt));
  }
  assert.equal(
    taxiEinzelfahrt({ datum: DATUM, kilometer: 4, ortspauschale: 'Salzburg' }).bezeichnung,
    'Pauschale Salzburg',
  );
});

test('Wien hat in der Tarifliste keinen Betrag und wird abgewiesen', () => {
  assert.throws(
    () => taxiEinzelfahrt({ datum: DATUM, kilometer: 4, ortspauschale: 'Wien' as never }),
    /keine Ortspauschale/,
  );
});

test('Tarifstand: 2025 und 2026 belegt, davor und danach Abbruch', () => {
  assert.equal(taxiEinzelfahrt({ datum: '2025-01-01', kilometer: 10 }).tarifCent, 186);
  // Rundschreiben 15.12.2025: 2026 keine Valorisierung.
  assert.equal(taxiEinzelfahrt({ datum: '2026-12-31', kilometer: 10 }).tarifCent, 186);
  assert.throws(() => taxiEinzelfahrt({ datum: '2024-12-31', kilometer: 10 }), /kein Tarif hinterlegt/);
  assert.throws(() => taxiEinzelfahrt({ datum: '2027-01-01', kilometer: 10 }), /valorisiert/);
  assert.throws(() => taxiEinzelfahrt({ datum: '14.10.2026', kilometer: 10 }), /JJJJ-MM-TT/);
});

test('Kilometer: ganze Zahl von 1 bis 9999', () => {
  for (const km of [0, -3, 2.5, 10000]) {
    assert.throws(() => taxiEinzelfahrt({ datum: DATUM, kilometer: km }), /Kilometer/, String(km));
  }
});

test('Mehrfachtransport: erster 100 % (050), ab dem zweiten 50 % (052), alle über die ganze Strecke', () => {
  const l = taxiMehrfachtransport({
    datum: DATUM,
    kilometer: 30,
    versicherte: [{}, {}, { rollstuhl: true }],
  });
  assert.deepEqual(
    l.map((x) => [x!.position, x!.tarifCent, x!.anzahl, x!.betragCent]),
    [
      ['050', 186, 30, 5580],
      ['052', 93, 30, 2790],
      ['053', 108, 30, 3240],
    ],
  );
  assert.equal(l[1]!.bezeichnung, 'km-Tarif 1/2 mehrfach');
  assert.equal(l[2]!.bezeichnung, 'km-Tarif 1/2 mehrfach +15 % Rollstuhl');
});

test('Mehrfachtransport: Rollstuhl beim ersten Versicherten ist Position 051', () => {
  const l = taxiMehrfachtransport({ datum: DATUM, kilometer: 30, versicherte: [{ rollstuhl: true }, {}] });
  assert.deepEqual(
    l.map((x) => x!.position),
    ['051', '052'],
  );
});

test('Mehrfachtransport unter der Mindestpauschale: Pauschale nur für einen Versicherten', () => {
  // 3 km: 5,58 + 2,79 = 8,37 < 10,35 → einmal 054, der zweite nicht verrechenbar
  const unter = taxiMehrfachtransport({ datum: DATUM, kilometer: 3, versicherte: [{}, {}] });
  assert.deepEqual([unter[0]!.position, unter[0]!.betragCent, unter[1]], ['054', 1035, null]);
  // 4 km: 7,44 + 3,72 = 11,16 ≥ 10,35 → km-Tarife, keine Pauschale
  const ueber = taxiMehrfachtransport({ datum: DATUM, kilometer: 4, versicherte: [{}, {}] });
  assert.deepEqual(
    ueber.map((x) => x!.position),
    ['050', '052'],
  );
});

test('Mehrfachtransport braucht mindestens zwei Versicherte', () => {
  assert.throws(
    () => taxiMehrfachtransport({ datum: DATUM, kilometer: 30, versicherte: [{}] }),
    /zwei Versicherte/,
  );
});

test('Klarstellung ab 1.6.2025: Mehrfachtransport nur, wenn jeder weitere Patient mindestens die halbe Strecke mitfährt', () => {
  // Beispiele der Klarstellung
  assert.equal(alsMehrfachtransportAbzurechnen(100, [90]), true);
  assert.equal(alsMehrfachtransportAbzurechnen(100, [10]), false);
  // Grenze: genau die Hälfte zählt („zumindest")
  assert.equal(alsMehrfachtransportAbzurechnen(100, [50]), true);
  assert.equal(alsMehrfachtransportAbzurechnen(100, [49]), false);
  assert.equal(alsMehrfachtransportAbzurechnen(101, [50]), false);
  // „jeder weitere" Patient
  assert.equal(alsMehrfachtransportAbzurechnen(100, [90, 20]), false);
  assert.throws(() => alsMehrfachtransportAbzurechnen(100, []), /weiterer Patient/);
});

test('Die Tarifposition geht unverändert in den Datenblock „L" der Abrechnung ein', () => {
  const l = taxiEinzelfahrt({ datum: DATUM, kilometer: 5 });
  const datei = erstelleDktAbrechnung({
    traeger: '17',
    abrechnungsstelle: '17',
    bundeslandAbrechnungsstelle: '7',
    datenuebernehmer: '14',
    datentraegernummer: 1,
    erstellt: new Date('2026-11-03T08:00:00Z'),
    testdaten: true,
    uebermittler: { name: 'Max Hollerer GmbH', staat: 'AUT', plz: '5020', vpnr: '123450' },
    vertragspartner: { vpnr: '123450', adresscode: 1, bundesland: '7', uid: 'ATU12345675' },
    abrechnungsjahr: 2026,
    abrechnungsmonat: 10,
    abrechnungsart: 'normal',
    rechnungsnummer: 'R2026-0042',
    rechnungsdatum: '2026-11-03',
    iban: 'AT611904300234573201',
    faelle: [
      {
        versicherter: { traeger: '17', familienname: 'Weinzierl', vorname: 'Mirela', vsnr: '1237010180' },
        belegnummer: 1,
        verordner: { vpnr: '600033', fachgebiet: '01' },
        antragsdatum: '2026-10-01',
        transport: {
          datum: DATUM,
          beginn: '07:30',
          ende: '07:45',
          von: { staat: 'AUT', plz: '5020' },
          nach: { vpnr: '543210' },
          grund: '26',
          art: '03',
          fahrzeug: '05',
          zeitkritisch: false,
          befoerderung: '1',
        },
        rechnungsnummer: 'T2026-0815',
        leistungen: [{ position: l.position, tarifCent: l.tarifCent, anzahl: l.anzahl, ustProzent: 10 }],
        diagnose: { icd10: [{ code: 'N18' }] },
      },
    ],
  });
  const gelesen = liesDktBestand(datei).faelle[0]!.leistungen[0]!;
  assert.deepEqual(
    [gelesen.position, gelesen.tarifCent, gelesen.anzahl, gelesen.betragCent],
    ['054', 1035, 1, l.betragCent],
  );
});
