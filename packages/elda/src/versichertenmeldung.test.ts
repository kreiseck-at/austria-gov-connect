import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anmeldung,
  abmeldung,
  aenderungsmeldung,
  richtigstellungAnmeldung,
  richtigstellungAbmeldung,
  stornoAnmeldung,
  stornoAbmeldung,
  wochenarbeitszeit,
} from './versichertenmeldung';
import { EldaError } from './errors';

const BASIS = { REFW: 'REF-1', BKNR: '1234567', DGNA: 'Muster GmbH', VSNR: '1234010180' };

test('jede Satzart trägt ihren Code', () => {
  assert.equal(
    anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', BBER: '05', GERF: 'N', FRDV: 'N' })
      .satzart,
    'M3',
  );
  assert.equal(
    abmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', GERF: 'N', AGRD: '01' }).satzart,
    'M4',
  );
  assert.equal(aenderungsmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026' }).satzart, 'M6');
  assert.equal(
    richtigstellungAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026', RDAT: '02022026' }).satzart,
    'M8',
  );
  assert.equal(
    richtigstellungAbmeldung({
      ...BASIS,
      REFU: 'U',
      ADAT: '01022026',
      RDAT: '02022026',
      GERF: 'N',
      AGRD: '01',
    }).satzart,
    'M9',
  );
  assert.equal(stornoAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026' }).satzart, 'S3');
  assert.equal(stornoAbmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026' }).satzart, 'S4');
});

test('Anmeldung ohne Pflichtfeld wirft', () => {
  assert.throws(
    () => anmeldung({ ...BASIS, FANA: 'Maier', VONA: 'Anna', ADAT: '01022026', GERF: 'N', FRDV: 'N' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /BBER/);
      return true;
    },
  );
});

test('Storno erlaubt keinen Familiennamen (Feld in Grundstellung)', () => {
  assert.throws(() => stornoAnmeldung({ ...BASIS, REFU: 'U', ADAT: '01022026', FANA: 'Maier' }), EldaError);
});

test('Inhaltsregeln greifen zusätzlich zur Pflichtmatrix', () => {
  assert.throws(
    () =>
      anmeldung({
        ...BASIS,
        FANA: 'Maier',
        VONA: 'Anna',
        ADAT: '01012026',
        BBER: '01',
        GERF: 'N',
        FRDV: 'N',
      }),
    (err: unknown) => {
      assert.match((err as Error).message, /F7115/);
      return true;
    },
  );
});

test('der Satz enthält die Werte an den Positionen des Dokuments', () => {
  const satz = anmeldung({
    ...BASIS,
    FANA: 'Maier',
    VONA: 'Anna',
    ADAT: '01022026',
    BBER: '05',
    GERF: 'N',
    FRDV: 'N',
  });
  assert.equal(satz.werte.BKNR, '1234567');
  assert.equal(satz.satzlaenge, 772);
  assert.equal(satz.felder.length, 39);
});

test('wochenarbeitszeit: 15 Stunden 40 Minuten ergeben 1567 (Beispiel aus E.29.2)', () => {
  assert.equal(wochenarbeitszeit(15, 40), '1567');
  assert.equal(wochenarbeitszeit(38, 30), '3850');
  assert.equal(wochenarbeitszeit(40), '4000');
  assert.equal(wochenarbeitszeit(8, 20), '0833');
});

test('wochenarbeitszeit: unsinnige Eingaben werfen', () => {
  assert.throws(() => wochenarbeitszeit(-1), EldaError);
  assert.throws(() => wochenarbeitszeit(10, 60), EldaError);
  assert.throws(() => wochenarbeitszeit(100), EldaError);
});
