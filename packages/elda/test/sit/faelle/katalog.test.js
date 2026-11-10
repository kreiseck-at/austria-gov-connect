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
const { verfuegbar, brueckeFehlt } = require('../lib/kasseneck');
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
  V95: 'M8',
  V96: 'M8',
  V100: 'M8',
  V97: 'M4',
  V98: 'S4',
  V99: 'M4',
  K20: 'M3',
  K21: 'M4',
  V101: 'M4',
  K22: 'M3',
  K23: 'M4',
  V93: 'M3',
  V94: 'M3',
  V90: 'M3',
  V91: 'M3',
  V92: 'M3',
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
  V16: 'M4',
  V19: 'M9',
  V20: 'S4',
  V21: 'M3',
  B03: 'M3',
  B11: 'M3',
  B12: 'M3',
  T02: 'M3',
  V40: 'M3',
  V41: 'M3',
  V42: 'M3',
  V43: 'M8',
  V44: 'M4',
  V45: 'M4',
  V46: 'M4',
  V47: 'M4',
  V48: 'M4',
  V49: 'M4',
  V50: 'M4',
  V51: 'M3',
  V52: 'M3',
  V53: 'M3',
  V54: 'M3',
  V55: 'M3',
  V56: 'M6',
  V57: 'M3',
  V58: 'M8',
  V59: 'M3',
  V60: 'M3',
  V34: 'M3',
  V35: 'M4',
  V36: 'S3',
  V33: 'M3',
  V61: 'M3',
  V62: 'M3',
  V63: 'M3',
  V64: 'M3',
  V65: 'M4',
  V66: 'M4',
  V70: 'M3',
  V84: 'M3',
  B13: 'M3',
  V71: 'M4',
  V72: 'M3',
  V73: 'M4',
  V74: 'M3',
  V75: 'M4',
  V76: 'M3',
  V77: 'M4',
  V78: 'M3',
  V79: 'M4',
  V80: 'M3',
  V81: 'M4',
  V82: 'M3',
  V83: 'M4',
  K01: 'M3',
  K02: 'M8',
  K03: 'M4',
  K04: 'M9',
  K11: 'M3',
  K12: 'M4',
  K13: 'M4',
  Q05: 'M3',
  T03: 'M3',
  Q30: 'M3',
  Q31: 'M3',
  Q32: 'M3',
  Q33: 'M3',
  Q34: 'M3',
  Q35: 'M3',
  Q36: 'M3',
  Q37: 'M3',
  Q38: 'M4',
  Q39: 'M3',
  Q60: 'M3',
  Q40: 'M8',
  Q41: 'M4',
  Q42: 'M4',
  Q43: 'M3',
  Q44: 'M8',
  Q45: 'M6',
  Q46: 'M4',
  Q47: 'M4',
  Q48: 'M8',
  Q49: 'M4',
  Q53: 'M4',
};
const VSTR = {
  Q30: '15',
  Q31: '15',
  Q32: '15',
  Q33: '15',
  Q35: '15',
  Q36: '15',
  Q37: '15',
  Q38: '15',
  Q40: '15',
  Q41: '15',
  Q42: '15',
  Q43: '15',
  Q44: '15',
  Q45: '15',
  Q46: '15',
  Q47: '15',
  Q48: '15',
  Q49: '15',
  Q53: '15',
  V95: '15',
  V96: '15',
  V100: '15',
  V92: '15',
  K11: '15',
  K12: '15',
  K13: '15',
  Q05: '15',
  T03: '15',
  V02: '15',
  V09: '15',
  V13: '15',
  B03: '15',
  B11: '15',
  B12: '15',
  V06: '15',
  V40: '15',
  V41: '15',
  V42: '15',
  V43: '15',
  V44: '15',
  V45: '15',
  V46: '15',
  V47: '15',
  V48: '15',
  V49: '15',
  V52: '15',
  V53: '15',
  V54: '15',
  V55: '15',
  V56: '15',
  V57: '15',
  V58: '15',
  V34: '15',
  V33: '15',
  V70: '15',
  V71: '15',
  V72: '15',
  V73: '15',
  V74: '15',
  V75: '15',
  V78: '15',
  V79: '15',
  V80: '15',
  V81: '15',
  V84: '15',
  B13: '15',
};
const REFU_AUS = {
  V95: 'V41',
  V98: 'V50',
  V09: 'V02',
  V11: 'V05',
  V19: 'V15',
  V20: 'V12',
  V43: 'V40',
  V58: 'V57',
};

/**
 * Die KW45-Fälle bauen auf der Zeitreise 2026/27 auf (Mo nm = 01.02.2026) und rechnen die mBGM mit dem
 * Parameterwerk 2026 – sie brauchen einen Zeitpunkt in KW45 (Winterzeit).
 */
const IM_FENSTER_KW45 = {
  'mo-vm': new Date('2026-11-02T06:30:00Z'),
  'mo-nm': new Date('2026-11-02T11:30:00Z'),
  'di-vm': new Date('2026-11-03T06:30:00Z'),
  'di-nm': new Date('2026-11-03T11:30:00Z'),
  'mi-vm': new Date('2026-11-04T06:30:00Z'),
  'mi-nm': new Date('2026-11-04T11:30:00Z'),
};
const istKw45 = (id) => /^(Q[3-5]\d|M8\d|M9[5-7])$/.test(id);
/** Lohnzettel (LF) unter den KW45-Fällen – nicht Bestand VR. */
const L16_KW45 = ['Q50', 'Q51', 'Q52', 'Q54'];
/** Lohnzettel, die kasseneck selbst baut (ohne Geschlecht). */
const L16_KASSENECK_KW45 = ['Q55'];
/** KW46: dieselbe Zeitreise wie KW45. */
const IM_FENSTER_KW46 = {
  'mo-vm': new Date('2026-11-09T06:30:00Z'),
  'mo-nm': new Date('2026-11-09T11:30:00Z'),
  'di-vm': new Date('2026-11-10T06:30:00Z'),
  'di-nm': new Date('2026-11-10T11:30:00Z'),
  'mi-vm': new Date('2026-11-11T06:30:00Z'),
  'mi-nm': new Date('2026-11-11T11:30:00Z'),
};
// V72–V83 mit: M100/M101 rechnen mit kasseneck, das nur das Parameterwerk 2026 kennt – die
// Anmeldungen und Abmeldungen, auf denen sie aufbauen, müssen in derselben (KW46-)Woche liegen.
const istKw46 = (id) => /^(L2\d|L3[01]|Q6\d|M9[89]|M10[01]|V7[2-9]|V8[0-3])$/.test(id);
/** Lohnzettel von kasseneck mit Geschlecht (KW46). */
const L16_KASSENECK_KW46 = ['L20', 'L21', 'L22', 'L23', 'L24', 'L25', 'L26', 'L27', 'L28', 'L31'];
const zeitpunkt = (id, fenster) =>
  (istKw46(id) ? IM_FENSTER_KW46 : istKw45(id) ? IM_FENSTER_KW45 : IM_FENSTER)[fenster];

/**
 * Ohne Checkout baut ein Fall nicht – und auch keiner, der auf ihm aufbaut (Q50 hängt an der
 * kasseneck-Person Q37, ohne selbst kasseneck zu brauchen).
 */
function fehltKette(fall, nachId = new Map(KATALOG.map((f) => [f.id, f]))) {
  return Boolean(brueckeFehlt(fall)) || fall.abhaengig.some((id) => fehltKette(nachId.get(id), nachId));
}

const ersterFenster = (fall) => (fall.fenster === 'jedes' ? 'mo-vm' : fall.fenster[0]);

/**
 * Mit kasseneck-Checkout bekannt nicht baubar, je mit dem erwarteten Grund. Jeder andere
 * Fehler, und jeder dieser Fälle, der wieder baut, macht den Test rot. (M03/M34/M13 standen
 * hier wegen der T01-Rundung per Gleitkomma, DM-D.62; kasseneck main rundet richtig.) (M70/M71 bauen hier, weil sie nicht im KW45-Zeitpunkt
 * gebaut werden; ihnen fehlt erst am simulierten 2027 das Parameterwerk.)
 */
const BEKANNT_NICHT_BAUBAR = {
  // kasseneck baut seit #881 keinen L16 ohne Geschlecht mehr; L12 (KW42) und Q55 (KW45) liefen noch ohne –
  // L20 ist ihr Nachfolger.
  L12: /Geschlecht fehlt/,
  Q55: /Geschlecht fehlt/,
};
const NICHT_GEBAUT = new Map();

const ABLAGE = erstelleAblage(fs.mkdtempSync(path.join(WURZEL, 'sit-faelle-')));
// Eine erfundene, schon abgeholte Rücksendung für T15.
ABLAGE.protokolliere({ art: 'ruecksendung', protokollnummer: '154000001', dateiName: 'alt.xml', zeit: '2026-09-01T00:00:00.000Z' });
ABLAGE.protokolliere({ art: 'ruecksendung', protokollnummer: '155000001', dateiName: 'probe.xml' });

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
    // Die mBGM-Fälle rechnen mit kasseneck; ohne Checkout (CI) bauen sie nicht.
    if (fehltKette(fall)) return;
    const fehlt = fall.abhaengig.find((id) => NICHT_GEBAUT.has(id));
    if (fehlt) {
      NICHT_GEBAUT.set(fall.id, `baut auf ${fehlt}`);
      return;
    }
    const fenster = ersterFenster(fall);
    const jetzt = zeitpunkt(fall.id, fenster);
    const ctx = baueKontext({
      fenster,
      testdaten: TESTDATEN,
      ereignisse: ablage.ereignisse(),
      jetzt,
      elda,
      ablage,
      seriennummer: SERIENNUMMER,
    });
    let ergebnis;
    try {
      ergebnis = fall.baue(ctx);
    } catch (fehler) {
      if (!BEKANNT_NICHT_BAUBAR[fall.id]?.test(fehler.message)) throw fehler;
      NICHT_GEBAUT.set(fall.id, fehler.message);
      return;
    }
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
  for (const f of KATALOG.filter((x) => x.aktion !== 'beobachten' && !fehltKette(x))) {
    assert.ok(GEBAUT.has(f.id) || NICHT_GEBAUT.has(f.id), f.id);
  }
});

test('bekannt nicht baubar: nur mit kasseneck, nur aus dem erwarteten Grund, und keiner baut wieder', () => {
  const nachId = new Map(KATALOG.map((f) => [f.id, f]));
  for (const [id, grund] of Object.entries(BEKANNT_NICHT_BAUBAR)) {
    if (fehltKette(nachId.get(id))) continue;
    assert.ok(!GEBAUT.has(id), `${id} baut wieder – aus BEKANNT_NICHT_BAUBAR streichen`);
    const ist = NICHT_GEBAUT.get(id);
    assert.ok(grund.test(ist), `${id}: ${ist}`);
  }
  for (const [id, grund] of NICHT_GEBAUT) {
    if (BEKANNT_NICHT_BAUBAR[id]) continue;
    assert.match(grund, /^baut auf (\w+)$/, id);
    assert.ok(NICHT_GEBAUT.has(/^baut auf (\w+)$/.exec(grund)[1]), id);
  }
});

test('jeder Sendefall: drei Sätze, VR, TM, simuliertes Erstellungsdatum, Seriennummer, Träger, Satzart', () => {
  for (const [id, { ergebnis, ctx }] of GEBAUT) {
    if (!Buffer.isBuffer(ergebnis.inhalt) || /^[MSL]/.test(id) || [...L16_KW45, ...L16_KASSENECK_KW45].includes(id)) {
      continue;
    }
    const s = saetze(ergebnis.inhalt, id === 'B03' ? '\n' : '\r\n');
    assert.equal(s.length, 3, `${id}: Vorlauf, Meldung, Schluss`);
    const [vorlauf, meldungssatz] = s;
    assert.equal(feld(vorlauf, 21, 2), id === 'B11' ? 'DM' : 'TM', `${id}: PROJ`);
    assert.equal(feld(vorlauf, 23, 2), 'VR', `${id}: BEST`);
    const erwartetesDatum = id === 'B12' ? ttmmjjjj(wienerZeit(ctx.jetzt).datum) : ttmmjjjj(ctx.zr);
    if (id !== 'T02' && id !== 'T03') assert.equal(feld(vorlauf, 31, 8), erwartetesDatum, `${id}: EDAT`);
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
  assert.equal(adat('V01'), ttmmjjjj(zrDatum('mo-vm', IM_FENSTER['mo-vm'])));
  assert.equal(adat('V03'), ttmmjjjj(zrDatum('mo-nm', IM_FENSTER['mo-nm'])));
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

test(
  'mBGM-Fälle: Bestand MB, TM, simuliertes Datum, Seriennummer, ein Paket je Konto',
  { skip: !verfuegbar() && 'braucht KASSENECK_PFAD' },
  () => {
    for (const id of ['M03', 'M13', 'M14', 'M34'].filter((x) => !NICHT_GEBAUT.has(x))) {
      const { ergebnis, ctx } = GEBAUT.get(id);
      const s = saetze(ergebnis.inhalt);
      const [vorlauf] = s;
      assert.equal(feld(vorlauf, 21, 2), 'TM', `${id}: PROJ`);
      assert.equal(feld(vorlauf, 23, 2), 'MB', `${id}: BEST`);
      assert.equal(feld(vorlauf, 31, 8), ttmmjjjj(ctx.zr), `${id}: EDAT`);
      for (const satz of s) assert.equal(feld(satz, 12, 7), '0765432', `${id}: OBUS`);
      assert.ok(s.length > 3, `${id}: Vorlauf, Paket, Schluss`);
    }
  },
);

test('FH- und SM-Fälle: Bestand, Version, Satzlänge, Satzart, Abwandlung nur im Negativtest', () => {
  const { FELDER_E12 } = require('../../../dist/felder-e12.js');
  const { FELDER_E22 } = require('../../../dist/felder-e22.js');
  const wert = (tabelle, satz, name) => {
    const f = tabelle.find((x) => x.name === name);
    return feld(satz, f.pos, f.laenge);
  };
  const erwartet = {
    S31: ['FH', '03', 850, '80'],
    S32: ['FH', '03', 850, '81'],
    S33: ['FH', '03', 850, '80'],
    S35: ['FH', '03', 850, '82'],
    S36: ['FH', '03', 850, '85'],
    S37: ['FH', '03', 850, '84'],
    S38: ['FH', '03', 850, '83'],
    S40: ['SM', '02', 800, '65'],
    S41: ['SM', '02', 800, '66'],
    S42: ['SM', '02', 800, '65'],
    S43: ['SM', '02', 800, '65'],
  };
  for (const [id, [best, vers, laenge, sart]] of Object.entries(erwartet)) {
    const { ergebnis, ctx } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(s.length, 3, id);
    const [vorlauf, satz] = s;
    assert.equal(feld(vorlauf, 21, 2), 'TM', `${id}: PROJ`);
    assert.equal(feld(vorlauf, 23, 2), best, `${id}: BEST`);
    assert.equal(feld(vorlauf, 150, 2), vers, `${id}: VERS`);
    assert.equal(feld(vorlauf, 31, 8), ttmmjjjj(ctx.zr), `${id}: EDAT`);
    for (const x of s) {
      assert.equal(x.length, laenge, `${id}: Satzlänge`);
      assert.equal(feld(x, 12, 7), '0765432', `${id}: OBUS`);
      assert.equal(feld(x, 19, 2), '14', `${id}: VSTR`);
    }
    assert.equal(feld(satz, 1, 2), sart, `${id}: Satzart`);
    assert.equal(feld(satz, 21, 10).trimEnd(), GEBAUT.get('S30').ctx.konto('A', { traeger: '14' }).bknr);
  }
  const s30 = saetze(GEBAUT.get('S30').ergebnis.inhalt);
  assert.equal(feld(s30[0], 23, 2), 'VR', 'S30: BEST');
  assert.equal(feld(s30[1], 1, 2), 'M3', 'S30: Satzart');
  const fh = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[1];
  assert.equal(wert(FELDER_E12, fh('S31'), 'KART'), '04');
  assert.equal(wert(FELDER_E12, fh('S31'), 'STSL'), 'AUT');
  assert.equal(wert(FELDER_E12, fh('S31'), 'WORT').trimEnd(), 'Wien');
  assert.equal(wert(FELDER_E12, fh('S31'), 'ADAT'), ttmmjjjj(zrDatum('di-vm', IM_FENSTER['di-vm'])));
  assert.equal(wert(FELDER_E12, fh('S32'), 'ADAT'), '31032025');
  assert.equal(wert(FELDER_E12, fh('S32'), 'GESL'), '0');
  assert.equal(wert(FELDER_E12, fh('S33'), 'KART'), '09');
  const sm = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[1];
  assert.equal(wert(FELDER_E22, sm('S40'), 'JAHR'), '2025');
  assert.equal(feld(sm('S40'), 502, 10), '4 01012801');
  assert.equal(feld(sm('S42'), 502, 2), '3 ');
  assert.equal(feld(sm('S43'), 502, 2), '01');
  assert.equal(wert(FELDER_E22, sm('S40'), 'REFN').trimEnd(), GEBAUT.get('S40').ergebnis.referenzwerte[0]);
});

test('S-Fälle: Bestand VS bzw. AV (S11 ist eine Anmeldung, VR), TM, Seriennummer, Träger', () => {
  const BEST = { S10: 'VS', S11: 'VR', S12: 'VS', S13: 'VS', S15: 'VS', S16: 'VS', S20: 'AV', S21: 'AV' };
  for (const [id, best] of Object.entries(BEST)) {
    const { ergebnis, ctx } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(s.length, 3, `${id}: Vorlauf, Meldung, Schluss`);
    const [vorlauf, meldungssatz] = s;
    assert.equal(feld(vorlauf, 21, 2), 'TM', `${id}: PROJ`);
    assert.equal(feld(vorlauf, 23, 2), best, `${id}: BEST`);
    assert.equal(feld(vorlauf, 31, 8), ttmmjjjj(ctx.zr), `${id}: EDAT`);
    for (const satz of s) {
      assert.equal(feld(satz, 12, 7), '0765432', `${id}: OBUS`);
      assert.equal(feld(satz, 19, 2), id === 'S21' ? '15' : '14', `${id}: VSTR`);
    }
    assert.equal(feld(meldungssatz, 1, 2), best === 'VR' ? 'M3' : best, `${id}: Satzart`);
  }
});

test('S11 meldet ohne VSNR, mit Geburtsdatum und REFV = Referenzwert von S10', () => {
  const { FELDER_E29 } = require('../../../dist/felder-e29.js');
  const f = (name) => FELDER_E29.find((x) => x.name === name);
  const m3 = saetze(GEBAUT.get('S11').ergebnis.inhalt)[1];
  assert.equal(feld(m3, f('VSNR').pos, f('VSNR').laenge), '0000000000');
  assert.equal(feld(m3, f('GEBD').pos, f('GEBD').laenge), '14031998');
  assert.equal(
    feld(m3, f('REFV').pos, f('REFV').laenge).trimEnd(),
    GEBAUT.get('S10').ergebnis.referenzwerte[0],
  );
});

test('Negativtests S13 und S21 ändern genau ein Feld des gültigen Satzes', () => {
  const { FELDER_E30 } = require('../../../dist/felder-e30.js');
  const { FELDER_E31 } = require('../../../dist/felder-e31.js');
  const gesl = FELDER_E30.find((x) => x.name === 'GESL');
  const wkfz = FELDER_E31.find((x) => x.name === 'WKFZ');
  const s13 = saetze(GEBAUT.get('S13').ergebnis.inhalt);
  assert.equal(s13[1].length, 688);
  assert.equal(feld(s13[1], gesl.pos, gesl.laenge), '5');
  const s21 = saetze(GEBAUT.get('S21').ergebnis.inhalt);
  assert.equal(s21[1].length, 416);
  assert.equal(feld(s21[1], wkfz.pos, wkfz.laenge), 'A  ');
  assert.equal(feld(saetze(GEBAUT.get('S20').ergebnis.inhalt)[1], wkfz.pos, wkfz.laenge), 'D  ');
});

test('ES-Fälle: Bestand ES, Version 08, TM, Satzart und Träger; Negativfälle weichen genau an einer Stelle ab', () => {
  const { FELDER_E27 } = require('../../../dist/felder-e27.js');
  const pos = (name) => FELDER_E27.find((f) => f.name === name);
  const erwartet = {
    S50: ['E1', '14'],
    S51: ['E5', '15'],
    S52: ['E2', '15'],
    S53: ['E1', '14'],
    S54: ['E1', '14'],
    S55: ['E1', '14'],
  };
  for (const [id, [sart, vstr]] of Object.entries(erwartet)) {
    const { ergebnis, ctx } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(s.length, 3, `${id}: Vorlauf, Antrag, Schluss`);
    const [vorlauf, antrag] = s;
    assert.equal(feld(vorlauf, 21, 2), 'TM', `${id}: PROJ`);
    assert.equal(feld(vorlauf, 23, 2), 'ES', `${id}: BEST`);
    assert.equal(feld(vorlauf, 150, 2), '08', `${id}: VERS`);
    assert.equal(feld(vorlauf, 31, 8), ttmmjjjj(ctx.zr), `${id}: EDAT`);
    assert.equal(antrag.length, 9028, `${id}: Satzlänge`);
    assert.equal(feld(antrag, 1, 2), sart, `${id}: Satzart`);
    for (const satz of s) {
      assert.equal(feld(satz, 12, 7), '0765432', `${id}: OBUS`);
      assert.equal(feld(satz, 19, 2), vstr, `${id}: VSTR`);
    }
    const uidm = feld(antrag, pos('UIDM').pos, 40).trimEnd();
    assert.equal(uidm, ergebnis.referenzwerte[0], `${id}: UIDM als Referenzwert protokolliert`);
  }
  const antragVon = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[1];
  // Storno verweist über UIDU auf S50.
  assert.equal(
    feld(antragVon('S53'), pos('UIDU').pos, 40).trimEnd(),
    GEBAUT.get('S50').ergebnis.referenzwerte[0],
  );
  assert.equal(feld(antragVon('S53'), 21, 2), '02');
  // S54: nur AGSTAAT auf AT geändert.
  const agstaat = pos('AGSTAAT');
  assert.equal(feld(antragVon('S54'), agstaat.pos, 2), 'AT');
  assert.equal(feld(antragVon('S50'), agstaat.pos, 2), 'DE');
  // S55: Dienstgeber-Platz 2 ist eine Kopie von Platz 1.
  const p1 = pos('DGNA_1').pos;
  const p2 = pos('DGNA_2').pos;
  const a = antragVon('S55');
  assert.equal(a.slice(p2 - 1, p2 - 1 + 399), a.slice(p1 - 1, p1 - 1 + 399));
  assert.notEqual(a.slice(p2 - 1, p2 - 1 + 399).trim(), '');
});

test('N2: V70 meldet 38 h 30 min als 3850, N1-Abmeldungen tragen ihre Codes, N3/N4-BVEN wie geplant', () => {
  const { FELDER_E29 } = require('../../../dist/felder-e29.js');
  const wert = (id, name) => {
    const f = FELDER_E29.find((x) => x.name === name);
    const [, satz] = saetze(GEBAUT.get(id).ergebnis.inhalt);
    return feld(satz, f.pos, f.laenge).trim();
  };
  assert.equal(wert('V70', 'VWAZ'), '3850');
  assert.equal(wert('V70', 'ADAT'), '01022025');
  assert.equal(wert('V70', 'BVAB'), '01032025');
  for (const [id, code] of [
    ['V71', '02'],
    ['V73', '04'],
    ['V75', '05'],
    ['V77', '06'],
    ['V79', '13'],
  ]) {
    assert.equal(wert(id, 'AGRD'), code, id);
  }
  assert.equal(wert('V71', 'BVEN'), '31032025');
  assert.match(wert('V81', 'BVEN'), /^0*$/, 'Grundstellung');
  assert.equal(wert('V83', 'BVEN'), '20032026'); // V72–V83 bauen in der KW46-Zeitreise
  assert.equal(wert('V81', 'EBSV'), '20032026');
});

test('Di-Zusatzfälle: jede Verfälschung sitzt genau dort, wo der Fall sie behauptet', () => {
  const s = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt);
  // M52: Lehrlinge mit A04, keine A03.
  const m52 = s('M52');
  assert.ok(
    m52.some((z) => z.startsWith('V1') && feld(z, 21, 3) === 'A04'),
    'M52: A04',
  );
  assert.ok(!m52.some((z) => z.startsWith('V1') && feld(z, 21, 3) === 'A03'), 'M52: keine A03');
  // M60 REFP leer, M61 BZRM 122018, M64 JAGB X, M65 BKNR leer.
  assert.equal(feld(s('M60')[1], 21, 40).trim(), '');
  assert.equal(feld(s('M61')[1], 282, 6), '122018');
  assert.equal(feld(s('M64')[1], 171, 1), 'X');
  assert.equal(feld(s('M65')[1], 61, 10).trim(), '');
  // M62: GSUM um genau 1 Cent höher als im unverfälschten Paket (M60 hat dieselben Beträge).
  assert.equal(Number(feld(s('M62')[1], 289, 11)), Number(feld(s('M60')[1], 289, 11)) + 1);
  // M63: kein PE, Satzanzahl im Schlusssatz um 1 kleiner.
  assert.ok(!s('M63').some((z) => z.startsWith('PE')));
  assert.equal(Number(feld(s('M63').at(-1), 21, 6)), Number(feld(s('M60').at(-1), 21, 6)) - 1);
  // M66: zwei G1, die zweite VSNR mit Monat 20.
  const g = s('M66').filter((z) => z.startsWith('G1'));
  assert.equal(g.length, 2);
  assert.equal(feld(g[1], 147, 2), '20');
  // M54: reines Storno R1 mit REFU = erster Referenzwert von M52.
  const m54 = s('M54');
  assert.ok(m54.some((z) => z.startsWith('R1')));
  // V84: Familienname mit den UTF-8-Bytes C5 9F.
  assert.ok(GEBAUT.get('V84').ergebnis.inhalt.includes(Buffer.from([0xc5, 0x9f])));
  // B13: dieselbe Datenträgernummer wie V40.
  assert.equal(feld(s('B13')[0], 25, 6), feld(s('V40')[0], 25, 6));
});

test('L-Fälle: Bestand LF, TM, Version 28, VSTR 94, Informationssatz und ein Lohnzettel', () => {
  for (const id of ['L01', 'L02']) {
    if (!GEBAUT.has(id)) continue;
    const { ergebnis, ctx } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(s.length, 4, `${id}: Vorlauf, I1, L1, Schluss`);
    const [vorlauf, i1, l1] = s;
    assert.equal(feld(vorlauf, 21, 2), 'TM', `${id}: PROJ`);
    assert.equal(feld(vorlauf, 23, 2), 'LF', `${id}: BEST`);
    assert.equal(feld(vorlauf, 31, 8), ttmmjjjj(ctx.zr), `${id}: EDAT`);
    for (const satz of s) assert.equal(feld(satz, 19, 2), '94', `${id}: VSTR`);
    assert.equal(feld(i1, 1, 2), 'I1', `${id}: Satzart I1`);
    assert.equal(feld(l1, 1, 2), 'L1', `${id}: Satzart L1`);
    assert.equal(feld(i1, 51, 9), id === 'L02' ? '911234566' : '911234565', `${id}: STNRA I1`);
    assert.equal(feld(l1, 639, 9), id === 'L02' ? '911234566' : '911234565', `${id}: STNRA L1`);
  }
});

test('M97: kasseneck deckelt die SV-Grundlage bei 6.930 €, die BV-Grundlage bleibt das volle Entgelt', () => {
  if (!GEBAUT.has('M97')) return;
  const s = saetze(GEBAUT.get('M97').ergebnis.inhalt);
  // BS: Satzart, laufende Nummer, Kennung, OBUS, VSTR (20 Stellen), dann Verrechnungsbasis + Betrag in Cent.
  const basen = Object.fromEntries(s.filter((x) => x.startsWith('BS')).map((x) => [feld(x, 21, 2), feld(x, 23, 11)]));
  assert.deepEqual(basen, { AB: '00000693000', BV: '00000900000' });
  const v1 = s.filter((x) => x.startsWith('V1')).map((x) => x.slice(20));
  assert.deepEqual(v1, ['T01+039050+00000270617', 'V01+001530+00000013770']);
});

test('Q50–Q52: L16 2026 über das Paket – LF, VSTR 94, Geschlecht gesetzt, Berichtigung und Storno mit der Referenznummer von Q50', () => {
  const l1 = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[2];
  for (const id of L16_KW45) {
    if (!GEBAUT.has(id)) continue;
    const { ergebnis } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(s.length, 4, `${id}: Vorlauf, I1, L1, Schluss`);
    assert.equal(feld(s[0], 23, 2), 'LF', `${id}: BEST`);
    for (const satz of s) assert.equal(feld(satz, 19, 2), '94', `${id}: VSTR`);
    assert.equal(feld(l1(id), 280, 3).trim().length, 1, `${id}: genau ein Geschlecht (GESW/GESM/GESD)`);
  }
  if (!GEBAUT.has('Q52')) return;
  assert.equal(feld(l1('Q50'), 656, 1), ' ', 'Q50: ohne KORR');
  assert.equal(feld(l1('Q51'), 656, 1), 'K', 'Q51: KORR K');
  assert.equal(feld(l1('Q52'), 656, 1), 'S', 'Q52: KORR S');
  assert.equal(feld(l1('Q51'), 66, 30), feld(l1('Q50'), 66, 30), 'Q51: REFN wie Q50');
  assert.equal(feld(l1('Q52'), 66, 30), feld(l1('Q50'), 66, 30), 'Q52: REFN wie Q50');
});

test('Q55: L16 aus Monatsabrechnungen von kasseneck – Halbjahr, Sonderzahlungen in KZ 220/225, echtes DTUE, ohne Geschlecht', () => {
  if (!GEBAUT.has('Q55')) return;
  const { ergebnis, ctx } = GEBAUT.get('Q55');
  const s = saetze(ergebnis.inhalt);
  assert.equal(s.length, 4, 'Vorlauf, I1, L1, Schluss');
  assert.equal(feld(s[0], 23, 2), 'LF', 'BEST');
  const l1 = s[2];
  assert.equal(feld(l1, 52, 8), wienerZeit(ctx.jetzt).datum.replaceAll('-', ''), 'DTUE = echter Tag');
  assert.equal(feld(l1, 280, 3), '   ', 'kasseneck führt kein Geschlecht (W 2801 erwartet)');
  // Sechs Monate 3.000 € + UZ und WR je 181/365 eines Monatsbezugs (1.487,67 €), in Cent.
  assert.equal(feld(l1, 298, 10), '0002097534', 'KZ 210 Bruttobezüge');
  assert.equal(feld(l1, 320, 10), '0000297534', 'KZ 220 Sonderzahlungen innerhalb des Sechstels');
  assert.equal(feld(l1, 342, 10), '0000050789', 'KZ 225 SV auf Sonderzahlungen');
  assert.equal(feld(l1, 364, 10), '0000325260', 'KZ 230 SV laufend (6 × 542,10 €)');
  assert.ok(ergebnis.hinweise.some((h) => /F2801/.test(h)), 'Hinweis auf F2801');
  assert.match(l1, /SIT-Q55-20260101/, 'REFN aus employeeId und Beginn');
});

test('Q54: L16 nach dem Storno neu – echtes DTUE statt des simulierten, eigene Referenznummer, ohne KORR', () => {
  if (!GEBAUT.has('Q54')) return;
  const { ergebnis, ctx } = GEBAUT.get('Q54');
  const l1 = saetze(ergebnis.inhalt)[2];
  const jjjjmmtt = (iso) => iso.replaceAll('-', '');
  // DTUE: Feld 9 der L1-Zeile, Stelle 52, JJJJMMTT.
  assert.equal(feld(l1, 52, 8), jjjjmmtt(wienerZeit(ctx.jetzt).datum), 'DTUE = echter Tag');
  assert.notEqual(feld(l1, 52, 8), jjjjmmtt(ctx.zr), 'DTUE nicht der simulierte Tag');
  assert.equal(feld(l1, 656, 1), ' ', 'ohne KORR');
  if (GEBAUT.has('Q50')) {
    const q50 = saetze(GEBAUT.get('Q50').ergebnis.inhalt)[2];
    assert.notEqual(feld(l1, 66, 30), feld(q50, 66, 30), 'neue Referenznummer');
    assert.equal(feld(q50, 52, 8), jjjjmmtt(GEBAUT.get('Q50').ctx.zr), 'Q50: DTUE simuliert');
  }
});

test('Z04/Z05: falscher Digest bzw. derselbe Digest groß – nur Mi nm, mit Gefahrhinweis', () => {
  const echt = 'ab01'.repeat(32);
  const body = `<securityParameters><kundenpasswort>${echt}</kundenpasswort></securityParameters>`;
  const z = (id) => KATALOG.find((f) => f.id === id);
  const wert = (id) => /<kundenpasswort>([^<]*)</.exec(z(id).baue().manipulation({ body, headers: {} }).body)[1];
  assert.match(wert('Z04'), /^[0-9a-f]{128}$/);
  assert.notEqual(wert('Z04'), echt);
  assert.equal(wert('Z05'), echt.toUpperCase());
  for (const id of ['Z04', 'Z05']) {
    assert.deepEqual(z(id).fenster, ['mi-nm'], `${id}: nur Mi nm`);
    assert.ok(z(id).gefahr, `${id}: Gefahrhinweis`);
  }
});

test('L10 wiederholt die Referenznummer von L04; L11 trägt zwei Lohnzettel unter einem Informationssatz', () => {
  const refn = (id, nr) => feld(saetze(GEBAUT.get(id).ergebnis.inhalt)[nr], 66, 30);
  assert.equal(refn('L10', 2), refn('L04', 2));
  const s = saetze(GEBAUT.get('L11').ergebnis.inhalt);
  assert.deepEqual(
    s.map((z) => z.slice(0, 2)),
    ['00', 'I1', 'L1', 'L1', '99'],
  );
  assert.notEqual(feld(s[2], 66, 30), feld(s[3], 66, 30));
});

test('ES-Satzarten E3, E4, EA: Satzart und Träger (EA an den Dachverband, VSTR 99)', () => {
  for (const [id, sart, vstr] of [
    ['S70', 'E3', '14'],
    ['S71', 'E4', '15'],
    ['S72', 'EA', '99'],
  ]) {
    const { ergebnis } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(feld(s[0], 23, 2), 'ES', `${id}: BEST`);
    assert.equal(feld(s[1], 1, 2), sart, `${id}: Satzart`);
    for (const satz of s) assert.equal(feld(satz, 19, 2), vstr, `${id}: VSTR`);
  }
});

test('L20–L26: L16 von kasseneck mit Geschlecht – LF, echtes DTUE, GESW/GESM/GESD, Teilzeit, soziale Stellung', () => {
  const l1 = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[2];
  const gebaut = L16_KASSENECK_KW46.filter((id) => GEBAUT.has(id));
  if (gebaut.length === 0) return;
  assert.deepEqual(gebaut, L16_KASSENECK_KW46, 'mit Checkout bauen alle');
  for (const id of gebaut) {
    const { ergebnis, ctx } = GEBAUT.get(id);
    const s = saetze(ergebnis.inhalt);
    assert.equal(s.length, 4, `${id}: Vorlauf, I1, L1, Schluss`);
    assert.equal(feld(s[0], 23, 2), 'LF', `${id}: BEST`);
    assert.equal(feld(s[2], 52, 8), wienerZeit(ctx.jetzt).datum.replaceAll('-', ''), `${id}: DTUE = echter Tag`);
    assert.ok(!ergebnis.hinweise.some((h) => /F2801/.test(h)), `${id}: kein Hinweis auf F2801`);
  }
  // E.14: GESW 280, GESM 281, GESD 282, VOLL 283, TEIL 284, SOZS 132, KORR 656, REFN 66 (30), BELZ/ENLZ 120.
  assert.equal(feld(l1('L20'), 280, 5), 'J  JN', 'L20: weiblich, Vollzeit');
  assert.equal(feld(l1('L21'), 280, 5), ' J NJ', 'L21: männlich, Teilzeit');
  assert.equal(feld(l1('L22'), 280, 3), ' J ', 'L22: männlich');
  assert.equal(feld(l1('L23'), 280, 3), '  J', 'L23: offen geht wie divers in GESD');
  assert.equal(feld(l1('L20'), 132, 1), '3', 'L20: Angestellte');
  assert.equal(feld(l1('L21'), 132, 1), '2', 'L21: Arbeiter');
  assert.equal(feld(l1('L22'), 132, 1), '1', 'L22: Lehrling');
  // L20 ist Q55 mit Geschlecht: dieselben Beträge.
  assert.equal(feld(l1('L20'), 298, 10), '0002097534', 'L20: KZ 210 wie Q55');
  assert.equal(feld(l1('L20'), 66, 30).trim(), 'SIT-L20-20260101', 'L20: REFN');
  assert.equal(feld(l1('L24'), 66, 30), feld(l1('L20'), 66, 30), 'L24: REFN wie L20');
  assert.equal(feld(l1('L24'), 656, 1), 'K', 'L24: Berichtigung');
  assert.equal(feld(l1('L20'), 656, 1), ' ', 'L20: ohne KORR');
  assert.notEqual(feld(l1('L24'), 298, 10), feld(l1('L20'), 298, 10), 'L24: andere Beträge');
  assert.equal(feld(l1('L25'), 66, 30).trim(), 'SIT-L20-20260801', 'L25: eigene REFN je Dienstverhältnis');
  assert.equal(feld(l1('L25'), 120, 8), '01083110', 'L25: 01.08.–31.10.');
});

test('L27–L29: UEL in KZ 220, AVAB mit Kinderzahl, zwei Geschlechter; S15/S16: GESL 4 und 6 aus dem Personenstand', () => {
  const l1 = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[2];
  if (GEBAUT.has('L27')) {
    assert.equal(feld(l1('L27'), 120, 8), '07073009', 'L27: 07.07.–30.09.');
    assert.equal(feld(l1('L27'), 283, 2), 'NJ', 'L27: Teilzeit');
    // UZ und WR je 1.800 € × 86/365 = 424,11 €, dazu 120,00 € UEL-Anteil.
    assert.equal(feld(l1('L27'), 320, 10), '0000096822', 'L27: KZ 220 mit dem Sonderzahlungsanteil der UEL');
  }
  if (GEBAUT.has('L28')) {
    assert.equal(feld(l1('L28'), 285, 1), 'J', 'L28: AVAB');
    assert.equal(feld(l1('L28'), 706, 2), '02', 'L28: zwei Kinder');
    assert.ok(GEBAUT.get('L28').ergebnis.hinweise.some((h) => /F3101/.test(h)), 'L28: Hinweis auf F3101');
  }
  assert.equal(feld(l1('L29'), 280, 3), 'JJ ', 'L29: GESW und GESM');
  assert.equal(feld(l1('L30'), 280, 3), ' J ', 'L30: nur GESM');
  assert.equal(feld(l1('L30'), 285, 11), `J${GEBAUT.get('L30').ctx.rolle('reserve_1').vsnr}`, 'L30: AVAB mit VSNR der Partnerin');
  assert.equal(feld(l1('L30'), 706, 2), '02', 'L30: zwei Kinder');
  const vs = (id) => saetze(GEBAUT.get(id).ergebnis.inhalt)[1];
  assert.equal(feld(vs('S15'), 553, 1), '4', 'S15: offen');
  assert.equal(feld(vs('S16'), 553, 1), '6', 'S16: inter');
});

test('M98/M99: Höchstbeitragsgrundlage – SV bei 6.930 € gedeckelt, BV erst ab März vom vollen Entgelt', () => {
  if (!GEBAUT.has('M98')) return;
  const basen = (id) =>
    Object.fromEntries(
      saetze(GEBAUT.get(id).ergebnis.inhalt)
        .filter((x) => x.startsWith('BS'))
        .map((x) => [feld(x, 21, 2), feld(x, 23, 11)]),
    );
  const v1 = (id) =>
    saetze(GEBAUT.get(id).ergebnis.inhalt)
      .filter((x) => x.startsWith('V1'))
      .map((x) => x.slice(20));
  assert.deepEqual(basen('M98'), { AB: '00000693000' }, 'M98: erster Monat ohne BV');
  assert.deepEqual(v1('M98'), ['T01+039050+00000270617']);
  assert.deepEqual(basen('M99'), { AB: '00000693000', BV: '00000900000' }, 'M99: BV vom vollen Entgelt');
  assert.deepEqual(v1('M99'), ['T01+039050+00000270617', 'V01+001530+00000013770']);
});

test('T16/T17: die jüngste abgeholte Rücksendung, die alt genug ist; L31: KZ 220 nur bis zum Jahressechstel', () => {
  assert.equal(GEBAUT.get('T16').ergebnis.protokollnummer, '154000001');
  assert.equal(GEBAUT.get('T17').ergebnis.protokollnummer, '154000001');
  assert.equal(GEBAUT.get('T15').ergebnis.protokollnummer, '155000001');
  if (GEBAUT.has('L31')) {
    const l1 = saetze(GEBAUT.get('L31').ergebnis.inhalt)[2];
    assert.equal(feld(l1, 298, 10), '0001400000', 'L31: KZ 210 = 2 × 3.000 € + 8.000 € Sonderzahlungen');
    assert.equal(feld(l1, 320, 10), '0000600000', 'L31: KZ 220 = Jahressechstel 6.000 €');
  }
  if (GEBAUT.has('M100')) {
    const g = saetze(GEBAUT.get('M100').ergebnis.inhalt).filter((x) => /^G\d/.test(x));
    assert.equal(g.length, 3, 'M100: drei Versicherte');
    const bs = saetze(GEBAUT.get('M100').ergebnis.inhalt).filter((x) => x.startsWith('BS'));
    assert.ok(bs.every((x) => feld(x, 21, 2) !== 'BV'), 'M100: keine BV im ersten Monat');
  }
});
