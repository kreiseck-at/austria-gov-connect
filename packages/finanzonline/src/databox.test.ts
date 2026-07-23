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
const LISTE = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22</datbesch><erltyp>P</erltyp><fileart>XML</fileart><ts_zust>2026-07-22T03:25:37</ts_zust><applkey>KEY0000000001</applkey><filebez>protokoll.xml</filebez><status></status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;

test('liste parst databoxListEntry inkl. gelesen-Flag', async () => {
  const db = createDatabox(s, {
    transport: { fetchImpl: (async () => new Response(LISTE, { status: 200 })) as unknown as typeof fetch },
  });
  const eintraege = await db.liste({ erltyp: 'P' });
  assert.equal(eintraege.length, 1);
  assert.equal(eintraege[0]?.anbringen, 'RKDB');
  assert.equal(eintraege[0]?.fileart, 'XML');
  assert.equal(eintraege[0]?.applkey, 'KEY0000000001');
  assert.equal(eintraege[0]?.gelesen, false);
});

test('liste setzt gelesen=true bei status=1', async () => {
  const gelesenXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22</datbesch><erltyp>P</erltyp><fileart>XML</fileart><ts_zust>2026-07-22T03:25:37</ts_zust><applkey>KEY0000000002</applkey><filebez>protokoll2.xml</filebez><status>1</status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;
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

test('liste formatiert von/bis als YYYY-MM-DDThh:mm:ss ohne Z/Millisekunden', async () => {
  let sentBody = '';
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async (_u: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? '');
        return new Response(LISTE, { status: 200 });
      }) as unknown as typeof fetch,
    },
  });
  const von = new Date('2026-07-01T08:30:00Z');
  const bis = new Date('2026-07-05T08:30:00Z');
  await db.liste({ von, bis });
  assert.match(sentBody, /<ts_zust_von>2026-07-01T08:30:00<\/ts_zust_von>/);
  assert.match(sentBody, /<ts_zust_bis>2026-07-05T08:30:00<\/ts_zust_bis>/);
});

test('liste liefert mehrere Einträge bei mehreren result-Blöcken', async () => {
  const mehrfachXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22</datbesch><erltyp>P</erltyp><fileart>XML</fileart><ts_zust>2026-07-22T03:25:37</ts_zust><applkey>KEY0000000001</applkey><filebez>protokoll.xml</filebez><status></status></result><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-02-01</zrvon><zrbis>2026-02-28</zrbis><datbesch>2026-07-23</datbesch><erltyp>P</erltyp><fileart>PDF</fileart><ts_zust>2026-07-23T03:25:37</ts_zust><applkey>KEY0000000002</applkey><filebez>protokoll2.pdf</filebez><status>1</status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;
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
