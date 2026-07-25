import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEldaTransfer } from './transfer';

const cfg = (fetchImpl: unknown) => ({
  seriennummer: 'S1', kundenpasswort: 'p', apiKey: 'K1', umgebung: 'kundentest' as const,
  transport: { fetchImpl: fetchImpl as typeof fetch },
});
const soap = (inner: string) =>
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;

test('senden: parst statusCode/protokollnummer/dateiId + baut Request an Kundentest', async () => {
  let sentTo = ''; let body = '';
  const resp = soap('<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><dateiId>199565708</dateiId><eldaZeitstempel>2026-07-25T07:00:00.000+02:00</eldaZeitstempel><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>');
  const fetchImpl = async (url: string, init: { body: string }) => { sentTo = url; body = init.body; return new Response(resp, { status: 200 }); };
  const elda = createEldaTransfer(cfg(fetchImpl));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: Buffer.from('<x/>') });
  assert.equal(sentTo, 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
  assert.match(body, /<v4:senden/);
  assert.match(body, /<payload>PHgvPg==<\/payload>/); // base64 von "<x/>"
  assert.equal(r.ok, true);
  assert.equal(r.statusCode, '000');
  assert.equal(r.protokollnummer, '155764331');
  assert.equal(r.dateiId, '199565708');
});

test('senden: fachlicher Fehler wird NICHT geworfen (ok:false + meldung)', async () => {
  const resp = soap('<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>fehlerCode: E1</messages><statusCode>403</statusCode></serviceResult><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '403');
  assert.equal(r.meldung, 'fehlerCode: E1');
});

test('ruecksendungenAuflisten: parst mehrere ruecksendungen', async () => {
  const resp = soap('<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><ruecksendungen><dateiName>fehler_155764331</dateiName><protokollnummer>155764332</protokollnummer></ruecksendungen><ruecksendungen><dateiName>ok_155764340</dateiName><protokollnummer>155764341</protokollnummer></ruecksendungen></return></ns2:ruecksendungenAuflistenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const list = await elda.ruecksendungenAuflisten();
  assert.equal(list.length, 2);
  assert.equal(list[0]?.protokollnummer, '155764332');
  assert.equal(list[0]?.dateiName, 'fehler_155764331');
  assert.equal(list[1]?.protokollnummer, '155764341');
});

test('empfangen: parst statusCode + datei-Metadaten + inline base64 inhalt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(`<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>199565708</id><name>mitteilung.xml</name><dateiTyp>1</dateiTyp><md5>abc</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`);
  let body = '';
  const elda = createEldaTransfer(cfg(async (_u: string, init: { body: string }) => { body = init.body; return new Response(resp, { status: 200 }); }));
  const r = await elda.empfangen('155764332');
  assert.match(body, /<protokollnummer>155764332<\/protokollnummer>/);
  assert.equal(r.ok, true);
  assert.equal(r.datei?.name, 'mitteilung.xml');
  assert.equal(r.datei?.md5, 'abc');
  assert.equal(r.datei?.inhalt.toString('utf8'), '<protokoll/>');
});

test('empfangen: nicht vorhanden -> ok:false, kein datei', async () => {
  const resp = soap('<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>Keine Rücksendung mit Protokollnummer 1 vorhanden.</messages><statusCode>406</statusCode></serviceResult></return></ns2:empfangenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '406');
  assert.equal(r.datei, undefined);
});
