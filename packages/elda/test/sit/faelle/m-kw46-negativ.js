'use strict';

// Mi 07–09 (simuliert 01.04.2027): Negativtests auf der einzelnen mBGM – bisher waren nur Paketprüfungen
// (M60–M65, F9000–F9051) auf der SIT. Hier geht es um Fehler, die einem Lohnprogramm in der Rechnung passieren
// können: falscher Beitragssatz, unbekannte Beschäftigtengruppe, unberechtigte AV-Minderung, Zeitraum im
// laufenden oder künftigen Monat, dieselbe Person zweimal im Paket.
//
// Person freier_dn als Angestellte auf B/15 (Q67, ab 01.01.2026, BVAB 01.02.2026, 9.000 €). Jede Probe nimmt einen
// Monat, für den es noch keine mBGM gibt (M110–M113 belegen 01, 06, 11, 12): Kommt eine formal durch, zeigt das
// Clearing Mi nm, ob die ÖGK den Inhalt prüft – ohne dass eine echte mBGM desselben Monats dazwischenfunkt.
//
//   M118 02/2026  T01 mit 39,00 % statt 39,05 % (Betrag passend zum falschen Satz)
//   M119 03/2026  Beschäftigtengruppe B999 statt B002 – laut SIT-Protokoll „Betriebliche Vorsorge ohne SV-Pflicht“,
//                 also eine reine BV-Gruppe mit SV-Verrechnung (AB/T01)
//   M120 04/2026  A01 −0,95 % auf 6.930 € – AV-Minderung, obwohl das Entgelt weit über der Staffel liegt
//   M121 04/2027  laufender Monat: Paket am 01.04.2027 für 04/2027 (Lohnlauf vor Monatsende)
//   M122 05/2027  künftiger Monat
//   M123 07/2026  dieselbe Person zweimal im selben Paket
//   M124 08/2026  Beschäftigtengruppe B000
//   M125 09/2026  Beschäftigtengruppe X001 (Aufbau falsch: kein „B“ vorn)
//
// Das Protokoll (mbd) nennt zu jeder Meldung die Beschäftigtengruppe im Klartext; M118–M123 kamen alle formal
// „übernommen“ – die Einzelmeldung prüft ELDA beim Empfang nicht inhaltlich.

const { mbgmPaket, setzeFeld } = require('../lib/bausteine');
const { FELDER_PAKET } = require('../../../dist/felder-e32.js');

const fall = (mehr) => ({
  gefahr: null,
  aktion: 'senden',
  braucht: 'kasseneck',
  fenster: ['mi-vm'],
  abhaengig: ['Q67'],
  rang: 30,
  ...mehr,
});
const QUELLE = 'E.32 (T1/BS/V1, D.31 Verrechnungspositionen); kasseneck mbgm-core.js; Negativtest';
const BZRM = FELDER_PAKET.find((f) => f.name === 'BZRM');

/** Das Jahr, in dem die Q67-Kette liegt (Vorjahr des Fensters, in dem Q67 lief). */
const jahrVon = (ctx) => Number(ctx.zrVon('Q67').slice(0, 4)) - 1;

function paket(ctx, id, monat, { abwandlung, doppelt = false } = {}) {
  const jahr = jahrVon(ctx);
  const b = {
    rolle: 'freier_dn',
    mitarbeiter: {
      dienstnehmerGruppe: 'angestellter',
      beschaeftigungsart: 'fulltime',
      eintritt: `${jahr}-01-01`,
      austritt: null,
      wochenstunden: 40,
      kvBasisStunden: 40,
      grossSalaryCents: 900_000,
    },
    ...(abwandlung ? { abwandlung } : {}),
  };
  return mbgmPaket(ctx, {
    fall: id,
    dg: 'B',
    traeger: '15',
    monat: `${jahr}-${String(monat).padStart(2, '0')}`,
    bundesland: 'oberoesterreich',
    beschaeftigte: doppelt ? [b, b] : [b],
    pruefen: false,
  });
}

/** Wendet `f` auf jede Basis `typ` aller Tarifblöcke an. */
const anBasis = (typ, f) => (eintrag) => ({
  ...eintrag,
  tarifbloecke: eintrag.tarifbloecke.map((t) => ({
    ...t,
    basen: t.basen.map((b) => (b.typ === typ ? f(b) : b)),
  })),
});

/** Paket für den Monat des simulierten Tages plus `vor` Monate, gebaut aus 05 des Kettenjahres. */
function paketImMonat(ctx, id, vor) {
  const [j, m] = ctx.zr.split('-').map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + vor, 1)).toISOString().slice(0, 7);
  const b = paket(ctx, id, 5);
  return { ...b, inhalt: setzeFeld(b.inhalt, 2, BZRM, `${ziel.slice(5, 7)}${ziel.slice(0, 4)}`) };
}

module.exports = [
  fall({
    id: 'M118',
    titel: 'mBGM-Negativ 02/2026 B/15: T01 mit 39,00 % statt 39,05 %, Betrag zum falschen Satz',
    zweck:
      'Ein veralteter oder vertippter Beitragssatz im Lohnprogramm. Prüft ELDA den Satz der Tarifgruppe formal ' +
      '(F-Code) oder erst die ÖGK im Clearing (BW1917/BW1850)?',
    quelle: QUELLE,
    erwartung: 'offen: nicht übernommen mit F-Code, oder übernommen und Clearing Mi nm BW1917/BW1850',
    baue: (ctx) =>
      paket(ctx, 'M118', 2, {
        abwandlung: anBasis('AB', (b) => ({
          ...b,
          positionen: b.positionen.map((p) =>
            p.typ === 'T01' ? { ...p, prozentsatz: 39.0, betragCent: ctx.elda.berechneBeitragCent(b.betragCent, 39.0) } : p,
          ),
        })),
      }),
  }),
  fall({
    id: 'M119',
    titel: 'mBGM-Negativ 03/2026 B/15: Beschäftigtengruppe B999 („BV ohne SV-Pflicht“) mit SV-Verrechnung',
    zweck:
      'Gedacht als unbekannte Gruppe – das SIT-Protokoll nennt B999 aber „Betriebliche Vorsorge ohne SV-Pflicht“. ' +
      'Damit: reine BV-Gruppe mit AB/T01. Meldet die ÖGK die Kombination (BW1838)?',
    quelle: QUELLE,
    erwartung: 'formal übernommen (Protokoll: „Betriebliche Vorsorge ohne SV-Pflicht“); Clearing Mi nm BW1838?',
    baue: (ctx) =>
      paket(ctx, 'M119', 3, {
        abwandlung: (e) => ({ ...e, tarifbloecke: e.tarifbloecke.map((t) => ({ ...t, beschaeftigtengruppe: 'B999' })) }),
      }),
  }),
  fall({
    id: 'M120',
    titel: 'mBGM-Negativ 04/2026 B/15: A01 −0,95 % bei 9.000 € – AV-Minderung ohne Anspruch',
    zweck:
      'kasseneck setzt A01–A03 nach der AlV-Staffel (bis 2.427 €). Ein Programm, das die Minderung trotz hohem ' +
      'Entgelt abzieht: Erkennt die ÖGK das (BW1842/BW1917), oder nur über die Beitragssumme?',
    quelle: `${QUELLE}; § 2a AMPFG`,
    erwartung: 'offen: übernommen; Clearing Mi nm BW1842/BW1917/BW1850 – oder formal abgewiesen',
    baue: (ctx) =>
      paket(ctx, 'M120', 4, {
        abwandlung: anBasis('AB', (b) => ({
          ...b,
          positionen: [
            ...b.positionen,
            { typ: 'A01', prozentsatz: -0.95, betragCent: ctx.elda.berechneBeitragCent(b.betragCent, -0.95) },
          ],
        })),
      }),
  }),
  fall({
    id: 'M121',
    titel: 'mBGM für den laufenden Monat: am 01.04.2027 für 04/2027 (B/15)',
    zweck:
      'Ein Lohnlauf vor dem Monatsende (z. B. am 25.) könnte die mBGM sofort senden. Nimmt ELDA einen ' +
      'Beitragszeitraum an, der noch nicht abgelaufen ist? Beträge aus 05/2026 (kasseneck kennt 2027 nicht).',
    quelle: `${QUELLE}; § 34 Abs 2 ASVG (Frist bis zum 15. des Folgemonats)`,
    erwartung: 'offen: übernommen, oder F-Code „Beitragszeitraum in der Zukunft“',
    baue: (ctx) => paketImMonat(ctx, 'M121', 0),
  }),
  fall({
    id: 'M122',
    titel: 'mBGM-Negativ: künftiger Monat 05/2027 am 01.04.2027 (B/15)',
    zweck: 'Gegenstück zu M121 einen Monat weiter. Beträge aus 05/2026.',
    quelle: QUELLE,
    erwartung: 'nicht übernommen, F-Code zum Beitragszeitraum',
    baue: (ctx) => paketImMonat(ctx, 'M122', 1),
  }),
  fall({
    id: 'M123',
    titel: 'mBGM-Negativ 07/2026 B/15: dieselbe Person zweimal im selben Paket',
    zweck:
      'Zwei vollständige mBGM für dieselbe VSNR und denselben Zeitraum in einem Paket (z. B. doppelt erfasster ' +
      'Mitarbeiter). Abweisung des Pakets, einer Meldung, oder übernommen und Clearing?',
    quelle: QUELLE,
    erwartung: 'offen: nicht/teilweise übernommen mit F-Code, oder Clearing Mi nm',
    baue: (ctx) => paket(ctx, 'M123', 7, { doppelt: true }),
  }),
  ...[
    ['M124', 8, 'B000', 'eine Nummer, die es im Tarifsystem vermutlich nicht gibt'],
    ['M125', 9, 'X001', 'ein Code ohne „B“ vorn – falscher Aufbau'],
  ].map(([id, monat, gruppe, was]) =>
    fall({
      id,
      titel: `mBGM-Negativ ${String(monat).padStart(2, '0')}/2026 B/15: Beschäftigtengruppe ${gruppe}`,
      zweck: `Nach M119 (B999 gibt es): ${was}. Weist ELDA ab, oder nennt das Protokoll eine Gruppe?`,
      quelle: QUELLE,
      erwartung: 'offen: nicht übernommen mit F-Code, oder übernommen und Clearing Mi nm',
      baue: (ctx) =>
        paket(ctx, id, monat, {
          abwandlung: (e) => ({ ...e, tarifbloecke: e.tarifbloecke.map((t) => ({ ...t, beschaeftigtengruppe: gruppe })) }),
        }),
    }),
  ),
];
