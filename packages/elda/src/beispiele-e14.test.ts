import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lohnzettelSaetze } from './lohnzettel';
import { jahressteuerNachRechenblatt2026, pruefeLohnzettel } from './pruefung-e14';
import { BESTAND_OPT, LOHNZETTEL_2026, UEBERMITTLUNG_2026 } from './testdaten-l16.test';

// Quelle: Prüfkatalog L16 ab 1.1.2026, Version 09 vom 17.02.2026 (elda.at,
// l16_2026_pruefkatalog_v09_2026_02_17.xlsx), Blatt „FC 7002, 7003 für KJ 2026".
// Das Blatt rechnet ein Beispiel vor; die Eingaben und Zwischenergebnisse
// unten sind die Zellen des Blatts.
//
//   Eingaben: KZ220 25000, KZ225 1, KZ260 500, KZ245 10000, Soziale Stellung 4,
//   Lohnzettel Dauer 250 Tage (0,684931506849315), AVAB oder AEAB J, Kinder 0,
//   EHPAB N, Pendlerpauschale 0, FABO Plus Betrag 0.
//
//   BMGsB 24999 → (24999-620)*0,06 = 1462,74 / (24999-2490)*0,3 = 6752,7 → 1462,74
//   SUMME A 14600, SUMME B 14468, SUMME H 185,8, Verkehrsabsetzbetrag -496
//   SUMME I 1462,74; SUMME F -730; SUMME G 730
//   KZ260 - SUMME I < SUMME F → FC7002 „JA"; > SUMME G → FC7003 „NEIN"
const BLATT = {
  kz220: 25000,
  kz225: 1,
  kz245: 10000,
  freibetrag105: 0,
  freibetrag35: 0,
  sozialeStellung: 4,
  tage: 250,
  avabOderAeab: true,
  kinder: 0,
  erhoehterPab: false,
  pendlerpauschale: 0,
  fabo: 0,
};

test('Rechenblatt FC 7002/7003 (KJ 2026): SUMME I wie im Blatt', () => {
  const summeI = jahressteuerNachRechenblatt2026(BLATT);
  assert.ok(summeI !== undefined);
  assert.ok(Math.abs(summeI - 1462.74) < 0.005, String(summeI));
});

test('Rechenblatt: Bemessungsgrundlage bis 2.615 € steht nicht im Blatt', () => {
  assert.equal(jahressteuerNachRechenblatt2026({ ...BLATT, kz220: 2615, kz225: 0 }), undefined);
});

test('Rechenblatt: das Beispiel als Lohnzettel löst F7002 aus, nicht F7003', () => {
  // 01.01.–07.09.2026 sind 250 Tage, soziale Stellung 4, AVAB ohne Kinder.
  const lz = {
    ...LOHNZETTEL_2026,
    felder: { ...LOHNZETTEL_2026.felder, ENLZ: '0709', SOZS: '4', AVAB: 'J', PVLN: '1234', PGBD: '010180' },
    betraege: {
      B210: 3_500_000,
      B220: 2_500_000,
      BIEB: 100,
      B225: 100,
      B245: 1_000_000,
      BIEL: 50_000,
      B260: 50_000,
    },
  };
  const saetze = lohnzettelSaetze({ ...UEBERMITTLUNG_2026, lohnzettel: [lz] }, BESTAND_OPT.erstellt);
  const codes = pruefeLohnzettel(saetze, '28').map((b) => b.code);
  assert.ok(codes.includes('F7002'), codes.join());
  assert.ok(!codes.includes('F7003'), codes.join());
});

test('Testdaten: KZ 260 trifft die Jahressteuer nach Tarif genau', () => {
  const summeI = jahressteuerNachRechenblatt2026({
    ...BLATT,
    kz220: 6000,
    kz225: 1050,
    kz245: 29150,
    sozialeStellung: 3,
    tage: 365,
    avabOderAeab: false,
  });
  assert.ok(summeI !== undefined && Math.abs(summeI - 3562.2) < 0.005, String(summeI));
});
