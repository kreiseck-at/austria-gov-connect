'use strict';

// Nachschlag Di 13.10. vormittags – aus den Ergebnissen der ersten Runde:
//
// S57: S53 (Storno eines ES-Antrags nur mit UIDU) kam mit F0010, F0020, F0030,
//      F0060, F0070 zurück. Derselbe Storno mit Beitragskonto, Dienstgebername,
//      VSNR, Geburtsdatum und Namen der Person (am Builder vorbei, weil die
//      Storno-Matrix der 43. Ergänzung diese Felder leer lässt).
// M67: M63 (PE fehlt) brachte nur den Umschlag-Fehler E19. Hier stimmen die
//      laufenden Satznummern, aber die Reihenfolge G1/T1 ist vertauscht – kommt
//      F9070 (Aufbau des mBGM-Pakets)?

const { randomUUID } = require('node:crypto');
const { setzeFeld } = require('../lib/bausteine');
const { FELDER_E27 } = require('../../../dist/felder-e27.js');

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const feldE27 = (name) => FELDER_E27.find((f) => f.name === name);

module.exports = [
  fall({
    id: 'S57',
    titel: 'Storno des Antrags S50 mit Konto, Dienstgeber und Person (ES, E1)',
    zweck:
      'S53 wurde ohne diese Felder mit F0010/F0020/F0030/F0060/F0070 abgewiesen. Klärt, ob der Storno ' +
      'mit ihnen angenommen wird – dann muss das Paket sie auch im Storno befüllen.',
    quelle: 'E.27.2 (Storno), Prüfkatalog Blatt Allgemein (F0010–F0070); SIT S53 (13.10.2026)',
    erwartung: 'übernommen',
    fenster: ['di-vm', 'di-nm', 'mi-nm'],
    abhaengig: ['S50'],
    rang: 40,
    baue: (ctx) => {
      const satz = ctx.elda.stornoAntragZwischenstaatlich('E1', {
        UIDM: randomUUID(),
        UIDU: ctx.referenzwertVon('S50'),
      });
      const opt = ctx.bestandOptionen({ dg: 'A', traeger: '14' });
      let inhalt = ctx.elda.erstelleEsBestand([satz], opt);
      const p = ctx.rolle('arbeiter');
      const werte = {
        BKNR_1: ctx.konto('A', { traeger: '14' }).bknr,
        DGNA_1: ctx.dienstgeber('A').name,
        VSNR: p.vsnr,
        GEBD: p.geburtsdatum,
        FANA: p.familienname,
        VONA: p.vorname,
      };
      for (const [name, wert] of Object.entries(werte)) inhalt = setzeFeld(inhalt, 2, feldE27(name), wert);
      return { inhalt, dateiName: ctx.dateiName('S57'), referenzwerte: [] };
    },
  }),
  fall({
    id: 'M67',
    titel: 'mBGM-Paket mit vertauschter Satzfolge (T1 vor G1), Satznummern stimmig',
    zweck:
      'M63 (PE fehlt) scheiterte schon am Umschlag (E19). Hier ist nur die Abfolge nach E.32.2.2.6 verletzt – ' +
      'meldet ELDA F9070?',
    quelle: 'E.32.2.2.6; Prüfkatalog Blatt mBGM Paket (F9070); SIT M63 (13.10.2026)',
    erwartung: 'nicht übernommen, F9070',
    fenster: ['di-vm'],
    abhaengig: ['V01'],
    rang: 40,
    baue: (ctx) => {
      const konto = ctx.konto('A', { traeger: '14' });
      const [j, m] = ctx.zr.split('-').map(Number);
      const bzr = new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 7);
      const p = ctx.rolle('arbeiter');
      const refw = ctx.referenzwert('M67-1');
      const paketref = ctx.referenzwert('M67');
      const ab = 300_000;
      const saetze = ctx.elda.erstelleMbgmPaket(
        [
          {
            referenzwert: refw,
            versicherungsnummer: p.vsnr,
            familienname: p.familienname,
            vorname: p.vorname,
            verrechnungsgrundlage: ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
            tarifbloecke: [
              {
                beschaeftigtengruppe: 'B001',
                beginnDerVerrechnung: 1,
                basen: [
                  {
                    typ: 'AB',
                    betragCent: ab,
                    positionen: [{ typ: 'T01', prozentsatz: 39.05, betragCent: ctx.elda.berechneBeitragCent(ab, 39.05) }],
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
          dienstgebername: ctx.dienstgeber('A').name,
          beitragszeitraum: `${bzr.slice(5, 7)}${bzr.slice(0, 4)}`,
          jaehrlicheAbrechnungGeringfuegiger: false,
        },
      );
      const inhalt = ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'A', traeger: '14' }));
      // Satz 1 Vorlauf, 2 PS, 3 G1, 4 T1: G1 und T1 tauschen, laufende Satznummer (Stellen 3–9) neu setzen.
      const zeilen = inhalt.toString('latin1').split('\r\n');
      if (zeilen[2].slice(0, 2) !== 'G1' || zeilen[3].slice(0, 2) !== 'T1') {
        throw new Error(`M67: unerwartete Satzfolge ${zeilen.map((z) => z.slice(0, 2)).join(',')}`);
      }
      [zeilen[2], zeilen[3]] = [zeilen[3], zeilen[2]];
      const nummer = (z, i) => z.slice(0, 2) + String(i + 1).padStart(7, '0') + z.slice(9);
      const neu = zeilen.map(nummer);
      return {
        inhalt: Buffer.from(neu.join('\r\n'), 'latin1'),
        dateiName: ctx.dateiName('M67'),
        referenzwerte: [paketref, refw],
      };
    },
  }),
];
