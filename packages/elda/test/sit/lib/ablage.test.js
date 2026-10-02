'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { erstelleAblage, sichererName } = require('./ablage');

// Alle Temp-Ordner dieser Datei liegen unter einer Wurzel, die am Ende gelöscht wird.
const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-test-'));
after(() => fs.rmSync(WURZEL, { recursive: true, force: true }));

function tempAblage() {
  return erstelleAblage(fs.mkdtempSync(path.join(WURZEL, 'sit-ablage-')));
}

const modus = (p) => fs.statSync(p).mode & 0o777;

test('neuerLauf legt eindeutige Ordner mit 0700 an', () => {
  const ablage = tempAblage();
  const a = ablage.neuerLauf('V01');
  const b = ablage.neuerLauf('V01');
  assert.notEqual(a.ordner, b.ordner);
  assert.match(a.id, /_V01/);
  assert.equal(modus(a.ordner), 0o700);
});

test('schreibe legt Dateien mit 0600 an und überschreibt nie', () => {
  const ablage = tempAblage();
  const lauf = ablage.neuerLauf('T02');
  const ziel = ablage.schreibe(lauf.ordner, 'bestand.dat', Buffer.from('abc'));
  assert.equal(fs.readFileSync(ziel, 'latin1'), 'abc');
  assert.equal(modus(ziel), 0o600);
  assert.throws(() => ablage.schreibe(lauf.ordner, 'bestand.dat', Buffer.from('x')), /EEXIST/);
});

test('Laufprotokoll: anhängen und in Reihenfolge lesen', () => {
  const ablage = tempAblage();
  assert.deepEqual(ablage.ereignisse(), []);
  ablage.protokolliere({ art: 'lauf', fall: 'V01' });
  ablage.protokolliere({ art: 'urteil', fall: 'V01', status: 'bestanden' });
  const e = ablage.ereignisse();
  assert.deepEqual(
    e.map((x) => [x.art, x.fall]),
    [
      ['lauf', 'V01'],
      ['urteil', 'V01'],
    ],
  );
  assert.ok(e[0].zeit);
});

test('kaputte Zeile im Laufprotokoll wird gemeldet, nicht verschluckt', () => {
  const ablage = tempAblage();
  ablage.protokolliere({ art: 'lauf', fall: 'V01' });
  fs.appendFileSync(path.join(ablage.basis, 'laufprotokoll.jsonl'), '{kaputt\n');
  assert.throws(() => ablage.ereignisse(), /Zeile 2/);
});

test('sichererName entfernt Pfadtrenner und kürzt', () => {
  assert.equal(sichererName('../a/b c:ä.xml'), '.._a_b_c__.xml');
  assert.equal(sichererName('x'.repeat(200)).length, 120);
  assert.throws(() => sichererName(''), /leer/);
});
