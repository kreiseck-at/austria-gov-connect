import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callSoap } from './transport';
import { childText } from './soap/parse';
import { FonTransportError, FonSoapFaultError, FonProtocolError } from './errors';

function okResponse(): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    // Header und Body prüfen wir im dedizierten Test unten
    void init;
    return new Response(
      '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body>' +
        '<loginResponse><id>S1</id><rc>0</rc></loginResponse>' +
        '</soapenv:Body></soapenv:Envelope>',
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

test('setzt SOAPAction und Content-Type korrekt', async () => {
  let seenAction: string | null = null;
  let seenType: string | null = null;
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    seenAction = h.get('SOAPAction');
    seenType = h.get('Content-Type');
    return new Response('<Envelope><Body><loginResponse><rc>0</rc></loginResponse></Body></Envelope>', {
      status: 200,
    });
  }) as unknown as typeof fetch;

  await callSoap({ endpoint: 'https://example.test', soapAction: 'login', body: '<x/>' }, { fetchImpl });
  assert.equal(seenAction, '"login"');
  assert.equal(seenType, 'text/xml; charset=utf-8');
});

test('gibt bei rc=0 den geparsten Wurzelknoten zurück', async () => {
  const root = await callSoap(
    { endpoint: 'https://example.test', soapAction: 'login', body: '<x/>' },
    { fetchImpl: okResponse() },
  );
  assert.equal(root.name, 'Envelope');
});

test('wirft FonSoapFaultError bei SOAP-Fault trotz HTTP 500', async () => {
  const fetchImpl = (async () =>
    new Response(
      '<Envelope><Body><Fault><faultcode>Server</faultcode>' +
        '<faultstring>kaputt</faultstring></Fault></Body></Envelope>',
      { status: 500 },
    )) as unknown as typeof fetch;
  await assert.rejects(
    () => callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl }),
    (err: unknown) => err instanceof FonSoapFaultError && err.faultcode === 'Server',
  );
});

test('wirft FonProtocolError bei unparsebarer Antwort', async () => {
  const fetchImpl = (async () => new Response('kein xml', { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(
    () => callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl }),
    FonProtocolError,
  );
});

test('wirft FonProtocolError bei HTTP 404 ohne Fault', async () => {
  const fetchImpl = (async () =>
    new Response('<html>404</html>', { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(
    () => callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl }),
    FonProtocolError,
  );
});

test('wirft FonTransportError bei Netzfehler und respektiert retries', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    throw new Error('ECONNRESET');
  }) as unknown as typeof fetch;
  await assert.rejects(
    () =>
      callSoap({ endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' }, { fetchImpl, retries: 2 }),
    FonTransportError,
  );
  assert.equal(calls, 3); // 1 Versuch + 2 Wiederholungen
});

test('wirft FonTransportError bei Zeitüberschreitung', async () => {
  const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      callSoap(
        { endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' },
        { fetchImpl, timeoutMs: 10 },
      ),
    (err: unknown) => err instanceof FonTransportError && /Zeitüberschreitung/.test(err.message),
  );
});

test('erfolgreiche Antwort wird nach rc-freiem Parsen weitergereicht', async () => {
  const root = await callSoap(
    { endpoint: 'https://x.test', soapAction: 'login', body: '<x/>' },
    { fetchImpl: okResponse() },
  );
  const resp = root.children[0]?.children[0];
  assert.equal(childText(resp!, 'id'), 'S1');
});
