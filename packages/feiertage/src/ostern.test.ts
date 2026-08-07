import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ostersonntag,
  karfreitag,
  ostermontag,
  christiHimmelfahrt,
  pfingstmontag,
  fronleichnam,
} from './ostern';
import { FeiertageEingabeError } from './datum';

// Referenztabelle, unabhängig nachgerechnet (Gaußsche Osterformel, Meeus/Jones/Butcher).
const REFERENZ: Record<
  number,
  {
    ostersonntag: string;
    karfreitag: string;
    ostermontag: string;
    christiHimmelfahrt: string;
    pfingstmontag: string;
    fronleichnam: string;
  }
> = {
  2024: {
    ostersonntag: '2024-03-31',
    karfreitag: '2024-03-29',
    ostermontag: '2024-04-01',
    christiHimmelfahrt: '2024-05-09',
    pfingstmontag: '2024-05-20',
    fronleichnam: '2024-05-30',
  },
  2025: {
    ostersonntag: '2025-04-20',
    karfreitag: '2025-04-18',
    ostermontag: '2025-04-21',
    christiHimmelfahrt: '2025-05-29',
    pfingstmontag: '2025-06-09',
    fronleichnam: '2025-06-19',
  },
  2026: {
    ostersonntag: '2026-04-05',
    karfreitag: '2026-04-03',
    ostermontag: '2026-04-06',
    christiHimmelfahrt: '2026-05-14',
    pfingstmontag: '2026-05-25',
    fronleichnam: '2026-06-04',
  },
  2027: {
    ostersonntag: '2027-03-28',
    karfreitag: '2027-03-26',
    ostermontag: '2027-03-29',
    christiHimmelfahrt: '2027-05-06',
    pfingstmontag: '2027-05-17',
    fronleichnam: '2027-05-27',
  },
  2028: {
    ostersonntag: '2028-04-16',
    karfreitag: '2028-04-14',
    ostermontag: '2028-04-17',
    christiHimmelfahrt: '2028-05-25',
    pfingstmontag: '2028-06-05',
    fronleichnam: '2028-06-15',
  },
  2029: {
    ostersonntag: '2029-04-01',
    karfreitag: '2029-03-30',
    ostermontag: '2029-04-02',
    christiHimmelfahrt: '2029-05-10',
    pfingstmontag: '2029-05-21',
    fronleichnam: '2029-05-31',
  },
  2030: {
    ostersonntag: '2030-04-21',
    karfreitag: '2030-04-19',
    ostermontag: '2030-04-22',
    christiHimmelfahrt: '2030-05-30',
    pfingstmontag: '2030-06-10',
    fronleichnam: '2030-06-20',
  },
  2031: {
    ostersonntag: '2031-04-13',
    karfreitag: '2031-04-11',
    ostermontag: '2031-04-14',
    christiHimmelfahrt: '2031-05-22',
    pfingstmontag: '2031-06-02',
    fronleichnam: '2031-06-12',
  },
  2032: {
    ostersonntag: '2032-03-28',
    karfreitag: '2032-03-26',
    ostermontag: '2032-03-29',
    christiHimmelfahrt: '2032-05-06',
    pfingstmontag: '2032-05-17',
    fronleichnam: '2032-05-27',
  },
  2033: {
    ostersonntag: '2033-04-17',
    karfreitag: '2033-04-15',
    ostermontag: '2033-04-18',
    christiHimmelfahrt: '2033-05-26',
    pfingstmontag: '2033-06-06',
    fronleichnam: '2033-06-16',
  },
  2034: {
    ostersonntag: '2034-04-09',
    karfreitag: '2034-04-07',
    ostermontag: '2034-04-10',
    christiHimmelfahrt: '2034-05-18',
    pfingstmontag: '2034-05-29',
    fronleichnam: '2034-06-08',
  },
  2035: {
    ostersonntag: '2035-03-25',
    karfreitag: '2035-03-23',
    ostermontag: '2035-03-26',
    christiHimmelfahrt: '2035-05-03',
    pfingstmontag: '2035-05-14',
    fronleichnam: '2035-05-24',
  },
};

for (const [jahrText, erwartet] of Object.entries(REFERENZ)) {
  const jahr = Number(jahrText);
  test(`bewegliche Feiertage ${jahr} treffen die Referenztabelle`, () => {
    assert.equal(ostersonntag(jahr), erwartet.ostersonntag);
    assert.equal(karfreitag(jahr), erwartet.karfreitag);
    assert.equal(ostermontag(jahr), erwartet.ostermontag);
    assert.equal(christiHimmelfahrt(jahr), erwartet.christiHimmelfahrt);
    assert.equal(pfingstmontag(jahr), erwartet.pfingstmontag);
    assert.equal(fronleichnam(jahr), erwartet.fronleichnam);
  });
}

// Grenzfälle: frühestmögliches und spätmögliches Osterdatum im Kalender.
test('Grenzfall frühe Ostern: 2035 (25. März)', () => {
  assert.equal(ostersonntag(2035), '2035-03-25');
  assert.equal(karfreitag(2035), '2035-03-23');
});

test('Grenzfall späte Ostern: 2038 (25. April)', () => {
  assert.equal(ostersonntag(2038), '2038-04-25');
  assert.equal(karfreitag(2038), '2038-04-23');
  assert.equal(ostermontag(2038), '2038-04-26');
  assert.equal(christiHimmelfahrt(2038), '2038-06-03');
  assert.equal(pfingstmontag(2038), '2038-06-14');
  assert.equal(fronleichnam(2038), '2038-06-24');
});

test('Jahr außerhalb des unterstützten Bereichs wirft', () => {
  assert.throws(() => ostersonntag(1582), FeiertageEingabeError);
  assert.throws(() => ostersonntag(4100), FeiertageEingabeError);
  assert.throws(() => ostersonntag(2026.5), FeiertageEingabeError);
});
