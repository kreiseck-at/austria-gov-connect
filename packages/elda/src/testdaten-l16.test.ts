// Gemeinsame Testdaten für die Lohnzettel-Tests. Die Endung `.test.ts` hält die
// Datei aus dem veröffentlichten Paket; Tests enthält sie keine.
//
// Alles erfunden: Arbeitgeber, Arbeitnehmerin und Kennungen sind die
// Ersatzwerte der übrigen Tests (Steuernummer 91-123/4565, Versicherungsnummer
// aus dem Beispiel in Kapitel D.43).

import type { BestandOptionen } from './bestand';
import type { Lohnzettel, LohnzettelUebermittlung } from './lohnzettel';

/**
 * Ganzjährig beschäftigte Angestellte 2026, Beträge so gewählt, dass die
 * Summenregeln des Prüfkatalogs aufgehen:
 *
 * - KZ 230 = insgesamt einbehaltene Beiträge − KZ 225 − KZ 226 = 7.900 − 1.050 = 6.850 (`F4800`)
 * - KZ 245 = KZ 210 − KZ 215 − KZ 220 − KZ 230 − KZ 243 = 42.000 − 6.000 − 6.850 = 29.150 (`F6401`)
 * - KZ 260 = einbehaltene Lohnsteuer − Lohnsteuer mit festen Sätzen = 3.562,20 (`F7004`)
 *
 * KZ 260 entspricht genau der „Jahressteuer nach Tarif" des Rechenblatts
 * `FC 7002, 7003 für KJ 2026` für diese Werte: sonstige Bezüge
 * min((4.950 − 620) × 6 %, (4.950 − 2.490) × 30 %) = 259,80; Tarif auf
 * 29.150 − 132 = 29.018: (29.018 − 21.992) × 30 % + 1.690,60 = 3.798,40;
 * abzüglich Verkehrsabsetzbetrag 496 = 3.302,40; zusammen 3.562,20.
 */
export const LOHNZETTEL_2026: Lohnzettel = {
  felder: {
    REFN: 'DV-2026-0001',
    ARTL: '01',
    BELZ: '0101',
    ENLZ: '3112',
    SOZS: '3',
    AVLN: '1234',
    AGBD: '010180',
    ANAM: 'Weinzierl Mirela',
    AADR: 'Musterweg 1',
    ALKZ: 'A',
    APLZ: '5020',
    AORT: 'Salzburg',
    GESW: 'J',
    VOLL: 'J',
    GEBD: '01011980',
    REFN_175: 'L16-0001',
  },
  betraege: {
    B210: 4_200_000,
    B220: 600_000,
    BIEB: 790_000,
    B225: 105_000,
    B230: 685_000,
    B245: 2_915_000,
    BIEL: 356_220,
    B260: 356_220,
  },
};

export const UEBERMITTLUNG_2026: LohnzettelUebermittlung = {
  version: '28',
  jahr: 2026,
  arbeitgeber: {
    STNRA: '911234565',
    ANAM: 'Bäckerei Kornblum',
    AADR: 'Musterweg 1',
    ALKZ: 'A',
    APLZ: '5020',
    AORT: 'Salzburg',
    GESA: 1,
  },
  lohnzettel: [LOHNZETTEL_2026],
};

export const BESTAND_OPT: Omit<BestandOptionen, 'versicherungstraeger'> = {
  seriennummer: '1234567',
  datentraegernummer: '000001',
  erstellt: new Date('2027-01-15T09:30:05+01:00'),
  testdaten: true,
  hersteller: {
    name: 'Bäckerei Kornblum',
    kfz: 'A',
    plz: '5020',
    ort: 'Salzburg',
    strasse: 'Musterweg 1',
    mail: 'test@example.at',
  },
};
