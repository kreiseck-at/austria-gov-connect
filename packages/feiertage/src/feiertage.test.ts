import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gesetzlicheFeiertageNachArg, istGesetzlicherFeiertagNachArg } from './feiertage';
import { FeiertageEingabeError } from './datum';

test('2026 liefert alle dreizehn Feiertage nach § 7 Abs 2 ARG, sortiert', () => {
  const feiertage = gesetzlicheFeiertageNachArg(2026);
  assert.equal(feiertage.length, 13);
  assert.deepEqual(feiertage, [
    { datum: '2026-01-01', name: 'Neujahr' },
    { datum: '2026-01-06', name: 'Heilige Drei Könige' },
    { datum: '2026-04-06', name: 'Ostermontag' },
    { datum: '2026-05-01', name: 'Staatsfeiertag' },
    { datum: '2026-05-14', name: 'Christi Himmelfahrt' },
    { datum: '2026-05-25', name: 'Pfingstmontag' },
    { datum: '2026-06-04', name: 'Fronleichnam' },
    { datum: '2026-08-15', name: 'Mariä Himmelfahrt' },
    { datum: '2026-10-26', name: 'Nationalfeiertag' },
    { datum: '2026-11-01', name: 'Allerheiligen' },
    { datum: '2026-12-08', name: 'Mariä Empfängnis' },
    { datum: '2026-12-25', name: 'Weihnachten' },
    { datum: '2026-12-26', name: 'Stephanstag' },
  ]);
});

test('istGesetzlicherFeiertagNachArg erkennt einen festen Feiertag', () => {
  assert.equal(istGesetzlicherFeiertagNachArg('2026-12-25'), true);
});

test('istGesetzlicherFeiertagNachArg erkennt einen beweglichen Feiertag', () => {
  assert.equal(istGesetzlicherFeiertagNachArg('2026-06-04'), true); // Fronleichnam 2026
});

test('istGesetzlicherFeiertagNachArg verneint einen gewöhnlichen Tag', () => {
  assert.equal(istGesetzlicherFeiertagNachArg('2026-06-05'), false);
});

// Kernpunkt des Pakets: Der Karfreitag ist kein Feiertag nach ARG (Abs 3 wurde durch
// BGBl. I Nr. 22/2019 aufgehoben) — auch wenn er nach BAO/AVG eine Frist verschiebt
// (siehe fristen.test.ts für die zweite Hälfte dieser Aussage).
test('der Karfreitag ist kein Feiertag nach ARG', () => {
  assert.equal(istGesetzlicherFeiertagNachArg('2026-04-03'), false); // Karfreitag 2026
});

test('ungültiges Datum wirft', () => {
  assert.throws(() => istGesetzlicherFeiertagNachArg('2026-13-01'), FeiertageEingabeError);
  assert.throws(() => istGesetzlicherFeiertagNachArg('31.02.2026'), FeiertageEingabeError);
});

test('ungültiges Jahr wirft', () => {
  assert.throws(() => gesetzlicheFeiertageNachArg(1500), FeiertageEingabeError);
});
