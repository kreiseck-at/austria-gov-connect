import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueBestand, baueIdentifikationsteil, type BestandOptionen, type RohSatz } from './bestand';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';
import { EldaError } from './errors';

const OPT: BestandOptionen = {
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
  assert.equal(bestand.length, SATZLAENGE_E29 * 4);
  const zeile = (i: number) =>
    bestand.subarray(i * SATZLAENGE_E29, (i + 1) * SATZLAENGE_E29).toString('latin1');
  assert.equal(zeile(0).slice(0, 2), '00', 'Vorlaufsatz trägt Satzart 00');
  assert.equal(zeile(1).slice(0, 2), 'M3');
  assert.equal(zeile(2).slice(0, 2), 'M3');
  assert.equal(zeile(3).slice(0, 2), '99', 'Schlusssatz trägt Satzart 99');
});

test('Satznummern beginnen bei 1 und steigen lückenlos', () => {
  const bestand = baueBestand([satz({ REFW: 'R1' }), satz({ REFW: 'R2' })], OPT);
  const nummer = (i: number) =>
    bestand.subarray(i * SATZLAENGE_E29 + 2, i * SATZLAENGE_E29 + 9).toString('latin1');
  assert.deepEqual(
    [nummer(0), nummer(1), nummer(2), nummer(3)],
    ['0000001', '0000002', '0000003', '0000004'],
  );
});

test('Vorlaufsatz: PROJ folgt dem Testdaten-Kennzeichen, BEST ist VR', () => {
  const test = baueBestand([satz({ REFW: 'R' })], OPT).toString('latin1');
  assert.equal(test.slice(20, 22), 'TM');
  assert.equal(test.slice(22, 24), 'VR');
  const echt = baueBestand([satz({ REFW: 'R' })], { ...OPT, testdaten: false }).toString('latin1');
  assert.equal(echt.slice(20, 22), 'DM');
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
  const schluss = b.subarray(4 * SATZLAENGE_E29).toString('latin1');
  assert.equal(schluss.slice(20, 26), '000005');
});

// Kapitel E.3: ELNR "ELDA-Seriennummer" ist ausdrücklich "nur für den SV-internen
// Gebrauch" und nicht zwingend — die übermittelnde Stelle befüllt es nicht. Es
// bleibt daher auf Grundstellung (numerisch: Nullen), auch wenn eine eigene
// Seriennummer (OBUS im Identifikationsteil) bekannt ist.
test('Schlusssatz: ELNR bleibt auf Grundstellung, da SV-intern befüllt', () => {
  const b = baueBestand([satz({ REFW: 'R' })], OPT);
  const schluss = b.subarray(2 * SATZLAENGE_E29).toString('latin1');
  assert.equal(schluss.slice(26, 32), '000000');
});

test('leerer Bestand wirft, statt einen sinnlosen Umschlag zu liefern', () => {
  assert.throws(() => baueBestand([], OPT), EldaError);
});

// ---------------------------------------------------------------------------
// I4 — ein Datenbestand hat genau eine Satzlaenge (Kapitel C.1.2, Seite 52)
// ---------------------------------------------------------------------------

/** Ein Satz mit eigener, kuerzerer Feldtabelle — ueber die oeffentliche RohSatz-Schnittstelle baubar. */
const kurzerSatz: RohSatz = {
  satzart: 'M3',
  werte: { NUR: 'x' },
  felder: [{ nr: 1, name: 'NUR', pos: 1, laenge: 30, typ: 'a/n' }],
  satzlaenge: 30,
};

test('I4: Saetze unterschiedlicher Laenge werden abgewiesen, statt einen unteilbaren Strom zu ergeben', () => {
  // Frueher war die Satzlaenge des Bestands das Maximum ueber die Eingabe: Vorlauf- und
  // Schlusssatz wurden auf 772 aufgefuellt, der kurze Meldungssatz aber mit 30 gebaut. Das
  // Ergebnis waren 2346 Bytes bei deklarierten 772 und SANZ = 4 — ELDA prueft Satzlaengen
  // und Satzanzahl bei der Uebernahme (Kapitel C.1.2) und weist die ganze Sendung zurueck.
  for (const saetze of [
    [satz({ REFW: 'R1' }), kurzerSatz],
    [kurzerSatz, satz({ REFW: 'R1' })],
  ]) {
    assert.throws(
      () => baueBestand(saetze, OPT),
      (err: unknown) => {
        const text = (err as Error).message;
        assert.ok(err instanceof EldaError);
        assert.match(text, /Satzlänge/);
        assert.match(text, /30/);
        assert.match(text, /772/);
        return true;
      },
    );
  }
});

test('I4: ein Bestand aus lauter gleich langen Saetzen bleibt unberuehrt', () => {
  // Eine von E.29 abweichende, aber in sich einheitliche Satzlaenge bleibt zulaessig —
  // gefordert ist Gleichheit innerhalb des Bestands, nicht ein bestimmter Wert. 300 statt
  // 30, weil der Vorlaufsatz aus Kapitel E.2 allein schon 246 Zeichen belegt.
  const eigener: RohSatz = {
    satzart: 'M3',
    werte: { NUR: 'x' },
    felder: [
      { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
      { nr: 2, name: 'NUR', pos: 21, laenge: 280, typ: 'a/n' },
    ],
    satzlaenge: 300,
  };
  const bestand = baueBestand([eigener, eigener], OPT);
  assert.equal(bestand.length, 300 * 4);
  assert.equal(bestand.subarray(0, 2).toString('latin1'), '00');
  assert.equal(bestand.subarray(900, 902).toString('latin1'), '99');
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
