'use strict';

// S – VSNR-Anforderung (E.30, Bestand VS) und Adresse Versicherter (E.31,
// Bestand AV). Beide Verarbeitungen führt die SIT-Plattform (ÖGK, „LSWH-Test –
// Regelbetrieb", 10/2023: AV, FH, MB, SM, VR, VS).
//
// Ablauf in KW42:
//   Mo vormittags  S10 VSNR-Anforderung, S12 Geschlecht divers, S13 Geschlecht 5
//   Mo nachmittags S11 Anmeldung ohne VSNR mit REFV auf S10
//   Di vormittags  S20 Adressmeldung Ausland für den Arbeiter aus V01,
//                  S21 Adressmeldung mit A für die Angestellte aus V02
// Ausweichfenster am Mittwoch wie bei den V-Fällen.
//
// Die Personen der VSNR-Anforderung sind erfunden (Ersatznamen) – eine
// Anforderung für eine Testperson mit Versicherungsnummer wäre fachlich falsch
// (E.30.2: nur, wenn noch keine VSNR vergeben ist). Als Wohnort dient die
// Anschrift des Testbetriebs aus den Testdaten.

const { setzeFeld } = require('../lib/bausteine');
const { FELDER_E30 } = require('../../../dist/felder-e30.js');
const { FELDER_E31 } = require('../../../dist/felder-e31.js');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const ANFORDERUNG = ['mo-vm', 'mi-vm'];
const NACH_ANFORDERUNG = ['mo-nm', 'mi-nm'];
const FOLGE_VM = ['di-vm', 'mi-nm'];

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const feldE30 = (name) => FELDER_E30.find((f) => f.name === name);
const feldE31 = (name) => FELDER_E31.find((f) => f.name === name);

/** Erfundene Personen ohne Versicherungsnummer. */
const PERSON = Object.freeze({
  S10: { FANA: 'Weinzierl', VONA: 'Mirela', GEBD: '14031998', GESL: '2' },
  S12: { FANA: 'Lindmayr', VONA: 'Livia', GEBD: '22071995', GESL: '3' },
  S13: { FANA: 'Grabner', VONA: 'Rosa', GEBD: '05111989', GESL: '1' },
});

function anforderung(ctx, id, { dg = 'A', traeger = '14' } = {}) {
  const konto = ctx.konto(dg, { traeger });
  const betrieb = ctx.dienstgeber(dg);
  const refw = ctx.referenzwert(id);
  const satz = ctx.elda.vsnrAnforderung({
    REFW: refw,
    BKNR: konto.bknr,
    DGNA: betrieb.name,
    ...PERSON[id],
    STSL: 'AUT',
    WKFZ: betrieb.anschrift.kfz,
    PLZL: betrieb.anschrift.plz,
    WORT: betrieb.anschrift.ort,
    WSTR: betrieb.anschrift.strasse,
  });
  return {
    inhalt: ctx.elda.erstelleVsnrAnforderungBestand([satz], ctx.bestandOptionen({ dg, traeger })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [refw],
  };
}

/** Ausländischer Hauptwohnsitz, erfunden; Postleitzahl und Ort gibt es. */
const AUSLAND = Object.freeze({ WKFZ: 'D', PLZL: '83395', WORT: 'Freilassing', WSTR: 'Musterweg', WHNR: '1' });

function adressmeldung(ctx, id, { rolle, dg, traeger }) {
  const konto = ctx.konto(dg, { traeger });
  const refw = ctx.referenzwert(id);
  const satz = ctx.elda.adresseVersicherter({
    REFW: refw,
    BKNR: konto.bknr,
    DGNA: ctx.dienstgeber(dg).name,
    VSNR: ctx.rolle(rolle).vsnr,
    ...AUSLAND,
  });
  return {
    inhalt: ctx.elda.erstelleAdressmeldungBestand([satz], ctx.bestandOptionen({ dg, traeger })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [refw],
  };
}

module.exports = [
  fall({
    id: 'S10',
    titel: 'VSNR-Anforderung (VS) für eine erfundene Person',
    zweck:
      'Erster VS-Bestand überhaupt: Wird er übernommen, und wie kommt die vergebene Versicherungsnummer ' +
      'zurück (E.30.2: über das Clearingsystem mit dem Referenzwert der Anforderung)?',
    quelle: 'E.30, E.30.1, E.30.2, D.45; Prüfkatalog Blatt VS',
    erwartung: 'übernommen; danach Clearingfall mit der VSNR und diesem Referenzwert (auswerten)',
    fenster: ANFORDERUNG,
    baue: (ctx) => anforderung(ctx, 'S10'),
  }),
  fall({
    id: 'S11',
    titel: 'Anmeldung ohne VSNR mit Geburtsdatum und REFV (M3)',
    zweck:
      'Die Anmeldung zur Person aus S10, bevor die VSNR zurück ist: Geburtsdatum statt VSNR und REFV = ' +
      'Referenzwert der Anforderung. Verknüpft ELDA beides?',
    quelle: 'E.30.2, D.6, D.7, D.45, E.29.2 (M3)',
    erwartung: 'übernommen',
    fenster: NACH_ANFORDERUNG,
    abhaengig: ['S10'],
    baue: (ctx) => {
      const konto = ctx.konto('A', { traeger: '14' });
      const refw = ctx.referenzwert('S11');
      const { FANA, VONA, GEBD } = PERSON.S10;
      const satz = ctx.elda.anmeldung({
        REFW: refw,
        BKNR: konto.bknr,
        DGNA: ctx.dienstgeber('A').name,
        GEBD,
        REFV: ctx.referenzwertVon('S10'),
        FANA,
        VONA,
        ADAT: d(ctx, ctx.zr),
        BBER: '02',
        GERF: 'N',
        FRDV: 'N',
        VWAZ: ctx.elda.wochenarbeitszeit(40, 0),
      });
      return {
        inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg: 'A', traeger: '14' })),
        dateiName: ctx.dateiName('S11'),
        referenzwerte: [refw],
      };
    },
  }),
  fall({
    id: 'S12',
    titel: 'VSNR-Anforderung mit Geschlecht 3 (divers)',
    zweck:
      'Der Prüfkatalog führt zwei widersprüchliche Zeilen: F6561 „gültig 1,2" und F6562 „gültig ' +
      '1,2,3,4,6,7", beide Status N. Die Feldtabelle E.30 nennt alle sechs Werte. Welche Zeile prüft ELDA?',
    quelle: 'E.30 Feld 15; Prüfkatalog Blatt VS (F6561, F6562)',
    erwartung: 'übernommen, oder F6561',
    fenster: ANFORDERUNG,
    baue: (ctx) => anforderung(ctx, 'S12'),
  }),
  fall({
    id: 'S13',
    titel: 'Negativtest: VSNR-Anforderung mit Geschlecht 5',
    zweck:
      'Ein Wert, den keine Quelle kennt – der Builder weist ihn ab, deshalb nachträglich im Bestand gesetzt. ' +
      'Zeigt, mit welchem Code und auf welchem Weg (Protokoll oder Mitteilung) ELDA einen VS-Satz ablehnt.',
    quelle: 'E.30 Feld 15; Prüfkatalog Blatt VS (F6562)',
    erwartung: 'F6562 (oder F6561), Satz nicht übernommen',
    fenster: ANFORDERUNG,
    baue: (ctx) => {
      const b = anforderung(ctx, 'S13');
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, feldE30('GESL'), '5') };
    },
  }),
  fall({
    id: 'S20',
    titel: 'Adressmeldung: ausländischer Hauptwohnsitz für den Arbeiter (AV)',
    zweck:
      'Anlassfall 3 aus E.31.2.1: Ein Dienstnehmer mit aufrechtem Dienstverhältnis (V01) gibt einen ' +
      'Hauptwohnsitz im Ausland bekannt. Erster AV-Bestand überhaupt.',
    quelle: 'E.31, E.31.1, E.31.2.1; Prüfkatalog Blatt AV',
    erwartung: 'übernommen',
    fenster: FOLGE_VM,
    abhaengig: ['V01'],
    baue: (ctx) => adressmeldung(ctx, 'S20', { rolle: 'arbeiter', dg: 'A', traeger: '14' }),
  }),
  fall({
    id: 'S21',
    titel: 'Negativtest: Adressmeldung mit Wohnsitz in Österreich (WKFZ A) an die ÖGK',
    zweck:
      'Inländische Adressen sind laut E.31 an die ÖGK nicht zulässig. Der Katalog nennt zwei Codes – F8039 ' +
      '(A und ÖGK) und F8041 (ungültig oder A). Welcher kommt? Im Bestand nachträglich gesetzt.',
    quelle: 'E.31 Feld 10, E.31.2.1; Prüfkatalog Blatt AV (F8039, F8041)',
    erwartung: 'F8039 oder F8041, Satz nicht übernommen',
    fenster: FOLGE_VM,
    abhaengig: ['V02'],
    baue: (ctx) => {
      const b = adressmeldung(ctx, 'S21', { rolle: 'angestellte', dg: 'A', traeger: '15' });
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, feldE31('WKFZ'), 'A') };
    },
  }),
];
