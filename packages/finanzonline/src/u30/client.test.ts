import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FonError,
  FonSessionExpiredError,
  FonSoapFaultError,
  FonTransportError,
  type Session,
} from '@kreiseck/finanzonline-core';
import { createU30 } from './client';
import { U30PruefError } from './fehler';
import type { U30Paket } from './typen';
import { golden } from './xsd-hilfe.test';

const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD12345', benid: 'benutzer1', async logout() {} };
const jetzt = new Date('2026-11-10T08:00:00Z');
const Q3 = {
  kz000: 1489092,
  kz022: 1489092,
  kz057: 35227,
  kz070: 643490,
  kz072: 643490,
  kz060: 79284,
  kz065: 128698,
  kz066: 35227,
};
const PAKET: U30Paket = {
  paketNr: 1003,
  erstellt: jetzt,
  erklaerungen: [
    {
      steuernummer: '911234565',
      zeitraum: { jahr: 2026, quartal: 3 },
      kennzahlen: Q3,
      kundeninfo: 'Q3-2026',
    },
  ],
};

const UPLOAD = (rc: string, msg = ''): string =>
  `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><fileuploadResponse xmlns="https://finanzonline.bmf.gv.at/fon/ws/fileupload"><rc>${rc}</rc>${msg ? `<msg>${msg}</msg>` : ''}</fileuploadResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
const FAULT =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><SOAP-ENV:Fault><faultcode>SOAP-ENV:Client</faultcode><faultstring xml:lang="en">Validation error</faultstring><detail><fon:ValidationError xmlns:fon="https://finanzonline.bmf.gv.at">cvc-complex-type.2.4.a</fon:ValidationError></detail></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>';

interface Aufruf {
  url: string;
  aktion: string;
  body: string;
}
function attrappe(antwort: (a: Aufruf) => { status?: number; text: string } | Error) {
  const aufrufe: Aufruf[] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const a = {
      url: String(url),
      aktion: (headers['SOAPAction'] ?? '').replace(/"/g, ''),
      body: String(init?.body ?? ''),
    };
    aufrufe.push(a);
    const r = antwort(a);
    if (r instanceof Error) throw r;
    return new Response(r.text, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { aufrufe, transport: { fetchImpl } };
}
const unescape = (t: string): string =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
const gesendetesData = (body: string): string => unescape(/<data>([\s\S]*)<\/data>/.exec(body)?.[1] ?? '');

// --- Sicherheit: Standard ist der Testmodus ---

test('sende ohne optionen → uebermittlung T', async () => {
  const m = attrappe(() => ({ text: UPLOAD('0') }));
  const r = await createU30(s, { transport: m.transport }).sende(PAKET, { jetzt });
  assert.equal(m.aufrufe.length, 1);
  assert.match(m.aufrufe[0]?.body ?? '', /<uebermittlung>T<\/uebermittlung>/);
  assert.equal(r.uebermittlung, 'T');
});

test('echt: false → T, echt: true → P', async () => {
  const m = attrappe(() => ({ text: UPLOAD('0') }));
  const u30 = createU30(s, { transport: m.transport });
  assert.equal((await u30.sende(PAKET, { echt: false, jetzt })).uebermittlung, 'T');
  assert.equal((await u30.sende(PAKET, { echt: true, jetzt })).uebermittlung, 'P');
  assert.match(m.aufrufe[0]?.body ?? '', /<uebermittlung>T<\/uebermittlung>/);
  assert.match(m.aufrufe[1]?.body ?? '', /<uebermittlung>P<\/uebermittlung>/);
});

test("echt: 'true', 1 oder null → FonError, kein Netz", async () => {
  const m = attrappe(() => ({ text: UPLOAD('0') }));
  const u30 = createU30(s, { transport: m.transport });
  for (const echt of ['true', 1, null]) {
    await assert.rejects(() => u30.sende(PAKET, { echt: echt as never, jetzt }), FonError, String(echt));
  }
  assert.equal(m.aufrufe.length, 0);
});

test('ungültiges Paket → U30PruefError, kein Netz', async () => {
  const m = attrappe(() => ({ text: UPLOAD('0') }));
  const kaputt: U30Paket = {
    ...PAKET,
    erklaerungen: [{ ...PAKET.erklaerungen[0]!, steuernummer: '911234566' }],
  };
  await assert.rejects(
    () => createU30(s, { transport: m.transport }).sende(kaputt, { jetzt }),
    U30PruefError,
  );
  assert.equal(m.aufrufe.length, 0);
});

// --- Senden ---

test('gesendet wird genau das Golden-XML, an den FileUpload mit art U30', async () => {
  const m = attrappe(() => ({ text: UPLOAD('0') }));
  const r = await createU30(s, { transport: m.transport }).sende(PAKET, { jetzt });
  const a = m.aufrufe[0];
  assert.equal(a?.url, 'https://finanzonline.bmf.gv.at/fon/ws/fileupload');
  assert.equal(a?.aktion, 'upload');
  assert.match(a?.body ?? '', /<art>U30<\/art>/);
  assert.equal(gesendetesData(a?.body ?? ''), golden('pilot-q3-2026.xml'));
  assert.equal(r.xml, golden('pilot-q3-2026.xml'));
});

test('rc 0 → angenommen', async () => {
  const msg =
    'XML-File wurde gesendet, es wurde 1 Erklärung übermittelt. Das File wurde nur für Testzwecke übermittelt! Die Daten gelten nicht als eingebracht.';
  const m = attrappe(() => ({ text: UPLOAD('0', msg) }));
  const r = await createU30(s, { transport: m.transport }).sende(PAKET, { jetzt });
  assert.deepEqual(
    { ...r, xml: undefined },
    { paketNr: 1003, uebermittlung: 'T', angenommen: true, rc: 0, msg, xml: undefined },
  );
});

test('rc -2, -3, -4, -5 → nicht angenommen, rc und msg durchgereicht', async () => {
  for (const [rc, msg] of [
    ['-2', 'Wartungsarbeiten'],
    ['-3', 'technischer Fehler'],
    ['-4', 'Invalid UTF-8 middle byte 0xf6 (at char #580, byte #37)'],
    ['-5', 'Sie haben keine Berechtigung, Inhalte dieser Art zu übermitteln.'],
  ] as const) {
    const m = attrappe(() => ({ text: UPLOAD(rc, msg) }));
    const r = await createU30(s, { transport: m.transport }).sende(PAKET, { jetzt });
    assert.equal(r.angenommen, false, rc);
    assert.equal(r.rc, Number(rc));
    assert.equal(r.msg, msg);
  }
});

test('rc -1 → FonSessionExpiredError', async () => {
  const m = attrappe(() => ({ text: UPLOAD('-1', 'Die Session ID ist ungültig oder abgelaufen.') }));
  await assert.rejects(
    () => createU30(s, { transport: m.transport }).sende(PAKET, { jetzt }),
    FonSessionExpiredError,
  );
});

test('SOAP-Fault → FonSoapFaultError', async () => {
  const m = attrappe(() => ({ status: 500, text: FAULT }));
  await assert.rejects(
    () => createU30(s, { transport: m.transport }).sende(PAKET, { jetzt }),
    FonSoapFaultError,
  );
});

test('nie automatisch wiederholen: retries 3 im transport, Netzfehler → genau ein Aufruf', async () => {
  const m = attrappe(() => new Error('ECONNRESET'));
  const u30 = createU30(s, { transport: { ...m.transport, retries: 3 } });
  await assert.rejects(() => u30.sende(PAKET, { jetzt }), FonTransportError);
  assert.equal(m.aufrufe.length, 1);
});

// --- Protokolle ---

const PROTOKOLL_OK =
  '<?xml version="1.0" encoding="UTF-8"?><XML><ART_IDENTIFIKATIONSBEGRIFF>FASTNR</ART_IDENTIFIKATIONSBEGRIFF><IDENTIFIKATIONSBEGRIFF>911234565</IDENTIFIKATIONSBEGRIFF><PAKET_NR>373364601</PAKET_NR><DATUM_ERSTELLUNG>2026-11-03</DATUM_ERSTELLUNG><UHRZEIT_ERSTELLUNG>20.20.46</UHRZEIT_ERSTELLUNG><ANZAHL_ERKLAERUNGEN>1</ANZAHL_ERKLAERUNGEN><TEXT>Die oben angeführte TEST-Übermittlung wurde am 03.11.2026 um 20:20:46 zur Gänze übernommen.</TEXT></XML>';
const eintrag = (anbringen: string, fileart: string, applkey: string, filebez: string): string =>
  `<result><name>Melisse Nails e.U.</name><anbringen>${anbringen}</anbringen><zrvon></zrvon><zrbis></zrbis><datbesch>2026-11-03+01:00</datbesch><erltyp>P</erltyp><fileart>${fileart}</fileart><ts_zust>2026-11-03T20:20:59.206+01:00</ts_zust><applkey>${applkey}</applkey><filebez>${filebez}</filebez><status></status></result>`;
const LISTE =
  '<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc>' +
  eintrag('', 'xml', '2026-11-03-20.20.46.876618', 'Webservice_U30_2026-11-03-20.20.46.876000_373364601') +
  eintrag('RKDB', 'xml', 'KEY-RKDB', 'Webservice_RKDB_KEY-RKDB') +
  eintrag('', 'xml', 'KEY-SOER', 'Webservice_SOER_2026-11-03-20.00.00.000000_42') +
  eintrag('', 'pdf', 'KEY-PDF', 'Webservice_U30_2026-11-03-20.00.00.000000_7') +
  '</ns:getDataboxResponse></S:Body></S:Envelope>';
const ENTRY = (xml: string): string =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxEntryResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result>${Buffer.from(xml, 'utf8').toString('base64')}</result></ns:getDataboxEntryResponse></S:Body></S:Envelope>`;
const databox = () => attrappe((a) => ({ text: a.aktion === 'getDatabox' ? LISTE : ENTRY(PROTOKOLL_OK) }));
const fenster = { von: new Date('2026-11-03T19:00:00Z'), bis: new Date('2026-11-03T20:00:00Z') };

test('protokolle öffnet nur U30-Protokolle (XML) und wertet sie aus', async () => {
  const m = databox();
  const liste = await createU30(s, { transport: m.transport }).protokolle(fenster);
  assert.deepEqual(
    m.aufrufe.map((a) => a.aktion),
    ['getDatabox', 'getDataboxEntry'],
  );
  assert.match(m.aufrufe[0]?.body ?? '', /<erltyp>P<\/erltyp>/);
  assert.match(m.aufrufe[1]?.body ?? '', /<applkey>2026-11-03-20\.20\.46\.876618<\/applkey>/);
  assert.equal(liste.length, 1);
  assert.equal(liste[0]?.paketNr, 373364601);
  assert.equal(liste[0]?.filebez, 'Webservice_U30_2026-11-03-20.20.46.876000_373364601');
  assert.equal(liste[0]?.tsZust, '2026-11-03T20:20:59.206+01:00');
  assert.equal(liste[0]?.xml, PROTOKOLL_OK);
  assert.equal(liste[0]?.protokoll?.ergebnis, 'vollstaendig');
  assert.equal(liste[0]?.protokoll?.uebermittlung, 'T');
});

test('protokolle mit paketNr: andere Nummer → nichts geöffnet', async () => {
  const m = databox();
  const liste = await createU30(s, { transport: m.transport }).protokolle({ ...fenster, paketNr: 1003 });
  assert.deepEqual(liste, []);
  assert.deepEqual(
    m.aufrufe.map((a) => a.aktion),
    ['getDatabox'],
  );
});

test('protokolle mit passender paketNr → genau dieses', async () => {
  const m = databox();
  const liste = await createU30(s, { transport: m.transport }).protokolle({ ...fenster, paketNr: 373364601 });
  assert.equal(liste.length, 1);
});

test('protokolle: ein unlesbares Protokoll bricht die Liste nicht ab', async () => {
  const liste =
    '<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc>' +
    eintrag('', 'xml', 'KEY-A', 'Webservice_U30_2026-11-03-20.20.46.876000_373364601') +
    eintrag('', 'xml', 'KEY-B', 'Webservice_U30_2026-11-03-20.21.00.000000_373364602') +
    '</ns:getDataboxResponse></S:Body></S:Envelope>';
  const m = attrappe((a) => ({
    text:
      a.aktion === 'getDatabox'
        ? liste
        : ENTRY(a.body.includes('KEY-B') ? '<PROTOKOLL>neu</PROTOKOLL>' : PROTOKOLL_OK),
  }));
  const r = await createU30(s, { transport: m.transport }).protokolle(fenster);
  assert.equal(r.length, 2);
  assert.equal(r[0]?.protokoll?.ergebnis, 'vollstaendig');
  assert.equal(r[1]?.protokoll, undefined);
  assert.equal(r[1]?.xml, '<PROTOKOLL>neu</PROTOKOLL>');
  assert.match(r[1]?.fehler ?? '', /Wurzel/);
});
