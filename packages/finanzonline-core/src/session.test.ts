import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from './session';
import { FonError, FonSessionError, FonSessionExpiredError } from './errors';

const VALID = {
  tid: 'ABCD1234',
  benid: 'benutzer1',
  pin: 'geheim123',
  herstellerid: 'ATU12345678',
};

function respond(xml: string, capture?: (body: string, action: string) => void): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    capture?.(String(init?.body ?? ''), h.get('SOAPAction') ?? '');
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
}

const loginOk = (id: string) =>
  `<Envelope><Body><loginResponse><id>${id}</id><rc>0</rc></loginResponse></Body></Envelope>`;

test('createSession sendet loginRequest in bindender Feldreihenfolge', async () => {
  let body = '';
  let action = '';
  const session = await createSession({
    ...VALID,
    transport: { fetchImpl: respond(loginOk('SESSION0001'), (b, a) => {
      body = b;
      action = a;
    }) },
  });
  assert.equal(session.id, 'SESSION0001');
  assert.equal(action, '"login"');
  assert.match(body, /<loginRequest xmlns="https:\/\/finanzonline\.bmf\.gv\.at\/fon\/ws\/session">/);
  assert.ok(body.indexOf('<tid>') < body.indexOf('<benid>'));
  assert.ok(body.indexOf('<benid>') < body.indexOf('<pin>'));
  assert.ok(body.indexOf('<pin>') < body.indexOf('<herstellerid>'));
});

test('rc=-1 wirft FonSessionExpiredError', async () => {
  await assert.rejects(
    () =>
      createSession({
        ...VALID,
        transport: {
          fetchImpl: respond('<Envelope><Body><loginResponse><rc>-1</rc></loginResponse></Body></Envelope>'),
        },
      }),
    FonSessionExpiredError,
  );
});

test('rc=-4 wirft FonSessionError (nicht Expired)', async () => {
  await assert.rejects(
    () =>
      createSession({
        ...VALID,
        transport: {
          fetchImpl: respond('<Envelope><Body><loginResponse><rc>-4</rc><msg>ungültig</msg></loginResponse></Body></Envelope>'),
        },
      }),
    (err: unknown) =>
      err instanceof FonSessionError && !(err instanceof FonSessionExpiredError) && err.rc === -4,
  );
});

test('ungültige tid wird lokal abgewiesen, ohne fetch aufzurufen', async () => {
  let called = false;
  await assert.rejects(
    () =>
      createSession({
        ...VALID,
        tid: 'zu-kurz',
        transport: {
          fetchImpl: (async () => {
            called = true;
            return new Response('', { status: 200 });
          }) as unknown as typeof fetch,
        },
      }),
    FonError,
  );
  assert.equal(called, false);
});

test('logout sendet logoutRequest mit tid, benid, id', async () => {
  let logoutBody = '';
  let logoutAction = '';
  let call = 0;
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    call++;
    const h = new Headers(init?.headers);
    if (call === 1) return new Response(loginOk('SESSION0001'), { status: 200 });
    logoutBody = String(init?.body ?? '');
    logoutAction = h.get('SOAPAction') ?? '';
    return new Response('<Envelope><Body><logoutResponse><rc>0</rc></logoutResponse></Body></Envelope>', {
      status: 200,
    });
  }) as unknown as typeof fetch;

  const session = await createSession({ ...VALID, transport: { fetchImpl } });
  await session.logout();
  assert.equal(logoutAction, '"logout"');
  assert.match(logoutBody, /<logoutRequest /);
  assert.match(logoutBody, /<id>SESSION0001<\/id>/);
  assert.ok(logoutBody.indexOf('<tid>') < logoutBody.indexOf('<benid>'));
  assert.ok(logoutBody.indexOf('<benid>') < logoutBody.indexOf('<id>'));
});

test('zweiter logout-Aufruf ist ein No-op und sendet keinen weiteren Request', async () => {
  let call = 0;
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    call++;
    if (call === 1) return new Response(loginOk('SESSION0001'), { status: 200 });
    return new Response('<Envelope><Body><logoutResponse><rc>0</rc></logoutResponse></Body></Envelope>', {
      status: 200,
    });
  }) as unknown as typeof fetch;

  const session = await createSession({ ...VALID, transport: { fetchImpl } });
  await session.logout();
  const callsAfterFirstLogout = call;
  await session.logout();
  assert.equal(call, callsAfterFirstLogout);
});

test('createSession stellt tid und benid am Session-Objekt bereit', async () => {
  const session = await createSession({
    ...VALID,
    transport: { fetchImpl: respond(loginOk('SESSION0001')) },
  });
  assert.equal(session.tid, VALID.tid);
  assert.equal(session.benid, VALID.benid);
});
