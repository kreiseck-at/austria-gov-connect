import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorgangXml, vorgangArt, isoDateTime, RksvError, type Vorgang } from './vorgaenge';

test('registrierung_kasse erzeugt Felder in Reihenfolge satznr, kassenid, benutzerschluessel', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'KASSE-001', benutzerschluessel: 'A'.repeat(44) };
  const xml = vorgangXml(v, 1);
  assert.equal(vorgangArt(v), 'registrierung_kasse');
  assert.match(xml, /^<registrierung_kasse><satznr>1<\/satznr>/);
  assert.ok(xml.indexOf('<kassenidentifikationsnummer>KASSE-001<') < xml.indexOf('<benutzerschluessel>'));
  assert.match(xml, /<\/registrierung_kasse>$/);
});

test('registrierung_kasse mit optionaler anmerkung platziert sie vor benutzerschluessel', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'A'.repeat(44), anmerkung: 'Hinweis' };
  const xml = vorgangXml(v, 2);
  assert.ok(xml.indexOf('<anmerkung>Hinweis<') < xml.indexOf('<benutzerschluessel>'));
});

test('benutzerschluessel != 44 Zeichen wird lokal abgelehnt', () => {
  const v: Vorgang = { art: 'registrierung_kasse', kassenidentifikationsnummer: 'K1', benutzerschluessel: 'zu-kurz' };
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('registrierung_se mit vdaId und zertifikatsseriennummer', () => {
  const v: Vorgang = { art: 'registrierung_se', artSe: 'HSM_DIENSTLEISTER', vdaId: 'AT9', zertifikatsseriennummer: '1a2b3c' };
  const xml = vorgangXml(v, 1);
  assert.match(xml, /<art_se>HSM_DIENSTLEISTER<\/art_se>/);
  assert.match(xml, /<vda_id>AT9<\/vda_id>/);
  assert.match(xml, /<zertifikatsseriennummer>1a2b3c<\/zertifikatsseriennummer>/);
});

test('registrierung_se verlangt genau eines von zertifikatsseriennummer/zertifikat', () => {
  const beide: Vorgang = { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: 'aa', zertifikat: 'YmFzZQ==' };
  const keines: Vorgang = { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1' };
  assert.throws(() => vorgangXml(beide, 1), RksvError);
  assert.throws(() => vorgangXml(keines, 1), RksvError);
});

test('ungültige vda_id wird abgelehnt', () => {
  const v: Vorgang = { art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'X', zertifikatsseriennummer: 'aa' };
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('ausfall_kasse mit Ausfall setzt begruendung und beginn_ausfall', () => {
  const v: Vorgang = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1', ausfall: { begruendung: 5, beginn: new Date('2026-07-20T10:00:00Z') } };
  const xml = vorgangXml(v, 1);
  assert.match(xml, /<ausfall><begruendung>5<\/begruendung><beginn_ausfall>2026-07-20T10:00:00Z<\/beginn_ausfall><\/ausfall>/);
});

test('ausfall_kasse mit Ausserbetriebnahme nur begruendung', () => {
  const v: Vorgang = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1', ausserbetriebnahme: { begruendung: 6 } };
  assert.match(vorgangXml(v, 1), /<ausserbetriebnahme><begruendung>6<\/begruendung><\/ausserbetriebnahme>/);
});

test('ausfall_kasse verlangt genau eines von ausfall/ausserbetriebnahme', () => {
  const keines: Vorgang = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1' };
  assert.throws(() => vorgangXml(keines, 1), RksvError);
});

test('ausfall_kasse mit falschem Begründungscode wird abgelehnt', () => {
  const v = { art: 'ausfall_kasse', kassenidentifikationsnummer: 'K1', ausfall: { begruendung: 2 as unknown as 1|5|99, beginn: new Date() } } as Vorgang;
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('ausfall_se mit gültigem Begründungscode wird akzeptiert', () => {
  const v: Vorgang = { art: 'ausfall_se', zertifikatsseriennummer: '1a2b', ausfall: { begruendung: 2, beginn: new Date('2026-07-20T10:00:00Z') } };
  assert.match(vorgangXml(v, 1), /<ausfall><begruendung>2<\/begruendung>/);
});

test('ausfall_se mit falschem Begründungscode wird abgelehnt', () => {
  const v = { art: 'ausfall_se', zertifikatsseriennummer: '1a2b', ausfall: { begruendung: 5 as unknown as 1|2|99, beginn: new Date() } } as Vorgang;
  assert.throws(() => vorgangXml(v, 1), RksvError);
});

test('wiederinbetriebnahme_kasse setzt ende_ausfall', () => {
  const v: Vorgang = { art: 'wiederinbetriebnahme_kasse', kassenidentifikationsnummer: 'K1', ende: new Date('2026-07-21T09:00:00Z') };
  assert.match(vorgangXml(v, 1), /<ende_ausfall>2026-07-21T09:00:00Z<\/ende_ausfall>/);
});

test('belegpruefung setzt beleg und maskiert Sonderzeichen', () => {
  const v: Vorgang = { art: 'belegpruefung', beleg: '_R1-AT9_K&1_1_2026-07-20T14:23:34_10,00' };
  assert.match(vorgangXml(v, 1), /<beleg>_R1-AT9_K&amp;1_/);
});

test('isoDateTime liefert Sekunden ohne Millisekunden mit Z', () => {
  assert.equal(isoDateTime(new Date('2026-07-21T12:34:56.789Z')), '2026-07-21T12:34:56Z');
});
