import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabox } from './databox';
import {
  FonProtocolError,
  FonRcError,
  FonSessionExpiredError,
  type Session,
} from '@kreiseck/finanzonline-core';
const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
// fileart klein geschrieben + betreff/status-Form wie im echten FON-Response
// (live gegen finanzonline.bmf.gv.at verifiziert, 2026-07-24).
const LISTE = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22+02:00</datbesch><erltyp>P</erltyp><fileart>xml</fileart><ts_zust>2026-07-22T06:01:53.287+02:00</ts_zust><applkey>KEY0000000001</applkey><filebez>Webservice_RKDB_2026-07-22</filebez><status></status><betreff>Registrierkassenübermittlung</betreff></result></ns:getDataboxResponse></S:Body></S:Envelope>`;

test('liste parst databoxListEntry inkl. gelesen-Flag', async () => {
  const db = createDatabox(s, {
    transport: { fetchImpl: (async () => new Response(LISTE, { status: 200 })) as unknown as typeof fetch },
  });
  const eintraege = await db.liste({ erltyp: 'P' });
  assert.equal(eintraege.length, 1);
  assert.equal(eintraege[0]?.anbringen, 'RKDB');
  assert.equal(eintraege[0]?.fileart, 'XML'); // aus kleingeschriebenem 'xml' normalisiert
  assert.equal(eintraege[0]?.applkey, 'KEY0000000001');
  assert.equal(eintraege[0]?.betreff, 'Registrierkassenübermittlung');
  assert.equal(eintraege[0]?.gelesen, false);
});

test('liste normalisiert kleingeschriebenes fileart (real: xml/pdf) korrekt', async () => {
  // FON liefert fileart klein — ein PDF-Eintrag darf NICHT als XML durchgehen.
  const pdfXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>BESCHEID</anbringen><zrvon></zrvon><zrbis></zrbis><datbesch>2026-07-22+02:00</datbesch><erltyp>B</erltyp><fileart>pdf</fileart><ts_zust>2026-07-22T06:01:53.287+02:00</ts_zust><applkey>KEY0000000009</applkey><filebez>bescheid.pdf</filebez><status></status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, {
    transport: { fetchImpl: (async () => new Response(pdfXml, { status: 200 })) as unknown as typeof fetch },
  });
  const eintraege = await db.liste();
  assert.equal(eintraege[0]?.fileart, 'PDF');
});

test('liste setzt gelesen=true bei status=1', async () => {
  const gelesenXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22+02:00</datbesch><erltyp>P</erltyp><fileart>xml</fileart><ts_zust>2026-07-22T03:25:37.000+02:00</ts_zust><applkey>KEY0000000002</applkey><filebez>Webservice_RKDB_KEY0000000002</filebez><status>1</status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async () => new Response(gelesenXml, { status: 200 })) as unknown as typeof fetch,
    },
  });
  const eintraege = await db.liste({ erltyp: 'P' });
  assert.equal(eintraege.length, 1);
  assert.equal(eintraege[0]?.gelesen, true);
});

test('liste wirft FonProtocolError bei rc != 0', async () => {
  const fehlerXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>-6</rc><msg>Fenster &gt;7 Tage</msg></ns:getDataboxResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async () => new Response(fehlerXml, { status: 200 })) as unknown as typeof fetch,
    },
  });
  await assert.rejects(() => db.liste({ erltyp: 'P' }), FonProtocolError);
  // FonRcError trägt strukturiertes rc/serverMsg (Consumer kann -5/-6/-3 unterscheiden)
  await assert.rejects(
    () => db.liste({ erltyp: 'P' }),
    (e: unknown) => e instanceof FonRcError && e.rc === -6 && /Fenster/.test(e.serverMsg ?? ''),
  );
});

test('liste wirft FonSessionExpiredError bei rc=-1 (Session abgelaufen)', async () => {
  const abgelaufenXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>-1</rc><msg>Session abgelaufen</msg></ns:getDataboxResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async () => new Response(abgelaufenXml, { status: 200 })) as unknown as typeof fetch,
    },
  });
  await assert.rejects(() => db.liste({ erltyp: 'P' }), FonSessionExpiredError);
});

/** Schickt `liste({ von, bis })` ab und liefert die gesendeten ts_zust_von/ts_zust_bis. */
async function gesendetesFenster(von: Date, bis: Date): Promise<{ von?: string; bis?: string }> {
  let sentBody = '';
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async (_u: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? '');
        return new Response(LISTE, { status: 200 });
      }) as unknown as typeof fetch,
    },
  });
  await db.liste({ von, bis });
  return {
    von: /<ts_zust_von>([^<]*)<\/ts_zust_von>/.exec(sentBody)?.[1],
    bis: /<ts_zust_bis>([^<]*)<\/ts_zust_bis>/.exec(sentBody)?.[1],
  };
}

// FinanzOnline liest ts_zust_von/ts_zust_bis als Wiener Ortszeit ohne Offset. Live geprüft
// am 03.11.2026: Eine Zustellung mit ts_zust 20:20:59+01:00 lag im Fenster 20:15:59–20:25:59,
// nicht im Fenster 19:15:59–19:25:59 (UTC-Uhrzeit derselben Zustellung).
test('liste sendet von/bis als Wiener Ortszeit ohne Offset (Winterzeit, live geprüft)', async () => {
  const f = await gesendetesFenster(new Date('2026-11-03T19:15:59Z'), new Date('2026-11-03T19:25:59.999Z'));
  assert.deepEqual(f, { von: '2026-11-03T20:15:59', bis: '2026-11-03T20:25:59' });
});

test('liste sendet von/bis als Wiener Ortszeit (Sommerzeit, +02:00)', async () => {
  const f = await gesendetesFenster(new Date('2026-07-01T08:30:00Z'), new Date('2026-07-05T08:30:00Z'));
  assert.deepEqual(f, { von: '2026-07-01T10:30:00', bis: '2026-07-05T10:30:00' });
});

test('liste rechnet über den Datumswechsel und die Zeitumstellungen richtig um', async () => {
  // 31.12. 23:30 UTC ist in Wien schon Neujahr
  assert.deepEqual(
    await gesendetesFenster(new Date('2026-12-31T23:30:00Z'), new Date('2027-01-01T00:00:00Z')),
    {
      von: '2027-01-01T00:30:00',
      bis: '2027-01-01T01:00:00',
    },
  );
  // Beginn Sommerzeit 29.03.2026 01:00 UTC: 01:59:59 MEZ, dann 03:00:00 MESZ
  assert.deepEqual(
    await gesendetesFenster(new Date('2026-03-29T00:59:59Z'), new Date('2026-03-29T01:00:00Z')),
    {
      von: '2026-03-29T01:59:59',
      bis: '2026-03-29T03:00:00',
    },
  );
  // Ende Sommerzeit 25.10.2026 01:00 UTC: 02:30 kommt in Wien zweimal vor
  assert.deepEqual(
    await gesendetesFenster(new Date('2026-10-25T00:30:00Z'), new Date('2026-10-25T01:30:00Z')),
    {
      von: '2026-10-25T02:30:00',
      bis: '2026-10-25T02:30:00',
    },
  );
});

test('liste liefert mehrere Einträge bei mehreren result-Blöcken', async () => {
  const mehrfachXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22+02:00</datbesch><erltyp>P</erltyp><fileart>xml</fileart><ts_zust>2026-07-22T03:25:37.000+02:00</ts_zust><applkey>KEY0000000001</applkey><filebez>Webservice_RKDB_KEY0000000001</filebez><status></status></result><result><name>ACME</name><anbringen>B</anbringen><zrvon>2026-02-01</zrvon><zrbis>2026-02-28</zrbis><datbesch>2026-07-23+02:00</datbesch><erltyp>B</erltyp><fileart>pdf</fileart><ts_zust>2026-07-23T03:25:37.000+02:00</ts_zust><applkey>KEY0000000002</applkey><filebez>bescheid.pdf</filebez><status>1</status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async () => new Response(mehrfachXml, { status: 200 })) as unknown as typeof fetch,
    },
  });
  const eintraege = await db.liste({ erltyp: 'P' });
  assert.equal(eintraege.length, 2);
  assert.equal(eintraege[0]?.applkey, 'KEY0000000001');
  assert.equal(eintraege[1]?.applkey, 'KEY0000000002');
});
