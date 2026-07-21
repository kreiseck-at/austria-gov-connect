import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FonSessionExpiredError,
  FonSessionError,
  FonSoapFaultError,
  FonProtocolError,
  type Session,
} from '@kreiseck/finanzonline-core';
import { createRksv, type Rksv } from './client';
import { type Ergebnis } from './antwort';
import { type Vorgang } from './vorgaenge';

function fakeSession(): Session {
  return { id: 'SESSION0001', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
}

function respond(
  xml: string,
  capture?: (body: string) => void,
  status = 200,
): (u: string | URL | Request, i?: RequestInit) => Promise<Response> {
  return async (_u: string | URL | Request, init?: RequestInit) => {
    capture?.(String(init?.body ?? ''));
    return new Response(xml, { status });
  };
}

const rkdbResp = (results: string) =>
  `<Envelope><Body><rkdbResponse><paket_nr>42</paket_nr><ts_erstellung>x</ts_erstellung>${results}</rkdbResponse></Body></Envelope>`;

const resultXml = (satznr: number, rc: string, msg: string, extra = '') =>
  `<result><satznr>${satznr}</satznr><rkdbMessage><rc>${rc}</rc><msg>${msg}</msg></rkdbMessage>${extra}</result>`;

const einzelnerVorgang: Vorgang = {
  art: 'registrierung_kasse',
  kassenidentifikationsnummer: 'K1',
  benutzerschluessel: 'A'.repeat(44),
};

function rksvMitRc(rc: string, msg = 'msg'): Rksv {
  const fetchImpl = respond(rkdbResp(resultXml(1, rc, msg))) as unknown as typeof fetch;
  return createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
}

// ---------------------------------------------------------------------------
// 1. Returncode-Klassifikation über den gesamten client-Pfad
// ---------------------------------------------------------------------------

test("rc '0' -> synchron mit vollständigem ok-Ergebnis", async () => {
  const fetchImpl = respond(rkdbResp(resultXml(1, '0', 'Aufruf ok'))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] });
  assert.equal(q.verarbeitung, 'synchron');
  if (q.verarbeitung !== 'synchron') return;
  assert.deepEqual(q.ergebnisse, [{ satznr: 1, ok: true, rc: '0', msg: 'Aufruf ok' }]);
});

test("rc '-1' wirft FonSessionExpiredError", async () => {
  const fetchImpl = respond(rkdbResp(resultXml(1, '-1', 'Session ungültig'))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  await assert.rejects(
    () => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] }),
    FonSessionExpiredError,
  );
});

for (const rc of ['-2', '-3', '-4'] as const) {
  test(`rc '${rc}' wirft FonSessionError, aber NICHT FonSessionExpiredError`, async () => {
    const fetchImpl = respond(rkdbResp(resultXml(1, rc, `Fehler ${rc}`))) as unknown as typeof fetch;
    const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
    let caught: unknown;
    try {
      await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] });
      assert.fail('Aufruf hätte werfen müssen');
    } catch (err) {
      caught = err;
    }
    assert.equal(caught instanceof FonSessionError, true);
    assert.equal(caught instanceof FonSessionExpiredError, false);
  });
}

const FACHLICH_SAMPLE = ['4', '43', 'B1', 'B32', '998', '999', 'V1', 'C1', 'ZZ'];
for (const rc of FACHLICH_SAMPLE) {
  test(`rc '${rc}' (fachlich bzw. unbekannt) liefert Ergebnis statt throw, rc/msg durchgereicht`, async () => {
    const msg = `Nachricht-${rc}`;
    const fetchImpl = respond(rkdbResp(resultXml(1, rc, msg))) as unknown as typeof fetch;
    const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
    const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] });
    assert.equal(q.verarbeitung, 'synchron');
    if (q.verarbeitung !== 'synchron') return;
    assert.equal(q.ergebnisse[0]?.ok, false);
    assert.equal(q.ergebnisse[0]?.rc, rc);
    assert.equal(q.ergebnisse[0]?.msg, msg);
  });
}

// ---------------------------------------------------------------------------
// 2. Jeder Wrapper liefert einen fachlichen rc als Ergebnis (kein throw)
// ---------------------------------------------------------------------------

const WRAPPER_CALLS: Array<{ name: string; call: (rksv: Rksv) => Promise<Ergebnis> }> = [
  {
    name: 'kasse.registriere',
    call: (r) =>
      r.kasse.registriere({ paketNr: 1, kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) }),
  },
  {
    name: 'kasse.meldeAusfall',
    call: (r) =>
      r.kasse.meldeAusfall({
        paketNr: 1,
        kassenidentifikationsnummer: 'K1',
        begruendung: 5,
        beginn: new Date('2026-01-01T00:00:00Z'),
      }),
  },
  {
    name: 'kasse.meldeWiederinbetriebnahme',
    call: (r) =>
      r.kasse.meldeWiederinbetriebnahme({
        paketNr: 1,
        kassenidentifikationsnummer: 'K1',
        ende: new Date('2026-01-02T00:00:00Z'),
      }),
  },
  {
    name: 'kasse.nimmAusserBetrieb',
    call: (r) => r.kasse.nimmAusserBetrieb({ paketNr: 1, kassenidentifikationsnummer: 'K1', begruendung: 6 }),
  },
  {
    name: 'see.registriere',
    call: (r) =>
      r.see.registriere({ paketNr: 1, artSe: 'HSM_DIENSTLEISTER', vdaId: 'AT9', zertifikatsseriennummer: '1a2b' }),
  },
  {
    name: 'see.meldeAusfall',
    call: (r) =>
      r.see.meldeAusfall({
        paketNr: 1,
        zertifikatsseriennummer: '1a2b',
        begruendung: 1,
        beginn: new Date('2026-01-01T00:00:00Z'),
      }),
  },
  {
    name: 'see.meldeWiederinbetriebnahme',
    call: (r) =>
      r.see.meldeWiederinbetriebnahme({ paketNr: 1, zertifikatsseriennummer: '1a2b', ende: new Date('2026-01-02T00:00:00Z') }),
  },
  {
    name: 'see.nimmAusserBetrieb',
    call: (r) => r.see.nimmAusserBetrieb({ paketNr: 1, zertifikatsseriennummer: '1a2b', begruendung: 6 }),
  },
];

for (const { name, call } of WRAPPER_CALLS) {
  test(`${name} liefert fachliches Ergebnis (rc=B1) statt throw`, async () => {
    const rksv = rksvMitRc('B1', 'bereits registriert');
    const erg = await call(rksv);
    assert.equal(erg.ok, false);
    assert.equal(erg.rc, 'B1');
  });
}

test('kasse.registriere wirft FonSessionExpiredError bei rc -1', async () => {
  const rksv = rksvMitRc('-1', 'Session ungültig');
  await assert.rejects(
    () => rksv.kasse.registriere({ paketNr: 1, kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) }),
    FonSessionExpiredError,
  );
});

test('see.registriere wirft FonSessionExpiredError bei rc -1', async () => {
  const rksv = rksvMitRc('-1', 'Session ungültig');
  await assert.rejects(
    () =>
      rksv.see.registriere({ paketNr: 1, artSe: 'HSM_DIENSTLEISTER', vdaId: 'AT9', zertifikatsseriennummer: '1a2b' }),
    FonSessionExpiredError,
  );
});

// ---------------------------------------------------------------------------
// 3. belegpruefung / verificationResult-Varianten via beleg.pruefe
// ---------------------------------------------------------------------------

function rksvMitBelegpruefung(vrl: string): Rksv {
  const inner = resultXml(1, '0', 'ok', vrl);
  const fetchImpl = respond(rkdbResp(inner)) as unknown as typeof fetch;
  return createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
}

test('belegpruefung: alle Prüfungen PASS', async () => {
  const vrl =
    '<verificationResultList>' +
    '<verificationResult><verificationName>A</verificationName><verificationState>PASS</verificationState></verificationResult>' +
    '<verificationResult><verificationName>B</verificationName><verificationState>PASS</verificationState></verificationResult>' +
    '</verificationResultList>';
  const rksv = rksvMitBelegpruefung(vrl);
  const pr = await rksv.beleg.pruefe({ paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr.length, 2);
  assert.equal(pr[0]?.status, 'PASS');
  assert.equal(pr[1]?.status, 'PASS');
});

test('belegpruefung: gemischt PASS/FAIL mit Detailmeldung', async () => {
  const vrl =
    '<verificationResultList>' +
    '<verificationResult><verificationName>Struktur</verificationName><verificationState>PASS</verificationState></verificationResult>' +
    '<verificationResult><verificationName>Signatur</verificationName><verificationState>FAIL</verificationState><verificationResultDetailedMessage>Signatur ungültig</verificationResultDetailedMessage></verificationResult>' +
    '</verificationResultList>';
  const rksv = rksvMitBelegpruefung(vrl);
  const pr = await rksv.beleg.pruefe({ paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr.length, 2);
  assert.equal(pr[0]?.status, 'PASS');
  assert.equal(pr[0]?.detail, undefined);
  assert.equal(pr[1]?.status, 'FAIL');
  assert.equal(pr[1]?.detail, 'Signatur ungültig');
});

test('belegpruefung: NOT_EXECUTED-Zustand wird übernommen', async () => {
  const vrl =
    '<verificationResultList>' +
    '<verificationResult><verificationName>NichtAusgeführt</verificationName><verificationState>NOT_EXECUTED</verificationState></verificationResult>' +
    '</verificationResultList>';
  const rksv = rksvMitBelegpruefung(vrl);
  const pr = await rksv.beleg.pruefe({ paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr.length, 1);
  assert.equal(pr[0]?.status, 'NOT_EXECUTED');
});

test('belegpruefung: verschachtelte Teilprüfungen zwei Ebenen tief', async () => {
  const vrl =
    '<verificationResultList>' +
    '<verificationResult><verificationName>Ebene1</verificationName><verificationState>PASS</verificationState>' +
    '<verificationResultList>' +
    '<verificationResult><verificationName>Ebene2</verificationName><verificationState>PASS</verificationState>' +
    '<verificationResultList>' +
    '<verificationResult><verificationName>Ebene3</verificationName><verificationState>FAIL</verificationState></verificationResult>' +
    '</verificationResultList>' +
    '</verificationResult>' +
    '</verificationResultList>' +
    '</verificationResult>' +
    '</verificationResultList>';
  const rksv = rksvMitBelegpruefung(vrl);
  const pr = await rksv.beleg.pruefe({ paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr[0]?.name, 'Ebene1');
  const ebene2 = pr[0]?.teilpruefungen?.[0];
  assert.equal(ebene2?.name, 'Ebene2');
  const ebene3 = ebene2?.teilpruefungen?.[0];
  assert.equal(ebene3?.name, 'Ebene3');
  assert.equal(ebene3?.status, 'FAIL');
});

test('belegpruefung: unbekannter/kaputter verificationState normalisiert zu NOT_EXECUTED', async () => {
  const vrl =
    '<verificationResultList>' +
    '<verificationResult><verificationName>Garbage</verificationName><verificationState>IRGENDWAS_UNBEKANNTES</verificationState></verificationResult>' +
    '</verificationResultList>';
  const rksv = rksvMitBelegpruefung(vrl);
  const pr = await rksv.beleg.pruefe({ paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.equal(pr[0]?.status, 'NOT_EXECUTED');
});

test('belegpruefung: leere verificationResultList -> leeres Pruefung[]', async () => {
  const vrl = '<verificationResultList></verificationResultList>';
  const rksv = rksvMitBelegpruefung(vrl);
  const pr = await rksv.beleg.pruefe({ paketNr: 1, beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' });
  assert.deepEqual(pr, []);
});

// ---------------------------------------------------------------------------
// 4. status-Ergebnisse via status.kasse
// ---------------------------------------------------------------------------

const STATUS_WERTE = ['AKTIVIERT', 'REGISTRIERT', 'IN_BETRIEB', 'AUSFALL'];
for (const status of STATUS_WERTE) {
  test(`status.kasse liefert Status ${status}`, async () => {
    const inner = resultXml(
      1,
      '0',
      'ok',
      `<abfrage_ergebnis><ts_registrierung>2026-01-01T00:00:00Z</ts_registrierung><status>${status}</status><ts_status>2026-02-01T00:00:00Z</ts_status></abfrage_ergebnis>`,
    );
    const fetchImpl = respond(rkdbResp(inner)) as unknown as typeof fetch;
    const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
    const erg = await rksv.status.kasse({ paketNr: 42, kassenidentifikationsnummer: 'K1' });
    assert.equal(erg.ok, true);
    assert.equal(erg.status?.status, status);
  });
}

test('status.kasse einer nicht registrierten Kasse (rc B32): ok=false, kein status', async () => {
  const fetchImpl = respond(
    rkdbResp(resultXml(1, 'B32', 'nicht registriert oder bereits außer Betrieb')),
  ) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const erg = await rksv.status.kasse({ paketNr: 42, kassenidentifikationsnummer: 'UNBEKANNT' });
  assert.equal(erg.ok, false);
  assert.equal(erg.rc, 'B32');
  assert.equal(erg.status, undefined);
});

// ---------------------------------------------------------------------------
// 5. Transport-/Protokollfehler
// ---------------------------------------------------------------------------

const SOAP_FAULT_XML =
  '<Envelope><Body><Fault><faultcode>soapenv:Server</faultcode><faultstring>Interner Serverfehler</faultstring><detail>irgendein Detail</detail></Fault></Body></Envelope>';

test('SOAP Fault in der Antwort wirft FonSoapFaultError', async () => {
  const fetchImpl = respond(SOAP_FAULT_XML, undefined, 200) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  await assert.rejects(
    () => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] }),
    FonSoapFaultError,
  );
});

test('nicht parsebarer Body wirft FonProtocolError', async () => {
  const fetchImpl = respond('<Envelope><Body>', undefined, 200) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  await assert.rejects(
    () => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] }),
    FonProtocolError,
  );
});

test('HTTP 500 mit SOAP Fault wirft dennoch FonSoapFaultError (Fault hat Vorrang vor HTTP-Status)', async () => {
  const fetchImpl = respond(SOAP_FAULT_XML, undefined, 500) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  await assert.rejects(
    () => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] }),
    FonSoapFaultError,
  );
});

test('HTTP 500 ohne SOAP Fault wirft FonProtocolError', async () => {
  const fetchImpl = respond(rkdbResp(resultXml(1, '0', 'ok')), undefined, 500) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  await assert.rejects(
    () => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: [einzelnerVorgang] }),
    FonProtocolError,
  );
});

// ---------------------------------------------------------------------------
// 6. Asynchroner Pfad
// ---------------------------------------------------------------------------

test('mehrere Vorgänge -> asynchron mit Hinweis auf DataBox', async () => {
  const fetchImpl = respond(rkdbResp('')) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K2', benutzerschluessel: 'B'.repeat(44) },
  ];
  const q = await rksv.uebermittlePaket({ paketNr: 42, vorgaenge: vs });
  assert.equal(q.verarbeitung, 'asynchron');
  if (q.verarbeitung !== 'asynchron') return;
  assert.match(q.hinweis, /DataBox/i);
});

test('technischer rc -1 in Antwort auf Mehrfachpaket wirft dennoch (throwIfTechnical vor asynchron-Zweig)', async () => {
  const fetchImpl = respond(rkdbResp(resultXml(1, '-1', 'Session ungültig'))) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K2', benutzerschluessel: 'B'.repeat(44) },
  ];
  await assert.rejects(() => rksv.uebermittlePaket({ paketNr: 42, vorgaenge: vs }), FonSessionExpiredError);
});
