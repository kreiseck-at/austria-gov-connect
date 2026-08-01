import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FonProtocolError, FonSoapFaultError, FonTransportError } from '@kreiseck/finanzonline-core';
import { createEldaTransferRoh, type EldaConfig } from './transfer-roh';
import { ELDA_ENDPOINTS } from './endpoints';
import { EldaError, EldaProtocolError } from './errors';

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
  const elda = createEldaTransferRoh(cfg(fetchImpl));
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
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '403');
  assert.equal(r.meldung, 'fehlerCode: E1');
});

test('senden: umgebung "produktion" liefert den Produktions-Endpoint', async () => {
  let sentTo = '';
  const resp = soap(
    '<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult></return></ns2:sendenResponse>',
  );
  const elda = createEldaTransferRoh({
    seriennummer: 'S1',
    kundenpasswort: 'p',
    apiKey: 'K1',
    umgebung: 'produktion',
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
  const elda = createEldaTransferRoh({
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
  const elda = createEldaTransferRoh(cfg(async () => new Response(fault, { status: 500 })));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonSoapFaultError,
  );
});

test('senden: fehlendes <return>-Element wird laut als EldaProtocolError geworfen', async () => {
  const resp = soap('<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"></ns2:sendenResponse>');
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('ruecksendungenAuflisten: parst mehrere ruecksendungen + statusCode/ok', async () => {
  const resp = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><ruecksendungen><dateiName>fehler_155764331</dateiName><protokollnummer>155764332</protokollnummer></ruecksendungen><ruecksendungen><dateiName>ok_155764340</dateiName><protokollnummer>155764341</protokollnummer></ruecksendungen></return></ns2:ruecksendungenAuflistenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
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
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const erg = await elda.ruecksendungenAuflisten();
  assert.equal(erg.ok, false);
  assert.equal(erg.statusCode, '557');
  assert.equal(erg.meldung, 'API-Key ungültig');
  assert.deepEqual(erg.ruecksendungen, []);
});

const md5Von = (wert: string) => createHash('md5').update(Buffer.from(wert, 'utf8')).digest('hex');

test('empfangen: parst statusCode + datei-Metadaten + inline base64 inhalt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>199565708</id><name>mitteilung.xml</name><dateiTyp>1</dateiTyp><md5>${md5Von('<protokoll/>')}</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  let body = '';
  const elda = createEldaTransferRoh(
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
  assert.equal(r.datei?.dateiTyp, '1'); // C2
  assert.equal(r.datei?.md5, md5Von('<protokoll/>'));
  assert.equal(r.datei?.inhalt.toString('utf8'), '<protokoll/>');
});

test('empfangen: nicht vorhanden -> ok:false, kein datei', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>Keine Rücksendung mit Protokollnummer 1 vorhanden.</messages><statusCode>406</statusCode></serviceResult></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, '406');
  assert.equal(r.datei, undefined);
});

test('empfangen: nicht-numerischer dateiTyp ("XML") bleibt erhalten statt verworfen zu werden', async () => {
  // Bewusste Umkehr einer früheren Erwartung (`dateiTyp === undefined`): Die Beispiel-Ausgabe
  // der Spec zeigt in 7.4.3.3 wörtlich `Node dateiTyp with value XML`, während die Tabelle in
  // 4.2 „Integer" nennt. Das Dokument widerspricht sich; der Wert wird deshalb unverändert als
  // Text durchgereicht, statt einen von ELDA tatsächlich gesendeten Wert stillschweigend
  // wegzuwerfen.
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><dateiTyp>XML</dateiTyp><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.datei?.dateiTyp, 'XML');
});

test('empfangen: fehlender dateiTyp bleibt undefined', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.datei?.dateiTyp, undefined);
});

// Eine XOP-Referenz OHNE den zugehoerigen Teil: das kommt vor, wenn die Antwort
// gar nicht mehrteilig war oder der Teil fehlt. Aufgeloest wird dann nichts --
// aber ein leerer Buffer waere eine Luege ueber eine bereits verbrauchte
// Zustellung. Der Erfolgsfall steht weiter unten unter "MTOM:".
test('empfangen: XOP-Referenz ohne den zugehoerigen Teil wirft, statt leeres Buffer zu liefern', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:abc@elda.at"/></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('empfangen: unaufloesbare XOP-Referenz — ergebnis trägt Status, Meldung und Datei-Metadaten', async () => {
  // ELDA hat die einmalige Zustellung zu diesem Zeitpunkt bereits verbraucht — die Bytes sind
  // nicht zu retten, aber statusCode/meldung/id/name/md5 dürfen dem Aufrufer nicht verloren gehen.
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>199565708</id><name>mitteilung.xml</name><md5>abc</md5><payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:abc@elda.at"/></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      const ergebnis = err.ergebnis as {
        statusCode: string;
        meldung?: string;
        datei?: { id?: string; name?: string; md5?: string; inhalt?: unknown };
      };
      assert.equal(ergebnis.statusCode, '000');
      assert.equal(ergebnis.meldung, 'OK');
      assert.equal(ergebnis.datei?.id, '199565708');
      assert.equal(ergebnis.datei?.name, 'mitteilung.xml');
      assert.equal(ergebnis.datei?.md5, 'abc');
      assert.equal(ergebnis.datei?.inhalt, undefined); // Teil fehlt — kein Inhalt vorgetäuscht
      return true;
    },
  );
});

test('empfangen: leerer Payload bei statusCode 000 wirft statt eine leere Datei vorzutäuschen', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('empfangen: leerer Payload bei 000 — ergebnis trägt Status und die bereits gelesenen Datei-Metadaten', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      const ergebnis = err.ergebnis as { statusCode: string; datei?: { id?: string; name?: string } };
      assert.equal(ergebnis.statusCode, '000');
      assert.equal(ergebnis.datei?.id, '1');
      assert.equal(ergebnis.datei?.name, 'x.xml');
      return true;
    },
  );
});

test('empfangen: fehlendes <return>-Element wird laut als EldaProtocolError geworfen', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
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
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof EldaProtocolError,
  );
});

test('empfangen: <serviceResult> ohne <statusCode> wirft ebenfalls', async () => {
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages></serviceResult></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
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
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
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
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
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
          ${md5Von('<protokoll/>')}
        </md5>
        <payload>
          ${b64}
        </payload>
      </datei>
    </return>
  </ns2:empfangenResponse>`);
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('155764332');
  assert.equal(r.statusCode, '000');
  assert.equal(r.ok, true);
  assert.equal(r.datei?.id, '199565708');
  assert.equal(r.datei?.name, 'mitteilung.xml');
  assert.equal(r.datei?.dateiTyp, '1');
  assert.equal(r.datei?.md5, md5Von('<protokoll/>'));
  assert.equal(r.datei?.inhalt.toString('utf8'), '<protokoll/>');
});

// --- M8: Passwort-Hash und Header auf der Leitung --------------------------

const sendenOk = (inner = '') =>
  soap(
    `<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult>${inner}</return></ns2:sendenResponse>`,
  );

test('senden: Kundenpasswort geht nur SHA-512-gehasht auf die Leitung, nie im Klartext', async () => {
  let body = '';
  const elda = createEldaTransferRoh({
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

test('senden: kundenpasswortHash ergibt denselben Request wie das Klartextpasswort', async () => {
  const request = async (zugang: Record<string, string>): Promise<string> => {
    let body = '';
    const elda = createEldaTransferRoh({
      seriennummer: 'S1',
      apiKey: 'K1',
      umgebung: 'kundentest',
      transport: {
        fetchImpl: (async (_u: string, init: { body: string }) => {
          body = init.body;
          return new Response(sendenOk(), { status: 200 });
        }) as unknown as typeof fetch,
      },
      ...zugang,
    } as EldaConfig);
    await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
    // nonce und created sind je Request frisch — für den Vergleich neutralisiert.
    return body
      .replace(/<nonce>[^<]*<\/nonce>/, '<nonce>N</nonce>')
      .replace(/<created>[^<]*<\/created>/, '<created>C</created>');
  };
  const hash = createHash('sha512').update('geheim', 'utf8').digest('hex');
  const ausKlartext = await request({ kundenpasswort: 'geheim' });
  const ausHash = await request({ kundenpasswortHash: hash });
  assert.equal(ausHash, ausKlartext);
  assert.ok(ausHash.includes(`<kundenpasswort>${hash}</kundenpasswort>`));
});

test('createEldaTransferRoh wirft beim Bauen, wenn der Passwortanteil nicht eindeutig ist', () => {
  const basis = { seriennummer: 'S1', apiKey: 'K1', umgebung: 'kundentest' as const };
  const hash = createHash('sha512').update('geheim', 'utf8').digest('hex');
  // weder Klartext noch Hash
  assert.throws(() => createEldaTransferRoh(basis as never), EldaError);
  // beide zugleich
  assert.throws(
    () => createEldaTransferRoh({ ...basis, kundenpasswort: 'geheim', kundenpasswortHash: hash } as never),
    EldaError,
  );
  // Hash in falscher Form — vor dem ersten Netzaufruf, nicht erst als Status 558
  assert.throws(
    () => createEldaTransferRoh({ ...basis, kundenpasswortHash: hash.toUpperCase() } as never),
    EldaError,
  );
});

// Die SOAPAction ist LEER, nicht der Methodenname. Die WSDL des Dienstes gibt
// bei allen drei Operationen `soapAction=""` vor; mit dem Methodennamen
// antwortet ELDA mit HTTP 500 und dem Fault „The given SOAPAction senden does
// not match an operation." — nachgestellt gegen online-test.elda.at am
// 31.07.2026. Dieser Test hielt zuvor die falsche Annahme fest.
test('senden: SOAPAction ist leer, Content-Type text/xml (Status 559 = unerlaubter Content-Type)', async () => {
  let headers: Record<string, string> = {};
  const elda = createEldaTransferRoh(
    cfg(async (_u: string, init: { headers: Record<string, string> }) => {
      headers = init.headers;
      return new Response(sendenOk(), { status: 200 });
    }),
  );
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(headers['Content-Type'], 'text/xml; charset=utf-8');
  assert.equal(headers['SOAPAction'], '""');
});

test('alle drei Methoden senden eine leere SOAPAction', async () => {
  const gesehen: string[] = [];
  const elda = createEldaTransferRoh(
    cfg(async (_u: string, init: { headers: Record<string, string> }) => {
      gesehen.push(init.headers['SOAPAction'] ?? '<fehlt>');
      return new Response(sendenOk(), { status: 200 });
    }),
  );
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  await elda.ruecksendungenAuflisten();
  assert.deepEqual(gesehen, ['""', '""']);
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

const createdVon = (body: string) => /<created>([^<]+)<\/created>/.exec(body)?.[1];

test('retry: zweiter Versuch trägt FRISCHEN nonce UND frisches created (kein 552/551)', async () => {
  const bodies: string[] = [];
  let n = 0;
  const elda = createEldaTransferRoh(
    retryCfg(1, async (_u: string, init: { body: string }) => {
      bodies.push(init.body);
      n++;
      if (n === 1) {
        // Kurz warten, damit sich `created` (Millisekunden-Auflösung) messbar unterscheidet.
        await new Promise((r) => setTimeout(r, 5));
        throw new Error('ECONNRESET');
      }
      return new Response(sendenOk('<protokollnummer>155764331</protokollnummer>'), { status: 200 });
    }),
  );
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.ok, true);
  assert.equal(r.protokollnummer, '155764331');
  assert.equal(bodies.length, 2);
  assert.ok(nonceVon(bodies[0]!), 'erster Request hat keinen nonce');
  assert.notEqual(nonceVon(bodies[0]!), nonceVon(bodies[1]!));
  // `created` muss ebenfalls neu sein: ELDA weist einen Request mit einem `created` älter
  // als 60 Sekunden mit 551 ab. Ein Umbau, der nur den nonce erneuert und `created` aus dem
  // ersten Versuch weiterreicht, käme unit-getestet durch und fiele erst live auf.
  assert.ok(createdVon(bodies[0]!), 'erster Request hat kein created');
  assert.notEqual(createdVon(bodies[0]!), createdVon(bodies[1]!));
});

test('retry: erschöpfte Versuche werfen FonTransportError', async () => {
  let n = 0;
  const elda = createEldaTransferRoh(
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
  const elda = createEldaTransferRoh(
    retryCfg(2, async () => {
      n++;
      return new Response(resp, { status: 200 });
    }),
  );
  const r = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.statusCode, '403');
  assert.equal(n, 1);
});

test('retry: retries NaN (z. B. unbesetzte Env-Variable) läuft NICHT endlos, sondern genau ein Versuch', async () => {
  let n = 0;
  const elda = createEldaTransferRoh(
    retryCfg(Number(process.env.ELDA_RETRIES_UNSET_XYZ), async () => {
      n++;
      throw new Error('ECONNRESET');
    }),
  );
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonTransportError,
  );
  assert.equal(n, 1);
});

test('retry: retries Infinity wird wie 0 behandelt (kein Endlos-Retry)', async () => {
  let n = 0;
  const elda = createEldaTransferRoh(
    retryCfg(Infinity, async () => {
      n++;
      throw new Error('ECONNRESET');
    }),
  );
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonTransportError,
  );
  assert.equal(n, 1);
});

test('retry: negative retries werden wie 0 behandelt', async () => {
  let n = 0;
  const elda = createEldaTransferRoh(
    retryCfg(-1, async () => {
      n++;
      throw new Error('ECONNRESET');
    }),
  );
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => err instanceof FonTransportError,
  );
  assert.equal(n, 1);
});

test('retry: SOAP-Fault wird NICHT wiederholt', async () => {
  let n = 0;
  const fault = soap(
    '<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Boom</faultstring></soap:Fault>',
  );
  const elda = createEldaTransferRoh(
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

// --- H1: `empfangen` wird NIE automatisch wiederholt -----------------------

test('retry: empfangen wird trotz retries NICHT wiederholt (einmalige Zustellung)', async () => {
  // Der Kern des Problems: ELDA verbucht die Rücksendung als abgeholt und beginnt zu
  // liefern; bricht die Übertragung ab, wüsste ein zweiter Versuch nur noch 408 zu melden —
  // und der Aufrufer hielte den selbst verursachten Verlust für einen fremden Abruf.
  let n = 0;
  const elda = createEldaTransferRoh(
    retryCfg(3, async () => {
      n++;
      throw new Error('ECONNRESET');
    }),
  );
  await assert.rejects(
    () => elda.empfangen('155764332'),
    (err: unknown) => err instanceof FonTransportError,
  );
  assert.equal(n, 1, 'empfangen darf genau einmal auf die Leitung gehen');
});

test('retry: senden und ruecksendungenAuflisten werden weiterhin wiederholt', async () => {
  // Gegenprobe: Die Abschaltung gilt nur für empfangen. Ein doppelt angekommenes `senden`
  // beantwortet ELDA mit 405 (Duplikat), `ruecksendungenAuflisten` verändert nichts.
  let nSenden = 0;
  await createEldaTransferRoh(
    retryCfg(1, async () => {
      nSenden++;
      if (nSenden === 1) throw new Error('ECONNRESET');
      return new Response(sendenOk(), { status: 200 });
    }),
  ).senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(nSenden, 2);

  let nListe = 0;
  const listeOk = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult></return></ns2:ruecksendungenAuflistenResponse>',
  );
  await createEldaTransferRoh(
    retryCfg(1, async () => {
      nListe++;
      if (nListe === 1) throw new Error('ECONNRESET');
      return new Response(listeOk, { status: 200 });
    }),
  ).ruecksendungenAuflisten();
  assert.equal(nListe, 2);
});

test('timeoutMs deckt auch den Body-Download ab — und empfangen wiederholt auch dann nicht', async () => {
  // Belegt die Prämisse hinter H1: Das Zeitlimit von callSoap umfasst `await res.text()`.
  // Ein Abbruch beim Herunterladen eines großen Protokolls ist deshalb von einem
  // folgenlosen Verbindungsfehler nicht zu unterscheiden.
  let n = 0;
  const fetchImpl = (async (_u: string, init: { signal: AbortSignal }) => {
    n++;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Antwort beginnt (Header sind da, Body läuft), endet aber nie von selbst.
        controller.enqueue(new TextEncoder().encode('<soap:Envelope>'));
        init.signal.addEventListener('abort', () => controller.error(new Error('aborted')), {
          once: true,
        });
      },
    });
    return new Response(stream, { status: 200 });
  }) as unknown as typeof fetch;
  const elda = createEldaTransferRoh({
    seriennummer: 'S1',
    kundenpasswort: 'p',
    apiKey: 'K1',
    umgebung: 'kundentest',
    transport: { timeoutMs: 20, retries: 3, fetchImpl },
  });
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => err instanceof FonTransportError && /Zeitüberschreitung/.test(err.message),
  );
  assert.equal(n, 1);
});

test('ohne timeoutMs gilt die großzügige Vorgabe (30 s) — eine langsame Antwort läuft durch', async () => {
  const fetchImpl = (async () => {
    await new Promise((r) => setTimeout(r, 60));
    return new Response(sendenOk('<protokollnummer>1</protokollnummer>'), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await createEldaTransferRoh(cfg(fetchImpl)).senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(r.protokollnummer, '1');
});

// --- H2: echte MTOM-Antwort — die Bytes bleiben über err.rohantwort erreichbar

test('empfangen: multipart/related-Antwort scheitert im Parser, der Body bleibt erhalten', async () => {
  // Die Schnittstellenbeschreibung sagt in 4.2 und 7.4.3.3, dass der Payload als Attachment
  // kommt; dieser Client kann nur inline-Base64. Die Zustellung ist dann bereits verbraucht —
  // der ungeparste Body ist die letzte Stelle, an der die Protokoll-Bytes noch existieren.
  const nutzdaten = '<protokoll>Verarbeitungsergebnis</protokoll>';
  const body =
    '--MIMEBoundary_abc\r\n' +
    'Content-Type: application/xop+xml; charset=UTF-8; type="text/xml"\r\n' +
    'Content-ID: <root.message@elda.at>\r\n\r\n' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>' +
    '<serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult>' +
    '<datei><id>1</id><name>mitteilung.xml</name>' +
    '<payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:payload"/></payload>' +
    '</datei></return></ns2:empfangenResponse></soap:Body></soap:Envelope>\r\n' +
    '--MIMEBoundary_abc\r\n' +
    'Content-Type: application/octet-stream\r\n' +
    'Content-ID: <payload>\r\n\r\n' +
    nutzdaten +
    '\r\n--MIMEBoundary_abc--\r\n';
  const elda = createEldaTransferRoh(cfg(async () => new Response(body, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof FonProtocolError, 'erwartet FonProtocolError aus dem Transport');
      assert.ok(!(err instanceof EldaError));
      assert.equal(err.rohantwort, body);
      assert.ok(err.rohantwort!.includes(nutzdaten), 'die Protokoll-Bytes stecken im rohen Body');
      // Der Body darf nicht ungefragt in Logs landen (personenbezogene Daten).
      assert.ok(!err.message.includes(nutzdaten));
      return true;
    },
  );
});

// --- M1: Base64-Wohlgeformtheit und MD5-Abgleich ---------------------------

test('empfangen: <payload>cid:…</payload> (SoapUI-Darstellung, Spec 7.4.1.2) wirft statt Müll zu liefern', async () => {
  // "cid:1526066113758" besteht bis auf den Doppelpunkt aus gültigen Base64-Zeichen —
  // Buffer.from würde ':' überspringen und einen Erfolg mit falschen Bytes melden.
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload>cid:1526066113758</payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /Base64/);
      const ergebnis = err.ergebnis as { rohPayload?: string; datei?: { id?: string } };
      assert.equal(ergebnis.rohPayload, 'cid:1526066113758');
      assert.equal(ergebnis.datei?.id, '1');
      return true;
    },
  );
});

test('empfangen: abgeschnittenes Base64 wirft (Node akzeptiert es sonst klaglos)', async () => {
  const voll = Buffer.from('<protokoll>abcdefghij</protokoll>').toString('base64');
  const abgeschnitten = voll.slice(0, voll.length - 3); // Länge nicht mehr durch 4 teilbar
  assert.notEqual(abgeschnitten.length % 4, 0);
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><payload>${abgeschnitten}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.equal((err.ergebnis as { rohPayload?: string }).rohPayload, abgeschnitten);
      return true;
    },
  );
});

test('empfangen: MD5-Abweichung wirft — der Inhalt bleibt über den Fehler erreichbar', async () => {
  const inhalt = '<protokoll/>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><name>x.xml</name><md5>${md5Von('etwas ganz anderes')}</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /MD5-Abweichung/);
      const ergebnis = err.ergebnis as { datei?: { inhalt?: Buffer }; rohPayload?: string };
      assert.equal(ergebnis.datei?.inhalt?.toString('utf8'), inhalt);
      assert.equal(ergebnis.rohPayload, b64);
      return true;
    },
  );
});

test('empfangen: MD5 wird case-insensitiv verglichen (Groß-/Kleinschreibung von Hex)', async () => {
  const inhalt = '<protokoll/>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><md5>${md5Von(inhalt).toUpperCase()}</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  const r = await elda.empfangen('1');
  assert.equal(r.datei?.inhalt.toString('utf8'), inhalt);
});

test('empfangen: ohne <md5> wird nichts geprüft, der Inhalt kommt unverändert durch', async () => {
  const inhalt = '<protokoll/>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  assert.equal((await elda.empfangen('1')).datei?.inhalt.toString('utf8'), inhalt);
});

test('empfangen: mehrzeiliges Base64 (RFC-2045-Umbruch) wird korrekt dekodiert und geprüft', async () => {
  const inhalt = '<protokoll>' + 'x'.repeat(200) + '</protokoll>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const umgebrochen = b64.replace(/(.{40})/g, '$1\n');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages><statusCode>000</statusCode></serviceResult><datei><id>1</id><md5>${md5Von(inhalt)}</md5><payload>${umgebrochen}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  assert.equal((await elda.empfangen('1')).datei?.inhalt.toString('utf8'), inhalt);
});

// --- M2: <datei> bleibt erhalten, auch wenn serviceResult unbrauchbar ist ---

test('empfangen: <datei> mit Inhalt, aber ohne statusCode — der Inhalt hängt am Fehler', async () => {
  const inhalt = '<protokoll>wichtig</protokoll>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>OK</messages></serviceResult><datei><id>199565708</id><name>mitteilung.xml</name><md5>${md5Von(inhalt)}</md5><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /statusCode/);
      const ergebnis = err.ergebnis as {
        meldung?: string;
        datei?: { id?: string; name?: string; inhalt?: Buffer };
      };
      assert.equal(ergebnis.meldung, 'OK');
      assert.equal(ergebnis.datei?.id, '199565708');
      assert.equal(ergebnis.datei?.name, 'mitteilung.xml');
      assert.equal(ergebnis.datei?.inhalt?.toString('utf8'), inhalt);
      return true;
    },
  );
});

test('empfangen: <datei> mit leerem <serviceResult/> — der Inhalt hängt ebenfalls am Fehler', async () => {
  const inhalt = '<protokoll/>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const resp = soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><statusCode>   </statusCode></serviceResult><datei><name>x.xml</name><payload>${b64}</payload></datei></return></ns2:empfangenResponse>`,
  );
  const elda = createEldaTransferRoh(cfg(async () => new Response(resp, { status: 200 })));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      const ergebnis = err.ergebnis as { datei?: { inhalt?: Buffer } };
      assert.equal(ergebnis.datei?.inhalt?.toString('utf8'), inhalt);
      return true;
    },
  );
});

// --- M4: Protokollnummer wird geprüft, bevor sie auf die Leitung geht -------

test('empfangen: leere/fehlende Protokollnummer wirft, ohne einen Request abzusetzen', async () => {
  let n = 0;
  const elda = createEldaTransferRoh(
    cfg(async () => {
      n++;
      return new Response(sendenOk(), { status: 200 });
    }),
  );
  for (const wert of ['', '   ', undefined as never, null as never, -1, 1.5, Number.NaN]) {
    await assert.rejects(
      () => elda.empfangen(wert),
      (err: unknown) => err instanceof EldaError && !(err instanceof EldaProtocolError),
      `sollte werfen: ${String(wert)}`,
    );
  }
  assert.equal(n, 0, 'kein Request darf auf die Leitung gegangen sein');
});

test('empfangen: numerische Protokollnummer und getrimmter String gehen unverändert auf die Leitung', async () => {
  const bodies: string[] = [];
  const resp = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult><messages>x</messages><statusCode>406</statusCode></serviceResult></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(
    cfg(async (_u: string, init: { body: string }) => {
      bodies.push(init.body);
      return new Response(resp, { status: 200 });
    }),
  );
  await elda.empfangen(155764332);
  await elda.empfangen('  155764333  ');
  assert.match(bodies[0]!, /<protokollnummer>155764332<\/protokollnummer>/);
  assert.match(bodies[1]!, /<protokollnummer>155764333<\/protokollnummer>/);
});

// --- MTOM/XOP: das tatsächliche Antwortformat des Dienstes ------------------
//
// ELDA (Apache CXF) antwortet IMMER als multipart/related, auch auf Fehler und
// auch ohne Binärdaten. Bis 0.4.1 gab der Client den Körper ungeöffnet an den
// Parser: der sah die '--uuid:…'-Grenzzeilen und warf "Unterminated element(s)
// in XML" — selbst bei einer völlig korrekten Antwort. Genau daran ist der
// erste Live-Aufruf gescheitert.

const GRENZE = 'uuid:ca65b474-251a-41c5-ae54-629726df1feb';
const MTOM_CT =
  `multipart/related; type="application/xop+xml"; boundary="${GRENZE}"; ` +
  'start="<root.message@cxf.apache.org>"; start-info="text/xml"';

/** Verpackt einen Envelope (und optionale Anhänge) so, wie CXF es tut. */
function alsMtom(envelope: string, anhaenge: { id: string; daten: Buffer }[] = []): Buffer {
  const stuecke: Buffer[] = [
    Buffer.from(
      `\r\n--${GRENZE}\r\n` +
        'Content-Type: application/xop+xml; charset=UTF-8; type="text/xml"\r\n' +
        'Content-Transfer-Encoding: binary\r\n' +
        'Content-ID: <root.message@cxf.apache.org>\r\n\r\n',
      'latin1',
    ),
    Buffer.from(envelope, 'utf8'),
  ];
  for (const a of anhaenge) {
    stuecke.push(
      Buffer.from(
        `\r\n--${GRENZE}\r\n` +
          'Content-Type: application/octet-stream\r\n' +
          'Content-Transfer-Encoding: binary\r\n' +
          `Content-ID: <${a.id}>\r\n\r\n`,
        'latin1',
      ),
      a.daten,
    );
  }
  stuecke.push(Buffer.from(`\r\n--${GRENZE}--\r\n`, 'latin1'));
  return Buffer.concat(stuecke);
}

const mtomAntwort = (envelope: string, anhaenge: { id: string; daten: Buffer }[] = [], status = 200) =>
  new Response(alsMtom(envelope, anhaenge), { status, headers: { 'content-type': MTOM_CT } });

test('MTOM: mehrteilige Antwort wird ausgepackt und ausgewertet', async () => {
  // Wörtlich die Antwort von online-test.elda.at am 31.07.2026 auf einen
  // Aufruf mit ungültigem API-Key.
  const envelope = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return><serviceResult>' +
      '<messages>API Key ungültig.</messages><statusCode>557</statusCode>' +
      '</serviceResult></return></ns2:ruecksendungenAuflistenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => mtomAntwort(envelope)));
  const r = await elda.ruecksendungenAuflisten();
  assert.equal(r.statusCode, '557');
  assert.equal(r.ok, false);
  assert.equal(r.meldung, 'API Key ungültig.');
});

test('MTOM: auch ein SOAP-Fault im Multipart wird erkannt (HTTP 500)', async () => {
  const fault = soap(
    '<soap:Fault><faultcode>soap:Server</faultcode>' +
      '<faultstring>The given SOAPAction x does not match an operation.</faultstring></soap:Fault>',
  );
  const elda = createEldaTransferRoh(cfg(async () => mtomAntwort(fault, [], 500)));
  await assert.rejects(() => elda.ruecksendungenAuflisten(), FonSoapFaultError);
});

test('MTOM: empfangen löst <xop:Include> gegen den passenden Teil auf', async () => {
  const inhalt = Buffer.from('R1\r\nR2 mit Umlaut ä\r\n', 'latin1');
  const envelope = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>' +
      '<serviceResult><statusCode>000</statusCode></serviceResult>' +
      '<datei><id>7</id><name>prot.txt</name>' +
      '<payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" ' +
      'href="cid:datei%40elda"/></payload></datei>' +
      '</return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(
    cfg(async () => mtomAntwort(envelope, [{ id: 'datei@elda', daten: inhalt }])),
  );
  const r = await elda.empfangen('155764331');
  assert.equal(r.ok, true);
  // Der Anhang ist bereits roh — er darf NICHT noch einmal base64-dekodiert werden.
  assert.deepEqual(r.datei?.inhalt, inhalt);
  assert.equal(r.datei?.name, 'prot.txt');
});

test('MTOM: die md5 wird auch auf dem XOP-Weg geprüft', async () => {
  const inhalt = Buffer.from('nutzdaten');
  const echt = createHash('md5').update(inhalt).digest('hex');
  const envelopeMit = (md5: string) =>
    soap(
      '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>' +
        '<serviceResult><statusCode>000</statusCode></serviceResult>' +
        `<datei><md5>${md5}</md5>` +
        '<payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:a"/></payload>' +
        '</datei></return></ns2:empfangenResponse>',
    );

  const gut = createEldaTransferRoh(
    cfg(async () => mtomAntwort(envelopeMit(echt), [{ id: 'a', daten: inhalt }])),
  );
  assert.deepEqual((await gut.empfangen('1')).datei?.inhalt, inhalt);

  const schlecht = createEldaTransferRoh(
    cfg(async () => mtomAntwort(envelopeMit('0'.repeat(32)), [{ id: 'a', daten: inhalt }])),
  );
  await assert.rejects(
    () => schlecht.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /MD5-Abweichung/);
      // Der Inhalt darf nicht verloren gehen, nur weil die Prüfsumme klemmt.
      const e = err.ergebnis as { datei?: { inhalt?: Buffer } };
      assert.deepEqual(e.datei?.inhalt, inhalt);
      return true;
    },
  );
});

test('MTOM: fehlender XOP-Teil wirft, statt eine leere Datei zu melden', async () => {
  const envelope = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>' +
      '<serviceResult><statusCode>000</statusCode></serviceResult>' +
      '<datei><id>7</id><payload><xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" ' +
      'href="cid:fehlt"/></payload></datei></return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => mtomAntwort(envelope)));
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /cid:fehlt/);
      const e = err.ergebnis as { statusCode?: string };
      assert.equal(e.statusCode, '000');
      return true;
    },
  );
});

test('MTOM: inline Base64 funktioniert weiterhin, auch im Multipart', async () => {
  const inhalt = Buffer.from('inline');
  const envelope = soap(
    '<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>' +
      '<serviceResult><statusCode>000</statusCode></serviceResult>' +
      `<datei><payload>${inhalt.toString('base64')}</payload></datei>` +
      '</return></ns2:empfangenResponse>',
  );
  const elda = createEldaTransferRoh(cfg(async () => mtomAntwort(envelope)));
  assert.deepEqual((await elda.empfangen('1')).datei?.inhalt, inhalt);
});

test('MTOM: unauspackbarer Multipart-Körper geht roh weiter (Payload bleibt am Fehler)', async () => {
  // Ohne boundary ist nichts zu zerlegen. Der rohe Körper muss den Aufrufer
  // erreichen — bei `empfangen` ist er die letzte Kopie der Nutzdaten.
  const roh = 'kein gueltiger multipart-koerper';
  const elda = createEldaTransferRoh(
    cfg(async () => new Response(roh, { status: 200, headers: { 'content-type': 'multipart/related' } })),
  );
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof FonProtocolError);
      assert.equal(err.rohantwort, roh);
      return true;
    },
  );
});

test('MTOM: nicht-mehrteilige Antworten bleiben unangetastet', async () => {
  const envelope = soap(
    '<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>' +
      '<serviceResult><statusCode>000</statusCode></serviceResult>' +
      '</return></ns2:ruecksendungenAuflistenResponse>',
  );
  const elda = createEldaTransferRoh(
    cfg(async () => new Response(envelope, { status: 200, headers: { 'content-type': 'text/xml' } })),
  );
  assert.equal((await elda.ruecksendungenAuflisten()).statusCode, '000');
});
