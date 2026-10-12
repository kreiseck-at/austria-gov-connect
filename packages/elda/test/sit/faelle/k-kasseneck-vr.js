'use strict';

// K – Versichertenmeldung über den Versandweg von kasseneck (N6: D1, D3, D5).
//
// Die Felder baut kasseneck selbst (`versichertenmeldung-core.js` auf dem Branch
// feature/elda-versichertenmeldung): Anmeldung aus Mitarbeiter und Betrieb, Abmeldung
// ausschließlich aus dem `elda`-Block der Endabrechnung, Richtigstellung mit neu
// berechnetem BVAB. Der Referenzwert ist der von kasseneck (`KE-VR-<Tag>-<kurz>[-n]`,
// `elda-rueckmeldung-core.referenzwertVr`). Das Werkzeug liefert nur die
// SIT-Testdaten und packt den Satz in den Bestand.
//
// Person: DG A/14 angestellte (dort in dieser Woche sonst nicht angemeldet;
// V02 läuft auf A/15). kasseneck-Mitarbeiter-ID: `sitK01ang`.
//
// Ablauf:
//   Di vormittags  (sim. 01.03.2025) K01 Anmeldung (Eintritt 01.03.2025, 20 h, BVAB nach kasseneck-Regel)
//   Di nachmittags (sim. 01.04.2025) K02 Richtigstellung (25 h, BVAB wieder mit), danach
//                                    K03 Abmeldung einvernehmlich zum 31.03.2025 aus der Endabrechnung
//
// Wichtig zu K03: kasseneck setzt BVEN immer auf das SV-Ende (endabrechnung-core.js,
// `elda.BVEN = svEnde`) – auch nach genau einem Monat, in dem nie ein BV-Beitrag
// anfiel (§ 6 Abs 1 BMSVG). Das ist genau der Fall N3b (V83). Kommt dort VW1942,
// kommt es auch hier – dann muss kasseneck BVEN bei Dienstverhältnissen bis zu
// einem Monat leer lassen.
//
// Referenzwerte: n = 1, 2, 3 je Meldung, wie kasseneck es am selben Wiener Tag zählt.
// Ein zweiter Lauf am selben Tag (`--nochmal`) trüge denselben Referenzwert.

const { kasseneckVr } = require('../lib/kasseneck');

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', braucht: 'kasseneck-vr', ...mehr });
const DG = 'A';
const TRAEGER = '14';
const ROLLE = 'angestellte';
const EMPLOYEE_ID = 'sitK01ang';
const QUELLE = 'kasseneck feature/elda-versichertenmeldung: versichertenmeldung-core.js, elda-rueckmeldung-core.js';

function nutzer(ctx) {
  return {
    elda: { beitragskontonummer: ctx.konto(DG, { traeger: TRAEGER }).bknr },
    company_name: ctx.dienstgeber(DG).name,
  };
}

function mitarbeiter(ctx, mehr = {}) {
  const p = ctx.rolle(ROLLE);
  return {
    firstName: p.vorname,
    lastName: p.familienname,
    svnr: p.vsnr,
    startDate: mehr.startDate ?? ctx.zrVon('K01'),
    workerGroup: 'angestellter',
    employmentType: 'parttime',
    weeklyHours: 20,
    ...mehr,
  };
}

function refw(n) {
  const { rueck } = kasseneckVr();
  return rueck.referenzwertVr({ tag: rueck.wienerTagKurz(Date.now()), employeeId: EMPLOYEE_ID, n });
}

/** Satz mit kasseneck bauen; jeder Befund aus kasseneck oder dem Paket bricht ab. */
function bestand(ctx, id, art, ergebnis, n) {
  const { vr } = kasseneckVr();
  if (ergebnis.fehlend && ergebnis.fehlend.length) {
    throw new Error(`${id}: kasseneck meldet fehlende Angaben: ${ergebnis.fehlend.map((f) => f.text).join(' | ')}`);
  }
  if (ergebnis.sperre) throw new Error(`${id}: kasseneck sperrt: ${ergebnis.sperre.text}`);
  const befunde = vr.pruefeSatz(art, ergebnis.felder);
  if (befunde.length) throw new Error(`${id}: kasseneck-Prüfung: ${befunde.map((b) => b.text).join(' | ')}`);
  const referenzwert = refw(n);
  const satz = vr.baueSatz(art, { ...ergebnis.felder, REFW: referenzwert });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg: DG, traeger: TRAEGER })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [referenzwert],
  };
}

module.exports = [
  fall({
    id: 'K01',
    titel: 'kasseneck: Anmeldung, Felder und Referenzwert KE-VR-… aus kasseneck (M3)',
    zweck:
      'D1/D5: der eigene Versandweg. Anmeldung der Angestellten auf A/14 zum simulierten Tag, Teilzeit 20 h, ' +
      'BVAB nach der kasseneck-Regel (BVAB_REGEL = bvBeginn: Eintritt + 1 Monat). Mitteilung, Meldebestätigung ' +
      'und Clearing werden mit `kasseneck-zuordnung` durch die Zuordnung von kasseneck geschickt.',
    quelle: QUELLE,
    erwartung: 'übernommen; Mitteilung trägt den Referenzwert KE-VR-…',
    fenster: ['di-vm'],
    baue: (ctx) => {
      const { vr } = kasseneckVr();
      const emp = mitarbeiter(ctx, { startDate: ctx.zr });
      return bestand(ctx, 'K01', 'M3', vr.felderAnmeldung({ nutzer: nutzer(ctx), emp, historie: [] }), 1);
    },
  }),
  fall({
    id: 'K02',
    titel: 'kasseneck: Richtigstellung der Anmeldung, 25 h, BVAB mitgeschickt (M8)',
    zweck:
      'A2 über kasseneck: Die M8 trägt BVAB immer (leer hieße „BV entfällt“, E.29.2 Seite 312/313). ' +
      'Bleibt die BV-Zeit erhalten?',
    quelle: `${QUELLE}; E.29.2 Seite 312/313`,
    erwartung: 'übernommen',
    fenster: ['di-nm'],
    abhaengig: ['K01'],
    rang: 20,
    baue: (ctx) => {
      const { vr } = kasseneckVr();
      const n = nutzer(ctx);
      const vorher = vr.felderAnmeldung({ nutzer: n, emp: mitarbeiter(ctx), historie: [] });
      const aktuell = vr.felderAnmeldung({ nutzer: n, emp: mitarbeiter(ctx, { weeklyHours: 25 }), historie: [] });
      const ergebnis = vr.felderRichtigstellungAnmeldung({
        nutzer: n,
        angemeldet: { referenzwert: ctx.referenzwertVon('K01'), felder: vorher.felder },
        aktuell: aktuell.felder,
        fehlend: aktuell.fehlend,
      });
      return bestand(ctx, 'K02', 'M8', ergebnis, 2);
    },
  }),
  fall({
    id: 'K03',
    titel: 'kasseneck: Abmeldung einvernehmlich zum 31.03.2025 aus der Endabrechnung (M4)',
    zweck:
      'D3/D5: Abmeldung, wie kasseneck sie baut (ADAT/EBSV/BVEN = Austritt aus der Endabrechnung, AGRD aus der ' +
      'Beendigungsart „einvernehmlich“ = 03). BVEN ist gesetzt, obwohl das Dienstverhältnis nur einen Monat ' +
      'dauerte – Gegenstück zu V83 (N3b).',
    quelle: `${QUELLE}; endabrechnung-core.js (elda.BVEN = svEnde); beendigungsarten AGRD`,
    erwartung: 'übernommen; Clearing: VW1942 möglich (wie N3b)',
    fenster: ['di-nm'],
    abhaengig: ['K01'],
    rang: 25,
    baue: (ctx) => {
      const { vr } = kasseneckVr();
      const [j, m] = ctx.zr.split('-').map(Number);
      const ende = new Date(Date.UTC(j, m - 1, 0)).toISOString().slice(0, 10); // letzter Tag des Vormonats
      const ergebnis = vr.felderAbmeldung({
        nutzer: nutzer(ctx),
        emp: mitarbeiter(ctx, { endDate: ende, beendigung: { art: 'einvernehmlich' } }),
        endabrechnung: { status: 'vollstaendig', elda: { EBSV: ende, ADAT: ende, BVEN: ende, AGRD: '03' } },
      });
      return bestand(ctx, 'K03', 'M4', ergebnis, 3);
    },
  }),
];
