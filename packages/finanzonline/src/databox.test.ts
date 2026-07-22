import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabox } from './databox';
import type { Session } from '@kreiseck/finanzonline-core';
const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
const LISTE = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result><name>ACME</name><anbringen>RKDB</anbringen><zrvon>2026-01-01</zrvon><zrbis>2026-01-31</zrbis><datbesch>2026-07-22</datbesch><erltyp>P</erltyp><fileart>XML</fileart><ts_zust>2026-07-22T03:25:37</ts_zust><applkey>KEY0000000001</applkey><filebez>protokoll.xml</filebez><status></status></result></ns:getDataboxResponse></S:Body></S:Envelope>`;

test('liste parst databoxListEntry inkl. gelesen-Flag', async () => {
  const db = createDatabox(s, { transport: { fetchImpl: (async () => new Response(LISTE, { status: 200 })) as unknown as typeof fetch } });
  const eintraege = await db.liste({ erltyp: 'P' });
  assert.equal(eintraege.length, 1);
  assert.equal(eintraege[0]?.anbringen, 'RKDB');
  assert.equal(eintraege[0]?.fileart, 'XML');
  assert.equal(eintraege[0]?.applkey, 'KEY0000000001');
  assert.equal(eintraege[0]?.gelesen, false);
});
