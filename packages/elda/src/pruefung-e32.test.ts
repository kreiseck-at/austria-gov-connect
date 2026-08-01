import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeMbgmPaket, pruefeBeitragskontonummer, HOECHSTANZAHL } from './pruefung-e32';
import {
  erstelleMbgmPaket,
  VERRECHNUNGSGRUNDLAGE,
  type PaketOptionen,
  type Beitragsgrundlagenmeldung,
} from './mbgm';

const OPT: PaketOptionen = {
  verfahren: 'selbstabrechnung',
  paketreferenzwert: 'P-1',
  beitragskontonummer: '1234567',
  dienstgebername: 'Musterbetrieb',
  beitragszeitraum: '072026',
  jaehrlicheAbrechnungGeringfuegiger: false,
};

const MELDUNG: Beitragsgrundlagenmeldung = {
  referenzwert: 'M-1',
  versicherungsnummer: '1234010180',
  familienname: 'Muster',
  vorname: 'Max',
  verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
  tarifbloecke: [
    {
      beschaeftigtengruppe: 'B002',
      beginnDerVerrechnung: 1,
      basen: [
        {
          typ: 'AB',
          betragCent: 200_000,
          positionen: [{ typ: 'T01', prozentsatz: 39.6, betragCent: 79_200 }],
        },
      ],
    },
  ],
};

test('ein selbst gebautes Paket loest keine der kodierten Regeln aus', () => {
  assert.deepEqual(pruefeMbgmPaket(erstelleMbgmPaket([MELDUNG], OPT)), []);
  assert.deepEqual(pruefeMbgmPaket(erstelleMbgmPaket([MELDUNG], { ...OPT, verfahren: 'vorschreibung' })), []);
});

test('F9051: eine verfaelschte Gesamtsumme wird mit dem ELDA-Code benannt', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, GSUM: '99999' } };
  const b = pruefeMbgmPaket(saetze);
  assert.equal(b.length, 1);
  assert.equal(b[0]?.code, 'F9051');
  assert.equal(b[0]?.schwere, 'fehler');
});

test('F9051 gilt nur fuer den Selbstabrechner', () => {
  // Beim Vorschreiber ist GSUM mit Z4 gekennzeichnet und der Pruefkatalog
  // fuehrt fuer PV keine entsprechende Regel.
  const saetze = erstelleMbgmPaket([MELDUNG], { ...OPT, verfahren: 'vorschreibung' });
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, GSUM: '99999' } };
  assert.deepEqual(pruefeMbgmPaket(saetze), []);
});

test('F9060: eine falsche Anzahl wird in Kopf und Ende erkannt', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, ANZM: '7' } };
  const b = pruefeMbgmPaket(saetze);
  assert.equal(b.filter((x) => x.code === 'F9060').length, 1);
});

test('F9040: der Beitragszeitraum ist erst ab 01.01.2019 fachlich gueltig', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  const mit = (bzrm: string) => {
    const kopie = [...saetze];
    kopie[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, BZRM: bzrm } };
    return pruefeMbgmPaket(kopie).filter((b) => b.code === 'F9040');
  };
  assert.equal(mit('122018').length, 1, 'Dezember 2018 liegt davor');
  assert.equal(mit('012019').length, 0, 'Jaenner 2019 ist der erste gueltige');
  assert.equal(mit('132026').length, 1, 'Monat 13 gibt es nicht');
  assert.equal(mit('072026').length, 0);
});

test('F9031: JAGB kennt nur J und N', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, JAGB: 'X' } };
  assert.equal(pruefeMbgmPaket(saetze).filter((b) => b.code === 'F9031').length, 1);
});

test('F9070: das Paket muss mit PS/PV beginnen und mit PE enden', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  assert.equal(
    pruefeMbgmPaket(saetze.slice(1)).some((b) => b.code === 'F9070'),
    true,
  );
  assert.equal(
    pruefeMbgmPaket([]).some((b) => b.code === 'F9070'),
    true,
  );
});

test('F9072: die Hoechstanzahl der Verrechnungspositionen ist eine Warnung', () => {
  const viele = {
    ...MELDUNG,
    tarifbloecke: [
      {
        beschaeftigtengruppe: 'B002',
        beginnDerVerrechnung: 1,
        basen: [
          {
            typ: 'AB' as const,
            betragCent: 200_000,
            positionen: Array.from({ length: HOECHSTANZAHL.verrechnungsposition + 1 }, () => ({
              typ: 'T01' as const,
              prozentsatz: 1,
              betragCent: 1,
            })),
          },
        ],
      },
    ],
  };
  const b = pruefeMbgmPaket(erstelleMbgmPaket([viele], OPT));
  const f = b.filter((x) => x.code === 'F9072');
  assert.equal(f.length, 1);
  assert.equal(f[0]?.schwere, 'warnung', 'Status W im Pruefkatalog');
});

test('die Beitragskontonummer wird gegen den Traeger geprueft', () => {
  // Salzburg: sieben Stellen.
  assert.equal(pruefeBeitragskontonummer('1234567', 'ÖGK-S'), undefined);
  const b = pruefeBeitragskontonummer('12345678', 'ÖGK-S');
  assert.equal(b?.schwere, 'warnung', 'eine abweichende Laenge weist ELDA nicht zurueck');
  assert.match(b?.meldung ?? '', /7/);
  // Unbekannter Traeger: keine Aussage statt einer geratenen.
  assert.equal(pruefeBeitragskontonummer('123', 'IRGENDWER'), undefined);
});
