'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const elda = require('../../../dist/index.js');
const { ladeTestdaten } = require('./testdaten');
const { erstelleAblage } = require('./ablage');
const { baueKontext } = require('./kontext');
const { wienerZeit } = require('./fenster');

// Alle Temp-Ordner dieser Datei liegen unter einer Wurzel, die am Ende gelöscht wird.
const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-test-'));
after(() => fs.rmSync(WURZEL, { recursive: true, force: true }));

const TESTDATEN = ladeTestdaten(path.join(__dirname, '..', 'testdaten.beispiel.json'));
const DI_0745 = new Date('2026-10-06T05:45:30Z'); // Di 07:45:30 Wien, KW41

function aufbau(ereignisse = []) {
  const ablage = erstelleAblage(fs.mkdtempSync(path.join(WURZEL, 'sit-kontext-')));
  for (const e of ereignisse) ablage.protokolliere(e);
  return ablage;
}

const kontext = (ablage, jetzt = DI_0745) =>
  baueKontext({
    fenster: 'di-vm',
    testdaten: TESTDATEN,
    ereignisse: ablage.ereignisse(),
    jetzt,
    elda,
    ablage,
    softwareId: 'X 1.0',
    seriennummer: '9876543',
  });

test('Datum, Erstellungszeitpunkt und Dateiname folgen dem Fenster', () => {
  const ctx = kontext(aufbau());
  assert.equal(ctx.zr, '2025-03-01');
  assert.equal(ctx.ttmmjjjj(ctx.zr), '01032025');
  assert.deepEqual(wienerZeit(ctx.erstellt), { datum: '2025-03-01', zeit: '07:45:30', wochentag: 6 });
  assert.equal(ctx.dateiName('V07'), 'sit-V07-261006074530.dat');
});

test('referenzwert ist eindeutig und passt in REFW (40 Zeichen)', () => {
  const ctx = kontext(aufbau());
  const a = ctx.referenzwert('V07');
  const b = ctx.referenzwert('V07');
  assert.notEqual(a, b);
  assert.ok(a.length <= 40 && b.length <= 40);
  assert.match(a, /^SIT-V07-261006074530$/);
});

test('Vorläufe: nur erfolgreiche Läufe derselben Woche', () => {
  const ablage = aufbau([
    {
      art: 'lauf',
      fall: 'V01',
      zeit: '2026-09-28T05:30:00Z',
      statusCode: '000',
      referenzwerte: ['ALT'],
      protokollnummer: '1',
    },
    {
      art: 'lauf',
      fall: 'V02',
      zeit: '2026-10-05T05:31:00Z',
      statusCode: '403',
      referenzwerte: ['ABGEWIESEN'],
    },
  ]);
  const ctx = kontext(ablage);
  assert.throws(() => ctx.referenzwertVon('V01'), /V01 ist in dieser Woche noch nicht erfolgreich gelaufen/);
  assert.throws(() => ctx.referenzwertVon('V02'), /V02 ist in dieser Woche/);

  ablage.protokolliere({
    art: 'lauf',
    fall: 'V01',
    zeit: '2026-10-05T05:32:00Z',
    statusCode: '000',
    referenzwerte: ['SIT-V01-NEU'],
    protokollnummer: '18000001',
  });
  const ctx2 = kontext(ablage);
  assert.equal(ctx2.referenzwertVon('V01'), 'SIT-V01-NEU');
  assert.equal(ctx2.protokollnummerVon('V01'), '18000001');
  assert.throws(() => ctx2.zrVon('V01'), /kein simuliertes Datum/);
  ablage.protokolliere({
    art: 'lauf',
    fall: 'V02',
    zeit: '2026-10-05T05:40:00Z',
    statusCode: '000',
    zr: '2025-01-01',
    referenzwerte: ['R2'],
  });
  assert.equal(kontext(ablage).zrVon('V02'), '2025-01-01');
});

test('bestandVon liest den gesicherten Bestand byte-gleich', () => {
  const ablage = aufbau();
  const lauf = ablage.neuerLauf('V01');
  const bytes = Buffer.from([0x41, 0xe4, 0x0d, 0x0a, 0x42]);
  ablage.schreibe(lauf.ordner, 'bestand.dat', bytes);
  ablage.protokolliere({
    art: 'lauf',
    fall: 'V01',
    zeit: '2026-10-05T05:32:00Z',
    statusCode: '000',
    ordner: lauf.id,
    dateiName: 'sit-V01-x.dat',
    referenzwerte: ['R'],
  });
  const b = kontext(ablage).bestandVon('V01');
  assert.equal(b.dateiName, 'sit-V01-x.dat');
  assert.ok(b.inhalt.equals(bytes));
});

test('bestandOptionen: SIT-Seriennummer, Träger, TM, simuliertes Datum, laufende Datenträgernummer, Hersteller', () => {
  const ablage = aufbau([
    { art: 'lauf', fall: 'V01', aktion: 'senden', statusCode: '000' },
    { art: 'lauf', fall: 'Z01', aktion: 'auflisten', statusCode: '000' },
  ]);
  const ctx = kontext(ablage);
  const o = ctx.bestandOptionen({ dg: 'A', traeger: '15' });
  assert.equal(o.seriennummer, '9876543');
  assert.equal(o.versicherungstraeger, '15');
  assert.equal(o.testdaten, true);
  assert.equal(o.datentraegernummer, '000002');
  assert.equal(o.erstellt.getTime(), ctx.erstellt.getTime());
  assert.deepEqual(o.hersteller, { ...TESTDATEN.hersteller('A'), softwareId: 'X 1.0' });
  assert.equal(ctx.bestandOptionen({ dg: 'B', traeger: '15' }).datentraegernummer, '000003');
  const echt = ctx.bestandOptionen({ dg: 'B', traeger: '15', testdaten: false, erstellt: DI_0745 });
  assert.equal(echt.testdaten, false);
  assert.equal(echt.erstellt, DI_0745);
});
