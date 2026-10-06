'use strict';

// V – Versichertenmeldung reduziert (E.29), positive Fälle für KW41.
//
// Regelablauf in einer Woche (die Anlage wird danach zurückgesetzt):
//   Mo vormittags  V01 Arbeiter, V02 Angestellte (zweiter Träger)
//   Mo nachmittags V03–V06 Lehrlinge, geringfügig, freier DN
//   Di vormittags  V07 Änderung, V15 Abmeldung Probezeit, V09 Richtigstellung,
//                  V11 Storno Anmeldung, V13 Abmeldung mit Urlaubsersatzleistung
//   Di nachmittags V12 Abmeldung, V19 Richtigstellung Abmeldung, V20 Storno Abmeldung
//
// Ausweichablauf am Mittwoch (falls der SIT VR Version 03 an Tagen ablehnt, die
// 2025 simulieren): alle Anmeldungen Mi vormittags, alle Folgemeldungen Mi
// nachmittags. Deshalb rechnet jeder Fall seine Daten aus dem eigenen Fenster
// (`ctx.zr`) und aus dem tatsächlichen Lauf der Ursprungsmeldung (`ctx.zrVon`),
// nie aus fest genannten Fenstern.
//
// Feldbelegung nach E.29.1 und den Beispielen aus E.29.2; bei M8/M9/S3/S4 stehen
// die Namen in Grundstellung, der Verweis auf die Ursprungsmeldung geht über REFU.

const { meldung } = require('../lib/bausteine');
const { plusTage } = require('../lib/fenster');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const ANMELDUNG = ['mo-vm', 'mi-vm'];
const ANMELDUNG_NM = ['mo-nm', 'mi-vm'];
const FOLGE_VM = ['di-vm', 'mi-nm'];
const FOLGE_NM = ['di-nm', 'mi-nm'];

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });

const anmeldung =
  (id, rolle, dg, traeger, felder, { freieDN = false } = {}) =>
  (ctx) =>
    meldung(ctx, {
      fall: id,
      art: 'anmeldung',
      rolle,
      dg,
      traeger,
      freieDN,
      felder: { ADAT: d(ctx, ctx.zr), ...felder(ctx) },
    });

const VOLLZEIT = (ctx) => ctx.elda.wochenarbeitszeit(40, 0);

module.exports = [
  fall({
    id: 'V01',
    titel: 'Anmeldung Arbeiter Vollzeit (M3)',
    zweck:
      'Referenzfall: eine einfache Anmeldung wird übernommen. Klärt zugleich die Versionsfrage – ' +
      'nimmt der SIT VR Version 03 an einem Tag an, der 2025 simuliert?',
    quelle: 'E.29, E.29.1, D.39',
    erwartung: 'senden 000; mitteilung übernommen',
    fenster: ANMELDUNG,
    baue: anmeldung('V01', 'arbeiter', 'A', '14', (ctx) => ({
      BBER: '01',
      GERF: 'N',
      FRDV: 'N',
      VWAZ: VOLLZEIT(ctx),
    })),
  }),
  fall({
    id: 'V02',
    titel: 'Anmeldung Angestellte Teilzeit beim zweiten Träger (M3)',
    zweck: 'Zweiter Bestand mit anderem zuständigem Träger (VSTR 15) neben V01.',
    quelle: 'E.29, D.4, D.39',
    erwartung: 'übernommen',
    fenster: ANMELDUNG,
    baue: anmeldung('V02', 'angestellte', 'A', '15', (ctx) => ({
      BBER: '02',
      GERF: 'N',
      FRDV: 'N',
      VWAZ: ctx.elda.wochenarbeitszeit(20, 0),
    })),
  }),
  fall({
    id: 'V03',
    titel: 'Anmeldung Arbeiterlehrling (M3)',
    zweck: 'Beschäftigungsbereich 03.',
    quelle: 'E.29, D.39',
    erwartung: 'übernommen',
    fenster: ANMELDUNG_NM,
    baue: anmeldung('V03', 'arbeiterlehrling', 'A', '14', (ctx) => ({
      BBER: '03',
      GERF: 'N',
      FRDV: 'N',
      VWAZ: VOLLZEIT(ctx),
    })),
  }),
  fall({
    id: 'V04',
    titel: 'Anmeldung Angestelltenlehrling (M3)',
    zweck: 'Beschäftigungsbereich 04.',
    quelle: 'E.29, D.39',
    erwartung: 'übernommen',
    fenster: ANMELDUNG_NM,
    baue: anmeldung('V04', 'angestelltenlehrling', 'A', '14', (ctx) => ({
      BBER: '04',
      GERF: 'N',
      FRDV: 'N',
      VWAZ: VOLLZEIT(ctx),
    })),
  }),
  fall({
    id: 'V05',
    titel: 'Anmeldung geringfügig (M3)',
    zweck: 'Kennzeichen Geringfügigkeit J.',
    quelle: 'E.29, Feld 19 GERF',
    erwartung: 'übernommen',
    fenster: ANMELDUNG_NM,
    baue: anmeldung('V05', 'geringfuegig', 'A', '14', (ctx) => ({
      BBER: '01',
      GERF: 'J',
      FRDV: 'N',
      VWAZ: ctx.elda.wochenarbeitszeit(10, 0),
    })),
  }),
  fall({
    id: 'V06',
    titel: 'Anmeldung freier Dienstnehmer (M3)',
    zweck: 'Freier Dienstvertrag beim Konto, auf dem freie DN vorgesehen sind.',
    quelle: 'E.29, D.41',
    erwartung: 'übernommen',
    fenster: ANMELDUNG_NM,
    baue: anmeldung('V06', 'freier_dn', 'B', '15', () => ({ BBER: '02', GERF: 'N', FRDV: 'J' }), {
      freieDN: true,
    }),
  }),
  fall({
    id: 'V07',
    titel: 'Änderungsmeldung Arbeiter → Angestellter (M6)',
    zweck: 'M6 ändert ausschließlich BBER, GERF und FRDV; Änderungsdatum = simuliertes Datum.',
    quelle: 'E.29.2 (M6), Beispiel Seite 309',
    erwartung: 'übernommen',
    fenster: FOLGE_VM,
    abhaengig: ['V01'],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V07',
        art: 'aenderungsmeldung',
        rolle: 'arbeiter',
        dg: 'A',
        traeger: '14',
        felder: { ADAT: d(ctx, ctx.zr), BBER: '02', GERF: 'N', FRDV: 'N' },
      }),
  }),
  fall({
    id: 'V09',
    titel: 'Richtigstellung Anmeldung: Wochenarbeitszeit (M8)',
    zweck:
      'Richtigstellung über REFU, Datum unverändert. BVAB bleibt unbelegt wie in der Anmeldung – laut E.29.2 ' +
      '(Seite 314/315) kann ein unbelegtes BVAB eine BV-Zeit stornieren; hier gibt es keine gemeldete. Beobachten.',
    quelle: 'E.29.2 (M8), Beispiele Seite 314/315',
    erwartung: 'übernommen',
    fenster: FOLGE_VM,
    abhaengig: ['V02'],
    baue: (ctx) => {
      const beginn = d(ctx, ctx.zrVon('V02'));
      return meldung(ctx, {
        fall: 'V09',
        art: 'richtigstellungAnmeldung',
        rolle: 'angestellte',
        dg: 'A',
        traeger: '15',
        felder: {
          REFU: ctx.referenzwertVon('V02'),
          ADAT: beginn,
          RDAT: beginn,
          VWAZ: ctx.elda.wochenarbeitszeit(25, 0),
        },
      });
    },
  }),
  fall({
    id: 'V11',
    titel: 'Storno Anmeldung (S3)',
    zweck: 'Storno einer Anmeldung über REFU.',
    quelle: 'E.29.1 (S3), D.43',
    erwartung: 'übernommen',
    fenster: FOLGE_VM,
    abhaengig: ['V05'],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V11',
        art: 'stornoAnmeldung',
        rolle: 'geringfuegig',
        dg: 'A',
        traeger: '14',
        felder: { REFU: ctx.referenzwertVon('V05'), ADAT: d(ctx, ctx.zrVon('V05')) },
      }),
  }),
  fall({
    id: 'V12',
    titel: 'Abmeldung Kündigung durch den Dienstgeber (M4)',
    zweck: 'Abmeldegrund 01; Ende am simulierten Tag selbst, gemeldet am selben Tag.',
    quelle: 'E.29.2 (M4), D.22',
    erwartung: 'übernommen',
    fenster: FOLGE_NM,
    abhaengig: ['V07'],
    baue: (ctx) => {
      const ende = d(ctx, ctx.zr);
      return meldung(ctx, {
        fall: 'V12',
        art: 'abmeldung',
        rolle: 'arbeiter',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '01', BVEN: ende },
      });
    },
  }),
  fall({
    id: 'V13',
    titel: 'Abmeldung einvernehmlich mit Urlaubsersatzleistung (M4)',
    zweck:
      'ADAT ist das Ende der Pflichtversicherung samt UEL, EBSV das Ende der Beschäftigung (Muster Seite 316). ' +
      'Das Ende liegt sechs Tage nach dem simulierten Datum – nimmt ELDA eine vorausdatierte Abmeldung an?',
    quelle: 'E.29.2 (M4), Beispiel Seite 316; D.22',
    erwartung: 'übernommen?',
    fenster: FOLGE_VM,
    abhaengig: ['V02'],
    baue: (ctx) => {
      const uebi = d(ctx, plusTage(ctx.zr, 6));
      return meldung(ctx, {
        fall: 'V13',
        art: 'abmeldung',
        rolle: 'angestellte',
        dg: 'A',
        traeger: '15',
        felder: {
          GERF: 'N',
          ADAT: uebi,
          EBSV: d(ctx, plusTage(ctx.zr, -1)),
          AGRD: '03',
          UEAB: d(ctx, ctx.zr),
          UEBI: uebi,
          BVEN: uebi,
        },
      });
    },
  }),
  fall({
    id: 'V15',
    titel: 'Abmeldung Lösung in der Probezeit durch den Dienstgeber (M4)',
    zweck: 'Abmeldegrund 30; Ende am Vortag des simulierten Datums.',
    quelle: 'E.29.2 (M4), D.22',
    erwartung: 'übernommen',
    fenster: FOLGE_VM,
    abhaengig: ['V03'],
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'V15',
        art: 'abmeldung',
        rolle: 'arbeiterlehrling',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '30', BVEN: ende },
      });
    },
  }),
  fall({
    id: 'V16',
    titel: 'Abmeldung Lehrling einvernehmlich nach mBGM mit BV (M4)',
    zweck:
      'Prüft die Lehre aus V15/VW1942: dieselbe Person, aber erst nachdem M03 die BV-Zeit ' +
      'gemeldet hat. Abmeldegrund 03 (einvernehmliche Lösung), Ende am Vortag des simulierten Datums.',
    quelle: 'E.29.2 (M4), D.22; SIT-Befund B008',
    erwartung: 'übernommen und in der Sammelverarbeitung verarbeitet (kein VW1942)',
    fenster: ['mi-vm'],
    abhaengig: ['M03'],
    rang: 25,
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zr, -1));
      return meldung(ctx, {
        fall: 'V16',
        art: 'abmeldung',
        rolle: 'arbeiterlehrling',
        dg: 'A',
        traeger: '14',
        felder: { GERF: 'N', ADAT: ende, EBSV: ende, AGRD: '03', BVEN: ende },
      });
    },
  }),
  fall({
    id: 'V19',
    titel: 'Richtigstellung Abmeldung: Abmeldegrund 30 → 34 (M9)',
    zweck: 'Richtigstellung einer Abmeldung über REFU, Datum unverändert.',
    quelle: 'E.29.2 (M9), Beispiel Seite 316',
    erwartung: 'übernommen',
    fenster: FOLGE_NM,
    abhaengig: ['V15'],
    baue: (ctx) => {
      const ende = d(ctx, plusTage(ctx.zrVon('V15'), -1));
      return meldung(ctx, {
        fall: 'V19',
        art: 'richtigstellungAbmeldung',
        rolle: 'arbeiterlehrling',
        dg: 'A',
        traeger: '14',
        felder: {
          REFU: ctx.referenzwertVon('V15'),
          GERF: 'N',
          RDAT: ende,
          ADAT: ende,
          EBSV: ende,
          AGRD: '34',
          BVEN: ende,
        },
      });
    },
  }),
  fall({
    id: 'V20',
    titel: 'Storno Abmeldung (S4)',
    zweck: 'Storno einer Abmeldung über REFU, unmittelbar nach der Abmeldung.',
    quelle: 'E.29.1 (S4), E.29.2 Ummeldung Beispiel 3',
    erwartung: 'übernommen',
    fenster: FOLGE_NM,
    abhaengig: ['V12'],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'V20',
        art: 'stornoAbmeldung',
        rolle: 'arbeiter',
        dg: 'A',
        traeger: '14',
        felder: { REFU: ctx.referenzwertVon('V12'), ADAT: d(ctx, ctx.zrVon('V12')) },
      }),
  }),
];
