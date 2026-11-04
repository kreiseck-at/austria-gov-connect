import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laufenderMonat, zrVonBis } from './zeitraum';

test('Quartal: ZRVON erster, ZRBIS letzter Monat', () => {
  assert.deepEqual(zrVonBis({ jahr: 2026, quartal: 3 }), { zrvon: '2026-07', zrbis: '2026-09' });
  assert.deepEqual(zrVonBis({ jahr: 2026, quartal: 1 }), { zrvon: '2026-01', zrbis: '2026-03' });
  assert.deepEqual(zrVonBis({ jahr: 2026, quartal: 4 }), { zrvon: '2026-10', zrbis: '2026-12' });
});

test('Monat: ZRVON = ZRBIS', () => {
  assert.deepEqual(zrVonBis({ jahr: 2026, monat: 9 }), { zrvon: '2026-09', zrbis: '2026-09' });
  assert.deepEqual(zrVonBis({ jahr: 2026, monat: 12 }), { zrvon: '2026-12', zrbis: '2026-12' });
});

test('ungültige Zeiträume → undefined', () => {
  for (const z of [
    { jahr: 2026, monat: 13 },
    { jahr: 2026, monat: 0 },
    { jahr: 2026, quartal: 5 },
    { jahr: 2026, monat: 1, quartal: 1 },
    { jahr: 2026.5, monat: 1 },
    { jahr: 2026, monat: 1.5 },
    { jahr: 2026 },
    { jahr: '2026', monat: 1 },
    { jahr: 99999, monat: 1 },
    null,
    undefined,
    'Q3/2026',
  ]) {
    assert.equal(zrVonBis(z), undefined, JSON.stringify(z));
  }
});

test('laufender Monat in Wiener Zeit', () => {
  assert.equal(laufenderMonat(new Date('2026-11-04T10:00:00Z')), '2026-11');
  // 31.12. 23:30 UTC ist in Wien schon Neujahr
  assert.equal(laufenderMonat(new Date('2026-12-31T23:30:00Z')), '2027-01');
  // 30.06. 22:30 UTC ist in Wien (MESZ) schon der 1. Juli
  assert.equal(laufenderMonat(new Date('2026-06-30T22:30:00Z')), '2026-07');
});
