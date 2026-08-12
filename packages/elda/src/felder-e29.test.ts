import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FELDER_E29, SATZLAENGE_E29, IDENTIFIKATIONSTEIL, LAENGE_IDENTIFIKATIONSTEIL } from './felder-e29';
import { SATZTRENNER } from './bestand';
import { pruefeFeldtabelle } from './festsatz';
import { erstelleBestand } from './versichertenmeldung';
import type { BestandOptionen, RohSatz } from './bestand';

/** Rahmenangaben fuer einen Bestand — lokal, damit diese Datei unabhaengig bleibt. */
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

test('E.29: 39 Felder, lückenlos bis Position 772', () => {
  assert.equal(FELDER_E29.length, 39);
  assert.equal(SATZLAENGE_E29, 772);
  assert.doesNotThrow(() => pruefeFeldtabelle(FELDER_E29, SATZLAENGE_E29));
});

test('E.29: Stichproben gegen das Dokument', () => {
  const nach = (name: string) => FELDER_E29.find((f) => f.name === name);
  assert.deepEqual(nach('IDTEIL'), { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' });
  assert.deepEqual(nach('BKNR'), { nr: 4, name: 'BKNR', pos: 101, laenge: 10, typ: 'a/n' });
  assert.equal(nach('DGNA')?.pos, 111);
  assert.equal(nach('DGNA')?.klasse, 'unternehmen');
  assert.equal(nach('VSNR')?.pos, 315);
  assert.equal(nach('VSNR')?.typ, 'n');
  assert.equal(nach('FANA')?.klasse, 'personenname');
  assert.equal(nach('VONA')?.klasse, 'personenname');
  assert.deepEqual(nach('VWAZ'), { nr: 39, name: 'VWAZ', pos: 769, laenge: 4, typ: 'n' });
});

test('Identifikationsteil: 20 Zeichen, fünf Felder', () => {
  assert.equal(LAENGE_IDENTIFIKATIONSTEIL, 20);
  assert.equal(IDENTIFIKATIONSTEIL.length, 5);
  assert.doesNotThrow(() => pruefeFeldtabelle(IDENTIFIKATIONSTEIL, LAENGE_IDENTIFIKATIONSTEIL));
  assert.deepEqual(
    IDENTIFIKATIONSTEIL.map((f) => f.name),
    ['SART', 'SANR', 'UVST', 'OBUS', 'VSTR'],
  );
});

test('Feldnummern sind lückenlos 1..39', () => {
  assert.deepEqual(
    FELDER_E29.map((f) => f.nr),
    Array.from({ length: 39 }, (_, i) => i + 1),
  );
});

// ---------------------------------------------------------------------------
// C2: Byteposition jedes einzelnen Feldes, gegen LITERALE Offsets
// ---------------------------------------------------------------------------

/**
 * Der einzige Test, der die Eintraege von FELDER_E29 gegen etwas anderes als sich selbst
 * haelt.
 *
 * Anlass: Ein vertauschter `name` zwischen zwei gleich langen, benachbarten Feldern —
 * etwa KEAB@571 und KEBI@579 — laesst `pruefeFeldtabelle` gruen (Positionen und Laengen
 * stimmen weiter lueckenlos), und keine der uebrigen Zusicherungen des Pakets bemerkt ihn:
 *
 * - Die Bytezusicherungen in `beispiele-e29.test.ts` holen ihre Offsets ueber `FELDER_E29`
 *   selbst; ein falscher Eintrag verschiebt Erwartung und Ergebnis gemeinsam.
 * - Jedes `assert.equal(satz.werte.X, …)` in den 28 Beispieltests ist eine Tautologie:
 *   `baue()` liefert genau das Objekt zurueck, das es bekommen hat.
 *
 * Betroffen waeren REFW/REFU, KEAB/KEBI, UEAB/UEBI, BVAB/BVEN, RWUM/RUUM und RUUM/BKUM.
 * Ein REFW/REFU-Tausch etwa traege den Referenzwert jeder Meldung in den Platz der
 * urspruenglichen Meldung — bei gruener Testsuite.
 *
 * Deshalb steht die Tabelle unten AUSGESCHRIEBEN: Start- und Endoffset sind Literale,
 * nachgerechnet aus der Feldtabelle des Dokuments (Position minus 1). Sie duerfen NICHT
 * aus FELDER_E29 abgeleitet werden — genau das ist der Punkt.
 *
 * Der Satz entsteht ueber die oeffentliche `RohSatz`-Schnittstelle statt ueber einen
 * Builder, weil keine einzige Satzart alle 38 Felder zugleich belegen darf (die
 * Pflichtmatrix aus E.29.1 stellt in jeder Satzart mehrere Felder auf `-`).
 */
const ALLE_FELDER: Readonly<Record<string, string>> = {
  REFW: 'REFW-Referenzwert-dieser-Meldung',
  REFU: 'REFU-Referenzwert-Ursprungsmeldung',
  BKNR: 'BKNR012345',
  DGNA: 'DGNA Dienstgeber GmbH',
  DTEL: 'DTEL +43 1 1234567',
  MAIL: 'MAIL@example.at',
  INF1: 'INF1-0000001',
  INF2: 'INF2-0000002',
  VSNR: '1234010180',
  GEBD: '01011980',
  REFV: 'REFV-Referenzwert-VSNR-Anforderung',
  FANA: 'FANA-Familienname',
  VONA: 'VONA-Vorname',
  ADAT: '02022026',
  BDAT: '03032026',
  RDAT: '04042026',
  BBER: '05',
  GERF: 'G',
  FRDV: 'F',
  EBSV: '06062026',
  AGRD: '07',
  SAGR: 'SAGR Abmeldegrund',
  KEAB: '08082026',
  KEBI: '09092026',
  UEAB: '10102026',
  UEBI: '11112026',
  BVAB: '12122026',
  BVEN: '13012027',
  BVJN: 'B',
  UMDA: '14022027',
  RUMD: '15032027',
  SOUM: 'S',
  ZTUM: '17',
  ZKUM: 'ZKUM123456',
  RWUM: 'RWUM-Referenzwert-Ummeldung',
  RUUM: 'RUUM-Referenzwert-Ursprung-Ziel',
  BKUM: 'BKUM-Referenzwert-Zielbeitragskonto',
  VWAZ: '3712',
};

/**
 * Feldname, Startoffset, Endoffset (beide 0-basiert, Ende exklusiv) und erwarteter Inhalt.
 * Die Offsets sind von Hand aus Kapitel E.29 uebernommen und stehen bewusst als Literale.
 */
const BYTEPOSITIONEN: readonly (readonly [string, number, number, string])[] = [
  ['REFW', 20, 60, 'REFW-Referenzwert-dieser-Meldung'],
  ['REFU', 60, 100, 'REFU-Referenzwert-Ursprungsmeldung'],
  ['BKNR', 100, 110, 'BKNR012345'],
  ['DGNA', 110, 180, 'DGNA Dienstgeber GmbH'],
  ['DTEL', 180, 230, 'DTEL +43 1 1234567'],
  ['MAIL', 230, 290, 'MAIL@example.at'],
  ['INF1', 290, 302, 'INF1-0000001'],
  ['INF2', 302, 314, 'INF2-0000002'],
  ['VSNR', 314, 324, '1234010180'],
  ['GEBD', 324, 332, '01011980'],
  ['REFV', 332, 372, 'REFV-Referenzwert-VSNR-Anforderung'],
  ['FANA', 372, 442, 'FANA-Familienname'],
  ['VONA', 442, 512, 'VONA-Vorname'],
  ['ADAT', 512, 520, '02022026'],
  ['BDAT', 520, 528, '03032026'],
  ['RDAT', 528, 536, '04042026'],
  ['BBER', 536, 538, '05'],
  ['GERF', 538, 539, 'G'],
  ['FRDV', 539, 540, 'F'],
  ['EBSV', 540, 548, '06062026'],
  ['AGRD', 548, 550, '07'],
  ['SAGR', 550, 570, 'SAGR Abmeldegrund'],
  ['KEAB', 570, 578, '08082026'],
  ['KEBI', 578, 586, '09092026'],
  ['UEAB', 586, 594, '10102026'],
  ['UEBI', 594, 602, '11112026'],
  ['BVAB', 602, 610, '12122026'],
  ['BVEN', 610, 618, '13012027'],
  ['BVJN', 618, 619, 'B'],
  ['UMDA', 619, 627, '14022027'],
  ['RUMD', 627, 635, '15032027'],
  ['SOUM', 635, 636, 'S'],
  ['ZTUM', 636, 638, '17'],
  ['ZKUM', 638, 648, 'ZKUM123456'],
  ['RWUM', 648, 688, 'RWUM-Referenzwert-Ummeldung'],
  ['RUUM', 688, 728, 'RUUM-Referenzwert-Ursprung-Ziel'],
  ['BKUM', 728, 768, 'BKUM-Referenzwert-Zielbeitragskonto'],
  ['VWAZ', 768, 772, '3712'],
];

test('C2: jedes der 38 Felder steht an seiner dokumentierten Byteposition', () => {
  const satz: RohSatz = {
    satzart: 'M3',
    werte: ALLE_FELDER,
    felder: FELDER_E29,
    satzlaenge: SATZLAENGE_E29,
  };
  const bestand = erstelleBestand([satz], OPT);
  // Der Meldungssatz ist der zweite von dreien; 772 ist die Satzlaenge aus Kapitel E.29.
  // Drei Saetze zu 772, dazwischen zwei Trenner (CRLF).
  assert.equal(bestand.length, 772 * 3 + SATZTRENNER.length * 2);
  const schritt = 772 + SATZTRENNER.length;
  const meldung = bestand.subarray(schritt, schritt + 772).toString('latin1');
  assert.equal(meldung.length, 772);
  // Feld 1, Bytes 0..20: Identifikationsteil laut Kapitel E.1 — SART 'M3', SANR '0000002'
  // (zweiter Satz des Bestands), UVST 'ED', OBUS '1234567', VSTR '11'.
  //
  // UVST ist 'ED' und NICHT der zustaendige Traeger: Kapitel D.2 verlangt bei
  // Meldungen an das Datensammelsystem die OeGK-ELDA als datenuebernehmende
  // Stelle, 201eunabhaengig davon, an welchen Versicherungstraeger die Daten zur
  // Verarbeitung gerichtet sind201c. Mit dem Traeger dort weist ELDA den Bestand
  // mit E6 ab.
  assert.equal(meldung.slice(0, 20), 'M30000002ED123456711', 'IDTEIL (Bytes 0..20)');

  for (const [name, start, ende, wert] of BYTEPOSITIONEN) {
    assert.equal(
      meldung.slice(start, ende),
      wert.padEnd(ende - start, ' '),
      `${name} (Bytes ${start}..${ende})`,
    );
  }
});

test('C2: die Positionstabelle deckt den Satz ab Position 21 lueckenlos und ueberschneidungsfrei ab', () => {
  // Ohne diese Zusicherung koennte ein Feld aus BYTEPOSITIONEN herausfallen und der Test
  // oben bliebe gruen. Auch hier ausschliesslich Literale: 20 ist das Ende des
  // Identifikationsteils, 772 die Satzlaenge, 38 die Zahl der fachlichen Felder.
  assert.equal(BYTEPOSITIONEN.length, 38);
  let erwartet = 20;
  for (const [name, start, ende] of BYTEPOSITIONEN) {
    assert.equal(start, erwartet, `${name} beginnt nicht dort, wo das Vorfeld endet`);
    assert.ok(ende > start, `${name} hat keine positive Laenge`);
    erwartet = ende;
  }
  assert.equal(erwartet, 772);
  assert.equal(new Set(BYTEPOSITIONEN.map(([name]) => name)).size, 38);
});
