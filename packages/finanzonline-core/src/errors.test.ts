import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonError, FonSessionError, FonSessionExpiredError, sessionErrorFor } from './errors';

test('sessionErrorFor(-1) liefert FonSessionExpiredError', () => {
  const err = sessionErrorFor(-1);
  assert.ok(err instanceof FonSessionExpiredError);
  assert.ok(err instanceof FonSessionError);
  assert.ok(err instanceof FonError);
  assert.equal(err.rc, -1);
  assert.equal(err.name, 'FonSessionExpiredError');
  assert.match(err.message, /abgelaufen/i);
});

test('sessionErrorFor(-4) liefert generische FonSessionError, nicht Expired', () => {
  const err = sessionErrorFor(-4);
  assert.ok(err instanceof FonSessionError);
  assert.ok(!(err instanceof FonSessionExpiredError));
  assert.equal(err.rc, -4);
});

test('sessionErrorFor kennt -5 bis -8', () => {
  for (const rc of [-5, -6, -7, -8]) {
    assert.match(sessionErrorFor(rc).message, /gesperrt|berechtigt|Webservice-Benutzer/i);
  }
});

test('serverMsg wird an die Meldung angehängt', () => {
  const err = sessionErrorFor(-3, 'Details vom BMF');
  assert.equal(err.serverMsg, 'Details vom BMF');
  assert.match(err.message, /Details vom BMF/);
});

test('unbekannter rc bekommt Fallback-Meldung', () => {
  assert.match(sessionErrorFor(-99).message, /rc=-99/);
});
