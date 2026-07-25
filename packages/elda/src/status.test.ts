import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_STATUS, istOk } from './status';

test('Status-Codes vollständig (Spec V4)', () => {
  for (const code of [
    '000',
    '500',
    '551',
    '552',
    '553',
    '554',
    '555',
    '557',
    '558',
    '559',
    '401',
    '402',
    '403',
    '404',
    '405',
    '406',
    '407',
    '408',
  ]) {
    assert.ok(ELDA_STATUS[code], `fehlt: ${code}`);
  }
  assert.ok(istOk('000'));
  assert.ok(!istOk('403'));
});
