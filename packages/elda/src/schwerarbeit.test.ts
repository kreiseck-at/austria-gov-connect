import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  schwerarbeitsmeldung,
  stornoSchwerarbeitsmeldung,
  erstelleSchwerarbeitBestand,
  type SchwerarbeitsFelder,
} from './schwerarbeit';
import { FELDER_E22, SATZLAENGE_E22, TAETIGKEITSBLOECKE } from './felder-e22';
import { PFLICHT_E22 } from './pflicht-e22';
import { TAETIGKEIT } from './pruefung-e22';
import { pruefeFeldtabelle } from './festsatz';
import { SATZTRENNER, type BestandOptionen } from './bestand';

// Erfundene Werte: Ersatznamen aus dem Repo, Versicherungsnummer mit
// stimmiger Prüfziffer, Beitragskontonummer aus dem Ersatz-Set.
const MELDUNG: SchwerarbeitsFelder = {
  BKNR: '4711815',
  DGNA: 'Bäckerei Kornblum',
  DKFZ: 'A',
  DPLZ: '5020',
  DORT: 'Salzburg',
  DSTR: 'Mühlgasse 7',
  VSNR: '4563120581',
  GEBD: '12051981',
  FANA: 'Weinzierl',
  VONA: 'Mirela',
  JAHR: '2026',
  taetigkeiten: [
    { art: TAETIGKEIT.SCHICHT_ODER_WECHSELDIENST, von: '0101', bis: '3006' },
    { art: TAETIGKEIT.HITZE_ODER_KAELTE, von: '0107', bis: '3112' },
  ],
};

const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '15',
  datentraegernummer: '000001',
  erstellt: new Date('2027-02-01T09:30:15+01:00'),
  testdaten: true,
  hersteller: {
    name: 'Bäckerei Kornblum',
    kfz: 'A',
    plz: '5020',
    ort: 'Salzburg',
    strasse: 'Mühlgasse 7',
    mail: 'test@example.at',
  },
};

const feld = (satz: string, name: string): string => {
  const f = FELDER_E22.find((x) => x.name === name)!;
  return satz.slice(f.pos - 1, f.pos - 1 + f.laenge);
};

test('E.22: 26 Tätigkeitsblöcke, lückenlos bis Position 800', () => {
  assert.equal(TAETIGKEITSBLOECKE, 26);
  assert.equal(SATZLAENGE_E22, 800);
  assert.equal(FELDER_E22.length, 16 + 26 * 3 + 2);
  assert.doesNotThrow(() => pruefeFeldtabelle(FELDER_E22, SATZLAENGE_E22));
});

test('E.22: Stichproben gegen die Feldtabelle (Seiten 267/268)', () => {
  const nach = (name: string) => FELDER_E22.find((f) => f.name === name);
  assert.deepEqual(nach('DTEL'), {
    nr: 6,
    name: 'DTEL',
    pos: 128,
    laenge: 50,
    typ: 'a/n',
    klasse: 'unternehmen',
  });
  assert.equal(nach('VSNR')?.pos, 340);
  assert.deepEqual(nach('JAHR'), { nr: 16, name: 'JAHR', pos: 498, laenge: 4, typ: 'n', format: 'JJJJ' });
  assert.deepEqual(nach('TART_1'), { nr: 17, name: 'TART_1', pos: 502, laenge: 2, typ: 'a/n' });
  assert.deepEqual(nach('TBIS_26'), {
    nr: 19,
    name: 'TBIS_26',
    pos: 758,
    laenge: 4,
    typ: 'n',
    format: 'TTMM',
  });
  assert.deepEqual(nach('REFN'), { nr: 20, name: 'REFN', pos: 762, laenge: 30, typ: 'a/n' });
  assert.deepEqual(nach('RESE'), { nr: 21, name: 'RESE', pos: 792, laenge: 9, typ: 'a/n' });
});

test('E.22.1: beide Satzarten mit denselben Stufen', () => {
  assert.deepEqual(PFLICHT_E22['65'], PFLICHT_E22['66']);
  assert.equal(PFLICHT_E22['65'].DKFZ, 'Z');
  assert.equal(PFLICHT_E22['65'].GEBD, 'Z');
  assert.equal(PFLICHT_E22['65'].MAIL, 'Z1');
  assert.equal(PFLICHT_E22['65'].TART_26, 'Z1');
  assert.equal(PFLICHT_E22['65'].REFN, 'Z3');
});

test('Bestand SM, Version 02, Satzlänge 800 — Blöcke an ihrer Stelle', () => {
  const inhalt = erstelleSchwerarbeitBestand([schwerarbeitsmeldung(MELDUNG)], OPT);
  const saetze = inhalt.toString('latin1').split(SATZTRENNER.toString('latin1'));
  assert.equal(saetze.length, 3);
  const [vorlauf, satz] = saetze as [string, string, string];
  for (const s of saetze) assert.equal(s.length, 800);
  assert.equal(vorlauf.slice(22, 24), 'SM');
  assert.equal(vorlauf.slice(149, 151), '02');
  assert.equal(satz.slice(0, 2), '65');
  assert.equal(feld(satz, 'JAHR'), '2026');
  assert.equal(satz.slice(501, 511), '1 01013006');
  assert.equal(satz.slice(511, 521), '2 01073112');
  assert.equal(satz.slice(521, 531), '  00000000');
  assert.equal(feld(satz, 'DSTR').trimEnd(), 'Mühlgasse 7');
});

test('Storno: Satzart 66, dieselben Felder', () => {
  assert.equal(stornoSchwerarbeitsmeldung(MELDUNG).satzart, '66');
});

test('ohne Anschrift des Dienstgebers: Pflichtmatrix (Z), obwohl der Katalog nur warnt', () => {
  assert.throws(() => schwerarbeitsmeldung({ ...MELDUNG, DSTR: undefined }), /DSTR ist zwingend/);
});

test('Versicherungsnummer und Geburtsdatum sind laut Matrix beide zwingend', () => {
  assert.throws(() => schwerarbeitsmeldung({ ...MELDUNG, GEBD: undefined }), /GEBD ist zwingend/);
  assert.throws(() => schwerarbeitsmeldung({ ...MELDUNG, VSNR: undefined }), /VSNR ist zwingend/);
  assert.throws(() => schwerarbeitsmeldung({ ...MELDUNG, VSNR: undefined, GEBD: undefined }), /F0030/);
});

test('Tätigkeitsjahr (F5500, F5501)', () => {
  assert.throws(() => schwerarbeitsmeldung({ ...MELDUNG, JAHR: undefined }), /F5500/);
  assert.throws(() => schwerarbeitsmeldung({ ...MELDUNG, JAHR: '26' }), /F5501/);
});

test('Beginn und Ende je Block (F5511_n, F5521_n, F5530_n)', () => {
  const mit = (t: { art: string; von: string; bis: string }) => ({
    ...MELDUNG,
    taetigkeiten: [MELDUNG.taetigkeiten![0]!, t],
  });
  assert.throws(() => schwerarbeitsmeldung(mit({ art: '4', von: '3202', bis: '3112' })), /F5511_2/);
  assert.throws(() => schwerarbeitsmeldung(mit({ art: '4', von: '0101', bis: '2902' })), /F5521_2/);
  assert.doesNotThrow(() =>
    schwerarbeitsmeldung({ ...mit({ art: '4', von: '0101', bis: '2902' }), JAHR: '2028' }),
  );
  assert.throws(() => schwerarbeitsmeldung(mit({ art: '4', von: '0107', bis: '3006' })), /F5530_2/);
  assert.throws(() => schwerarbeitsmeldung(mit({ art: '4', von: '0107', bis: '' })), /F5530_2/);
  assert.throws(() => schwerarbeitsmeldung(mit({ art: '4', von: '', bis: '' })), /F5530_2/);
});

test('Tätigkeitsart: Codes 1, 2, 4, 5, 6 (F5580_n)', () => {
  for (const art of ['3', '7', '01']) {
    assert.throws(
      () => schwerarbeitsmeldung({ ...MELDUNG, taetigkeiten: [{ art, von: '0101', bis: '3101' }] }),
      /F5580_1/,
      art,
    );
  }
  for (const art of Object.values(TAETIGKEIT)) {
    assert.doesNotThrow(() =>
      schwerarbeitsmeldung({ ...MELDUNG, taetigkeiten: [{ art, von: '0101', bis: '3101' }] }),
    );
  }
  // Zeitraum ohne Art ist nur eine Warnung (F5579) und wird gebaut.
  assert.doesNotThrow(() =>
    schwerarbeitsmeldung({ ...MELDUNG, taetigkeiten: [{ art: '', von: '0101', bis: '3101' }] }),
  );
});

test('mehr als 26 Tätigkeiten werden nicht geraten verteilt', () => {
  const t = { art: '1', von: '0101', bis: '0101' };
  assert.throws(
    () => schwerarbeitsmeldung({ ...MELDUNG, taetigkeiten: Array.from({ length: 27 }, () => t) }),
    /Platz für 26/,
  );
});

test('Tagesangabe ohne führende Null wird nicht aufgefüllt', () => {
  assert.throws(
    () =>
      erstelleSchwerarbeitBestand(
        [schwerarbeitsmeldung({ ...MELDUNG, taetigkeiten: [{ art: '1', von: '101', bis: '3101' }] })],
        OPT,
      ),
    /TTMM/,
  );
});
