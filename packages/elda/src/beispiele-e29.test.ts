import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anmeldung,
  abmeldung,
  aenderungsmeldung,
  richtigstellungAnmeldung,
  richtigstellungAbmeldung,
  stornoAbmeldung,
  erstelleBestand,
} from './versichertenmeldung';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';
import { SATZTRENNER } from './bestand';
import type { BestandOptionen } from './bestand';

/**
 * Die Beispiele aus Kapitel E.29.2 der Organisationsbeschreibung „Datenaustausch mit
 * Dienstgebern" (42. Ergänzung – 07/2026), Seiten 305–328, als Tests. Jede Tabelle der Form
 * „Feldname | Feldbezeichnung | Wert" aus diesem Kapitel ist hier einmal erfasst; der
 * Testname nennt Satzart, Überschrift und Seite der Fundstelle.
 *
 * Diese Tests prüfen nicht unsere Lesart gegen sich selbst, sondern gegen das Dokument:
 * Werte, Satzart und Belegung stammen ausschließlich aus der jeweiligen Tabelle. Alles, was
 * darüber hinaus im Aufruf steht, verlangt die Pflichtmatrix aus Kapitel E.29.1, ohne dass
 * das Beispiel es nennt — solche Ergänzungen sind an Ort und Stelle als solche markiert.
 *
 * Zwei Umrechnungen sind dabei unvermeidlich und in jedem Test wörtlich nachvollziehbar:
 * Datumsangaben schreibt das Dokument im Fließtext als TT.MM.JJJJ, im Datensatz stehen sie
 * als TTMMJJJJ; Klartextangaben stehen als Code im Satz („Arbeiter" = BBER 01 und
 * „Angestellter" = BBER 02 laut Kapitel D.39, „Ja"/„Nein" = J/N, „Ja" bei SOUM = J).
 */

/**
 * Ergänzt gegenüber dem Dokument, weil die Pflichtmatrix (E.29.1) diese Felder für jede
 * Satzart zwingend verlangt, die Beispiele sie aber durchwegs weglassen: Referenzwert,
 * Beitragskontonummer, Dienstgebername und ein identifizierendes Feld (hier die VSNR).
 * Beispiele, die Referenzwert oder Beitragskontonummer selbst angeben, überschreiben sie.
 */
const RAHMEN = { REFW: 'REF-1', BKNR: '1234567', DGNA: 'Muster GmbH', VSNR: '1234010180' } as const;

/**
 * Ebenfalls ergänzt: Familien- und Vorname sind laut E.29.1 bei M3, M4 und M6 zwingend, bei
 * M8, M9, S3 und S4 dagegen in Grundstellung zu übermitteln. Deshalb steht diese Ergänzung
 * nur bei den drei erstgenannten Satzarten.
 */
const NAME = { FANA: 'Muster', VONA: 'Maria' } as const;

/**
 * Rahmenangaben für einen Bestand (A3), analog zu bestand.test.ts und
 * versichertenmeldung.test.ts — nur hier lokal, um diese Datei unabhängig zu halten.
 */
const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '11',
  datentraegernummer: '000001',
  erstellt: new Date('2026-02-03T09:30:15+01:00'),
  testdaten: true,
  hersteller: {
    name: 'Kreiseck',
    kfz: 'A',
    plz: '1010',
    ort: 'Wien',
    strasse: 'Teststrasse 1',
    mail: 'test@example.at',
  },
};

/**
 * Ermittelt Startposition (0-basiert) und Länge eines Feldes aus FELDER_E29 — für den
 * Byte-Durchstich unten (A3), damit die geprüften Positionen aus der Feldtabelle selbst
 * stammen und nicht ein zweites Mal von Hand abgeschrieben werden.
 */
function feldPosition(name: string): { start: number; laenge: number } {
  const feld = FELDER_E29.find((f) => f.name === name);
  assert.ok(feld, `Feld ${name} ist nicht in FELDER_E29 enthalten.`);
  return { start: feld.pos - 1, laenge: feld.laenge };
}

// ---------------------------------------------------------------------------------------
// Satzart M6 – Änderungsmeldung, Abschnitt „Beispiele:" (Seiten 308–313)
//
// Die Abschnitte stellen der jeweiligen Änderungsmeldung die Anmeldung voran, auf die sie
// sich bezieht. Beide Tabellen sind erfasst, die vorangestellte als Satzart M3.
// ---------------------------------------------------------------------------------------

test('E.29.2 / M3, Beispiel „Wechsel geringfügige Beschäftigung zu Vollversicherung zum Versicherungsbeginn", Ausgangsanmeldung (Seite 308/309)', () => {
  const satz = anmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt: FANA/VONA sind bei M3 zwingend
    ADAT: '04012019', // Anmeldedatum 04.01.2019
    BBER: '01', // Beschäftigungsbereich „Arbeiter" (D.39)
    GERF: 'J', // Geringfügigkeit „Ja"
    FRDV: 'N', // Freier Dienstvertrag „Nein"
  });
  assert.equal(satz.satzart, 'M3');
  assert.equal(satz.werte.ADAT, '04012019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'J');
  assert.equal(satz.werte.FRDV, 'N');

  // A3: Der Test oben endet am RohSatz und sichert unbelegte Felder nur als `undefined` im
  // Werteobjekt zu. Das nimmt stillschweigend an, dass `undefined` beim tatsächlichen Bau des
  // Satzes (baueSatz, über erstelleBestand) auf die dokumentierte Grundstellung abgebildet
  // wird: `00000000` bei einem numerischen Feld (hier GEBD, unbelegt, weil dieses Beispiel die
  // VSNR nutzt), Leerzeichen bei einem alphanumerischen Feld (hier REFU, für eine Anmeldung
  // ohnehin gegenstandslos). Die Positionen stammen aus FELDER_E29, nicht von Hand abgeschrieben.
  const bestand = erstelleBestand([satz], OPT);
  // Vorlaufsatz ist der erste Satz; danach folgt der Satztrenner (CRLF).
  const meldungssatzStart = SATZLAENGE_E29 + SATZTRENNER.length;

  const gebd = feldPosition('GEBD');
  assert.equal(
    bestand
      .subarray(meldungssatzStart + gebd.start, meldungssatzStart + gebd.start + gebd.laenge)
      .toString('latin1'),
    '0'.repeat(gebd.laenge),
    'unbelegtes numerisches Feld (GEBD) muss als Nullen in Grundstellung im Satz stehen',
  );

  const refu = feldPosition('REFU');
  assert.equal(
    bestand
      .subarray(meldungssatzStart + refu.start, meldungssatzStart + refu.start + refu.laenge)
      .toString('latin1'),
    ' '.repeat(refu.laenge),
    'unbelegtes alphanumerisches Feld (REFU) muss als Leerzeichen in Grundstellung im Satz stehen',
  );
});

test('E.29.2 / M6, Beispiel „Wechsel geringfügige Beschäftigung zu Vollversicherung zum Versicherungsbeginn", Änderungsmeldung (Seite 309)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt: FANA/VONA sind bei M6 zwingend
    ADAT: '04012019', // Änderungsdatum 04.01.2019
    BBER: '01', // „Arbeiter"
    GERF: 'N', // „Nein"
    FRDV: 'N', // „Nein"
  });
  assert.equal(satz.satzart, 'M6');
  assert.equal(satz.werte.ADAT, '04012019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'N');
  assert.equal(satz.werte.FRDV, 'N');
});

test('E.29.2 / M3, Beispiel „Wechsel geringfügige Beschäftigung zu Vollversicherung nicht zum Versicherungsbeginn ab Monatserstem", Ausgangsanmeldung (Seite 309)', () => {
  const satz = anmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01012019', // Anmeldedatum 01.01.2019
    BBER: '01', // „Arbeiter"
    GERF: 'J', // „Ja"
    FRDV: 'N', // „Nein"
  });
  assert.equal(satz.werte.ADAT, '01012019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'J');
  assert.equal(satz.werte.FRDV, 'N');
});

test('E.29.2 / M6, Beispiel „Wechsel geringfügige Beschäftigung zu Vollversicherung nicht zum Versicherungsbeginn ab Monatserstem", Änderungsmeldung (Seite 309)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01022019', // Änderungsdatum 01.02.2019
    BBER: '01', // „Arbeiter"
    GERF: 'N', // „Nein"
    FRDV: 'N', // „Nein"
  });
  assert.equal(satz.werte.ADAT, '01022019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'N');
  assert.equal(satz.werte.FRDV, 'N');
});

test('E.29.2 / M3, Beispiel für die Korrektur der Änderungsmeldung, Ausgangsanmeldung (Seite 310)', () => {
  const satz = anmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01012019', // Anmeldedatum 01.01.2019
    BBER: '01', // „Arbeiter"
    GERF: 'J', // „Ja"
    FRDV: 'N', // „Nein"
  });
  assert.equal(satz.werte.ADAT, '01012019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'J');
  assert.equal(satz.werte.FRDV, 'N');
});

test('E.29.2 / M6, Beispiel für die Korrektur der Änderungsmeldung, erste Änderungsmeldung vom 05.02.2019 (Seite 310)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01022019', // Änderungsdatum 01.02.2019
    BBER: '01', // „Arbeiter"
    GERF: 'N', // „Nein"
    FRDV: 'N', // „Nein"
  });
  assert.equal(satz.werte.ADAT, '01022019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'N');
  assert.equal(satz.werte.FRDV, 'N');
});

test('E.29.2 / M6, Beispiel für die Korrektur der Änderungsmeldung, korrigierende Änderungsmeldung vom 03.03.2019 (Seite 310)', () => {
  // Das Dokument (Seite 309/310): Ein Storno der Änderungsmeldung gibt es nicht, die
  // Korrektur erfolgt durch eine weitere Änderungsmeldung mit demselben Änderungsdatum.
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01022019', // Änderungsdatum 01.02.2019, unverändert
    BBER: '01', // „Arbeiter"
    GERF: 'J', // zurück auf „Ja"
    FRDV: 'N', // „Nein"
  });
  assert.equal(satz.werte.ADAT, '01022019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'J');
  assert.equal(satz.werte.FRDV, 'N');
});

test('E.29.2 / M3, Beispiel für eine Änderungsmeldung mit zeitlicher Begrenzung (Zugehörigkeit zur BUAK), Ausgangsanmeldung (Seite 310/311)', () => {
  const satz = anmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01012019', // Anmeldedatum 01.01.2019
    BBER: '01', // „Arbeiter"
    GERF: 'N', // „Nein"
    FRDV: 'N', // „Nein"
    BVAB: '01022019', // Betriebliche Vorsorge AB 01.02.2019
  });
  assert.equal(satz.werte.ADAT, '01012019');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'N');
  assert.equal(satz.werte.FRDV, 'N');
  assert.equal(satz.werte.BVAB, '01022019');
});

test('E.29.2 / M6, Beispiel für eine Änderungsmeldung mit zeitlicher Begrenzung (Zugehörigkeit zur BUAK), Änderungsmeldung (Seite 311)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '17062019', // Änderungsdatum 17.06.2019
    BDAT: '28072019', // Änderungsdatum BIS 28.07.2019
    BVJN: 'N', // Betriebliche Vorsorge N
  });
  assert.equal(satz.werte.ADAT, '17062019');
  assert.equal(satz.werte.BDAT, '28072019');
  assert.equal(satz.werte.BVJN, 'N');
  // Die Tabelle führt für diese reine BV-Änderung keine SV-Felder. Das Dokument (Seite 309)
  // verlangt BBER, GERF und FRDV gemeinsam nur „bei Änderungen im Bereich der SV".
  assert.equal(satz.werte.BBER, undefined);
  assert.equal(satz.werte.GERF, undefined);
  assert.equal(satz.werte.FRDV, undefined);
});

test('E.29.2 / M3, Beispiel für eine Änderungsmeldung mit zeitlicher Begrenzung (unbezahlter Urlaub), Ausgangsanmeldung (Seite 311)', () => {
  const satz = anmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01012024', // Anmeldedatum 01.01.2024
    BBER: '01', // „Arbeiter"
    GERF: 'N', // „Nein"
    FRDV: 'N', // „Nein"
    BVAB: '01022024', // Betriebliche Vorsorge AB 01.02.2024
  });
  assert.equal(satz.werte.ADAT, '01012024');
  assert.equal(satz.werte.BBER, '01');
  assert.equal(satz.werte.GERF, 'N');
  assert.equal(satz.werte.FRDV, 'N');
  assert.equal(satz.werte.BVAB, '01022024');
});

test('E.29.2 / M6, Beispiel für eine Änderungsmeldung mit zeitlicher Begrenzung (unbezahlter Urlaub), Änderungsmeldung (Seite 311/312)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01092024', // Änderungsdatum 01.09.2024
    BDAT: '22092024', // Änderungsdatum BIS 22.09.2024
    BVJN: 'N', // Betriebliche Vorsorge N
  });
  assert.equal(satz.werte.ADAT, '01092024');
  assert.equal(satz.werte.BDAT, '22092024');
  assert.equal(satz.werte.BVJN, 'N');
  // Wie beim BUAK-Beispiel (Seite 311): reine BV-Änderung ohne jedes SV-Feld.
  assert.equal(satz.werte.BBER, undefined);
  assert.equal(satz.werte.GERF, undefined);
  assert.equal(satz.werte.FRDV, undefined);
});

test('E.29.2 / M3, Beispiel für eine Änderungsmeldung mit zeitlicher Begrenzung (Väterfrühkarenz im öffentlichen Dienst), Ausgangsanmeldung (Seite 312)', () => {
  const satz = anmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01012024', // Anmeldedatum 01.01.2024
    BBER: '02', // Beschäftigungsbereich „Angestellter" (D.39)
    GERF: 'N', // „Nein"
    FRDV: 'N', // „Nein"
    BVAB: '01022024', // Betriebliche Vorsorge AB 01.02.2024
  });
  assert.equal(satz.werte.ADAT, '01012024');
  assert.equal(satz.werte.BBER, '02');
  assert.equal(satz.werte.GERF, 'N');
  assert.equal(satz.werte.FRDV, 'N');
  assert.equal(satz.werte.BVAB, '01022024');
});

test('E.29.2 / M6, Beispiel für eine Änderungsmeldung mit zeitlicher Begrenzung (Väterfrühkarenz im öffentlichen Dienst), Änderungsmeldung (Seite 312)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '05092024', // Änderungsdatum 05.09.2024
    BDAT: '25092024', // Änderungsdatum BIS 25.09.2024
    BVJN: 'N', // Betriebliche Vorsorge N
  });
  assert.equal(satz.werte.ADAT, '05092024');
  assert.equal(satz.werte.BDAT, '25092024');
  assert.equal(satz.werte.BVJN, 'N');
  // Wie beim BUAK-Beispiel (Seite 311): reine BV-Änderung ohne jedes SV-Feld.
  assert.equal(satz.werte.BBER, undefined);
  assert.equal(satz.werte.GERF, undefined);
  assert.equal(satz.werte.FRDV, undefined);
});

test('E.29.2 / M6, Beispiel für eine „Richtigstellung" der Änderungsmeldung, Übertritt per 01.04.2019 (Seite 313)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01042019', // Änderungsdatum 01.04.2019
    // BDAT laut Tabelle „unbelegt" — die Änderung wirkt zeitlich unbegrenzt
    BVJN: 'J', // Betriebliche Vorsorge J
  });
  assert.equal(satz.werte.ADAT, '01042019');
  assert.equal(satz.werte.BDAT, undefined);
  assert.equal(satz.werte.BVJN, 'J');
  // Wie beim BUAK-Beispiel (Seite 311): reine BV-Änderung ohne jedes SV-Feld.
  assert.equal(satz.werte.BBER, undefined);
  assert.equal(satz.werte.GERF, undefined);
  assert.equal(satz.werte.FRDV, undefined);
});

test('E.29.2 / M6, Beispiel für eine „Richtigstellung" der Änderungsmeldung, zeitlich begrenzte Nachmeldung 01.03.–31.03.2019 (Seite 313)', () => {
  const satz = aenderungsmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    ADAT: '01032019', // Änderungsdatum 01.03.2019
    BDAT: '31032019', // Änderungsdatum BIS 31.03.2019
    BVJN: 'J', // Betriebliche Vorsorge J
  });
  assert.equal(satz.werte.ADAT, '01032019');
  assert.equal(satz.werte.BDAT, '31032019');
  assert.equal(satz.werte.BVJN, 'J');
  // Wie beim BUAK-Beispiel (Seite 311): reine BV-Änderung ohne jedes SV-Feld.
  assert.equal(satz.werte.BBER, undefined);
  assert.equal(satz.werte.GERF, undefined);
  assert.equal(satz.werte.FRDV, undefined);
});

// ---------------------------------------------------------------------------------------
// Satzart M8 – Richtigstellung der Anmeldung (Seiten 314/315)
//
// Alle drei Beispiele gehören zu „Fall 2: Versicherung in der SV und BV". Sie zeigen
// dieselbe Regel aus drei Lagen heraus: Ein unbelegtes BVAB storniert die Zeit der
// betrieblichen Vorsorge genau dann, wenn deren Beginn nach dem ursprünglichen
// Anmeldedatum (ADAT) und vor dem Abmeldedatum liegt.
// ---------------------------------------------------------------------------------------

test('E.29.2 / M8, Beispiel 1: Beginn der BV liegt vor dem Anmeldedatum der richtigzustellenden Anmeldung (Seite 314)', () => {
  const satz = richtigstellungAnmeldung({
    ...RAHMEN,
    REFU: 'REF-0', // ergänzt: Referenzwert der richtigzustellenden Meldung ist bei M8 zwingend
    ADAT: '25042019', // Anmeldedatum 25.04.2019 (das ursprüngliche, falsche)
    RDAT: '28042019', // Richtiges An-/Abmeldedatum 28.04.2019
    // BVAB laut Tabelle „unbelegt" — die BV ab 01.01.2019 bleibt unverändert
  });
  assert.equal(satz.satzart, 'M8');
  assert.equal(satz.werte.ADAT, '25042019');
  assert.equal(satz.werte.RDAT, '28042019');
  assert.equal(satz.werte.BVAB, undefined);
});

test('E.29.2 / M8, Beispiel 2: Beginn der BV liegt nach dem Abmeldedatum der zugehörigen Abmeldung (Seite 314)', () => {
  const satz = richtigstellungAnmeldung({
    ...RAHMEN,
    REFU: 'REF-0', // ergänzt
    ADAT: '01012019', // Anmeldedatum 01.01.2019
    RDAT: '08012019', // Richtiges An-/Abmeldedatum 08.01.2019
    // BVAB laut Tabelle „unbelegt" — die BV ab 01.06.2019 bleibt unverändert
  });
  assert.equal(satz.werte.ADAT, '01012019');
  assert.equal(satz.werte.RDAT, '08012019');
  assert.equal(satz.werte.BVAB, undefined);
});

test('E.29.2 / M8, Beispiel 3: Beginn der BV liegt zwischen An- und Abmeldedatum der richtigzustellenden Anmeldung (Seite 315)', () => {
  const satz = richtigstellungAnmeldung({
    ...RAHMEN,
    REFU: 'REF-0', // ergänzt
    ADAT: '01012019', // Anmeldedatum 01.01.2019
    RDAT: '01012019', // Richtiges An-/Abmeldedatum 01.01.2019, also unverändert
    // BVAB laut Tabelle „unbelegt" — hier führt genau das zum Entfall der BV
  });
  assert.equal(satz.werte.ADAT, '01012019');
  assert.equal(satz.werte.RDAT, '01012019');
  assert.equal(satz.werte.BVAB, undefined);
});

// ---------------------------------------------------------------------------------------
// Satzart M9 – Richtigstellung der Abmeldung (Seite 316)
// ---------------------------------------------------------------------------------------

test('E.29.2 / M4, Beispiel zur Richtigstellung der Abmeldung, ursprüngliche Abmeldung vom 07.04.2019 (Seite 316)', () => {
  const satz = abmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt: FANA/VONA sind bei M4 zwingend
    GERF: 'N', // ergänzt: GERF ist bei M4 zwingend, das Beispiel nennt es nicht
    ADAT: '07042019', // Abmeldedatum 07.04.2019
    EBSV: '31032019', // Ende des Beschäftigungsverhältnisses 31.03.2019
    AGRD: '03', // Abmeldegrund - Code 03
    UEAB: '01042019', // Urlaubsersatzleistung ab 01.04.2019
    UEBI: '07042019', // Urlaubsersatzleistung bis 07.04.2019
    BVEN: '07042019', // Betriebliche Vorsorge ENDE 07.04.2019
  });
  assert.equal(satz.satzart, 'M4');
  assert.equal(satz.werte.ADAT, '07042019');
  assert.equal(satz.werte.EBSV, '31032019');
  assert.equal(satz.werte.AGRD, '03');
  assert.equal(satz.werte.UEAB, '01042019');
  assert.equal(satz.werte.UEBI, '07042019');
  assert.equal(satz.werte.BVEN, '07042019');
});

test('E.29.2 / M9, Beispiel zur Richtigstellung der Abmeldung, Richtigstellung vom 08.04.2019 (Seite 316)', () => {
  const satz = richtigstellungAbmeldung({
    ...RAHMEN,
    REFU: 'REF-0', // ergänzt: bei M9 zwingend
    GERF: 'N', // ergänzt: GERF ist bei M9 zwingend, das Beispiel nennt es nicht
    RDAT: '07042019', // ergänzt: RDAT ist laut E.29.1 bei M9 zwingend, das Beispiel führt
    // die Zeile nicht; das Abmeldedatum selbst bleibt hier unverändert.
    ADAT: '07042019', // Abmeldedatum 07.04.2019
    EBSV: '07042019', // Ende des Beschäftigungsverhältnisses, berichtigt auf 07.04.2019
    AGRD: '03', // Abmeldegrund - Code 03
    // UEAB und UEBI laut Tabelle „unbelegt" — dadurch entfällt die Urlaubsersatzleistung
    BVEN: '07042019', // Betriebliche Vorsorge ENDE 07.04.2019
  });
  assert.equal(satz.satzart, 'M9');
  assert.equal(satz.werte.ADAT, '07042019');
  assert.equal(satz.werte.EBSV, '07042019');
  assert.equal(satz.werte.AGRD, '03');
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '07042019');
});

// ---------------------------------------------------------------------------------------
// Ummeldung (Satzarten M4, M9, S4), Beispiele 1 bis 8 (Seiten 322–328)
//
// Das Dokument (Seite 322) lässt in diesen Beispielen VSNR, GEBD, REFV, FANA, VONA, DGNA
// und GERF „zur Vereinfachung" weg. Ergänzt wird hier je Satzart nur das, was die
// Pflichtmatrix aus E.29.1 dort auch zulässt: bei M9 und S4 sind FANA und VONA in
// Grundstellung zu übermitteln, bei S4 zusätzlich GERF.
// ---------------------------------------------------------------------------------------

test('E.29.2 / M4, Ummeldung Beispiel 1 (Ummeldung) (Seite 322/323)', () => {
  const satz = abmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt (Seite 322: „zur Vereinfachung" weggelassen)
    GERF: 'N', // ergänzt
    REFW: 'MELDE-NR-001', // Referenzwert
    BKNR: '123456', // Beitragskontonummer
    ADAT: '30042023', // An-/Abmeldedatum 30.04.2023
    // EBSV, SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    AGRD: '12', // Abmeldegrund - Code 12 (Ummeldung)
    BVEN: '30042023', // Betriebliche Vorsorge ENDE 30.04.2023
    UMDA: '01052023', // Ummeldedatum 01.05.2023
    // SOUM laut Tabelle „unbelegt"
    ZTUM: '17', // Zielversicherungsträger Ummeldung 17 (ÖGK-S)
    ZKUM: '7788991', // Beitragskontonummer Ummeldung
    RWUM: 'MELDE-NR-002', // Referenzwert Ummeldung
  });
  assert.equal(satz.satzart, 'M4');
  assert.equal(satz.werte.REFW, 'MELDE-NR-001');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '30042023');
  assert.equal(satz.werte.EBSV, undefined);
  assert.equal(satz.werte.AGRD, '12');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '30042023');
  assert.equal(satz.werte.UMDA, '01052023');
  assert.equal(satz.werte.SOUM, undefined);
  assert.equal(satz.werte.ZTUM, '17');
  assert.equal(satz.werte.ZKUM, '7788991');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-002');
});

test('E.29.2 / M9, Ummeldung Beispiel 2 (Richtigstellung der Ummeldung) (Seite 323/324)', () => {
  const satz = richtigstellungAbmeldung({
    ...RAHMEN,
    GERF: 'N', // ergänzt: bei M9 zwingend
    REFW: 'MELDE-NR-003', // Referenzwert
    REFU: 'MELDE-NR-001', // Referenzwert ursprüngliche Meldung
    BKNR: '123456', // Beitragskontonummer
    ADAT: '30042023', // An-/Abmeldedatum 30.04.2023
    RDAT: '07052023', // Richtiges An-/Abmeldedatum 07.05.2023
    // EBSV, SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    AGRD: '12', // Abmeldegrund - Code 12
    BVEN: '07052023', // Betriebliche Vorsorge ENDE 07.05.2023
    UMDA: '01052023', // Ummeldedatum 01.05.2023
    RUMD: '08052023', // Richtiges Ummeldedatum 08.05.2023
    // SOUM laut Tabelle „unbelegt"
    ZTUM: '17', // Zielversicherungsträger Ummeldung 17
    ZKUM: '7788991', // Beitragskontonummer Ummeldung
    RWUM: 'MELDE-NR-004', // Referenzwert Ummeldung
    RUUM: 'MELDE-NR-002', // Referenzwert Ummeldung ursprüngliche Meldung
    // BKUM laut Tabelle „unbelegt"
  });
  assert.equal(satz.satzart, 'M9');
  assert.equal(satz.werte.REFW, 'MELDE-NR-003');
  assert.equal(satz.werte.REFU, 'MELDE-NR-001');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '30042023');
  assert.equal(satz.werte.RDAT, '07052023');
  assert.equal(satz.werte.EBSV, undefined);
  assert.equal(satz.werte.AGRD, '12');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '07052023');
  assert.equal(satz.werte.UMDA, '01052023');
  assert.equal(satz.werte.RUMD, '08052023');
  assert.equal(satz.werte.SOUM, undefined);
  assert.equal(satz.werte.ZTUM, '17');
  assert.equal(satz.werte.ZKUM, '7788991');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-004');
  assert.equal(satz.werte.RUUM, 'MELDE-NR-002');
  assert.equal(satz.werte.BKUM, undefined);
});

test('E.29.2 / S4, Ummeldung Beispiel 3 (Storno der Ummeldung) (Seite 324)', () => {
  const satz = stornoAbmeldung({
    ...RAHMEN,
    REFW: 'MELDE-NR-005', // Referenzwert
    REFU: 'MELDE-NR-003', // Referenzwert ursprüngliche Meldung
    BKNR: '123456', // Beitragskontonummer
    ADAT: '07052023', // An-/Abmeldedatum 07.05.2023
    UMDA: '08052023', // Ummeldedatum 08.05.2023
    RWUM: 'MELDE-NR-006', // Referenzwert Ummeldung
    RUUM: 'MELDE-NR-004', // Referenzwert Ummeldung ursprüngliche Meldung
  });
  assert.equal(satz.satzart, 'S4');
  assert.equal(satz.werte.REFW, 'MELDE-NR-005');
  assert.equal(satz.werte.REFU, 'MELDE-NR-003');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '07052023');
  assert.equal(satz.werte.UMDA, '08052023');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-006');
  assert.equal(satz.werte.RUUM, 'MELDE-NR-004');
});

test('E.29.2 / M9, Ummeldung Beispiel 4 (Ummeldung nach Abmeldung) (Seite 324/325)', () => {
  const satz = richtigstellungAbmeldung({
    ...RAHMEN,
    GERF: 'N', // ergänzt
    REFW: 'MELDE-NR-008', // Referenzwert
    REFU: 'MELDE-NR-007', // Referenzwert ursprüngliche Meldung
    BKNR: '123456', // Beitragskontonummer
    ADAT: '31032023', // An-/Abmeldedatum 31.03.2023
    RDAT: '31032023', // Richtiges An-/Abmeldedatum 31.03.2023
    // EBSV, SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    AGRD: '12', // Abmeldegrund - Code 12, berichtigt von 02
    BVEN: '31032023', // Betriebliche Vorsorge ENDE 31.03.2023
    UMDA: '01042023', // Ummeldedatum 01.04.2023
    // RUMD, SOUM laut Tabelle „unbelegt"
    ZTUM: '12', // Zielversicherungsträger Ummeldung 12 (Niederösterreich)
    ZKUM: '7654321', // Beitragskontonummer Ummeldung
    RWUM: 'MELDE-NR-009', // Referenzwert Ummeldung
    // RUUM, BKUM laut Tabelle „unbelegt"
  });
  assert.equal(satz.werte.REFW, 'MELDE-NR-008');
  assert.equal(satz.werte.REFU, 'MELDE-NR-007');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '31032023');
  assert.equal(satz.werte.RDAT, '31032023');
  assert.equal(satz.werte.EBSV, undefined);
  assert.equal(satz.werte.AGRD, '12');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '31032023');
  assert.equal(satz.werte.UMDA, '01042023');
  assert.equal(satz.werte.RUMD, undefined);
  assert.equal(satz.werte.SOUM, undefined);
  assert.equal(satz.werte.ZTUM, '12');
  assert.equal(satz.werte.ZKUM, '7654321');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-009');
  assert.equal(satz.werte.RUUM, undefined);
  assert.equal(satz.werte.BKUM, undefined);
});

test('E.29.2 / M9, Ummeldung Beispiel 5 (Ummeldung mit Ziel-Beitragskonto-Korrektur) (Seite 325/326)', () => {
  const satz = richtigstellungAbmeldung({
    ...RAHMEN,
    GERF: 'N', // ergänzt
    REFW: 'MELDE-NR-010', // Referenzwert
    REFU: 'MELDE-NR-008', // Referenzwert ursprüngliche Meldung
    BKNR: '123456', // Beitragskontonummer
    ADAT: '31032023', // An-/Abmeldedatum 31.03.2023
    RDAT: '31032023', // Richtiges An-/Abmeldedatum 31.03.2023
    // EBSV, SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    AGRD: '12', // Abmeldegrund - Code 12
    BVEN: '31032023', // Betriebliche Vorsorge ENDE 31.03.2023
    UMDA: '01042023', // Ummeldedatum 01.04.2023
    RUMD: '01042023', // Richtiges Ummeldedatum 01.04.2023
    // SOUM laut Tabelle „unbelegt"
    ZTUM: '17', // Zielversicherungsträger Ummeldung 17, berichtigt von 12
    ZKUM: '7788991', // Beitragskontonummer Ummeldung, berichtigt
    RWUM: 'MELDE-NR-011', // Referenzwert Ummeldung
    RUUM: 'MELDE-NR-009', // Referenzwert Ummeldung ursprüngliche Meldung
    BKUM: 'MELDE-NR-012', // Referenzwert Ummeldung Sonderfall Zielbeitragskontoänderung
  });
  assert.equal(satz.werte.REFW, 'MELDE-NR-010');
  assert.equal(satz.werte.REFU, 'MELDE-NR-008');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '31032023');
  assert.equal(satz.werte.RDAT, '31032023');
  assert.equal(satz.werte.EBSV, undefined);
  assert.equal(satz.werte.AGRD, '12');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '31032023');
  assert.equal(satz.werte.UMDA, '01042023');
  assert.equal(satz.werte.RUMD, '01042023');
  assert.equal(satz.werte.SOUM, undefined);
  assert.equal(satz.werte.ZTUM, '17');
  assert.equal(satz.werte.ZKUM, '7788991');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-011');
  assert.equal(satz.werte.RUUM, 'MELDE-NR-009');
  assert.equal(satz.werte.BKUM, 'MELDE-NR-012');
});

test('E.29.2 / M9, Ummeldung Beispiel 6 (Aufhebung einer Ummeldung) (Seite 326/327)', () => {
  const satz = richtigstellungAbmeldung({
    ...RAHMEN,
    GERF: 'N', // ergänzt
    REFW: 'MELDE-NR-013', // Referenzwert
    REFU: 'MELDE-NR-010', // Referenzwert ursprüngliche Meldung
    BKNR: '123456', // Beitragskontonummer
    ADAT: '31032023', // An-/Abmeldedatum 31.03.2023
    RDAT: '31032023', // Richtiges An-/Abmeldedatum 31.03.2023
    EBSV: '31032023', // Ende des Beschäftigungsverhältnisses 31.03.2023
    AGRD: '02', // Abmeldegrund - Code 02 (Kündigung durch den Dienstnehmer)
    // SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    BVEN: '31032023', // Betriebliche Vorsorge ENDE 31.03.2023
    UMDA: '01042023', // Ummeldedatum 01.04.2023
    // RUMD, SOUM laut Tabelle „unbelegt"
    ZTUM: '17', // Zielversicherungsträger Ummeldung 17
    ZKUM: '7788991', // Beitragskontonummer Ummeldung
    RWUM: 'MELDE-NR-014', // Referenzwert Ummeldung
    RUUM: 'MELDE-NR-011', // Referenzwert Ummeldung ursprüngliche Meldung
    // BKUM laut Tabelle „unbelegt"
  });
  assert.equal(satz.werte.REFW, 'MELDE-NR-013');
  assert.equal(satz.werte.REFU, 'MELDE-NR-010');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '31032023');
  assert.equal(satz.werte.RDAT, '31032023');
  assert.equal(satz.werte.EBSV, '31032023');
  assert.equal(satz.werte.AGRD, '02');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '31032023');
  assert.equal(satz.werte.UMDA, '01042023');
  assert.equal(satz.werte.RUMD, undefined);
  assert.equal(satz.werte.SOUM, undefined);
  assert.equal(satz.werte.ZTUM, '17');
  assert.equal(satz.werte.ZKUM, '7788991');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-014');
  assert.equal(satz.werte.RUUM, 'MELDE-NR-011');
  assert.equal(satz.werte.BKUM, undefined);
});

test('E.29.2 / M9, Ummeldung Beispiel 7 (Sonderfall einer Ummeldung) (Seite 327/328)', () => {
  const satz = richtigstellungAbmeldung({
    ...RAHMEN,
    GERF: 'N', // ergänzt
    REFW: 'MELDE-NR-016', // Referenzwert
    REFU: 'MELDE-NR-015', // Referenzwert ursprüngliche Meldung
    BKNR: '123456', // Beitragskontonummer
    ADAT: '30062023', // An-/Abmeldedatum 30.06.2023
    RDAT: '30062023', // Richtiges An-/Abmeldedatum 30.06.2023
    // EBSV, SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    AGRD: '12', // Abmeldegrund - Code 12, berichtigt von 11
    BVEN: '30062023', // Betriebliche Vorsorge ENDE 30.06.2023
    UMDA: '01082023', // Ummeldedatum 01.08.2023
    // RUMD laut Tabelle „unbelegt"
    SOUM: 'J', // Sonderfall Ummeldung „Ja"
    ZTUM: '17', // Zielversicherungsträger Ummeldung 17
    ZKUM: '7788991', // Beitragskontonummer Ummeldung
    RWUM: 'MELDE-NR-017', // Referenzwert Ummeldung
    // RUUM, BKUM laut Tabelle „unbelegt"
  });
  assert.equal(satz.werte.REFW, 'MELDE-NR-016');
  assert.equal(satz.werte.REFU, 'MELDE-NR-015');
  assert.equal(satz.werte.BKNR, '123456');
  assert.equal(satz.werte.ADAT, '30062023');
  assert.equal(satz.werte.RDAT, '30062023');
  assert.equal(satz.werte.EBSV, undefined);
  assert.equal(satz.werte.AGRD, '12');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '30062023');
  assert.equal(satz.werte.UMDA, '01082023');
  assert.equal(satz.werte.RUMD, undefined);
  assert.equal(satz.werte.SOUM, 'J');
  assert.equal(satz.werte.ZTUM, '17');
  assert.equal(satz.werte.ZKUM, '7788991');
  assert.equal(satz.werte.RWUM, 'MELDE-NR-017');
  assert.equal(satz.werte.RUUM, undefined);
  assert.equal(satz.werte.BKUM, undefined);
});

test('E.29.2 / M4, Ummeldung Beispiel 8 (Ummeldung ohne Zielangaben) (Seite 328)', () => {
  const satz = abmeldung({
    ...RAHMEN,
    ...NAME, // ergänzt
    GERF: 'N', // ergänzt
    REFW: 'MELDE-NR-018', // Referenzwert
    BKNR: '111213', // Beitragskontonummer
    ADAT: '31122022', // An-/Abmeldedatum 31.12.2022
    // EBSV, SAGR, KEAB, KEBI, UEAB, UEBI laut Tabelle „unbelegt"
    AGRD: '12', // Abmeldegrund - Code 12
    BVEN: '31122022', // Betriebliche Vorsorge ENDE 31.12.2022
    // UMDA, SOUM, ZTUM, ZKUM, RWUM laut Tabelle „unbelegt": Das Ummeldedatum in
    // Grundstellung bringt zum Ausdruck, dass das Ziel der Ummeldung nicht bekannt ist.
  });
  assert.equal(satz.werte.REFW, 'MELDE-NR-018');
  assert.equal(satz.werte.BKNR, '111213');
  assert.equal(satz.werte.ADAT, '31122022');
  assert.equal(satz.werte.EBSV, undefined);
  assert.equal(satz.werte.AGRD, '12');
  assert.equal(satz.werte.SAGR, undefined);
  assert.equal(satz.werte.KEAB, undefined);
  assert.equal(satz.werte.KEBI, undefined);
  assert.equal(satz.werte.UEAB, undefined);
  assert.equal(satz.werte.UEBI, undefined);
  assert.equal(satz.werte.BVEN, '31122022');
  assert.equal(satz.werte.UMDA, undefined);
  assert.equal(satz.werte.SOUM, undefined);
  assert.equal(satz.werte.ZTUM, undefined);
  assert.equal(satz.werte.ZKUM, undefined);
  assert.equal(satz.werte.RWUM, undefined);
});
