import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvelope } from './envelope';

const NS = 'https://finanzonline.bmf.gv.at/fon/ws/session';

test('baut vollständigen SOAP-1.1-Envelope mit Default-Namespace am Body-Element', () => {
  const xml = buildEnvelope({
    namespace: NS,
    bodyElement: 'loginRequest',
    fields: [
      { name: 'tid', value: 'ABCD1234' },
      { name: 'benid', value: 'benutzer' },
    ],
  });
  assert.equal(
    xml,
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soapenv:Body>' +
      `<loginRequest xmlns="${NS}">` +
      '<tid>ABCD1234</tid>' +
      '<benid>benutzer</benid>' +
      '</loginRequest>' +
      '</soapenv:Body>' +
      '</soapenv:Envelope>',
  );
});

test('erhält die Feldreihenfolge exakt', () => {
  const xml = buildEnvelope({
    namespace: NS,
    bodyElement: 'x',
    fields: [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
      { name: 'c', value: '3' },
    ],
  });
  assert.ok(xml.indexOf('<a>1</a>') < xml.indexOf('<b>2</b>'));
  assert.ok(xml.indexOf('<b>2</b>') < xml.indexOf('<c>3</c>'));
});

test('maskiert Sonderzeichen in Werten', () => {
  const xml = buildEnvelope({
    namespace: NS,
    bodyElement: 'x',
    fields: [{ name: 'pin', value: 'a&b<c' }],
  });
  assert.match(xml, /<pin>a&amp;b&lt;c<\/pin>/);
});
