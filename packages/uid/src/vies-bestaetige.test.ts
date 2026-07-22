import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viesBestaetige } from './vies';
import { UidEingabeError } from './ergebnis';

const jsonFetch = (body: unknown, capture?: (init: RequestInit) => void) =>
  (async (_u: unknown, init?: RequestInit) => {
    capture?.(init ?? {});
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;

test('gueltig mit Konsultationsnummer + Matches', async () => {
  let sent: Record<string, unknown> = {};
  const erg = await viesBestaetige(
    { uid: 'DE136695976', antragsteller: 'ATU12345678', name: 'ACME', ort: 'Berlin' },
    {
      fetchImpl: jsonFetch(
        {
          isValid: true,
          userError: 'VALID',
          requestIdentifier: 'WAPIAAAAX1',
          viesApproximate: { matchName: 1, matchStreet: 3, matchPostalCode: 3, matchCity: 1 },
        },
        (i) => {
          sent = JSON.parse(String(i.body));
        },
      ),
    },
  );
  assert.equal(erg.ergebnis, 'gueltig');
  assert.equal(erg.nachweis?.art, 'vies-konsultationsnummer');
  assert.equal(erg.nachweis?.id, 'WAPIAAAAX1');
  assert.equal(erg.matches?.name, 'match');
  assert.equal(erg.matches?.ort, 'match');
  assert.equal(erg.matches?.strasse, 'nicht_geprueft');
  // Antragsteller landet im Request:
  assert.equal(sent.requesterMemberStateCode, 'AT');
  assert.equal(sent.requesterNumber, 'U12345678');
});
test('HTTP-Fehler (non-2xx) -> keine_antwort/wiederholbar, nie ungueltig', async () => {
  const erg = await viesBestaetige(
    { uid: 'DE136695976', antragsteller: 'ATU12345678' },
    {
      fetchImpl: (async () => new Response(JSON.stringify({}), { status: 503 })) as unknown as typeof fetch,
    },
  );
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.equal(erg.wiederholbar, true);
});
test('fehlendes Signal (kein userError, kein isValid) -> keine_antwort, NICHT ungueltig', async () => {
  const erg = await viesBestaetige(
    { uid: 'DE136695976', antragsteller: 'ATU12345678' },
    { fetchImpl: jsonFetch({ foo: 1 }) },
  );
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.notEqual(erg.ergebnis, 'ungueltig');
});
test('INVALID_INPUT -> wirft UidEingabeError', async () => {
  await assert.rejects(
    () =>
      viesBestaetige(
        { uid: 'DE136695976', antragsteller: 'ATU12345678' },
        { fetchImpl: jsonFetch({ userError: 'INVALID_INPUT' }) },
      ),
    UidEingabeError,
  );
});
