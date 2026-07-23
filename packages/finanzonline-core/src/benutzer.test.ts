import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istGueltigeBenid, generiereBenid, istGueltigesPasswort, generierePasswort } from './benutzer';

test('istGueltigeBenid: 8–12 alphanumerisch, Buchstabe + Ziffer', () => {
  assert.ok(istGueltigeBenid('KASSENECK001')); // 12, Buchstaben + Ziffern
  assert.ok(istGueltigeBenid('webserv99'));
  assert.ok(!istGueltigeBenid('kasseneck')); // keine Ziffer
  assert.ok(!istGueltigeBenid('123456789')); // kein Buchstabe
  assert.ok(!istGueltigeBenid('ABC1')); // zu kurz
  assert.ok(!istGueltigeBenid('ABCDEFGHIJK12')); // 13, zu lang
  assert.ok(!istGueltigeBenid('KASSEN-01')); // Sonderzeichen
});

test('generiereBenid: Präfix + führende Nullen, validiert', () => {
  assert.equal(generiereBenid('KASSENECK', 1), 'KASSENECK001');
  assert.equal(generiereBenid('KASSENECK', 42), 'KASSENECK042');
  assert.equal(generiereBenid('KECK', 12345678, 8), 'KECK12345678');
  assert.throws(() => generiereBenid('KASSENECK', 1000)); // 13 -> ungültig
});

test('generierePasswort: erfüllt alle FON-Kriterien (mehrfach)', () => {
  for (let i = 0; i < 30; i++) {
    const pw = generierePasswort();
    assert.equal(pw.length, 16);
    assert.ok(istGueltigesPasswort(pw), `ungültig erzeugt: ${pw}`);
  }
  assert.equal(generierePasswort(24).length, 24);
  assert.throws(() => generierePasswort(4));
});

test('istGueltigesPasswort: Kategorien, Länge, ≠ benid', () => {
  assert.ok(istGueltigesPasswort('Abc1!def'));
  assert.ok(!istGueltigesPasswort('abc1!def')); // kein Groß
  assert.ok(!istGueltigesPasswort('ABC1!DEF')); // kein Klein
  assert.ok(!istGueltigesPasswort('Abcd!efg')); // keine Ziffer
  assert.ok(!istGueltigesPasswort('Abcd1efg')); // kein Sonderzeichen
  assert.ok(!istGueltigesPasswort('Ab1!')); // zu kurz
  assert.ok(!istGueltigesPasswort('Abc1!déf')); // Umlaut nicht erlaubt
  assert.ok(!istGueltigesPasswort('Abc1!def', 'Abc1!def')); // == benid
});
