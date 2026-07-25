import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FonSoapFaultError, FonTransportError } from '@kreiseck/finanzonline-core';
import { createEldaTransfer, type EldaConfig } from './transfer';
import { ELDA_ENDPOINTS } from './endpoints';
import { EldaProtocolError } from './errors';

const cfg = (fetchImpl: unknown) => ({
  seriennummer: 'S1',
  kundenpasswort: 'p',
  apiKey: 'K1',
  umgebung: 'kundentest' as const,
  transport: { fetchImpl: fetchImpl as typeof fetch },
});
const soap = (inner: string) =>
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;

test('senden: parst statusCode/protokollnummer/dateiId + baut Request an Kundentest', async () => {
  let sentTo = '';
  let body = '';
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><dateiId>199565708</dateiId><eldaZeitstempel>2026-07-25T07:00:00.000+02:00</eldaZeitstempel><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>',
  );
  const fetchImpl = async (url: string, init: { body: string }) => {
    sentTo = url;
    body = init.body;
    return new Response(resp, { status: 200 });
  };
  const elda = createEldaTransfer(cfg(fetchImpl));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: Buffer.from('<x/>') });
  assert.equal(sentTo, 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
  assert.match(body, /<v4:senden/);
  assert.match(body, /<dateiName>m\.xml<\/dateiName>/); // C1: dateiName muss auf der Leitung stehen
  assert.match(body, /<payload>PHgvPg==<\/payload>/); // base64 von "<x/>"
  assert.equal(r.ok, true);
  assert.equal(r.statusCode, '000');
  assert.equal(r.protokollnummer, '155764331');
  assert.equal(r.dateiId, '199565708');
  assert.equal(r.eldaZeitstempel, '2026-07-25T07:00:00.000+02:00'); // C2
});

test('senden: fachlicher Fehler wird NICHT geworfen (ok:false + meldung)', async () => {
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>fehlerCode: E1</messages><statusCode>403</statusCode></serviceResult><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '403');
  assert.equal(r.meldung, 'fehlerCode: E1');
});

test('senden: produktion ist Default-Umgebung', async () => {
  let sentTo = '';
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult></return></ns2:sendenResponse>',
  );
  const elda = createEldaTransfer({
    seriennummer: 'S1',
    kundenpasswort: 'p',
    apiKey: 'K1',
    transport: {
      fetchImpl: (async (url: string) => {
        sentTo = url;
        return new Response(resp, { status: 200 });
      }) as unknown as typeof fetch,
    },
  });
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(sentTo, ELDA_ENDPOINTS.produktion);
});

test('senden: expliziter endpoint überschreibt umgebung', async () => {
  let sentTo = '';
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult></return></ns2:sendenResponse>',
  );
  const elda = createEldaTransfer({
    seriennummer: 'S1',
    kundenpasswort: 'p',
    apiKey: 'K1',
    umgebung: 'sit',
    endpoint: 'https://custom.example.test/TransferService',
    transport: {
      fetchImpl: (async (url: string) => {
        sentTo = url;
        return new Response(resp, { status: 200 });
      }) as unknown as typeof fetch,
    },
  });
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(sentTo, 'https://custom.example.test/TransferService');
});

test('senden: echter SOAP-Fault wird geworfen (im Unterschied zu fachlichen Status-Codes)', async () => {
  const fault = soap(
    '<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Interner Fehler</faultstring></soap:Fault>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(fault, { status: 500 })));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonSoapFaultError,
  );
});

test('senden: fehlendes <return>-Element wird laut als EldaProtocolError geworfen', async () => {
  const resp = soap('<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"></ns2:sendenResponse>');
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('ruecksendungenAuflisten: parst mehrere ruecksendungen + statusCode/ok', async () => {
  const resp = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><ruecksendungen><dateiName>fehler_155764331</dateiName><protokollnummer>155764332</protokollnummer></ruecksendungen><ruecksendungen><dateiName>ok_155764340</dateiName><protokollnummer>155764341</protokollnummer></ruecksendungen></return></ns2:ruecksendungenAuflistenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const erg = await elda.ruecksendungenAuflisten();
  assert.equal(erg.ok, true);
  assert.equal(erg.statusCode, '000');
  assert.equal(erg.ruecksendungen.length, 2);
  assert.equal(erg.ruecksendungen[0]?.protokollnummer, '155764332');
  assert.equal(erg.ruecksendungen[0]?.dateiName, 'fehler_155764331');
  assert.equal(erg.ruecksendungen[1]?.protokollnummer, '155764341');
});

test('ruecksendungenAuflisten: fachlicher Fehler (z. B. ungültiger API-Key) ist von "keine offen" unterscheidbar', async () => {
  const resp = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>API-Key ungültig</messages><statusCode>557</statusCode></serviceResult></return></ns2:ruecksendungenAuflistenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const erg = await elda.ruecksendungenAuflisten();
  assert.equal(erg.ok, false);
  assert.equal(erg.statusCode, '557');
  assert.equal(erg.meldung, 'API-Key ungültig');
  assert.deepEqual(erg.ruecksendungen, []);
});

test('empfangen: parst statusCode + datei-Metadaten + inline base64 inhalt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>199565708</id><name>mitteilung.xml</name><dateiTyp>1</dateiTyp><md5>abc</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  let body = '';
  const elda = createEldaTransfer(
    cfg(async (_u: string, init: { body: string }) => {
      body = init.body;
      return new Response(resp, { status: 200 });
    }),
  );
  const r = await elda.empfangen('155764332');
  assert.match(body, /<protokollnummer>155764332<\/protokollnummer>/);
  assert.equal(r.ok, true);
  assert.equal(r.datei?.id, '199565708'); // C2
  assert.equal(r.datei?.name, 'mitteilung.xml');
  assert.equal(r.datei?.dateiTyp, 1); // C2
  assert.equal(r.datei?.md5, 'abc');
  assert.equal(r.datei?.inhalt.toString('utf8'), '<protokoll/>');
});

test('empfangen: nicht vorhanden -> ok:false, kein datei', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>Keine Rücksendung mit Protokollnummer 1 vorhanden.</messages><statusCode>406</statusCode></serviceResult></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '406');
  assert.equal(r.datei, undefined);
});

test('empfangen: nicht-numerischer dateiTyp wird nicht als NaN gesetzt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><dateiTyp>unbekannt</dateiTyp><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.datei?.dateiTyp, undefined);
});

test('empfangen: MTOM/XOP-referenzierter Payload wirft statt leeres Buffer zu liefern', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:abc@elda.at"/></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('empfangen: leerer Payload bei statusCode 000 wirft statt eine leere Datei vorzutäuschen', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('empfangen: fehlendes <return>-Element wird laut als EldaProtocolError geworfen', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"></ns2:empfangenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

// --- M2: fehlendes/leeres serviceResult -----------------------------------

test('senden: <return> ohne <serviceResult> wirft statt statusCode "" + ok:false zu liefern', async () => {
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><protokollnummer>155764331</protokollnummer></return></ns2:sendenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('empfangen: <serviceResult> ohne <statusCode> wirft ebenfalls', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages></serviceResult></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

// --- M3: Rücksendung ohne Protokollnummer ---------------------------------

test('ruecksendungenAuflisten: leeres <ruecksendungen/> wirft statt Phantom-Eintrag', async () => {
  const resp = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><ruecksendungen/></return></ns2:ruecksendungenAuflistenResponse>',
  );
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.ruecksendungenAuflisten(),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

// --- M1: Leaf-Text wird getrimmt (pretty-printed Antworten) ----------------

test('senden: pretty-printed Antwort — Leaf-Text wird getrimmt (000 bleibt ok)', async () => {
  const resp = soap(`<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/">
    <return>
      <serviceResult>
        <messages>
          OK
        </messages>
        <statusCode>
          000
        </statusCode>
      </serviceResult>
      <dateiId>
        199565708
      </dateiId>
      <eldaZeitstempel>
        2026-07-25T07:00:00.000+02:00
      </eldaZeitstempel>
      <protokollnummer>
        155764331
      </protokollnummer>
    </return>
  </ns2:sendenResponse>`);
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.statusCode, '000');
  assert.equal(r.ok, true);
  assert.equal(r.protokollnummer, '155764331');
  assert.equal(r.dateiId, '199565708');
  assert.equal(r.eldaZeitstempel, '2026-07-25T07:00:00.000+02:00');
  assert.equal(r.meldung, 'OK');
});

test('empfangen: pretty-printed Antwort — datei-Felder und payload werden getrimmt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(`<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/">
    <return>
      <serviceResult>
        <messages>
          OK
        </messages>
        <statusCode>
          000
        </statusCode>
      </serviceResult>
      <datei>
        <id>
          199565708
        </id>
        <name>
          mitteilung.xml
        </name>
        <dateiTyp>
          1
        </dateiTyp>
        <md5>
          abc
        </md5>
        <payload>
          ${b64}
        </payload>
      </datei>
    </return>
  </ns2:empfangenResponse>`);
  const elda = createEldaTransfer(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('155764332');
  assert.equal(r.statusCode, '000');
  assert.equal(r.ok, true);
  assert.equal(r.datei?.id, '199565708');
  assert.equal(r.datei?.name, 'mitteilung.xml');
  assert.equal(r.datei?.dateiTyp, 1);
  assert.equal(r.datei?.md5, 'abc');
  assert.equal(r.datei?.inhalt.toString('utf8'), '<protokoll/>');
});

// --- M8: Passwort-Hash und Header auf der Leitung --------------------------

const sendenOk = (inner = '') =>
  soap(
    `<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult>${inner}</return></ns2:sendenResponse>`,
  );

test('senden: Kundenpasswort geht nur SHA-512-gehasht auf die Leitung, nie im Klartext', async () => {
  let body = '';
  const elda = createEldaTransfer({
    seriennummer: 'S1',
    kundenpasswort: 'geheim',
    apiKey: 'K1',
    umgebung: 'kundentest',
    transport: {
      fetchImpl: (async (_u: string, init: { body: string }) => {
        body = init.body;
        return new Response(sendenOk(), { status: 200 });
      }) as unknown as typeof fetch,
    },
  });
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  const hash = createHash('sha512').update('geheim', 'utf8').digest('hex');
  assert.ok(body.includes(`<kundenpasswort>${hash}</kundenpasswort>`), 'SHA-512-Hex fehlt im Request');
  assert.ok(!body.includes('geheim'), 'Klartext-Passwort steht im Request');
  // alle fünf securityParameters, in der von ELDA erwarteten Reihenfolge
  assert.match(
    body,
    /<securityParameters><apiKey>K1<\/apiKey><created>[^<]+<\/created><kundenpasswort>[0-9a-f]{128}<\/kundenpasswort><nonce>[^<]+<\/nonce><seriennummer>S1<\/seriennummer><\/securityParameters>/,
  );
});

test('senden: SOAPAction und Content-Type der Anfrage (Status 559 = unerlaubter Content-Type)', async () => {
  let headers: Record<string, string> = {};
  const elda = createEldaTransfer(
    cfg(async (_u: string, init: { headers: Record<string, string> }) => {
      headers = init.headers;
      return new Response(sendenOk(), { status: 200 });
    }),
  );
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(headers['Content-Type'], 'text/xml; charset=utf-8');
  assert.equal(headers['SOAPAction'], '"senden"');
});

// --- I4: Wiederholung mit frischem nonce ----------------------------------

const nonceVon = (body: string) => /<nonce>([^<]+)<\/nonce>/.exec(body)?.[1];

const retryCfg = (retries: number, fetchImpl: unknown): EldaConfig => ({
  seriennummer: 'S1',
  kundenpasswort: 'p',
  apiKey: 'K1',
  umgebung: 'kundentest',
  transport: { retries, fetchImpl: fetchImpl as typeof fetch },
});

test('retry: zweiter Versuch trägt einen FRISCHEN nonce (kein 552-Replay)', async () => {
  const bodies: string[] = [];
  let n = 0;
  const elda = createEldaTransfer(
    retryCfg(1, async (_u: string, init: { body: string }) => {
      bodies.push(init.body);
      n++;
      if (n === 1) throw new Error('ECONNRESET');
      return new Response(sendenOk('<protokollnummer>155764331</protokollnummer>'), { status: 200 });
    }),
  );
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.ok, true);
  assert.equal(r.protokollnummer, '155764331');
  assert.equal(bodies.length, 2);
  assert.ok(nonceVon(bodies[0]!), 'erster Request hat keinen nonce');
  assert.notEqual(nonceVon(bodies[0]!), nonceVon(bodies[1]!));
});

test('retry: erschöpfte Versuche werfen FonTransportError', async () => {
  let n = 0;
  const elda = createEldaTransfer(
    retryCfg(1, async () => {
      n++;
      throw new Error('ECONNRESET');
    }),
  );
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonTransportError,
  );
  assert.equal(n, 2); // 1 Versuch + 1 Wiederholung
});

test('retry: fachlicher Status-Code wird NICHT wiederholt', async () => {
  let n = 0;
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>fehlerCode: E1</messages><statusCode>403</statusCode></serviceResult></return></ns2:sendenResponse>',
  );
  const elda = createEldaTransfer(
    retryCfg(2, async () => {
      n++;
      return new Response(resp, { status: 200 });
    }),
  );
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.statusCode, '403');
  assert.equal(n, 1);
});

test('retry: SOAP-Fault wird NICHT wiederholt', async () => {
  let n = 0;
  const fault = soap(
    '<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Boom</faultstring></soap:Fault>',
  );
  const elda = createEldaTransfer(
    retryCfg(2, async () => {
      n++;
      return new Response(fault, { status: 500 });
    }),
  );
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonSoapFaultError,
  );
  assert.equal(n, 1);
});
