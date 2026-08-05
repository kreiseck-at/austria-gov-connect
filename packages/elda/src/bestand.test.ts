import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEST_MBGM,
  BEST_VERSICHERTENMELDUNG,
  SATZTRENNER,
  UVST_ELDA,
  VERSION_MBGM,
  VERSION_VERSICHERTENMELDUNG,
  baueBestand,
  baueIdentifikationsteil,
  type BestandRahmen,
  type RohSatz,
} from './bestand';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';
import { EldaError } from './errors';

const OPT: BestandRahmen = {
  bestandsbezeichnung: BEST_VERSICHERTENMELDUNG,
  satzstrukturVersion: VERSION_VERSICHERTENMELDUNG,
  seriennummer: '1234567',
  versicherungstraeger: '11',
  datentraegernummer: '000001',
  // Echter Zeitpunkt mit explizitem Offset statt Date.UTC: 09:30:15 Wiener
  // Ortszeit im Winter (CET, +01:00) — genau das steht anschließend als
  // EDAT/EZEI im Vorlaufsatz, weil baueBestand intern nach Europe/Vienna
  // umrechnet.
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
 * Abstand von Satzanfang zu Satzanfang: Satzlaenge plus Trenner. Die Saetze
 * eines Bestands sind seit 0.11.0 durch CRLF getrennt -- ELDA liest ihn
 * zeilenweise (Fehlerkatalog H.22, W4 201eLeerzeile gefunden201c).
 */
const SCHRITT = (satzlaenge: number) => satzlaenge + SATZTRENNER.length;

/** Der i-te Satz eines Bestands mit einheitlicher Satzlaenge. */
const satzNr = (bestand: Buffer, i: number, satzlaenge: number) =>
  bestand.subarray(i * SCHRITT(satzlaenge), i * SCHRITT(satzlaenge) + satzlaenge);

const satz = (werte: Record<string, string>): RohSatz => ({
  satzart: 'M3',
  werte,
  felder: FELDER_E29,
  satzlaenge: SATZLAENGE_E29,
});

test('Identifikationsteil: 20 Zeichen mit Satzart, Nummer, Trägern und Seriennummer', () => {
  const id = baueIdentifikationsteil('M3', 2, OPT);
  assert.equal(id.length, 20);
  assert.equal(id.slice(0, 2), 'M3');
  assert.equal(id.slice(2, 9), '0000002');
  assert.equal(id.slice(11, 18), '1234567');
  assert.equal(id.slice(18, 20), '11');
});

test('Bestand: Vorlaufsatz, Datensätze, Schlusssatz — alle gleich lang', () => {
  const bestand = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' })], OPT);
  // Vier Saetze plus drei Trenner dazwischen.
  assert.equal(bestand.length, SATZLAENGE_E29 * 4 + SATZTRENNER.length * 3);
  const zeile = (i: number) => satzNr(bestand, i, SATZLAENGE_E29).toString('latin1');
  assert.equal(zeile(0).slice(0, 2), '00', 'Vorlaufsatz trägt Satzart 00');
  assert.equal(zeile(1).slice(0, 2), 'M3');
  assert.equal(zeile(2).slice(0, 2), 'M3');
  assert.equal(zeile(3).slice(0, 2), '99', 'Schlusssatz trägt Satzart 99');
});

test('Satznummern beginnen bei 1 und steigen lückenlos', () => {
  const bestand = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' })], OPT);
  const nummer = (i: number) => satzNr(bestand, i, SATZLAENGE_E29).subarray(2, 9).toString('latin1');
  assert.deepEqual(
    [nummer(0), nummer(1), nummer(2), nummer(3)],
    ['0000001', '0000002', '0000003', '0000004'],
  );
});

test('Vorlaufsatz: PROJ folgt dem Testdaten-Kennzeichen, BEST der Verarbeitung', () => {
  const test = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(test.slice(20, 22), 'TM');
  assert.equal(test.slice(22, 24), 'VR');
  const echt = baueBestand([satz({ REFW: 'R' })], { ...OPT, testdaten: false }).toString('latin1');
  assert.equal(echt.slice(20, 22), 'DM');
});

// Kapitel B.3 führt jede Verarbeitung mit eigener Bestandsbezeichnung, Kapitel
// C.1 sagt dazu: Ein Datenbestand enthält Daten „zu EINER Verarbeitung". Die
// Bezeichnung ist damit keine Aufschrift, sondern die Adresse — sie entscheidet,
// wo die Sätze landen. Bis 05.08.2026 stand hier fest 'VR', auch für ein
// mBGM-Paket: Die Meldung wäre bei der Verarbeitung der Versichertenmeldungen
// abgeliefert worden.
test('Vorlaufsatz: BEST kommt aus dem Rahmen, nicht aus einer festen Vorgabe', () => {
  const mbgm = baueBestand([satz({ REFW: 'R' })], { ...OPT, bestandsbezeichnung: BEST_MBGM });
  assert.equal(mbgm.toString('latin1').slice(22, 24), 'MB');
});

// Am 05.08.2026 hat ELDA einen echten mBGM-Bestand mit drei Fehlern abgewiesen
// (Protokoll 18373113, Status 403, „nicht_uebernommen"). Zwei davon standen
// hier fest verdrahtet; der dritte war ihre Folge. Die nächsten drei Tests
// halten jeden davon fest.

test('UVST ist ED — der datenübernehmende Träger, nicht der zuständige', () => {
  // ELDA: „E6 — Datenuebernehmender Versicherungstraeger (UVST) nicht ED".
  // Kapitel D.2: „Bei Meldungen an das Datensammelsystem der Sozialversicherung
  // ist als datenübernehmender Versicherungsträger die Österreichische
  // Gesundheitskasse - ELDA, UVST = ED, anzugeben." Und ausdrücklich: „Diese
  // Angabe ist unabhängig davon, an welchen Versicherungsträger die Daten zur
  // Verarbeitung gerichtet sind."
  const b = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(b.slice(9, 11), UVST_ELDA);
  assert.equal(b.slice(18, 20), OPT.versicherungstraeger, 'VSTR bleibt der zuständige Träger');
});

test('UVST lässt sich für Clearingstellen übersteuern', () => {
  // D.2 kennt daneben nur 1L, 7L, ST (Clearingstellen) und 99 (Dachverband).
  const b = baueBestand([satz({ REFW: 'R' })], { ...OPT, datenuebernehmer: '7L' }).toString('latin1');
  assert.equal(b.slice(9, 11), '7L');
});

test('VERS folgt der Verarbeitung: 03 für VR, 02 für MB', () => {
  // ELDA: „E31 — Unbekannte Version (03) der Satzstrukturen fuer Projekt DM,
  // Bestand MB." Kapitel D.26: Die Versionsnummer ist der Überschrift jeder
  // Datensatzbeschreibung zu entnehmen — E.29 trägt Version 03, E.32 Version 02.
  const vr = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(vr.slice(149, 151), VERSION_VERSICHERTENMELDUNG);
  assert.equal(VERSION_VERSICHERTENMELDUNG, '03');

  const mb = baueBestand([satz({ REFW: 'R' })], {
    ...OPT,
    bestandsbezeichnung: BEST_MBGM,
    satzstrukturVersion: VERSION_MBGM,
  }).toString('latin1');
  assert.equal(mb.slice(149, 151), VERSION_MBGM);
  assert.equal(VERSION_MBGM, '02');
});

test('Bestandsbezeichnung: nur zweistellige Codes, sonst Abbruch vor dem Bauen', () => {
  for (const kaputt of ['', 'M', 'MBX', 'mb', 'M1']) {
    assert.throws(
      () => baueBestand([satz({ REFW: 'R' })], { ...OPT, bestandsbezeichnung: kaputt }),
      EldaError,
      `sollte abgewiesen werden: '${kaputt}'`,
    );
  }
});

test('Vorlaufsatz: Erstellungsdatum und -zeit', () => {
  const b = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(b.slice(30, 38), '03022026');
  assert.equal(b.slice(38, 44), '093015');
});

// EDAT/EZEI bilden Wiener Ortszeit ab, nicht UTC. 2025-11-30T23:30:00Z liegt
// bereits nach Ende der Sommerzeit (CET, +01:00) und ist damit 01.12.2025,
// 00:30 Uhr Wiener Zeit — der Kalendertag wandelt sich sogar. Ein
// UTC-basiertes Feld würde hier fälschlich 30.11.2025 liefern, das Kapitel
// E.29 verlangt aber VERS=03 erst ab 01.12.2025.
test('Erstellungsdatum: UTC-Tageswechsel wird zu Wiener Ortszeit umgerechnet', () => {
  const b = baueBestand([satz({ REFW: 'R' })], {
    ...OPT,
    erstellt: new Date('2025-11-30T23:30:00Z'),
  }).toString('latin1');
  assert.equal(b.slice(30, 38), '01122025');
  assert.equal(b.slice(38, 44), '003000');
});

test('Erstellungszeit: Sommerzeit (CEST, UTC+2) wandert in EZEI mit', () => {
  const b = baueBestand([satz({ REFW: 'R' })], {
    ...OPT,
    erstellt: new Date('2026-07-15T10:00:00Z'),
  }).toString('latin1');
  assert.equal(b.slice(30, 38), '15072026');
  assert.equal(b.slice(38, 44), '120000');
});

test('Erstellungszeit: Winterzeit (CET, UTC+1) wandert in EZEI mit', () => {
  const b = baueBestand([satz({ REFW: 'R' })], {
    ...OPT,
    erstellt: new Date('2026-01-15T10:00:00Z'),
  }).toString('latin1');
  assert.equal(b.slice(30, 38), '15012026');
  assert.equal(b.slice(38, 44), '110000');
});

test('Erstellungszeitpunkt: ein ungültiges Datum wirft mit klarer Aussage statt einer Feldlängen-Meldung', () => {
  assert.throws(
    () => baueBestand([satz({ REFW: 'R' })], { ...OPT, erstellt: new Date('quatsch') }),
    (fehler: unknown) => fehler instanceof EldaError && /ist kein gültiges Datum/.test(fehler.message),
  );
});

test('Vorlaufsatz: VNMF ist über mitteilungsfileVersion ansprechbar', () => {
  const b = baueBestand([satz({ REFW: 'R' })], { ...OPT, mitteilungsfileVersion: '3.0' }).toString('latin1');
  assert.equal(b.slice(241, 246), '3.0  ');
});

// Kapitel E.3: "Satzanzahl inkl. Vorlauf- und Schlusssatz" — SANZ zählt also
// den gesamten Bestand, nicht nur die Meldungssätze. Bei drei Meldungssätzen
// steht hier folglich 5 (3 Meldungssätze + Vorlauf- + Schlusssatz), was auch
// mit der Satznummer des Schlusssatzes selbst übereinstimmt.
test('Schlusssatz: Satzanzahl zählt alle Sätze inklusive Vorlauf- und Schlusssatz', () => {
  const b = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' }), satz({ REFW: 'R3' })], OPT);
  const schluss = satzNr(b, 4, SATZLAENGE_E29).toString('latin1');
  assert.equal(schluss.slice(20, 26), '000005');
});

// Kapitel E.3: ELNR "ELDA-Seriennummer" ist ausdrücklich "nur für den SV-internen
// Gebrauch" und nicht zwingend — die übermittelnde Stelle befüllt es nicht. Es
// bleibt daher auf Grundstellung (numerisch: Nullen), auch wenn eine eigene
// Seriennummer (OBUS im Identifikationsteil) bekannt ist.
test('Schlusssatz: ELNR bleibt auf Grundstellung, da SV-intern befüllt', () => {
  const b = baueBestand([satz({ REFW: 'R' })], OPT);
  const schluss = satzNr(b, 2, SATZLAENGE_E29).toString('latin1');
  assert.equal(schluss.slice(26, 32), '000000');
});

// ELDA liest den Bestand ZEILENWEISE. Beleg: Fehlerkatalog Kapitel H.22 führt
// `W4` mit dem Text „Leerzeile gefunden" — eine Leerzeile kann es nur geben,
// wenn die Datei in Zeilen zerlegt wird. Die Beobachtung dazu: Ein Bestand ohne
// Trenner wurde mit `E2` abgewiesen, „Falsche Satzlaenge! 1747 anstatt 326
// Zeichen", wobei 1747 die Länge der GESAMTEN Datei war.
test('Saetze sind durch CRLF getrennt, ohne Trenner am Ende', () => {
  const bestand = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' })], OPT);
  const roh = bestand.toString('latin1');

  // Genau drei Trenner bei vier Saetzen — keiner hinter dem letzten. Ein
  // Trenner am Ende ergaebe bei einem Leser, der auf \n aufteilt, ein leeres
  // letztes Element und damit ein `W4`.
  assert.equal(roh.split('\r\n').length - 1, 3);
  assert.ok(!roh.endsWith('\r\n'), 'kein Trenner nach dem letzten Satz');

  // Jede Zeile ist genau so lang wie die Satzlaenge des Bestands.
  for (const zeile of roh.split('\r\n')) {
    assert.equal(zeile.length, SATZLAENGE_E29);
  }
  // Und keine Zeile ist leer -- das waere `W4`.
  assert.ok(
    roh.split('\r\n').every((z) => z.trim() !== ''),
    'keine Leerzeile',
  );
});

test('leerer Bestand wirft, statt einen sinnlosen Umschlag zu liefern', () => {
  assert.throws(() => baueBestand([], OPT), EldaError);
});

// ---------------------------------------------------------------------------
// E.2 — Bestaende mit Saetzen unterschiedlicher Satzlaenge
//
// Kapitel E.2 (Seite 175): „Die Satzlänge des Vorlaufsatzes entspricht der
// Satzlänge der nachfolgenden Datensätze. Hinweis: Bei Beständen mit
// Datensätzen unterschiedlicher Satzlängen kommt die Satzlänge jenes
// Datensatzes zur Anwendung der die maximal mögliche Satzlänge im Bestand
// aufweist." Der Umschlag traegt also das Maximum, jeder Datensatz seine
// eigene Laenge. Anlassfall ist der Lohnzettel Finanz: Informationssatz I1 mit
// 1100 (E.13) vor Mitteilungssaetzen L1 mit 3500 (E.14).
//
// Die Satzlaengen hier sind bewusst frei erfunden und klein: Geprueft wird die
// Klammer um gemischte Laengen, nicht eine Feldtabelle aus E.13/E.14.
// ---------------------------------------------------------------------------

/** Ein Satz mit eigener Feldtabelle und eigener Satzlaenge, ueber die oeffentliche Schnittstelle baubar. */
const eigenerSatz = (satzart: string, satzlaenge: number): RohSatz => ({
  satzart,
  werte: { NUR: 'x' },
  felder: [
    { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
    { nr: 2, name: 'NUR', pos: 21, laenge: satzlaenge - 20, typ: 'a/n' },
  ],
  satzlaenge,
});

// Umschlag auf dem Maximum, JEDER DATENSATZ bei seiner eigenen Laenge.
//
// Von ELDA am 05.08.2026 Zeile fuer Zeile bestaetigt (Protokoll 18376033): Ein
// Bestand, in dem alle Saetze auf die groesste Laenge aufgefuellt waren, kam
// zurueck mit „Falsche Satzlaenge! 326 anstatt 305 Zeichen" fuer den PS-Satz,
// „326 anstatt 42" fuer T1 und V1 — waehrend Vorlaufsatz, G1 (dessen eigene
// Laenge 326 ist) und Schlusssatz fehlerfrei blieben.
test('E.2: Umschlag traegt das Maximum, jeder Datensatz seine eigene Laenge', () => {
  const kurz = eigenerSatz('I1', 300);
  const lang = eigenerSatz('L1', 500);
  const bestand = baueBestand([kurz, lang], OPT);

  // Vorlauf 500 + Trenner + I1 300 + Trenner + L1 500 + Trenner + Schluss 500.
  assert.equal(bestand.length, 500 + 300 + 500 + 500 + SATZTRENNER.length * 3);

  const zeilen = bestand.toString('latin1').split('\r\n');
  assert.deepEqual(
    zeilen.map((z) => z.slice(0, 2)),
    ['00', 'I1', 'L1', '99'],
  );
  // Jede Zeile traegt die Laenge IHRER Satzart.
  assert.deepEqual(
    zeilen.map((z) => z.length),
    [500, 300, 500, 500],
  );
});

test('E.2: Satznummern lueckenlos, SANZ zaehlt alle Saetze', () => {
  const bestand = baueBestand([eigenerSatz('I1', 300), eigenerSatz('L1', 500), eigenerSatz('L1', 500)], OPT);
  const zeilen = bestand.toString('latin1').split('\r\n');
  assert.deepEqual(
    zeilen.map((z) => z.slice(2, 9)),
    ['0000001', '0000002', '0000003', '0000004', '0000005'],
  );
  // SANZ steht im Schlusssatz auf Position 21..26 und zaehlt inkl. Vorlauf- und
  // Schlusssatz (Kapitel E.3) — hier 5, unabhaengig von den Satzlaengen.
  assert.equal(zeilen[4]!.slice(20, 26), '000005');
});

test('E.2: das Maximum gilt auch, wenn der laengste Satz nicht der erste ist', () => {
  const vorne = baueBestand([eigenerSatz('L1', 500), eigenerSatz('I1', 300)], OPT);
  const hinten = baueBestand([eigenerSatz('I1', 300), eigenerSatz('L1', 500)], OPT);
  // In beiden Faellen tragen Vorlauf- und Schlusssatz 500, die Datensaetze ihre
  // eigene Laenge — die Gesamtlaenge ist damit gleich.
  const erwartet = 500 + 300 + 500 + 500 + SATZTRENNER.length * 3;
  assert.equal(vorne.length, erwartet);
  assert.equal(hinten.length, erwartet);
  assert.equal(vorne.toString('latin1').split('\r\n')[1]!.slice(0, 2), 'L1');
  assert.equal(hinten.toString('latin1').split('\r\n')[1]!.slice(0, 2), 'I1');
});

test('ein Bestand aus lauter gleich langen Saetzen bleibt unveraendert', () => {
  // Eine von E.29 abweichende, aber einheitliche Satzlaenge: alle vier Saetze 300.
  // 300 statt eines kleineren Werts, weil der Vorlaufsatz aus Kapitel E.2 allein
  // schon 246 Zeichen belegt.
  const eigener = eigenerSatz('M3', 300);
  const bestand = baueBestand([eigener, eigener], OPT);
  assert.equal(bestand.length, 300 * 4 + SATZTRENNER.length * 3);
  assert.equal(satzNr(bestand, 0, 300).subarray(0, 2).toString('latin1'), '00');
  assert.equal(satzNr(bestand, 3, 300).subarray(0, 2).toString('latin1'), '99');
});

// ---------------------------------------------------------------------------
// M9 — der Identifikationsteil durchlaeuft keinen Tabellenwechsel
// ---------------------------------------------------------------------------

test('M9: der Identifikationsteil wird nicht kodiert und sofort mit latin1 zurueckgelesen', () => {
  // An acht Positionen weicht ISO-8859-15 von ISO-8859-1 ab. '€' ist eine davon: Es wurde
  // zu 0xA4 kodiert und mit latin1 als '¤' zurueckgelesen — ein Zeichen, das es in
  // ISO-8859-15 gerade nicht gibt. Der umschliessende Satz wies es dann als „nicht
  // darstellbar" ab und nannte dabei ein Zeichen, das der Aufrufer nie geschrieben hat.
  const opt = { ...OPT, versicherungstraeger: '€' };
  assert.equal(baueIdentifikationsteil('M3', 2, opt).slice(18, 20), '€ ');
  const bestand = baueBestand([satz({ REFW: 'R' })], opt);
  assert.equal(bestand[18], 0xa4, 'VSNR-Position 19 traegt das Euro-Zeichen in ISO-8859-15');
});

// ---------------------------------------------------------------------------
// D.43 — Eindeutigkeit des Referenzwerts je Beitragskontonummer
// ---------------------------------------------------------------------------

test('D.43: derselbe Referenzwert zweimal am selben Beitragskonto wird abgewiesen', () => {
  // Kapitel D.43, Seite 123: „Daher muss dieser Wert fuer alle Meldungen zu einer
  // Beitragskontonummer eindeutig sein." Ein doppelter REFW laesst eine spaetere
  // Richtigstellung oder ein Storno auf zwei Meldungen zugleich zeigen.
  const a = satz({ REFW: 'MELDE-NR-001', BKNR: '1234567', DGNA: 'Muster GmbH' });
  const b = satz({ REFW: 'MELDE-NR-001', BKNR: '1234567', DGNA: 'Muster GmbH' });
  assert.throws(
    () => baueBestand([a, b], OPT),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /MELDE-NR-001/);
      assert.match((err as Error).message, /D\.43/);
      return true;
    },
  );
});

test('D.43: Fuellzeichen aus einem zurueckgelesenen Satz aendern daran nichts', () => {
  const a = satz({ REFW: 'MELDE-NR-001', BKNR: '1234567', DGNA: 'Muster GmbH' });
  const b = satz({ REFW: 'MELDE-NR-001   ', BKNR: '1234567 ', DGNA: 'Muster GmbH' });
  assert.throws(() => baueBestand([a, b], OPT), EldaError);
});

test('D.43: verschiedene Referenzwerte am selben Konto und gleiche an verschiedenen Konten bauen', () => {
  assert.doesNotThrow(() =>
    baueBestand(
      [
        satz({ REFW: 'MELDE-NR-001', BKNR: '1234567', DGNA: 'Muster GmbH' }),
        satz({ REFW: 'MELDE-NR-002', BKNR: '1234567', DGNA: 'Muster GmbH' }),
      ],
      OPT,
    ),
  );
  // Die Quelle grenzt die Eindeutigkeit ausdruecklich auf eine Beitragskontonummer ein —
  // derselbe Wert an zwei verschiedenen Konten wird deshalb nicht abgewiesen.
  assert.doesNotThrow(() =>
    baueBestand(
      [
        satz({ REFW: 'MELDE-NR-001', BKNR: '1234567', DGNA: 'Muster GmbH' }),
        satz({ REFW: 'MELDE-NR-001', BKNR: '7654321', DGNA: 'Muster GmbH' }),
      ],
      OPT,
    ),
  );
});
