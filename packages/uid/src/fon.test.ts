import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fonUidAbfrage } from './fon';
import { UidEingabeError } from './ergebnis';
import type { Session } from '@kreiseck/finanzonline-core';
import { FonSessionExpiredError } from '@kreiseck/finanzonline-core';

const s: Session = { id: 'ABCDEFGHIJ1234567890', tid: 'ABCD1234', benid: 'benutzer1', async logout() {} };
const resp = (inner: string) =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns:uidAbfrageServiceResponse xmlns:ns="https://finanzonline.bmf.gv.at/fon/ws/uidAbfrage">${inner}</ns:uidAbfrageServiceResponse></S:Body></S:Envelope>`;
const tp = (xml: string) => ({
  fetchImpl: (async () => new Response(xml, { status: 200 })) as unknown as typeof fetch,
});

test('rc 0 Stufe 2 -> gueltig + Name/Adresse', async () => {
  const erg = await fonUidAbfrage({
    session: s,
    antragsteller: 'ATU12345678',
    uid: 'ATU87654321',
    stufe: 2,
    transport: tp(resp('<rc>0</rc><name>ACME GmbH</name><adrz1>Hauptstr 1</adrz1><adrz2>1010 Wien</adrz2>')),
  });
  assert.equal(erg.ergebnis, 'gueltig');
  assert.equal(erg.quelle, 'fon');
  assert.equal(erg.name, 'ACME GmbH');
  assert.match(erg.adresse ?? '', /Hauptstr 1/);
  assert.equal(erg.nachweis?.art, 'fon-bescheid-in-databox');
});
test('rc 1 -> ungueltig', async () => {
  const erg = await fonUidAbfrage({
    session: s,
    antragsteller: 'ATU12345678',
    uid: 'ATU00000000',
    stufe: 1,
    transport: tp(resp('<rc>1</rc>')),
  });
  assert.equal(erg.ergebnis, 'ungueltig');
});
test('rc 1511 -> keine_antwort/wiederholbar', async () => {
  const erg = await fonUidAbfrage({
    session: s,
    antragsteller: 'ATU12345678',
    uid: 'DE136695976',
    stufe: 2,
    transport: tp(resp('<rc>1511</rc>')),
  });
  assert.equal(erg.ergebnis, 'keine_antwort');
  assert.equal(erg.wiederholbar, true);
});
test('rc 1513 -> keine_antwort/ratenlimit, NICHT wiederholbar', async () => {
  const erg = await fonUidAbfrage({
    session: s,
    antragsteller: 'ATU12345678',
    uid: 'DE136695976',
    stufe: 2,
    transport: tp(resp('<rc>1513</rc>')),
  });
  assert.equal(erg.grund, 'ratenlimit');
  assert.equal(erg.wiederholbar, false);
});
test('rc 4 -> UidEingabeError', async () => {
  await assert.rejects(
    () =>
      fonUidAbfrage({
        session: s,
        antragsteller: 'ATU12345678',
        uid: 'XX',
        stufe: 1,
        transport: tp(resp('<rc>4</rc>')),
      }),
    UidEingabeError,
  );
});
test('rc 101 (UID nicht ATU) -> UidEingabeError (kein Retry)', async () => {
  await assert.rejects(
    () =>
      fonUidAbfrage({
        session: s,
        antragsteller: 'DE12345678',
        uid: 'ATU87654321',
        stufe: 1,
        transport: tp(resp('<rc>101</rc>')),
      }),
    UidEingabeError,
  );
});
test('rc -1 -> FonSessionExpiredError', async () => {
  await assert.rejects(
    () =>
      fonUidAbfrage({
        session: s,
        antragsteller: 'ATU12345678',
        uid: 'ATU12345678',
        stufe: 1,
        transport: tp(resp('<rc>-1</rc><msg>Session abgelaufen</msg>')),
      }),
    FonSessionExpiredError,
  );
});
