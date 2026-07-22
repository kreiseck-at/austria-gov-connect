import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonSessionExpiredError, FonSoapFaultError, type Session } from '@kreiseck/finanzonline-core';
import { createRksv } from './index';

// Regressionstests gegen ECHTE, redigierte FON-rkdb-Testantworten
// (art_uebermittlung=T, aufgenommen 2026-07-22). Struktur, Namespaces,
// Returncodes und der verificationResult-Baum sind unveraendert — nur Geheimwerte
// wurden neutralisiert. Diese Fixtures binden das reale Wire-Verhalten fest.

function fakeSession(): Session {
  return { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
}
function rksvMit(responseXml: string) {
  const fetchImpl = (async (_u: string | URL | Request, _i?: RequestInit) =>
    new Response(responseXml, { status: 200 })) as unknown as typeof fetch;
  return createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
}

const REG_SE_OK =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:29</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const REG_SE_B10 =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:31</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>B10</ns0:rc><ns0:msg>Die angegebene Signaturerstellungseinheit ist mit dem angegebenen Vertrauensdiensteanbieter und der Seriennummer des Zertifikates bereits in der Datenbank gespeichert.</ns0:msg></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const STATUS_IN_BETRIEB =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:30</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage><ns0:abfrage_ergebnis><ts_registrierung>2026-07-22T03:25:29.852+02:00</ts_registrierung><status>IN_BETRIEB</status><ts_status>2026-07-22T03:25:29.849+02:00</ts_status></ns0:abfrage_ergebnis></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const STATUS_AUSFALL =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:33</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage><ns0:abfrage_ergebnis><ts_registrierung>2026-07-22T03:25:29.852+02:00</ts_registrierung><status>AUSFALL</status><ts_status>2026-07-22T03:25:31.000+02:00</ts_status></ns0:abfrage_ergebnis></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const STATUS_B33 =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:39</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>B33</ns0:rc><ns0:msg>Die Seriennummer ist nicht registriert oder bereits außer Betrieb genommen.</ns0:msg></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const BELEG_FAIL =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:36</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>43</ns0:rc><ns0:msg>Der übermittelte Beleg ist fehlerhaft.</ns0:msg></ns0:rkdbMessage><ns0:verificationResultList><ns0:verificationResult><ns0:verificationId>VERIFICATION_FROM_CASHBOX</ns0:verificationId><ns0:version>1</ns0:version><ns0:verificationName>Prüfergebnis - Kasse</ns0:verificationName><ns0:verificationTextualDescription>Bei der Belegprüfung wird untersucht ...</ns0:verificationTextualDescription><ns0:verificationState>FAIL</ns0:verificationState><ns0:verificationResultDetailedMessage>Der vorliegende Beleg kann nicht gültig geprüft werden ...</ns0:verificationResultDetailedMessage><ns0:input><RECEIPT xmlns="https://finanzonline.bmf.gv.at/rkdb">_R1-AT1_KECK-1_KECK-1-ID-1_2025-06-04T16:17:58_0,00_0,00_0,00_0,00_0,00_nA+Ob7eF_32082A8F_AshR0Dg4KFE=_UXvitpZZhDR2FFFoTkIUvSpzH+SMnTJ264XZ5CGcEMQzDv3LCMJl09ayMhoWg/PWGShT0KPnn/eg8CiXmCWeKw==</RECEIPT></ns0:input><ns0:verificationTimestamp>2026-07-22T03:25:37.577+02:00</ns0:verificationTimestamp><ns0:verificationResultList><ns0:verificationResult><ns0:verificationId>EXISTS_CASHBOX</ns0:verificationId><ns0:version>1</ns0:version><ns0:verificationName>Überprüfung ob Kasse in FinanzOnline registriert wurde</ns0:verificationName><ns0:verificationState>FAIL</ns0:verificationState><ns0:verificationResultDetailedMessage>... keiner registrierten Kasse zugeordnet ...</ns0:verificationResultDetailedMessage><ns0:verificationTimestamp>2026-07-22T03:25:37.586+02:00</ns0:verificationTimestamp></ns0:verificationResult></ns0:verificationResultList></ns0:verificationResult></ns0:verificationResultList></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

// Antwort auf ein Paket mit >1 Vorgang: asynchrone Empfangsbestätigung — EIN
// `result` mit rc 0 (nur „empfangen", KEIN Einzelergebnis). Die echten
// Einzelergebnisse liegen in der DataBox. Verifiziert 2026-07-22: 12 verschiedene
// Vorgänge -> genau dieses eine rc-0-result; ein einzelner Vorgang dagegen -> das
// echte Einzelergebnis (z. B. B33).
const ASYNC_ACK =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:37</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

// Kasse registrieren (KECK-2) → rc 0.
const REG_KASSE_OK =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T04:12:07</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

// Belegprüfung PASS: rc 0, FLACHER Baum — nur VERIFICATION_FROM_CASHBOX mit PASS,
// keine verschachtelten Teilprüfungen (die gibt es nur im FAIL-Fall).
const BELEG_PASS =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T04:12:09</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage><ns0:verificationResultList><ns0:verificationResult><ns0:verificationId>VERIFICATION_FROM_CASHBOX</ns0:verificationId><ns0:version>1</ns0:version><ns0:verificationName>Prüfergebnis - Kasse</ns0:verificationName><ns0:verificationTextualDescription>Bei der Belegprüfung wird untersucht ...</ns0:verificationTextualDescription><ns0:verificationState>PASS</ns0:verificationState><ns0:verificationResultDetailedMessage>Die Registrierung Ihrer Registrierkasse und der Signatur-/Siegelerstellungseinheit war erfolgreich. Der vorliegende Startbeleg wurde gesetzeskonform erstellt.</ns0:verificationResultDetailedMessage><ns0:input><RECEIPT xmlns="https://finanzonline.bmf.gv.at/rkdb">_R1-AT1_KECK-2_KECK-2-ID-1_2026-07-22T04:11:18_0,00_0,00_0,00_0,00_0,00_QLSULaIS_32082A8F_mDUJ5OYs4oY=_VcMexjthBlgPCG3Hv6mFQAGwP1hX35+pMoz7WvdOLBovLhKOhgHHrNotDha5wjvam9QJ8FgYTdEKoVNKMdm/sg==</RECEIPT></ns0:input><ns0:verificationTimestamp>2026-07-22T04:12:10.003+02:00</ns0:verificationTimestamp></ns0:verificationResult></ns0:verificationResultList></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

// Ungültige/abgelaufene Session: der rkdb-Dienst liefert rc -1 als rkdbMessage
// (KEIN SOAP-Fault) — verifiziert live 2026-07-22.
const INVALID_SESSION =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T02:32:06Z</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>-1</ns0:rc><ns0:msg>Die Session ID ist ungültig oder abgelaufen.</ns0:msg></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

// Strukturell ungültiger Request: echter SOAP-Fault (HTTP 500), Detailtext im
// verschachtelten <fon:ValidationError> — verifiziert live 2026-07-22.
const VALIDATION_FAULT =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><SOAP-ENV:Fault><faultcode>SOAP-ENV:Client</faultcode><faultstring xml:lang="en">Validation error</faultstring><detail><fon:ValidationError xmlns:fon="https://finanzonline.bmf.gv.at">cvc-complex-type.2.4.a: Invalid content was found starting with element art_uebermittlung. One of tid is expected.</fon:ValidationError></detail></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const SEE_REG = { paketNr: 1, artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: '32082A8F' } as const;

test('Fixture ungültige Session: rc -1 -> FonSessionExpiredError (geworfen)', async () => {
  const rksv = rksvMit(INVALID_SESSION);
  await assert.rejects(
    () => rksv.status.see({ paketNr: 1, zertifikatsseriennummer: '32082A8F' }),
    FonSessionExpiredError,
  );
});

test('Fixture Validierungs-Fault (HTTP 500) -> FonSoapFaultError mit Detailtext', async () => {
  const fetchImpl = (async (_u: string | URL | Request, _i?: RequestInit) =>
    new Response(VALIDATION_FAULT, { status: 500 })) as unknown as typeof fetch;
  const rksv = createRksv({ session: fakeSession(), uebermittlung: 'test', transport: { fetchImpl } });
  await assert.rejects(
    () => rksv.status.see({ paketNr: 1, zertifikatsseriennummer: '32082A8F' }),
    (e: unknown) =>
      e instanceof FonSoapFaultError &&
      e.faultcode === 'SOAP-ENV:Client' &&
      /One of tid is expected/.test(e.detail ?? ''),
  );
});

test('Fixture reg_se rc 0: leeres <msg/> -> ok, rc 0, msg leer', async () => {
  const erg = await rksvMit(REG_SE_OK).see.registriere(SEE_REG);
  assert.equal(erg.ok, true);
  assert.equal(erg.rc, '0');
  assert.equal(erg.msg, '');
});

test('Fixture reg_se B10: bereits gespeichert -> ok false, rc/msg durchgereicht', async () => {
  const erg = await rksvMit(REG_SE_B10).see.registriere(SEE_REG);
  assert.equal(erg.ok, false);
  assert.equal(erg.rc, 'B10');
  assert.match(erg.msg, /bereits in der Datenbank gespeichert/);
});

test('Fixture status_se IN_BETRIEB: abfrage_ergebnis mit NICHT-namespaced Kindern', async () => {
  const erg = await rksvMit(STATUS_IN_BETRIEB).status.see({ paketNr: 1, zertifikatsseriennummer: '32082A8F' });
  assert.equal(erg.ok, true);
  assert.equal(erg.status?.status, 'IN_BETRIEB');
  assert.equal(erg.status?.tsRegistrierung, '2026-07-22T03:25:29.852+02:00');
  assert.equal(erg.status?.tsStatus, '2026-07-22T03:25:29.849+02:00');
});

test('Fixture status_se AUSFALL', async () => {
  const erg = await rksvMit(STATUS_AUSFALL).status.see({ paketNr: 1, zertifikatsseriennummer: '32082A8F' });
  assert.equal(erg.status?.status, 'AUSFALL');
});

test('Fixture status_se B33: nicht registriert -> ok false, kein status', async () => {
  const erg = await rksvMit(STATUS_B33).status.see({ paketNr: 1, zertifikatsseriennummer: '32082A8F' });
  assert.equal(erg.ok, false);
  assert.equal(erg.rc, 'B33');
  assert.equal(erg.status, undefined);
});

test('Fixture belegpruefung FAIL: verificationId-Baum (VERIFICATION_FROM_CASHBOX -> EXISTS_CASHBOX)', async () => {
  const pr = await rksvMit(BELEG_FAIL).beleg.pruefe({ paketNr: 1, beleg: '_R1-AT1_KECK-1_…' });
  assert.equal(pr[0]?.id, 'VERIFICATION_FROM_CASHBOX');
  assert.equal(pr[0]?.name, 'Prüfergebnis - Kasse');
  assert.equal(pr[0]?.status, 'FAIL');
  assert.equal(pr[0]?.teilpruefungen?.[0]?.id, 'EXISTS_CASHBOX');
  assert.equal(pr[0]?.teilpruefungen?.[0]?.status, 'FAIL');
});

test('Fixture reg_kasse KECK-2 rc 0: Kasse registriert', async () => {
  const erg = await rksvMit(REG_KASSE_OK).kasse.registriere({
    paketNr: 1,
    kassenidentifikationsnummer: 'KECK-2',
    benutzerschluessel: 'A'.repeat(44),
  });
  assert.equal(erg.ok, true);
  assert.equal(erg.rc, '0');
});

test('Fixture belegpruefung PASS: flacher Baum, VERIFICATION_FROM_CASHBOX = PASS', async () => {
  const pr = await rksvMit(BELEG_PASS).beleg.pruefe({ paketNr: 1, beleg: '_R1-AT1_KECK-2_…' });
  assert.equal(pr.length, 1);
  assert.equal(pr[0]?.id, 'VERIFICATION_FROM_CASHBOX');
  assert.equal(pr[0]?.name, 'Prüfergebnis - Kasse');
  assert.equal(pr[0]?.status, 'PASS');
  assert.match(pr[0]?.detail ?? '', /erfolgreich|gesetzeskonform/);
  assert.equal(pr[0]?.teilpruefungen, undefined); // PASS ist flach
});

test('Fixture async: >1 Vorgang -> asynchron; die rc-0-Empfangsbestätigung ist NICHT das Ergebnis', async () => {
  const rksv = rksvMit(ASYNC_ACK);
  const q = await rksv.uebermittlePaket({
    paketNr: 1,
    vorgaenge: [
      { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: '0FEED0001' },
      { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: '0FEED0002' },
    ],
  });
  assert.equal(q.verarbeitung, 'asynchron');
  assert.equal(q.verarbeitung === 'asynchron' && /DataBox/i.test(q.hinweis), true);
});
