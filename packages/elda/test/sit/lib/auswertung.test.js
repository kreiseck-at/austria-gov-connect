'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zuordnungAusLaeufen, faelleDerMitteilung, zustellungsHinweis, istOffen } = require('./auswertung');

const LAEUFE = [
  { art: 'lauf', fall: 'V01', referenzwerte: ['SIT-V01-1'], protokollnummer: '180001' },
  { art: 'lauf', fall: 'Q50', referenzwerte: ['SIT-Q50-1'], protokollnummer: 180002 },
  { art: 'urteil', fall: 'Q50' },
];

test('Mitteilung mit Referenznummer: Fall über den Referenzwert', () => {
  const z = zuordnungAusLaeufen(LAEUFE);
  const m = { meldungen: [{ referenznummer: 'SIT-V01-1' }, { referenznummer: 'SIT-V01-1' }] };
  assert.deepEqual(faelleDerMitteilung(m, '180001', z), ['V01']);
});

test('Mitteilung zum Lohnzettel ohne Referenznummer: Fall über die Protokollnummer', () => {
  const z = zuordnungAusLaeufen(LAEUFE);
  const m = { meldungen: [{ referenznummer: '' }] };
  assert.deepEqual(faelleDerMitteilung(m, '180002', z), ['Q50']);
  assert.deepEqual(faelleDerMitteilung(m, '999999', z), []);
  assert.deepEqual(faelleDerMitteilung(m, undefined, z), []);
});

test('fremde Referenznummer bleibt stehen', () => {
  const z = zuordnungAusLaeufen(LAEUFE);
  assert.deepEqual(faelleDerMitteilung({ meldungen: [{ referenznummer: 'X-1' }] }, '180002', z), ['X-1']);
});

test('Zustellungsgrund: gemeldet ohne Hinweis, obsolet gesetzt sichtbar und nicht offen', () => {
  assert.equal(zustellungsHinweis({ zustellungsgrund: 'M' }), '');
  assert.equal(zustellungsHinweis({}), '');
  assert.equal(zustellungsHinweis({ zustellungsgrund: 'O' }), 'obsolet gesetzt');
  assert.equal(zustellungsHinweis({ zustellungsgrund: 'U' }), 'urgiert');
  assert.equal(zustellungsHinweis({ zustellungsgrund: 'Z' }), 'Zustellung Z');
  assert.equal(istOffen({ zustellungsgrund: 'O' }), false);
  assert.equal(istOffen({ zustellungsgrund: 'M' }), true);
  assert.equal(istOffen({ zustellungsgrund: 'U' }), true);
});
