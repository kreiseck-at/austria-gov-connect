import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '@kreiseck/finanzonline-core';

test('Core ist als Workspace-Dependency auflösbar', () => {
  assert.equal(typeof createSession, 'function');
});
