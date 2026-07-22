import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUid } from './uid';
const jsonFetch = (b: unknown) => (async () => new Response(JSON.stringify(b), { status: 200 })) as unknown as typeof fetch;

test('pruefe delegiert an VIES (VIES-first)', async () => {
  const uid = createUid({ antragsteller: 'ATU12345678', transport: { fetchImpl: jsonFetch({ isValid: true, userError: 'VALID' }) } });
  const erg = await uid.pruefe('DE136695976');
  assert.equal(erg.ergebnis, 'gueltig'); assert.equal(erg.quelle, 'vies');
});
test('cacheKey ist stabil und normalisiert', () => {
  const uid = createUid({ antragsteller: 'ATU12345678' });
  assert.equal(uid.cacheKey(' de 136695976 '), 'DE136695976');
});
test('fon.abfrage ohne Session wirft', async () => {
  const uid = createUid({ antragsteller: 'ATU12345678' });
  await assert.rejects(() => uid.fon.abfrage({ uid: 'ATU87654321', stufe: 1 }), /Session/);
});
