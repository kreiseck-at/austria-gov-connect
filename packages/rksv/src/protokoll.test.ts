import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseErgebnisprotokoll } from './protokoll';

// Echtes asynchrones rkdb-Ergebnisprotokoll aus der FinanzOnline-DataBox
// (BMF-Testzugang, erltyp=P/anbringen=RKDB, redigierte Musterdaten). Bindet die
// reale Struktur fest: die Wurzel ist <rkdbResponse> OHNE SOAP-Envelope.
const RKDB_PROTOKOLL =
  '<?xml version="1.0" encoding="UTF-8"?><rkdbResponse xmlns="https://finanzonline.bmf.gv.at/rkdb" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><fastnr>091234567</fastnr><paket_nr>20160816</paket_nr><art_uebermittlung>P</art_uebermittlung><ts_erstellung>2016-08-17T14:44:00</ts_erstellung><info>Die oben angeführte PRODUKTIONS-Übermittlung wurde nicht (vollständig) eingebracht.</info><result><satznr>1</satznr><kundeninfo>Kundeninfo</kundeninfo><rkdbMessage><rc>4</rc><msg>Mit der angegebenen Seriennummer konnte beim angegebenen Vertrauensdiensteanbieter kein Zertifikat gefunden werden.</msg></rkdbMessage></result><result><satznr>2</satznr><rkdbMessage><rc>7</rc><msg>Der Ordnungsbegriff im Zertifikat ist nicht dem registrierenden Unternehmen zugeordnet. Wenden Sie sich bitte an Ihren Vertrauensdiensteanbieter.</msg></rkdbMessage></result></rkdbResponse>';

test('parseErgebnisprotokoll: paketNr, info und beide Einzelergebnisse', () => {
  const p = parseErgebnisprotokoll(RKDB_PROTOKOLL);
  assert.equal(p.paketNr, '20160816');
  assert.match(p.info ?? '', /nicht \(vollständig\) eingebracht/);
  assert.equal(p.ergebnisse.length, 2);
});

test('parseErgebnisprotokoll: Einzelergebnisse tragen satznr/rc/msg/kundeninfo zur Zuordnung', () => {
  const p = parseErgebnisprotokoll(RKDB_PROTOKOLL);
  assert.equal(p.ergebnisse[0]?.satznr, 1);
  assert.equal(p.ergebnisse[0]?.ok, false);
  assert.equal(p.ergebnisse[0]?.rc, '4');
  assert.equal(p.ergebnisse[0]?.kundeninfo, 'Kundeninfo');
  assert.match(p.ergebnisse[0]?.msg ?? '', /kein Zertifikat gefunden/);

  assert.equal(p.ergebnisse[1]?.satznr, 2);
  assert.equal(p.ergebnisse[1]?.rc, '7');
  assert.equal(p.ergebnisse[1]?.kundeninfo, undefined);
});

test('parseErgebnisprotokoll: unbekanntes/leeres XML -> leere Ergebnisse, kein Wurf', () => {
  const p = parseErgebnisprotokoll('<foo/>');
  assert.deepEqual(p.ergebnisse, []);
  assert.equal(p.paketNr, undefined);
});
