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
