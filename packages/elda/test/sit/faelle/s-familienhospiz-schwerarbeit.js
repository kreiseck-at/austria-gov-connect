'use strict';

// S – Familienhospizkarenz/Pflegekarenz (FH, E.12) und Schwerarbeitsmeldung
// (SM, E.22). Beide Verarbeitungen gibt es laut ÖGK („LSWH-Test –
// Regelbetrieb", 10/2023) auf der SIT.
//
// Ohne S40 am Montag wartet die Kette auf die nächste Woche: Eine Anmeldung am
// Mittwoch (sim. 2026) passte nicht zur Schwerarbeit „im Vorjahr".
//
// Die SIT hat keine vorab angelegten Versicherungsverläufe; jede Testperson
// beginnt mit unserer Anmeldung, und die Anlage wird nach jeder Woche
// zurückgesetzt. Deshalb bringt die Kette ihre eigene Anmeldung mit (S40),
// mit einer Reserveperson beim Konto A/14 – keine Rolle, die die V- und
// M-Fälle derselben Woche beschäftigen:
//
//   Mo vm (sim. 01.01.2025)  S40 Anmeldung (VR, M3) der Reserveperson
//   Di vm (sim. 01.03.2025)  S04 Anmeldung Pflegekarenz (FH 80, KART 04)
//   Di nm (sim. 01.04.2025)  S41 Abmeldung Pflegekarenz zum 31.03.2025 (FH 81)
//   Mi vm (sim. 01.04.2026)  S03 Schwerarbeitsmeldung für das Jahr 2025 (SM 65)
//   Mi nm (sim. 01.05.2026)  S31 Storno der Schwerarbeitsmeldung (SM 66)
//
// Dazu bewusst fehlerhafte Bestände, die der Builder des Pakets nie baut – sie
// werden nach der Prüfung abgewandelt (`aendern`). Sie zeigen zum ersten Mal,
// wie eine Mitteilung bei Abweisung aussieht (bisher kam alles `uebernommen`),
// und klären, ob ELDA strenger oder großzügiger ist als unsere Lesart:
//
//   S42 FH mit Karenzart 09        → erwartet F3001 (nicht übernommen)
//   S32 SM mit Tätigkeitsart 3     → erwartet F5580_1 (nicht übernommen)
//   S33 SM mit Tätigkeitsart „01"  → offen: zweistellig zulässig oder F5580_1?

const { familienhospiz, meldung, schwerarbeit } = require('../lib/bausteine');
const { plusTage } = require('../lib/fenster');

const PERSON = 'reserve_1';
const DG = 'A';
const TRAEGER = '14';

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
/** '2025-02-01' → '0102' (TTMM der Schwerarbeitsmeldung). */
const ttmm = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', ...mehr });

/** Schwerarbeit im Jahr der Anmeldung: schwere körperliche Arbeit in den ersten vier Wochen ab Eintritt. */
const sm = (ctx, id, art, aendern) => {
  const eintritt = ctx.zrVon('S40');
  return schwerarbeit(ctx, {
    fall: id,
    art,
    rolle: PERSON,
    dg: DG,
    traeger: TRAEGER,
    jahr: eintritt.slice(0, 4),
    taetigkeiten: [
      {
        art: ctx.elda.TAETIGKEIT.SCHWERE_KOERPERLICHE_ARBEIT,
        von: ttmm(eintritt),
        bis: ttmm(plusTage(eintritt, 27)),
      },
    ],
    aendern,
  });
};

module.exports = [
  fall({
    id: 'S40',
    titel: 'Anmeldung der Reserveperson für FH und SM (M3)',
    zweck:
      'Vorlauf: Familienhospiz- und Schwerarbeitsmeldung brauchen ein Beschäftigungsverhältnis; ' +
      'die SIT kennt nur, was wir in dieser Woche angemeldet haben.',
    quelle: 'E.29; ÖGK „LSWH-Test – Regelbetrieb" 10/2023 (keine vorab angelegten Verläufe)',
    erwartung: 'übernommen',
    fenster: ['mo-vm', 'mo-nm'],
    abhaengig: [],
    baue: (ctx) =>
      meldung(ctx, {
        fall: 'S40',
        art: 'anmeldung',
        rolle: PERSON,
        dg: DG,
        traeger: TRAEGER,
        felder: {
          ADAT: d(ctx, ctx.zr),
          BBER: '01',
          GERF: 'N',
          FRDV: 'N',
          VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
        },
      }),
  }),
  fall({
    id: 'S04',
    titel: 'Anmeldung Pflegekarenz gegen Entfall des Entgelts (FH 80, KART 04)',
    zweck:
      'Erste Familienhospiz-Meldung: Bestand FH, Version 03, Satzlänge 850. Beginn am simulierten Tag. ' +
      'Staatsangehörigkeit aus der Rolle oder AUT; Wohnanschrift nur, wenn die Rolle eine hat ' +
      '(fehlt sie, erwartet der Prüfkatalog nur Warnungen F0100–F0130).',
    quelle: 'E.12, E.12.1, E.12.2; D.13; Prüfkatalog Blatt FH und Allgemein',
    erwartung: 'übernommen (ohne Wohnanschrift ggf. mit Warnungen)',
    fenster: ['di-vm', 'mi-vm'],
    abhaengig: ['S40'],
    baue: (ctx) =>
      familienhospiz(ctx, {
        fall: 'S04',
        art: 'familienhospizAnmeldung',
        rolle: PERSON,
        dg: DG,
        traeger: TRAEGER,
        felder: { ADAT: d(ctx, ctx.zr), KART: ctx.elda.KARENZART.PFLEGEKARENZ },
      }),
  }),
  fall({
    id: 'S41',
    titel: 'Abmeldung Pflegekarenz bei Wiederantritt (FH 81)',
    zweck:
      'Ende der Karenz am Vortag des simulierten Datums (D.13: „Datum der Abmeldung (Ende ' +
      'Familienhospizanspruch)"). Karenzart wie in der Anmeldung – die Matrix führt KART auch bei 81 als Z.',
    quelle: 'E.12.1, E.12.2, D.13',
    erwartung: 'übernommen',
    fenster: ['di-nm', 'mi-nm'],
    abhaengig: ['S04'],
    baue: (ctx) =>
      familienhospiz(ctx, {
        fall: 'S41',
        art: 'familienhospizAbmeldung',
        rolle: PERSON,
        dg: DG,
        traeger: TRAEGER,
        felder: { ADAT: d(ctx, plusTage(ctx.zr, -1)), KART: ctx.elda.KARENZART.PFLEGEKARENZ },
      }),
  }),
  fall({
    id: 'S42',
    titel: 'Negativtest: Karenzart 09 (FH 80)',
    zweck:
      'Eine Inhaltsprüfung mit Status N schlägt an. Zeigt die Mitteilung bei Abweisung ' +
      '(nicht_uebernommen, Code in meldungen/meldung/codes) – bisher nie beobachtet.',
    quelle: 'Prüfkatalog Blatt FH, F3001; Mitteilungs-Schema 3.0',
    erwartung: 'nicht übernommen, F3001',
    fenster: ['mo-nm', 'di-vm', 'di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['S40'],
    rang: 26,
    baue: (ctx) =>
      familienhospiz(ctx, {
        fall: 'S42',
        art: 'familienhospizAnmeldung',
        rolle: PERSON,
        dg: DG,
        traeger: TRAEGER,
        felder: { ADAT: d(ctx, ctx.zr), KART: ctx.elda.KARENZART.PFLEGEKARENZ },
        aendern: { KART: '09' },
      }),
  }),
  fall({
    id: 'S03',
    titel: 'Schwerarbeitsmeldung für das Vorjahr (SM 65)',
    zweck:
      'Erste Schwerarbeitsmeldung: Bestand SM, Version 02 (Kapitelkopf E.22; die Fehlertexte nennen ' +
      '„SM01"), Satzlänge 800. Tätigkeitsart 4 in den ersten vier Wochen ab Eintritt. Klärt auch, ' +
      'ob die einstellige Tätigkeitsart linksbündig („4 ") angenommen wird und ob eine Meldung nach der ' +
      'Frist (Ende Februar des Folgejahres, § 5 SchwerarbeitsV) noch übernommen wird.',
    quelle: 'E.22, E.22.1, E.22.2; Prüfkatalog Blatt SM und Allgemein; § 5 SchwerarbeitsV',
    erwartung: 'übernommen',
    fenster: ['mi-vm'],
    abhaengig: ['S40'],
    baue: (ctx) => sm(ctx, 'S03', 'schwerarbeitsmeldung'),
  }),
  fall({
    id: 'S31',
    titel: 'Storno der Schwerarbeitsmeldung (SM 66)',
    zweck:
      'E.22 beschreibt nicht, wie ELDA einen Storno der ursprünglichen Meldung zuordnet – gesendet ' +
      'werden dieselben Daten wie in S03. Was die Verarbeitung damit macht, zeigt die Rücksendung.',
    quelle: 'E.22, E.22.1',
    erwartung: 'übernommen?',
    fenster: ['mi-nm'],
    abhaengig: ['S03'],
    baue: (ctx) => sm(ctx, 'S31', 'stornoSchwerarbeitsmeldung'),
  }),
  fall({
    id: 'S32',
    titel: 'Negativtest: Tätigkeitsart 3 (SM 65)',
    zweck:
      'Z 3 der Schwerarbeitsverordnung ist laut E.22.2 nicht meldepflichtig und fehlt in der Codeliste. ' +
      'Eine Inhaltsprüfung mit Status N je Tätigkeitsblock.',
    quelle: 'E.22 Feld 17, E.22.2; Prüfkatalog Blatt SM, F5580_1',
    erwartung: 'nicht übernommen, F5580_1',
    fenster: ['mi-vm', 'mi-nm'],
    abhaengig: ['S40'],
    rang: 26,
    baue: (ctx) => sm(ctx, 'S32', 'schwerarbeitsmeldung', { TART_1: '3' }),
  }),
  fall({
    id: 'S33',
    titel: 'Tätigkeitsart zweistellig „01" (SM 65)',
    zweck:
      'Das Feld TART ist zweistellig, die Codes sind einstellig abgedruckt. Das Paket sendet „1 " und ' +
      'weist „01" ab. Nimmt ELDA „01" an, ist das Paket zu streng.',
    quelle: 'E.22 Feld 17; Prüfkatalog Blatt SM, F5580',
    erwartung: '? (angenommen oder F5580_1)',
    fenster: ['mi-nm'],
    abhaengig: ['S40', 'S31'],
    rang: 27,
    baue: (ctx) => sm(ctx, 'S33', 'schwerarbeitsmeldung', { TART_1: '01' }),
  }),
];
