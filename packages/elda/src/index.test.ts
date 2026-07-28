import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as elda from './index';

test('index exportiert die öffentliche API', () => {
  assert.equal(typeof elda.createEldaTransferRoh, 'function');
  assert.equal(typeof elda.baueSecurity, 'function');
  assert.equal(typeof elda.findeRuecksendung, 'function');
  assert.equal(typeof elda.istOk, 'function');
  assert.ok(elda.ELDA_ENDPOINTS.produktion);
  assert.ok(elda.ELDA_STATUS['000']);
  assert.equal(elda.ELDA_NAMESPACE, 'http://v4.transfer.ws.elda.at/');
});

test('index exportiert die Fehlertypen', () => {
  assert.equal(typeof elda.EldaError, 'function');
  assert.equal(typeof elda.EldaProtocolError, 'function');
  assert.ok(elda.EldaProtocolError.prototype instanceof elda.EldaError);
});
