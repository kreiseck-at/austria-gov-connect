import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEldaTransfer } from './transfer';
import type { EmpfangenErgebnis } from './transfer-roh';
import { EldaStatusError, EldaProtocolError } from './errors';

const cfg = (fetchImpl: unknown) => ({
  seriennummer: 'S1',
  kundenpasswort: 'p',
  apiKey: 'K1',
  umgebung: 'kundentest' as const,
  transport: { fetchImpl: fetchImpl as typeof fetch },
});

const soap = (inner: string) =>
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;

const sendenAntwort = (statusCode: string, extra = '') =>
  soap(
    `<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
      `<serviceResult><messages>M-${statusCode}</messages><statusCode>${statusCode}</statusCode></serviceResult>` +
      `${extra}</return></ns2:sendenResponse>`,
  );

const empfangenAntwort = (statusCode: string, extra = '') =>
  soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
      `<serviceResult><messages>M-${statusCode}</messages><statusCode>${statusCode}</statusCode></serviceResult>` +
      `${extra}</return></ns2:empfangenResponse>`,
  );

const auflistenAntwort = (statusCode: string, extra = '') =>
  soap(
    `<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
      `<serviceResult><messages>M-${statusCode}</messages><statusCode>${statusCode}</statusCode></serviceResult>` +
      `${extra}</return></ns2:ruecksendungenAuflistenResponse>`,
  );

const mitAntwort = (xml: string) => createEldaTransfer(cfg(async () => new Response(xml, { status: 200 })));

test('senden: 000 -> zustand angenommen, kein ok-Feld nötig', async () => {
  const elda = mitAntwort(
    sendenAntwort(
      '000',
      '<protokollnummer>155764331</protokollnummer><dateiId>199565708</dateiId><eldaZeitstempel>2026-07-25T07:00:00.000+02:00</eldaZeitstempel>',
    ),
  );
  const erg = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.zustand, 'angenommen');
  assert.equal(erg.protokollnummer, '155764331');
  assert.equal(erg.dateiId, '199565708');
  assert.equal(erg.eldaZeitstempel, '2026-07-25T07:00:00.000+02:00');
  assert.equal(erg.statusCode, '000');
  assert.equal(erg.meldung, 'M-000');
});

test('senden: 405 ist ein Zustand, kein Fehler', async () => {
  const elda = mitAntwort(sendenAntwort('405', '<protokollnummer>155764331</protokollnummer>'));
  const erg = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.zustand, 'duplikat');
  assert.equal(erg.protokollnummer, '155764331');
  assert.equal(erg.meldung, 'M-405');
});

test('senden: 404 ist ein Zustand (angenommen, Verarbeitung dauert an)', async () => {
  const erg = await mitAntwort(sendenAntwort('404')).senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.zustand, 'nochInArbeit');
});

test('senden: 558 wirft und trägt alles mit', async () => {
  const elda = mitAntwort(sendenAntwort('558'));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaStatusError);
      assert.equal(err.statusCode, '558');
      assert.equal(err.meldung, 'M-558');
      assert.equal((err.ergebnis as { statusCode: string }).statusCode, '558');
      assert.equal((err.ergebnis as { ok: boolean }).ok, false);
      return true;
    },
  );
});

test('auflisten: 000 liefert die Liste direkt', async () => {
  const elda = mitAntwort(
    auflistenAntwort(
      '000',
      '<ruecksendungen><dateiName>fehler_155764331</dateiName><protokollnummer>155764332</protokollnummer></ruecksendungen>' +
        '<ruecksendungen><dateiName>ok_155764340</dateiName><protokollnummer>155764341</protokollnummer></ruecksendungen>',
    ),
  );
  const liste = await elda.ruecksendungenAuflisten();
  assert.equal(liste.length, 2);
  assert.equal(liste[0]?.protokollnummer, '155764332');
  assert.equal(liste[1]?.dateiName, 'ok_155764340');
});

test('auflisten: leere Liste bedeutet eindeutig "keine offen"', async () => {
  assert.deepEqual(await mitAntwort(auflistenAntwort('000')).ruecksendungenAuflisten(), []);
});

test('auflisten: statusCode "constructor" wirft, statt über die Prototyp-Kette eine leere Liste vorzutäuschen', async () => {
  // Regressionstest zur Object.hasOwn-Absicherung in zustandOderWurf: Ohne sie würde
  // `AUFLISTEN_ZUSTAENDE['constructor']` über Object.prototype auflösen, kein `undefined`
  // liefern, und `ruecksendungenAuflisten` gäbe fälschlich eine leere Liste zurück — genau
  // das "keine Rücksendungen offen", das laut diesem Umbau eindeutig sein soll.
  await assert.rejects(
    () => mitAntwort(auflistenAntwort('constructor')).ruecksendungenAuflisten(),
    (err: unknown) => {
      assert.ok(err instanceof EldaStatusError);
      assert.equal(err.statusCode, 'constructor');
      return true;
    },
  );
});

test('auflisten: 557 wirft, statt eine leere Liste vorzutäuschen', async () => {
  await assert.rejects(
    () => mitAntwort(auflistenAntwort('557')).ruecksendungenAuflisten(),
    (err: unknown) => {
      assert.ok(err instanceof EldaStatusError);
      assert.equal(err.statusCode, '557');
      return true;
    },
  );
});

test('empfangen: 000 liefert zustand datei mit Inhalt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const elda = mitAntwort(
    empfangenAntwort(
      '000',
      `<datei><id>199565708</id><name>mitteilung.xml</name><dateiTyp>1</dateiTyp><md5>abc</md5><payload>${b64}</payload></datei>`,
    ),
  );
  const erg = await elda.empfangen('155764332');
  assert.equal(erg.zustand, 'datei');
  if (erg.zustand !== 'datei') return; // Verengung für TypeScript
  assert.equal(erg.datei.name, 'mitteilung.xml');
  assert.equal(erg.datei.dateiTyp, 1);
  assert.equal(erg.datei.md5, 'abc');
  assert.equal(erg.datei.inhalt.toString('utf8'), '<protokoll/>');
  assert.equal(erg.statusCode, '000');
  assert.equal(erg.meldung, 'M-000');
});

test('empfangen: 406 und 408 sind Zustände, kein Fehler', async () => {
  const nichtVorhanden = await mitAntwort(empfangenAntwort('406')).empfangen('1');
  assert.equal(nichtVorhanden.zustand, 'nichtVorhanden');
  assert.equal(nichtVorhanden.statusCode, '406');
  assert.equal(nichtVorhanden.meldung, 'M-406');
  assert.equal((await mitAntwort(empfangenAntwort('408')).empfangen('1')).zustand, 'bereitsEmpfangen');
  assert.equal((await mitAntwort(empfangenAntwort('404')).empfangen('1')).zustand, 'nochInArbeit');
});

test('empfangen: 407 wirft', async () => {
  await assert.rejects(() => mitAntwort(empfangenAntwort('407')).empfangen('1'), EldaStatusError);
});

test('roh: empfangen bleibt bei 407 wurffrei, obwohl die komfortable Variante dort wirft', async () => {
  const erg = await mitAntwort(empfangenAntwort('407')).roh.empfangen('1');
  assert.equal(erg.ok, false);
  assert.equal(erg.statusCode, '407');
});

test('empfangen: 000 ohne <datei> wirft, statt eine leere Datei vorzutäuschen', async () => {
  await assert.rejects(() => mitAntwort(empfangenAntwort('000')).empfangen('1'), EldaProtocolError);
});

test('empfangen: 000 ohne <datei> — Fehlertext nennt Status-Code/Meldung, ergebnis ist gesetzt', async () => {
  await assert.rejects(
    () => mitAntwort(empfangenAntwort('000')).empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /000/);
      assert.match(err.message, /M-000/);
      assert.equal((err.ergebnis as EmpfangenErgebnis).statusCode, '000');
      return true;
    },
  );
});

test('empfangen: 408 mit <datei> ist ein Widerspruch — Inhalt bleibt über den Fehler erreichbar', async () => {
  const inhalt = '<protokoll/>';
  const b64 = Buffer.from(inhalt).toString('base64');
  const elda = mitAntwort(
    empfangenAntwort('408', `<datei><name>mitteilung.xml</name><payload>${b64}</payload></datei>`),
  );
  await assert.rejects(
    () => elda.empfangen('1'),
    (err: unknown) => {
      assert.ok(err instanceof EldaProtocolError);
      assert.match(err.message, /408/);
      // Der Fehlertext darf NICHT zu einem zweiten Abholversuch anleiten — `empfangen` ist
      // einmalig, ein erneuter Aufruf wäre kein verlässlicher Weg an den Inhalt.
      assert.ok(!err.message.includes('elda.roh.empfangen'));
      const ergebnis = err.ergebnis as EmpfangenErgebnis;
      assert.equal(ergebnis.statusCode, '408');
      assert.equal(ergebnis.datei?.inhalt.toString('utf8'), inhalt);
      return true;
    },
  );
  // Eigenständiger Beleg, dass die rohe Schicht bei 408 grundsätzlich nicht wirft — unabhängig
  // vom obigen Fehler, nicht als empfohlener zweiter Versuch nach ihm.
  const roh = await elda.roh.empfangen('1');
  assert.equal(roh.statusCode, '408');
  assert.equal(roh.datei?.inhalt.toString('utf8'), inhalt);
});

test('roh: fachliche Codes werfen dort weiterhin nicht', async () => {
  const elda = mitAntwort(sendenAntwort('558'));
  const erg = await elda.roh.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.ok, false);
  assert.equal(erg.statusCode, '558');
  assert.equal(erg.meldung, 'M-558');
});

test('roh: auflisten und empfangen bleiben ebenfalls wurffrei', async () => {
  const a = await mitAntwort(auflistenAntwort('557')).roh.ruecksendungenAuflisten();
  assert.equal(a.ok, false);
  assert.deepEqual(a.ruecksendungen, []);
  const e = await mitAntwort(empfangenAntwort('406')).roh.empfangen('1');
  assert.equal(e.ok, false);
  assert.equal(e.datei, undefined);
});

test('beide Wege benutzen denselben Transport (eine Konfiguration)', async () => {
  const ziele: string[] = [];
  const elda = createEldaTransfer(
    cfg(async (url: string) => {
      ziele.push(url);
      return new Response(sendenAntwort('000', '<protokollnummer>1</protokollnummer>'), { status: 200 });
    }),
  );
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  await elda.roh.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(ziele.length, 2);
  assert.equal(ziele[0], ziele[1]);
  assert.equal(ziele[0], 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
});

test('elda.roh bleibt über mehrere Zugriffe und Methodenaufrufe hinweg dieselbe Instanz', async () => {
  const elda = mitAntwort(sendenAntwort('000', '<protokollnummer>1</protokollnummer>'));
  const rohVorher = elda.roh;
  assert.equal(elda.roh, rohVorher);
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(elda.roh, rohVorher);
  await elda.roh.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(elda.roh, rohVorher);
});
