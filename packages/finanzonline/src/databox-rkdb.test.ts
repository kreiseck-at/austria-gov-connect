import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabox } from './databox';
import type { Session } from '@kreiseck/finanzonline-core';

const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };

const listeResp = (results: string) =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc>${results}</ns:getDataboxResponse></S:Body></S:Envelope>`;
const entryResp = (b64: string) =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:getDataboxEntryResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/databox"><rc>0</rc><result>${b64}</result></ns:getDataboxEntryResponse></S:Body></S:Envelope>`;
const listeEintrag = (anbringen: string, applkey: string) =>
  `<result><name>x</name><anbringen>${anbringen}</anbringen><zrvon></zrvon><zrbis></zrbis><datbesch></datbesch><erltyp>P</erltyp><fileart>XML</fileart><ts_zust>2026-01-01T00:00:00</ts_zust><applkey>${applkey}</applkey><filebez>f</filebez><status></status></result>`;

const PROTOKOLL_XML =
  '<rkdbResponse xmlns="https://finanzonline.bmf.gv.at/rkdb"><paket_nr>42</paket_nr><result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg/></rkdbMessage></result></rkdbResponse>';

test('rkdbProtokolle: filtert P/RKDB, liefert den Inhalt als XML-String', async () => {
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    const body = String(init?.body ?? '');
    if (body.includes('getDataboxRequest')) {
      // ein RKDB-Protokoll + ein fremder P-Eintrag (U30) -> muss gefiltert werden
      return new Response(listeResp(listeEintrag('RKDB', 'KEY1') + listeEintrag('U30', 'KEY2')), {
        status: 200,
      });
    }
    return new Response(entryResp(Buffer.from(PROTOKOLL_XML, 'utf8').toString('base64')), {
      status: 200,
    });
  }) as unknown as typeof fetch;

  const db = createDatabox(s, { transport: { fetchImpl } });
  const prot = await db.rkdbProtokolle();
  assert.equal(prot.length, 1);
  assert.equal(prot[0]?.applkey, 'KEY1');
  assert.match(prot[0]?.xml ?? '', /<paket_nr>42<\/paket_nr>/);
});
