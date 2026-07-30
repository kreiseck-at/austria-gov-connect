import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baueSecurity, hashKundenpasswort, loeseKundenpasswortHash } from './security';
import { EldaError } from './errors';

const HASH_GEHEIM = createHash('sha512').update('geheim', 'utf8').digest('hex');

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

test('baueSecurity: Klartext und fertiger Hash ergeben dieselben Felder', () => {
  const opts = { nonce: 'N1', created: '2026-07-25T07:00:00.000Z' };
  const ausKlartext = baueSecurity({ seriennummer: 'S1', kundenpasswort: 'geheim', apiKey: 'K1' }, opts);
  const ausHash = baueSecurity({ seriennummer: 'S1', kundenpasswortHash: HASH_GEHEIM, apiKey: 'K1' }, opts);
  assert.deepEqual(ausHash, ausKlartext);
});

test('hashKundenpasswort stimmt mit der internen Hashbildung überein', () => {
  for (const passwort of ['geheim', 'p', 'Sonderzeichen: äöüß€', ' führendes Leerzeichen']) {
    assert.equal(hashKundenpasswort(passwort), createHash('sha512').update(passwort, 'utf8').digest('hex'));
    assert.equal(
      baueSecurity({ seriennummer: 'S', kundenpasswort: passwort, apiKey: 'K' }).kundenpasswort,
      hashKundenpasswort(passwort),
    );
    assert.match(hashKundenpasswort(passwort), /^[0-9a-f]{128}$/);
  }
});

test('hashKundenpasswort weist leere Eingaben ab, statt einen wertlosen Hash zu liefern', () => {
  for (const leer of ['', '   ', undefined, null, 42]) {
    assert.throws(() => hashKundenpasswort(leer as never), EldaError, `muss werfen: ${String(leer)}`);
  }
});

test('loeseKundenpasswortHash: genau eines von beiden — keines wirft', () => {
  assert.throws(
    () => loeseKundenpasswortHash({ seriennummer: 'S', apiKey: 'K' } as never),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /kundenpasswort/);
      assert.match((err as Error).message, /kundenpasswortHash/);
      return true;
    },
  );
});

test('loeseKundenpasswortHash: genau eines von beiden — beide wirft', () => {
  assert.throws(
    () =>
      loeseKundenpasswortHash({
        seriennummer: 'S',
        apiKey: 'K',
        kundenpasswort: 'geheim',
        kundenpasswortHash: HASH_GEHEIM,
      } as never),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /beide gesetzt/);
      return true;
    },
  );
});

test('loeseKundenpasswortHash: der Hash muss 128 Hexziffern in Kleinschreibung sein', () => {
  const untauglich = [
    HASH_GEHEIM.toUpperCase(), // Großschreibung — ELDA erwartet lowercase
    HASH_GEHEIM.slice(0, 127), // abgeschnitten
    HASH_GEHEIM + 'a', // zu lang
    ` ${HASH_GEHEIM}`, // Leerzeichen davor
    `${HASH_GEHEIM}\n`, // Zeilenumbruch dahinter
    HASH_GEHEIM.slice(0, 127) + 'z', // Nicht-Hexziffer
    createHash('sha256').update('geheim', 'utf8').digest('hex'), // falscher Algorithmus
    '',
    42,
  ];
  for (const hash of untauglich) {
    assert.throws(
      () => loeseKundenpasswortHash({ seriennummer: 'S', apiKey: 'K', kundenpasswortHash: hash } as never),
      (err: unknown) => {
        assert.ok(err instanceof EldaError);
        assert.match((err as Error).message, /kundenpasswortHash/);
        return true;
      },
      `untauglicher Hash muss werfen: ${String(hash).slice(0, 20)}`,
    );
  }
});

test('loeseKundenpasswortHash: gültiger Hash wird unverändert übernommen', () => {
  assert.equal(
    loeseKundenpasswortHash({ seriennummer: 'S', apiKey: 'K', kundenpasswortHash: HASH_GEHEIM }),
    HASH_GEHEIM,
  );
});
