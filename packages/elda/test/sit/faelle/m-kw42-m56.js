'use strict';

// M56 – mBGM für einen freien Dienstnehmer (Paket-Weg). kasseneck baut für freie
// Dienstnehmer keine mBGM (Produktlücke); diese Probe zeigt, was die ÖGK dafür
// erwartet.
//
// Person: der freie Dienstnehmer aus V06 auf Konto B/15F (angemeldet zum
// 01.02.2025, FRDV J, OHNE BVAB). Beitragszeitraum 03/2025 = zweiter Monat:
// SV-Zeit und BV-Pflicht (der erste Monat Februar ist beitragsfrei, § 6 Abs 1
// BMSVG; das BMSVG gilt laut § 1 Abs 1a auch für freie Dienstnehmer).
//
// Beschäftigtengruppe B053 („Freie Dienstnehmer – Angestellte“): NICHT amtlich
// belegt. Die ÖGK-Tarifsystem-PDFs nennen nur Bezeichnung und Kürzel
// („Fr. DN Ang.“), keine B-Nummer; die Nummer stammt aus einer Zuordnungsliste
// eines Lohnsoftware-Herstellers (Deutner Software, „Umwandlung SV-Gruppe bis
// 2018 auf Tarifgruppe ab 2019“, Lohnmapping.pdf: „M1r/M2ru/M2r/M3ru/M4ru Ang.oSZ
// … B053“, freie Arbeiter B051). Ob die Gruppe passt, zeigt das Clearing.
//
// Satz T01 38,05 %: ÖGK-Tarifsystem „Freie Dienstnehmer – Angestellte (Fr. DN
// Ang.)“, Gesamtbeitragssatz 38,05 (AV 5,90, KV 7,65, PV 22,80, UV 1,10, AK
// 0,50, IE 0,10), Fassung „DG ohne Niederlassung in Österreich – gültig ab
// 01.07.2026“ (oegk.at, contentid 10008.807381). Für 03/2025 nicht eigens
// belegt; die Fassung „Landwirtschaftliche Betriebe – 01.01.2025“
// (sozialversicherung.gv.at, contentid 10008.790924) zeigt für freie DN dieselben
// SV-Sätze (DN 2,95 + 3,87 + 10,25 = 17,07 %). BV 1,53 % (Zuschlag „BV“ in
// derselben Tabelle). Weicht die ÖGK ab, kommt BW1850.

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });

const ENTGELT = 300_000;
const T01_FR_DN_ANG = 38.05;
const BV_SATZ = 1.53;

module.exports = [
  fall({
    id: 'M56',
    titel: 'mBGM 03/2025 für den freien Dienstnehmer V06 (Paket-Weg, B053, mit BV)',
    zweck:
      'kasseneck baut für freie DN keine mBGM. Klärt, welche Beschäftigtengruppe die ÖGK für einen freien ' +
      'Dienstnehmer (Angestellter) annimmt und ob die BV-Verrechnung ohne BVAB in der Anmeldung (V06) wie ' +
      'beim Arbeiter mit BW1871 beantwortet wird.',
    quelle:
      'E.32; Tarifsystem ÖGK „Fr. DN Ang.“ (10008.807381, 10008.790924); B053 nur aus Lohnmapping.pdf ' +
      '(Deutner Software) – nicht amtlich; § 6 Abs 1 BMSVG; SIT M66/V01 (BW1871 ohne BVAB, 13.10.2026)',
    erwartung:
      'formal übernommen; Clearing zeigt, ob die Gruppe B053 passt (sonst Code dazu), BW1871 zur BV ' +
      '(V06 ohne BVAB angemeldet), BW1850 möglich (Satz 2025 nicht eigens belegt)',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V06'],
    rang: 50,
    baue: (ctx) => {
      const konto = ctx.konto('B', { traeger: '15', freieDN: true });
      const p = ctx.rolle('freier_dn');
      const refw = ctx.referenzwert('M56-1');
      const paketref = ctx.referenzwert('M56');
      const saetze = ctx.elda.erstelleMbgmPaket(
        [
          {
            referenzwert: refw,
            versicherungsnummer: p.vsnr,
            familienname: p.familienname,
            vorname: p.vorname,
            verrechnungsgrundlage: ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
            tarifbloecke: [
              {
                beschaeftigtengruppe: 'B053',
                beginnDerVerrechnung: 1,
                basen: [
                  {
                    typ: 'AB',
                    betragCent: ENTGELT,
                    positionen: [
                      {
                        typ: 'T01',
                        prozentsatz: T01_FR_DN_ANG,
                        betragCent: ctx.elda.berechneBeitragCent(ENTGELT, T01_FR_DN_ANG),
                      },
                    ],
                  },
                  {
                    typ: 'BV',
                    betragCent: ENTGELT,
                    positionen: [
                      { typ: 'V01', prozentsatz: BV_SATZ, betragCent: ctx.elda.berechneBeitragCent(ENTGELT, BV_SATZ) },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        {
          verfahren: 'selbstabrechnung',
          paketreferenzwert: paketref,
          beitragskontonummer: konto.bknr,
          dienstgebername: ctx.dienstgeber('B').name,
          beitragszeitraum: '032025',
          jaehrlicheAbrechnungGeringfuegiger: false,
        },
      );
      const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
      if (befunde.length > 0) throw new Error(`mBGM-Paket M56 hat Befunde: ${JSON.stringify(befunde).slice(0, 400)}`);
      return {
        inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'B', traeger: '15' })),
        dateiName: ctx.dateiName('M56'),
        referenzwerte: [paketref, refw],
      };
    },
  }),
];
