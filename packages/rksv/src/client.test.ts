import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonSessionExpiredError, type Session } from '@kreiseck/finanzonline-core';
import { createRksv } from './client';
import { RksvError, type Vorgang } from './vorgaenge';

function fakeSession(): Session {
  return { id: 'SESSION0001', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
}

function respond(xml: string, capture?: (body: string) => void): (u: string | URL | Request, i?: RequestInit) => Promise<Response> {
  return async (_u: string | URL | Request, init?: RequestInit) => {
    capture?.(String(init?.body ?? ''));
    return new Response(xml, { status: 200 });
  };
}

const rkdbResp = (results: string) =>
  `<Envelope><Body><rkdbResponse><paket_nr>42</paket_nr><ts_erstellung>x</ts_erstellung>${results}</rkdbResponse></Body></Envelope>`;

const okResult = (satznr: number, rc = '0') =>
  `<result><satznr>${satznr}</satznr><rkdbMessage><rc>${rc}</rc><msg>m</msg></rkdbMessage></result>`;

test('ein Vorgang -> synchron mit Ergebnis', async () => {
  const fetchImpl = respond(rkdbResp(okResult(1))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [v] });
  assert.equal(q.verarbeitung, 'synchron');
  assert.equal(q.verarbeitung === 'synchron' && q.ergebnisse[0]?.ok, true);
});

test('mehrere Vorgänge -> asynchron mit Hinweis (DataBox)', async () => {
  const fetchImpl = respond(rkdbResp('')) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K2', benutzerschluessel: 'B'.repeat(44) },
  ];
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: vs });
  assert.equal(q.verarbeitung, 'asynchron');
  assert.equal(q.verarbeitung === 'asynchron' && /DataBox/i.test(q.hinweis), true);
});

test('erzwingeAsynchron macht auch einen Vorgang asynchron', async () => {
  const fetchImpl = respond(rkdbResp('')) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [v], erzwingeAsynchron: true });
  assert.equal(q.verarbeitung, 'asynchron');
});

test('technischer rc -1 im Ergebnis wirft FonSessionExpiredError', async () => {
  const fetchImpl = respond(rkdbResp(okResult(1, '-1'))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  await assert.rejects(() => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [v] }), FonSessionExpiredError);
});

test('gemischte Vorgangsarten werfen RksvError vor dem Senden', async () => {
  let called = false;
  const fetchImpl = (async () => { called = true; return new Response('', { status: 200 }); }) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' },
  ];
  await assert.rejects(() => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: vs }), RksvError);
  assert.equal(called, false);
});

test('status.kasse liefert StatusErgebnis', async () => {
  let body = '';
  const fetchImpl = respond(
    rkdbResp('<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>m</msg></rkdbMessage><abfrage_ergebnis><ts_registrierung>r</ts_registrierung><status>IN_BETRIEB</status><ts_status>s</ts_status></abfrage_ergebnis></result>'),
    (b) => { body = b; },
  ) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const st = await rksv.status.kasse({ paketNr: 42, kassenidentifikationsnummer: 'K1' });
  assert.equal(st?.status, 'IN_BETRIEB');
  assert.match(body, /<status_kasse>/);
});
