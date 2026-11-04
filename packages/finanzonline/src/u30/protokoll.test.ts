import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonProtocolError } from '@kreiseck/finanzonline-core';
import { istUebernommen, paketNrAusFilebez, parseU30Protokoll } from './protokoll';

// Echte Testprotokolle aus der FinanzOnline-DataBox vom 03.11.2026 (Testmodus T),
// nur die Steuernummer durch die Ersatznummer 911234565 ersetzt.
const KOPF = (paketNr: string, uhrzeit: string, anzahl: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><XML><ART_IDENTIFIKATIONSBEGRIFF>FASTNR</ART_IDENTIFIKATIONSBEGRIFF><IDENTIFIKATIONSBEGRIFF>911234565</IDENTIFIKATIONSBEGRIFF><PAKET_NR>${paketNr}</PAKET_NR><DATUM_ERSTELLUNG>2026-11-03</DATUM_ERSTELLUNG><UHRZEIT_ERSTELLUNG>${uhrzeit}</UHRZEIT_ERSTELLUNG><ANZAHL_ERKLAERUNGEN>${anzahl}</ANZAHL_ERKLAERUNGEN>`;
const ECHT_OK =
  KOPF('373364601', '20.20.46', '1') +
  '<TEXT>Die oben angeführte TEST-Übermittlung wurde am 03.11.2026 um 20:20:46 zur Gänze übernommen.</TEXT></XML>';
const ECHT_NOK =
  KOPF('373430707', '20.31.59', '1') +
  '<TEXT>Die oben angeführte TEST-Übermittlung wurde am 03.11.2026 um 20:31:59 nicht (vollständig) übernommen.</TEXT><SATZNR>1</SATZNR><FEHLTEXT>Die Kennzahlen 124 und 125 sind erst für Zeiträume ab 7/2026 bzw. 7-9/2026 zulässig</FEHLTEXT></XML>';
const ECHT_ZWEI =
  KOPF('373430711', '20.32.08', '2') +
  '<TEXT>Die oben angeführte TEST-Übermittlung wurde am 03.11.2026 um 20:32:08 zur Gänze übernommen.</TEXT></XML>';

test('echt, Testmodus, zur Gänze übernommen', () => {
  const p = parseU30Protokoll(ECHT_OK);
  assert.equal(p.uebermittlung, 'T');
  assert.equal(p.ergebnis, 'vollstaendig');
  assert.equal(p.paketAbgelehnt, false);
  assert.equal(p.paketNr, 373364601);
  assert.equal(p.uebermittler, '911234565');
  assert.equal(p.anzahlErklaerungen, 1);
  assert.equal(p.datum, '2026-11-03');
  assert.equal(p.uhrzeit, '20.20.46');
  assert.match(p.text ?? '', /zur Gänze übernommen/);
  assert.deepEqual(p.saetze, []);
  assert.deepEqual(p.abgelehnteSaetze, []);
  assert.deepEqual(p.unbekannteElemente, []);
});

test('echt, Testmodus, Satz 1 mit FEHLTEXT', () => {
  const p = parseU30Protokoll(ECHT_NOK);
  assert.equal(p.uebermittlung, 'T');
  assert.equal(p.ergebnis, 'teilweise');
  assert.equal(p.paketAbgelehnt, false);
  assert.equal(p.paketNr, 373430707);
  assert.deepEqual(p.abgelehnteSaetze, [1]);
  assert.deepEqual(p.saetze, [
    {
      satzNr: 1,
      fehler: ['Die Kennzahlen 124 und 125 sind erst für Zeiträume ab 7/2026 bzw. 7-9/2026 zulässig'],
    },
  ]);
});

test('echt, Testmodus, zwei Erklärungen', () => {
  const p = parseU30Protokoll(ECHT_ZWEI);
  assert.equal(p.anzahlErklaerungen, 2);
  assert.equal(p.ergebnis, 'vollstaendig');
});

test('Buffer und Byte-Order-Mark', () => {
  const p = parseU30Protokoll(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(ECHT_NOK, 'utf8')]),
  );
  assert.deepEqual(p.abgelehnteSaetze, [1]);
  assert.match(p.saetze[0]?.fehler[0] ?? '', /Zeiträume/);
});

// Konstruiert (Produktionsformat noch nicht an echten Daten gesehen; Felder laut
// BMF „Allgemeines – Protokolle", Stand 20.02.2020).
test('konstruiert: Produktion mit DRUCKTEXT/DRUCKBETRAG, deutsches Zahlformat', () => {
  const p = parseU30Protokoll(
    KOPF('1003', '10.00.00', '1') +
      '<TEXT>Die oben angeführte PRODUKTIONS-Übermittlung wurde am 10.11.2026 um 10:00:00 zur Gänze eingebracht.</TEXT>' +
      '<SATZNR>1</SATZNR><FASTNR>911234565</FASTNR><KUNDENINFO>Q3-2026</KUNDENINFO><DRUCKTEXT>Zahllast:</DRUCKTEXT><DRUCKBETRAG>2.185,34</DRUCKBETRAG></XML>',
  );
  assert.equal(p.uebermittlung, 'P');
  assert.equal(p.ergebnis, 'vollstaendig');
  assert.deepEqual(p.saetze, [
    {
      satzNr: 1,
      fastnr: '911234565',
      kundeninfo: 'Q3-2026',
      fehler: [],
      drucktext: 'Zahllast:',
      druckbetrag: { roh: '2.185,34', cent: 218534 },
    },
  ]);
  assert.deepEqual(p.abgelehnteSaetze, []);
});

test('konstruiert: Gutschrift wird negativ, Punkt als Dezimaltrenner', () => {
  const p = parseU30Protokoll(
    KOPF('1001', '10.00.00', '1') +
      '<TEXT>Die oben angeführte PRODUKTIONS-Übermittlung wurde am 10.11.2026 um 10:00:00 zur Gänze eingebracht.</TEXT>' +
      '<SATZNR>1</SATZNR><DRUCKTEXT>Gutschrift:</DRUCKTEXT><DRUCKBETRAG>999.14</DRUCKBETRAG></XML>',
  );
  assert.deepEqual(p.saetze[0]?.druckbetrag, { roh: '999.14', cent: -99914 });
});

test('konstruiert: unlesbarer DRUCKBETRAG bleibt roh erhalten', () => {
  const p = parseU30Protokoll(
    KOPF('1001', '10.00.00', '1') + '<TEXT>x</TEXT><SATZNR>1</SATZNR><DRUCKBETRAG>EUR 12</DRUCKBETRAG></XML>',
  );
  assert.deepEqual(p.saetze[0]?.druckbetrag, { roh: 'EUR 12' });
  assert.equal(p.ergebnis, 'unbekannt');
});

test('konstruiert: SATZNR INFO_DATEN → ganzes Paket abgelehnt (BMF-Tippfehler PODUKTIONS toleriert)', () => {
  const p = parseU30Protokoll(
    KOPF('1001', '10.00.00', '1') +
      '<TEXT>Die oben angeführte PODUKTIONS-Übermittlung wurde am 10.11.2026 um 10:00 nicht eingebracht.</TEXT>' +
      '<SATZNR>INFO_DATEN</SATZNR><FEHLTEXT>Steuernummer ungültig</FEHLTEXT></XML>',
  );
  assert.equal(p.uebermittlung, 'P');
  assert.equal(p.ergebnis, 'nicht');
  assert.equal(p.paketAbgelehnt, true);
  assert.deepEqual(p.saetze, [{ satzNr: 'INFO_DATEN', fehler: ['Steuernummer ungültig'] }]);
  assert.deepEqual(p.abgelehnteSaetze, []);
});

test('konstruiert: mehrere Sätze, mehrere FEHLTEXT je Satz, unbekannte Elemente', () => {
  const p = parseU30Protokoll(
    KOPF('1007', '10.00.00', '2') +
      '<TEXT>Die oben angeführte TEST-Übermittlung wurde am 10.11.2026 um 10:00:00 nicht (vollständig) übernommen.</TEXT>' +
      '<NEUES_FELD>x</NEUES_FELD><SATZNR>1</SATZNR><SATZNR>2</SATZNR><FEHLTEXT>a</FEHLTEXT><FEHLTEXT>b</FEHLTEXT><NOCH_EINS/></XML>',
  );
  assert.deepEqual(p.saetze, [
    { satzNr: 1, fehler: [] },
    { satzNr: 2, fehler: ['a', 'b'] },
  ]);
  assert.deepEqual(p.abgelehnteSaetze, [2]);
  assert.deepEqual(p.unbekannteElemente, ['NEUES_FELD', 'NOCH_EINS']);
});

test('kaputtes XML → FonProtocolError', () => {
  assert.throws(() => parseU30Protokoll('<XML><TEXT>x</XML>'), FonProtocolError);
  assert.throws(() => parseU30Protokoll(''), FonProtocolError);
});

test('falsche Wurzel → FonProtocolError', () => {
  assert.throws(() => parseU30Protokoll('<rkdbResponse/>'), FonProtocolError);
});

test('paketNrAusFilebez', () => {
  assert.equal(paketNrAusFilebez('Webservice_U30_2026-11-03-20.20.46.876000_373364601'), 373364601);
  assert.equal(paketNrAusFilebez('Webservice_U30_2026-11-10-09.00.00.000000_1003'), 1003);
  assert.equal(paketNrAusFilebez('Webservice_RKDB_2026-07-22'), undefined);
  assert.equal(paketNrAusFilebez('Webservice_U30_ohne_nummer'), undefined);
  assert.equal(paketNrAusFilebez(''), undefined);
});

// --- Fix-Durchgang nach Review ---

test('istUebernommen: nur bei positivem Beleg true, bei unbekanntem Format undefined', () => {
  assert.equal(istUebernommen(parseU30Protokoll(ECHT_OK), 1), true);
  const nok = parseU30Protokoll(ECHT_NOK);
  assert.equal(istUebernommen(nok, 1), false);
  assert.equal(istUebernommen(nok, 2), true); // „nicht (vollständig)": Sätze ohne FEHLTEXT gelten als eingebracht
  const unbekannt = parseU30Protokoll(KOPF('1', '10.00.00', '1') + '<TEXT>Verarbeitung läuft</TEXT></XML>');
  assert.equal(unbekannt.ergebnis, 'unbekannt');
  assert.equal(istUebernommen(unbekannt, 1), undefined);
  const abgelehnt = parseU30Protokoll(
    KOPF('1', '10.00.00', '1') + '<TEXT>… nicht eingebracht.</TEXT><SATZNR>INFO_DATEN</SATZNR></XML>',
  );
  assert.equal(istUebernommen(abgelehnt, 1), false);
});

test('Buffer wird nach der XML-Deklaration dekodiert (ISO-8859-1)', () => {
  const latin1 = ECHT_OK.replace('encoding="UTF-8"', 'encoding="iso-8859-1"');
  const p = parseU30Protokoll(Buffer.from(latin1, 'latin1'));
  assert.equal(p.ergebnis, 'vollstaendig');
  assert.equal(p.uebermittlung, 'T');
});

test('FEHLTEXT ohne Satz wird als Paketfehler behalten', () => {
  const p = parseU30Protokoll(
    KOPF('1', '10.00.00', '1') + '<TEXT>… nicht übernommen.</TEXT><FEHLTEXT>Paket unlesbar</FEHLTEXT></XML>',
  );
  assert.deepEqual(p.paketFehler, ['Paket unlesbar']);
  assert.deepEqual(p.unbekannteElemente, []);
});
