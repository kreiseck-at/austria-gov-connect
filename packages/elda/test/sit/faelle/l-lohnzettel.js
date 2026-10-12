'use strict';

// L – Lohnzettel Finanz L16 (Bestand LF, Kapitel E.13/E.14, Version 28).
//
// Die ÖGK-Unterlage „LSWH-Test – Regelbetrieb" (10/2023) nennt LF nicht unter
// den Verarbeitungen der SIT. Den Antrag auf zwischenstaatliche Bescheinigung
// (ES) nannte sie auch nicht – er wurde am 12.10.2026 trotzdem übernommen.
// L01/L02 klären, ob die SIT den Bestand LF annimmt und wie sie ihn prüft.
//
// Person: der Arbeiter auf Konto A/15 aus V70 (Eintritt 01.02.2025) mit der
// Abmeldung V71 (Ende 31.03.2025). Der Lohnzettel deckt genau diesen
// Lohnzahlungszeitraum ab (D.32), Lohnzettelart 01 (D.31), soziale Stellung
// 2 = Arbeiter/in (D.33, wie kasseneck `l16-elda-core.js`).
//
// Die Testdaten führen keine Steuernummer des Dienstgebers. Verwendet wird die
// prüfziffernrichtige Ersatz-Steuernummer 91-123/4565 – gehört sie auf der SIT
// zu keinem Arbeitgeber, kann das eine eigene Abweisung auslösen (notieren).
// Eine Wohnanschrift der Testperson gibt es nicht; die hier ist erfunden.
//
// Beträge erfunden, aber nach den Summenregeln des Prüfkatalogs stimmig:
// zwei Monate je 3.000 €, keine Sonderzahlung; einbehaltene SV-Beiträge
// 18,07 % (Arbeiter, Dienstnehmeranteil); KZ 230 = SV − KZ 225 (F4800);
// KZ 245 = KZ 210 − KZ 230 (F6401); Lohnsteuer nach dem Tarif 2025 auf die
// Monatsbemessung (3.000 − 542,10 − 11 Werbungskostenpauschale) × 12 =
// 29.362,80: 8.309 × 20 % + 7.745,80 × 30 % − 487 Verkehrsabsetzbetrag =
// 3.498,54 € im Jahr = 291,55 € im Monat, zwei Monate 583,10 € (KZ 260).
// Die Tarifgrenzen 2025 (13.308 / 21.617 €) und der Verkehrsabsetzbetrag
// (487 €) sind hier nicht gegen eine Quelle geprüft – das Paket prüft die
// Lohnsteuer nur mit dem Rechenblatt für 2026.

const { setzeFeld } = require('../lib/bausteine');
const { FELDER_I1 } = require('../../../dist/felder-e13.js');
const { FELDER_L1 } = require('../../../dist/felder-e14.js');

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', ...mehr });
const STEUERNUMMER = '911234565';

function uebermittlung(ctx, id) {
  const p = ctx.rolle('arbeiter');
  const ein = ctx.zrVon('V70'); // simuliertes Datum der Anmeldung; Eintritt laut V70: 01.02.2025
  const jahr = Number(ein.slice(0, 4));
  const tagMonat = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
  return {
    version: '28',
    jahr,
    arbeitgeber: {
      STNRA: STEUERNUMMER,
      ANAM: ctx.dienstgeber('A').name,
      AADR: ctx.dienstgeber('A').anschrift.strasse,
      ALKZ: 'A',
      APLZ: ctx.dienstgeber('A').anschrift.plz,
      AORT: ctx.dienstgeber('A').anschrift.ort,
      GESA: 1,
    },
    lohnzettel: [
      {
        felder: {
          REFN: ctx.referenzwert(id).slice(0, 30),
          ARTL: '01',
          BELZ: tagMonat(`${jahr}-02-01`),
          ENLZ: tagMonat(`${jahr}-03-31`),
          SOZS: '2',
          AVLN: p.vsnr.slice(0, 4),
          AGBD: p.vsnr.slice(4),
          ANAM: `${p.familienname} ${p.vorname}`,
          AADR: 'Teststraße 1',
          ALKZ: 'A',
          APLZ: '5020',
          AORT: 'Salzburg',
          GESM: p.geschlecht === 'm' ? 'J' : undefined,
          GESW: p.geschlecht === 'w' ? 'J' : undefined,
          VOLL: 'J',
          GEBD: p.geburtsdatum,
        },
        betraege: {
          B210: 600_000,
          BIEB: 108_420,
          B230: 108_420,
          B245: 491_580,
          BIEL: 58_310,
          B260: 58_310,
        },
      },
    ],
  };
}

/** Baut den Bestand LF; die Prüfung des Pakets darf keinen Befund mit Status N liefern. */
function bestand(ctx, id) {
  const u = uebermittlung(ctx, id);
  const opt = ctx.bestandOptionen({ dg: 'A', traeger: '15' });
  const { versicherungstraeger: _vstr, ...lfOpt } = opt;
  const saetze = ctx.elda.lohnzettelSaetze(u, lfOpt.erstellt);
  const befunde = ctx.elda
    .pruefeLohnzettel(saetze, '28', { heute: lfOpt.erstellt })
    .filter((b) => b.status.startsWith('N'));
  if (befunde.length > 0) throw new Error(`L16 ${id} hat Befunde mit Status N: ${JSON.stringify(befunde)}`);
  return {
    inhalt: ctx.elda.erstelleLohnzettelBestand(u, lfOpt),
    dateiName: ctx.dateiName(id),
    referenzwerte: [u.lohnzettel[0].felder.REFN],
  };
}

module.exports = [
  fall({
    id: 'L01',
    titel: 'Lohnzettel L16 2025 für den Arbeiter aus V70/V71 (LF, I1 + L1, Version 28)',
    zweck:
      'Klärt, ob die SIT den Bestand LF verarbeitet (laut ÖGK-Unterlage 10/2023 nicht) und welche ' +
      'Rückmeldung kommt: Abweisung des Bestands, Mitteilung mit BMF-Codes oder übernommen.',
    quelle: 'E.13, E.14 (Version 28), D.31–D.33, B.3 (LF); Prüfkatalog L16 V09',
    erwartung: 'Abweisung „Bestand LF" (SIT verarbeitet LF nicht) – oder Mitteilung mit BMF-Codes',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71'],
    rang: 40,
    baue: (ctx) => bestand(ctx, 'L01'),
  }),
  fall({
    id: 'L02',
    titel: 'Negativtest: L16 mit falscher Prüfziffer der Arbeitgeber-Steuernummer (F9991?)',
    zweck:
      'Wie L01, die Steuernummer im Informationssatz am Builder vorbei verfälscht (Prüfziffer nach ' +
      'STUZZA „Finanzamtszahlung in MBS"), in I1 und L1 gleich. Zeigt, ob und mit welchem BMF-Code ELDA das prüft.',
    quelle: 'E.13 Feld STNRA; Prüfkatalog L16 (F9991); STUZZA MBS 7.0.07 S. 8',
    erwartung: 'nicht übernommen, F9991 – oder dieselbe Antwort wie L01',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71', 'L01'],
    rang: 41,
    baue: (ctx) => {
      const b = bestand(ctx, 'L02');
      // Satz 1 Vorlauf, 2 Informationssatz I1, 3 Lohnzettel L1. Prüfziffer 5 → 6, in beiden
      // Sätzen gleich (der Katalog verlangt Gleichheit, F9900/F9990 – die soll nicht anschlagen).
      const falsch = '911234566';
      const i1 = setzeFeld(b.inhalt, 2, FELDER_I1.find((f) => f.name === 'STNRA'), falsch);
      return { ...b, inhalt: setzeFeld(i1, 3, FELDER_L1['28'].find((f) => f.name === 'STNRA'), falsch) };
    },
  }),
];
