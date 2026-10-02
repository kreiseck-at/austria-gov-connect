'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const elda = require('../../../dist/index.js');
const {
  maskiereObus,
  setzeObusEin,
  maskiereText,
  ohneSeriennummer,
  formenDerSeriennummer,
  maskierePayloads,
  MASKE,
} = require('./maskierung');

const SERIENNUMMER = '654321';

function bestand() {
  const satz = elda.anmeldung({
    REFW: 'R1',
    BKNR: '1234567',
    DGNA: 'Musterbetrieb',
    VSNR: '1234010180',
    FANA: 'Muster',
    VONA: 'Max',
    ADAT: '01012025',
    BBER: '01',
    GERF: 'N',
    FRDV: 'N',
  });
  return elda.erstelleBestand([satz], {
    seriennummer: SERIENNUMMER,
    versicherungstraeger: '14',
    datentraegernummer: '000001',
    erstellt: new Date('2025-01-01T07:30:00+01:00'),
    testdaten: true,
    hersteller: {
      name: 'Muster',
      kfz: 'A',
      plz: '1010',
      ort: 'Wien',
      strasse: 'Musterstraße 1',
      mail: 'a@example.at',
    },
  });
}

test('maskiereObus: in keinem Satz steht die Seriennummer mehr, sonst ändert sich nichts', () => {
  const original = bestand();
  assert.ok(original.toString('latin1').includes('0654321'));
  const maskiert = maskiereObus(original, SERIENNUMMER);
  assert.equal(maskiert.length, original.length);
  assert.ok(!maskiert.toString('latin1').includes('654321'));
  for (const satz of maskiert.toString('latin1').split('\r\n')) assert.equal(satz.slice(11, 18), MASKE);
});

test('setzeObusEin stellt den Bestand byte-gleich wieder her – mit CRLF und mit LF', () => {
  const crlf = bestand();
  assert.ok(setzeObusEin(maskiereObus(crlf, SERIENNUMMER), SERIENNUMMER).equals(crlf));
  const lf = Buffer.from(crlf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  assert.ok(setzeObusEin(maskiereObus(lf, SERIENNUMMER), SERIENNUMMER).equals(lf));
});

test('ein fremdes OBUS bleibt stehen', () => {
  const fremd = Buffer.from('M3000000100ED1234567141234', 'latin1');
  assert.ok(maskiereObus(fremd, SERIENNUMMER).equals(fremd));
});

test('maskiereText: kurze und aufgefüllte Form, gleiche Länge, Anzahl', () => {
  const ein = Buffer.from('<seriennummer>654321</seriennummer> OBUS 0654321 Nr. 1654321x', 'latin1');
  const { bytes, anzahl } = maskiereText(ein, SERIENNUMMER);
  assert.equal(bytes.length, ein.length);
  assert.ok(!bytes.toString('latin1').includes('654321'));
  assert.equal(anzahl, 3);
});

test('formenDerSeriennummer: wie vergeben und als OBUS, längere zuerst', () => {
  assert.deepEqual(formenDerSeriennummer('654321'), ['0654321', '654321']);
  assert.deepEqual(formenDerSeriennummer('0654321'), ['0654321', '654321']);
  assert.deepEqual(formenDerSeriennummer('7654321'), ['7654321']);
});

test('maskiereText: auch in OBUS-Form hinterlegt, trifft sie die kurze Form', () => {
  const { bytes, anzahl } = maskiereText(Buffer.from('Nr. 654321 und 0654321', 'latin1'), '0654321');
  assert.equal(bytes.toString('latin1'), 'Nr. ****** und *******');
  assert.equal(anzahl, 2);
});

test('ohneSeriennummer: Dateinamen und andere Zeichenketten', () => {
  assert.equal(ohneSeriennummer('VR_654321_20250101.xml', SERIENNUMMER), 'VR_******_20250101.xml');
  assert.equal(ohneSeriennummer('ohne Nummer', SERIENNUMMER), 'ohne Nummer');
  assert.equal(ohneSeriennummer('', SERIENNUMMER), '');
});

test('maskierePayloads: Base64 im <payload> wird dekodiert, maskiert und wieder kodiert', () => {
  const inhalt = Buffer.from('OBUS 0654321, Nr. 654321', 'latin1');
  const xml = `<datei><name>x</name><payload>${inhalt.toString('base64')}</payload></datei>`;
  const { text, anzahl } = maskierePayloads(xml, SERIENNUMMER);
  assert.equal(anzahl, 2);
  const b64 = /<payload>([^<]*)<\/payload>/.exec(text)[1];
  assert.equal(Buffer.from(b64, 'base64').toString('latin1'), 'OBUS *******, Nr. ******');
  assert.ok(text.startsWith('<datei><name>x</name><payload>'));
});

test('maskierePayloads: ohne Treffer, mit cid-Verweis oder kaputtem Base64 bleibt alles byte-gleich', () => {
  for (const xml of [
    `<payload>${Buffer.from('nichts').toString('base64')}</payload>`,
    '<payload>cid:1526066113758</payload>',
    '<payload><xop:Include href="cid:a"/></payload>',
    '<payload>ABC</payload>',
    '<ns2:payload>@@@@</ns2:payload>',
  ]) {
    assert.deepEqual(maskierePayloads(xml, SERIENNUMMER), { text: xml, anzahl: 0 }, xml);
  }
});

test('maskiereText erreicht auch Base64 im <payload> einer rohen Antwort', () => {
  const b64 = Buffer.from('OBUS 0654321').toString('base64');
  const { bytes, anzahl } = maskiereText(
    Buffer.from(`<r><payload>${b64}</payload></r>`, 'latin1'),
    SERIENNUMMER,
  );
  assert.equal(anzahl, 1);
  const neu = /<payload>([^<]*)<\/payload>/.exec(bytes.toString('latin1'))[1];
  assert.equal(Buffer.from(neu, 'base64').toString('latin1'), 'OBUS *******');
});

test('unbrauchbare Seriennummer ist ein Fehler', () => {
  assert.throws(() => maskiereObus(bestand(), '12'), /6 oder 7 Ziffern/);
});
