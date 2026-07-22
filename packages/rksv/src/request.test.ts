import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRkdbEnvelope, buildStatusEnvelope, type RkdbPaket, type StatusAbfrage } from './request';
import { RksvError, type Vorgang } from './vorgaenge';

const BASE = {
  tid: 'ABCD1234',
  benid: 'benutzer1',
  id: 'SESSION0001',
  uebermittlung: 'test' as const,
  paketNr: 42,
  tsErstellung: new Date('2026-07-21T12:00:00Z'),
};

test('rkdbRequest: Kopf-Reihenfolge und art_uebermittlung T', () => {
  const p: RkdbPaket = { ...BASE, vorgaenge: [{ art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' }] };
  const xml = buildRkdbEnvelope(p);
  assert.match(xml, /<rkdbRequest xmlns="https:\/\/finanzonline\.bmf\.gv\.at\/rkdb">/);
  assert.ok(xml.indexOf('<tid>') < xml.indexOf('<benid>'));
  assert.ok(xml.indexOf('<benid>') < xml.indexOf('<id>'));
  assert.ok(xml.indexOf('<id>SESSION0001</id>') < xml.indexOf('<art_uebermittlung>'));
  assert.match(xml, /<art_uebermittlung>T<\/art_uebermittlung>/);
  assert.match(xml, /<rkdb><paket_nr>42<\/paket_nr><ts_erstellung>2026-07-21T12:00:00Z<\/ts_erstellung><belegpruefung>/);
});

test('uebermittlung echt -> P', () => {
  const p: RkdbPaket = { ...BASE, uebermittlung: 'echt', vorgaenge: [{ art: 'belegpruefung', beleg: '_R1-AT1_K_1_2026-07-20T14:23:34_10,00' }] };
  assert.match(buildRkdbEnvelope(p), /<art_uebermittlung>P<\/art_uebermittlung>/);
});

test('mehrere Vorgänge gleicher Art bekommen fortlaufende satznr', () => {
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K2', benutzerschluessel: 'B'.repeat(44) },
  ];
  const xml = buildRkdbEnvelope({ ...BASE, vorgaenge: vs });
  assert.ok(xml.indexOf('<satznr>1</satznr>') < xml.indexOf('<satznr>2</satznr>'));
  assert.match(xml, /K1/);
  assert.match(xml, /K2/);
});

test('gemischte Vorgangsarten werden abgelehnt', () => {
  const vs: Vorgang[] = [
    { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) },
    { art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' },
  ];
  assert.throws(() => buildRkdbEnvelope({ ...BASE, vorgaenge: vs }), RksvError);
});

test('leere Vorgangsliste wird abgelehnt', () => {
  assert.throws(() => buildRkdbEnvelope({ ...BASE, vorgaenge: [] }), RksvError);
});

test('paketNr außerhalb 1..999999999 wird abgelehnt', () => {
  const v: Vorgang = { art: 'belegpruefung', beleg: '_R1-AT9_K_1_2026-07-20T14:23:34_10,00' };
  assert.throws(() => buildRkdbEnvelope({ ...BASE, paketNr: 0, vorgaenge: [v] }), RksvError);
  assert.throws(() => buildRkdbEnvelope({ ...BASE, paketNr: 1_000_000_000, vorgaenge: [v] }), RksvError);
});

test('erzwinge_asynchron wird gesetzt wenn true', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44) };
  assert.match(buildRkdbEnvelope({ ...BASE, erzwingeAsynchron: true, vorgaenge: [v] }), /<erzwinge_asynchron>true<\/erzwinge_asynchron>/);
});

test('status_kasse: Element status_kasse mit satznr 1 und kassenid', () => {
  const s: StatusAbfrage = { ...BASE, ziel: { art: 'status_kasse', kassenidentifikationsnummer: 'K1' } };
  const xml = buildStatusEnvelope(s);
  assert.match(xml, /<status_kasse><paket_nr>42<\/paket_nr><ts_erstellung>2026-07-21T12:00:00Z<\/ts_erstellung><satznr>1<\/satznr><kassenidentifikationsnummer>K1<\/kassenidentifikationsnummer><\/status_kasse>/);
});

test('status_se schreibt XSD-Elementnamen status_see', () => {
  const s: StatusAbfrage = { ...BASE, ziel: { art: 'status_se', zertifikatsseriennummer: '1a2b' } };
  assert.match(buildStatusEnvelope(s), /<status_see><paket_nr>42<\/paket_nr>.*<zertifikatsseriennummer hex="true">1a2b<\/zertifikatsseriennummer><\/status_see>/);
});
