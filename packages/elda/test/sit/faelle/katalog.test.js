'use strict';

// Jeder Fall des Katalogs wird mit den erfundenen Testdaten tatsächlich gebaut –
// so fällt eine Fehldeutung, die die Builder des Pakets ablehnen, vor dem
// Testfenster auf und nicht erst am Montag um sieben.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const elda = require('../../../dist/index.js');
const { baueEldaEnvelope } = require('../../../dist/envelope.js');
const { ladeKatalog } = require('../lib/katalog');
const { ladeTestdaten } = require('../lib/testdaten');
const { erstelleAblage } = require('../lib/ablage');
const { baueKontext } = require('../lib/kontext');
const { elementWert } = require('../lib/manipulation');
const { maskiereObus } = require('../lib/maskierung');
const { ttmmjjjj, zrDatum, wienerZeit } = require('../lib/fenster');

// Alle Temp-Ordner dieser Datei liegen unter einer Wurzel, die am Ende gelöscht wird.
const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-test-'));
after(() => fs.rmSync(WURZEL, { recursive: true, force: true }));

const KATALOG = ladeKatalog(__dirname);
const TESTDATEN = ladeTestdaten(path.join(__dirname, '..', 'testdaten.beispiel.json'));
// Sechsstellig wie die echte – OBUS füllt sie auf sieben Stellen auf.
const SERIENNUMMER = '765432';

/** Ein Zeitpunkt mitten im jeweiligen Fenster, KW41 2026 (Sommerzeit). */
const IM_FENSTER = {
  'mo-vm': new Date('2026-10-05T05:30:00Z'),
  'mo-nm': new Date('2026-10-05T10:30:00Z'),
  'di-vm': new Date('2026-10-06T05:30:00Z'),
  'di-nm': new Date('2026-10-06T10:30:00Z'),
  'mi-vm': new Date('2026-10-07T05:30:00Z'),
  'mi-nm': new Date('2026-10-07T10:30:00Z'),
};

const SART = {
  V01: 'M3',
  V02: 'M3',
  V03: 'M3',
  V04: 'M3',
  V05: 'M3',
  V06: 'M3',
  V07: 'M6',
  V09: 'M8',
  V11: 'S3',
  V12: 'M4',
  V13: 'M4',
  V15: 'M4',
  V19: 'M9',
  V20: 'S4',
  B03: 'M3',
  B11: 'M3',
  B12: 'M3',
  T02: 'M3',
};
const VSTR = { V02: '15', V09: '15', V13: '15', B03: '15', B11: '15', B12: '15', V06: '15' };
const REFU_AUS = { V09: 'V02', V11: 'V05', V19: 'V15', V20: 'V12' };

const ersterFenster = (fall) => (fall.fenster === 'jedes' ? 'mo-vm' : fall.fenster[0]);

const ABLAGE = erstelleAblage(fs.mkdtempSync(path.join(WURZEL, 'sit-faelle-')));

/**
 * Baut alle Fälle in Abhängigkeitsreihenfolge und tut so, als sei jeder
 * Sendefall angenommen worden. Gespeichert wird wie in `sit.js lauf`: der
 * Bestand mit maskiertem OBUS.
 */
function baueAlle(ablage) {
  const gebaut = new Map();
  let protokollnummer = 18_000_000;
  const besucht = new Set();
  const nachId = new Map(KATALOG.map((f) => [f.id, f]));

  function bau(fall) {
    if (besucht.has(fall.id)) return;
    besucht.add(fall.id);
    for (const id of fall.abhaengig) bau(nachId.get(id));
    if (fall.aktion === 'beobachten') return;
    const fenster = ersterFenster(fall);
    const jetzt = IM_FENSTER[fenster];
    const ctx = baueKontext({
      fenster,
      testdaten: TESTDATEN,
      ereignisse: ablage.ereignisse(),
      jetzt,
      elda,
      ablage,
      seriennummer: SERIENNUMMER,
    });
    const ergebnis = fall.baue(ctx);
    gebaut.set(fall.id, { ergebnis, ctx });
    if (fall.aktion === 'senden') {
      const lauf = ablage.neuerLauf(fall.id);
      ablage.schreibe(lauf.ordner, 'bestand.dat', maskiereObus(ergebnis.inhalt, SERIENNUMMER));
      protokollnummer += 1;
      ablage.protokolliere({
        art: 'lauf',
        fall: fall.id,
        zeit: jetzt.toISOString(),
        aktion: 'senden',
        statusCode: '000',
        zr: ctx.zr,
        ordner: lauf.id,
        dateiName: ergebnis.dateiName,
        referenzwerte: ergebnis.referenzwerte,
        protokollnummer: String(protokollnummer),
      });
    }
  }
  for (const f of KATALOG) bau(f);
  return gebaut;
}

const GEBAUT = baueAlle(ABLAGE);

const saetze = (inhalt, trenner = '\r\n') => inhalt.toString('latin1').split(trenner);
const feld = (satz, pos, laenge) => satz.slice(pos - 1, pos - 1 + laenge);

test('der Katalog lädt und jeder Fall mit baue ist gebaut worden', () => {
  assert.ok(KATALOG.length >= 25);
  for (const f of KATALOG.filter((x) => x.aktion !== 'beobachten')) assert.ok(GEBAUT.has(f.id), f.id);
});

test('jeder Sendefall: drei Sätze, VR, TM, simuliertes Erstellungsdatum, Seriennummer, Träger, Satzart', () => {
  for (const [id, { ergebnis, ctx }] of GEBAUT) {
    if (!Buffer.isBuffer(ergebnis.inhalt)) continue;
    const s = saetze(ergebnis.inhalt, id === 'B03' ? '\n' : '\r\n');
    assert.equal(s.length, 3, `${id}: Vorlauf, Meldung, Schluss`);
    const [vorlauf, meldungssatz] = s;
    assert.equal(feld(vorlauf, 21, 2), id === 'B11' ? 'DM' : 'TM', `${id}: PROJ`);
    assert.equal(feld(vorlauf, 23, 2), 'VR', `${id}: BEST`);
    const erwartetesDatum = id === 'B12' ? ttmmjjjj(wienerZeit(ctx.jetzt).datum) : ttmmjjjj(ctx.zr);
    if (id !== 'T02') assert.equal(feld(vorlauf, 31, 8), erwartetesDatum, `${id}: EDAT`);
    for (const satz of s) {
      assert.equal(feld(satz, 12, 7), '0765432', `${id}: OBUS`);
      assert.equal(feld(satz, 19, 2), VSTR[id] ?? '14', `${id}: VSTR`);
    }
    assert.equal(feld(meldungssatz, 1, 2), SART[id], `${id}: Satzart`);
  }
});

test('B03 trennt mit LF, alle anderen mit CRLF', () => {
  assert.ok(!GEBAUT.get('B03').ergebnis.inhalt.includes('\r\n'));
  assert.ok(GEBAUT.get('V01').ergebnis.inhalt.includes('\r\n'));
});

test('T02 ist byte-gleich mit V01, samt Dateiname – obwohl V01 maskiert in der Ablage liegt', () => {
  const v01 = GEBAUT.get('V01').ergebnis;
  const t02 = GEBAUT.get('T02').ergebnis;
  assert.ok(t02.inhalt.equals(v01.inhalt));
  assert.equal(t02.dateiName, v01.dateiName);
  assert.deepEqual(t02.referenzwerte, []);
});

test('in der Ablage steht die Seriennummer nirgends', () => {
  const dateien = fs.readdirSync(ABLAGE.basis, { recursive: true }).map((d) => path.join(ABLAGE.basis, d));
  const bestaende = dateien.filter((d) => d.endsWith('bestand.dat'));
  assert.ok(bestaende.length >= 10, `nur ${bestaende.length} Bestände gespeichert`);
  for (const datei of dateien.filter((d) => fs.statSync(d).isFile())) {
    assert.ok(!fs.readFileSync(datei, 'latin1').includes(SERIENNUMMER), path.relative(ABLAGE.basis, datei));
  }
});

test('Richtigstellungen und Stornos verweisen über REFU auf die Ursprungsmeldung', () => {
  for (const [id, quelle] of Object.entries(REFU_AUS)) {
    const meldungssatz = saetze(GEBAUT.get(id).ergebnis.inhalt)[1];
    const refu = feld(meldungssatz, 61, 40).trimEnd();
    assert.equal(refu, GEBAUT.get(quelle).ergebnis.referenzwerte[0], `${id} → ${quelle}`);
  }
});

test('Daten kommen aus der Fenstertabelle', () => {
  // Position und Länge aus der Feldtabelle des Pakets, nicht von Hand abgeschrieben.
  const { FELDER_E29 } = require('../../../dist/felder-e29.js');
  const { pos, laenge } = FELDER_E29.find((f) => f.name === 'ADAT');
  const adat = (id) => feld(saetze(GEBAUT.get(id).ergebnis.inhalt)[1], pos, laenge);
  assert.equal(adat('V01'), ttmmjjjj(zrDatum('mo-vm')));
  assert.equal(adat('V03'), ttmmjjjj(zrDatum('mo-nm')));
  assert.equal(adat('V12'), '01042025'); // Ende am simulierten Tag von di-nm
  assert.equal(adat('V13'), '07032025'); // UEL bis sechs Tage nach di-vm
  assert.equal(adat('V15'), '28022025'); // Vortag von di-vm
  assert.equal(adat('V19'), '28022025'); // aus dem Lauf von V15
  assert.equal(adat('V20'), '01042025'); // aus dem Lauf von V12
});

const SECURITY = {
  apiKey: 'K',
  created: new Date().toISOString(),
  kundenpasswort: 'a'.repeat(128),
  nonce: 'erste-nonce',
  seriennummer: '1234567',
};
const anfrage = (nonce = 'erste-nonce') => ({
  body: baueEldaEnvelope('ruecksendungenAuflisten', { ...SECURITY, nonce }, []),
  headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
});

test('Z-Fälle verändern genau das gemeinte Element', () => {
  const m = (id) => GEBAUT.get(id).ergebnis.manipulation;
  assert.equal(GEBAUT.get('Z01').ergebnis.manipulation, undefined);
  assert.equal(elementWert(m('Z07')(anfrage()).body, 'nonce'), '');
  assert.equal(elementWert(m('Z09')(anfrage()).body, 'created'), '');
  const alt = Date.now() - Date.parse(elementWert(m('Z10')(anfrage()).body, 'created'));
  assert.ok(alt >= 119_000 && alt < 125_000, `created ist ${alt} ms alt`);
  assert.equal(m('Z13')(anfrage()).headers['Content-Type'], 'application/xml; charset=utf-8');

  const z08 = KATALOG.find((f) => f.id === 'Z08');
  assert.equal(z08.aufrufe, 2);
  const neu = z08.baue().manipulation;
  assert.equal(elementWert(neu(anfrage('erste-nonce')).body, 'nonce'), 'erste-nonce');
  assert.equal(elementWert(neu(anfrage('zweite-nonce')).body, 'nonce'), 'erste-nonce');
});

test('T14 fragt eine Protokollnummer ab, die es nicht gibt', () => {
  assert.deepEqual(GEBAUT.get('T14').ergebnis, { protokollnummer: '1' });
});
