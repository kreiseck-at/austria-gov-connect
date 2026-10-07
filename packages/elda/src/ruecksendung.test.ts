import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artDerRuecksendung, liesMitteilung, liesClearing } from './ruecksendung';
import { EldaProtocolError } from './errors';

// Alle Werte sind erfunden. Der Aufbau folgt den Rücksendungen, die die
// SIT-Plattform im Oktober 2026 geliefert hat, sowie den XML-Schemas
// `elda_mitteilung-3.0.xsd` (ELDA) und des Clearing-Datensatzes 2.0 (ÖGK,
// „SV-Clearingsystem: Clearing-Datensatz“).

const MITTEILUNG = `<?xml version="1.0" encoding="UTF-8"?>
<ns1:protokoll xmlns:ns1="https://online.elda.at/mitteilung/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" protokollnummer="900001" dateiname="beispiel.dat" seriennummer="999999" xsi:schemaLocation="https://online.elda.at/mitteilung/ elda_mitteilung-3.0.xsd">
  <status>uebernommen</status>
  <bestand_summen>
    <bestand code="VR">
      <meldungen_empfangen>2</meldungen_empfangen>
      <meldungen_uebernommen>2</meldungen_uebernommen>
    </bestand>
  </bestand_summen>
  <meldungen>
    <meldung status="uebernommen">
      <referenznummer>REF-1</referenznummer>
      <zeilennummer>2</zeilennummer>
    </meldung>
    <meldung status="uebernommen">
      <referenznummer>REF-2</referenznummer>
      <zeilennummer>3</zeilennummer>
    </meldung>
  </meldungen>
</ns1:protokoll>`;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

const INHALT_MBGM = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<clearingInformationenExtern xmlns="http://mvb_clearing_2_0_0.dialog.sozvers.at">
    <meldungStatus>VA</meldungStatus>
    <meldungStatusZusatz>VB</meldungStatusZusatz>
    <stornoMeldungZulaessig>J</stornoMeldungZulaessig>
    <clearingInformationExtern>
        <dringlichkeit>K</dringlichkeit>
        <informationCodeFachsystem>BW1838</informationCodeFachsystem>
        <informationTextFachsystem>Die Kombination der Tarifgruppe Arb. Lg. (Beginn der Verrechnung 01) mit der Verrechnungsbasis Allgemeine Beitragsgrundlage (AB) und Verrechnungsposition Minderung AV auf 0% (A03) ist nicht zulässig.</informationTextFachsystem>
        <clearingDatenExtern>
            <datenParameterTypeCode>3</datenParameterTypeCode>
            <datenParameterBezeichnung>Verrechnungsposition</datenParameterBezeichnung>
            <datenParameterWert>Minderung AV auf 0% (A03)</datenParameterWert>
        </clearingDatenExtern>
    </clearingInformationExtern>
    <clearingInformationExtern>
        <dringlichkeit>N</dringlichkeit>
        <informationCodeFachsystem>BW1850</informationCodeFachsystem>
        <informationTextFachsystem>Die Summe der Beiträge € +100,00 der mBGM ist nicht ident mit der von uns errechneten Summe € +104,00.</informationTextFachsystem>
        <clearingDatenExtern>
            <datenParameterTypeCode>1</datenParameterTypeCode>
            <datenParameterBezeichnung>Summe der Beiträge mBGM</datenParameterBezeichnung>
            <datenParameterWert>+100,00</datenParameterWert>
        </clearingDatenExtern>
    </clearingInformationExtern>
</clearingInformationenExtern>`;

const INHALT_ABMELDUNG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<clearingInformationenExtern xmlns="http://mvb_clearing_2_0_0.dialog.sozvers.at">
    <meldungStatus>IA</meldungStatus>
    <clearingInformationExtern>
        <dringlichkeit>D</dringlichkeit>
        <informationCodeFachsystem>VW1942</informationCodeFachsystem>
        <informationTextFachsystem>Die Abmeldung wurde nicht verarbeitet, da keine Zeit der Betrieblichen Vorsorge gespeichert ist.</informationTextFachsystem>
    </clearingInformationExtern>
</clearingInformationenExtern>`;

const dialogfall = (felder: string, version: string, inhalt: string) => `
    <dialogfall>
        <testkennzeichen>J</testkennzeichen>
        <version>ELDA_DIALOGFALL_2_0_0</version>
        <zustellungsgrund>M</zustellungsgrund>
        <meldungInfo>
            <bereitstellungsdatum>2026-04-01T00:00:00.000+02:00</bereitstellungsdatum>
            <dringlichkeit>D</dringlichkeit>
            <traegercode>17</traegercode>
            <beitragskontonummer>4711815</beitragskontonummer>
            ${felder}
        </meldungInfo>
        <meldung>
            <version>${version}</version>
            <inhalt>${inhalt}</inhalt>
        </meldung>
    </dialogfall>`;

const CLEARING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ns2:dialogfallListe xmlns:ns2="https://online_2_0.elda.at/dgdialog/">${dialogfall(
  `<referenzwert>REF-MBGM-1</referenzwert>
            <versicherungsnummer>1234010180</versicherungsnummer>
            <familienname>Muster</familienname>
            <vorname>Max</vorname>
            <fachinformation>
                <typ>Beitragszeitraum</typ>
                <wert><alphaNumerisch>03/2026</alphaNumerisch></wert>
            </fachinformation>
            <fachinformation>
                <typ>Anzahl</typ>
                <wert><numerisch>3</numerisch></wert>
            </fachinformation>
            <fachinformation>
                <typ>Stichtag</typ>
                <wert><datum>2026-03-31</datum></wert>
            </fachinformation>
            <projektCode>DM</projektCode>
            <bestandBez>MB</bestandBez>
            <satzart>G1</satzart>
            <satzartBez>Beitragsgrundlagenmeldung</satzartBez>`,
  'MVB_CLEARING_2_0_0',
  b64(INHALT_MBGM),
)}${dialogfall(
  `<referenzwert>REF-ABM-1</referenzwert>
            <versicherungsnummer>1234010180</versicherungsnummer>
            <familienname>Muster</familienname>
            <vorname>Max</vorname>
            <projektCode>DM</projektCode>
            <bestandBez>VR</bestandBez>
            <satzart>M4</satzart>
            <satzartBez>Abmeldung</satzartBez>`,
  'MVB_CLEARING_2_0_0',
  b64(INHALT_ABMELDUNG),
)}${dialogfall(
  `<referenzwert>17-Intern-D-000000000001</referenzwert>
            <versicherungsnummer>
            </versicherungsnummer>
            <familienname>
            </familienname>
            <vorname>
            </vorname>
            <projektCode>DM</projektCode>
            <bestandBez>MB</bestandBez>
            <satzart>X1</satzart>
            <satzartBez>Clearingfall ohne Bezug zu DG-Meldung</satzartBez>`,
  'MVB_IRGENDWAS_9_9_9',
  b64('<unbekannt/>'),
)}
</ns2:dialogfallListe>`;

test('artDerRuecksendung: Mitteilung, Protokoll und Clearing am Dateinamen', () => {
  assert.deepEqual(artDerRuecksendung('mitteilung_900001.xml'), {
    art: 'mitteilung',
    protokollnummer: '900001',
  });
  assert.deepEqual(artDerRuecksendung('mbd_900001_4711815'), {
    art: 'protokoll',
    protokollnummer: '900001',
    beitragskontonummer: '4711815',
  });
  assert.deepEqual(artDerRuecksendung('cm_155000001.xml'), { art: 'clearing' });
  assert.deepEqual(artDerRuecksendung('etwas_anderes.txt'), { art: 'unbekannt' });
  assert.deepEqual(artDerRuecksendung(''), { art: 'unbekannt' });
});

test('liesMitteilung: Status, Summen je Bestand und jede Meldung mit Referenznummer', () => {
  const m = liesMitteilung(MITTEILUNG);
  assert.equal(m.status, 'uebernommen');
  assert.equal(m.protokollnummer, '900001');
  assert.equal(m.dateiname, 'beispiel.dat');
  assert.deepEqual(m.bestaende, [{ code: 'VR', empfangen: 2, uebernommen: 2 }]);
  assert.deepEqual(
    m.meldungen.map((x) => [x.status, x.referenznummer, x.zeilennummer]),
    [
      ['uebernommen', 'REF-1', 2],
      ['uebernommen', 'REF-2', 3],
    ],
  );
});

test('liesMitteilung: Seriennummer und leere Codelisten bei einer übernommenen Sendung', () => {
  const m = liesMitteilung(MITTEILUNG);
  assert.equal(m.seriennummer, '999999');
  assert.deepEqual(m.codes, []);
  assert.deepEqual(m.meldungen[0]!.codes, []);
  assert.deepEqual(m.meldungen[0]!.weitere, {});
});

test('liesMitteilung: Codes je Meldung und auf Dateiebene, typ mit und ohne Präfix', () => {
  const xml = MITTEILUNG.replace('<status>uebernommen</status>', '<status>teilweise_uebernommen</status>')
    .replace(
      '<meldung status="uebernommen">\n      <referenznummer>REF-2</referenznummer>\n      <zeilennummer>3</zeilennummer>',
      '<meldung status="nicht_uebernommen">\n      <referenznummer>REF-2</referenznummer>\n      <zeilennummer>3</zeilennummer>' +
        '<codes><ns1:code ns1:typ="fehler" zeilennummer="3"><value>E99</value><elda_text>Beispieltext Fehler</elda_text></ns1:code>' +
        '<ns1:code typ="warnung" zeilennummer="3"><value>W99</value><elda_text>Beispieltext Warnung</elda_text></ns1:code></codes>',
    )
    .replace(
      '</meldungen>',
      '</meldungen><codes><ns1:code ns1:typ="fehler" zeilennummer="0"><value>E98</value><elda_text>Beispieltext Datei</elda_text></ns1:code></codes>',
    );
  const m = liesMitteilung(xml);
  assert.equal(m.status, 'teilweise_uebernommen');
  assert.deepEqual(m.meldungen[0]!.codes, []);
  assert.equal(m.meldungen[1]!.status, 'nicht_uebernommen');
  assert.deepEqual(m.meldungen[1]!.codes, [
    { code: 'E99', text: 'Beispieltext Fehler', typ: 'fehler', zeilennummer: 3 },
    { code: 'W99', text: 'Beispieltext Warnung', typ: 'warnung', zeilennummer: 3 },
  ]);
  assert.deepEqual(m.meldungen[1]!.weitere, {});
  assert.deepEqual(m.codes, [{ code: 'E98', text: 'Beispieltext Datei', typ: 'fehler', zeilennummer: 0 }]);
});

test('liesMitteilung: Status offen ohne Summen und Meldungen', () => {
  const xml =
    '<ns1:protokoll xmlns:ns1="https://online.elda.at/mitteilung/" protokollnummer="900002" dateiname="b.dat" seriennummer="999999">' +
    '<status>offen</status></ns1:protokoll>';
  const m = liesMitteilung(xml);
  assert.equal(m.status, 'offen');
  assert.deepEqual([m.bestaende, m.meldungen, m.codes], [[], [], []]);
});

test('liesMitteilung: Elemente außerhalb des Schemas gehen nicht verloren', () => {
  const xml = MITTEILUNG.replace(
    '<zeilennummer>2</zeilennummer>',
    '<zeilennummer>2</zeilennummer><zusatz>etwas Neues</zusatz>',
  );
  assert.deepEqual(liesMitteilung(xml).meldungen[0]!.weitere, { zusatz: 'etwas Neues' });
});

test('liesMitteilung: Buffer und falsches Wurzelelement', () => {
  assert.equal(liesMitteilung(Buffer.from(MITTEILUNG, 'utf8')).status, 'uebernommen');
  assert.throws(() => liesMitteilung('<anders/>'), EldaProtocolError);
});

test('liesClearing: Dialogfälle mit Meldungsinfo, Fachinformationen und dekodiertem Inhalt', () => {
  const faelle = liesClearing(CLEARING);
  assert.equal(faelle.length, 3);
  const [mbgm, abmeldung] = faelle;

  assert.equal(mbgm!.testkennzeichen, 'J');
  assert.equal(mbgm!.version, 'ELDA_DIALOGFALL_2_0_0');
  assert.equal(mbgm!.zustellungsgrund, 'M');
  assert.equal(mbgm!.bereitstellungsdatum, '2026-04-01T00:00:00.000+02:00');
  assert.equal(mbgm!.dringlichkeit, 'D');
  assert.equal(mbgm!.traegercode, '17');
  assert.equal(mbgm!.beitragskontonummer, '4711815');
  assert.equal(mbgm!.referenzwert, 'REF-MBGM-1');
  assert.equal(mbgm!.versicherungsnummer, '1234010180');
  assert.deepEqual([mbgm!.bestandBez, mbgm!.satzart], ['MB', 'G1']);
  assert.deepEqual(mbgm!.fachinformationen, [
    { typ: 'Beitragszeitraum', art: 'alphaNumerisch', wert: '03/2026' },
    { typ: 'Anzahl', art: 'numerisch', wert: '3' },
    { typ: 'Stichtag', art: 'datum', wert: '2026-03-31' },
  ]);

  const inhalt = mbgm!.meldung.inhalt!;
  assert.equal(mbgm!.meldung.version, 'MVB_CLEARING_2_0_0');
  assert.deepEqual(
    [inhalt.meldungStatus, inhalt.meldungStatusZusatz, inhalt.stornoMeldungZulaessig],
    ['VA', 'VB', 'J'],
  );
  assert.deepEqual(
    inhalt.informationen.map((i) => [i.code, i.dringlichkeit]),
    [
      ['BW1838', 'K'],
      ['BW1850', 'N'],
    ],
  );
  assert.deepEqual(inhalt.informationen[1]!.daten, [
    { typCode: '1', bezeichnung: 'Summe der Beiträge mBGM', wert: '+100,00' },
  ]);

  assert.equal(abmeldung!.meldung.inhalt!.meldungStatus, 'IA');
  assert.equal(abmeldung!.meldung.inhalt!.meldungStatusZusatz, undefined);
  assert.equal(abmeldung!.meldung.inhalt!.informationen[0]!.code, 'VW1942');
  assert.deepEqual(abmeldung!.fachinformationen, []);
});

test('liesClearing: leere Personenfelder sind undefined, unbekannte Inhaltsversion bleibt roh', () => {
  const x1 = liesClearing(CLEARING)[2]!;
  assert.equal(x1.versicherungsnummer, undefined);
  assert.equal(x1.familienname, undefined);
  assert.equal(x1.meldung.version, 'MVB_IRGENDWAS_9_9_9');
  assert.equal(x1.meldung.inhalt, undefined);
  assert.equal(x1.meldung.inhaltRoh.toString('utf8'), '<unbekannt/>');
});

test('liesClearing: falsches Wurzelelement und kaputtes Base64 werden laut gemeldet', () => {
  assert.throws(() => liesClearing('<anders/>'), EldaProtocolError);
  assert.throws(
    () => liesClearing(CLEARING.replace(b64(INHALT_ABMELDUNG), 'kein-base64!')),
    EldaProtocolError,
  );
});
