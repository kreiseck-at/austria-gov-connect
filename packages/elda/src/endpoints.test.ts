import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_ENDPOINTS, ELDA_NAMESPACE } from './endpoints';

test('Endpoints je Umgebung + Namespace', () => {
  assert.equal(ELDA_ENDPOINTS.produktion, 'https://online.elda.at/eldaws/transfer/v4/TransferService');
  assert.equal(ELDA_ENDPOINTS.kundentest, 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
  assert.equal(ELDA_ENDPOINTS.sit, 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService');
  assert.equal(ELDA_NAMESPACE, 'http://v4.transfer.ws.elda.at/');
});
