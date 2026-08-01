import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VBTY_CODES, VPTY_CODES, KOMBINATION, EINS_ZU_EINS } from './codes-e32';

test('die Kataloge haben den Umfang des Dokuments', () => {
  assert.equal(Object.keys(VBTY_CODES).length, 18, 'D.58, Seiten 139-140');
  assert.equal(Object.keys(VPTY_CODES).length, 45, 'D.60, Seiten 148-149');
});

test('jede Kombination verweist auf existierende Codes', () => {
  for (const [vbty, positionen] of Object.entries(KOMBINATION)) {
    assert.ok(vbty in VBTY_CODES, `Basistyp ${vbty} steht nicht im Katalog`);
    for (const vpty of Object.keys(positionen)) {
      assert.ok(vpty in VPTY_CODES, `Positionstyp ${vpty} steht nicht im Katalog`);
    }
  }
  for (const [vbty, positionen] of Object.entries(EINS_ZU_EINS)) {
    assert.ok(vbty in VBTY_CODES, `Basistyp ${vbty} steht nicht im Katalog`);
    for (const vpty of positionen) {
      assert.ok(vpty in VPTY_CODES, `Positionstyp ${vpty} steht nicht im Katalog`);
    }
  }
});

test('zu jeder klassischen Beitragsgrundlage gehoert genau eine Standardposition', () => {
  // D.60: Die Standard-Tarifgruppenverrechnung ist je Basis zwingend und
  // eindeutig -- AB->T01, SZ->T02, UU->T03. AZ und SA tragen KEINE Standard-
  // position; sie dienen allein der speziellen AV-Minderung.
  const zwingend = (vbty: string) =>
    Object.entries(KOMBINATION[vbty] ?? {}).filter(([, stufe]) => stufe === 'Z').map(([p]) => p);
  assert.deepEqual(zwingend('AB'), ['T01']);
  assert.deepEqual(zwingend('SZ'), ['T02']);
  assert.deepEqual(zwingend('UU'), ['T03']);
  assert.deepEqual(zwingend('AZ'), []);
  assert.deepEqual(zwingend('SA'), []);
});

test('die 1:1-Basistypen kommen in der Kombinationstabelle nicht vor', () => {
  for (const vbty of Object.keys(EINS_ZU_EINS)) {
    assert.equal(vbty in KOMBINATION, false, `${vbty} darf nicht in beiden Tabellen stehen`);
  }
});

test('die Beitragsgrundlage zur BV verlangt genau die Vorsorge-Position', () => {
  assert.deepEqual(EINS_ZU_EINS.BV, ['V01']);
  assert.equal(VPTY_CODES.V01?.art, 'vorsorge');
});

test('die SW-Entschaedigung ist der einzige Basistyp mit zwei Positionen', () => {
  const mehrfach = Object.entries(EINS_ZU_EINS).filter(([, p]) => p.length > 1).map(([v]) => v);
  assert.deepEqual(mehrfach, ['SW'], 'Lehrling und Nicht-Lehrling');
});

test('Einschraenkungen sind als Daten hinterlegt, nicht in Code gegossen', () => {
  assert.equal(VPTY_CODES.A11?.einschraenkung?.text, 'Gültig bis 31.12.2025');
  assert.equal(VPTY_CODES.A11?.einschraenkung?.fussnote, 44);
  assert.match(VPTY_CODES.P01?.einschraenkung?.text ?? '', /BVAEB/);
  assert.match(VPTY_CODES.A24?.einschraenkung?.text ?? '', /Wien/);
  assert.equal(VPTY_CODES.T01?.einschraenkung, undefined, 'der Regelfall traegt keine');
});

test('jeder Positionstyp hat eine der vier Arten', () => {
  const erlaubt = new Set(['standard', 'vorsorge', 'abschlag', 'zuschlag']);
  for (const [code, e] of Object.entries(VPTY_CODES)) {
    assert.ok(erlaubt.has(e.art), `${code}: unbekannte Art ${e.art}`);
    assert.ok(e.bezeichnung.length > 0, `${code}: ohne Bezeichnung`);
  }
});

test('die Kataloge sind eingefroren', () => {
  assert.equal(Object.isFrozen(VPTY_CODES), true);
  assert.equal(Object.isFrozen(KOMBINATION), true);
  assert.equal(Object.isFrozen(KOMBINATION.AB), true);
});
