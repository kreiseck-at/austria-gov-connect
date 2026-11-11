import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleDktAbrechnung, type DktAbrechnung, type DktFall } from './dkt-abrechnung';
import { liesDktBestand } from './dkt-lesen';
import { FACHGEBIET } from './dkt-codes';
import { DKT_EINGABEFELDER, erstelleDktTestRuecksendung, pruefeDktEingabe } from './dkt-pruefhilfen';

// Erfundene Testdaten; Prüfziffern wie in dkt-abrechnung.test.ts.
const TAXI = '123450';

const fall = (belegnummer: number, extra: Partial<DktFall> = {}): DktFall => ({
  versicherter: { traeger: '17', familienname: 'Weinzierl', vorname: 'Mirela', vsnr: '1237010180' },
  belegnummer,
  verordner: { vpnr: '600033', familienname: 'Grabner', fachgebiet: '01' },
  antragsdatum: '2026-10-01',
  transport: {
    datum: '2026-10-14',
    beginn: '07:30',
    ende: '08:10',
    von: { staat: 'AUT', plz: '5020' },
    nach: { vpnr: '543210' },
    grund: '26',
    art: '03',
    fahrzeug: '05',
    zeitkritisch: false,
    befoerderung: '1',
  },
  rechnungsnummer: `T26000100${belegnummer}`,
  leistungen: [{ position: '050', tarifCent: 186, anzahl: 20, ustProzent: 10 }],
  diagnose: { icd10: [{ code: 'N18', untergliederung1: '5' }] },
  ...extra,
});

const ABRECHNUNG: DktAbrechnung = {
  traeger: '17',
  abrechnungsstelle: '17',
  bundeslandAbrechnungsstelle: '7',
  datentraegernummer: 7,
  erstellt: new Date('2026-11-03T08:00:00Z'),
  testdaten: true,
  uebermittler: { name: 'Max Hollerer GmbH', staat: 'AUT', plz: '5020', vpnr: TAXI },
  vertragspartner: {
    vpnr: TAXI,
    adresscode: 1,
    bundesland: '7',
    fachgebietUnterteilung: '57',
    uid: 'ATU12345675',
  },
  abrechnungsjahr: 2026,
  abrechnungsmonat: 10,
  abrechnungsart: 'normal',
  rechnungsnummer: 'KT26-0001',
  rechnungsdatum: '2026-11-03',
  iban: 'AT611904300234573201',
  faelle: [
    fall(1),
    fall(2),
    fall(3, {
      leistungen: [
        { position: '050', tarifCent: 186, anzahl: 10, ustProzent: 10 },
        { position: '054', tarifCent: 1035, anzahl: 1, ustProzent: 10 },
      ],
    }),
  ],
};

test('pruefeDktEingabe: Namen ohne diakritische Zeichen, Freitext in ISO 8859-15', () => {
  assert.deepEqual(pruefeDktEingabe('familienname', 'Weinzierl'), { zulaessig: true });
  assert.deepEqual(pruefeDktEingabe('familienname', ''), { zulaessig: true });
  for (const name of ['Müller', 'Grabner-Nadler', "D'Ici", 'Weinzierl2']) {
    const p = pruefeDktEingabe('familienname', name);
    assert.equal(p.zulaessig, false, name);
    assert.match(p.zulaessig ? '' : p.meldung, /ZUNVS/);
  }
  assert.equal(pruefeDktEingabe('begruendung', 'Gehunfähig, Rückfahrt nach Dialyse').zulaessig, true);
  assert.equal(pruefeDktEingabe('transportOrt', 'St. Pölten').zulaessig, false); // Adresse: ASCII (F.1)
  assert.equal(pruefeDktEingabe('transportOrt', 'St. Poelten').zulaessig, true);
  assert.equal(pruefeDktEingabe('text', 'Kostenübernahme 12 €').zulaessig, true);
  assert.equal(pruefeDktEingabe('text', 'Fahrt ✓').zulaessig, false);
});

test('pruefeDktEingabe: Länge des Zielfelds', () => {
  assert.equal(DKT_EINGABEFELDER.vorname.laenge, 15);
  assert.equal(pruefeDktEingabe('vorname', 'A'.repeat(15)).zulaessig, true);
  // F.7.1: zu lange Namen werden gekürzt, nicht abgewiesen
  assert.deepEqual(pruefeDktEingabe('vorname', 'A'.repeat(16)), {
    zulaessig: true,
    gekuerzt: 'A'.repeat(15),
  });
  assert.equal(pruefeDktEingabe('transportOrt', 'A'.repeat(17)).zulaessig, false);
  assert.equal(pruefeDktEingabe('rechnungsnummer', 'T260001001').zulaessig, true);
  assert.equal(pruefeDktEingabe('rechnungsnummer', 'KT26-0001-1').zulaessig, false);
});

test('pruefeDktEingabe urteilt wie der Satzbau', () => {
  const mit = (familienname: string): DktAbrechnung => ({
    ...ABRECHNUNG,
    faelle: [fall(1, { versicherter: { ...fall(1).versicherter, familienname } })],
  });
  for (const name of ['Weinzierl', 'Grabner-Nadler', 'Müller', 'A'.repeat(31)]) {
    let gebaut = true;
    try {
      erstelleDktAbrechnung(mit(name));
    } catch {
      gebaut = false;
    }
    assert.equal(pruefeDktEingabe('familienname', name).zulaessig, gebaut, name);
  }
});

test('erstelleDktTestRuecksendung: alles angenommen', () => {
  const gesendet = erstelleDktAbrechnung(ABRECHNUNG);
  const tr = liesDktBestand(erstelleDktTestRuecksendung(gesendet, {}));
  const tk = liesDktBestand(gesendet);
  assert.equal(tr.rueckmeldung, true);
  assert.equal(tr.vorlauf['BEST'], 'TR');
  assert.equal(tr.faelle.length, 3);
  assert.deepEqual(
    tr.faelle.map((f) => [f.versicherter.belegnummer, f.rechnungsnummer]),
    tk.faelle.map((f) => [f.versicherter.belegnummer, f.rechnungsnummer]),
  );
  assert.equal(tr.summen[0]!.sart, '24');
  assert.equal(tr.summen[0]!.status.code, '00');
  assert.equal(tr.summen[0]!.rechnungsbetragCent, tk.summen[0]!.rechnungsbetragCent);
  assert.equal(tr.summen[0]!.rechnungsnummer, 'KT26-0001');
});

test('erstelleDktTestRuecksendung: gekürzt und abgelehnt, Summen neu gerechnet', () => {
  const gesendet = erstelleDktAbrechnung(ABRECHNUNG);
  const tr = liesDktBestand(
    erstelleDktTestRuecksendung(gesendet, {
      2: { art: 'gekuerzt', anerkanntCent: 3348, ablehnungsgrund: '76' },
      3: { art: 'abgelehnt', ablehnungsgrund: '03' },
    }),
  );
  const [a, b, c] = tr.faelle;
  assert.equal(a!.leistungen[0]!.betragCent, 3720);
  assert.equal(a!.leistungen[0]!.ablehnungsgrund, undefined);
  assert.equal(b!.leistungen[0]!.betragCent, 3348);
  assert.equal(b!.leistungen[0]!.ablehnungsgrund?.code, '76');
  assert.deepEqual(
    c!.leistungen.map((l) => [l.betragCent, l.ablehnungsgrund?.code]),
    [
      [0, '03'],
      [0, '03'],
    ],
  );
  const s = tr.summen[0]!;
  assert.equal(s.summeCent, 3720 + 3348);
  assert.equal(s.ustBetragCent, 707); // 10 % von 70,68, kaufmännisch
  assert.equal(s.rechnungsbetragCent, 7068 + 707);
  assert.equal(s.status.code, '01');
});

test('erstelleDktTestRuecksendung weist Unpassendes ab', () => {
  const gesendet = erstelleDktAbrechnung(ABRECHNUNG);
  const tr = erstelleDktTestRuecksendung(gesendet, {});
  assert.throws(() => erstelleDktTestRuecksendung(tr, {}), /BEST TK oder T1/);
  assert.throws(() => erstelleDktTestRuecksendung(gesendet, { 9: { art: 'angenommen' } }), /Belegnummer 9/);
  assert.throws(
    () => erstelleDktTestRuecksendung(gesendet, { 1: { art: 'abgelehnt', ablehnungsgrund: 'XX' } }),
    /kein Code laut D\.1/,
  );
  assert.throws(
    () =>
      erstelleDktTestRuecksendung(gesendet, {
        3: { art: 'gekuerzt', anerkanntCent: 100, ablehnungsgrund: '76' },
      }),
    /genau einer Leistung/,
  );
  assert.throws(
    () =>
      erstelleDktTestRuecksendung(gesendet, {
        1: { art: 'gekuerzt', anerkanntCent: 3720, ablehnungsgrund: '76' },
      }),
    /unter dem verrechneten/,
  );
});

test('FACHGEBIET: Katalog aus DVP D.33 für FACHU', () => {
  assert.equal(FACHGEBIET['01'], 'Allgemein-/Allgemein- und Familienmedizin');
  assert.equal(FACHGEBIET['81'], 'Ambulanzen bettenführender Krankenanstalten');
  assert.ok('85' in FACHGEBIET); // Code des Verordners im Muster E.3
  assert.equal(Object.keys(FACHGEBIET).length, 69);
  for (const code of Object.keys(FACHGEBIET)) assert.match(code, /^\d{2}$/);
});
