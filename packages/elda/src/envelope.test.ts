import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueEldaEnvelope } from './envelope';

const sec = { apiKey: 'K1', created: 'C', kundenpasswort: 'H', nonce: 'N', seriennummer: 'S' };

test('baueEldaEnvelope: verschachtelte arg0/securityParameters-Struktur', () => {
  const xml = baueEldaEnvelope('senden', sec, [
    { name: 'dateiName', value: 'm.xml' },
    { name: 'payload', value: 'BASE64' },
  ]);
  assert.match(xml, /<v4:senden xmlns:v4="http:\/\/v4\.transfer\.ws\.elda\.at\/">/);
  assert.match(xml, /<arg0><securityParameters><apiKey>K1<\/apiKey><created>C<\/created><kundenpasswort>H<\/kundenpasswort><nonce>N<\/nonce><seriennummer>S<\/seriennummer><\/securityParameters><dateiName>m\.xml<\/dateiName><payload>BASE64<\/payload><\/arg0>/);
  assert.match(xml, /<\/v4:senden>/);
});

test('baueEldaEnvelope: keine Zusatzfelder (ruecksendungenAuflisten)', () => {
  const xml = baueEldaEnvelope('ruecksendungenAuflisten', sec, []);
  assert.match(xml, /<arg0><securityParameters>.*<\/securityParameters><\/arg0>/);
});

test('baueEldaEnvelope: escaped Sonderzeichen im Wert', () => {
  const xml = baueEldaEnvelope('senden', sec, [{ name: 'dateiName', value: 'a&b<c' }]);
  assert.match(xml, /<dateiName>a&amp;b&lt;c<\/dateiName>/);
});
