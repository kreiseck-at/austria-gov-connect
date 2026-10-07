import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as elda from './index';

test('index exportiert die Betriebs-API', () => {
  assert.equal(typeof elda.createEldaTransfer, 'function');
  assert.equal(typeof elda.createEldaTransferRoh, 'function');
  assert.equal(typeof elda.findeRuecksendung, 'function');
  assert.ok(elda.ELDA_ENDPOINTS.produktion);
  assert.ok(elda.ELDA_STATUS['000']);
});

test('index exportiert die Fehlerklassen mit intakter Kette', () => {
  assert.equal(typeof elda.EldaError, 'function');
  assert.ok(elda.EldaProtocolError.prototype instanceof elda.EldaError);
  assert.ok(elda.EldaStatusError.prototype instanceof elda.EldaError);
});

test('index exportiert hashKundenpasswort für den Aufrufer', () => {
  assert.equal(typeof elda.hashKundenpasswort, 'function');
  assert.match(elda.hashKundenpasswort('geheim'), /^[0-9a-f]{128}$/);
});

test('index exportiert kein Innenleben mehr', () => {
  for (const name of [
    'baueSecurity',
    'loeseKundenpasswortHash',
    'redigiereGeheimnisse',
    'baueEldaEnvelope',
    'ELDA_NAMESPACE',
    'istOk',
    'zuordnung',
  ]) {
    assert.equal((elda as Record<string, unknown>)[name], undefined, `sollte intern sein: ${name}`);
  }
});

test('index exportiert die Meldungs-Builder', () => {
  for (const name of [
    'anmeldung',
    'abmeldung',
    'aenderungsmeldung',
    'richtigstellungAnmeldung',
    'richtigstellungAbmeldung',
    'stornoAnmeldung',
    'stornoAbmeldung',
    'erstelleBestand',
    'wochenarbeitszeit',
    'erstelleMbgmPaket',
    'erstelleMbgmBestand',
    'vsnrAnforderung',
    'erstelleVsnrAnforderungBestand',
    'adresseVersicherter',
    'erstelleAdressmeldungBestand',
    'familienhospizAnmeldung',
    'familienhospizAbmeldung',
    'familienhospizAenderungsmeldung',
    'familienhospizStornoAnmeldung',
    'familienhospizStornoAbmeldung',
    'familienhospizRichtigstellungAnmeldung',
    'familienhospizRichtigstellungAbmeldung',
    'erstelleFamilienhospizBestand',
    'schwerarbeitsmeldung',
    'stornoSchwerarbeitsmeldung',
    'erstelleSchwerarbeitBestand',
  ]) {
    assert.equal(typeof (elda as Record<string, unknown>)[name], 'function', name);
  }
});

// Die Bestandsbezeichnungen sind exportiert, weil ein Aufrufer sie zum Prüfen
// eines fertigen Bestands braucht — gesetzt werden sie nie von ihm, sondern von
// erstelleBestand bzw. erstelleMbgmBestand.
test('index exportiert die Bestandsbezeichnungen aus Kapitel B.3', () => {
  assert.equal(elda.BEST_VERSICHERTENMELDUNG, 'VR');
  assert.equal(elda.BEST_MBGM, 'MB');
  assert.equal(elda.BEST_VSNR_ANFORDERUNG, 'VS');
  assert.equal(elda.BEST_ADRESSE_VERSICHERTER, 'AV');
  assert.equal(elda.BEST_FAMILIENHOSPIZ, 'FH');
  assert.equal(elda.BEST_SCHWERARBEIT, 'SM');
});

test('index exportiert Pflichtstufen und Staatencode-Tabelle, aber keine Feldtabellen von E.30/E.31', () => {
  assert.equal(elda.PFLICHT_E30.GESL, 'Z');
  assert.equal(elda.PFLICHT_E31.VSNR, 'Z');
  assert.ok(elda.STAATSANGEHOERIGKEITEN.has('AUT'));
  for (const intern of [
    'FELDER_E30',
    'FELDER_E31',
    'pruefeVsnrAnforderungInhalt',
    'pruefeAdressmeldungInhalt',
  ]) {
    assert.equal((elda as Record<string, unknown>)[intern], undefined, `sollte intern sein: ${intern}`);
  }
});

test('index exportiert Codelisten und Matrizen von Familienhospiz und Schwerarbeit, aber keine Prüfinterna', () => {
  assert.equal(elda.KARENZART.PFLEGEKARENZ, '04');
  assert.equal(elda.TAETIGKEIT.SCHICHT_ODER_WECHSELDIENST, '1');
  assert.ok(elda.PFLICHT_E12['80']);
  assert.ok(elda.PFLICHT_E22['65']);
  assert.equal(elda.SATZART_TEXT_FH['80'], 'Anmeldung');
  assert.equal(elda.SATZART_TEXT_SM['66'], 'Storno Schwerarbeitsmeldung');
  assert.ok(elda.FELDGRUPPEN_E12.length > 0);
  for (const intern of [
    'FELDER_E12',
    'FELDER_E22',
    'pruefeFamilienhospiz',
    'pruefeSchwerarbeit',
    'pruefeAllgemein',
  ]) {
    assert.equal((elda as Record<string, unknown>)[intern], undefined, `sollte intern sein: ${intern}`);
  }
});

test('index exportiert die Satzart-Tabellen, aber kein Innenleben der Versichertenmeldung', () => {
  assert.ok(elda.PFLICHT_E29.M3);
  assert.ok(elda.SATZART_TEXT.M3);
  assert.ok(elda.ALTERNATIVGRUPPEN.length > 0);
  for (const intern of [
    'baueSatz',
    'nachIso885915',
    'pruefeVorrat',
    'FELDER_E29',
    'pruefeInhalt',
    'pruefePflicht',
  ]) {
    assert.equal((elda as Record<string, unknown>)[intern], undefined, `sollte intern sein: ${intern}`);
  }
});

test('die Transport-Fehlerklassen sind weitergereicht und voneinander unterscheidbar', async () => {
  const m = await import('./index');
  for (const name of ['FonTransportError', 'FonProtocolError', 'FonSoapFaultError'] as const) {
    assert.equal(typeof m[name], 'function', `${name} fehlt im öffentlichen Export`);
  }
  // Der Grund, warum sie exportiert sind: sie erben NICHT von EldaError. Wer nur
  // darauf prüft, deutet einen Protokollfehler als "nicht erreichbar".
  const p = new m.FonProtocolError('kaputt', { httpStatus: 200, rohantwort: '<x' });
  assert.equal(p instanceof m.EldaError, false);
  assert.equal(p instanceof m.FonProtocolError, true);
  assert.equal(p.rohantwort, '<x');
  assert.equal(new m.FonTransportError('weg') instanceof m.EldaError, false);
});

test('index exportiert das Lesen von Rücksendungen', () => {
  for (const name of ['artDerRuecksendung', 'liesMitteilung', 'liesClearing']) {
    assert.equal(typeof (elda as Record<string, unknown>)[name], 'function', name);
  }
  assert.equal(elda.MELDUNG_STATUS.IA, 'in Arbeit');
  assert.equal(elda.DRINGLICHKEIT.K, 'Kontrollfall, Meldung kontrollieren');
  assert.deepEqual(Object.keys(elda.MITTEILUNG_STATUS), [
    'uebernommen',
    'teilweise_uebernommen',
    'nicht_uebernommen',
    'offen',
  ]);
});

test('index exportiert die Beitragsberechnung nach D.62', () => {
  assert.equal(elda.berechneBeitragCent(95_000, 28.45), 27_028);
});

test('index exportiert den Antrag auf zwischenstaatliche Bescheinigung (E.27)', () => {
  for (const name of ['antragZwischenstaatlich', 'stornoAntragZwischenstaatlich', 'erstelleEsBestand']) {
    assert.equal(typeof (elda as Record<string, unknown>)[name], 'function', name);
  }
  assert.equal(elda.BEST_ZWISCHENSTAATLICH, 'ES');
  assert.equal(elda.VERSION_ZWISCHENSTAATLICH, '08');
  assert.deepEqual(Object.keys(elda.E27_SATZART_TEXT), ['E1', 'E2', 'E3', 'E4', 'E5', 'EA']);
  assert.equal(elda.PFLICHT_E27.E1.AGSTAAT, 'Z');
  assert.equal(elda.PFLICHT_E27_STORNO.E1.UIDU, 'Z');
  assert.ok(elda.STAATEN_E5.has('QU'));
  for (const intern of ['FELDER_E27', 'pruefePflichtE27', 'pruefeInhaltE27']) {
    assert.equal((elda as Record<string, unknown>)[intern], undefined, `sollte intern sein: ${intern}`);
  }
});
