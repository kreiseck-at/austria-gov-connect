'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { erstelleAblage } = require('./ablage');
const { erstelleSitFetch } = require('./transport');
const { leereElement } = require('./manipulation');

// Alle Temp-Ordner dieser Datei liegen unter einer Wurzel, die am Ende gelöscht wird.
const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-test-'));
after(() => fs.rmSync(WURZEL, { recursive: true, force: true }));

const MO_0730 = () => new Date('2026-10-05T05:30:00Z'); // Mo 07:30 Wien, mo-vm offen
const offen = { fenster: 'mo-vm', jetzt: MO_0730 };

const SIT = 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService';
const GEHEIM = { apiKey: 'APIKEY-12345678', seriennummer: '7654321', kundenpasswortHash: 'f'.repeat(128) };
const BODY =
  '<securityParameters><apiKey>APIKEY-12345678</apiKey><created>c</created>' +
  `<kundenpasswort>${'f'.repeat(128)}</kundenpasswort><nonce>n1</nonce>` +
  '<seriennummer>7654321</seriennummer></securityParameters><v4:ruecksendungenAuflisten/>';

function aufbau(antwort = { status: 200, body: '<ok/>' }) {
  const ablage = erstelleAblage(fs.mkdtempSync(path.join(WURZEL, 'sit-transport-')));
  const lauf = ablage.neuerLauf('Z01');
  const gesehen = [];
  const echterFetch = async (url, init) => {
    gesehen.push({ url, init });
    if (antwort instanceof Error) throw antwort;
    return new Response(antwort.body, { status: antwort.status, headers: { 'content-type': 'text/xml' } });
  };
  return { ablage, lauf, gesehen, echterFetch };
}

const dateien = (ordner) => fs.readdirSync(ordner).sort();
const lies = (ordner, name) => fs.readFileSync(path.join(ordner, name), 'latin1');

test('ein Ziel außerhalb der Liste wird nie aufgerufen', async () => {
  const { ablage, lauf, gesehen, echterFetch } = aufbau();
  const f = erstelleSitFetch({ ablage, lauf, geheimnisse: GEHEIM, echterFetch, ...offen });
  await assert.rejects(
    f('https://online.elda.at/eldaws/transfer/v4/TransferService', { body: BODY, headers: {} }),
    /nicht erlaubt/,
  );
  assert.equal(gesehen.length, 0);
});

test('Manipulation wird vor dem Senden angewandt', async () => {
  const { ablage, lauf, gesehen, echterFetch } = aufbau();
  const f = erstelleSitFetch({
    ablage,
    lauf,
    geheimnisse: GEHEIM,
    manipulation: leereElement('nonce'),
    echterFetch,
    ...offen,
  });
  await f(SIT, { method: 'POST', body: BODY, headers: { 'Content-Type': 'text/xml' } });
  assert.match(gesehen[0].init.body, /<nonce><\/nonce>/);
  assert.equal(gesehen[0].init.method, 'POST');
});

test('Mitschnitt ist geschwärzt, die Antwort kommt byte-gleich zurück', async () => {
  const antwortText = `<fault>Seriennummer 7654321 falsch</fault>`;
  const { ablage, lauf, echterFetch } = aufbau({ status: 500, body: antwortText });
  const f = erstelleSitFetch({ ablage, lauf, geheimnisse: GEHEIM, echterFetch, ...offen });
  const res = await f(SIT, { body: BODY, headers: { 'Content-Type': 'text/xml' } });
  assert.equal(await res.text(), antwortText);
  assert.equal(res.status, 500);

  const namen = dateien(lauf.ordner);
  assert.deepEqual(namen, [
    '01-ruecksendungenAuflisten-anfrage.txt',
    '01-ruecksendungenAuflisten-antwort.txt',
  ]);
  const alles = namen.map((n) => lies(lauf.ordner, n)).join('\n');
  for (const wert of Object.values(GEHEIM)) assert.ok(!alles.includes(wert), 'Geheimnis im Mitschnitt');
  assert.match(alles, /\*\*\*seriennummer\*\*\*/);
  assert.match(alles, /^POST https:\/\/online-itu5test/m);
  assert.equal(lauf.http.status, 500);
});

test('HTTP 403 mit der Wartungsseite wird erkannt', async () => {
  const { ablage, lauf, echterFetch } = aufbau({
    status: 403,
    body: '<HTML><HEAD><TITLE>Wartung</TITLE></HEAD><BODY>Wartung</BODY></HTML>',
  });
  const f = erstelleSitFetch({ ablage, lauf, geheimnisse: GEHEIM, echterFetch, ...offen });
  await f(SIT, { body: BODY, headers: {} });
  assert.equal(lauf.http.wartung, true);
});

test('Netzfehler wird weitergeworfen und vermerkt; der Anfrage-Mitschnitt bleibt', async () => {
  const { ablage, lauf, echterFetch } = aufbau(new TypeError('fetch failed'));
  const f = erstelleSitFetch({ ablage, lauf, geheimnisse: GEHEIM, echterFetch, ...offen });
  await assert.rejects(f(SIT, { body: BODY, headers: {} }), /fetch failed/);
  assert.equal(ablage.ereignisse().at(-1).art, 'netzfehler');
  assert.deepEqual(dateien(lauf.ordner), ['01-ruecksendungenAuflisten-anfrage.txt']);
});

test('lässt sich die Anfrage nicht schwärzen, geht sie nicht raus', async () => {
  const { ablage, lauf, gesehen, echterFetch } = aufbau();
  // Der Fall aus redigieren.test.ts: '*x' durch '***name***' ersetzt ergibt wieder '*x'.
  const f = erstelleSitFetch({ ablage, lauf, geheimnisse: { schluessel: '*x' }, echterFetch, ...offen });
  await assert.rejects(f(SIT, { body: `${BODY}*xx`, headers: {} }), /Schwärzung/);
  assert.equal(gesehen.length, 0);
});

test('Weiterleitungen sind verboten', async () => {
  const { ablage, lauf, gesehen, echterFetch } = aufbau();
  const f = erstelleSitFetch({ ablage, lauf, geheimnisse: GEHEIM, echterFetch, ...offen });
  await f(SIT, { body: BODY, headers: {} });
  assert.equal(gesehen[0].init.redirect, 'error');
});

test('nach Fensterende geht kein Aufruf mehr raus', async () => {
  const { ablage, lauf, gesehen, echterFetch } = aufbau();
  const nachEnde = () => new Date('2026-10-05T07:01:00Z'); // Mo 09:01 Wien
  const f = erstelleSitFetch({
    ablage,
    lauf,
    geheimnisse: GEHEIM,
    echterFetch,
    fenster: 'mo-vm',
    jetzt: nachEnde,
  });
  await assert.rejects(f(SIT, { body: BODY, headers: {} }), /Fenster mo-vm ist zu/);
  assert.equal(gesehen.length, 0);
  assert.throws(() => erstelleSitFetch({ ablage, lauf, geheimnisse: GEHEIM, echterFetch }), /Fenster/);
});

test('ein Geheimnis mit Umlaut wird auch in der Byte-Sicht geschwärzt', async () => {
  const { ablage, lauf, echterFetch } = aufbau({ status: 200, body: '<x>Schlüssel-Ä1</x>' });
  const f = erstelleSitFetch({
    ablage,
    lauf,
    geheimnisse: { apiKey: 'Schlüssel-Ä1' },
    echterFetch,
    ...offen,
  });
  await f(SIT, { body: '<v4:x/><apiKey>Schlüssel-Ä1</apiKey>', headers: {} });
  const alles = dateien(lauf.ordner)
    .map((n) => fs.readFileSync(path.join(lauf.ordner, n)).toString('utf8'))
    .join('\n');
  assert.ok(!alles.includes('Schlüssel-Ä1'), alles);
});
