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
//   L27  arbeiter     Austritt im Jahr mit Urlaubsersatzleistung (07.07.–30.09., Teilzeit)
//   L28  reserve_3    Alleinverdiener mit zwei Kindern (AVAB J, ANZK 02) ohne VSNR des Partners
//   L29  reserve_3    Negativtest über das Paket: zwei Geschlechter angekreuzt (GESW + GESM)
//   L31  reserve_2    Sonderzahlungen über dem Jahressechstel (§ 67 Abs 2 EStG)
//   L34  arbeiter     Pendlerpauschale (klein, 20–40 km) – BPEN und KZ 243, ohne Pendlereuro
//   L35  reserve_1    zehn Überstunden im Monat – steuerfreie Zuschläge § 68 Abs 2 in KZ 215 / SB682
//   L43  arbeiter     Gegenprobe zu L34: derselbe Lohnzettel mit Pendlereuro (BPEND) – fällt 5404 weg?
//   L44  reserve_3    der Weg aus Status G: L41 berichtigt (KORR K, Referenznummer von L41, § 68 unter dem Maximum)
//   L45  arbeiterlehrling Pendlerpauschale groß über 60 km bei Eintritt 15.03. – wie aliquotiert F5402 den Höchstbetrag?
//   L46  angestellte  Storno von L20/L24 über kasseneck (KORR S, gleiche REFN) – kasseneck dokumentiert nur „K“
//   L36–L42 reserve_3 Rechenregeln des BMF-Katalogs über das Paket, je eine Regel verletzt bzw. genau auf der
//                     Toleranz: F6401 (±1,00 €), F4800, F7004 (±0,20 €), F3806, F6201 (±0,40 €) mit Status N und
//                     F3805/F9715 mit Status G („übernimmt zwar, … mit dem Fehlerstatus G gekennzeichnet“, D.32)
//
// Höchstbeitragsgrundlage (M97 aus KW45, dessen Vorlauf Q34 nur Mo 07–09 lief): Q60 meldet
// die Angestellte auf A/14 zum 01.02.2026 an, BV ab 01.03.2026. Die mBGM 02 und 03 mit
// 9.000 € folgen am Dienstag als eigene Fälle, sobald die Mitteilung zu Q60 gelesen ist.

const { meldung, lohnzettel } = require('../lib/bausteine');
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
    posten,
    szJeMonat,
    jahrAbgeschlossen = false,
    zeiten,
    zusatzBetraege,
    mehr = {},
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
    ...mehr,
  };
  // Läuft das Dienstverhältnis über das Jahr hinaus (`austritt` null), rechnet die Reihe bis 31.12.
  const monate = monateZwischen(eintritt, austritt ?? `${jahr}-12-31`);
  const aliquot = austritt ? Math.round((monatsbezug * tageInklusive(eintritt, austritt)) / 365) : null;
  // `szJeMonat` ({ '06': posten, … }): Sonderzahlungen in den genannten Monaten, mit den bisherigen SZ des
  // Jahres wie im Lohnlauf (Sechstel, SZ-Höchstbeitragsgrundlage); sonst UZ + WR aliquot im letzten Monat.
  let bisher = { sz: 0, svGrundlage: 0, bemessung: 0 };
  const szKontext = (monat, i) => {
    const p = szJeMonat?.[monat.slice(5, 7)];
    if (!p) return null;
    return {
      posten: p,
      bisherigeSzJahrCent: bisher.sz,
      bisherigeSzSvGrundlageJahrCent: bisher.svGrundlage,
      bisherigeSzBemessungJahrCent: bisher.bemessung,
      laufendeBezuegeJahrCent: monatsbezug * (i + 1),
      kalenderMonateImJahr: Number(monat.slice(5, 7)),
    };
  };
  const payslips = monate.map((monat, i) => {
    const kontext = szJeMonat
      ? szKontext(monat, i)
      : sonderzahlungen && i === monate.length - 1
        ? {
            posten: posten ?? [
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
    const a = lohn.erstelleAbrechnung({
      mitarbeiter,
      monat,
      parameter,
      bundesland: 'salzburg',
      sonderzahlungKontext: kontext,
      ...(zeiten ? { zeiten } : {}),
    });
    if (a.meta?.fehler)
      throw new Error(`${id}: kasseneck rechnet ${monat} nicht: ${JSON.stringify(a.meta.fehler)}`);
    if (szJeMonat && kontext) {
      bisher = {
        sz: bisher.sz + a.brutto.sonderzahlung.innerhalbSechstel,
        svGrundlage: bisher.svGrundlage + a.sv.grundlageSZ,
        bemessung: bisher.bemessung + a.lst.szBesteuerung.bemessungFest,
      };
    }
    return { id: monat, monat, ...a };
  });
  const p = ctx.rolle(rolle);
  const gender = geschlecht ?? PERSONENSTAND[p.geschlecht];
  if (!gender)
    throw new Error(`${id}: Geschlecht der Rolle ${rolle} unbekannt (${JSON.stringify(p.geschlecht)})`);
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
    jahrAbgeschlossen,
    ...(korrektur ? { korrektur } : {}),
  });
  const { versicherungstraeger: _vstr, ...lfOpt } = ctx.bestandOptionen({
    dg: 'B',
    traeger: '15',
    erstellt: ctx.jetzt,
  });
  // Felder, die kasseneck (noch) nicht führt, für eine Gegenprobe nachgetragen (L43: Pendlereuro).
  if (zusatzBetraege) Object.assign(uebermittlung.lohnzettel[0].betraege, zusatzBetraege);
  const { befunde } = k.pruefeL16Uebermittlung(uebermittlung, {
    erstellt: lfOpt.erstellt,
    heute: lfOpt.erstellt,
  });
  const n = befunde.filter((b) => b.status.startsWith('N'));
  if (n.length > 0) throw new Error(`${id}: kasseneck-L16 hat Befunde mit Status N: ${JSON.stringify(n)}`);
  return {
    inhalt: k.erstelleLohnzettelBestand(uebermittlung, lfOpt),
    dateiName: ctx.dateiName(id),
    referenzwerte: uebermittlung.lohnzettel.map((lz) => lz.felder.REFN),
    hinweise,
  };
}

/**
 * L16 2026 über das Paket für reserve_3 (Arbeiter, männlich, 01.01.–28.02.2026, 3.000 € im Monat, Beträge
 * wie Q50). `mehr` ergänzt oder überschreibt Felder des L1-Satzes (L29: GESW zusätzlich, L30: AVAB mit
 * Versicherungsnummer der Partnerin), `betraege` einzelne Beträge (L36–L42); `pruefen: false` lässt einen
 * Negativtest trotz eigener Befunde hinaus.
 */
function l16Paket(ctx, fall, mehr = {}, { betraege = {}, pruefen = true } = {}) {
  const p = ctx.rolle('reserve_3');
  const dg = ctx.dienstgeber('B');
  return lohnzettel(ctx, {
    fall,
    dg: 'B',
    traeger: '15',
    erstellt: ctx.jetzt,
    uebermittlung: {
      version: '28',
      jahr: 2026,
      arbeitgeber: {
        STNRA: '911234565',
        ANAM: dg.name,
        AADR: dg.anschrift.strasse,
        ALKZ: 'A',
        APLZ: dg.anschrift.plz,
        AORT: dg.anschrift.ort,
        GESA: 1,
      },
      lohnzettel: [
        {
          felder: {
            REFN: ctx.referenzwert(fall).slice(0, 30),
            ARTL: '01',
            BELZ: '0101',
            ENLZ: '2802',
            SOZS: '2',
            AVLN: p.vsnr.slice(0, 4),
            AGBD: p.vsnr.slice(4),
            ANAM: `${p.familienname} ${p.vorname}`,
            AADR: 'Teststraße 1',
            ALKZ: 'A',
            APLZ: '5020',
            AORT: 'Salzburg',
            GESM: 'J',
            VOLL: 'J',
            GEBD: p.geburtsdatum,
            ...mehr,
          },
          // Zwei Monate zu 3.000 €, gerechnet mit kasseneck (wie L16_BETRAEGE[3000] in q-kw45.js).
          betraege: {
            B210: 600_000,
            BIEB: 108_420,
            B230: 108_420,
            B245: 491_580,
            BIEL: 56_764,
            B260: 56_764,
            ...betraege,
          },
        },
      ],
    },
    pruefen,
  });
}

const l16 = (mehr) => fall({ fenster: AB_MO_NM, braucht: 'kasseneck-l16', ...mehr });

module.exports = [
  l16({
    id: 'L20',
    titel:
      'L16 2026 von kasseneck mit Geschlecht: Angestellte, Halbjahr, Austritt 30.06., UZ + WR aliquot (Q55 neu)',
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
    titel:
      'L16 2026 von kasseneck: Teilzeit-Arbeiter 20 von 40 Stunden, 1.600 €, Halbjahr mit UZ + WR aliquot (GESM)',
    zweck:
      'Teilzeit nach § 19d Abs 1 AZG leitet kasseneck aus Wochenstunden und KV-Normalarbeitszeit ab (TEIL J), ' +
      'soziale Stellung Arbeiter (SOZS 2), männlich (GESM). Geht der Satz so durch?',
    quelle: `${QUELLE_L16}; § 19d Abs 1 AZG; D.33 (SOZS)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    rang: 21,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L21', {
        rolle: 'reserve_2',
        gruppe: 'arbeiter',
        stunden: 20,
        monatsbezug: 160_000,
      }),
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
    titel:
      'L16 2026 von kasseneck: geringfügig Beschäftigte, 500 € bei 10 Stunden, Halbjahr ohne Sonderzahlungen',
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
  l16({
    id: 'L27',
    titel:
      'L16 2026 von kasseneck: Austritt im Jahr mit Urlaubsersatzleistung, 07.07.–30.09., Teilzeit 30 Stunden',
    zweck:
      'So sieht der Lohnzettel aus, der im Februar 2027 für einen unterjährigen Austritt echt hinausgeht: ' +
      'Eintritt mitten im Monat, Austritt zum Quartalsende, UZ und WR aliquot (86/365) und der ' +
      'Sonderzahlungsanteil der Urlaubsersatzleistung in KZ 220. Werte erfunden.',
    quelle: `${QUELLE_L16}; § 67 Abs 8 lit d EStG, LStR Rz 1108 (UEL); WKO „Der steuerliche Lohnzettel“ (KZ 220)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    rang: 25,
    baue: (ctx) => {
      const monatsbezug = 180_000;
      const aliquot = Math.round((monatsbezug * tageInklusive('2026-07-07', '2026-09-30')) / 365);
      return kasseneckL16Reihe(ctx, 'L27', {
        rolle: 'arbeiter',
        gruppe: 'arbeiter',
        stunden: 30,
        monatsbezug,
        eintritt: '2026-07-07',
        austritt: '2026-09-30',
        posten: [
          { typ: 'UZ', betragCent: aliquot },
          { typ: 'WR', betragCent: aliquot },
          { typ: 'UEL', betragCent: 12_000 },
        ],
      });
    },
  }),
  l16({
    id: 'L28',
    titel: 'L16 2026 von kasseneck: Alleinverdiener mit zwei Kindern (AVAB J, ANZK 02), Halbjahr mit UZ + WR',
    zweck:
      'kasseneck rechnet den AVAB nach Kinderstaffel und meldet AVAB J mit der Kinderzahl, kennt aber die VSNR ' +
      'der Partnerin bzw. des Partners nicht (F3101, Status P). Nimmt der BMF-Katalog den Lohnzettel so an?',
    quelle: `${QUELLE_L16}; § 33 Abs 4 Z 1 EStG; E.14 (AVAB, ANZK); Prüfkatalog L16 F3101`,
    erwartung: 'offen: übernommen, evtl. mit Warnung 3101',
    rang: 26,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L28', {
        rolle: 'reserve_3',
        monatsbezug: 350_000,
        mehr: { soleEarner: true, children: 2 },
      }),
  }),
  l16({
    id: 'L31',
    titel:
      'L16 2026 von kasseneck: Sonderzahlungen über dem Jahressechstel (01.05.–30.06., UZ + WR je 4.000 €)',
    zweck:
      'Zwei Monate zu 3.000 € ergeben ein Jahressechstel von 6.000 €; UZ und WR zusammen 8.000 € liegen 2.000 € ' +
      'darüber. Der Teil über dem Sechstel ist nach dem Tarif zu versteuern (§ 67 Abs 2 EStG) und gehört nicht in ' +
      'KZ 220. Rechnet kasseneck das so, dass der BMF-Katalog den Lohnzettel ohne Warnung nimmt? Werte erfunden.',
    quelle: `${QUELLE_L16}; § 67 Abs 1 und 2 EStG; WKO „Der steuerliche Lohnzettel“ (KZ 220, „über dem Jahressechstel“)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung; KZ 220 nur innerhalb des Sechstels',
    rang: 27,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L31', {
        rolle: 'reserve_2',
        eintritt: '2026-05-01',
        austritt: '2026-06-30',
        posten: [
          { typ: 'UZ', betragCent: 400_000 },
          { typ: 'WR', betragCent: 400_000 },
        ],
      }),
  }),
  fall({
    id: 'L29',
    titel: 'Negativtest L16 über das Paket: GESW und GESM zugleich angekreuzt (F2801)',
    zweck:
      'F2801 verlangt genau ein Geschlecht. Ohne Geschlecht kam in KW45 Warnung 2801 – meldet die SIT zwei ' +
      'Geschlechter ebenfalls nur als Warnung, oder weist sie den Lohnzettel ab?',
    quelle: 'E.14 Felder 28–30; Prüfkatalog L16 Version 09 (F2801)',
    erwartung: 'Warnung 2801 oder nicht_uebernommen',
    fenster: AB_MO_NM,
    rang: 40,
    baue: (ctx) => l16Paket(ctx, 'L29', { GESW: 'J' }),
  }),
  fall({
    id: 'L30',
    titel:
      'Gegenprobe zu L28 über das Paket: AVAB J, zwei Kinder, MIT Versicherungsnummer der Partnerin (PVLN/PGBD)',
    zweck:
      'L28 kam mit W 3101/3200/3300, weil kasseneck die VSNR der Partnerin nicht führt. Verschwinden die drei ' +
      'Warnungen, wenn PVLN und PGBD gesetzt sind? Dann braucht kasseneck das Feld für jeden AVAB-Fall. ' +
      'Partnerin: Testperson reserve_1.',
    quelle:
      'E.14 Felder 33–35 (AVAB, PVLN, PGBD), 110 (ANZK); Prüfkatalog L16 F3101, F3200, F3300; SIT KW46 L28',
    erwartung: 'übernommen ohne 3101/3200/3300',
    fenster: AB_MO_NM,
    rang: 41,
    baue: (ctx) => {
      const partnerin = ctx.rolle('reserve_1').vsnr;
      return l16Paket(ctx, 'L30', {
        AVAB: 'J',
        ANZK: '02',
        PVLN: partnerin.slice(0, 4),
        PGBD: partnerin.slice(4),
      });
    },
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
  l16({
    id: 'L32',
    titel:
      'Jahreslohnzettel 2026 von kasseneck: Angestellte 01.01.–31.12., Dienstverhältnis läuft weiter, UZ Juni, WR November',
    zweck:
      'Der häufigste L16 überhaupt – nach Jahresende für jedes laufende Dienstverhältnis – lief noch nie über ' +
      'kasseneck auf der SIT (L20–L31 hatten alle einen Austritt). kasseneck braucht dafür `jahrAbgeschlossen`; ' +
      'die Sonderzahlungen kommen in ihren Monaten mit Sechstel aus dem Lohnlauf.',
    quelle: `${QUELLE_L16}; D.32 (Lohnzahlungszeitraum bis 31.12.); kasseneck l16-elda-core.js lohnzahlungszeitraum`,
    erwartung: 'übernommen (W 0800 möglich: echtes Übermittlungsdatum vor dem Jahresende)',
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L32', {
        rolle: 'angestellte',
        austritt: null,
        jahrAbgeschlossen: true,
        szJeMonat: { '06': [{ typ: 'UZ', betragCent: 300_000 }], 11: [{ typ: 'WR', betragCent: 300_000 }] },
      }),
  }),
  l16({
    id: 'L33',
    titel:
      'Jahreslohnzettel 2026 von kasseneck: 9.000 € im Monat, UZ und WR je 9.000 € – SV bei beiden Höchstbeitragsgrundlagen',
    zweck:
      'Wie L32 für die Person aus M110–M113: laufende SV bei 6.930 € gedeckelt, Sonderzahlungen nur bis ' +
      '13.860 € im Jahr. Passen die SV-Beiträge im L16 für die Prüfung des BMF?',
    quelle: `${QUELLE_L16}; § 54, § 108 Abs 3 ASVG; SIT M110–M113`,
    erwartung: 'übernommen (W 0800 möglich)',
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L33', {
        rolle: 'freier_dn',
        monatsbezug: 900_000,
        austritt: null,
        jahrAbgeschlossen: true,
        szJeMonat: { '06': [{ typ: 'UZ', betragCent: 900_000 }], 11: [{ typ: 'WR', betragCent: 900_000 }] },
      }),
  }),
  l16({
    id: 'L34',
    titel: 'L16 2026 von kasseneck mit Pendlerpauschale (klein, 20–40 km): Arbeiter, Halbjahr, BPEN und KZ 243',
    zweck:
      'kasseneck zieht die Pendlerpauschale vor dem Tarif ab und schreibt sie in BPEN und KZ 243 (FC 6201). ' +
      'Den Pendlereuro rechnet es nicht (die App kennt nur die Stufe, nicht die Kilometer) – BPEND bleibt leer. ' +
      'Nimmt der BMF-Katalog eine Pendlerpauschale ohne Pendlereuro ohne Warnung an? Lief auf der SIT noch nie.',
    quelle: `${QUELLE_L16}; § 16 Abs 1 Z 6 EStG, § 33 Abs 5 Z 4 EStG; E.14 Felder 55/56 (BPEN), 131/132 (BPEND)`,
    erwartung: 'offen: übernommen ohne Warnung, oder eine Warnung zum fehlenden Pendlereuro',
    rang: 32,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L34', {
        rolle: 'arbeiter',
        gruppe: 'arbeiter',
        monatsbezug: 250_000,
        mehr: { commuterAllowance: 'Klein — 20 bis 40 km' },
      }),
  }),
  l16({
    id: 'L35',
    titel:
      'L16 2026 von kasseneck mit zehn Überstunden im Monat: steuerfreie Zuschläge § 68 Abs 2 in KZ 215 und SB682',
    zweck:
      'kasseneck rechnet Überstunden mit 50 % Grundzuschlag und stellt die Zuschläge der ersten 15 Stunden ' +
      '(höchstens 170 € im Monat) steuerfrei. Im L16 landet die Summe in KZ 215 und, weil kasseneck nur ' +
      '§ 68 Abs 2 kennt, ganz in SB682 (F3806: 215 = SB681 + SB682). Geht der Lohnzettel ohne Warnung durch?',
    quelle: `${QUELLE_L16}; § 68 Abs 2 EStG; Prüfkatalog L16 F3806; E.14 Felder 40 (B215), 180/181 (SB681/SB682)`,
    erwartung: 'übernommen LF 1/1 ohne Warnung',
    rang: 33,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L35', {
        rolle: 'reserve_1',
        eintritt: '2026-07-01',
        austritt: '2026-12-31',
        zeiten: { ueberstundenMin: 600 },
      }),
  }),
  l16({
    id: 'L43',
    titel: 'Gegenprobe zu L34: derselbe kasseneck-L16 mit Pendlereuro 90 € (30 km × 6 € × 6/12) in BPEND',
    zweck:
      'L34 kam mit Status P / 5404, weil BPEND leer war. Hier steht derselbe Lohnzettel mit einem Pendlereuro für ' +
      'erfundene 30 km. Verschwindet 5404, fehlt kasseneck genau die einfache Entfernung in km am Mitarbeiter ' +
      '(den Satz von 6 € je km und Jahr kennt es schon). Die Lohnsteuer bleibt die ohne Pendlereuro.',
    quelle: `${QUELLE_L16}; § 33 Abs 5 Z 4 EStG; Prüfkatalog L16 F5404, F9121; SIT KW46 L34`,
    erwartung: 'übernommen ohne 5404 (ein 7003/7002 wäre ein anderer Befund)',
    abhaengig: ['L34'],
    rang: 34,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L43', {
        rolle: 'arbeiter',
        gruppe: 'arbeiter',
        monatsbezug: 250_000,
        mehr: { commuterAllowance: 'Klein — 20 bis 40 km' },
        zusatzBetraege: { BPEND: 9_000 },
      }),
  }),
  l16({
    id: 'L45',
    titel:
      'L16 2026 von kasseneck: Pendlerpauschale groß über 60 km, Eintritt 15.03., läuft weiter – F5402 an der Grenze',
    zweck:
      'F5402 erlaubt 3.672 € im Jahr „auf Monate aliquotiert", ohne zu sagen wie. kasseneck gibt die Pauschale ' +
      'für jeden Monat voll, auch für den angebrochenen März (ab 11 Pendeltagen steht sie ganz zu): 10 × 306 € = ' +
      '3.060 €. Zählen angebrochene Monate voll, ist das genau die Grenze; aliquotiert ELDA nach Tagen ' +
      '(287/360 × 3.672 € ≈ 2.927 €), kommt F5402 mit Status N. Dazu wie L34 die Warnung 5404.',
    quelle: `${QUELLE_L16}; Prüfkatalog L16 F5402 („> 3672 auf Monate aliquotiert + 5,00 Toleranz"), F5404; § 16 Abs 1 Z 6 EStG`,
    erwartung: 'offen: übernommen mit 5404 (Monate zählen voll) oder nicht übernommen mit 5402 (nach Tagen)',
    rang: 35,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L45', {
        rolle: 'arbeiterlehrling',
        eintritt: '2026-03-15',
        austritt: null,
        jahrAbgeschlossen: true,
        szJeMonat: { '06': [{ typ: 'UZ', betragCent: 300_000 }], 11: [{ typ: 'WR', betragCent: 300_000 }] },
        mehr: { commuterAllowance: 'Groß — über 60 km' },
      }),
  }),
  l16({
    id: 'L46',
    titel: 'Storno von L20/L24 über kasseneck: KORR S, gleiche REFN, Beträge wie L24',
    zweck:
      'kasseneck kennt als Korrektur nur „K“ (l16-elda-core.js), reicht den Wert aber unverändert in Feld 104 ' +
      'durch. Laut E.14 braucht ein Storno „S“ keine Nullbeträge mehr; über das Paket ging das (L05). Nimmt ELDA ' +
      'den Storno auch aus dem kasseneck-Bau? Dann fehlt kasseneck für einen Storno nur die Oberfläche.',
    quelle: `${QUELLE_L16}; E.14 Feld 104 (KORR „S“); SIT L05`,
    erwartung: 'übernommen ohne Warnung',
    abhaengig: ['L24'],
    rang: 36,
    baue: (ctx) =>
      kasseneckL16Reihe(ctx, 'L46', {
        rolle: 'angestellte',
        monatsbezug: 310_000,
        korrektur: 'S',
        employeeId: 'SIT-L20',
      }),
  }),
  fall({
    id: 'L44',
    titel: 'Berichtigung von L41 nach Status G: KORR K, Referenznummer von L41, KZ 215 = SB682 = 100 €',
    zweck:
      'Das Protokoll zu L41 schreibt für G vor: „in jedem Fall Daten richtig stellen oder mit Fehlerindikator für ' +
      'richtig erklären; nochmals mit Korrekturindikation und ursprünglicher Referenznummer senden“. F9715 lässt ' +
      'keine Fehlerindikation zu (Katalog: N) – also richtigstellen. Geht die Berichtigung ohne Warnung durch? ' +
      'Das ist der Weg, den kasseneck bei einem gesperrten Lohnzettel anbieten muss.',
    quelle: 'SIT-Protokoll zu L41 (Erläuterung zum Status G); E.14 Feld 104 (KORR K, gleiche REFN); Prüfkatalog F9715',
    erwartung: 'übernommen ohne Warnung',
    fenster: AB_MO_NM,
    abhaengig: ['L41'],
    rang: 43,
    baue: (ctx) =>
      l16Paket(
        ctx,
        'L44',
        { KORR: 'K', REFN: ctx.referenzwertVon('L41') },
        { betraege: { B215: 10_000, SB682: 10_000, B245: 481_580 } },
      ),
  }),
  ...[
    {
      id: 'L36',
      titel: 'Negativtest L16: KZ 245 um 1,01 € neben 210 − 215 − 220 − 230 − 243 (F6401, Toleranz ±1,00 €)',
      betraege: { B245: 491_479 },
      erwartung: 'nicht übernommen, F6401',
      eigene: ['F6401'],
    },
    {
      id: 'L37',
      titel: 'Grenzprobe L16: KZ 245 um genau 1,00 € daneben – innerhalb der Toleranz von F6401',
      betraege: { B245: 491_480 },
      erwartung: 'übernommen ohne F6401 (Gegenprobe zu L36)',
      eigene: [],
    },
    {
      id: 'L38',
      titel: 'Negativtest L16: KZ 230 um 10 € kleiner als BIEB − 225 − 226, KZ 245 passend dazu (F4800)',
      betraege: { B230: 107_420, B245: 492_580 },
      erwartung: 'nicht übernommen, F4800',
      eigene: ['F4800'],
    },
    {
      id: 'L39',
      titel: 'Negativtest L16: KZ 260 um 0,21 € kleiner als BIEL − BABL (F7004, Toleranz ±0,20 €)',
      betraege: { B260: 56_743 },
      erwartung: 'nicht übernommen, F7004',
      eigene: ['F7004'],
    },
    {
      id: 'L40',
      titel: 'Negativtest L16: KZ 215 = 100,00 €, SB682 = 99,99 € (F3806 ohne Toleranz)',
      betraege: { B215: 10_000, SB682: 9_999, B245: 481_580 },
      erwartung: 'nicht übernommen, F3806',
      eigene: ['F3806'],
    },
    {
      id: 'L41',
      titel:
        'Negativtest L16: KZ 215 = SB682 = 3.000 € in zwei Monaten – § 68 über dem Maximalwert (F3805/F9715, Status G)',
      betraege: { B215: 300_000, SB682: 300_000, B245: 191_580, BIEL: 0, B260: 0 },
      erwartung: 'offen: übernommen mit Kennzeichen G (Warnung 3805/9715?) – wie zeigt die SIT den Status G?',
      eigene: [],
    },
    {
      id: 'L42',
      titel: 'Negativtest L16: KZ 243 = 0,41 € ohne einen einzigen Abzug darunter (F6201, Toleranz ±0,40 €)',
      betraege: { B243: 41, B245: 491_539 },
      erwartung: 'nicht übernommen, F6201',
      eigene: ['F6201'],
    },
  ].map(({ id, titel, betraege, erwartung, eigene }) =>
    fall({
      id,
      titel,
      zweck:
        'Die Rechenregeln des BMF-Katalogs stehen mit Status N, Toleranzen laut Fehlertext. Bisher ging kein L16 ' +
        'mit Rechenfehler auf die SIT: Rechnet ELDA die Formel wirklich nach, mit derselben Toleranz wie ' +
        '`pruefeLohnzettel`, und weist sie ab (wie F9991 bei L02)? Status G kam noch nie.',
      quelle: 'Prüfkatalog L16 Version 09 (Fehlerstatus, Toleranzen im Fehlertext); DM-Org D.32 (Fehlerstatus G)',
      erwartung,
      fenster: AB_MO_NM,
      rang: 42,
      eigeneBefunde: eigene,
      baue: (ctx) => l16Paket(ctx, id, {}, { betraege, pruefen: false }),
    }),
  ),
];

/** Derselbe Tag einen Monat später (JJJJ-MM-TT) – die BVAB-Regel von kasseneck (Eintritt + 1 Monat). */
function einMonatSpaeter(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  const ziel = new Date(Date.UTC(j, m, t));
  if (ziel.getUTCMonth() !== m % 12) return new Date(Date.UTC(j, m + 1, 0)).toISOString().slice(0, 10);
  return ziel.toISOString().slice(0, 10);
}
