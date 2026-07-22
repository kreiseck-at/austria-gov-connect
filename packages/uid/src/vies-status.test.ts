import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viesStatus } from './vies';
const jsonFetch = (b: unknown) =>
  (async () => new Response(JSON.stringify(b), { status: 200 })) as unknown as typeof fetch;

test('mappt Verfuegbarkeit pro Land', async () => {
  const s = await viesStatus({
    fetchImpl: jsonFetch({
      vow: { available: true },
      countries: [
        { countryCode: 'DE', availability: 'Available' },
        { countryCode: 'FR', availability: 'Unavailable' },
        { countryCode: 'IT', availability: 'Monitored' },
      ],
    }),
  });
  assert.equal(s.vowVerfuegbar, true);
  assert.equal(s.land.DE, 'verfuegbar');
  assert.equal(s.land.FR, 'nicht_verfuegbar');
  assert.equal(s.land.IT, 'beobachtet');
});
