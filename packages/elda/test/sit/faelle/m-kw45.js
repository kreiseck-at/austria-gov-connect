'use strict';

// mBGM der KW45-Ketten (Zeitreise 2026/27). Mo 12–14 = 01.02.2026: Die
// Sammelverarbeitung dieses Fensters rechnet den Beitragszeitraum 01/2026 ab.
// Je Beitragskonto ein Paket mit allen Q-Personen des Kontos – nur Q35 fehlt
// bewusst (Q17: Mahnung BW1930 und amtswegige mBGM BW1916 abwarten).
//
//   M80  A/15  01/2026  Q31 reserve_2, Q32 reserve_3 (ohne BVAB)
//   M81  B/15  01/2026  Q30 reserve_1 (ohne BVAB), Q33 angestellte (Austritt 31.01.), Q37 arbeiter
//   M82  A/14  01/2026  Q34 angestellte (BVAB 01.02. – Jänner BV-frei)
//
// Di 07–09 = 01.03.2026, Beitragszeitraum 02/2026, jeweils nach den Abmeldungen (N4):
//   M83  A/15  02/2026  Q31, Q32 mit BV und Austritt 28.02. (keine BV-Zeit gemeldet → BW1871?)
//   M84  B/15  02/2026  Q30 nur SV (VERG 2, BV-Zeit per Q40 nachgetragen → BW2032?), Q37 mit BV, Austritt 28.02.
//   M85  A/14  02/2026  Q34 nur SV (VERG 2) ab dem BV-Beginn 01.02. → BW2032?
//
// Q36 (geringfügig) bekommt keine mBGM: Die mBGM-Logik von kasseneck bildet für Geringfügige
// keine Verrechnungspositionen, und für 12/2025 fehlt das Parameterwerk 2025. Die Q20-Kette
// prüft nur F7115 bei M6/M8 – eine Mahnung dazu ist Beobachtung, kein Fehler des Falls.
//
// Beträge wie in m-kw42-kette.js: 3.000 € Vollzeit, Geringfügig 500 €. Gerechnet
// mit der Lohnlogik von kasseneck ohne Endabrechnung.

//
// Di 12–14 = 01.04.2026, Beitragszeitraum 03/2026 plus Berichtigungen (Selbstabrechnung:
// Änderung immer als Storno der zuletzt gesendeten mBGM + neue mBGM, ÖGK-FAK 3.2.7):
//   M86  B/15  02/2026  Q30: Storno aus M84 (nur SV) + neue mBGM mit BV IM SELBEN PAKET
//   M87  A/15  02/2026  Q32: Storno aus M83 (mit BV, BW1871) – eigenes Paket wie M54 (KW42)
//   M88  A/15  02/2026  Q32 neu mit BV nach Q48/Q49; Q35 erste echte mBGM 02 (nach amtswegiger?)
//   M89  A/15  01/2026  Q35 echte mBGM nach BW1916 (Q17)
//   M95  B/15  03/2026  Q30 mit BV; Q43 Wiedereintritt mit BV ab dem ersten Tag (B7)
//
// Mi 07–09 = 01.04.2027 (Clearing der Sammelverarbeitung danach: Mi nm):
//   M96  A/14  01/2026  Q34 zweite mBGM ohne Storno, 3.100 € statt 3.000 € (Q19)

const { mbgmPaket } = require('../lib/bausteine');
const { plusTage } = require('../lib/fenster');
const { FELDER_MBGM, FELDER_VERRECHNUNGSBASIS } = require('../../../dist/felder-e32.js');

const fall = (mehr) => ({ gefahr: null, aktion: 'senden', braucht: 'kasseneck', ...mehr });
const MO_NM = ['mo-nm'];
const DI_NM = ['di-nm'];
const MI_VM = ['mi-vm'];

const lies = (satz, tabelle, name) => {
  const f = tabelle.find((x) => x.name === name);
  return satz.slice(f.pos - 1, f.pos - 1 + f.laenge);
};
const saetzeVon = (inhalt) => inhalt.toString('latin1').split(/\r?\n/);

/**
 * Storno der mBGM einer Rolle aus dem gesendeten Paket `ursprung`. REFU, VSNR und VSUM
 * stammen aus dem Original – über sie ordnet die ÖGK das Storno zu (FAK 3.2.7).
 */
function stornoAus(ctx, fall, ursprung, rolle) {
  const vsnr = ctx.rolle(rolle).vsnr;
  const treffer = saetzeVon(ctx.bestandVon(ursprung).inhalt).filter(
    (s) => /^G\d/.test(s) && lies(s, FELDER_MBGM, 'VSNR') === vsnr,
  );
  if (treffer.length !== 1) throw new Error(`${fall}: ${treffer.length} mBGM für ${rolle} in ${ursprung} statt einer`);
  const [satz] = treffer;
  if (!satz.startsWith('G1')) throw new Error(`${fall}: ${ursprung} meldet ${rolle} als ${satz.slice(0, 2)}, erwartet G1`);
  return {
    referenzwert: ctx.referenzwert(`${fall}-S`),
    referenzUrspruenglicheMeldung: lies(satz, FELDER_MBGM, 'REFW').trim(),
    versicherungsnummer: vsnr,
    summeCent: Number(lies(satz, FELDER_MBGM, 'VSUM')),
  };
}

/** Verrechnungsbasen (VBTY) der mBGM einer Rolle in einem gebauten Paket. */
function basenVon(ctx, inhalt, rolle) {
  const vsnr = ctx.rolle(rolle).vsnr;
  const s = saetzeVon(inhalt);
  const start = s.findIndex((z) => /^G\d/.test(z) && lies(z, FELDER_MBGM, 'VSNR') === vsnr);
  if (start < 0) return null;
  const basen = [];
  for (const z of s.slice(start + 1)) {
    if (/^(G\d|R\d|PE|99)/.test(z)) break;
    if (z.startsWith('BS')) basen.push(lies(z, FELDER_VERRECHNUNGSBASIS, 'VBTY'));
  }
  return basen;
}

/** Beitragszeitraum des gesendeten Pakets `id`: Monat vor seinem simulierten Tag. */
const monatVon = (ctx, id) => monatVor(ctx.zrVon(id), 1);
const QUELLE = 'E.32; kasseneck functions-lohn/mbgm-core.js, lohnabrechnung-core.js; SIT-Portal Zeitreise 2026/27';

/** Monat `zurueck` Monate vor `iso` als JJJJ-MM. */
function monatVor(iso, zurueck) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1 - zurueck, 1)).toISOString().slice(0, 7);
}

/** Der Monat nach `monat` (JJJJ-MM). */
const einMonatNach = (monat) => monatVor(monat, -1);

/** Letzter Tag des Monats vor `iso`. */
function vormonatsende(iso) {
  const [j, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, 0)).toISOString().slice(0, 10);
}

const vollzeit = (dienstnehmerGruppe, eintritt, austritt = null) => ({
  dienstnehmerGruppe,
  beschaeftigungsart: 'fulltime',
  eintritt,
  austritt,
  wochenstunden: 40,
  kvBasisStunden: 40,
  grossSalaryCents: 300_000,
});

module.exports = [
  fall({
    id: 'M80',
    titel: 'mBGM Jänner 2026, Konto A/15 – Q31, Q32 (ohne BVAB); Q35 fehlt bewusst',
    zweck:
      'Erster Monat der Ketten Q07/Q14 (BV-frei, Anmeldung ohne BVAB – passt zusammen). Q35 ist auf ' +
      'demselben Konto angemeldet, bekommt aber keine mBGM: Kommt BW1930 bzw. eine amtswegige mBGM?',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing: kein BW1871 für Q31/Q32; Q35 später BW1930/BW1916',
    fenster: MO_NM,
    abhaengig: ['Q31', 'Q32'],
    rang: 14,
    baue: (ctx) => {
      return mbgmPaket(ctx, {
        fall: 'M80',
        dg: 'A',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_2', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q31')) },
          { rolle: 'reserve_3', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q32')) },
        ],
      });
    },
  }),
  fall({
    id: 'M81',
    titel: 'mBGM Jänner 2026, Konto B/15 – Q30 (ohne BVAB), Q33 (Austritt 31.01.), Q37 (kasseneck)',
    zweck:
      'Q30: erster Monat ohne BV, später M8 mit BVAB. Q33: einziger Monat vor der Abmeldung zum 31.01. (gesendet ' +
      'nach Q38, N4). Q37: erster Monat der kasseneck-Anmeldung.',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing ohne BW1871/BW1874',
    fenster: MO_NM,
    abhaengig: ['Q30', 'Q33', 'Q37', 'Q38'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M81',
        dg: 'B',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_1', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q30')) },
          {
            rolle: 'angestellte',
            mitarbeiter: vollzeit('angestellter', ctx.zrVon('Q33'), vormonatsende(ctx.zr)),
          },
          { rolle: 'arbeiter', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q37')) },
        ],
      }),
  }),
  fall({
    id: 'M82',
    titel: 'mBGM Jänner 2026, Konto A/14 – Q34 angestellte, Monat vor dem BV-Beginn',
    zweck: 'Normale mBGM für den Monat vor BVAB 01.02.2026; die Frage nach VERG 2 kommt erst mit 02/2026 (Di vm).',
    quelle: QUELLE,
    erwartung: 'übernommen; kein Clearing',
    fenster: MO_NM,
    abhaengig: ['Q34'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M82',
        dg: 'A',
        traeger: '14',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'angestellte', mitarbeiter: vollzeit('angestellter', ctx.zrVon('Q34')) }],
      }),
  }),
  fall({
    id: 'M83',
    titel: 'mBGM Februar 2026, Konto A/15 – Q31, Q32 mit BV, Austritt 28.02. (ohne gemeldete BV-Zeit)',
    zweck:
      'Zweiter Monat, also BV-pflichtig; die Anmeldungen trugen kein BVAB. Gesendet nach den Abmeldungen ' +
      'Q41/Q42 (N4). Erwartet BW1871 – die Grundlage für die Reparaturen am Nachmittag (Q07, Q14).',
    quelle: QUELLE,
    erwartung: 'übernommen; Clearing BW1871 für beide',
    fenster: ['di-vm'],
    abhaengig: ['Q31', 'Q32', 'Q41', 'Q42'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M83',
        dg: 'A',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_2', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q31'), vormonatsende(ctx.zr)) },
          { rolle: 'reserve_3', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q32'), vormonatsende(ctx.zr)) },
        ],
      }),
  }),
  fall({
    id: 'M84',
    titel: 'mBGM Februar 2026, Konto B/15 – Q30 nur SV (VERG 2), Q37 mit BV und Austritt 28.02.',
    zweck:
      'Q30: BV-Zeit ab 01.02. ist seit Q40 gemeldet, die mBGM kommt trotzdem ohne BV → BW2032? ' +
      'Q37: kasseneck-Person mit BVAB 01.02., Abmeldung Q46 davor (N4) → kein BW1871.',
    quelle: `${QUELLE}; E.32 (VERG)`,
    erwartung: 'übernommen; BW2032 für Q30, kein BW1871 für Q37',
    fenster: ['di-vm'],
    abhaengig: ['Q30', 'Q37', 'Q40', 'Q46'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M84',
        dg: 'B',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_1', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q30')), nurSv: true },
          { rolle: 'arbeiter', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q37'), vormonatsende(ctx.zr)) },
        ],
      }),
  }),
  fall({
    id: 'M85',
    titel: 'mBGM Februar 2026, Konto A/14 – Q34 nur SV (VERG 2) im ersten BV-Monat',
    zweck:
      'Q16: Die Anmeldung trug BVAB 01.02.2026, die mBGM 02 meldet bewusst nur SV. Verlangt die ÖGK ab dem ' +
      'BV-Beginn zwingend Verrechnungsgrundlage 1 (BW2032) oder rechnet sie still?',
    quelle: `${QUELLE}; E.32 (VERG), D.54`,
    erwartung: 'übernommen; Clearing BW2032 erwartet',
    fenster: ['di-vm'],
    abhaengig: ['Q34'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M85',
        dg: 'A',
        traeger: '14',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'angestellte', mitarbeiter: vollzeit('angestellter', ctx.zrVon('Q34')), nurSv: true },
        ],
      }),
  }),
  fall({
    id: 'M86',
    titel: 'Q10-Kette: Berichtigung mBGM 02/2026 von Q30 – Storno + neue mBGM mit BV in EINEM Paket (B/15)',
    zweck:
      'Q30 kam in M84 nur mit SV, obwohl die BV-Zeit seit Q40 gemeldet ist. Storno der Original-mBGM und ' +
      'Neumeldung mit BV stehen im selben Paket (M54/M55 in KW42 waren zwei Pakete). Nimmt die ÖGK beides ' +
      'in einem an, und verschwindet BW2032?',
    quelle: `${QUELLE}; E.32.2.8, E.32.2.2.2 (Storno), ÖGK-FAK 3.2.7`,
    erwartung: 'übernommen; Clearing ohne Zuordnungsfehler, kein BW2032 mehr für Q30 02/2026',
    fenster: DI_NM,
    abhaengig: ['Q30', 'Q40', 'M84'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M86',
        dg: 'B',
        traeger: '15',
        monat: monatVon(ctx, 'M84'),
        bundesland: 'oberoesterreich',
        stornos: [stornoAus(ctx, 'M86', 'M84', 'reserve_1')],
        beschaeftigte: [{ rolle: 'reserve_1', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q30')) }],
      }),
  }),
  fall({
    id: 'M87',
    titel: 'Q14-Kette: Storno der mBGM 02/2026 von Q32 aus M83 (A/15, eigenes Paket)',
    zweck:
      'M83 meldete Q32 mit BV ohne gespeicherte BV-Zeit (BW1871: „Grundlage nicht gespeichert“). Lässt sich ' +
      'diese mBGM trotzdem stornieren, oder gibt es nichts zuzuordnen?',
    quelle: `${QUELLE}; E.32.2.8, ÖGK-FAK 3.2.7; SIT M54 (KW42)`,
    erwartung: 'übernommen; Clearing offen: Rückverrechnung ohne Fehler oder Storno nicht zuordenbar',
    fenster: DI_NM,
    abhaengig: ['M83', 'Q48', 'Q49'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M87',
        dg: 'A',
        traeger: '15',
        monat: monatVon(ctx, 'M83'),
        bundesland: 'oberoesterreich',
        stornos: [stornoAus(ctx, 'M87', 'M83', 'reserve_3')],
        beschaeftigte: [],
      }),
  }),
  fall({
    id: 'M88',
    titel: 'mBGM 02/2026 A/15 – Q32 neu mit BV (nach M8 und Storno), Q35 erste echte mBGM 02',
    zweck:
      'Q14: nach BV-Zeit (Q48), Abmeldung (Q49) und Storno (M87) die mBGM mit BV – kommt BW1871 noch? ' +
      'Q17: Q35 bekam für 02 keine mBGM; wurde sie amtswegig angelegt, und was passiert mit der echten?',
    quelle: `${QUELLE}; E.32.2.8; SIT-README (BW1916)`,
    erwartung: 'übernommen; kein BW1871 für Q32; für Q35 Hinweis, Differenz oder nichts (offen)',
    fenster: DI_NM,
    abhaengig: ['Q32', 'Q35', 'M87'],
    rang: 15,
    baue: (ctx) => {
      const monat = monatVon(ctx, 'M83');
      return mbgmPaket(ctx, {
        fall: 'M88',
        dg: 'A',
        traeger: '15',
        monat,
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_3', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q32'), vormonatsende(ctx.zrVon('M83'))) },
          { rolle: 'arbeiter', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q35')) },
        ],
      });
    },
  }),
  fall({
    id: 'M89',
    titel: 'Q17-Kette: echte mBGM 01/2026 für Q35 nach der amtswegigen mBGM (BW1916), A/15',
    zweck:
      'Die ÖGK hat für Q35 01/2026 eine mBGM von Amts wegen angelegt (BW1916, nur SV). Jetzt kommt die echte ' +
      'mit denselben Daten wie kasseneck sie rechnet. Ersetzt sie die amtswegige, mit Hinweis oder Differenz?',
    quelle: `${QUELLE}; SIT-README (BW1930, BW1916); Clearing 01.02.2026`,
    erwartung: 'übernommen; Clearing offen: Hinweis, Differenz oder nichts',
    fenster: DI_NM,
    abhaengig: ['Q35', 'M80'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M89',
        dg: 'A',
        traeger: '15',
        monat: monatVon(ctx, 'M80'),
        bundesland: 'oberoesterreich',
        beschaeftigte: [{ rolle: 'arbeiter', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q35')) }],
      }),
  }),
  fall({
    id: 'M95',
    titel: 'mBGM 03/2026 B/15 – Q30 mit BV, Q43 Wiedereintritt mit BV ab dem ersten Tag (B7)',
    zweck:
      'Q43 war bis 31.01. beim selben Dienstgeber (Q33/Q38) und tritt am 01.03. wieder ein: kein ' +
      'beitragsfreier erster Monat (§ 6 Abs 1 BMSVG). kasseneck rechnet das über `bvVorEnde`. Nimmt die ÖGK ' +
      'BV im Eintrittsmonat ohne BW1874/BW2032?',
    quelle: `${QUELLE}; § 6 Abs 1 BMSVG; lohnabrechnung-core.js (bvVorEnde)`,
    erwartung: 'übernommen; Clearing ohne BW1874/BW2032 für Q43',
    fenster: DI_NM,
    abhaengig: ['Q30', 'Q40', 'Q38', 'Q43'],
    rang: 14,
    baue: (ctx) => {
      const b = mbgmPaket(ctx, {
        fall: 'M95',
        dg: 'B',
        traeger: '15',
        monat: monatVor(ctx.zr, 1),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          { rolle: 'reserve_1', mitarbeiter: vollzeit('arbeiter', ctx.zrVon('Q30')) },
          {
            rolle: 'angestellte',
            mitarbeiter: {
              ...vollzeit('angestellter', ctx.zrVon('Q43')),
              bvVorEnde: plusTage(ctx.zrVon('Q38'), -1),
            },
          },
        ],
      });
      const basen = basenVon(ctx, b.inhalt, 'angestellte');
      if (!basen?.includes('BV')) throw new Error(`M95: Q43 ohne BV im Eintrittsmonat (Basen ${basen})`);
      return b;
    },
  }),
  fall({
    id: 'M96',
    titel: 'Q19: zweite mBGM 01/2026 für Q34 (A/14) OHNE Storno, 3.100 € statt 3.000 €',
    zweck:
      'M82 hat 01/2026 für Q34 gemeldet (übernommen, ohne Clearing). Ersetzt eine zweite mBGM für denselben ' +
      'Monat und dieselbe Person ohne Storno die erste, meldet die ÖGK eine Doppelmeldung, oder summiert sie? ' +
      'Daran hängt, ob kasseneck jede Berichtigung als Storno + neue mBGM senden muss (FAK 3.2.7 sagt ja – hier ' +
      'die Gegenprobe). Clearing aus der Sammelverarbeitung nach diesem Fenster, also Mi nm.',
    quelle: `${QUELLE}; ÖGK-FAK 3.2.7`,
    erwartung: 'übernommen; Clearing Mi nm: Hinweis auf eine zweite mBGM bzw. Differenz – nicht still summiert',
    fenster: MI_VM,
    abhaengig: ['Q34', 'M82'],
    rang: 14,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M96',
        dg: 'A',
        traeger: '14',
        monat: monatVon(ctx, 'M82'),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'angestellte',
            mitarbeiter: { ...vollzeit('angestellter', ctx.zrVon('Q34')), grossSalaryCents: 310_000 },
          },
        ],
      }),
  }),
  fall({
    id: 'M97',
    titel: 'mBGM 03/2026 A/14 – Q34 mit 9.000 € über der Höchstbeitragsgrundlage (6.930 €), mit BV',
    zweck:
      'Die Höchstbeitragsgrundlage kam im Katalog nie vor. kasseneck muss die SV-Positionen bei 6.930 € deckeln, ' +
      'die BV aber vom vollen Entgelt rechnen (§ 6 Abs 1 BMSVG kennt keine Höchstbeitragsgrundlage). Erste echte ' +
      'mBGM 03/2026 nach der amtswegigen (BW1916/BW2032) – wie M89 ersetzt sie sie still, wenn sie stimmt.',
    quelle: `${QUELLE}; § 45 Abs 1, § 108 Abs 3 ASVG (6.930 € 2026); § 6 Abs 1 BMSVG; E.32`,
    erwartung: 'übernommen; Clearing Mi nm: amtswegige mBGM 03/2026 obsolet, kein BW1850/BW1917',
    fenster: MI_VM,
    abhaengig: ['Q34', 'M85'],
    rang: 15,
    baue: (ctx) =>
      mbgmPaket(ctx, {
        fall: 'M97',
        dg: 'A',
        traeger: '14',
        monat: einMonatNach(monatVon(ctx, 'M85')),
        bundesland: 'oberoesterreich',
        beschaeftigte: [
          {
            rolle: 'angestellte',
            mitarbeiter: { ...vollzeit('angestellter', ctx.zrVon('Q34')), grossSalaryCents: 900_000 },
          },
        ],
      }),
  }),
];
