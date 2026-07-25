import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zuordnung } from './zuordnung';
import { EldaError } from './errors';

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

test('zuordnung: Präfix-Kollision matcht NICHT (kürzere Nummer in längerer)', () => {
  // '1557643' ist Präfix von '15576431' — ein Teilstring-Vergleich würde hier die
  // fremde Rücksendung 'X' liefern und sie beim Abholen unwiderruflich verbrauchen.
  const rs = [{ protokollnummer: 'X', dateiName: 'prot_15576431.xml' }];
  assert.equal(zuordnung('1557643', rs), undefined);
});

test('zuordnung: wählt bei benachbarten Nummern die richtige aus', () => {
  const rs = [
    { protokollnummer: 'A', dateiName: 'prot_15576431.xml' },
    { protokollnummer: 'B', dateiName: 'prot_1557643.xml' },
    { protokollnummer: 'C', dateiName: 'prot_155764310.xml' },
  ];
  assert.equal(zuordnung('1557643', rs)?.protokollnummer, 'B');
  assert.equal(zuordnung('15576431', rs)?.protokollnummer, 'A');
  assert.equal(zuordnung('155764310', rs)?.protokollnummer, 'C');
});

test('zuordnung: Treffer am Anfang und am Ende des dateiNamens', () => {
  assert.equal(
    zuordnung('155764331', [{ protokollnummer: 'A', dateiName: '155764331_prot.xml' }])?.protokollnummer,
    'A',
  );
  assert.equal(
    zuordnung('155764331', [{ protokollnummer: 'B', dateiName: 'prot_155764331' }])?.protokollnummer,
    'B',
  );
});

test('zuordnung: leere/Whitespace-Protokollnummer wirft statt irgendetwas zu liefern', () => {
  const rs = [{ protokollnummer: 'A', dateiName: 'prot_155764331.xml' }];
  assert.throws(() => zuordnung('', rs), EldaError);
  assert.throws(() => zuordnung('   ', rs), EldaError);
});

test('zuordnung: Regex-Metazeichen in der Protokollnummer werden literal gesucht', () => {
  const rs = [{ protokollnummer: 'A', dateiName: 'prot_1x5.xml' }];
  assert.equal(zuordnung('1.5', rs), undefined);
});
