import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viesPruefe } from './vies';
import { UidEingabeError } from './ergebnis';

const jsonFetch = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

test('gueltige DE-UID -> gueltig, quelle vies, land DE', async () => {
  const erg = await viesPruefe('DE136695976', {
    fetchImpl: jsonFetch({
      isValid: true,
      userError: 'VALID',
      name: '',
      address: '',
      requestDate: '2026-07-22',
    }),
  });
  assert.equal(erg.ergebnis, 'gueltig');
  assert.equal(erg.quelle, 'vies');
  assert.equal(erg.land, 'DE');
});
test('nicht registriert -> ungueltig', async () => {
  const erg = await viesPruefe('DE000000000', {
    fetchImpl: jsonFetch({ isValid: false, userError: 'INVALID' }),
  });
  assert.equal(erg.ergebnis, 'ungueltig');
});
test('MS_UNAVAILABLE -> keine_antwort/wiederholbar', async () => {
  const erg = await viesPruefe('DE136695976', {
    fetchImpl: jsonFetch({ isValid: false, userError: 'MS_UNAVAILABLE' }),
  });
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.equal(erg.wiederholbar, true);
});
test('Netzwerkfehler -> keine_antwort/timeout', async () => {
  const erg = await viesPruefe('DE136695976', {
    fetchImpl: (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch,
  });
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.equal(erg.grund, 'timeout');
});
test('HTTP-Fehler (non-2xx) -> keine_antwort/wiederholbar, nie ungueltig', async () => {
  const erg = await viesPruefe('DE136695976', {
    fetchImpl: (async () => new Response(JSON.stringify({}), { status: 503 })) as unknown as typeof fetch,
  });
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.equal(erg.wiederholbar, true);
});
test('fehlendes Signal (kein userError, kein isValid) -> keine_antwort, NICHT ungueltig', async () => {
  const erg = await viesPruefe('DE136695976', {
    fetchImpl: jsonFetch({ foo: 1 }),
  });
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.notEqual(erg.ergebnis, 'ungueltig');
});
test('INVALID_INPUT -> wirft UidEingabeError', async () => {
  await assert.rejects(
    () => viesPruefe('DE136695976', { fetchImpl: jsonFetch({ userError: 'INVALID_INPUT' }) }),
    UidEingabeError,
  );
});
