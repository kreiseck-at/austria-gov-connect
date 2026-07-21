import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Session } from '@kreiseck/finanzonline-core';
import { createRksv } from './client';
import { kasse } from './kasse';
import { see } from './see';
import { beleg } from './beleg';

function fakeSession(): Session {
  return { id: 'SESSION0001', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
}
function rksvMit(xml: string, capture?: (body: string) => void) {
  const fetchImpl = (async (_u: string | URL | Request, init?: RequestInit) => {
    capture?.(String(init?.body ?? ''));
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
  return createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
}
const resp = (inner: string) => `<Envelope><Body><rkdbResponse><paket_nr>1</paket_nr><ts_erstellung>x</ts_erstellung>${inner}</rkdbResponse></Body></Envelope>`;
const ok = (extra = '') => resp(`<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage>${extra}</result>`);

test('kasse.registriere liefert Ergebnis und sendet registrierung_kasse', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  const erg = await kasse.registriere(rksv, { paketNr: 1, kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) });
  assert.equal(erg.ok, true);
  assert.match(body, /<registrierung_kasse>/);
});

test('kasse.meldeAusfall setzt begruendung/beginn', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  await kasse.meldeAusfall(rksv, { paketNr: 1, kassenidentifikationsnummer: 'K1', begruendung: 5, beginn: new Date('2026-07-20T10:00:00Z') });
  assert.match(body, /<ausfall><begruendung>5<\/begruendung>/);
});

test('kasse.nimmAusserBetrieb setzt ausserbetriebnahme', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  await kasse.nimmAusserBetrieb(rksv, { paketNr: 1, kassenidentifikationsnummer: 'K1', begruendung: 6 });
  assert.match(body, /<ausserbetriebnahme><begruendung>6<\/begruendung>/);
});

test('see.registriere sendet registrierung_se mit vda_id', async () => {
  let body = '';
  const rksv = rksvMit(ok(), (b) => { body = b; });
  await see.registriere(rksv, { paketNr: 1, artSe: 'HSM_DIENSTLEISTER', vdaId: 'AT9', zertifikatsseriennummer: '1a2b' });
  assert.match(body, /<registrierung_se>.*<vda_id>AT9<\/vda_id>/);
});

test('beleg.pruefe liefert Prüfungsbaum', async () => {
  const rksv = rksvMit(ok('<verificationResultList><verificationResult><verificationId>1</verificationId><version>1</version><verificationName>Struktur</verificationName><verificationState>PASS</verificationState><verificationTimestamp>t</verificationTimestamp></verificationResult></verificationResultList>'));
  const pr = await beleg.pruefe(rksv, { paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr[0]?.name, 'Struktur');
  assert.equal(pr[0]?.status, 'PASS');
});
