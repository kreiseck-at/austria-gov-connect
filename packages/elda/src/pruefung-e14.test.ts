import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lohnzettelSaetze, type Lohnzettel } from './lohnzettel';
import {
  L16_GEPRUEFT,
  L16_NICHT_GEPRUEFT,
  L16_OFFEN,
  NUMERISCH_KATALOG,
  pruefeLohnzettel,
  steuernummerPruefzifferGueltig,
  VORZEICHEN_KATALOG,
  vsnrPruefzifferGueltig,
  type LohnzettelPruefOptionen,
} from './pruefung-e14';
import { L16_PRUEFKATALOG } from './pruefkatalog-l16';
import { BESTAND_OPT, LOHNZETTEL_2026, UEBERMITTLUNG_2026 } from './testdaten-l16.test';

/** Prüft genau einen Lohnzettel und liefert die Codes der Befunde. */
function codes(lz: Lohnzettel): string[] {
  const saetze = lohnzettelSaetze({ ...UEBERMITTLUNG_2026, lohnzettel: [lz] }, BESTAND_OPT.erstellt);
  return pruefeLohnzettel(saetze, '28').map((b) => b.code);
}

const mit = (
  felder: Record<string, string | undefined> = {},
  betraege: Record<string, number | undefined> = {},
): Lohnzettel => ({
  ...LOHNZETTEL_2026,
  felder: { ...LOHNZETTEL_2026.felder, ...felder },
  betraege: { ...LOHNZETTEL_2026.betraege, ...betraege },
});

test('Stimmiger Lohnzettel: keine Befunde', () => {
  assert.deepEqual(codes(LOHNZETTEL_2026), []);
});

test('Jede nachgerechnete Regel steht im Katalog', () => {
  for (const code of L16_GEPRUEFT) assert.ok(L16_PRUEFKATALOG.has(code), code);
  assert.equal(L16_GEPRUEFT.length + L16_NICHT_GEPRUEFT.length, L16_PRUEFKATALOG.size);
});

test('Befund trägt Status, Indikation und Fehlertext des Katalogs', () => {
  const saetze = lohnzettelSaetze(
    { ...UEBERMITTLUNG_2026, lohnzettel: [mit({}, { B230: 600_000 })] },
    BESTAND_OPT.erstellt,
  );
  const befund = pruefeLohnzettel(saetze, '28').find((b) => b.code === 'F4800');
  assert.deepEqual(befund, {
    code: 'F4800',
    lohnzettel: 1,
    status: 'N',
    indikation: 'N',
    meldung: 'Betrag KZ 230 rechnerisch unrichtig',
  });
});

test('Summenregeln mit den Toleranzen des Katalogs', () => {
  // F4800: KZ 230 = insgesamt einbehalten − KZ 225 − KZ 226, ± 1,00 €
  assert.ok(!codes(mit({}, { B230: 685_100 })).includes('F4800'));
  assert.ok(codes(mit({}, { B230: 685_101 })).includes('F4800'));
  // F7004: KZ 260 = einbehaltene LSt − LSt mit festen Sätzen, ± 0,20 €
  assert.ok(!codes(mit({}, { B260: 356_240 })).includes('F7004'));
  assert.ok(codes(mit({}, { B260: 356_241 })).includes('F7004'));
  // F6401: KZ 245 aus KZ 210, 215, 220, 230, 243, ± 1,00 €
  assert.ok(codes(mit({}, { B245: 2_900_000 })).includes('F6401'));
  // F6201: KZ 243 = Summe der übrigen Abzüge (Formel 2026), ± 0,40 €
  assert.ok(codes(mit({}, { B243: 10_000, B245: 2_905_000 })).includes('F6201'));
  assert.ok(!codes(mit({}, { B243: 10_000, BPEN: 10_000, BPEND: 1_000, B245: 2_905_000 })).includes('F6201'));
});

test('Geschlecht und Beschäftigungsform: genau eine Angabe', () => {
  assert.ok(codes(mit({ GESW: 'J', GESM: 'J' })).includes('F2801'));
  assert.ok(codes(mit({ GESW: undefined })).includes('F2801'));
  assert.ok(codes(mit({ TEIL: 'J' })).includes('F3001'));
});

test('Lohnzettelart begrenzt die Regeln: KZ 225 bei Art 3 und 4 unzulässig', () => {
  assert.ok(codes(mit({ ARTL: '03' })).includes('F4402'));
  assert.ok(!codes(LOHNZETTEL_2026).includes('F4402'));
});

test('Unzulässige Lohnzettelart: nur F1100', () => {
  assert.deepEqual(codes(mit({ ARTL: '10' })), ['F1100']);
});

test('Zeitraum: Ende vor Beginn, Übermittlung vor dem Ende, Aufrollungszeitraum', () => {
  assert.ok(codes(mit({ BELZ: '0107', ENLZ: '3006' })).includes('F1603'));
  // DTUE 15.01.2027 — ein Lohnzettel bis 31.12.2026 ist nicht „vor dem Ende" übermittelt
  assert.ok(!codes(LOHNZETTEL_2026).includes('F1703'));
  const mai = lohnzettelSaetze(UEBERMITTLUNG_2026, new Date('2027-05-04T10:00:00+02:00'));
  assert.deepEqual(
    pruefeLohnzettel(mai, '28').map((b) => b.code),
    ['F1706'],
  );
});

test('Plausibilitätsgrenzen in Euro', () => {
  assert.ok(codes(mit({}, { B215: 930_001, SB681: 930_001 })).includes('F3805'));
  assert.ok(codes(mit({}, { SB681: 720_001, B215: 720_001 })).includes('F9710'));
  assert.ok(codes(mit({}, { MARAB: 100_001 })).includes('F9743'));
});

test('Kinderblock: Codes je Kind (KA…, KB…) und Abgleich mit der Anzahl', () => {
  const kind = {
    KFAM: 'Weinzierl',
    KVON: 'Livia',
    KSTAAT: 'A',
    KVSNR: '1235150315',
    KAFBZ: 'J',
    KBGFP: '01',
    KEGFP: '12',
  };
  // Familienbonus Plus 2.000 € senkt die Jahressteuer nach Tarif auf
  // max(0; 3.798,40 − 2.000) − 496 + 259,80 = 1.562,20 — sonst schlüge F7003 an.
  const ok: Lohnzettel = {
    ...mit({ BFABO: 'J', KFABO: '1' }, { FABO: 200_000, BIEL: 156_220, B260: 156_220 }),
    kinder: [kind],
  };
  assert.deepEqual(codes(ok), []);
  // FABO über 12 × 166,68 €
  assert.ok(codes({ ...ok, betraege: { ...ok.betraege, FABO: 200_017 } }).includes('F9230'));
  // zweites Kind ohne Antragsteller, Anzahl nicht nachgezogen
  const zwei = codes({ ...ok, kinder: [kind, { ...kind, KAFBZ: undefined }] });
  assert.ok(zwei.includes('KB42'));
  assert.ok(zwei.includes('F9213'));
  assert.ok(!zwei.includes('KA42'));
});

test('Version 29: kein Katalog, keine Prüfung', () => {
  const saetze = lohnzettelSaetze({ ...UEBERMITTLUNG_2026, version: '29', jahr: 2027 }, BESTAND_OPT.erstellt);
  assert.throws(() => pruefeLohnzettel(saetze, '29'), /kein Prüfkatalog/);
});

// --- Regeln auf dem rohen Satz ---------------------------------------------

/**
 * Baut den Lohnzettel, ändert danach Felder im fertigen L1-Satz und prüft —
 * so, wie ein von Hand oder aus einer anderen Quelle zusammengestellter Satz
 * ankäme. Der Bau selbst ließe die meisten dieser Werte gar nicht zu.
 */
function roh(
  aenderung: Record<string, string>,
  lz: Lohnzettel = LOHNZETTEL_2026,
  optionen: LohnzettelPruefOptionen = {},
): string[] {
  const [info, l1] = lohnzettelSaetze({ ...UEBERMITTLUNG_2026, lohnzettel: [lz] }, BESTAND_OPT.erstellt);
  const satz = { ...l1!, werte: { ...l1!.werte, ...aenderung } };
  return pruefeLohnzettel([info!, satz], '28', optionen).map((b) => b.code);
}

test('Offene Codes: jeder mit Begründung, keiner doppelt', () => {
  assert.deepEqual(Object.keys(L16_OFFEN).sort(), [...L16_NICHT_GEPRUEFT].sort());
  assert.equal(L16_GEPRUEFT.length, 327);
});

test('Vorzeichen nach dem Katalog: leer und erlaubte Zeichen gehen, andere nicht', () => {
  for (const [code, [feld, erlaubt]] of Object.entries(VORZEICHEN_KATALOG)) {
    assert.ok(roh({ [feld]: '*' }).includes(code), `${code}: '*' in ${feld}`);
    assert.ok(!roh({ [feld]: '+' }).includes(code), `${code}: '+' in ${feld}`);
    assert.ok(!roh({ [feld]: '' }).includes(code), `${code}: leer in ${feld}`);
    assert.equal(roh({ [feld]: '-' }).includes(code), !erlaubt.includes('-'), `${code}: '-' in ${feld}`);
  }
});

test('Katalog strenger als die Feldtabelle: „-" zu den insgesamt einbehaltenen Beiträgen ist F4100', () => {
  // VORZEICHEN_L1 (DM-Org) erlaubt bei VIEB „+" und „-", der Katalog nur „+".
  assert.ok(roh({ VIEB: '-' }).includes('F4100'));
});

test('Numerische Felder: Ziffern und leer gehen, anderes ist „unzulässiger Wert"', () => {
  for (const [code, feld] of Object.entries(NUMERISCH_KATALOG)) {
    assert.ok(roh({ [feld]: '12a' }).includes(code), `${code}: '12a' in ${feld}`);
    assert.ok(!roh({ [feld]: '' }).includes(code), `${code}: leer in ${feld}`);
    assert.ok(!roh({ [feld]: '0' }).includes(code), `${code}: 0 in ${feld}`);
  }
});

test('Kopf: Satzart, Art der Übermittlung, Datum, Uhrzeit, Fehlermeldung, TTMM', () => {
  assert.ok(roh({ FSART: 'I' }).includes('F0100'));
  assert.ok(roh({ ARTU: 'X' }).includes('F0700'));
  assert.ok(!roh({ ARTU: 'A' }).includes('F0700'));
  assert.ok(roh({ DTUE: '20270230' }).includes('F0800'));
  assert.ok(roh({ ZTUE: '246000' }).includes('F0900'));
  assert.ok(!roh({ ZTUE: '' }).includes('F0900'));
  assert.ok(!roh({ FEHL: '1100KB00' }).includes('F1200'), 'F1100 und KB00 sind Codes des Katalogs');
  assert.ok(roh({ FEHL: '9999' }).includes('F1200'));
  assert.ok(roh({ FEHL: 'F110' }).includes('F1200'));
  assert.ok(roh({ BELZ: '1.01' }).includes('F1502'));
  assert.ok(roh({ ENLZ: '31 2' }).includes('F1602'));
});

test('Übermittlungsdatum in der Zukunft: nur mit dem Tag des Einlangens', () => {
  // Die Testdaten übermitteln am 15.01.2027.
  assert.ok(!roh({}).includes('F0800'));
  assert.ok(!roh({}, LOHNZETTEL_2026, { heute: new Date('2027-01-15T08:00:00+01:00') }).includes('F0800'));
  assert.ok(roh({}, LOHNZETTEL_2026, { heute: new Date('2027-01-14T23:30:00+01:00') }).includes('F0800'));
});

test('Versicherungsnummer: Geburtsdatum (F2000) und Prüfziffer (F2001)', () => {
  assert.ok(roh({ AGBD: '320180' }).includes('F2000'));
  // Fiktive Monate 13 bis 16 nur mit Laufnummer
  assert.ok(!roh({ AGBD: '011380' }).includes('F2000'));
  assert.ok(roh({ AVLN: '0000', AGBD: '011380' }).includes('F2000'));
  assert.ok(roh({ AVLN: '1234' }).includes('F2001'));
  assert.ok(!roh({ AVLN: '1237' }).includes('F2001'));
});

test('Prüfziffer der Versicherungsnummer nach der Anfragebeantwortung 4690/AB', () => {
  assert.ok(vsnrPruefzifferGueltig('1237010180'));
  assert.ok(!vsnrPruefzifferGueltig('1234010180'));
  // Laufnummer 100 mit 01.01.80 ergibt Rest 10 — keine Prüfziffer ist gültig.
  for (let p = 0; p <= 9; p++) assert.ok(!vsnrPruefzifferGueltig(`100${p}010180`), `P = ${p}`);
  assert.ok(!vsnrPruefzifferGueltig('123701018'));
});

test('Prüfziffer der Steuernummer nach STUZZA „Finanzamtszahlung in MBS"', () => {
  // Beispiel des Dokuments: 26–913572–9
  assert.ok(steuernummerPruefzifferGueltig('269135729'));
  assert.ok(!steuernummerPruefzifferGueltig('269135728'));
  assert.ok(steuernummerPruefzifferGueltig('911234565'), 'Ersatz-Steuernummer 91-123/4565');
  assert.ok(roh({ STNRA: '911234566' }).includes('F9991'));
  assert.ok(!roh({}).includes('F9991'));
  // Achtstellig: die führende 0 des Finanzamts wird vorangestellt
  assert.ok(!roh({ STNRA: '91234567' }).includes('F9991'));
  assert.ok(!roh({ STNRA: '91234567' }).includes('F9992'));
  assert.ok(roh({ STNRA: '1234567' }).includes('F9992'));
});

test('Namen und Anschrift gegen den Zeichenvorrat des Zeichensatz-Dokuments', () => {
  assert.ok(roh({ ANAM: 'Weinzierl Mirélà' }).includes('F2100'));
  assert.ok(!roh({ ANAM: "O'Neill-Weinzierl Mirela" }).includes('F2100'));
  assert.ok(roh({ AADR: 'Musterweg á' }).includes('F2300'));
  assert.ok(roh({ ALKZ: 'A1' }).includes('F2400'));
  assert.ok(!roh({ ALKZ: 'D' }).includes('F2400'));
  assert.ok(roh({ APLZ: '50á0' }).includes('F2500'));
  assert.ok(roh({ AORT: 'Salzburgá' }).includes('F2600'));
});

test('Partner: Laufnummer (F3200) und Geburtsdatum (F3300), ohne Partner keine Prüfung', () => {
  assert.ok(roh({ PVLN: '0999' }).includes('F3200'));
  assert.ok(!roh({ PVLN: '0000' }).includes('F3200'));
  assert.ok(roh({ PVLN: '1237', PGBD: '320180' }).includes('F3300'));
  assert.ok(!roh({ PVLN: '1237', PGBD: '010180' }).includes('F3300'));
  assert.ok(!roh({ PVLN: '', PGBD: '' }).includes('F3300'));
});

test('Storno durch Nullen (KORR K, KZ 210 leer): weitere Beträge sind F3602', () => {
  assert.ok(roh({ KORR: 'K', V210: '', B210: '' }).includes('F3602'));
  const alleNull = Object.fromEntries(
    ['B220', 'BIEB', 'B225', 'B230', 'B245', 'BIEL', 'B260'].map((f) => [f, '']),
  );
  assert.ok(!roh({ KORR: 'K', V210: '', B210: '', ...alleNull }).includes('F3602'));
  assert.ok(!roh({ KORR: 'S', V210: '', B210: '' }).includes('F3602'));
});

test('Aushilfskräfte und Sterbedatum (Reservefelder der Version 28)', () => {
  assert.ok(roh({ RESE_141: '1' }).includes('F9184'));
  assert.ok(!roh({ RESE_141: '' }).includes('F9184'));
  assert.ok(roh({ RESE_99: '2026' }).includes('F9802'));
  assert.ok(roh({ RESE_99: '20260230' }).includes('F9800'));
  assert.ok(!roh({ RESE_99: '00000000' }).some((c) => c.startsWith('F98')));
  const nachher = { heute: new Date('2027-01-15T10:00:00+01:00') };
  assert.ok(roh({ RESE_99: '20270120' }, LOHNZETTEL_2026, nachher).includes('F9801'));
  assert.ok(!roh({ RESE_99: '20270120' }).includes('F9801'), 'ohne Tag des Einlangens keine Prüfung');
  assert.ok(!roh({ RESE_99: '20260620' }, LOHNZETTEL_2026, nachher).some((c) => c.startsWith('F98')));
});

test('Aliquotierte Obergrenzen: gemeldet nur, was unter jeder Lesart darüber liegt', () => {
  // Ganzes Jahr: der großzügigste Anteil ist 365/360.
  assert.ok(codes(mit({ ARTL: '16' }, { BAUS: 8_500_000 })).includes('F5205'));
  assert.ok(
    !codes(mit({ ARTL: '16' }, { BAUS: 8_400_000 })).includes('F5205'),
    'über 83.160 €, aber im Spielraum',
  );
  assert.ok(codes(mit({}, { BPEN: 380_000, BPEND: 1_000 })).includes('F5402'));
  assert.ok(!codes(mit({}, { BPEN: 372_000, BPEND: 1_000 })).includes('F5402'));
  assert.ok(codes(mit({}, { BFB1: 82_000 })).includes('F7402'));
  assert.ok(!codes(mit({}, { BFB1: 81_000 })).includes('F7402'));
  assert.ok(codes(mit({}, { BFB3: 10_000 })).includes('F8202'), 'soziale Stellung unter 6');
  assert.ok(codes(mit({ SOZS: '6' }, { BFB3: 400_000 })).includes('F8202'));
  assert.ok(!codes(mit({ SOZS: '6' }, { BFB3: 390_000 })).includes('F8202'));
  assert.ok(codes(mit({}, { BPEND: 310_000 })).includes('F9121'));
  assert.ok(!codes(mit({}, { BPEND: 300_000 })).includes('F9121'));
  // Halbes Jahr: 3.000 € × 6/12 = 1.500 € (bzw. 181/360 × 3.000 €)
  const halb = { BELZ: '0101', ENLZ: '3006' };
  assert.ok(codes(mit(halb, { BPEND: 160_000 })).includes('F9121'));
  assert.ok(!codes(mit(halb, { BPEND: 150_500 })).includes('F9121'));
});

test('Aliquotierte Untergrenze F4802: nur unter dem kleinsten Anteil', () => {
  // Soziale Stellung 6, KZ 230 unter 4.500 € aliquotiert und über 9,5 % von (KZ 210 − KZ 220) = 3.420 €.
  assert.ok(codes(mit({ SOZS: '6' }, { B230: 400_000 })).includes('F4802'));
  // 4.480 € liegt unter 4.500 €, aber über 4.500 € × 364/366 — nicht unter jeder Lesart.
  assert.ok(!codes(mit({ SOZS: '6' }, { B230: 448_000 })).includes('F4802'));
  assert.ok(!codes(mit({ SOZS: '3' }, { B230: 400_000 })).includes('F4802'));
});

test('F7006 und F7010: Sollwert mit Toleranz über alle Lesarten', () => {
  // Art 4, ganzes Jahr: 20 % von (42.000 € − 7.300 € aliquotiert) liegt zwischen 6.919,72 € und 6.947,97 €.
  assert.ok(codes(mit({ ARTL: '04' })).includes('F7006'));
  assert.ok(!codes(mit({ ARTL: '04' }, { BIEL: 693_000, B260: 693_000 })).includes('F7006'));
  // Art 3, 31 Tage, 3.100 €: Sollwert 434,00 € (mit Endtag) bis 440,00 € (ohne), Toleranz ± 10 €.
  const jaenner = { ARTL: '03', BELZ: '0101', ENLZ: '3101' };
  const mit3 = (lst: number): string[] => codes(mit(jaenner, { B210: 310_000, BIEL: lst, B260: lst }));
  assert.ok(!mit3(43_700).includes('F7010'));
  assert.ok(!mit3(44_900).includes('F7010'));
  assert.ok(mit3(42_300).includes('F7010'));
  assert.ok(mit3(45_100).includes('F7010'));
});

test('Freiwilliger Lohnsteuerabzug: F7011/F7012 zusätzlich zu F7002/F7003', () => {
  const zuWenig = mit({}, { BIEL: 200_000, B260: 200_000 });
  assert.ok(codes(zuWenig).includes('F7002'));
  assert.ok(!codes(zuWenig).includes('F7011'));
  const zuWenigFreiwillig = { ...zuWenig, felder: { ...zuWenig.felder, FLABZ: 'J' } };
  assert.ok(codes(zuWenigFreiwillig).includes('F7002'));
  assert.ok(codes(zuWenigFreiwillig).includes('F7011'));
  const zuViel = mit({ FLABZ: 'J' }, { BIEL: 500_000, B260: 500_000 });
  assert.ok(codes(zuViel).includes('F7003'));
  assert.ok(codes(zuViel).includes('F7012'));
});

test('Kinderblock: Namen, Versicherungsnummer und Geburtsdatum je Kind', () => {
  const kind = {
    KFAM: 'Weinzierl',
    KVON: 'Livia',
    KSTAAT: 'A',
    KVSNR: '1235150315',
    KGEBD: '15032015',
    KAFBZ: 'J',
    KBGFP: '01',
    KEGFP: '12',
  };
  const lz = (k: Record<string, string>): Lohnzettel => ({
    ...mit({ BFABO: 'J', KFABO: '2' }, { FABO: 200_000, BIEL: 156_220, B260: 156_220 }),
    kinder: [kind, { ...kind, ...k }],
  });
  assert.deepEqual(
    codes(lz({})).filter((c) => /^K.(00|05|20|25)$/.test(c)),
    [],
  );
  assert.ok(roh({ KFAM_K2: 'Weinzierl é' }, lz({})).includes('KB00'));
  assert.ok(roh({ KVON_K2: 'Lívia' }, lz({})).includes('KB05'));
  assert.ok(roh({ KVSNR_K2: '1234010180' }, lz({})).includes('KB20'));
  assert.ok(!roh({ KGEBD_K2: '20150315' }, lz({})).includes('KB25'), 'JJJJMMTT ist ebenfalls ein Datum');
  assert.ok(roh({ KGEBD_K2: '31022015' }, lz({})).includes('KB25'));
});
