import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEGRUENDUNGEN, begruendungCodes, begruendungText, istBegruendungZulaessig } from './begruendungen';

// Die Codes und Wortlaute stammen wörtlich aus der BMF-Beschreibung
// „Registrierkassen-Webservice", Abschnitt 4. Diese Tests nageln sie fest:
// eine stille Änderung hier bedeutet eine falsche Begruendung in einer
// Behördenmeldung.

test('Ausfall SEE kennt genau die Codes 1, 2, 99', () => {
  assert.deepEqual(begruendungCodes('ausfall_see'), [1, 2, 99]);
  assert.equal(begruendungText('ausfall_see', 1), 'Diebstahl oder sonstiger Verlust');
  assert.equal(
    begruendungText('ausfall_see', 2),
    'Signatur- bzw. Siegelerstellung unmöglich oder fehlerhaft',
  );
  assert.equal(begruendungText('ausfall_see', 99), 'Sonstiger Grund');
});

test('Ausfall Kasse kennt genau die Codes 1, 5, 99', () => {
  assert.deepEqual(begruendungCodes('ausfall_kasse'), [1, 5, 99]);
  assert.equal(
    begruendungText('ausfall_kasse', 5),
    'Erfassung der Geschäftsvorfälle oder Belegerstellung nicht korrekt möglich',
  );
});

test('Ausserbetriebnahme kennt genau die Codes 6 und 7', () => {
  assert.deepEqual(begruendungCodes('ausserbetriebnahme'), [6, 7]);
  assert.equal(begruendungText('ausserbetriebnahme', 6), 'Planmäßige Außerbetriebnahme');
  assert.equal(
    begruendungText('ausserbetriebnahme', 7),
    'Außerbetriebnahme aufgrund eines irreparablen Ausfalls',
  );
});

test('6 und 7 gelten fuer SEE und Kasse gleichermassen — es gibt nur einen Katalog', () => {
  // Abschnitt 4.3 der Spec gilt ausdruecklich fuer beide Einheiten. Ein
  // getrennter Katalog je Einheit waere ein Fehler.
  assert.equal(BEGRUENDUNGEN.ausserbetriebnahme.length, 2);
});

test('Codes der Vorgaenge sind nicht vertauschbar', () => {
  // Code 2 gibt es nur beim SEE-Ausfall, Code 5 nur beim Kassen-Ausfall.
  assert.equal(istBegruendungZulaessig('ausfall_see', 2), true);
  assert.equal(istBegruendungZulaessig('ausfall_kasse', 2), false);
  assert.equal(istBegruendungZulaessig('ausfall_kasse', 5), true);
  assert.equal(istBegruendungZulaessig('ausfall_see', 5), false);
});

test('Ausfall- und Ausserbetriebnahme-Codes sind disjunkt', () => {
  // 6/7 duerfen nie als Ausfallgrund durchgehen, 1/2/5/99 nie als
  // Ausserbetriebnahme-Grund — sonst meldet man das falsche Ereignis.
  for (const code of [6, 7]) {
    assert.equal(istBegruendungZulaessig('ausfall_see', code), false, `SEE ${code}`);
    assert.equal(istBegruendungZulaessig('ausfall_kasse', code), false, `Kasse ${code}`);
  }
  for (const code of [1, 2, 5, 99]) {
    assert.equal(istBegruendungZulaessig('ausserbetriebnahme', code), false, String(code));
  }
});

test('unbekannter Code liefert null statt eines geratenen Textes', () => {
  assert.equal(begruendungText('ausserbetriebnahme', 3), null);
  assert.equal(begruendungText('ausfall_see', 0), null);
  assert.equal(istBegruendungZulaessig('ausfall_see', 42), false);
});
