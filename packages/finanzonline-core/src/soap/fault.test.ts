import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from './parse';
import { detectFault } from './fault';

const OK = parseXml(
  '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body><loginResponse><rc>0</rc></loginResponse></soapenv:Body></soapenv:Envelope>',
);

const FAULT = parseXml(
  '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body><soapenv:Fault>' +
    '<faultcode>soapenv:Server</faultcode>' +
    '<faultstring>Interner Fehler</faultstring>' +
    '<detail>Stacktrace</detail>' +
    '</soapenv:Fault></soapenv:Body></soapenv:Envelope>',
);

test('gibt bei fehlerfreier Antwort undefined zurück', () => {
  assert.equal(detectFault(OK), undefined);
});

test('erkennt SOAP-Fault und extrahiert Felder', () => {
  const fault = detectFault(FAULT);
  assert.ok(fault);
  assert.equal(fault.faultcode, 'soapenv:Server');
  assert.equal(fault.faultstring, 'Interner Fehler');
  assert.equal(fault.detail, 'Stacktrace');
});

// Echter FON-Validierungs-Fault (Testmodus): der nützliche Text steckt in einem
// verschachtelten <fon:ValidationError> im detail, nicht als direkter Text.
const VALIDATION_FAULT = parseXml(
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body><SOAP-ENV:Fault>' +
    '<faultcode>SOAP-ENV:Client</faultcode>' +
    '<faultstring xml:lang="en">Validation error</faultstring>' +
    '<detail><fon:ValidationError xmlns:fon="https://finanzonline.bmf.gv.at">' +
    "cvc-complex-type.2.4.a: Invalid content was found starting with element " +
    "'{&quot;https://finanzonline.bmf.gv.at/rkdb&quot;:art_uebermittlung}'. " +
    "One of '{&quot;https://finanzonline.bmf.gv.at/rkdb&quot;:tid}' is expected." +
    '</fon:ValidationError></detail>' +
    '</SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>',
);

test('extrahiert den Detailtext auch aus verschachteltem detail-Element', () => {
  const fault = detectFault(VALIDATION_FAULT);
  assert.ok(fault);
  assert.equal(fault.faultcode, 'SOAP-ENV:Client');
  assert.equal(fault.faultstring, 'Validation error');
  assert.match(fault.detail ?? '', /One of .*:tid.* is expected/);
});
