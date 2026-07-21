import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXmlText } from './escape';

test('maskiert Ampersand zuerst, dann Klammern', () => {
  assert.equal(escapeXmlText('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
});

test('erzeugt keine doppelte Maskierung', () => {
  assert.equal(escapeXmlText('&amp;'), '&amp;amp;');
});

test('lässt harmlosen Text unverändert', () => {
  assert.equal(escapeXmlText('KASSE-001'), 'KASSE-001');
});
