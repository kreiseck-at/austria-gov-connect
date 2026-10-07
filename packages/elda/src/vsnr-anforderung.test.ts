import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vsnrAnforderung,
  erstelleVsnrAnforderungBestand,
  type VsnrAnforderungFelder,
} from './vsnr-anforderung';
import { anmeldung } from './versichertenmeldung';
import { FELDER_E30, SATZLAENGE_E30 } from './felder-e30';
import { PFLICHT_E30 } from './pflicht-e30';
import { namensVerstoss } from './pruefung-e30';
import { pruefeFeldtabelle } from './festsatz';
import { SATZTRENNER, type BestandOptionen } from './bestand';

// Erfundene Werte: Ersatznamen und Kennungen aus dem gemeinsamen Satz.
const BASIS: VsnrAnforderungFelder = {
  REFW: 'VS-2026-0001',
  BKNR: '4711815',
  DGNA: 'Bäckerei Kornblum',
  GEBD: '14031998',
  FANA: 'Weinzierl',
  VONA: 'Mirela',
  GESL: '2',
  STSL: 'AUT',
  WKFZ: 'A',
  PLZL: '5020',
  WORT: 'Salzburg',
  WSTR: 'Musterweg',
  WHNR: '1',
};

const OPT: BestandOptionen = {
  seriennummer: '1234567',
  versicherungstraeger: '17',
  datentraegernummer: '000001',
  erstellt: new Date('2026-10-12T07:15:00+02:00'),
  testdaten: true,
  hersteller: {
    name: 'Bäckerei Kornblum',
    kfz: 'A',
    plz: '5020',
    ort: 'Salzburg',
    strasse: 'Musterweg 1',
    mail: 'test@example.at',
  },
};

const fehler = (code: string) => (e: unknown) => e instanceof Error && e.message.startsWith(`${code}:`);

test('Feldtabelle E.30: lückenlos, 22 Felder, Satzlänge 688 (Seite 340)', () => {
  pruefeFeldtabelle(FELDER_E30, SATZLAENGE_E30);
  assert.equal(FELDER_E30.length, 22);
  assert.equal(SATZLAENGE_E30, 688);
});

test('Pflichtmatrix E.30.1 nennt genau die Felder der Feldtabelle ohne Identifikationsteil', () => {
  assert.deepEqual(
    Object.keys(PFLICHT_E30),
    FELDER_E30.filter((f) => f.name !== 'IDTEIL').map((f) => f.name),
  );
});

test('der Satz steht Feld für Feld an den Positionen der Feldtabelle', () => {
  const bestand = erstelleVsnrAnforderungBestand([vsnrAnforderung(BASIS)], OPT);
  const [vorlauf, satz, schluss] = bestand.toString('latin1').split(SATZTRENNER.toString('latin1'));
  const feld = (name: string): string => {
    const f = FELDER_E30.find((x) => x.name === name)!;
    return Buffer.from(satz!, 'latin1')
      .subarray(f.pos - 1, f.pos - 1 + f.laenge)
      .toString('latin1');
  };
  assert.equal(satz!.length, 688);
  assert.equal(feld('IDTEIL').slice(0, 2), 'VS');
  assert.equal(feld('REFW').trimEnd(), 'VS-2026-0001');
  assert.equal(feld('BKNR'), '4711815   ');
  assert.equal(feld('GEBD'), '14031998');
  assert.equal(feld('FANA').trimEnd(), 'Weinzierl');
  assert.equal(feld('GESL'), '2');
  assert.equal(feld('STSL'), 'AUT');
  assert.equal(feld('WKFZ'), 'A  ');
  assert.equal(feld('PLZL'), '5020     ');
  assert.equal(feld('WTUR'), ' '.repeat(10));
  // Vorlaufsatz: Bestand VS, Version 01 (Kapitel E.2; Kapitelkopf E.30).
  assert.equal(vorlauf!.slice(22, 24), 'VS');
  assert.equal(vorlauf!.slice(149, 151), '01');
  assert.equal(vorlauf!.length, 688);
  assert.equal(schluss!.length, 688);
});

test('leere Pflichtfelder tragen den Code des Prüfkatalogs', () => {
  assert.throws(() => vsnrAnforderung({ ...BASIS, REFW: '' }), fehler('F6500'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, BKNR: undefined }), fehler('F6510'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, DGNA: ' ' }), fehler('F6520'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, GEBD: '00000000' }), fehler('F6530'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, FANA: '' }), fehler('F6540'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, VONA: '' }), fehler('F6550'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, GESL: '0' }), fehler('F6560'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, STSL: '' }), fehler('F6570'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, WKFZ: '' }), fehler('F6580'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, PLZL: '' }), fehler('F6582'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, WORT: '' }), fehler('F6584'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, WSTR: '' }), fehler('F6586'));
});

test('Z1- und Z3-Felder dürfen leer bleiben', () => {
  // BASIS lässt FNA1, AKGV, AKGH, WTUR, DTEL, MAIL, INF1 und INF2 schon weg.
  assert.equal(vsnrAnforderung({ ...BASIS, WHNR: undefined }).satzart, 'VS');
});

test('F6531: Geburtsdatum mit unbekanntem Tag oder Monat ist zulässig, ein falsches Datum nicht', () => {
  assert.doesNotThrow(() => vsnrAnforderung({ ...BASIS, GEBD: '00031998' }));
  assert.doesNotThrow(() => vsnrAnforderung({ ...BASIS, GEBD: '00001998' }));
  assert.throws(() => vsnrAnforderung({ ...BASIS, GEBD: '31021998' }), fehler('F6531'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, GEBD: '14131998' }), fehler('F6531'));
});

test('F6562: Geschlecht 1, 2, 3, 4, 6, 7 laut Feldtabelle; 0 ist leer, 5 und 9 sind ungültig', () => {
  for (const g of ['1', '2', '3', '4', '6', '7'])
    assert.doesNotThrow(() => vsnrAnforderung({ ...BASIS, GESL: g }));
  assert.throws(() => vsnrAnforderung({ ...BASIS, GESL: '5' }), fehler('F6562'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, GESL: '9' }), fehler('F6562'));
});

test('F6571: Staatsangehörigkeit muss in der Staatencode-Tabelle stehen', () => {
  for (const s of ['DEU', 'stl', 'unb']) assert.doesNotThrow(() => vsnrAnforderung({ ...BASIS, STSL: s }));
  assert.throws(() => vsnrAnforderung({ ...BASIS, STSL: 'AT' }), fehler('F6571'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, STSL: 'aut' }), fehler('F6571'));
  assert.throws(() => vsnrAnforderung({ ...BASIS, STSL: 'XXX' }), fehler('F6571'));
});

test('F6541/F6551: Prüfvorschriften für Namen aus D.8/D.9', () => {
  for (const ok of ["O'Brien", 'Weinzierl-Lindmayr', 'van Kornblum', 'Grabner.']) {
    assert.doesNotThrow(() => vsnrAnforderung({ ...BASIS, FANA: ok }), ok);
  }
  for (const falsch of ['-Weinzierl', 'Weinzierl-', "Weinzierl'", 'Wein  zierl', 'Gr.abner', 'Weinzierl2']) {
    assert.throws(() => vsnrAnforderung({ ...BASIS, FANA: falsch }), fehler('F6541'), falsch);
  }
  for (const ok of ['Mirela', 'Anna-Lena', 'Mirela Livia']) {
    assert.doesNotThrow(() => vsnrAnforderung({ ...BASIS, VONA: ok }), ok);
  }
  for (const falsch of ["Mi'rela", 'Mirela-', ' Mirela']) {
    assert.throws(() => vsnrAnforderung({ ...BASIS, VONA: falsch }), fehler('F6551'), falsch);
  }
  // FNA1 fällt unter D.8, hat im Katalog aber keinen Code.
  assert.throws(() => vsnrAnforderung({ ...BASIS, FNA1: 'Kornblum-' }), fehler('D.8'));
});

test('die Meldung zur Namensregel nennt nur Stelle und Regel, nicht den Namen', () => {
  const text = namensVerstoss('Weinzierl-', 'familienname')!;
  assert.match(text, /Stelle 10/);
  assert.doesNotMatch(text, /Weinzierl/);
});

test('ein VS-Bestand nimmt keine Anmeldung auf (Kapitel C.1)', () => {
  const m3 = anmeldung({
    REFW: 'M3-1',
    BKNR: '4711815',
    DGNA: 'Bäckerei Kornblum',
    GEBD: '14031998',
    REFV: 'VS-2026-0001',
    FANA: 'Weinzierl',
    VONA: 'Mirela',
    ADAT: '12102026',
    BBER: '02',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: '4000',
  });
  assert.throws(
    () => erstelleVsnrAnforderungBestand([vsnrAnforderung(BASIS), m3], OPT),
    /nur VSNR-Anforderungen/,
  );
});

test('F6512: bei der ÖGK-V keine BKNR mit führendem Leerzeichen', () => {
  const satz = vsnrAnforderung({ ...BASIS, BKNR: ' 471181' });
  assert.throws(
    () => erstelleVsnrAnforderungBestand([satz], { ...OPT, versicherungstraeger: '19' }),
    fehler('F6512'),
  );
  assert.doesNotThrow(() => erstelleVsnrAnforderungBestand([satz], OPT));
});

test('die zugehörige Anmeldung verweist mit REFV auf die Anforderung (E.30.2)', () => {
  const vs = vsnrAnforderung(BASIS);
  const m3 = anmeldung({
    REFW: 'M3-1',
    BKNR: '4711815',
    DGNA: 'Bäckerei Kornblum',
    GEBD: vs.werte.GEBD,
    REFV: vs.werte.REFW,
    FANA: 'Weinzierl',
    VONA: 'Mirela',
    ADAT: '12102026',
    BBER: '02',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: '4000',
  });
  assert.equal(m3.werte.REFV, 'VS-2026-0001');
  assert.equal(m3.werte.VSNR, undefined);
});
