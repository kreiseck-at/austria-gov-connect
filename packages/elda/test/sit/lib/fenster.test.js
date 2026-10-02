'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  FENSTER,
  GUELTIG_BIS,
  TESTFREIE_TAGE,
  wienerZeit,
  aktivesFenster,
  zrDatum,
  wienerZeitpunkt,
  simuliertesErstellt,
  ttmmjjjj,
  isoWoche,
  wocheVon,
  plusTage,
} = require('./fenster');

test('wienerZeit liest Winter- und Sommerzeit richtig', () => {
  assert.deepEqual(wienerZeit(new Date('2026-01-15T06:30:00Z')), {
    datum: '2026-01-15',
    zeit: '07:30:00',
    wochentag: 4,
  });
  assert.deepEqual(wienerZeit(new Date('2026-10-05T05:30:00Z')), {
    datum: '2026-10-05',
    zeit: '07:30:00',
    wochentag: 1,
  });
});

test('aktivesFenster: nur Mo–Mi in den Fenstern, nicht an testfreien Tagen, nicht nach GUELTIG_BIS', () => {
  // KW41 2026, Sommerzeit (UTC+2)
  assert.equal(aktivesFenster(new Date('2026-10-05T05:30:00Z')), 'mo-vm'); // Mo 07:30
  assert.equal(aktivesFenster(new Date('2026-10-05T07:30:00Z')), null); // Mo 09:30
  assert.equal(aktivesFenster(new Date('2026-10-05T11:00:00Z')), 'mo-nm'); // Mo 13:00
  assert.equal(aktivesFenster(new Date('2026-10-06T05:00:00Z')), 'di-vm'); // Di 07:00
  assert.equal(aktivesFenster(new Date('2026-10-06T10:00:00Z')), 'di-nm'); // Di 12:00
  assert.equal(aktivesFenster(new Date('2026-10-07T11:59:00Z')), 'mi-nm'); // Mi 13:59
  assert.equal(aktivesFenster(new Date('2026-10-07T12:00:00Z')), null); // Mi 14:00 – Fenster ist zu
  assert.equal(aktivesFenster(new Date('2026-10-08T05:30:00Z')), null); // Do 07:30 – Wartung
  assert.equal(aktivesFenster(new Date('2026-10-05T04:30:00Z')), null); // Mo 06:30 – Wartung
  assert.equal(aktivesFenster(new Date('2026-10-19T05:30:00Z')), null); // testfreier Tag
  assert.equal(aktivesFenster(new Date('2026-11-02T06:30:00Z')), null); // nach GUELTIG_BIS
});

test('die Tabelle ist vollständig und plausibel', () => {
  assert.deepEqual(Object.keys(FENSTER), ['mo-vm', 'mo-nm', 'di-vm', 'di-nm', 'mi-vm', 'mi-nm']);
  assert.equal(GUELTIG_BIS, '2026-11-01');
  assert.ok(TESTFREIE_TAGE.includes('2026-10-21'));
  assert.equal(zrDatum('mi-vm'), '2026-04-01');
  assert.throws(() => zrDatum('do-vm'), /Unbekanntes Fenster/);
});

test('wienerZeitpunkt rechnet MEZ und MESZ', () => {
  assert.equal(wienerZeitpunkt('2025-01-01', '07:30:00').toISOString(), '2025-01-01T06:30:00.000Z');
  assert.equal(wienerZeitpunkt('2025-04-01', '07:30:00').toISOString(), '2025-04-01T05:30:00.000Z');
  // In der Umstellungsnacht gibt es 02:30 nicht.
  assert.throws(() => wienerZeitpunkt('2026-03-29', '02:30:00'), /gibt es in Wien nicht/);
});

test('simuliertesErstellt: Datum des Fensters, Uhrzeit von jetzt', () => {
  const jetzt = new Date('2026-10-07T05:45:12Z'); // Mi 07:45:12 Wien
  const erstellt = simuliertesErstellt('mi-vm', jetzt);
  assert.deepEqual(wienerZeit(erstellt), { datum: '2026-04-01', zeit: '07:45:12', wochentag: 3 });
  const winter = simuliertesErstellt('mo-vm', new Date('2026-10-05T05:15:00Z')); // Mo 07:15 Wien
  assert.equal(winter.toISOString(), '2025-01-01T06:15:00.000Z');
});

test('ttmmjjjj', () => {
  assert.equal(ttmmjjjj('2025-03-01'), '01032025');
  assert.throws(() => ttmmjjjj('1.3.2025'), /ISO-Datum/);
});

test('isoWoche und wocheVon', () => {
  assert.equal(isoWoche('2026-10-05'), '2026-W41');
  assert.equal(isoWoche('2026-10-11'), '2026-W41'); // Sonntag gehört zur selben Woche
  assert.equal(isoWoche('2026-10-12'), '2026-W42');
  assert.equal(isoWoche('2026-01-01'), '2026-W01');
  assert.equal(isoWoche('2027-01-01'), '2026-W53');
  // Sonntag 23:30 UTC ist in Wien schon Montag
  assert.equal(wocheVon(new Date('2026-10-11T22:30:00Z')), '2026-W42');
});

test('plusTage', () => {
  assert.equal(plusTage('2025-03-01', -1), '2025-02-28');
  assert.equal(plusTage('2024-03-01', -1), '2024-02-29');
  assert.equal(plusTage('2025-03-01', 6), '2025-03-07');
  assert.equal(plusTage('2025-12-31', 1), '2026-01-01');
});
