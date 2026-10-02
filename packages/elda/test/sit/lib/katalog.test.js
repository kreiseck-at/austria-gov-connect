'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validiereFall, ladeKatalog, planFuer, alsMarkdown } = require('./katalog');
const { statusJeFall, gelaufenInWoche, enthaeltNummer } = require('./status');

// Alle Temp-Ordner dieser Datei liegen unter einer Wurzel, die am Ende gelöscht wird.
const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-test-'));
after(() => fs.rmSync(WURZEL, { recursive: true, force: true }));

const fall = (id, mehr = {}) => ({
  id,
  titel: `Titel ${id}`,
  zweck: 'Zweck',
  quelle: 'E.29',
  erwartung: '000',
  fenster: 'jedes',
  gefahr: null,
  abhaengig: [],
  aktion: 'senden',
  baue: () => ({}),
  ...mehr,
});

function katalogAus(...listen) {
  const dir = fs.mkdtempSync(path.join(WURZEL, 'sit-katalog-'));
  listen.forEach((liste, i) => {
    const quelle = `module.exports = ${JSON.stringify(liste, null, 1).replace(/"baue": true/g, '"baue": () => ({})')};`;
    fs.writeFileSync(path.join(dir, `${i}-faelle.js`), quelle);
  });
  return dir;
}

test('validiereFall lehnt Unvollständiges und Unbekanntes ab', () => {
  validiereFall(fall('V01'));
  validiereFall(fall('T01', { aktion: 'beobachten', aus: ['V01'], baue: undefined }));
  const falsch = [
    [fall('v01'), /id/],
    [fall('Q01'), /Gruppe/],
    [fall('V01', { zweck: '' }), /zweck/],
    [fall('V01', { aktion: 'loeschen' }), /Aktion/],
    [fall('V01', { gefahr: 'boom' }), /Gefahr/],
    [fall('V01', { fenster: ['do-vm'] }), /fenster/],
    [fall('V01', { baue: undefined }), /baue/],
    [fall('T01', { aktion: 'beobachten', aus: [], baue: undefined }), /aus/],
    [fall('Z08', { aufrufe: 9 }), /aufrufe/],
  ];
  for (const [f, muster] of falsch) assert.throws(() => validiereFall(f), muster, f.id);
});

test('ladeKatalog: eindeutige IDs, vorhandene Abhängigkeiten, Testdateien werden übersprungen', () => {
  const ok = katalogAus([
    { ...fall('V01'), baue: true },
    { ...fall('V07', { abhaengig: ['V01'] }), baue: true },
  ]);
  fs.writeFileSync(path.join(ok, 'x.test.js'), 'throw new Error("nicht laden")');
  assert.deepEqual(
    ladeKatalog(ok).map((f) => f.id),
    ['V01', 'V07'],
  );

  const doppelt = katalogAus([{ ...fall('V01'), baue: true }], [{ ...fall('V01'), baue: true }]);
  assert.throws(() => ladeKatalog(doppelt), /doppelt/);

  const fehlt = katalogAus([{ ...fall('V07', { abhaengig: ['V01'] }), baue: true }]);
  assert.throws(() => ladeKatalog(fehlt), /V01 gibt es nicht/);
});

const KATALOG = [
  fall('V01', { fenster: ['mo-vm'] }),
  fall('V02', { fenster: ['mo-vm'] }),
  fall('V07', { fenster: ['di-vm'], abhaengig: ['V01'] }),
  fall('Z04', { fenster: 'jedes', gefahr: 'sperre', aktion: 'auflisten' }),
  fall('Z01', { fenster: 'jedes', aktion: 'auflisten' }),
  fall('T01', { aktion: 'beobachten', aus: ['V01'], baue: undefined }),
];

test('planFuer: Abhängigkeiten zuerst, Sperrgefahr zuletzt, Beobachtungen nie', () => {
  const status = statusJeFall(KATALOG, []);
  const plan = planFuer(KATALOG, 'mo-vm', status, new Set());
  assert.deepEqual(
    plan.reihenfolge.map((p) => p.fall.id),
    ['V01', 'V02', 'Z01', 'Z04'],
  );
  assert.deepEqual(
    plan.blockiert.map((b) => b.fall.id),
    [],
  );
});

test('planFuer: ein Fall, dessen Vorlauf diese Woche fehlt und hier nicht laufen darf, ist blockiert', () => {
  const status = statusJeFall(KATALOG, []);
  const plan = planFuer(KATALOG, 'di-vm', status, new Set());
  assert.deepEqual(
    plan.reihenfolge.map((p) => p.fall.id),
    ['Z01', 'Z04'],
  );
  assert.equal(plan.blockiert[0].fall.id, 'V07');
  assert.match(plan.blockiert[0].grund, /V01.*mo-vm/);
});

test('planFuer: nach dem Wochen-Neustart läuft ein erledigter Vorlauf erneut mit', () => {
  const ereignisse = [
    { art: 'lauf', fall: 'V01', statusCode: '000', protokollnummer: '111' },
    { art: 'urteil', fall: 'V01', status: 'bestanden' },
  ];
  const status = statusJeFall(KATALOG, ereignisse);
  const kat = KATALOG.map((f) => (f.id === 'V07' ? { ...f, fenster: ['mo-vm'] } : f));
  const plan = planFuer(kat, 'mo-vm', statusJeFall(kat, ereignisse), new Set());
  assert.deepEqual(
    plan.reihenfolge.map((p) => [p.fall.id, p.grund]),
    [
      ['V01', 'vorlauf'],
      ['V02', 'offen'],
      ['V07', 'offen'],
      ['Z01', 'offen'],
      ['Z04', 'offen'],
    ],
  );
  assert.equal(status.get('V01').status, 'bestanden');
});

test('statusJeFall: offen → gelaufen → rueckmeldung → Urteil', () => {
  const kat = [fall('V01')];
  assert.equal(statusJeFall(kat, []).get('V01').status, 'offen');
  const e1 = [{ art: 'lauf', fall: 'V01', statusCode: '000', protokollnummer: '1557643' }];
  assert.equal(statusJeFall(kat, e1).get('V01').status, 'gelaufen');
  // ziffernscharf: 15576431 gehört NICHT zu 1557643
  const fremd = [...e1, { art: 'ruecksendung', dateiName: 'mitteilung_15576431.xml', protokollnummer: '9' }];
  assert.equal(statusJeFall(kat, fremd).get('V01').status, 'gelaufen');
  const e2 = [...e1, { art: 'ruecksendung', dateiName: 'mitteilung_1557643.xml', protokollnummer: '9' }];
  assert.equal(statusJeFall(kat, e2).get('V01').status, 'rueckmeldung');
  const e3 = [...e2, { art: 'urteil', fall: 'V01', status: 'abweichung', notiz: 'F7021' }];
  const s = statusJeFall(kat, e3).get('V01');
  assert.equal(s.status, 'abweichung');
  assert.equal(s.ruecksendungen.length, 1);
});

test('gelaufenInWoche: nur erfolgreiche Läufe der Woche zählen', () => {
  const e = [
    { art: 'lauf', fall: 'V01', zeit: '2026-10-05T05:30:00Z', statusCode: '000', aktion: 'senden' },
    { art: 'lauf', fall: 'V02', zeit: '2026-10-05T05:31:00Z', statusCode: '403', aktion: 'senden' },
    { art: 'lauf', fall: 'V03', zeit: '2026-09-28T05:30:00Z', statusCode: '000', aktion: 'senden' },
  ];
  assert.deepEqual([...gelaufenInWoche(e, '2026-W41')], ['V01']);
});

test('enthaeltNummer ist ziffernscharf', () => {
  assert.ok(enthaeltNummer('mbd_18000001_1234567', '18000001'));
  assert.ok(!enthaeltNummer('mitteilung_180000011.xml', '18000001'));
});

test('alsMarkdown nennt jeden Fall genau einmal', () => {
  const md = alsMarkdown(KATALOG, statusJeFall(KATALOG, []));
  for (const f of KATALOG) assert.equal(md.split(`| ${f.id} |`).length - 1, 1, f.id);
});

test('statusJeFall: ein Netzfehler ohne Antwort zählt nicht als gelaufen, ein Fault schon', () => {
  const kat = [fall('V02'), fall('Z13', { aktion: 'auflisten' })];
  const e = [
    { art: 'lauf', fall: 'V02', fehler: 'FonTransportError: Zeitüberschreitung' },
    { art: 'lauf', fall: 'Z13', fehler: 'FonSoapFaultError: …', http: { status: 500 } },
  ];
  const s = statusJeFall(kat, e);
  assert.equal(s.get('V02').status, 'offen');
  assert.equal(s.get('V02').versuche, 1);
  assert.equal(s.get('Z13').status, 'gelaufen');
});
