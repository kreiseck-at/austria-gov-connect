import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rcInfo, rcIsOk, rcIsTechnical, RKDB_RC } from './returncodes';

test('"0" ist ok', () => {
  assert.equal(rcIsOk('0'), true);
  assert.equal(rcInfo('0').kind, 'ok');
});

test('-1 bis -4 sind technisch', () => {
  for (const rc of ['-1', '-2', '-3', '-4']) {
    assert.equal(rcIsTechnical(rc), true, rc);
    assert.equal(rcInfo(rc).kind, 'technisch', rc);
  }
});

test('B1 ist ein fachlicher Zustand mit Text', () => {
  assert.equal(rcInfo('B1').kind, 'fachlich');
  assert.match(rcInfo('B1').text, /bereits registriert/i);
  assert.equal(rcIsOk('B1'), false);
});

test('43 (Beleg fehlerhaft) ist fachlich', () => {
  assert.equal(rcInfo('43').kind, 'fachlich');
});

test('unbekannter rc wird nicht geraten, sondern als fachlich mit rohem Code durchgereicht', () => {
  const info = rcInfo('ZZ');
  assert.equal(info.kind, 'fachlich');
  assert.match(info.text, /ZZ/);
});

test('Tabelle enthält die verifizierten Codes vollständig', () => {
  for (const rc of ['0','-1','-2','-3','-4','4','5','6','7','8','9','13','14','27','28','29','30','31','32','36','41','43','998','999','1336','1337','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B13','B14','B15','B18','B19','B20','B21','B22','B28','B29','B30','B32','B33','B34','B35','C1','V1','V16']) {
    assert.ok(RKDB_RC[rc], `fehlt: ${rc}`);
  }
});
