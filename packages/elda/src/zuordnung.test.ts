import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zuordnung } from './zuordnung';

test('zuordnung: findet Rücksendung mit Sendungs-Protokollnummer im dateiName', () => {
  const rs = [
    { protokollnummer: '999', dateiName: 'fehler_155764331.xml' },
    { protokollnummer: '888', dateiName: 'ok_155764332.xml' },
  ];
  assert.equal(zuordnung('155764332', rs)?.protokollnummer, '888');
  assert.equal(zuordnung('155764331', rs)?.protokollnummer, '999');
});

test('zuordnung: kein Match -> undefined', () => {
  assert.equal(zuordnung('123', [{ protokollnummer: '1', dateiName: 'x.xml' }]), undefined);
});
