import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, firstChild, childText, findDescendant } from './parse';

test('parst verschachtelte Elemente und Textinhalte', () => {
  const root = parseXml('<a><b>hallo</b><c>welt</c></a>');
  assert.equal(root.name, 'a');
  assert.equal(childText(root, 'b'), 'hallo');
  assert.equal(childText(root, 'c'), 'welt');
});

test('überspringt XML-Deklaration und Kommentare', () => {
  const root = parseXml('<?xml version="1.0"?><!-- Kommentar --><a><b>x</b></a>');
  assert.equal(root.name, 'a');
  assert.equal(childText(root, 'b'), 'x');
});

test('trennt Namespace-Präfix vom lokalen Namen ab', () => {
  const root = parseXml(
    '<soapenv:Envelope xmlns:soapenv="urn:x"><soapenv:Body><loginResponse><id>S1</id></loginResponse></soapenv:Body></soapenv:Envelope>',
  );
  assert.equal(root.name, 'Envelope');
  assert.equal(root.prefix, 'soapenv');
  const resp = findDescendant(root, 'loginResponse');
  assert.ok(resp);
  assert.equal(childText(resp, 'id'), 'S1');
});

test('dekodiert Entities in Textinhalten', () => {
  const root = parseXml('<a>a &amp; b &lt; c &#65; &#x42;</a>');
  assert.equal(root.text, 'a & b < c A B');
});

test('lässt numerische Entity außerhalb des Unicode-Bereichs unverändert statt zu werfen', () => {
  const root = parseXml('<a>&#99999999;</a>');
  assert.equal(root.text, '&#99999999;');
});

test('verarbeitet selbstschließende Elemente', () => {
  const root = parseXml('<a><b/><c>x</c></a>');
  assert.equal(root.children.length, 2);
  assert.equal(firstChild(root, 'b')?.children.length, 0);
  assert.equal(childText(root, 'c'), 'x');
});

test('liest Attribute inklusive Entity-Dekodierung', () => {
  const root = parseXml('<a b="1" c="x &amp; y">t</a>');
  assert.equal(root.attrs['b'], '1');
  assert.equal(root.attrs['c'], 'x & y');
});

test('behandelt CDATA als Rohtext', () => {
  const root = parseXml('<a><![CDATA[<nicht &amp; geparst>]]></a>');
  assert.equal(root.text, '<nicht &amp; geparst>');
});

test('findet Attributende auch bei > im Attributwert', () => {
  const root = parseXml('<a b="1 > 0">t</a>');
  assert.equal(root.attrs['b'], '1 > 0');
  assert.equal(root.text, 't');
});

test('wirft bei nicht geschlossenem Tag', () => {
  assert.throws(() => parseXml('<a><b></a>'), /Mismatched|Unterminated/);
});

test('wirft bei fehlendem Wurzelelement', () => {
  assert.throws(() => parseXml('<!-- nur ein Kommentar -->'), /No root element/);
});
