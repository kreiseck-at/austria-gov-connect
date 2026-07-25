import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baueSecurity } from './security';

test('baueSecurity: SHA-512 hex lowercase + Felder', () => {
  const s = baueSecurity(
    { seriennummer: 'S1', kundenpasswort: 'geheim', apiKey: 'K1' },
    { nonce: 'N1', created: '2026-07-25T07:00:00.000Z' },
  );
  assert.equal(s.seriennummer, 'S1');
  assert.equal(s.apiKey, 'K1');
  assert.equal(s.nonce, 'N1');
  assert.equal(s.created, '2026-07-25T07:00:00.000Z');
  assert.equal(s.kundenpasswort, createHash('sha512').update('geheim', 'utf8').digest('hex'));
  assert.match(s.kundenpasswort, /^[0-9a-f]{128}$/); // hex lowercase, 512 bit
});

test('baueSecurity: Defaults nonce (UUID) + created (ISO)', () => {
  const a = baueSecurity({ seriennummer: 'S', kundenpasswort: 'p', apiKey: 'K' });
  const b = baueSecurity({ seriennummer: 'S', kundenpasswort: 'p', apiKey: 'K' });
  assert.match(a.nonce, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.nonce, b.nonce); // eindeutig
  assert.match(a.created, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
