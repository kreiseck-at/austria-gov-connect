import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUidBescheid } from './bescheid';

// Echter FON-UID-Bescheid aus der DataBox (BMF-Testzugang, erltyp=P/anbringen=UID,
// redigierte Musterdaten). Attribut-basiertes Format, eigenes Schema.
const BESCHEID =
  '<?xml version="1.0" encoding="UTF-8" ?>\n' +
  '<Bestaetigungen Datum="20160207" ATUID="ATU99999999" Name="Muster GmbH" FAStNr="99 999/9999" TMS="2016-02-08-00.04.12.461000">\n' +
  '\t<Bestaetigung UID="ATU10244500" Stufe="2" gueltig="J" />\n' +
  '\t<Bestaetigung UID="ATU10397505" Stufe="2" gueltig="J" />\n' +
  '\t<Bestaetigung UID="ATU10779807" Stufe="1" gueltig="N" />\n' +
  '</Bestaetigungen>';

test('parseUidBescheid: Kopfdaten (Datum/ATUID/Name/FAStNr)', () => {
  const b = parseUidBescheid(BESCHEID);
  assert.equal(b.datum, '20160207');
  assert.equal(b.antragsteller, 'ATU99999999');
  assert.equal(b.name, 'Muster GmbH');
  assert.equal(b.fastnr, '99 999/9999');
  assert.equal(b.tms, '2016-02-08-00.04.12.461000');
});

test('parseUidBescheid: einzelne Bestätigungen mit gueltig J/N -> boolean', () => {
  const b = parseUidBescheid(BESCHEID);
  assert.equal(b.bestaetigungen.length, 3);
  assert.deepEqual(b.bestaetigungen[0], { uid: 'ATU10244500', stufe: '2', gueltig: true });
  assert.equal(b.bestaetigungen[2]?.uid, 'ATU10779807');
  assert.equal(b.bestaetigungen[2]?.stufe, '1');
  assert.equal(b.bestaetigungen[2]?.gueltig, false);
});

test('parseUidBescheid: fremdes/leeres XML -> leere Bestätigungen, kein Wurf', () => {
  const b = parseUidBescheid('<foo/>');
  assert.deepEqual(b.bestaetigungen, []);
  assert.equal(b.antragsteller, undefined);
});
