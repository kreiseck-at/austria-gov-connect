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
//
// Stand von kasseneck: K01–K03 liefen am 13.10.2026 mit Stand 172a59f4. Seit
// bc20286e („Abmeldung ohne BV-Ende, wenn das Dienstverhältnis vor dem BV-Beginn
// endet“) schickt kasseneck in diesem Fall kein BVEN mehr; die Brücke steht ab
// 14.10.2026 auf 8908f6b8. Die Fälle ab K04 und Q05 bauen mit dem neuen Stand:
//   Mi vormittags (sim. 01.04.2026) K04 Richtigstellung der Abmeldung K03 ohne BVEN (M9)
//                                   K11 Anmeldung reserve_3 auf A/15, Eintritt 02.03.2026
//                                   Q05 Anmeldung reserve_1 auf A/15, Eintritt 02.02.2026 –
//                                       Antwort wird verworfen, danach `kasseneck-klaeren Q05`
//   Mi nachmittags (sim. 01.05.2026) K12 Abmeldung K11 zum 31.03.2026 (vor dem BV-Beginn)
//                                   K13 Abmeldung Q05 zum 31.03.2026 (nach dem BV-Beginn)
// Einschränkung: Die Eintritte liegen vor dem simulierten Tag – die Anmeldungen sind
// verspätet (Meldeverstoß im Clearing möglich), anders lässt sich ein Dienstverhältnis
// über das BV-Ende in einem Fenster nicht abbilden.

const { kasseneckVr } = require('../lib/kasseneck');

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', braucht: 'kasseneck-vr', ...mehr });
const DG = 'A';
const TRAEGER = '14';
const ROLLE = 'angestellte';
const EMPLOYEE_ID = 'sitK01ang';
const QUELLE =
  'kasseneck feature/elda-versichertenmeldung: versichertenmeldung-core.js, elda-rueckmeldung-core.js';

function nutzer(ctx, dg = DG, traeger = TRAEGER) {
  return {
    elda: { beitragskontonummer: ctx.konto(dg, { traeger }).bknr },
    company_name: ctx.dienstgeber(dg).name,
  };
}

function mitarbeiter(ctx, mehr = {}, rolle = ROLLE) {
  const p = ctx.rolle(rolle);
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

function refw(n, employeeId = EMPLOYEE_ID) {
  const { rueck } = kasseneckVr();
  return rueck.referenzwertVr({ tag: rueck.wienerTagKurz(Date.now()), employeeId, n });
}

/** Satz mit kasseneck bauen; jeder Befund aus kasseneck oder dem Paket bricht ab. */
function bestand(ctx, id, art, ergebnis, n, { employeeId = EMPLOYEE_ID, dg = DG, traeger = TRAEGER } = {}) {
  const { vr } = kasseneckVr();
  if (ergebnis.fehlend && ergebnis.fehlend.length) {
    throw new Error(
      `${id}: kasseneck meldet fehlende Angaben: ${ergebnis.fehlend.map((f) => f.text).join(' | ')}`,
    );
  }
  if (ergebnis.sperre) throw new Error(`${id}: kasseneck sperrt: ${ergebnis.sperre.text}`);
  const befunde = vr.pruefeSatz(art, ergebnis.felder);
  if (befunde.length) throw new Error(`${id}: kasseneck-Prüfung: ${befunde.map((b) => b.text).join(' | ')}`);
  const referenzwert = refw(n, employeeId);
  const satz = vr.baueSatz(art, { ...ergebnis.felder, REFW: referenzwert });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg, traeger })),
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
      const aktuell = vr.felderAnmeldung({
        nutzer: n,
        emp: mitarbeiter(ctx, { weeklyHours: 25 }),
        historie: [],
      });
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
    titel: 'kasseneck (alter Stand 172a59f4): Abmeldung einvernehmlich zum 31.03.2025 mit BVEN (M4)',
    zweck:
      'D3/D5: Abmeldung, wie kasseneck sie bis bc20286e baute (ADAT/EBSV/BVEN = Austritt aus der Endabrechnung, ' +
      'AGRD 03). Gesendet am 13.10.2026 mit dem ALTEN Stand: BVEN 31.03.2025, obwohl die BV erst am 01.04.2025 ' +
      'begonnen hätte (BVAB aus K01) – Gegenstück zu V83 (N3b). Seit bc20286e lässt kasseneck BVEN hier weg; ' +
      'die Richtigstellung dazu ist K04.',
    quelle: `${QUELLE}; endabrechnung-core.js (elda.BVEN = svEnde); beendigungsarten AGRD`,
    erwartung: 'übernommen; Clearing: VW1942 (alter Stand, BVEN vor dem BV-Beginn)',
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

// --- Neuer Stand (8908f6b8): K04, K11–K13, Q05 ------------------------------------

/** Letzter Tag des Monats vor `iso` (JJJJ-MM-TT). */
function vormonatsende(iso) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, 0)).toISOString().slice(0, 10);
}

/** Der 02. des Monats, der `zurueck` Monate vor `iso` liegt (JJJJ-MM-TT). */
function zweiterVor(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 2)).toISOString().slice(0, 10);
}

/** Anmeldung über kasseneck für eine weitere Person (eigene kasseneck-Mitarbeiter-ID). */
function anmeldungNeu(ctx, id, { rolle, employeeId, start, n }) {
  const { vr } = kasseneckVr();
  const emp = mitarbeiter(ctx, { startDate: start }, rolle);
  return bestand(
    ctx,
    id,
    'M3',
    vr.felderAnmeldung({ nutzer: nutzer(ctx, 'A', '15'), emp, historie: [] }),
    n,
    {
      employeeId,
      dg: 'A',
      traeger: '15',
    },
  );
}

/**
 * Abmeldung über kasseneck mit dem neuen Stand: BV-Beginn aus dem gemeldeten BVAB
 * (`bvBeginnDesDv`), BVEN entfällt, wenn er nach dem Ende liegt.
 */
function abmeldungNeu(ctx, id, { rolle, employeeId, start, ende, n, bvenErwartet }) {
  const { vr } = kasseneckVr();
  const n15 = nutzer(ctx, 'A', '15');
  const angemeldet = vr.felderAnmeldung({
    nutzer: n15,
    emp: mitarbeiter(ctx, { startDate: start }, rolle),
    historie: [],
  });
  const emp = mitarbeiter(
    ctx,
    { startDate: start, endDate: ende, beendigung: { art: 'einvernehmlich' } },
    rolle,
  );
  const bvab = vr.bvBeginnDesDv({
    dv: { angemeldet: { felder: angemeldet.felder } },
    nutzer: n15,
    emp,
    historie: [],
  });
  const ergebnis = vr.felderAbmeldung({
    nutzer: n15,
    emp,
    endabrechnung: { status: 'vollstaendig', elda: { EBSV: ende, ADAT: ende, BVEN: ende, AGRD: '03' } },
    bvab,
  });
  if (Boolean(ergebnis.felder.BVEN) !== bvenErwartet) {
    throw new Error(
      `${id}: kasseneck ${ergebnis.felder.BVEN ? 'setzt' : 'lässt'} BVEN ` +
        `(BV-Beginn ${bvab}, Ende ${ende}) – erwartet war das Gegenteil; steht die Brücke auf 8908f6b8?`,
    );
  }
  return bestand(ctx, id, 'M4', ergebnis, n, { employeeId, dg: 'A', traeger: '15' });
}

const K11 = { rolle: 'reserve_3', employeeId: 'sitK11r3' };
const Q05 = { rolle: 'reserve_1', employeeId: 'sitQ05r1' };

module.exports.push(
  fall({
    id: 'K04',
    titel: 'kasseneck (neuer Stand): Richtigstellung der Abmeldung K03 ohne BVEN (M9)',
    zweck:
      'K03 trug mit dem alten Stand BVEN 31.03.2025, obwohl die BV erst am 01.04.2025 begonnen hätte → VW1942 ' +
      'erwartet. Die M9, wie kasseneck sie seit bc20286e baut, lässt BVEN weg. Verschwindet VW1942?',
    quelle: `${QUELLE} (8908f6b8); versichertenmeldung-core.felderRichtigstellungAbmeldung, bvBeginnDesDv`,
    erwartung: 'übernommen; Clearing: VW1942 zu K03 erledigt bzw. kein neues VW1942',
    fenster: ['mi-vm', 'mi-nm'],
    abhaengig: ['K01', 'K03'],
    rang: 30,
    baue: (ctx) => {
      const { vr } = kasseneckVr();
      const n = nutzer(ctx);
      const start = ctx.zrVon('K01');
      const ende = vormonatsende(ctx.zrVon('K03'));
      const angemeldet = vr.felderAnmeldung({
        nutzer: n,
        emp: mitarbeiter(ctx, { startDate: start }),
        historie: [],
      });
      const emp = mitarbeiter(ctx, {
        startDate: start,
        endDate: ende,
        beendigung: { art: 'einvernehmlich' },
      });
      const elda = { EBSV: ende, ADAT: ende, BVEN: ende, AGRD: '03' };
      // Wie K03 gesendet wurde (alter Stand, mit BVEN) …
      const alt = vr.felderAbmeldung({ nutzer: n, emp, endabrechnung: { status: 'vollstaendig', elda } });
      // … und wie kasseneck sie heute baut.
      const bvab = vr.bvBeginnDesDv({
        dv: { angemeldet: { felder: angemeldet.felder } },
        nutzer: n,
        emp,
        historie: [],
      });
      const neu = vr.felderAbmeldung({
        nutzer: n,
        emp,
        endabrechnung: { status: 'vollstaendig', elda },
        bvab,
      });
      if (neu.felder.BVEN)
        throw new Error('K04: kasseneck setzt BVEN noch – Brücke steht nicht auf 8908f6b8.');
      const ergebnis = vr.felderRichtigstellungAbmeldung({
        nutzer: n,
        abgemeldet: { referenzwert: ctx.referenzwertVon('K03'), felder: alt.felder },
        aktuell: neu.felder,
      });
      return bestand(ctx, 'K04', 'M9', ergebnis, 4);
    },
  }),
  fall({
    id: 'K11',
    titel: 'kasseneck (neuer Stand): Anmeldung reserve_3 auf A/15, Eintritt 02.03.2026 (M3)',
    zweck:
      'Frische Kette für die BV-Ende-Regel aus bc20286e: BVAB nach kasseneck = Eintritt + 1 Monat (02.04.2026). ' +
      'Die Abmeldung K12 endet davor. Einschränkung: Anmeldung am simulierten 01.04.2026, also verspätet.',
    quelle: `${QUELLE} (8908f6b8); versichertenmeldung-core.felderAnmeldung`,
    erwartung: 'übernommen (Meldeverstoß wegen Verspätung im Clearing möglich)',
    fenster: ['mi-vm'],
    rang: 30,
    baue: (ctx) => anmeldungNeu(ctx, 'K11', { ...K11, start: zweiterVor(ctx.zr, 1), n: 1 }),
  }),
  fall({
    id: 'K12',
    titel: 'kasseneck (neuer Stand): Abmeldung K11 zum 31.03.2026 – vor dem BV-Beginn, ohne BVEN (M4)',
    zweck:
      'Das Dienstverhältnis endet vor dem BV-Beginn (02.04.2026); seit bc20286e schickt kasseneck dann kein BVEN. ' +
      'Erwartung: kein VW1942 (Gegenstück zu K03 und V83). Läuft in mi-vm (sim. 01.04.2026) vor der mBGM 03/2026 ' +
      '(M71), ersatzweise mi-nm (sim. 01.05.2026, dann verspätet).',
    quelle: `${QUELLE} (8908f6b8); versichertenmeldung-core.felderAbmeldung (bvab), bvBeginnDesDv`,
    erwartung: 'übernommen; Clearing: kein VW1942',
    fenster: ['mi-vm', 'mi-nm'],
    abhaengig: ['K11'],
    rang: 33,
    baue: (ctx) =>
      abmeldungNeu(ctx, 'K12', {
        ...K11,
        start: zweiterVor(ctx.zrVon('K11'), 1),
        ende: vormonatsende(ctx.zrVon('K11')),
        n: 2,
        bvenErwartet: false,
      }),
  }),
  fall({
    id: 'Q05',
    titel: 'kasseneck: Anmeldung reserve_1 auf A/15 – Antwort verwerfen, dann „Status klären“ (M3)',
    zweck:
      'Die Sende-Antwort geht verloren (das Werkzeug verwirft die Protokollnummer bewusst). Danach ' +
      '`kasseneck-klaeren Q05`: Ordnet kasseneck (597c79a0, elda-versand.klaere/ordneZu) die Sendung über den ' +
      'Dateinamen der Mitteilung zu, ohne erneut zu senden? Eintritt 02.02.2026, BVAB nach kasseneck 02.03.2026 ' +
      '(verspätet zum simulierten 01.04.2026).',
    quelle: `${QUELLE} (597c79a0, 8908f6b8); elda-versand.js klaere/ordneZu; Mitteilungs-Schema (dateiname)`,
    erwartung:
      'übernommen; die Mitteilung nennt den Dateinamen, `kasseneck-klaeren` ordnet zu, kein zweiter Versand',
    fenster: ['mi-vm'],
    rang: 31,
    antwortVerwerfen: true,
    baue: (ctx) => anmeldungNeu(ctx, 'Q05', { ...Q05, start: zweiterVor(ctx.zr, 2), n: 1 }),
  }),
  fall({
    id: 'K13',
    titel: 'kasseneck (neuer Stand): Abmeldung Q05 zum 31.03.2026 – nach dem BV-Beginn, mit BVEN (M4)',
    zweck:
      'Gegenprobe zu K12: Das Dienstverhältnis endet nach dem BV-Beginn (02.03.2026); kasseneck behält BVEN. ' +
      'Erwartung: kein VW1942, weil BVAB gemeldet war (Befund 13.10.2026).',
    quelle: `${QUELLE} (8908f6b8); versichertenmeldung-core.felderAbmeldung (bvab)`,
    erwartung: 'übernommen; Clearing: kein VW1942',
    fenster: ['mi-vm', 'mi-nm'],
    abhaengig: ['Q05'],
    rang: 34,
    baue: (ctx) =>
      abmeldungNeu(ctx, 'K13', {
        ...Q05,
        start: zweiterVor(ctx.zrVon('Q05'), 2),
        ende: vormonatsende(ctx.zrVon('Q05')),
        n: 2,
        bvenErwartet: true,
      }),
  }),
);
