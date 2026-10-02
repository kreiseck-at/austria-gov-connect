'use strict';

// Die Kommandos ohne Netz, als echter Prozess gegen eine Temp-Ablage und die
// erfundenen Testdaten. Netz-Kommandos brechen hier vor jedem Aufruf ab – ohne
// Zugangsdaten bzw. außerhalb eines Fensters.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Alle Temp-Ordner dieser Datei liegen unter einer Wurzel, die am Ende gelöscht wird.
const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-test-'));
after(() => fs.rmSync(WURZEL, { recursive: true, force: true }));

const SIT = path.join(__dirname, '..', 'sit.js');
const ABLAGE = fs.mkdtempSync(path.join(WURZEL, 'sit-cli-'));

// Jeder Netzversuch in einem Test ist ein Fehler: fetch wirft, bevor etwas rausgeht.
const OHNE_NETZ = path.join(ABLAGE, 'ohne-netz.js');
fs.writeFileSync(OHNE_NETZ, "globalThis.fetch = () => { throw new Error('NETZ IM TEST'); };\n");

function sit(...args) {
  const env = {
    PATH: process.env.PATH,
    SIT_ABLAGE: ABLAGE,
    SIT_TESTDATEN: path.join(__dirname, '..', 'testdaten.beispiel.json'),
    SIT_JETZT: '2026-10-05T05:30:00Z', // Mo 07:30 Wien – gilt nur für Kommandos ohne Netz
  };
  const r = spawnSync(process.execPath, ['--require', OHNE_NETZ, SIT, ...args], { env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('katalog listet alle Fälle als Markdown', () => {
  const r = sit('katalog');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^\| ID \| Titel/);
  assert.match(r.out, /\| V01 \| Anmeldung Arbeiter Vollzeit/);
});

test('plan für Montag vormittags', () => {
  const r = sit('plan', '--fenster', 'mo-vm');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Plan für mo-vm \(simuliert 2025-01-01\)/);
  const ids = r.out
    .split('\n')
    .slice(1)
    .map((z) => z.trim().split(/\s+/)[0])
    .filter(Boolean);
  assert.equal(ids[0], 'Z01', 'Zugang zuerst');
  assert.equal(ids[1], 'V01', 'dann der Referenzfall');
  assert.ok(ids.indexOf('T02') > ids.indexOf('V01'), 'T02 nach V01');
  assert.ok(ids.indexOf('Z07') > ids.indexOf('B03'), 'Negativtests nach den Formproben');
  assert.doesNotMatch(r.out, /blockiert/);
});

test('zeigen baut den Fall und sendet nichts', () => {
  const r = sit('zeigen', 'V01', '--fenster', 'mo-vm');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Trockenlauf in mo-vm/);
  assert.match(r.out, /PROJ=TM {2}BEST=VR/);
  assert.match(r.out, /EDAT=01012025/);
  assert.match(r.out, /SOID=Kreiseck @kreiseck\/elda SIT-Werkzeug/);
  assert.match(r.out, /BBER=01/);
  // OBUS ist die Seriennummer – sie darf nicht in der Ausgabe stehen.
  assert.match(r.out, /OBUS \*{7}/);
  assert.ok(!r.out.includes('9876543'), 'Seriennummer in der Ausgabe');
});

test('zeigen verweigert ein Fenster, in dem der Fall nicht läuft', () => {
  const r = sit('zeigen', 'V01', '--fenster', 'di-vm');
  assert.equal(r.code, 1);
  assert.match(r.err, /läuft nicht in di-vm/);
});

test('zeigen: fehlender Vorlauf gibt einen Hinweis; braucht der Fall dessen Referenzwert, bricht er ab', () => {
  const v07 = sit('zeigen', 'V07', '--fenster', 'di-vm');
  assert.equal(v07.code, 0, v07.err);
  assert.match(v07.out, /Hinweis: braucht V01 in dieser Woche/);
  const v09 = sit('zeigen', 'V09', '--fenster', 'di-vm');
  assert.equal(v09.code, 1);
  assert.match(v09.err, /V02 ist in dieser Woche noch nicht erfolgreich gelaufen/);
});

test('urteil und protokoll', () => {
  assert.equal(sit('urteil', 'Z02', 'bestanden').code, 1); // Z02 gibt es (noch) nicht als Code
  const u = sit('urteil', 'Z01', 'bestanden', '--notiz', 'Zugang ok', '--befund', 'B004');
  assert.equal(u.code, 0, u.err);
  const p = sit('protokoll');
  assert.match(p.out, /Z01 +bestanden .*Zugang ok \(B004\)/);
  assert.equal(sit('urteil', 'Z01', 'super').code, 1);
});

test('lauf bricht ohne Zugangsdaten bzw. außerhalb eines Fensters vor jedem Netzaufruf ab', () => {
  // Z01 läuft in jedem Fenster – die Meldung hängt also nur daran, ob gerade eines offen ist.
  const r = sit('lauf', 'Z01');
  assert.equal(r.code, 1);
  assert.match(r.err, /^Abbruch: (Kein SIT-Testfenster aktiv|Es fehlt: ELDA_SIT_KUNDENPASSWORT)/);
  assert.doesNotMatch(r.err, /NETZ IM TEST/);
});

test('lauf lehnt doppelte Fälle im selben Aufruf ab', () => {
  const r = sit('lauf', 'Z01', 'Z01');
  assert.equal(r.code, 1);
  assert.match(r.err, /Z01 steht zweimal/);
});

test('Netzbefehle verlangen ausdrücklich gesetzte Ablage und Testdaten', () => {
  const env = { PATH: process.env.PATH };
  const r = spawnSync(process.execPath, ['--require', OHNE_NETZ, SIT, 'abholen'], { env, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Es fehlt: SIT_ABLAGE, SIT_TESTDATEN/);
});

test('unbekannter Befehl und unbekannte Option', () => {
  assert.match(sit('loeschen').err, /Befehl fehlt oder unbekannt/);
  assert.match(sit('plan', '--alles').err, /Unbekannte Option --alles/);
});

test('generalprobe baut die ganze Woche ohne Netz und ohne die echte Ablage', () => {
  const proben = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('sit-generalprobe-')).length;
  const probenVorher = proben();
  const vorher = fs.readdirSync(ABLAGE).sort();
  const r = sit('generalprobe');
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /ok +V20 di-nm senden S4/);
  assert.match(r.out, /Alle Fälle bauen\./);
  assert.deepEqual(fs.readdirSync(ABLAGE).sort(), vorher);
  assert.equal(proben(), probenVorher, 'die Wegwerf-Ablage ist gelöscht');
});
