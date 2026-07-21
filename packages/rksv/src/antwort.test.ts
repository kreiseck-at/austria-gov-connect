import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '@kreiseck/finanzonline-core';
import { parseRkdbErgebnisse } from './antwort';

const wrap = (results: string) =>
  parseXml(`<Envelope><Body><rkdbResponse><paket_nr>42</paket_nr><ts_erstellung>x</ts_erstellung>${results}</rkdbResponse></Body></Envelope>`);

test('ok-Ergebnis: rc 0 -> ok true', () => {
  const root = wrap('<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>Aufruf ok</msg></rkdbMessage></result>');
  const erg = parseRkdbErgebnisse(root);
  assert.equal(erg.length, 1);
  assert.equal(erg[0]?.satznr, 1);
  assert.equal(erg[0]?.ok, true);
  assert.equal(erg[0]?.rc, '0');
});

test('fachlicher rc B1 -> ok false, rc/msg durchgereicht', () => {
  const root = wrap('<result><satznr>1</satznr><rkdbMessage><rc>B1</rc><msg>bereits registriert</msg></rkdbMessage></result>');
  const erg = parseRkdbErgebnisse(root);
  assert.equal(erg[0]?.ok, false);
  assert.equal(erg[0]?.rc, 'B1');
  assert.equal(erg[0]?.msg, 'bereits registriert');
});

test('mehrere results werden in Reihenfolge geliefert', () => {
  const root = wrap(
    '<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage></result>' +
    '<result><satznr>2</satznr><rkdbMessage><rc>B1</rc><msg>x</msg></rkdbMessage></result>',
  );
  const erg = parseRkdbErgebnisse(root);
  assert.deepEqual(erg.map((e) => e.satznr), [1, 2]);
  assert.deepEqual(erg.map((e) => e.ok), [true, false]);
});

test('Belegprüfung: verificationResult-Baum inkl. Teilprüfungen', () => {
  const root = wrap(
    '<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage>' +
    '<verificationResultList>' +
      '<verificationResult><verificationId>1</verificationId><version>1</version><verificationName>Struktur</verificationName><verificationState>PASS</verificationState><verificationTimestamp>t</verificationTimestamp>' +
        '<verificationResultList><verificationResult><verificationId>1.1</verificationId><version>1</version><verificationName>Segmentzahl</verificationName><verificationState>PASS</verificationState><verificationTimestamp>t</verificationTimestamp></verificationResult></verificationResultList>' +
      '</verificationResult>' +
      '<verificationResult><verificationId>2</verificationId><version>1</version><verificationName>Signatur</verificationName><verificationState>FAIL</verificationState><verificationResultDetailedMessage>ungültig</verificationResultDetailedMessage><verificationTimestamp>t</verificationTimestamp></verificationResult>' +
    '</verificationResultList></result>',
  );
  const erg = parseRkdbErgebnisse(root);
  const pr = erg[0]?.belegpruefung;
  assert.ok(pr);
  assert.equal(pr.length, 2);
  assert.equal(pr[0]?.name, 'Struktur');
  assert.equal(pr[0]?.status, 'PASS');
  assert.equal(pr[0]?.teilpruefungen?.[0]?.name, 'Segmentzahl');
  assert.equal(pr[1]?.status, 'FAIL');
  assert.equal(pr[1]?.detail, 'ungültig');
});

test('Statusabfrage: abfrage_ergebnis wird gelesen', () => {
  const root = wrap(
    '<result><satznr>1</satznr><rkdbMessage><rc>0</rc><msg>ok</msg></rkdbMessage>' +
    '<abfrage_ergebnis><ts_registrierung>2026-01-01T00:00:00Z</ts_registrierung><status>IN_BETRIEB</status><ts_status>2026-02-01T00:00:00Z</ts_status></abfrage_ergebnis></result>',
  );
  const erg = parseRkdbErgebnisse(root);
  assert.equal(erg[0]?.status?.status, 'IN_BETRIEB');
  assert.equal(erg[0]?.status?.tsRegistrierung, '2026-01-01T00:00:00Z');
});
