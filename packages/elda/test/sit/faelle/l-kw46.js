'use strict';

// KW46 (Zeitreise 2026/27 wie KW45): der L16-Satz über den kasseneck-Weg und der
// Start der Kette zur Höchstbeitragsgrundlage, die in KW45 nicht mehr in die Woche passte.
//
// L16: kasseneck (main, ab #881) führt das Geschlecht am Mitarbeiter (`gender`, Werte des
// Personenstands) und schreibt daraus GESW/GESM/GESD; ohne Geschlecht baut es keinen
// Lohnzettel mehr. Q55 lief in KW45 noch ohne (W 2801). Die Reihe L20–L26 rechnet die
// Monate mit der Lohnlogik von kasseneck, baut daraus den L16 wie im Produkt und sendet
// ihn mit dem echten Erstellungstag (simuliertes DTUE bringt W 0800, Q50–Q52). Personen
// aus den Testdaten, Geschlecht dort `w`/`m`/`x`.
//
//   L20  angestellte  Q55 mit Geschlecht: Halbjahr, Austritt 30.06., UZ + WR aliquot  → GESW
//   L21  reserve_2    Teilzeit-Arbeiter 20 von 40 Stunden, Halbjahr mit Sonderzahlungen  → GESM, TEIL
//   L22  arbeiterlehrling  Lehrling, Halbjahr mit Sonderzahlungen                      → SOZS 1
//   L23  reserve_1    Geschlecht „offen“ – geht wie divers in GESD                        → GESD
//   L24  angestellte  Berichtigung von L20 (KORR K, gleiche REFN, 3.100 € statt 3.000 €)
//   L25  angestellte  zweites Dienstverhältnis im selben Jahr (Wiedereintritt 01.08.)  → eigene REFN
//   L26  geringfuegig geringfügig beschäftigt, Halbjahr ohne Sonderzahlungen
//
// Höchstbeitragsgrundlage (M97 aus KW45, dessen Vorlauf Q34 nur Mo 07–09 lief): Q60 meldet
// die Angestellte auf A/14 zum 01.02.2026 an, BV ab 01.03.2026. Die mBGM 02 und 03 mit
// 9.000 € folgen am Dienstag als eigene Fälle, sobald die Mitteilung zu Q60 gelesen ist.

const { meldung } = require('../lib/bausteine');
const { kasseneckL16, kasseneckL16Lohn } = require('../lib/kasseneck');

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
/** Der L16 hängt an keinem simulierten Datum – jedes Fenster ab Montag nachmittag. */
const AB_MO_NM = ['mo-nm', 'di-vm', 'di-nm', 'mi-vm', 'mi-nm'];
const MO_NM = ['mo-nm'];
const QUELLE_L16 =
  'kasseneck main: lohnabrechnung-core.js, l16-elda-core.js (Geschlecht #881); E.14 (Version 28, Felder 28–32, ' +
  '104); Prüfkatalog L16 Version 09 (F2801)';
const QUELLE_ZR = 'SIT-Portal LOHNSOFTWAREHERSTELLER: Testkalender 2026/27, Rahmenbedingungen Zeitreise';

/** Geschlecht der Testdaten → Werte des Personenstands, wie kasseneck sie am Mitarbeiter führt. */
const PERSONENSTAND = { w: 'f', m: 'm', x: 'd' };

const tageInklusive = (von, bis) => Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000) + 1;

function monateZwischen(von, bis) {
  const monate = [];
  let [j, m] = von.slice(0, 7).split('-').map(Number);
  const [jb, mb] = bis.slice(0, 7).split('-').map(Number);
  while (j < jb || (j === jb && m <= mb)) {
    monate.push(`${j}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      j += 1;
    }
  }
  return monate;
}

/**
 * Ein L16 2026 so, wie kasseneck ihn im Produkt baut: Monat für Monat mit der Lohnlogik
 * gerechnet, im Austrittsmonat auf Wunsch Urlaubszuschuss und Weihnachtsremuneration
 * aliquot (Beschäftigungstage/365 je Monatsbezug, als Posten wie aus der Endabrechnung),
 * daraus `baueL16Uebermittlung`, geprüft mit dem Paket und als Bestand LF mit dem echten
 * Erstellungstag geschrieben. Wie Q55, nur mit Geschlecht und frei wählbarer Person.
 */
function kasseneckL16Reihe(
  ctx,
  id,
  {
    rolle,
    gruppe = 'angestellter',
    stunden = 40,
    monatsbezug = 300_000,
    eintritt = '2026-01-01',
    austritt = '2026-06-30',
    sonderzahlungen = true,
    geschlecht,
    korrektur,
    employeeId = `SIT-${id}`,
  },
) {
  const lohn = kasseneckL16Lohn();
  const k = kasseneckL16();
  const jahr = Number(eintritt.slice(0, 4));
  const parameter = lohn.ladeParameter(jahr);
  const mitarbeiter = {
    id,
    salaryType: 'monthly',
    dienstnehmerGruppe: gruppe,
    beschaeftigungsart: stunden < 40 ? 'parttime' : 'fulltime',
    eintritt,
    austritt,
    wochenstunden: stunden,
    kvBasisStunden: 40,
    grossSalaryCents: monatsbezug,
  };
  const monate = monateZwischen(eintritt, austritt);
  const aliquot = Math.round((monatsbezug * tageInklusive(eintritt, austritt)) / 365);
  const payslips = monate.map((monat, i) => {
    const kontext =
      sonderzahlungen && i === monate.length - 1
        ? {
            posten: [
              { typ: 'UZ', betragCent: aliquot },
              { typ: 'WR', betragCent: aliquot },
            ],
            bisherigeSzJahrCent: 0,
            bisherigeSzSvGrundlageJahrCent: 0,
            bisherigeSzBemessungJahrCent: 0,
            laufendeBezuegeJahrCent: monatsbezug * monate.length,
            kalenderMonateImJahr: monate.length,
          }
        : null;
    const a = lohn.erstelleAbrechnung({ mitarbeiter, monat, parameter, bundesland: 'salzburg', sonderzahlungKontext: kontext });
    if (a.meta?.fehler) throw new Error(`${id}: kasseneck rechnet ${monat} nicht: ${JSON.stringify(a.meta.fehler)}`);
    return { id: monat, monat, ...a };
  });
  const p = ctx.rolle(rolle);
  const gender = geschlecht ?? PERSONENSTAND[p.geschlecht];
  if (!gender) throw new Error(`${id}: Geschlecht der Rolle ${rolle} unbekannt (${JSON.stringify(p.geschlecht)})`);
  const dg = ctx.dienstgeber('B');
  const iso = (ttmmjjjj) => `${ttmmjjjj.slice(4, 8)}-${ttmmjjjj.slice(2, 4)}-${ttmmjjjj.slice(0, 2)}`;
  const { uebermittlung, hinweise } = k.baueL16Uebermittlung({
    payslips,
    jahr,
    employeeId,
    mitarbeiter: {
      svnr: p.vsnr,
      vorname: p.vorname,
      nachname: p.familienname,
      strasse: 'Teststraße',
      hausnummer: '1',
      plz: '5020',
      ort: 'Salzburg',
      land: 'A',
      birthDate: iso(p.geburtsdatum),
      gender,
    },
    betrieb: {
      name: dg.name,
      street: dg.anschrift.strasse,
      zip: dg.anschrift.plz,
      city: dg.anschrift.ort,
      steuernummer: '91-123/4565',
      land: 'A',
    },
    jahrAbgeschlossen: false,
    ...(korrektur ? { korrektur } : {}),
  });
  const { versicherungstraeger: _vstr, ...lfOpt } = ctx.bestandOptionen({ dg: 'B', traeger: '15', erstellt: ctx.jetzt });
  const { befunde } = k.pruefeL16Uebermittlung(uebermittlung, { erstellt: lfOpt.erstellt, heute: lfOpt.erstellt });
  const n = befunde.filter((b) => b.status.startsWith('N'));
  if (n.length > 0) throw new Error(`${id}: kasseneck-L16 hat Befunde mit Status N: ${JSON.stringify(n)}`);
  return {
    inhalt: k.erstelleLohnzettelBestand(uebermittlung, lfOpt),
    dateiName: ctx.dateiName(id),
    referenzwerte: uebermittlung.lohnzettel.map((lz) => lz.felder.REFN),
    hinweise,
  };
}

const l16 = (mehr) => fall({ fenster: AB_MO_NM, braucht: 'kasseneck-l16', ...mehr });

module.exports = [
  l16({
    id: 'L20',
    titel: 'L16 2026 von kasseneck mit Geschlecht: Angestellte, Halbjahr, Austritt 30.06., UZ + WR aliquot (Q55 neu)',
    zweck:
      'Q55 kam in KW45 mit W 2801, weil kasseneck kein Geschlecht führte. Seit #881 steht es am Mitarbeiter und ' +
      'geht als GESW/GESM/GESD in den Satz. Derselbe Lohnzettel muss jetzt ohne Warnung durchgehen.',
    quelle: `${QUELLE_L16}; SIT KW45 Q55`,
    erwartung: 'übernommen LF 1/1 ohne Warnung (kein 2801, kein 0800, kein 1706)',
    rang: 20,
    baue: (ctx) => kasseneckL16Reihe(ctx, 'L20', { rolle: 'angestellte' }),
  }),
  l16({
    id: 'L21',
    titel: 'L16 2026 von kasseneck: Teilzeit-Arbeiter 20 von 40 Stunden, 1.600 €, Halbjahr mit UZ + WR aliquot (GESM)',
    zweck:
      'Teilzeit nach § 19d Abs 1 AZG leitet kasseneck aus Wochenstunden und KV-Normalarbeitszeit ab (TEIL J), ' +
      'soziale Stellung Arbeiter (SOZS 2), männlich (GESM). Geht der Satz so durch?',
    quelle: `${QUELLE_L16}; § 19d Abs 1 AZG; D.33 (SOZS)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    rang: 21,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L21', { rolle: 'reserve_2', gruppe: 'arbeiter', stunden: 20, monatsbezug: 160_000 }),
  }),
  l16({
    id: 'L22',
    titel: 'L16 2026 von kasseneck: Lehrling, 1.000 € Lehrlingsentschädigung, Halbjahr mit UZ + WR aliquot',
    zweck:
      'Soziale Stellung Lehrling (SOZS 1) und Lehrlings-SV aus der Lohnlogik. Lohnsteuer fällt bei diesem Bezug ' +
      'keine an – nimmt der BMF-Katalog den Lohnzettel mit KZ 260 = 0?',
    quelle: `${QUELLE_L16}; D.33 (SOZS 1)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    rang: 22,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L22', { rolle: 'arbeiterlehrling', gruppe: 'lehrling', monatsbezug: 100_000 }),
  }),
  l16({
    id: 'L23',
    titel: 'L16 2026 von kasseneck mit Geschlecht „offen“ → GESD (reserve_1, Angestellte, Halbjahr)',
    zweck:
      'Das Formular L 16 kennt nur „inter/divers/offen“ als drittes Kästchen; kasseneck schreibt inter und ' +
      'offen deshalb wie divers in GESD. Nimmt der BMF-Katalog GESD an – auch wenn die SV die Person anders ' +
      'führt? (Die Testperson ist in den Stammdaten weiblich; gefragt ist nur die formale Annahme.)',
    quelle: `${QUELLE_L16}; Formular L 16; @kreiseck/elda l16Geschlecht`,
    erwartung: 'offen: übernommen ohne 2801, oder ein Abgleich mit dem Personenstand',
    rang: 23,
    baue: (ctx) => kasseneckL16Reihe(ctx, 'L23', { rolle: 'reserve_1', geschlecht: 'o' }),
  }),
  l16({
    id: 'L24',
    titel: 'Berichtigung von L20 über kasseneck: KORR K, gleiche REFN, 3.100 € statt 3.000 €',
    zweck:
      'kasseneck berichtigt einen schon gesendeten Lohnzettel mit KORR K und derselben Referenznummer ' +
      '(employeeId + Eintritt). Ersetzt die SIT den L20 ohne Warnung?',
    quelle: `${QUELLE_L16}; E.14 Feld 11 (REFN unverändert bei Berichtigung), Feld 104 (KORR)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    abhaengig: ['L20'],
    rang: 30,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L24', {
        rolle: 'angestellte',
        monatsbezug: 310_000,
        korrektur: 'K',
        employeeId: 'SIT-L20',
      }),
  }),
  l16({
    id: 'L25',
    titel: 'Zweites Dienstverhältnis von L20 im selben Jahr: Wiedereintritt 01.08.–31.10.2026, eigener L16',
    zweck:
      'Je Dienstverhältnis ein Lohnzettel: kasseneck bildet die REFN aus employeeId und Eintritt, der zweite ' +
      'L16 derselben Person trägt daher eine eigene. Gehen beide nebeneinander durch, ohne dass der zweite den ' +
      'ersten ersetzt?',
    quelle: `${QUELLE_L16}; § 84 Abs 1 EStG; E.14 Feld 11`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    abhaengig: ['L20'],
    rang: 31,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L25', {
        rolle: 'angestellte',
        eintritt: '2026-08-01',
        austritt: '2026-10-31',
        sonderzahlungen: false,
        employeeId: 'SIT-L20',
      }),
  }),
  l16({
    id: 'L26',
    titel: 'L16 2026 von kasseneck: geringfügig Beschäftigte, 500 € bei 10 Stunden, Halbjahr ohne Sonderzahlungen',
    zweck:
      'Unter der Geringfügigkeitsgrenze rechnet kasseneck keine DN-SV und keine Lohnsteuer. Ein Lohnzettel ist ' +
      'trotzdem Pflicht – geht er mit KZ 230 und KZ 260 = 0 durch?',
    quelle: `${QUELLE_L16}; § 5 Abs 2 ASVG; § 84 Abs 1 EStG`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    rang: 24,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L26', {
        rolle: 'geringfuegig',
        gruppe: 'arbeiter',
        stunden: 10,
        monatsbezug: 50_000,
        sonderzahlungen: false,
      }),
  }),
  fall({
    id: 'Q60',
    titel: 'Höchstbeitragsgrundlage: Anmeldung angestellte auf A/14 zum 01.02.2026, BVAB 01.03.2026 (M3)',
    zweck:
      'Vorlauf für die mBGM 02 und 03/2026 mit 9.000 € (M97 aus KW45): kasseneck deckelt die SV bei 6.930 €, ' +
      'die BV kennt keine Höchstbeitragsgrundlage. Q34 lief nur Mo 07–09, das in KW46 ausfiel – die Kette ' +
      'beginnt deshalb einen Monat später.',
    quelle: `${QUELLE_ZR}; E.29.2 (M3, BVAB); § 6 Abs 1 BMSVG`,
    erwartung: 'übernommen',
    fenster: MO_NM,
    rang: 11,
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'Q60',
        art: 'anmeldung',
        rolle: 'angestellte',
        dg: 'A',
        traeger: '14',
        felder: {
          ADAT: ctx.ttmmjjjj(ctx.zr),
          BBER: '02',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
          BVAB: ctx.ttmmjjjj(einMonatSpaeter(ctx.zr)),
        },
      }),
  }),
];

/** Derselbe Tag einen Monat später (JJJJ-MM-TT) – die BVAB-Regel von kasseneck (Eintritt + 1 Monat). */
function einMonatSpaeter(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  const ziel = new Date(Date.UTC(j, m, t));
  if (ziel.getUTCMonth() !== m % 12) return new Date(Date.UTC(j, m + 1, 0)).toISOString().slice(0, 10);
  return ziel.toISOString().slice(0, 10);
}
