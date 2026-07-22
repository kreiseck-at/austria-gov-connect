import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viesBestaetige } from './vies';

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
