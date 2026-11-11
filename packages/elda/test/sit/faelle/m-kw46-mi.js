'use strict';

// Mi 07–09 (simuliert 01.04.2027): Höchstbeitragsgrundlage für Sonderzahlungen über kasseneck – auf der SIT
// nie geprüft. kasseneck deckelt die SV-Grundlage der Sonderzahlungen bei 13.860 € im Kalenderjahr
// (`sv.hbgl_sz_jahr_cent`, Rest aus `bisherigeSzSvGrundlageJahrCent`); die BV kennt keine Höchstbeitragsgrundlage.
// Die Monate liegen im Vorjahr (2026), weil kasseneck nur das Parameterwerk 2026 kennt – gemeldet ein Jahr zu spät.
// Person freier_dn als Angestellte auf B/15: dort in KW45/46 nie angemeldet (ihr V78 lag im März 2026 auf A/15).
//
//   Q67  B/15  Anmeldung zum 01.01.2026, BVAB 01.02.2026
//   M110 B/15  06/2026  9.000 € + UZ 9.000 €: AB 6.930 €, SZ 9.000 € (unter 13.860 €), BV 18.000 €
//   M111 B/15  11/2026  9.000 € + WR 9.000 €: SZ nur noch 4.860 € (Rest bis 13.860 €), BV 18.000 €
//   M112 B/15  01/2026  Gegenprobe: AB absichtlich ungedeckelt 9.000 € – rechnet die ÖGK auf der SIT überhaupt
//                       nach? Ohne Clearing hier wäre „kein Clearing“ bei M102/M103/M111 wertlos.
//   M113 B/15  12/2026  9.000 € + WR 2.000 € nach ausgeschöpfter Grenze: SZ-Grundlage 0, BV trotzdem auf 2.000 €
//
// Nachgelegt nach dem Clearing Mi vm:
//   M115 A/15  03/2026  Die mBGM zu V78/V79 fehlte; die ÖGK hat dafür eine mBGM von Amts wegen erstellt (X1
//                       BW1922 + BW1916 VA/VB). Was passiert, wenn die echte mBGM ein Jahr später nachkommt?
//   M116 B/15  06/2026  Gegenprobe zu M110/M111: SZ absichtlich über dem Jahresdeckel (15.000 € statt 13.860 €)
//                       für reserve_1 aus Q61 – prüft die SIT die SZ-Höchstbeitragsgrundlage überhaupt?
//   M117 A/14  09/2026  mBGM VOR der Anmeldung im selben Fenster, danach Q68 (Anmeldung 01.09.) und Q69
//                       (Abmeldung 30.09.) für angestelltenlehrling (ihr V04 auf A/14 fehlt im Bestand, B014).
//                       Anlass: M98/M52 bekamen Di nm BW1837 auf Paketebene und Mi vm BW1862 je Person – das
//                       Paket wurde offenbar neu verarbeitet, als auf dem Konto jemand gemeldet war. Zählt in der
//                       Sammelverarbeitung die Reihenfolge des Eingangs, oder kommen die Versichertenmeldungen zuerst?
//   M126 A/15  01/2026  dasselbe auf einem Konto-Monat ohne jeden Versicherten, danach Q70/Q71 (geringfuegig):
//                       bei Eingangsreihenfolge BW1837 auf Paketebene

const { mbgmPaket, meldung } = require('../lib/bausteine');
const { kasseneck } = require('../lib/kasseneck');

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', braucht: 'kasseneck', ...mehr });
const MI_VM = ['mi-vm'];
const MONATSBEZUG = 900_000;
const QUELLE =
  'E.32 (D.31 SZ, T02); § 54 Abs 1, § 108 Abs 3 ASVG (Höchstbeitragsgrundlage SZ 2026 13.860 € je Kalenderjahr); ' +
  '§ 6 Abs 1 BMSVG; kasseneck lohnabrechnung-core.js (hbglSzJahr, hbglSzRest), mbgm-core.js';

/** Das Jahr vor dem Fenster, in dem Q67 lief – dort liegen alle Monate dieser Kette. */
const jahrVon = (ctx) => Number(ctx.zrVon('Q67').slice(0, 4)) - 1;

const mitarbeiter = (jahr) => ({
  dienstnehmerGruppe: 'angestellter',
  beschaeftigungsart: 'fulltime',
  eintritt: `${jahr}-01-01`,
  austritt: null,
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: MONATSBEZUG,
});

/** Sonderzahlungs-Kontext von kasseneck für den Monat `m` (1–12) mit den bisher im Jahr bezahlten SZ. */
const szKontext = (m, posten, bisher = { sz: 0, svGrundlage: 0, bemessung: 0 }) => ({
  posten,
  bisherigeSzJahrCent: bisher.sz,
  bisherigeSzSvGrundlageJahrCent: bisher.svGrundlage,
  bisherigeSzBemessungJahrCent: bisher.bemessung,
  laufendeBezuegeJahrCent: MONATSBEZUG * m,
  kalenderMonateImJahr: m,
});

/** Was kasseneck nach dem Juni (UZ) und dem November (WR) als bisherige SZ des Jahres führt. */
function bisherNach(jahr, monate) {
  const k = kasseneck();
  const parameter = k.ladeParameter(jahr);
  let bisher = { sz: 0, svGrundlage: 0, bemessung: 0 };
  for (const [m, posten] of monate) {
    const a = k.erstelleAbrechnung({
      mitarbeiter: { id: 'freier_dn', salaryType: 'monthly', ...mitarbeiter(jahr) },
      monat: `${jahr}-${String(m).padStart(2, '0')}`,
      parameter,
      bundesland: 'oberoesterreich',
      sonderzahlungKontext: szKontext(m, posten, bisher),
    });
    bisher = {
      sz: bisher.sz + a.brutto.sonderzahlung.innerhalbSechstel,
      svGrundlage: bisher.svGrundlage + a.sv.grundlageSZ,
      bemessung: bisher.bemessung + a.lst.szBesteuerung.bemessungFest,
    };
  }
  return bisher;
}

const UZ_JUNI = [6, [{ typ: 'UZ', betragCent: MONATSBEZUG }]];
const UZ_GEGENPROBE = 1_500_000;

/** Monat `zurueck` Monate vor `iso` als JJJJ-MM. */
function monatVorIso(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 1)).toISOString().slice(0, 7);
}
const WR_NOVEMBER = [11, [{ typ: 'WR', betragCent: MONATSBEZUG }]];

/** Negativtest: die Basis `typ` mit `betragCent` statt des gedeckelten Werts, Positionen je Satz neu gerundet. */
const ungedeckelt = (typ, betragCent) => (eintrag) => ({
  ...eintrag,
  tarifbloecke: eintrag.tarifbloecke.map((t) => ({
    ...t,
    basen: t.basen.map((b) =>
      b.typ !== typ
        ? b
        : {
            ...b,
            betragCent,
            positionen: b.positionen.map((p) => ({
              ...p,
              betragCent: Math.sign(p.prozentsatz) * Math.round((betragCent * Math.abs(p.prozentsatz)) / 100),
            })),
          },
    ),
  })),
});

const paket =
  (id, monat, mehr = {}) =>
  (ctx) => {
    const jahr = jahrVon(ctx);
    return mbgmPaket(ctx, {
      fall: id,
      dg: 'B',
      traeger: '15',
      monat: `${jahr}-${String(monat).padStart(2, '0')}`,
      bundesland: 'oberoesterreich',
      beschaeftigte: [{ rolle: 'freier_dn', mitarbeiter: mitarbeiter(jahr), ...mehr }],
    });
  };

/**
 * Reihenfolge-Probe: mBGM für einen Monat (Eintritt am Ersten, Austritt am Letzten) VOR der Anmeldung im selben
 * Fenster, danach Anmeldung (ohne BVAB, das DV endet im ersten Monat) und Abmeldung ohne BVEN.
 */
function reihenfolgeProbe(a) {
  const [idM, idAn, idAb] = a.ids;
  const tage = (ctx) => {
    const jahr = Number(ctx.zr.slice(0, 4)) - 1;
    const von = `${jahr}-${String(a.monat).padStart(2, '0')}-01`;
    const bis = new Date(Date.UTC(jahr, a.monat, 0)).toISOString().slice(0, 10);
    return { jahr, von, bis };
  };
  const angestellt = a.gruppe === 'angestellter';
  return [
    fall({
      id: idM,
      titel: a.titelMbgm,
      zweck: a.zweckMbgm,
      quelle: 'E.32; SIT KW46 Clearing Di nm/Mi vm (M98/M52: BW1837, dann BW1862)',
      erwartung: a.erwartungMbgm,
      fenster: MI_VM,
      abhaengig: [],
      rang: 9,
      baue: (ctx) => {
        const { jahr, von, bis } = tage(ctx);
        return mbgmPaket(ctx, {
          fall: idM,
          dg: a.dg,
          traeger: a.traeger,
          monat: von.slice(0, 7),
          bundesland: 'oberoesterreich',
          beschaeftigte: [
            {
              rolle: a.rolle,
              mitarbeiter: {
                ...mitarbeiter(jahr),
                dienstnehmerGruppe: a.gruppe,
                ...(angestellt ? {} : { wochenstunden: 38.5, kvBasisStunden: 38.5 }),
                eintritt: von,
                austritt: bis,
                grossSalaryCents: a.entgeltCent,
              },
            },
          ],
        });
      },
    }),
    fall({
      id: idAn,
      titel: a.titelAnmeldung,
      zweck: `Zweiter Schritt zu ${idM}. Ohne BVAB: das Dienstverhältnis endet im ersten Monat (${idAb}).`,
      quelle: 'E.29.2 (M3)',
      erwartung: 'übernommen',
      fenster: MI_VM,
      braucht: undefined,
      abhaengig: [idM],
      rang: 10,
      baue: (ctx) =>
        meldung(ctx, {
          fall: idAn,
          art: 'anmeldung',
          rolle: a.rolle,
          dg: a.dg,
          traeger: a.traeger,
          felder: {
            ADAT: ctx.ttmmjjjj(tage(ctx).von),
            BBER: angestellt ? '02' : '01',
            GERF: 'N',
            FRDV: 'N',
            VWAZ: angestellt ? ctx.elda.wochenarbeitszeit(40, 0) : ctx.elda.wochenarbeitszeit(38, 30),
          },
        }),
    }),
    fall({
      id: idAb,
      titel: a.titelAbmeldung,
      zweck: `Schließt ${idAn} im ersten Monat; ohne sie liefen danach mBGM von Amts wegen auf.`,
      quelle: 'E.29.2 (M4)',
      erwartung: 'übernommen, kein VW1942',
      fenster: MI_VM,
      braucht: undefined,
      abhaengig: [idAn],
      rang: 11,
      baue: (ctx) => {
        const { bis } = tage(ctx);
        return meldung(ctx, {
          fall: idAb,
          art: 'abmeldung',
          rolle: a.rolle,
          dg: a.dg,
          traeger: a.traeger,
          felder: { GERF: 'N', ADAT: ctx.ttmmjjjj(bis), EBSV: ctx.ttmmjjjj(bis), AGRD: '03' },
        });
      },
    }),
  ];
}

module.exports = [
  fall({
    id: 'Q67',
    titel: 'SZ-Höchstbeitragsgrundlage: Anmeldung freier_dn als Angestellte auf B/15 zum 01.01.2026 (M3)',
    zweck: 'Vorlauf für M110–M113; die Monate liegen im Vorjahr, die Anmeldung kommt also 15 Monate zu spät.',
    quelle: 'E.29.2 (M3, BBER 02, BVAB)',
    erwartung: 'übernommen',
    fenster: MI_VM,
    braucht: undefined,
    rang: 11,
    baue: (ctx) => {
      const jahr = Number(ctx.zr.slice(0, 4)) - 1;
      return meldung(ctx, {
        fall: 'Q67',
        art: 'anmeldung',
        rolle: 'freier_dn',
        dg: 'B',
        traeger: '15',
        felder: {
          ADAT: ctx.ttmmjjjj(`${jahr}-01-01`),
          BBER: '02',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
          BVAB: ctx.ttmmjjjj(`${jahr}-02-01`),
        },
      });
    },
  }),
  fall({
    id: 'M112',
    titel: 'Gegenprobe mBGM 01/2026 B/15: AB absichtlich ungedeckelt 9.000 € statt 6.930 €',
    zweck:
      'Prüft die ÖGK auf der SIT die Höchstbeitragsgrundlage? Erwartet ist ein Clearingfall (BW1850/BW1917 o. ä.). ' +
      'Bleibt er aus, sagt auch das Ausbleiben bei M102/M103/M111 nichts.',
    quelle: `${QUELLE}; Negativtest`,
    erwartung: 'formal übernommen; Clearing Mi nm mit einem Fall zur Beitragsgrundlage',
    fenster: MI_VM,
    abhaengig: ['Q67'],
    rang: 14,
    baue: paket('M112', 1, { abwandlung: ungedeckelt('AB', MONATSBEZUG) }),
  }),
  fall({
    id: 'M110',
    titel: 'mBGM 06/2026 B/15 über kasseneck: 9.000 € + UZ 9.000 € – SZ-Grundlage 9.000 € (unter 13.860 €)',
    zweck:
      'Erste Sonderzahlung des Jahres: laufend gedeckelt bei 6.930 €, SZ voll, BV auf beides (18.000 €).',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing Mi nm ohne BW1850/BW1917',
    fenster: MI_VM,
    abhaengig: ['Q67'],
    rang: 15,
    baue: paket('M110', 6, { sonderzahlung: szKontext(UZ_JUNI[0], UZ_JUNI[1]) }),
  }),
  fall({
    id: 'M111',
    titel: 'mBGM 11/2026 B/15 über kasseneck: 9.000 € + WR 9.000 € – SZ-Grundlage nur noch 4.860 €',
    zweck:
      'Zweite Sonderzahlung: kasseneck rechnet den Rest bis 13.860 € (4.860 €), die BV bleibt auf 18.000 €. Nimmt ' +
      'die ÖGK den Jahresdeckel so an?',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing Mi nm ohne BW1850/BW1917',
    fenster: MI_VM,
    abhaengig: ['Q67', 'M110'],
    rang: 16,
    baue: (ctx) =>
      paket('M111', 11, {
        sonderzahlung: szKontext(WR_NOVEMBER[0], WR_NOVEMBER[1], bisherNach(jahrVon(ctx), [UZ_JUNI])),
      })(ctx),
  }),
  fall({
    id: 'M113',
    titel:
      'mBGM 12/2026 B/15 über kasseneck: 9.000 € + WR 2.000 € nach ausgeschöpftem Deckel – SZ 0, BV 2.000 €',
    zweck:
      'Nach 13.860 € SZ-Grundlage im Jahr bleibt für weitere Sonderzahlungen nichts – aber die BV fällt weiter an ' +
      '(§ 6 Abs 1 BMSVG kennt keinen Deckel). Wie meldet kasseneck das, und nimmt die ÖGK es an?',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing Mi nm ohne BW1850/BW1917',
    fenster: MI_VM,
    abhaengig: ['Q67', 'M111'],
    rang: 17,
    baue: (ctx) =>
      paket('M113', 12, {
        sonderzahlung: szKontext(
          12,
          [{ typ: 'WR', betragCent: 200_000 }],
          bisherNach(jahrVon(ctx), [UZ_JUNI, WR_NOVEMBER]),
        ),
      })(ctx),
  }),
  fall({
    id: 'M115',
    titel: 'mBGM 03/2026 A/15 nachgereicht: V78/V79 (01.–31.03.), nachdem die ÖGK eine mBGM von Amts wegen erstellt hat',
    zweck:
      'Zu V78/V79 lief nie eine mBGM. Das Clearing Mi vm brachte X1 BW1922 (mBGM fehlt) und BW1916 VA/VB (mBGM SV ' +
      'von Amts wegen erstellt). Ersetzt die echte mBGM die amtliche lautlos, oder kommt ein eigener Clearingfall?',
    quelle: 'E.32; SIT KW46 Clearing Mi vm (X1 BW1922/BW1916); kasseneck mbgm-core.js',
    erwartung: 'offen: übernommen; Clearing Mi nm leer (BW1916 obsolet) oder ein Hinweis zur amtlichen mBGM',
    fenster: MI_VM,
    abhaengig: ['V78', 'V79'],
    rang: 26,
    baue: (ctx) => {
      const eintritt = ctx.zrVon('V78');
      const [j, m] = eintritt.split('-').map(Number);
      const ende = new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
      return mbgmPaket(ctx, {
        fall: 'M115',
        dg: 'A',
        traeger: '15',
        monat: eintritt.slice(0, 7),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'freier_dn',
            mitarbeiter: {
              dienstnehmerGruppe: 'arbeiter',
              beschaeftigungsart: 'fulltime',
              eintritt,
              austritt: ende,
              wochenstunden: 38.5,
              kvBasisStunden: 38.5,
              grossSalaryCents: 260_000,
            },
          },
        ],
      });
    },
  }),
  fall({
    id: 'M116',
    titel: 'Gegenprobe mBGM 06/2026 B/15: UZ 15.000 € absichtlich ungedeckelt statt 13.860 € (reserve_1 aus Q61)',
    zweck:
      'Wie M112 für die Sonderzahlungen: kasseneck deckelt die SZ-Grundlage bei 13.860 € im Jahr, gemeldet wird ' +
      'der volle UZ. Ohne Clearing hier sagt das Ausbleiben bei M110/M111/M113 nichts.',
    quelle: `${QUELLE}; Negativtest`,
    erwartung: 'formal übernommen; Clearing Mi nm mit einem Fall zur SZ-Grundlage',
    fenster: MI_VM,
    abhaengig: ['Q61'],
    rang: 18,
    baue: (ctx) => {
      const eintritt = `${monatVorIso(ctx.zrVon('Q61'), 2)}-01`;
      const jahr = Number(eintritt.slice(0, 4));
      const monate = 6 - Number(eintritt.slice(5, 7)) + 1;
      return mbgmPaket(ctx, {
        fall: 'M116',
        dg: 'B',
        traeger: '15',
        monat: `${jahr}-06`,
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'reserve_1',
            mitarbeiter: { ...mitarbeiter(jahr), eintritt },
            sonderzahlung: {
              posten: [{ typ: 'UZ', betragCent: UZ_GEGENPROBE }],
              bisherigeSzJahrCent: 0,
              bisherigeSzSvGrundlageJahrCent: 0,
              bisherigeSzBemessungJahrCent: 0,
              laufendeBezuegeJahrCent: MONATSBEZUG * monate,
              kalenderMonateImJahr: monate,
            },
            abwandlung: ungedeckelt('SZ', UZ_GEGENPROBE),
          },
        ],
      });
    },
  }),
  ...reihenfolgeProbe({
    ids: ['M117', 'Q68', 'Q69'],
    rolle: 'angestelltenlehrling',
    dg: 'A',
    traeger: '14',
    monat: 9,
    gruppe: 'angestellter',
    entgeltCent: 280_000,
    titelMbgm: 'mBGM 09/2026 A/14 über kasseneck VOR der Anmeldung (Q68/Q69 folgen im selben Fenster)',
    zweckMbgm:
      'Gesendet vor Q68. Verarbeitet die Sammelverarbeitung erst die Versichertenmeldungen (kein Clearing) oder ' +
      'in der Reihenfolge des Eingangs (BW1862 „keine Versicherungszeit SV gespeichert“)?',
    erwartungMbgm: 'offen: übernommen; Clearing Mi nm leer oder BW1862',
    titelAnmeldung: 'Anmeldung angestelltenlehrling als Angestellte auf A/14 zum 01.09.2026 – NACH der mBGM M117 (M3)',
    titelAbmeldung: 'Abmeldung angestelltenlehrling A/14 zum 30.09.2026, ohne BVEN (M4)',
  }),
  ...reihenfolgeProbe({
    ids: ['M126', 'Q70', 'Q71'],
    rolle: 'geringfuegig',
    dg: 'A',
    traeger: '15',
    monat: 1,
    gruppe: 'arbeiter',
    entgeltCent: 260_000,
    titelMbgm: 'mBGM 01/2026 A/15 über kasseneck VOR der Anmeldung, Konto im Monat sonst leer (Q70/Q71 folgen)',
    zweckMbgm:
      'Wie M117, aber auf einem Konto, auf dem im Monat niemand gemeldet ist (A/15 hat in KW46 erst ab 02/2026 ' +
      'Versicherte). Bei Verarbeitung in Eingangsreihenfolge käme BW1837 auf Paketebene („kein Versicherter“).',
    erwartungMbgm: 'offen: übernommen; Clearing Mi nm leer oder BW1837/BW1862',
    titelAnmeldung: 'Anmeldung geringfuegig als Arbeiterin auf A/15 zum 01.01.2026 – NACH der mBGM M126 (M3)',
    titelAbmeldung: 'Abmeldung geringfuegig A/15 zum 31.01.2026, ohne BVEN (M4)',
  }),
];
