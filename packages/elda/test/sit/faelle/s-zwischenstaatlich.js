'use strict';

// S05 – Antrag auf zwischenstaatliche Bescheinigung (Bestand ES, Kapitel E.27).
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

/**
 * Ersetzt Bytes im zweiten Satz (dem Antrag) eines Bestands mit einem Antrag.
 * Für die Negativfälle: Das Paket baut nur gültige Anträge, die Abweichung
 * entsteht erst danach – wie bei den Umschlag-Fällen.
 */
function ersetzeImAntrag(inhalt, pos, wert) {
  const text = inhalt.toString('latin1');
  const beginn = text.indexOf('\r\n') + 2;
  const p = beginn + pos - 1;
  return Buffer.from(text.slice(0, p) + wert + text.slice(p + wert.length), 'latin1');
}

const posVon = (ctx, name) => {
  const { FELDER_E27 } = require('../../../dist/felder-e27.js');
  return FELDER_E27.find((f) => f.name === name).pos;
};

module.exports = [
  fall({
    id: 'S05',
    titel: 'Antrag Entsendung nach Deutschland (ES, E1)',
    zweck:
      'Klärt, ob die SIT Anträge auf zwischenstaatliche Bescheinigung verarbeitet, und prüft den ' +
      'Satz (9028 Zeichen, Version 08) gegen ELDA.',
    quelle: 'E.27, E.27.1, D.36; ÖGK LSWH-Event 09.10.2025, Seite 24',
    erwartung: 'übernommen – oder Abweisung „Bestand ES" = auf der SIT noch nicht freigegeben',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['V01'],
    baue: (ctx) => bestand(ctx, 'S05', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' }),
  }),
  fall({
    id: 'S051',
    titel: 'Antrag Entsendung nach Serbien, bilaterales Abkommen (ES, E5)',
    zweck: 'Satzart E5 mit Staat aus der Tabelle „Satzart E5"; ohne Wirtschaftssektor.',
    quelle: 'E.27, E.27.1, D.36 (Satzart E5)',
    erwartung: 'übernommen',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['V02', 'S05'],
    baue: (ctx) =>
      bestand(
        ctx,
        'S051',
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
    id: 'S052',
    titel: 'Antrag Beschäftigung in Österreich und Slowenien (ES, E2)',
    zweck: 'Satzart E2 mit Arbeitsorten; ANATJ = J verlangt einen Arbeitsort in Österreich.',
    quelle: 'E.27, E.27.1, D.36; Prüfkatalog Blatt ES F7650',
    erwartung: 'übernommen',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['B03', 'S05'],
    baue: (ctx) => {
      const d = ctx.dienstgeber('B');
      const beginn = plusTage(ctx.zr, 14);
      return bestand(
        ctx,
        'S052',
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
    id: 'S053',
    titel: 'Storno des Antrags S05 (ES, E1, MART 02)',
    zweck: 'Storno über die UIDU des Antrags; der Storno-Satz trägt sonst nur Grundstellung.',
    quelle: 'E.27.2 (Storno), D.68, D.69',
    erwartung: 'übernommen',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['S05'],
    baue: (ctx) =>
      bestand(
        ctx,
        'S053',
        ctx.elda.stornoAntragZwischenstaatlich('E1', {
          UIDM: randomUUID(),
          UIDU: ctx.referenzwertVon('S05'),
        }),
        { dg: 'A', traeger: '14' },
      ),
  }),
  fall({
    id: 'S054',
    titel: 'Negativ: Entsendung nach Österreich (E1, AGSTAAT AT)',
    zweck: 'Fußnote 33 zu D.36: AT ist bei E1 nicht zulässig. Kommt F7611 zurück?',
    quelle: 'D.36 Fußnote 33; Prüfkatalog Blatt ES Nr. 4 (F7611)',
    erwartung: 'nicht übernommen, F7611',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['S05'],
    baue: (ctx) => {
      const b = bestand(ctx, 'S054', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' });
      return { ...b, inhalt: ersetzeImAntrag(b.inhalt, posVon(ctx, 'AGSTAAT'), 'AT') };
    },
  }),
  fall({
    id: 'S055',
    titel: 'Negativ: zweiter Dienstgeber bei E1',
    zweck: 'Bei E1 ist der Dienstgeber-Block nur einmal zulässig. Kommt F7515 zurück?',
    quelle: 'E.27 Seite 295; Prüfkatalog Blatt ES (F7515)',
    erwartung: 'nicht übernommen, F7515',
    fenster: NACH_ANMELDUNG,
    abhaengig: ['S05'],
    baue: (ctx) => {
      const b = bestand(ctx, 'S055', entsendungE1(ctx, randomUUID()), { dg: 'A', traeger: '14' });
      const text = b.inhalt.toString('latin1');
      const beginn = text.indexOf('\r\n') + 2;
      const block1 = text.slice(beginn + posVon(ctx, 'DGNA_1') - 1, beginn + posVon(ctx, 'DGNA_2') - 1);
      return { ...b, inhalt: ersetzeImAntrag(b.inhalt, posVon(ctx, 'DGNA_2'), block1) };
    },
  }),
];
