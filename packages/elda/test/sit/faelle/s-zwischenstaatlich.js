'use strict';

// S50–S55 – Antrag auf zwischenstaatliche Bescheinigung (Bestand ES, Kapitel E.27).
//
// Ob die SIT-Plattform ES heute verarbeitet, ist offen: Die ÖGK hat beim
// LSWH-Event am 09.10.2025 (Präsentation der ÖGK, Seite 24) die „Erweiterung des
// Testportfolios für den LSWH-Tests um Anträge auf zwischenstaatliche
// Bescheinigungen (Satzarten E1, E2, E3, E4, E5) mit voraussichtlich Ende 2025"
// angekündigt; eine Bestätigung ist öffentlich nicht zu finden. Diese Fälle
// klären das: Kommt der Bestand mit „unbekannter Bestand/Verarbeitung" zurück,
// ist ES auf der SIT noch nicht freigegeben – das ist dann der Befund, kein
// Fehler im Paket. EA (Telearbeit, an den Dachverband) war nicht angekündigt
// und ist deshalb nicht dabei.
//
// Personen: Antragsteller sind Testpersonen, die in derselben Woche angemeldet
// wurden (V01, V02, B03), damit eine Abweisung etwas über den Antrag sagt und
// nicht über eine fehlende Versicherung. Wohnadresse und Staatsangehörigkeit
// stehen nicht in den Testdaten; laut Stammdaten-Basispaket wohnen alle
// Testpersonen in 5020 Salzburg. Straße und Staatsangehörigkeit (AT) sind
// Annahmen für den Test – weicht die SIT darauf ab, ist auch das ein Befund.

const { randomUUID } = require('node:crypto');
const { plusTage } = require('../lib/fenster');
const { setzeFeld } = require('../lib/bausteine');

const NACH_ANMELDUNG = ['mo-nm', 'di-vm', 'di-nm', 'mi-nm'];
const fall = (mehr) => ({ gefahr: null, aktion: 'senden', ...mehr });

const GESCHLECHT = { m: '1', w: '2' };

function person(ctx, rolle) {
  const p = ctx.rolle(rolle);
  const gesl = GESCHLECHT[p.geschlecht];
  if (!gesl) throw new Error(`Rolle ${rolle}: Geschlecht '${p.geschlecht}' ist für E.27 nicht zugeordnet.`);
  return {
    VONA: p.vorname,
    FANA: p.familienname,
    GESL: gesl,
    GEBD: p.geburtsdatum,
    VSNR: p.vsnr,
    STSL: 'AT',
    STRA: 'Teststraße 1',
    WKFZ: 'AT',
    PLZL: '5020',
    WORT: 'Salzburg',
  };
}

/** Dienstgeber-Block aus den Testdaten; die SIT-Dienstgeber sitzen in Österreich. */
function dienstgeber(ctx, dg, traeger, mehr) {
  const d = ctx.dienstgeber(dg);
  if (d.anschrift.kfz !== 'A') throw new Error(`Dienstgeber ${dg} sitzt nicht in Österreich.`);
  return {
    DGNA: d.name,
    BKNR: ctx.konto(dg, { traeger }).bknr,
    VTBK: traeger,
    DGSTR: d.anschrift.strasse,
    DGKFZ: 'AT',
    DGPLZ: d.anschrift.plz,
    DGORT: d.anschrift.ort,
    ...mehr,
  };
}

/** Beginn zwei Wochen nach dem simulierten Tag, Ende drei Monate später. */
function zeitraum(ctx) {
  const beginn = plusTage(ctx.zr, 14);
  return { BBEG: ctx.ttmmjjjj(beginn), BEND: ctx.ttmmjjjj(plusTage(beginn, 90)) };
}

function bestand(ctx, fallId, satz, { dg, traeger }) {
  return {
    inhalt: ctx.elda.erstelleEsBestand([satz], ctx.bestandOptionen({ dg, traeger })),
    dateiName: ctx.dateiName(fallId),
    referenzwerte: [satz.werte.UIDM],
  };
}

function entsendungE1(ctx, uidm) {
  return ctx.elda.antragZwischenstaatlich('E1', {
    UIDM: uidm,
    ...person(ctx, 'arbeiter'),
    dienstgeber: [dienstgeber(ctx, 'A', '14', { DGWS: '03', ...zeitraum(ctx) })],
    DGPS: 'J',
    AGSTAAT: 'DE',
    BFEST: 'J',
    AGNA: 'Beispiel Montage GmbH',
    AGSTR: 'Beispielweg 2',
    AGPLZ: '80331',
    AGORT: 'München',
    ANABL: 'N',
    BUEL: 'N',
    ANFL: 'N',
  });
}

const feldVon = (name) => {
  const { FELDER_E27 } = require('../../../dist/felder-e27.js');
  return FELDER_E27.find((f) => f.name === name);
};

/** Die Versicherungsnummer mit verfälschter vierter Stelle – nie gültig (Prüfziffer eindeutig). */
function falscheVsnr(vsnr) {
  return vsnr.slice(0, 3) + String((Number(vsnr[3]) + 1) % 10) + vsnr.slice(4);
}

module.exports = [
  fall({
    id: 'S50',
    titel: 'Antrag Entsendung nach Deutschland (ES, E1)',
    zweck:
      'Klärt, ob die SIT Anträge auf zwischenstaatliche Bescheinigung verarbeitet, und prüft den ' +
      'Satz (9028 Zeichen, Version 08) gegen ELDA.',
    quelle: 'E.27, E.27.1, D.36; ÖGK LSWH-Event 09.10.2025, Seite 24',
    erwartung: 'übernommen – oder Abweisung „Bestand ES" = auf der SIT noch nicht freigegeben',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['V01'],
    baue: (ctx) => bestand(ctx, 'S50', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' }),
  }),
  fall({
    id: 'S51',
    titel: 'Antrag Entsendung nach Serbien, bilaterales Abkommen (ES, E5)',
    zweck: 'Satzart E5 mit Staat aus der Tabelle „Satzart E5"; ohne Wirtschaftssektor.',
    quelle: 'E.27, E.27.1, D.36 (Satzart E5)',
    erwartung: 'übernommen',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['V02', 'S50'],
    baue: (ctx) =>
      bestand(
        ctx,
        'S51',
        ctx.elda.antragZwischenstaatlich('E5', {
          UIDM: randomUUID(),
          ...person(ctx, 'angestellte'),
          dienstgeber: [dienstgeber(ctx, 'A', '15', zeitraum(ctx))],
          AGSTAAT: 'RS',
          BFEST: 'N',
          ANIV: 'N',
        }),
        { dg: 'A', traeger: '15' },
      ),
  }),
  fall({
    id: 'S52',
    titel: 'Antrag Beschäftigung in Österreich und Slowenien (ES, E2)',
    zweck: 'Satzart E2 mit Arbeitsorten; ANATJ = J verlangt einen Arbeitsort in Österreich.',
    quelle: 'E.27, E.27.1, D.36; Prüfkatalog Blatt ES F7650',
    erwartung: 'übernommen',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['B03', 'S50'],
    baue: (ctx) => {
      const d = ctx.dienstgeber('B');
      const beginn = plusTage(ctx.zr, 14);
      return bestand(
        ctx,
        'S52',
        ctx.elda.antragZwischenstaatlich('E2', {
          UIDM: randomUUID(),
          ...person(ctx, 'reserve_1'),
          dienstgeber: [
            dienstgeber(ctx, 'B', '15', {
              DGWS: '04',
              ...zeitraum(ctx),
              BEAT: 'N',
              ANKZ: 'N',
            }),
          ],
          ANATJ: 'J',
          arbeitsorte: [
            {
              AOST: 'AT',
              AOKBS: 'J',
              AOFNSN: d.name,
              AOSTRA: d.anschrift.strasse,
              AOPLZL: d.anschrift.plz,
              AOORT: d.anschrift.ort,
            },
            { AOST: 'SI', AOKBS: 'N' },
          ],
          AZRV: ctx.ttmmjjjj(beginn),
          AZRB: ctx.ttmmjjjj(plusTage(beginn, 364)),
          ANFL: 'N',
        }),
        { dg: 'B', traeger: '15' },
      );
    },
  }),
  fall({
    id: 'S53',
    titel: 'Storno des Antrags S50 (ES, E1, MART 02)',
    zweck: 'Storno über die UIDU des Antrags; der Storno-Satz trägt sonst nur Grundstellung.',
    quelle: 'E.27.2 (Storno), D.68, D.69',
    erwartung: 'übernommen',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['S50'],
    baue: (ctx) =>
      bestand(
        ctx,
        'S53',
        ctx.elda.stornoAntragZwischenstaatlich('E1', {
          UIDM: randomUUID(),
          UIDU: ctx.referenzwertVon('S50'),
        }),
        { dg: 'A', traeger: '14' },
      ),
  }),
  fall({
    id: 'S54',
    titel: 'Negativ: Entsendung nach Österreich (E1, AGSTAAT AT)',
    zweck: 'Fußnote 33 zu D.36: AT ist bei E1 nicht zulässig. Kommt F7611 zurück?',
    quelle: 'D.36 Fußnote 33; Prüfkatalog Blatt ES Nr. 4 (F7611)',
    erwartung: 'nicht übernommen, F7611',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['S50'],
    baue: (ctx) => {
      const b = bestand(ctx, 'S54', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' });
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, feldVon('AGSTAAT'), 'AT') };
    },
  }),
  fall({
    id: 'S55',
    titel: 'Negativ: zweiter Dienstgeber bei E1',
    zweck: 'Bei E1 ist der Dienstgeber-Block nur einmal zulässig. Kommt F7515 zurück?',
    quelle: 'E.27 Seite 295; Prüfkatalog Blatt ES (F7515)',
    erwartung: 'nicht übernommen, F7515',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['S50'],
    baue: (ctx) => {
      const b = bestand(ctx, 'S55', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' });
      // Platz 2 des Dienstgeber-Blocks (399 Zeichen ab DGNA_2) wird eine Kopie von Platz 1.
      const p1 = feldVon('DGNA_1').pos;
      const p2 = feldVon('DGNA_2').pos;
      const block1 = b.inhalt.toString('latin1').split('\r\n')[1].slice(p1 - 1, p2 - 1);
      const platz2 = { name: 'Dienstgeber-Block Platz 2', pos: p2, laenge: p2 - p1 };
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, platz2, block1) };
    },
  }),
  fall({
    id: 'S56',
    titel: 'Negativtest: Entsendung mit falscher Prüfziffer der VSNR (E1)',
    zweck:
      'V21 (12.10.2026) zeigte: Bei der Versichertenmeldung weist ELDA eine falsche Prüfziffer mit F7020 ab. ' +
      'Prüft dasselbe für diese Meldungsart (Paket prüft hier bisher nur die Stellenfolge). Am Builder vorbei gesetzt.',
    quelle: 'E.27 Feld VSNR; Prüfkatalog Blatt ES (F7589); Anfragebeantwortung 4690/AB XXIII. GP',
    erwartung: 'nicht übernommen, F7589 – oder übernommen, dann prüft ELDA hier die Prüfziffer nicht',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['S50'],
    baue: (ctx) => {
      const b = bestand(ctx, 'S56', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' });
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, feldVon('VSNR'), falscheVsnr(ctx.rolle('arbeiter').vsnr)) };
    },
  }),
  fall({
    id: 'S58',
    titel: 'Storno des Antrags S50 als vollständiger Satz (ES, E1, MART 02 + UIDU)',
    zweck:
      'S53 (nur UIDU) und S57 (mit Konto und Person) wurden abgewiesen; S57 verlangte zusätzlich Geschlecht, ' +
      'Staatsangehörigkeit und die Anschrift des Dienstgebers. Klärt, ob ELDA den Storno als vollständige ' +
      'Wiederholung des Antrags mit Meldungsart 02 und Verweis auf die UIDM des Originals erwartet.',
    quelle: 'E.27, E.27.2 (Storno), D.68, D.69; SIT S53/S57 (13.10.2026)',
    erwartung: 'übernommen',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['S50'],
    rang: 41,
    baue: (ctx) => {
      const b = bestand(ctx, 'S58', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' });
      let inhalt = setzeFeld(b.inhalt, 2, feldVon('MART'), '02');
      inhalt = setzeFeld(inhalt, 2, feldVon('UIDU'), ctx.referenzwertVon('S50'));
      return { ...b, inhalt };
    },
  }),
  fall({
    id: 'S59',
    titel: 'Storno des Antrags S51 über stornoAntragVollstaendig (ES, E5)',
    zweck:
      'Prüft die neue Paketfunktion `stornoAntragVollstaendig` (vollständiger Antrag, MART 02, UIDU) ' +
      'am bilateralen Antrag E5 – S58 hatte dasselbe am Bestand vorbei gezeigt.',
    quelle: 'E.27, D.69; SIT S58 (13.10.2026)',
    erwartung: 'übernommen',
    fenster: ['di-nm', 'mi-nm'],
    abhaengig: ['S51'],
    rang: 41,
    baue: (ctx) =>
      bestand(
        ctx,
        'S59',
        ctx.elda.stornoAntragVollstaendig('E5', {
          UIDM: randomUUID(),
          UIDU: ctx.referenzwertVon('S51'),
          ...person(ctx, 'angestellte'),
          dienstgeber: [dienstgeber(ctx, 'A', '15', zeitraum(ctx))],
          AGSTAAT: 'RS',
          BFEST: 'N',
          ANIV: 'N',
        }),
        { dg: 'A', traeger: '15' },
      ),
  }),
  fall({
    id: 'S70',
    titel: 'Antrag Beschäftigung bei mehreren Dienstgebern (ES, E3)',
    zweck:
      'Satzart E3 war nie gesendet: ein österreichischer Dienstgeber (A/14) und ein slowenischer ' +
      '(Ersatzname, ohne Beitragskonto), MARGDG je Dienstgeber, Arbeitsorte AT und SI. Wird E3 auf der ' +
      'SIT verarbeitet, und kommt eine Bescheinigung zurück?',
    quelle: 'E.27, E.27.1 (E3); Paket-Test „E3: mindestens zwei Dienstgeber, MARGDG zwingend"',
    erwartung: 'übernommen, Rücksendung es_<UIDM>_….pdf – oder Abweisung mit Code',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['V01'],
    rang: 42,
    baue: (ctx) => {
      const d = ctx.dienstgeber('A');
      const beginn = plusTage(ctx.zr, 14);
      return bestand(
        ctx,
        'S70',
        ctx.elda.antragZwischenstaatlich('E3', {
          UIDM: randomUUID(),
          ...person(ctx, 'arbeiter'),
          dienstgeber: [
            dienstgeber(ctx, 'A', '14', { DGWS: '04', ...zeitraum(ctx), BEAT: 'N', ANKZ: 'N', MARGDG: 'N' }),
            {
              DGNA: 'Kleiderservice Nadler KG',
              DGKFZ: 'SI',
              DGSTR: 'Testna ulica 4',
              DGPLZ: '1000',
              DGORT: 'Ljubljana',
              DGWS: '04',
              ...zeitraum(ctx),
              BEAT: 'N',
              ANKZ: 'N',
              MARGDG: 'N',
            },
          ],
          ANATJ: 'J',
          arbeitsorte: [
            {
              AOST: 'AT',
              AOKBS: 'J',
              AOFNSN: d.name,
              AOSTRA: d.anschrift.strasse,
              AOPLZL: d.anschrift.plz,
              AOORT: d.anschrift.ort,
            },
            { AOST: 'SI', AOKBS: 'N' },
          ],
          AZRV: ctx.ttmmjjjj(beginn),
          AZRB: ctx.ttmmjjjj(plusTage(beginn, 364)),
          ANFL: 'N',
        }),
        { dg: 'A', traeger: '14' },
      );
    },
  }),
  fall({
    id: 'S71',
    titel: 'Antrag selbständige und unselbständige Tätigkeit (ES, E4)',
    zweck:
      'Satzart E4 war nie gesendet: ein Dienstgeber (A/15) und eine selbständige Tätigkeit in Slowenien ' +
      '(Ersatzname), Arbeitsorte AT (unselbständig) und SI (selbständig).',
    quelle: 'E.27, E.27.1 (E4); Paket-Test „E4: selbständige Tätigkeit und AUET sind zwingend"',
    erwartung: 'übernommen, Rücksendung es_<UIDM>_….pdf – oder Abweisung mit Code',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['V02'],
    rang: 42,
    baue: (ctx) => {
      const beginn = plusTage(ctx.zr, 14);
      return bestand(
        ctx,
        'S71',
        ctx.elda.antragZwischenstaatlich('E4', {
          UIDM: randomUUID(),
          ...person(ctx, 'angestellte'),
          dienstgeber: [dienstgeber(ctx, 'A', '15', { DGWS: '04', ...zeitraum(ctx), BEAT: 'N', ANKZ: 'N', MARGDG: 'N' })],
          selbstaendig: [
            {
              STFNA: "Blumen G'schenk e.U.",
              STSTR: 'Marktgasse 5',
              STKFZ: 'SI',
              STPLZ: '2000',
              STORT: 'Maribor',
              STAS: ctx.ttmmjjjj(ctx.zr),
              START: 'Blumenhandel',
              MARGST: 'N',
            },
          ],
          ANATJ: 'J',
          arbeitsorte: [
            { AOST: 'AT', AOKBS: 'N', AUET: 'U' },
            { AOST: 'SI', AOKBS: 'N', AUET: 'S' },
          ],
          AZRV: ctx.ttmmjjjj(beginn),
          AZRB: ctx.ttmmjjjj(plusTage(beginn, 364)),
          ANFL: 'N',
        }),
        { dg: 'A', traeger: '15' },
      );
    },
  }),
  fall({
    id: 'S72',
    titel: 'Antrag Telearbeit an den Dachverband (ES, EA, VSTR 99)',
    zweck:
      'Satzart EA war auf der SIT nicht angekündigt: Telearbeit aus Deutschland, zuständig ist der ' +
      'Dachverband (VSTR 99). Verarbeitet die SIT EA, und welcher Träger antwortet?',
    quelle: 'E.27, E.27.3, D.4 (VSTR 99); Paket-Test „EA: Telearbeit geht an den Dachverband (VSTR 99)"',
    erwartung: 'übernommen – oder Abweisung (EA/VSTR 99 auf der SIT nicht freigegeben)',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['V01'],
    rang: 42,
    baue: (ctx) => {
      const beginn = plusTage(ctx.zr, 14);
      return bestand(
        ctx,
        'S72',
        ctx.elda.antragZwischenstaatlich('EA', {
          UIDM: randomUUID(),
          ...person(ctx, 'arbeiter'),
          dienstgeber: [dienstgeber(ctx, 'A', '14', { DGWS: '04' })],
          arbeitsorte: [
            {
              AOST: 'DE',
              AOKBS: 'J',
              AOFNSN: 'Wohnung',
              AOSTRA: 'Beispielweg 2',
              AOPLZL: '83395',
              AOORT: 'Freilassing',
            },
          ],
          AUSMTE: 'J',
          ANTVON: ctx.ttmmjjjj(beginn),
          ANTBIS: ctx.ttmmjjjj(plusTage(beginn, 364)),
        }),
        { dg: 'A', traeger: '99' },
      );
    },
  }),
];
