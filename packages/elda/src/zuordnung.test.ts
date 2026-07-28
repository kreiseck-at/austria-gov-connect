import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findeRuecksendung } from './zuordnung';
import { EldaError } from './errors';

test('findeRuecksendung: findet Rücksendung mit Sendungs-Protokollnummer im dateiName', () => {
  const rs = [
    { protokollnummer: '999', dateiName: 'fehler_155764331.xml' },
    { protokollnummer: '888', dateiName: 'ok_155764332.xml' },
  ];
  assert.equal(findeRuecksendung('155764332', rs)?.protokollnummer, '888');
  assert.equal(findeRuecksendung('155764331', rs)?.protokollnummer, '999');
});

test('findeRuecksendung: kein Match -> undefined', () => {
  assert.equal(findeRuecksendung('123', [{ protokollnummer: '1', dateiName: 'x.xml' }]), undefined);
});

test('findeRuecksendung: Präfix-Kollision matcht NICHT (kürzere Nummer in längerer)', () => {
  // '1557643' ist Präfix von '15576431' — ein Teilstring-Vergleich würde hier die
  // fremde Rücksendung 'X' liefern und sie beim Abholen unwiderruflich verbrauchen.
  const rs = [{ protokollnummer: 'X', dateiName: 'prot_15576431.xml' }];
  assert.equal(findeRuecksendung('1557643', rs), undefined);
});

test('findeRuecksendung: wählt bei benachbarten Nummern die richtige aus', () => {
  const rs = [
    { protokollnummer: 'A', dateiName: 'prot_15576431.xml' },
    { protokollnummer: 'B', dateiName: 'prot_1557643.xml' },
    { protokollnummer: 'C', dateiName: 'prot_155764310.xml' },
  ];
  assert.equal(findeRuecksendung('1557643', rs)?.protokollnummer, 'B');
  assert.equal(findeRuecksendung('15576431', rs)?.protokollnummer, 'A');
  assert.equal(findeRuecksendung('155764310', rs)?.protokollnummer, 'C');
});

test('findeRuecksendung: Treffer am Anfang und am Ende des dateiNamens', () => {
  assert.equal(
    findeRuecksendung('155764331', [{ protokollnummer: 'A', dateiName: '155764331_prot.xml' }])
      ?.protokollnummer,
    'A',
  );
  assert.equal(
    findeRuecksendung('155764331', [{ protokollnummer: 'B', dateiName: 'prot_155764331' }])?.protokollnummer,
    'B',
  );
});

test('findeRuecksendung: leere/Whitespace-Protokollnummer wirft statt irgendetwas zu liefern', () => {
  const rs = [{ protokollnummer: 'A', dateiName: 'prot_155764331.xml' }];
  assert.throws(() => findeRuecksendung('', rs), EldaError);
  assert.throws(() => findeRuecksendung('   ', rs), EldaError);
});

test('findeRuecksendung: Regex-Metazeichen in der Protokollnummer werden literal gesucht', () => {
  const rs = [{ protokollnummer: 'A', dateiName: 'prot_1x5.xml' }];
  assert.equal(findeRuecksendung('1.5', rs), undefined);
});
