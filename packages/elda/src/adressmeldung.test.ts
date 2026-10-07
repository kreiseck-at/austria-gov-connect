import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adresseVersicherter, erstelleAdressmeldungBestand, type AdressmeldungFelder } from './adressmeldung';
import { vsnrAnforderung } from './vsnr-anforderung';
import { FELDER_E31, SATZLAENGE_E31 } from './felder-e31';
import { PFLICHT_E31 } from './pflicht-e31';
import { pruefeFeldtabelle } from './festsatz';
import { SATZTRENNER, type BestandOptionen } from './bestand';

// Erfundene Werte; die Versicherungsnummer ist die aus dem Beispiel in Kapitel D.43.
const BASIS: AdressmeldungFelder = {
  REFW: 'AV-2026-0001',
  BKNR: '4711815',
  DGNA: 'Bäckerei Kornblum',
  VSNR: '1234010180',
  WKFZ: 'D',
  PLZL: '83395',
  WORT: 'Freilassing',
  WSTR: 'Musterweg',
  WHNR: '1',
};

const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '17',
  datentraegernummer: '000001',
  erstellt: new Date('2026-10-12T07:15:00+02:00'),
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

const fehler = (code: string) => (e: unknown) => e instanceof Error && e.message.startsWith(`${code}:`);

test('Feldtabelle E.31: lückenlos, 15 Felder, Satzlänge 416 (Seite 344)', () => {
  pruefeFeldtabelle(FELDER_E31, SATZLAENGE_E31);
  assert.equal(FELDER_E31.length, 15);
});

test('Pflichtmatrix E.31.1 nennt genau die Felder der Feldtabelle ohne Identifikationsteil', () => {
  assert.deepEqual(
    Object.keys(PFLICHT_E31),
    FELDER_E31.filter((f) => f.name !== 'IDTEIL').map((f) => f.name),
  );
});

test('der Satz steht Feld für Feld an den Positionen der Feldtabelle', () => {
  const bestand = erstelleAdressmeldungBestand([adresseVersicherter(BASIS)], OPT);
  const [vorlauf, satz] = bestand.toString('latin1').split(SATZTRENNER.toString('latin1'));
  const feld = (name: string): string => {
    const f = FELDER_E31.find((x) => x.name === name)!;
    return satz!.slice(f.pos - 1, f.pos - 1 + f.laenge);
  };
  assert.equal(satz!.length, 416);
  assert.equal(feld('IDTEIL').slice(0, 2), 'AV');
  assert.equal(feld('VSNR'), '1234010180');
  assert.equal(feld('WKFZ'), 'D  ');
  assert.equal(feld('PLZL'), '83395    ');
  assert.equal(feld('WORT').trimEnd(), 'Freilassing');
  assert.equal(feld('WHNR'), '1         ');
  assert.equal(vorlauf!.slice(22, 24), 'AV');
  assert.equal(vorlauf!.slice(149, 151), '01');
});

test('leere Pflichtfelder tragen den Code des Prüfkatalogs', () => {
  assert.throws(() => adresseVersicherter({ ...BASIS, REFW: '' }), fehler('F8000'));
  assert.throws(() => adresseVersicherter({ ...BASIS, BKNR: '' }), fehler('F8010'));
  assert.throws(() => adresseVersicherter({ ...BASIS, DGNA: '' }), fehler('F8020'));
  assert.throws(() => adresseVersicherter({ ...BASIS, VSNR: '0000000000' }), fehler('F8030'));
  assert.throws(() => adresseVersicherter({ ...BASIS, WKFZ: '' }), fehler('F8040'));
  assert.throws(() => adresseVersicherter({ ...BASIS, PLZL: '' }), fehler('F8050'));
  assert.throws(() => adresseVersicherter({ ...BASIS, WORT: '' }), fehler('F8060'));
  assert.throws(() => adresseVersicherter({ ...BASIS, WSTR: '' }), fehler('F8070'));
});

test('F8031: Versicherungsnummer mit falscher Stellenfolge', () => {
  assert.throws(() => adresseVersicherter({ ...BASIS, VSNR: '1234320180' }), fehler('F8031'));
  assert.throws(() => adresseVersicherter({ ...BASIS, VSNR: '1234011680' }), fehler('F8031'));
});

test('F8041: ein inländischer Wohnsitz (A) ist keine Adressmeldung', () => {
  assert.throws(() => adresseVersicherter({ ...BASIS, WKFZ: 'A' }), fehler('F8041'));
  assert.throws(() => adresseVersicherter({ ...BASIS, WKFZ: ' A ' }), fehler('F8041'));
  assert.doesNotThrow(() => adresseVersicherter({ ...BASIS, WKFZ: 'CH', PLZL: '9000', WORT: 'St. Gallen' }));
});

test('ein AV-Bestand nimmt keine VSNR-Anforderung auf (Kapitel C.1)', () => {
  const vs = vsnrAnforderung({
    REFW: 'VS-1',
    BKNR: '4711815',
    DGNA: 'Bäckerei Kornblum',
    GEBD: '14031998',
    FANA: 'Weinzierl',
    VONA: 'Mirela',
    GESL: '2',
    STSL: 'AUT',
    WKFZ: 'A',
    PLZL: '5020',
    WORT: 'Salzburg',
    WSTR: 'Musterweg',
  });
  assert.throws(
    () => erstelleAdressmeldungBestand([adresseVersicherter(BASIS), vs], OPT),
    /nur Adressmeldungen/,
  );
});

test('F8012: bei der ÖGK-V keine BKNR mit führendem Leerzeichen', () => {
  const satz = adresseVersicherter({ ...BASIS, BKNR: ' 471181' });
  assert.throws(
    () => erstelleAdressmeldungBestand([satz], { ...OPT, versicherungstraeger: '19' }),
    fehler('F8012'),
  );
});
