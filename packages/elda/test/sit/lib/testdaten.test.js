'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { ladeTestdaten, pruefeTestdaten, ROLLEN } = require('./testdaten');

const BEISPIEL = path.join(__dirname, '..', 'testdaten.beispiel.json');
const roh = () => JSON.parse(fs.readFileSync(BEISPIEL, 'utf8'));

test('die Vorlage ist gültig und enthält alle Rollen', () => {
  const td = ladeTestdaten(BEISPIEL);
  assert.equal(td.seriennummer, undefined);
  for (const r of ROLLEN) assert.ok(td.rolle(r).vsnr, r);
});

test('Konten: nach Träger und nach freien DN', () => {
  const td = ladeTestdaten(BEISPIEL);
  assert.equal(td.konto('A', { traeger: '14' }).bknr, '12345678');
  assert.equal(td.konto('A', { traeger: '15' }).bknr, '1234567');
  assert.equal(td.konto('B', { traeger: '15' }).bknr, '2345678');
  assert.equal(td.konto('B', { traeger: '15', freieDN: true }).bknr, '3456789');
  assert.throws(() => td.konto('A', { traeger: '17' }), /kein Konto/);
  assert.throws(() => td.konto('C', { traeger: '14' }), /Dienstgeber 'C'/);
});

test('mehrdeutiges Konto ist ein Fehler', () => {
  const d = roh();
  d.dienstgeber.A.konten.push({ traeger: '14', bknr: '87654321', freieDN: false });
  assert.throws(() => pruefeTestdaten(d).konto('A', { traeger: '14' }), /mehrdeutig/);
});

test('Hersteller ist der Dienstgeber des Bestands (übermittelnde Stelle)', () => {
  const h = ladeTestdaten(BEISPIEL).hersteller('B');
  assert.deepEqual(h, {
    name: 'Musterbetrieb B',
    kfz: 'A',
    plz: '8010',
    ort: 'Graz',
    strasse: 'Musterplatz 2',
    mail: 'test@example.at',
  });
});

test('fehlerhafte Testdaten werden mit Ort und Grund abgelehnt', () => {
  const ohneRolle = roh();
  delete ohneRolle.rollen.freier_dn;
  assert.throws(() => pruefeTestdaten(ohneRolle), /Rolle 'freier_dn'/);

  const vsnr = roh();
  vsnr.rollen.arbeiter.vsnr = '12345';
  assert.throws(() => pruefeTestdaten(vsnr), /arbeiter.*vsnr/);

  const geb = roh();
  geb.rollen.arbeiter.geburtsdatum = '1980-01-01';
  assert.throws(() => pruefeTestdaten(geb), /geburtsdatum/);

  const sn = roh();
  sn.seriennummer = '123456';
  assert.throws(() => pruefeTestdaten(sn), /gehört nicht in die Testdaten/);

  const konto = roh();
  konto.dienstgeber.A.konten[0].freieDN = 'nein';
  assert.throws(() => pruefeTestdaten(konto), /freieDN/);
});

test('unbekannte Rolle beim Zugriff', () => {
  assert.throws(() => ladeTestdaten(BEISPIEL).rolle('chef'), /Rolle 'chef'/);
});
