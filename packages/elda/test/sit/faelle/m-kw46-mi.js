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
];
