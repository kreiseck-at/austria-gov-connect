import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  familienhospizAnmeldung,
  familienhospizAbmeldung,
  familienhospizAenderungsmeldung,
  familienhospizStornoAnmeldung,
  familienhospizStornoAbmeldung,
  familienhospizRichtigstellungAnmeldung,
  familienhospizRichtigstellungAbmeldung,
  erstelleFamilienhospizBestand,
  type FamilienhospizFelder,
} from './familienhospiz';
import { FELDER_E12, SATZLAENGE_E12 } from './felder-e12';
import { PFLICHT_E12, FELDGRUPPEN_E12 } from './pflicht-e12';
import { KARENZART } from './pruefung-e12';
import { pruefeFeldtabelle } from './festsatz';
import { anmeldung } from './versichertenmeldung';
import { SATZTRENNER, type BestandOptionen } from './bestand';

// Erfundene Werte: Ersatznamen aus dem Repo, Versicherungsnummer mit
// stimmiger Prüfziffer, Beitragskontonummer aus dem Ersatz-Set.
const PERSON = { VSNR: '7890030990', FANA: 'Lindmayr', VONA: 'Livia' };
const DG = { BKNR: '4711815', DGNA: 'Melisse Nails e.U.' };
const BASIS: FamilienhospizFelder = { ...DG, ...PERSON, ADAT: '01032026', KART: '04' };
const ANMELDUNG: FamilienhospizFelder = {
  ...BASIS,
  GESL: '2',
  STSL: 'AUT',
  WKFZ: 'A',
  PLZL: '5020',
  WORT: 'Salzburg',
  STRA: 'Rosengasse 3/2',
};

const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '15',
  datentraegernummer: '000001',
  erstellt: new Date('2026-03-02T09:30:15+01:00'),
  testdaten: true,
  hersteller: {
    name: 'Melisse Nails e.U.',
    kfz: 'A',
    plz: '5020',
    ort: 'Salzburg',
    strasse: 'Rosengasse 3',
    mail: 'test@example.at',
  },
};

const feld = (satz: string, name: string): string => {
  const f = FELDER_E12.find((x) => x.name === name)!;
  return satz.slice(f.pos - 1, f.pos - 1 + f.laenge);
};

test('E.12: 29 Felder, lückenlos bis Position 850', () => {
  assert.equal(FELDER_E12.length, 29);
  assert.equal(SATZLAENGE_E12, 850);
  assert.doesNotThrow(() => pruefeFeldtabelle(FELDER_E12, SATZLAENGE_E12));
  assert.deepEqual(
    FELDER_E12.map((f) => f.nr),
    Array.from({ length: 29 }, (_, i) => i + 1),
  );
});

test('E.12: Stichproben gegen die Feldtabelle (Seiten 220/221)', () => {
  const nach = (name: string) => FELDER_E12.find((f) => f.name === name);
  assert.deepEqual(nach('BKNR'), { nr: 2, name: 'BKNR', pos: 21, laenge: 10, typ: 'a/n' });
  assert.equal(nach('VSNR')?.pos, 178);
  assert.equal(nach('GESL')?.pos, 506);
  assert.equal(nach('ADAT')?.pos, 782);
  assert.deepEqual(nach('KART'), { nr: 25, name: 'KART', pos: 798, laenge: 2, typ: 'n' });
  assert.deepEqual(nach('EWFH'), { nr: 27, name: 'EWFH', pos: 808, laenge: 8, typ: 'n' });
  assert.deepEqual(nach('RESE'), { nr: 29, name: 'RESE', pos: 846, laenge: 5, typ: 'a/n' });
});

test('E.12.1: Matrix nach Satzart, abgelesen am Tabellenbild', () => {
  assert.equal(PFLICHT_E12['80'].GESL, 'Z');
  assert.equal(PFLICHT_E12['81'].GESL, '-');
  assert.equal(PFLICHT_E12['82'].AKGR, '-');
  assert.equal(PFLICHT_E12['82'].EVFH, 'V');
  assert.equal(PFLICHT_E12['83'].AKG2, '-');
  assert.equal(PFLICHT_E12['85'].RDAT, 'Z');
  assert.equal(PFLICHT_E12['84'].RDAT, '-');
  assert.equal(PFLICHT_E12['80'].FNA1, 'Z1');
  assert.equal(PFLICHT_E12['81'].FNA1, '-');
  // Verbundene Zellen: nicht je Feld erzwungen, als Gruppe ausgewiesen.
  assert.equal(PFLICHT_E12['80'].VSNR, 'Z1');
  assert.equal(PFLICHT_E12['80'].WKFZ, 'Z1');
  assert.equal(PFLICHT_E12['82'].WKFZ, '-');
  assert.equal(PFLICHT_E12['81'].WKFZ, 'Z3');
  assert.deepEqual(FELDGRUPPEN_E12[1], { satzarten: ['80'], felder: ['WKFZ', 'PLZL', 'WORT', 'STRA'] });
  // Jedes Feld außer Identifikationsteil und Reserve hat eine Zeile.
  assert.deepEqual(
    Object.keys(PFLICHT_E12['80']),
    FELDER_E12.map((f) => f.name).filter((n) => n !== 'IDTEIL' && n !== 'RESE'),
  );
});

test('jede Satzart trägt ihren Code', () => {
  assert.equal(familienhospizAnmeldung(ANMELDUNG).satzart, '80');
  assert.equal(familienhospizAbmeldung({ ...BASIS, ADAT: '31052026' }).satzart, '81');
  assert.equal(familienhospizAenderungsmeldung({ ...BASIS, KART: '03' }).satzart, '82');
  assert.equal(familienhospizStornoAnmeldung(BASIS).satzart, '83');
  assert.equal(familienhospizStornoAbmeldung({ ...BASIS, ADAT: '31052026' }).satzart, '84');
  assert.equal(familienhospizRichtigstellungAnmeldung({ ...BASIS, RDAT: '02032026' }).satzart, '85');
  assert.equal(
    familienhospizRichtigstellungAbmeldung({ ...BASIS, ADAT: '31052026', RDAT: '30052026' }).satzart,
    '86',
  );
});

test('Bestand FH, Version 03, Satzlänge 850 — Felder an ihrer Stelle', () => {
  const inhalt = erstelleFamilienhospizBestand([familienhospizAnmeldung(ANMELDUNG)], OPT);
  const saetze = inhalt.toString('latin1').split(SATZTRENNER.toString('latin1'));
  assert.equal(saetze.length, 3);
  const [vorlauf, satz, schluss] = saetze as [string, string, string];
  for (const s of saetze) assert.equal(s.length, 850);
  assert.equal(vorlauf.slice(22, 24), 'FH');
  assert.equal(vorlauf.slice(149, 151), '03');
  assert.equal(schluss.slice(0, 2), '99');
  assert.equal(satz.slice(0, 2), '80');
  assert.equal(feld(satz, 'BKNR'), '4711815   ');
  assert.equal(feld(satz, 'VSNR'), '7890030990');
  assert.equal(feld(satz, 'GEBD'), '00000000');
  assert.equal(feld(satz, 'FANA').trimEnd(), 'Lindmayr');
  assert.equal(feld(satz, 'GESL'), '2');
  assert.equal(feld(satz, 'STSL'), 'AUT');
  assert.equal(feld(satz, 'ADAT'), '01032026');
  assert.equal(feld(satz, 'RDAT'), '00000000');
  assert.equal(feld(satz, 'KART'), '04');
  assert.equal(feld(satz, 'EVFH'), '00000000');
  assert.equal(feld(satz, 'RESE'), '     ');
});

test('ein Satz aus einer anderen Verarbeitung gehört nicht in den Bestand FH', () => {
  const vr = anmeldung({
    REFW: 'R1',
    ...DG,
    ...PERSON,
    ADAT: '01032026',
    BBER: '01',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: '4000',
  });
  assert.throws(() => erstelleFamilienhospizBestand([vr], OPT), /keine Familienhospiz-Meldung/);
});

test('Prüfkatalog Allgemein: Codes stehen vorne in der Meldung', () => {
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, BKNR: undefined }), /F0010/);
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, BKNR: 'NEU' }), /F0011/);
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, BKNR: '4711 815' }), /F0011/);
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, DGNA: ' ' }), /F0020/);
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, VSNR: undefined }), /F0030/);
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, VSNR: '7890330990' }), /F0040/);
  assert.throws(
    () => familienhospizStornoAnmeldung({ ...BASIS, VSNR: undefined, GEBD: '31021990' }),
    /F0050/,
  );
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, FANA: undefined }), /F0060/);
  assert.throws(() => familienhospizStornoAnmeldung({ ...BASIS, VONA: undefined }), /F0070/);
});

test('ohne Versicherungsnummer genügt das Geburtsdatum (F0030)', () => {
  assert.doesNotThrow(() => familienhospizStornoAnmeldung({ ...BASIS, VSNR: undefined, GEBD: '03091990' }));
});

test('Anmeldung: Geschlecht, Staatsangehörigkeit', () => {
  assert.throws(() => familienhospizAnmeldung({ ...ANMELDUNG, GESL: undefined }), /F0080/);
  assert.throws(() => familienhospizAnmeldung({ ...ANMELDUNG, GESL: '5' }), /F0082/);
  for (const gesl of ['1', '2', '3', '4', '6', '7']) {
    assert.doesNotThrow(() => familienhospizAnmeldung({ ...ANMELDUNG, GESL: gesl }), gesl);
  }
  assert.throws(() => familienhospizAnmeldung({ ...ANMELDUNG, STSL: undefined }), /F0090/);
  // Bei der Abmeldung stehen sie in Grundstellung.
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, GESL: '2' }), /GESL ist in Grundstellung/);
});

test('Datum und richtiges Datum', () => {
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, ADAT: undefined }), /F0140/);
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, ADAT: '31022026' }), /F0141/);
  assert.throws(() => familienhospizRichtigstellungAnmeldung(BASIS), /F0160/);
  assert.throws(() => familienhospizRichtigstellungAnmeldung({ ...BASIS, RDAT: '00032026' }), /F0161/);
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, RDAT: '02032026' }), /RDAT ist in Grundstellung/);
});

test('Karenzart: Pflicht und Codeliste 01 bis 07', () => {
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, KART: undefined }), /F3000/);
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, KART: '08' }), /F3001/);
  for (const kart of Object.values(KARENZART)) {
    assert.doesNotThrow(() => familienhospizAbmeldung({ ...BASIS, KART: kart }), kart);
  }
});

test('Entgelte nur bei den Karenzarten 01 und 02 (F3010, F3020)', () => {
  assert.throws(() => familienhospizAnmeldung({ ...ANMELDUNG, KART: '01' }), /F3010/);
  assert.doesNotThrow(() => familienhospizAnmeldung({ ...ANMELDUNG, KART: '01', EVFH: '250000' }));
  assert.throws(() => familienhospizAnmeldung({ ...ANMELDUNG, KART: '02', EVFH: '250000' }), /F3020/);
  assert.doesNotThrow(() =>
    familienhospizAnmeldung({ ...ANMELDUNG, KART: '02', EVFH: '250000', EWFH: '120000' }),
  );
  // Bei der Abmeldung stehen die Entgelte laut Matrix in Grundstellung.
  assert.throws(() => familienhospizAbmeldung({ ...BASIS, EVFH: '250000' }), /EVFH ist in Grundstellung/);
  // Nicht numerisch: weist der Satzbau ab (F3011/F3021).
  assert.throws(
    () =>
      erstelleFamilienhospizBestand(
        [familienhospizAnmeldung({ ...ANMELDUNG, KART: '01', EVFH: '2500,00' })],
        OPT,
      ),
    /EVFH/,
  );
});

test('Änderungsmeldung: Namen ja, Anschrift nein', () => {
  assert.throws(
    () => familienhospizAenderungsmeldung({ ...BASIS, WORT: 'Salzburg' }),
    /WORT ist in Grundstellung/,
  );
});

test('der gebaute Satz ist eingefroren', () => {
  const satz = familienhospizAbmeldung(BASIS);
  assert.ok(Object.isFrozen(satz));
  assert.ok(Object.isFrozen(satz.werte));
});
