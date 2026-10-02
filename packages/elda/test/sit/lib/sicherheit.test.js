'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ERLAUBTE_ENDPOINTS, endpointFuer, pruefeZiel, pruefeQuellIp } = require('./sicherheit');
const { ELDA_ENDPOINTS } = require('../../../dist/index.js');

const SIT = 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService';

test('nur der SIT ist erlaubt – und zwar genau der Endpoint, den das Paket kennt', () => {
  assert.deepEqual(Object.keys(ERLAUBTE_ENDPOINTS), ['sit']);
  assert.equal(endpointFuer('sit'), SIT);
  assert.equal(ELDA_ENDPOINTS.sit, SIT);
});

test('endpointFuer wirft für jede andere Umgebung', () => {
  for (const u of ['produktion', 'kundentest', '', undefined, 'SIT', '__proto__']) {
    assert.throws(() => endpointFuer(u), /nicht erlaubt/, String(u));
  }
});

test('pruefeZiel akzeptiert nur die exakte SIT-Adresse', () => {
  pruefeZiel(SIT);
  pruefeZiel(new URL(SIT));
  for (const ziel of [
    ELDA_ENDPOINTS.produktion,
    ELDA_ENDPOINTS.kundentest,
    'http://online-itu5test.elda.at/eldaws/transfer/v4/TransferService',
    `${SIT}?wsdl`,
    'https://online-itu5test.elda.at/eldaws/transfer/v3/TransferService',
    'https://online-itu5test.elda.at.example.org/eldaws/transfer/v4/TransferService',
  ]) {
    assert.throws(() => pruefeZiel(ziel), /nicht erlaubt/, ziel);
  }
});

// Adressen aus den Dokumentationsbereichen nach RFC 5737 – keine echten Anschlüsse.
test('pruefeQuellIp', () => {
  pruefeQuellIp('192.0.2.10', '192.0.2.10');
  assert.throws(() => pruefeQuellIp('192.0.2.10', undefined), /ELDA_SIT_QUELL_IP/);
  assert.throws(() => pruefeQuellIp(null, '192.0.2.10'), /nicht ermitteln/);
  assert.throws(() => pruefeQuellIp('198.51.100.20', '192.0.2.10'), /Hotspot/);
});
