import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFileUpload, ANBRINGEN, type Anbringen } from './fileupload';
import { FonSessionExpiredError, type Session } from '@kreiseck/finanzonline-core';

const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };

test('ANBRINGEN deckt sich mit der BMF-Spec (Stand 04.03.2026)', () => {
  // 39 Anbringen-Arten laut BMF „File-Upload-Webservice".
  assert.equal(ANBRINGEN.length, 39);
  for (const a of ['BIL', 'IVF', 'JAB', 'U30', 'U13', 'GIR'] as const) {
    assert.ok((ANBRINGEN as readonly string[]).includes(a), `fehlt: ${a}`);
  }
  // Nicht (mehr) in der Spec — dürfen nicht vorkommen.
  for (const a of ['KDUEB', 'NOVASB', 'NOVASBAB', 'KDX']) {
    assert.ok(!(ANBRINGEN as readonly string[]).includes(a), `unerwartet: ${a}`);
  }
});

const resp = (rc: string, msg = '') =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:fileuploadResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/fileupload"><rc>${rc}</rc>${msg ? `<msg>${msg}</msg>` : ''}</ns:fileuploadResponse></S:Body></S:Envelope>`;
const tp = (xml: string, capture?: (body: string) => void) => ({
  fetchImpl: (async (_u: unknown, init?: RequestInit) => {
    capture?.(String(init?.body ?? ''));
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch,
});

test('upload rc 0 -> { rc: 0 }; Request enthält art/uebermittlung(T)/data', async () => {
  let body = '';
  const fu = createFileUpload(s, { uebermittlung: 'test', transport: tp(resp('0'), (b) => (body = b)) });
  const r = await fu.upload({ art: 'U30', data: '<ERKLAERUNG/>' });
  assert.equal(r.rc, 0);
  assert.match(body, /<art>U30<\/art>/);
  assert.match(body, /<uebermittlung>T<\/uebermittlung>/);
  assert.match(body, /ERKLAERUNG/); // Payload ist enthalten (XML-escaped)
});

test('uebermittlung echt -> P', async () => {
  let body = '';
  const fu = createFileUpload(s, { uebermittlung: 'echt', transport: tp(resp('0'), (b) => (body = b)) });
  await fu.upload({ art: 'U13', data: '<x/>' });
  assert.match(body, /<uebermittlung>P<\/uebermittlung>/);
});

test('rc -5 (keine Berechtigung für art) -> { rc: -5, msg }', async () => {
  const fu = createFileUpload(s, { uebermittlung: 'test', transport: tp(resp('-5', 'Keine Berechtigung')) });
  const r = await fu.upload({ art: 'NOVA', data: '<x/>' });
  assert.equal(r.rc, -5);
  assert.match(r.msg ?? '', /Berechtigung/);
});

test('rc -1 -> FonSessionExpiredError', async () => {
  const fu = createFileUpload(s, { uebermittlung: 'test', transport: tp(resp('-1', 'Session')) });
  await assert.rejects(() => fu.upload({ art: 'U30', data: '<x/>' }), FonSessionExpiredError);
});

test('unbekannte art -> wirft (client-seitige Validierung)', async () => {
  const fu = createFileUpload(s, { uebermittlung: 'test', transport: tp(resp('0')) });
  await assert.rejects(() => fu.upload({ art: 'XXX' as unknown as Anbringen, data: '<x/>' }));
});
