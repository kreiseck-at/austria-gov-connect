import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabox } from './databox';
import { FonProtocolError, type Session } from '@kreiseck/finanzonline-core';

const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };

test('eintrag dekodiert Base64-result zu Buffer', async () => {
  const xml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxEntryResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result>PGE+dGVzdDwvYT4=</result></ns:getDataboxEntryResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, { transport: { fetchImpl: (async () => new Response(xml, { status: 200 })) as unknown as typeof fetch } });
  const eintrag = await db.eintrag('KEY0000000001', 'XML');
  assert.equal(eintrag.fileart, 'XML');
  assert.equal(eintrag.inhalt.toString('utf8'), '<a>test</a>');
});

test('eintrag sendet SOAPAction getDataboxEntry mit tid/benid/id/applkey', async () => {
  const xml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxEntryResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result>PGE+dGVzdDwvYT4=</result></ns:getDataboxEntryResponse></S:Body></S:Envelope>`;
  let sentBody = '';
  let sentSoapAction = '';
  const db = createDatabox(s, {
    transport: {
      fetchImpl: (async (_u: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? '');
        const headers = init?.headers as Record<string, string> | undefined;
        sentSoapAction = headers?.SOAPAction ?? headers?.soapaction ?? '';
        return new Response(xml, { status: 200 });
      }) as unknown as typeof fetch,
    },
  });
  await db.eintrag('KEY0000000001', 'PDF');
  assert.match(sentSoapAction, /getDataboxEntry/);
  assert.match(sentBody, /<tid>ABCD1234<\/tid>/);
  assert.match(sentBody, /<benid>benutzer1<\/benid>/);
  assert.match(sentBody, /<applkey>KEY0000000001<\/applkey>/);
});

test('eintrag wirft FonProtocolError bei rc != 0', async () => {
  const fehlerXml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxEntryResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>-1</rc><msg>Eintrag nicht gefunden</msg></ns:getDataboxEntryResponse></S:Body></S:Envelope>`;
  const db = createDatabox(s, { transport: { fetchImpl: (async () => new Response(fehlerXml, { status: 200 })) as unknown as typeof fetch } });
  await assert.rejects(() => db.eintrag('KEY0000000001', 'XML'), FonProtocolError);
});
