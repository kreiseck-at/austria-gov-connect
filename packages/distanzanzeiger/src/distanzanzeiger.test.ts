import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDistanzanzeiger, ganzeKilometer, type DistanzOrt } from './distanzanzeiger';
import { DistanzanzeigerError, DistanzanzeigerProtokollError } from './errors';

// Die Beispiele stammen aus der „Schnittstellendokumentation Distanzanzeiger",
// Version 1.32.710, Stand April 2026. Kein Test spricht mit dem Server; der Key
// ist ein Platzhalter.
const KEY = 'platzhalter-key';
const ENDPUNKT = 'https://distanzanzeiger.invalid/api/v1/index.php';

// Request-Beispiel, Seite 3.
const ORTE: DistanzOrt[] = [
  { ort: 'st. pölten', str: 'Keimstraße', hnr: '1' },
  { ort: 'melk, kh' },
  { ort: 'kh stockerau' },
  { plz: 3100, ort: 'st. pölten', str: 'mariazeller str', hnr: '79' },
];

const station = (
  okz: string,
  plz: string,
  ort: string,
  str: string,
  hnr: string,
  id: string,
  distance: number,
) => ({
  okz,
  plz,
  ort,
  str,
  hnr,
  coord: { projection: 'LAMBERT', x: '0', y: '0' },
  id,
  distance,
  distance_ausland: 0,
});

// „JSON RESPONSE", Seiten 5–6.
const ANTWORT_DISTANZ = {
  success: true,
  notes: 'Wartungshinweis',
  version: '1.32.710',
  data: {
    distance: {
      ort: [
        station('3158', '3100', 'Sankt Pölten', 'Keimstraße', '1', 'N2804E4738', 0),
        station('4740', '3390', 'KH Melk', '', '', 'N2804E4716', 28.7),
        station('4132', '2000', 'KH Stockerau', '', '', 'N2827E4779', 93.4),
        station('3158', '3100', 'Sankt Pölten', 'Mariazeller Straße', '79', 'N2802E4738', 68.1),
      ],
    },
    total: 190.2,
  },
};

// „Nicht eindeutige REQUEST", Seiten 6–7.
const ANTWORT_MEHRDEUTIG = {
  success: true,
  notes: 'Wartungshinweis',
  version: '1.32.710',
  data: {
    geomarketing: [
      {
        geocoder: {
          query: { ort: 'st. pölten', hnr: '1' },
          count: 19,
          geo_state: 32,
          message: 'Verortung:Hausnummern genau',
          found: [
            {
              zip: '3100',
              gem: 'St. Pölten',
              district: 'Sankt Pölten (Stadt)',
              state: 'Niederösterreich',
              okz: '3158',
              str: 'Roßmarkt',
              hnr: '1',
              score: 90,
            },
            {
              zip: '3100',
              gem: 'St. Pölten',
              district: 'Sankt Pölten (Stadt)',
              state: 'Niederösterreich',
              okz: '3158',
              str: 'Stöckelergasse',
              hnr: '1',
              score: 90,
            },
          ],
        },
      },
      {
        geocoder: {
          query: { plz: '3100', ort: 'st. pölten', str: 'mariazeller str', hnr: '79' },
          count: 1,
          geo_state: 32,
          message: 'Verortung:Hausnummern genau',
          found: [
            {
              zip: '3100',
              gem: 'St. Pölten',
              district: 'Sankt Pölten (Stadt)',
              state: 'Niederösterreich',
              okz: '3158',
              str: 'Mariazeller Straße',
              hnr: '79 ',
              score: 96,
            },
          ],
        },
      },
    ],
  },
};

// Antwort des Servers vom 11.11.2026 auf „st. pölten, Hausnummer 1" (ohne Straße)
// → „melk, kh": statt der Trefferliste aus der Dokumentation eine Distanz ab einer
// vom Server gewählten Adresse.
const ANTWORT_ERGAENZT = {
  success: true,
  notes: '',
  version: '1.33.0 Datenstand: 10/26',
  data: {
    distance: {
      ort: [
        station('3158', '3100', 'Sankt Pölten', 'Am Bischofteich', '1', 'N2803E4738', 0),
        station('3000017', '3390', 'KH Melk', 'Krankenhausstraße', '11 Verwaltung', 'N2804E4717', 26.5),
      ],
    },
    total: 26.5,
  },
};

interface Aufruf {
  url: string;
  init: RequestInit;
  zeit: number;
}

/** Attrappe für `fetch`: zeichnet Aufrufe auf und liefert die vorgegebenen Antworten der Reihe nach. */
function attrappe(antworten: (() => Response | Promise<Response>)[]): {
  fetch: typeof fetch;
  aufrufe: Aufruf[];
} {
  const aufrufe: Aufruf[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    aufrufe.push({ url: String(url), init: init ?? {}, zeit: Date.now() });
    const naechste = antworten[Math.min(aufrufe.length - 1, antworten.length - 1)]!;
    return naechste();
  }) as typeof fetch;
  return { fetch: f, aufrufe };
}

const json =
  (koerper: unknown, status = 200) =>
  (): Response =>
    new Response(JSON.stringify(koerper), { status, headers: { 'Content-Type': 'application/json' } });

const client = (a: { fetch: typeof fetch }, mindestabstandMs = 0) =>
  createDistanzanzeiger({ endpunkt: ENDPUNKT, apiKey: KEY, fetch: a.fetch, mindestabstandMs });

test('Gesamtvertrag § 9 Abs. 5: bis 499 m abrunden, darüber aufrunden', () => {
  assert.equal(ganzeKilometer(0), 0);
  assert.equal(ganzeKilometer(499), 0);
  assert.equal(ganzeKilometer(500), 1);
  assert.equal(ganzeKilometer(12_499), 12);
  assert.equal(ganzeKilometer(12_500), 13);
  assert.equal(ganzeKilometer(190_200), 190);
  assert.throws(() => ganzeKilometer(-1), DistanzanzeigerError);
  assert.throws(() => ganzeKilometer(12.5), DistanzanzeigerError);
});

test('Anfrage wie in der Dokumentation: POST, Bearer-Key, alle fünf Felder je Ort', async () => {
  const a = attrappe([json(ANTWORT_DISTANZ)]);
  await client(a).abfragen(ORTE);
  assert.equal(a.aufrufe.length, 1);
  const { url, init } = a.aufrufe[0]!;
  assert.equal(url, ENDPUNKT);
  assert.equal(init.method, 'POST');
  const kopf = init.headers as Record<string, string>;
  assert.equal(kopf['Authorization'], `Bearer ${KEY}`);
  assert.equal(kopf['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(String(init.body)), [
    { plz: '', ort: 'st. pölten', okz: '', str: 'Keimstraße', hnr: '1' },
    { plz: '', ort: 'melk, kh', okz: '', str: '', hnr: '' },
    { plz: '', ort: 'kh stockerau', okz: '', str: '', hnr: '' },
    { plz: '3100', ort: 'st. pölten', okz: '', str: 'mariazeller str', hnr: '79' },
  ]);
});

test('Eindeutige Antwort: Stationen, Teilstrecken und Gesamtdistanz des Beispiels', async () => {
  const e = await client(attrappe([json(ANTWORT_DISTANZ)])).abfragen(ORTE);
  assert.equal(e.art, 'distanz');
  if (e.art !== 'distanz') return;
  assert.equal(e.hinweis, 'Wartungshinweis');
  assert.equal(e.version, '1.32.710');
  assert.deepEqual(
    e.stationen.map((s) => [s.ort, s.okz, s.id, s.meter]),
    [
      ['Sankt Pölten', '3158', 'N2804E4738', 0],
      ['KH Melk', '4740', 'N2804E4716', 28_700],
      ['KH Stockerau', '4132', 'N2827E4779', 93_400],
      ['Sankt Pölten', '3158', 'N2802E4738', 68_100],
    ],
  );
  assert.equal(e.meter, 190_200);
  // Die Teilstrecken ergeben zusammen die Gesamtdistanz.
  assert.equal(
    e.stationen.reduce((s, x) => s + x.meter, 0),
    e.meter,
  );
  assert.equal(e.kilometer, 190);
});

test('Gesamtdistanz mit 500 m und mehr wird aufgerundet', async () => {
  const antwort = { ...ANTWORT_DISTANZ, data: { ...ANTWORT_DISTANZ.data, total: 12.5 } };
  const e = await client(attrappe([json(antwort)])).abfragen(ORTE);
  assert.equal(e.art === 'distanz' && e.kilometer, 13);
});

test('Mehrdeutige Antwort: Treffer je Ort, keine Distanz', async () => {
  const e = await client(attrappe([json(ANTWORT_MEHRDEUTIG)])).abfragen(ORTE);
  assert.equal(e.art, 'mehrdeutig');
  if (e.art !== 'mehrdeutig') return;
  assert.equal(e.suchen.length, 2);
  assert.deepEqual(e.suchen[0]!.abfrage, { ort: 'st. pölten', hnr: '1' });
  assert.equal(e.suchen[0]!.anzahl, 19);
  assert.equal(e.suchen[0]!.status, 32);
  assert.equal(e.suchen[0]!.meldung, 'Verortung:Hausnummern genau');
  assert.deepEqual(e.suchen[1]!.treffer, [
    {
      plz: '3100',
      gemeinde: 'St. Pölten',
      bezirk: 'Sankt Pölten (Stadt)',
      bundesland: 'Niederösterreich',
      okz: '3158',
      str: 'Mariazeller Straße',
      hnr: '79',
      score: 96,
    },
  ]);
});

test('„no access": verständlicher Fehler, ohne den Key zu nennen — bei HTTP 200 wie bei 401', async () => {
  for (const status of [200, 401]) {
    const a = attrappe([json({ success: false, message: 'no access' }, status)]);
    await assert.rejects(client(a).abfragen(ORTE), (e: unknown) => {
      assert.ok(e instanceof DistanzanzeigerError);
      assert.match(e.message, /no access/);
      assert.ok(!e.message.includes(KEY));
      return true;
    });
  }
});

test('Unbrauchbare Antworten werfen einen Protokollfehler', async () => {
  const faelle: (() => Response)[] = [
    () => new Response('<html>Wartung</html>', { status: 503 }),
    json({ success: true, data: {} }),
    json({ success: true, data: { distance: { ort: [] }, total: 1 } }),
    json({ success: true, data: { distance: ANTWORT_DISTANZ.data.distance, total: '190.2' } }),
    json({ fehler: 'intern' }, 500),
  ];
  for (const f of faelle) {
    await assert.rejects(client(attrappe([f])).abfragen(ORTE), DistanzanzeigerProtokollError);
  }
});

test('Eingabe: mindestens zwei Standorte, jeder mit Postleitzahl, Ort oder Ortskennzahl — ohne Anfrage', async () => {
  const a = attrappe([json(ANTWORT_DISTANZ)]);
  await assert.rejects(client(a).abfragen([{ ort: 'melk, kh' }]), /zwei Standorte/);
  await assert.rejects(
    client(a).abfragen([{ ort: 'melk, kh' }, { str: 'Hauptstrasse', hnr: '1' }]),
    /Standort 2/,
  );
  assert.equal(a.aufrufe.length, 0);
  const zwei = attrappe([json(ANTWORT_ERGAENZT)]);
  await client(zwei).abfragen([{ okz: '3158' }, { okz: 'N2804E4717' }]);
  assert.equal(zwei.aufrufe.length, 1);
});

test('Ein Fehler wird nicht wiederholt: genau eine Anfrage je Aufruf', async () => {
  const a = attrappe([
    () => {
      throw new TypeError('fetch failed');
    },
  ]);
  await assert.rejects(client(a).abfragen(ORTE), /nicht erreichbar/);
  assert.equal(a.aufrufe.length, 1);
});

test('Drossel: Anfragen laufen nacheinander mit Mindestabstand, auch nach einem Fehler', async () => {
  let laufend = 0;
  let gleichzeitig = 0;
  const langsam = async (): Promise<Response> => {
    laufend++;
    gleichzeitig = Math.max(gleichzeitig, laufend);
    await new Promise((r) => setTimeout(r, 15));
    laufend--;
    return json(ANTWORT_DISTANZ)();
  };
  const a = attrappe([langsam, json({ success: false, message: 'no access' }), langsam]);
  const c = client(a, 60);
  const ergebnisse = await Promise.allSettled([c.abfragen(ORTE), c.abfragen(ORTE), c.abfragen(ORTE)]);
  assert.deepEqual(
    ergebnisse.map((e) => e.status),
    ['fulfilled', 'rejected', 'fulfilled'],
  );
  assert.equal(gleichzeitig, 1);
  assert.equal(a.aufrufe.length, 3);
  // Abstand zwischen den Starts: Dauer der vorigen Anfrage plus Mindestabstand (mit etwas Toleranz für Timer).
  assert.ok(a.aufrufe[1]!.zeit - a.aufrufe[0]!.zeit >= 70, String(a.aufrufe[1]!.zeit - a.aufrufe[0]!.zeit));
  assert.ok(a.aufrufe[2]!.zeit - a.aufrufe[1]!.zeit >= 55, String(a.aufrufe[2]!.zeit - a.aufrufe[1]!.zeit));
});

test('Konfiguration: https-Endpunkt und Key sind Pflicht', () => {
  assert.throws(() => createDistanzanzeiger({ endpunkt: 'http://example.invalid', apiKey: KEY }), /https/);
  assert.throws(() => createDistanzanzeiger({ endpunkt: ENDPUNKT, apiKey: ' ' }), /API-Key/);
  assert.throws(
    () => createDistanzanzeiger({ endpunkt: ENDPUNKT, apiKey: KEY, mindestabstandMs: -1 }),
    /Millisekunden/,
  );
});

test('Vom Server ergänzte Adressfelder werden je Station ausgewiesen', async () => {
  const e = await client(attrappe([json(ANTWORT_ERGAENZT)])).abfragen([
    { ort: 'st. pölten', hnr: '1' },
    { ort: 'melk, kh' },
  ]);
  assert.equal(e.art, 'distanz');
  if (e.art !== 'distanz') return;
  const [start, ziel] = e.stationen;
  // Die Straße war nicht angefragt — der Server hat sie gewählt.
  assert.deepEqual(start!.angefragt, { plz: '', ort: 'st. pölten', okz: '', str: '', hnr: '1' });
  assert.deepEqual(start!.ergaenzt, ['plz', 'okz', 'str']);
  assert.equal(start!.str, 'Am Bischofteich');
  assert.equal(start!.einrichtung, false);
  // Eine erkannte Einrichtung (siebenstellige Sonder-OKZ) bringt ihre Adresse mit.
  assert.deepEqual(ziel!.ergaenzt, ['plz', 'okz', 'str', 'hnr']);
  assert.equal(ziel!.einrichtung, true);
  assert.equal(e.kilometer, 27);
});

test('Vollständig angefragte Adresse: nur Kennzahlen sind ergänzt, umgeschriebene Felder zählen nicht', async () => {
  const e = await client(attrappe([json(ANTWORT_DISTANZ)])).abfragen(ORTE);
  if (e.art !== 'distanz') return assert.fail('Distanz erwartet');
  // „st. pölten, Keimstraße 1" → „Sankt Pölten, Keimstraße 1": Ort umgeschrieben, nichts hinzugefügt außer PLZ und OKZ.
  assert.deepEqual(e.stationen[0]!.ergaenzt, ['plz', 'okz']);
  // „3100 st. pölten, mariazeller str 79": nur die OKZ kommt dazu.
  assert.deepEqual(e.stationen[3]!.ergaenzt, ['okz']);
  assert.equal(e.stationen[3]!.angefragt.str, 'mariazeller str');
  assert.equal(e.stationen[3]!.str, 'Mariazeller Straße');
});

test('Antwort mit anderer Anzahl von Orten als angefragt ist ein Protokollfehler', async () => {
  const a = attrappe([json(ANTWORT_ERGAENZT)]);
  await assert.rejects(client(a).abfragen(ORTE), /4 Standorte angefragt, 2 Orte/);
});

test('Protokollfehler trägt die rohe Antwort', async () => {
  const a = attrappe([json({ success: true, data: {} })]);
  await assert.rejects(client(a).abfragen(ORTE), (e: unknown) => {
    assert.ok(e instanceof DistanzanzeigerProtokollError);
    assert.deepEqual(e.antwort, { success: true, data: {} });
    return true;
  });
});

// Antwort des Servers vom 11.11.2026 auf den absichtlich falsch geschriebenen Ort
// „Böhmkrchen" (gemeint: Böheimkirchen) → „melk, kh". Anders als im Beispiel der
// Dokumentation tragen die Treffer hier `ort` und `id`, Straße und Hausnummer sind leer.
const ANTWORT_TREFFERLISTE = {
  success: true,
  notes: '',
  version: '1.33.0 Datenstand: 10/26',
  data: {
    geomarketing: [
      {
        geocoder: {
          query: { ort: 'Böhmkrchen' },
          count: 3,
          geo_state: 4,
          message: 'Verortung:Orts genau',
          found: [
            {
              zip: '8741',
              gem: 'Weißkirchen in Steiermark',
              district: 'Murtal',
              state: 'Steiermark',
              ort: 'Baumkirchen',
              okz: '15286',
              id: 'N2682E4681',
              str: '',
              hnr: '',
              score: 20,
            },
            {
              zip: '8741',
              gem: 'Weißkirchen in Steiermark',
              district: 'Murtal',
              state: 'Steiermark',
              ort: 'Baumkirchen',
              okz: '15254',
              id: 'N2682E4680',
              str: '',
              hnr: '',
              score: 20,
            },
            {
              zip: '6121',
              gem: 'Baumkirchen',
              district: 'Innsbruck (Land)',
              state: 'Tirol',
              ort: 'Baumkirchen',
              okz: '16474',
              id: 'N2688E4439',
              str: '',
              hnr: '',
              score: 20,
            },
          ],
        },
      },
      {
        geocoder: {
          query: { ort: 'KH melk' },
          count: 1,
          geo_state: 4,
          message: 'Verortung:Orts genau',
          found: [
            {
              zip: '3390',
              gem: 'Melk',
              district: 'Melk',
              state: 'Niederösterreich',
              ort: 'KH Melk',
              okz: '3000017',
              id: 'N2804E4717',
              str: '',
              hnr: '',
              score: 90,
            },
          ],
        },
      },
    ],
  },
};

test('Beobachtete Trefferliste: zu stark abweichende Schreibweise liefert Vorschläge mit niedriger Übereinstimmung', async () => {
  const e = await client(attrappe([json(ANTWORT_TREFFERLISTE)])).abfragen([
    { ort: 'Böhmkrchen' },
    { ort: 'melk, kh' },
  ]);
  assert.equal(e.art, 'mehrdeutig');
  if (e.art !== 'mehrdeutig') return;
  const [start, ziel] = e.suchen;
  assert.deepEqual(start!.abfrage, { ort: 'Böhmkrchen' });
  assert.equal(start!.anzahl, 3);
  assert.equal(start!.status, 4);
  // Der gemeinte Ort ist nicht unter den Vorschlägen; alle tragen die Übereinstimmung 20.
  assert.deepEqual(
    start!.treffer.map((t) => [t.ort, t.plz, t.bundesland, t.okz, t.id, t.score]),
    [
      ['Baumkirchen', '8741', 'Steiermark', '15286', 'N2682E4681', 20],
      ['Baumkirchen', '8741', 'Steiermark', '15254', 'N2682E4680', 20],
      ['Baumkirchen', '6121', 'Tirol', '16474', 'N2688E4439', 20],
    ],
  );
  // Auch ein eindeutiger Ort steht in der Liste, sobald ein anderer es nicht ist — der Server schreibt die Abfrage dabei um.
  assert.deepEqual(ziel!.abfrage, { ort: 'KH melk' });
  assert.deepEqual(ziel!.treffer, [
    {
      plz: '3390',
      gemeinde: 'Melk',
      bezirk: 'Melk',
      bundesland: 'Niederösterreich',
      ort: 'KH Melk',
      okz: '3000017',
      id: 'N2804E4717',
      str: '',
      hnr: '',
      score: 90,
    },
  ]);
});
