'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baueEldaEnvelope } = require('../../../dist/envelope.js');
const {
  setzeElement,
  leereElement,
  entferneElement,
  setzeHeader,
  kette,
  elementWert,
} = require('./manipulation');

const SECURITY = {
  apiKey: 'K1',
  created: '2026-10-05T05:30:00.000Z',
  kundenpasswort: 'a'.repeat(128),
  nonce: 'n-1',
  seriennummer: '1234567',
};

function anfrage() {
  return {
    body: baueEldaEnvelope('senden', SECURITY, [
      { name: 'dateiName', value: 'a.dat' },
      { name: 'payload', value: 'QUJD' },
    ]),
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
  };
}

test('setzeElement ersetzt den ersten Wert und escaped', () => {
  const neu = setzeElement('nonce', 'x<y&z')(anfrage());
  assert.match(neu.body, /<nonce>x&lt;y&amp;z<\/nonce>/);
  assert.equal(elementWert(neu.body, 'nonce'), 'x&lt;y&amp;z');
});

test('leereElement und entferneElement', () => {
  assert.match(leereElement('created')(anfrage()).body, /<created><\/created>/);
  const ohne = entferneElement('created')(anfrage()).body;
  assert.doesNotMatch(ohne, /created/);
  assert.match(ohne, /<apiKey>K1<\/apiKey><kundenpasswort>/);
});

test('nur die erste Fundstelle wird verändert', () => {
  const doppelt = { body: '<a><nonce>1</nonce><nonce>2</nonce></a>', headers: {} };
  assert.equal(setzeElement('nonce', '9')(doppelt).body, '<a><nonce>9</nonce><nonce>2</nonce></a>');
});

test('fehlendes Element ist ein Fehler, keine stille Nicht-Änderung', () => {
  assert.throws(() => setzeElement('protokollnummer', '1')(anfrage()), /protokollnummer/);
});

test('setzeHeader überschreibt nur den einen Header', () => {
  const neu = setzeHeader('Content-Type', 'application/xml')(anfrage());
  assert.deepEqual(neu.headers, { 'Content-Type': 'application/xml', SOAPAction: '""' });
});

test('kette wendet nacheinander an, das Original bleibt unverändert', () => {
  const original = anfrage();
  const kopie = JSON.parse(JSON.stringify(original));
  const neu = kette(leereElement('nonce'), setzeHeader('SOAPAction', '"senden"'))(original);
  assert.match(neu.body, /<nonce><\/nonce>/);
  assert.equal(neu.headers.SOAPAction, '"senden"');
  assert.deepEqual(original, kopie);
});

test('elementWert liefert undefined, wenn das Element fehlt', () => {
  assert.equal(elementWert('<a></a>', 'nonce'), undefined);
});
