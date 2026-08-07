import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIsoDatum, formatIsoDatum, wochentag, FeiertageEingabeError } from './datum';

test('parst ein gültiges Datum in seine Bestandteile', () => {
  const z = parseIsoDatum('2026-08-15');
  assert.equal(z.jahr, 2026);
  assert.equal(z.monat, 8);
  assert.equal(z.tag, 15);
  assert.equal(formatIsoDatum(z.epochTag), '2026-08-15');
});

test('erkennt Schaltjahr korrekt: 2024-02-29 gültig, 2026-02-29 nicht', () => {
  assert.doesNotThrow(() => parseIsoDatum('2024-02-29'));
  assert.throws(() => parseIsoDatum('2026-02-29'), FeiertageEingabeError);
});

test('rollt Monatsüberlauf nicht stillschweigend weiter: 2026-02-30 wirft', () => {
  assert.throws(() => parseIsoDatum('2026-02-30'), FeiertageEingabeError);
});

test('ungültiger Monat wirft', () => {
  assert.throws(() => parseIsoDatum('2026-13-01'), FeiertageEingabeError);
});

test('falsches Format wirft', () => {
  assert.throws(() => parseIsoDatum('31.02.2026'), FeiertageEingabeError);
  assert.throws(() => parseIsoDatum('2026/08/15'), FeiertageEingabeError);
  assert.throws(() => parseIsoDatum(''), FeiertageEingabeError);
});

test('Nicht-String wirft', () => {
  // @ts-expect-error absichtlich falscher Typ für den Test
  assert.throws(() => parseIsoDatum(20260815), FeiertageEingabeError);
});

test('wochentag: 1.1.2026 ist ein Donnerstag', () => {
  const z = parseIsoDatum('2026-01-01');
  assert.equal(wochentag(z.epochTag), 4);
});
