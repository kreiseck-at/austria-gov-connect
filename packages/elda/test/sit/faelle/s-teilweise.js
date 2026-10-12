'use strict';

// Teilweise Übernahme und VSNR-Prüfziffer in der mBGM (KW42, Mo vormittags).
//
// S60: ein VR-Bestand mit zwei Anmeldungen, eine davon mit verfälschter
//      Prüfziffer. Das Mitteilungs-Schema kennt den Status
//      `teilweise_uebernommen` – beobachtet wurde er nie.
// M42: eine mBGM (Paket-Weg) mit verfälschter Prüfziffer. Der Prüfkatalog
//      (Blatt `mBGM Paket`) führt keine VSNR-Prüfung; V21 hat gezeigt, dass
//      ELDA sie bei der Versichertenmeldung erzwingt (F7020). Gilt das auch hier?
//
// Personen: eine erfundene Person ohne VSNR (Ersatzname) und die Testperson
// `reserve_3` – deren Nummer wird verfälscht und existiert danach nicht.

const { setzeFeld } = require('../lib/bausteine');
const { FELDER_E29 } = require('../../../dist/felder-e29.js');
const { FELDER_MBGM } = require('../../../dist/felder-e32.js');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const VSNR_E29 = FELDER_E29.find((f) => f.name === 'VSNR');
const VSNR_MBGM = FELDER_MBGM.find((f) => f.name === 'VSNR');

/** Die Versicherungsnummer mit verfälschter vierter Stelle – nie gültig (Prüfziffer eindeutig). */
function falscheVsnr(vsnr) {
  return vsnr.slice(0, 3) + String((Number(vsnr[3]) + 1) % 10) + vsnr.slice(4);
}

module.exports = [
  fall({
    id: 'S60',
    titel: 'Zwei Anmeldungen in einem Bestand, eine mit falscher Prüfziffer (teilweise Übernahme)',
    zweck:
      'Das Mitteilungs-Schema 3.0 kennt `teilweise_uebernommen` (Bestandssummen empfangen/übernommen). ' +
      'Zeigt erstmals, wie ELDA einen Bestand mit einer guten und einer abgewiesenen Meldung beantwortet ' +
      'und ob die gute trotzdem verarbeitet wird.',
    quelle: 'elda_mitteilung-3.0.xsd (Status); E.29; SIT V21 (F7020)',
    erwartung: 'teilweise_uebernommen, empfangen 2 / übernommen 1, F7020 in Zeile 3',
    fenster: ['mo-vm', 'mo-nm'],
    baue: (ctx) => {
      const konto = ctx.konto('B', { traeger: '15' });
      const dgna = ctx.dienstgeber('B').name;
      const adat = d(ctx, ctx.zr);
      const vwaz = ctx.elda.wochenarbeitszeit(38, 30);
      const refGut = ctx.referenzwert('S60-1');
      const refFalsch = ctx.referenzwert('S60-2');
      const gemeinsam = { BKNR: konto.bknr, DGNA: dgna, ADAT: adat, BBER: '01', GERF: 'N', FRDV: 'N', VWAZ: vwaz };
      const gut = ctx.elda.anmeldung({ ...gemeinsam, REFW: refGut, FANA: 'Hollerer', VONA: 'Max', GEBD: '11061990' });
      const p = ctx.rolle('reserve_3');
      const falsch = ctx.elda.anmeldung({
        ...gemeinsam,
        REFW: refFalsch,
        VSNR: p.vsnr,
        FANA: p.familienname,
        VONA: p.vorname,
      });
      const inhalt = ctx.elda.erstelleBestand([gut, falsch], ctx.bestandOptionen({ dg: 'B', traeger: '15' }));
      return {
        inhalt: setzeFeld(inhalt, 3, VSNR_E29, falscheVsnr(p.vsnr)),
        dateiName: ctx.dateiName('S60'),
        referenzwerte: [refGut, refFalsch],
      };
    },
  }),
  fall({
    id: 'M42',
    titel: 'mBGM Dezember 2024 mit falscher Prüfziffer der VSNR (Paket-Weg)',
    zweck:
      'Prüft, ob ELDA die Prüfziffer auch in der mBGM erzwingt. Der Prüfkatalog nennt dafür keinen Code; ' +
      'das Paket prüft in der mBGM bisher nur die Stellenfolge. Am Builder vorbei verfälscht.',
    quelle: 'E.32 Feld VSNR; Prüfkatalog Blatt mBGM Paket; SIT V21 (F7020)',
    erwartung: 'nicht übernommen mit einem VSNR-Code – oder übernommen, dann prüft ELDA hier die Prüfziffer nicht',
    fenster: ['mo-vm'],
    baue: (ctx) => {
      const konto = ctx.konto('A', { traeger: '14' });
      const [j, m] = ctx.zr.split('-').map(Number);
      const bzr = new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 7);
      const p = ctx.rolle('reserve_3');
      const refw = ctx.referenzwert('M42-1');
      const paketref = ctx.referenzwert('M42');
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
      const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
      if (befunde.length > 0) throw new Error(`mBGM-Paket M42 hat Befunde: ${JSON.stringify(befunde).slice(0, 300)}`);
      const inhalt = ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'A', traeger: '14' }));
      // Satz 1 Vorlauf, 2 Paket (PS), 3 mBGM (G1).
      return {
        inhalt: setzeFeld(inhalt, 3, VSNR_MBGM, falscheVsnr(p.vsnr)),
        dateiName: ctx.dateiName('M42'),
        referenzwerte: [paketref, refw],
      };
    },
  }),
];
