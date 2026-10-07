import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAATEN, STAATSANGEHOERIGKEITEN } from './staaten';

test('Staatencode-Tabelle: 264 Einträge, Schlüssel und ISOA3 eindeutig', () => {
  assert.equal(STAATEN.length, 264);
  assert.equal(new Set(STAATEN.map((s) => s.schluessel)).size, STAATEN.length);
  assert.equal(STAATSANGEHOERIGKEITEN.size, STAATEN.length);
});

test('Stichproben aus der Tabelle (Stand 22.04.2026)', () => {
  const nach = (a3: string) => STAATEN.find((s) => s.isoA3 === a3);
  assert.deepEqual(nach('AUT'), { schluessel: 1, kurz: 'Österreich', kfz: 'A', isoA3: 'AUT', isoA2: 'AT' });
  assert.deepEqual(nach('stl'), { schluessel: 0, kurz: 'Staatenlos', isoA3: 'stl', isoA2: 'XS' });
  assert.equal(nach('DEU')?.kfz, 'D');
  assert.equal(nach('_12')?.kurz, 'Afrika, nicht näher zuordenb.');
});

test('das KFZ-Kennzeichen ist kein eindeutiger Schlüssel', () => {
  assert.ok(STAATEN.filter((s) => s.kfz === 'F').length > 1);
});
