import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Session } from '@kreiseck/finanzonline-core';
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

// Antwort auf ein Paket mit 2 Vorgängen + erzwinge_asynchron=true: der FON-Testmodus
// antwortet SYNCHRON mit einem result (rc 0) — keine DataBox-Quittung.
const ASYNC_ABER_SYNCHRON =
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><ns0:rkdbResponse xmlns:ns0="https://finanzonline.bmf.gv.at/rkdb"><ns0:paket_nr>1</ns0:paket_nr><ns0:ts_erstellung>2026-07-22T03:25:37</ns0:ts_erstellung><ns0:result><ns0:satznr>1</ns0:satznr><ns0:rkdbMessage><ns0:rc>0</ns0:rc><ns0:msg/></ns0:rkdbMessage></ns0:result></ns0:rkdbResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const SEE_REG = { paketNr: 1, artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: '32082A8F' } as const;

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

test('Fixture async: 2 Vorgänge, FON antwortet synchron -> Ergebnisse NICHT verwerfen', async () => {
  const rksv = rksvMit(ASYNC_ABER_SYNCHRON);
  const q = await rksv.uebermittlePaket({
    paketNr: 1,
    erzwingeAsynchron: true,
    vorgaenge: [
      { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: '32082A8F' },
      { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: '32082A8F' },
    ],
  });
  assert.equal(q.verarbeitung, 'synchron');
  assert.equal(q.verarbeitung === 'synchron' && q.ergebnisse.length, 1);
  assert.equal(q.verarbeitung === 'synchron' && q.ergebnisse[0]?.rc, '0');
});
