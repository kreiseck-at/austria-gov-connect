'use strict';

// M/V/B – Zusatzfälle für Dienstag, 13.10.2026 (KW42).
//
//   Di vormittags (sim. 01.03.2025)
//     M52      mBGM 02/2025 für die Lehrlinge V03/V04 mit A04 statt A03 (Paket-Weg)
//     M60–M65  formale Negativfälle der mBGM, je eine Paketprüfung verletzt
//     M66      Paket mit zwei mBGM, eine mit ungültiger VSNR-Struktur
//     V84      Familienname mit ş als UTF-8-Bytes (Gegenstück zu V54, Vorname)
//     B13      gültige Anmeldung mit der Datenträgernummer einer schon gesendeten Datei
//   Di nachmittags (sim. 01.04.2025)
//     M54      Storno der mBGM 02/2025 von V04 aus M52
//     M55      Neumeldung derselben mBGM mit geänderter Basis
//
// Personenbelegung: V03/V04 (A/14) wie V15/V50 – beide enden am 28.02.2025, die
// mBGM 02/2025 passt dazu. V01 (A/14) für die Negativfälle; sie werden abgewiesen
// und berühren V07/V12 nicht – außer M66, dessen gültiger Teil eine mBGM 02/2025
// für V01 anlegt. reserve_3 nur mit verfälschter Nummer (existiert dann nicht).
// V84/B13: erfundene Personen ohne VSNR auf B/15 (Ersatznamen).

const { setzeFeld } = require('../lib/bausteine');
const { FELDER_E29 } = require('../../../dist/felder-e29.js');
const { FELDER_PAKET, FELDER_MBGM } = require('../../../dist/felder-e32.js');

const d = (ctx, iso) => ctx.ttmmjjjj(iso);
const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });
const DI_VM = ['di-vm'];
const DI_NM = ['di-nm'];
const feld = (tabelle, name) => tabelle.find((f) => f.name === name);

/** Beitragszeitraum = Monat vor dem simulierten Tag, als JJJJ-MM. */
function vormonat(ctx) {
  const [j, m] = ctx.zr.split('-').map(Number);
  return new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 7);
}
const bzrm = (jjjjmm) => `${jjjjmm.slice(5, 7)}${jjjjmm.slice(0, 4)}`;

/** Ersetzt einen Satz (1-basiert) durch eine neue Zeile bzw. entfernt ihn (null). */
function ersetzeSatz(inhalt, nr, neu) {
  const saetze = inhalt.toString('latin1').split('\r\n');
  if (neu === null) saetze.splice(nr - 1, 1);
  else saetze[nr - 1] = neu;
  return Buffer.from(saetze.join('\r\n'), 'latin1');
}

// --- M52: Lehrlinge mit A04 ------------------------------------------------------
//
// Sätze 2026 aus kasseneck (lohnparameter/2026.json, Quelle ÖGK
// contentid 10008.802672): Lehrling DN 13,07 % + DG 15,38 % = T01 28,45 %, davon
// AlV DN 1,15 %. Die ÖGK rechnete letzte Woche (BW1850, Beitragszeitraum 03/2026)
// 900 € → 269,82 € und 950 € → 284,82 € = 29,98 % = T01 28,45 % + BV 1,53 % –
// die unzulässige A03 hat sie dabei nicht angesetzt. BW1842 nannte A04
// („Minderung AV auf 0 % (Lg.)") als möglichen Abschlag. Für 02/2025 sind die
// Sätze NICHT belegt (2026er-Werte) → BW1850 möglich; entscheidend: kein BW1838.
// Februar 2025 ist der erste Monat (Eintritt 01.02.) → BV beitragsfrei, VERG 2.
const T01_LEHRLING = 28.45;
const A04_LEHRLING = -1.15;
const LEHRLINGE = [
  { rolle: 'arbeiterlehrling', vorlauf: 'V03', gruppe: 'B045', basis: 90_000 },
  { rolle: 'angestelltenlehrling', vorlauf: 'V04', gruppe: 'B044', basis: 95_000 },
];

function lehrlingsMbgm(ctx, { refw, rolle, gruppe, basis }) {
  const p = ctx.rolle(rolle);
  return {
    referenzwert: refw,
    versicherungsnummer: p.vsnr,
    familienname: p.familienname,
    vorname: p.vorname,
    verrechnungsgrundlage: ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
    tarifbloecke: [
      {
        beschaeftigtengruppe: gruppe,
        beginnDerVerrechnung: 1,
        basen: [
          {
            typ: 'AB',
            betragCent: basis,
            positionen: [
              { typ: 'T01', prozentsatz: T01_LEHRLING, betragCent: ctx.elda.berechneBeitragCent(basis, T01_LEHRLING) },
              { typ: 'A04', prozentsatz: A04_LEHRLING, betragCent: ctx.elda.berechneBeitragCent(basis, A04_LEHRLING) },
            ],
          },
        ],
      },
    ],
  };
}

/** Summe der Beiträge einer Lehrlings-mBGM (VSUM) – für das Storno. */
const vsumLehrling = (ctx, basis) =>
  ctx.elda.berechneBeitragCent(basis, T01_LEHRLING) + ctx.elda.berechneBeitragCent(basis, A04_LEHRLING);

/** Baut, prüft und verpackt ein mBGM-Paket auf Konto A/14. */
function paketA14(ctx, id, eintraege, { monat, referenzwerte, pruefen = true }) {
  const paketref = ctx.referenzwert(id);
  const saetze = ctx.elda.erstelleMbgmPaket(eintraege, {
    verfahren: 'selbstabrechnung',
    paketreferenzwert: paketref,
    beitragskontonummer: ctx.konto('A', { traeger: '14' }).bknr,
    dienstgebername: ctx.dienstgeber('A').name,
    beitragszeitraum: bzrm(monat),
    jaehrlicheAbrechnungGeringfuegiger: false,
  });
  if (pruefen) {
    const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)].filter(
      (b) => b.schwere === 'fehler',
    );
    if (befunde.length > 0) throw new Error(`mBGM-Paket ${id} hat Befunde: ${JSON.stringify(befunde).slice(0, 400)}`);
  }
  return {
    inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'A', traeger: '14' })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [...referenzwerte, paketref],
  };
}

// --- M60–M66: gültige mBGM 02/2025 für V01, danach verfälscht ---------------------
//
// Satzfolge: 1 Vorlauf, 2 PS, 3 G1, 4 T1, 5 BS AB, 6 V1 T01, 7 BS BV, 8 V1 V01, 9 PE, 10 Schluss.
// Arbeiter 3.000 € (über jeder AV-Minderung), T01 39,05 % (Satz 2026 aus kasseneck,
// für 2025 unbelegt), BV 1,53 % (zweiter Monat, Eintritt 01.01.2025) → VERG 1.
const ARBEITER_BASIS = 300_000;
function arbeiterMbgm(ctx, refw, rolle = 'arbeiter') {
  const p = ctx.rolle(rolle);
  return {
    referenzwert: refw,
    versicherungsnummer: p.vsnr,
    familienname: p.familienname,
    vorname: p.vorname,
    verrechnungsgrundlage: ctx.elda.VERRECHNUNGSGRUNDLAGE.SV_UND_BV_MIT_ZEIT,
    tarifbloecke: [
      {
        beschaeftigtengruppe: 'B001',
        beginnDerVerrechnung: 1,
        basen: [
          {
            typ: 'AB',
            betragCent: ARBEITER_BASIS,
            positionen: [
              { typ: 'T01', prozentsatz: 39.05, betragCent: ctx.elda.berechneBeitragCent(ARBEITER_BASIS, 39.05) },
            ],
          },
          {
            typ: 'BV',
            betragCent: ARBEITER_BASIS,
            positionen: [
              { typ: 'V01', prozentsatz: 1.53, betragCent: ctx.elda.berechneBeitragCent(ARBEITER_BASIS, 1.53) },
            ],
          },
        ],
      },
    ],
  };
}

function negativ(id, { titel, code, zweck, aendere }) {
  return fall({
    id,
    titel,
    zweck: `${zweck} Erste formale Abweisung einer mBGM (bisher kam jede MB-Datei „übernommen“).`,
    quelle: `Prüfkatalog 42/43, Blatt „mBGM Paket“ (${code}); src/pruefung-e32.ts`,
    erwartung: `nicht übernommen, ${code}`,
    fenster: DI_VM,
    abhaengig: ['V01'],
    rang: 26,
    baue: (ctx) => {
      const refw = ctx.referenzwert(`${id}-1`);
      const b = paketA14(ctx, id, [arbeiterMbgm(ctx, refw)], { monat: vormonat(ctx), referenzwerte: [refw] });
      return { ...b, inhalt: aendere(b.inhalt) };
    },
  });
}

/** Wert eines Feldes aus einem Satz der Datei (1-basiert). */
function lies(inhalt, nr, f) {
  const satz = inhalt.toString('latin1').split('\r\n')[nr - 1];
  return satz.slice(f.pos - 1, f.pos - 1 + f.laenge);
}

const SANZ = { name: 'SANZ', pos: 21, laenge: 6 };

/** Anmeldung einer erfundenen Person ohne VSNR auf Konto B/15. */
function anmeldungOhneVsnr(ctx, id, { FANA, VONA, GEBD }) {
  const refw = ctx.referenzwert(id);
  const satz = ctx.elda.anmeldung({
    REFW: refw,
    BKNR: ctx.konto('B', { traeger: '15' }).bknr,
    DGNA: ctx.dienstgeber('B').name,
    GEBD,
    FANA,
    VONA,
    ADAT: d(ctx, ctx.zr),
    BBER: '02',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: ctx.elda.wochenarbeitszeit(38, 30),
  });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg: 'B', traeger: '15' })),
    dateiName: ctx.dateiName(id),
    referenzwerte: [refw],
  };
}

module.exports = [
  fall({
    id: 'M52',
    titel: 'mBGM 02/2025 für die Lehrlinge mit A04 statt A03 (Paket-Weg)',
    zweck:
      'Gegenprobe zu BW1838/BW1842 aus KW41: Lehrlinge mit der Lehrlings-Minderung A04 ' +
      '(„Mind. AV auf 0 % (Lg.)") statt der allgemeinen A03. Klärt, ob die Korrektur in kasseneck ' +
      'A04 heißen muss. Erster Monat (Eintritt 01.02.2025) → keine BV-Verrechnung, VERG 2.',
    quelle:
      'SIT-Clearing KW41 BW1838/BW1842/BW1850; kasseneck lohnparameter 2026 (ÖGK 10008.802672); D.54; § 6 Abs 1 BMSVG',
    erwartung: 'übernommen; kein BW1838; BW1850 möglich (Sätze 2025 unbelegt; erwartet 27,30 % der Basis)',
    fenster: DI_VM,
    abhaengig: ['V03', 'V04'],
    baue: (ctx) => {
      const monat = vormonat(ctx);
      // V04 zuerst: sein Referenzwert ist der, den M54 storniert (referenzwertVon liefert den ersten).
      const refs = LEHRLINGE.slice()
        .reverse()
        .map((l) => ({ ...l, refw: ctx.referenzwert(`M52-${l.vorlauf}`) }));
      const eintraege = refs
        .slice()
        .reverse()
        .map((l) => lehrlingsMbgm(ctx, l));
      return paketA14(ctx, 'M52', eintraege, { monat, referenzwerte: refs.map((l) => l.refw) });
    },
  }),
  negativ('M60', {
    titel: 'mBGM-Negativ: Paketreferenzwert leer',
    code: 'F9000',
    zweck: 'REFP im Paketsatz PS in Grundstellung.',
    aendere: (inhalt) => setzeFeld(inhalt, 2, feld(FELDER_PAKET, 'REFP'), ''),
  }),
  negativ('M61', {
    titel: 'mBGM-Negativ: Beitragszeitraum vor 2019',
    code: 'F9040',
    zweck: 'BZRM 12/2018 – fachlich gültig sind Zeiträume ab 01.01.2019.',
    aendere: (inhalt) => setzeFeld(inhalt, 2, feld(FELDER_PAKET, 'BZRM'), '122018'),
  }),
  negativ('M62', {
    titel: 'mBGM-Negativ: Gesamtsumme um 1 Cent zu hoch',
    code: 'F9051',
    zweck: 'GSUM ungleich der Summe der VSUM.',
    aendere: (inhalt) => {
      const f = feld(FELDER_PAKET, 'GSUM');
      const neu = String(Number(lies(inhalt, 2, f)) + 1).padStart(f.laenge, '0');
      return setzeFeld(inhalt, 2, f, neu);
    },
  }),
  negativ('M63', {
    titel: 'mBGM-Negativ: Ende-Satz PE fehlt',
    code: 'F9070',
    zweck:
      'Aufbau nach E.32.2.2.6 verletzt: PE weggelassen, die Satzanzahl im Schlusssatz um 1 verringert, ' +
      'damit nur der Paketaufbau falsch ist.',
    aendere: (inhalt) => {
      const saetze = inhalt.toString('latin1').split('\r\n');
      const pe = saetze.findIndex((s) => s.startsWith('PE'));
      const ohne = ersetzeSatz(inhalt, pe + 1, null);
      const letzter = ohne.toString('latin1').split('\r\n').length;
      const alt = Number(lies(ohne, letzter, SANZ));
      return setzeFeld(ohne, letzter, SANZ, String(alt - 1).padStart(SANZ.laenge, '0'));
    },
  }),
  negativ('M64', {
    titel: 'mBGM-Negativ: JAGB ungültig',
    code: 'F9031',
    zweck: "JAGB 'X' statt J/N.",
    aendere: (inhalt) => setzeFeld(inhalt, 2, feld(FELDER_PAKET, 'JAGB'), 'X'),
  }),
  negativ('M65', {
    titel: 'mBGM-Negativ: Beitragskontonummer leer',
    code: 'F9010',
    zweck: 'BKNR im Paketsatz PS in Grundstellung.',
    aendere: (inhalt) => setzeFeld(inhalt, 2, feld(FELDER_PAKET, 'BKNR'), ''),
  }),
  fall({
    id: 'M66',
    titel: 'mBGM-Paket mit zwei Meldungen, eine mit ungültiger VSNR-Struktur',
    zweck:
      'Wird bei einem Fehler in EINER mBGM das ganze Paket abgewiesen oder nur diese Meldung ' +
      '(teilweise_uebernommen wie S60 bei VR)? Zweite Meldung: VSNR mit Monat 20 (D.6 lässt 01–15 zu).',
    quelle: 'E.32.2.2.6; D.6; Mitteilungs-Schema 3.0 (teilweise_uebernommen); SIT S60, M42',
    erwartung: 'nicht übernommen oder teilweise übernommen – Code für die VSNR?',
    fenster: DI_VM,
    abhaengig: ['V01'],
    rang: 26,
    baue: (ctx) => {
      const r1 = ctx.referenzwert('M66-1');
      const r2 = ctx.referenzwert('M66-2');
      const b = paketA14(ctx, 'M66', [arbeiterMbgm(ctx, r1), arbeiterMbgm(ctx, r2, 'reserve_3')], {
        monat: vormonat(ctx),
        referenzwerte: [r1, r2],
      });
      // Das zweite G1 der Datei ist die mBGM von reserve_3.
      const saetze = b.inhalt.toString('latin1').split('\r\n');
      const nr = saetze.findIndex((z, i) => z.startsWith('G1') && saetze.slice(0, i).some((y) => y.startsWith('G1'))) + 1;
      const f = feld(FELDER_MBGM, 'VSNR');
      const vsnr = lies(b.inhalt, nr, f);
      return { ...b, inhalt: setzeFeld(b.inhalt, nr, f, `${vsnr.slice(0, 6)}20${vsnr.slice(8)}`) };
    },
  }),
  fall({
    id: 'M54',
    titel: 'Storno der mBGM 02/2025 von V04 aus M52',
    zweck:
      'Erstes mBGM-Storno überhaupt: R1 mit REFU = Referenzwert der ursprünglichen Meldung und ' +
      'VSUM = deren Beitragssumme. Selbstabrechnung: Änderung immer als Storno + neue mBGM.',
    quelle: 'E.32.2.8 (Storno, Beispiel 14), E.32.2.2.2 (Grundsätze Storno), ÖGK-FAK 3.2.7',
    erwartung: 'übernommen; Clearing ohne Fehler (Rückverrechnung)',
    fenster: DI_NM,
    abhaengig: ['M52'],
    rang: 30,
    baue: (ctx) => {
      const refw = ctx.referenzwert('M54-1');
      const v04 = LEHRLINGE[1];
      const storno = {
        referenzwert: refw,
        referenzUrspruenglicheMeldung: ctx.referenzwertVon('M52'),
        versicherungsnummer: ctx.rolle(v04.rolle).vsnr,
        summeCent: vsumLehrling(ctx, v04.basis),
      };
      return paketA14(ctx, 'M54', [storno], { monat: '2025-02', referenzwerte: [refw] });
    },
  }),
  fall({
    id: 'M55',
    titel: 'Neumeldung der mBGM 02/2025 von V04 mit geänderter Basis',
    zweck: 'Nach dem Storno M54 die neue mBGM mit 1.000 € statt 950 €. Wird sie verbucht?',
    quelle: 'E.32.2.8, E.32.2.2.2',
    erwartung: 'übernommen; Clearing ggf. BW1850 (Sätze 2025 unbelegt), kein Fehler zur Zuordnung',
    fenster: DI_NM,
    abhaengig: ['M54'],
    rang: 35,
    baue: (ctx) => {
      const refw = ctx.referenzwert('M55-1');
      const v04 = LEHRLINGE[1];
      return paketA14(ctx, 'M55', [lehrlingsMbgm(ctx, { ...v04, refw, basis: 100_000 })], {
        monat: '2025-02',
        referenzwerte: [refw],
      });
    },
  }),
  fall({
    id: 'V84',
    titel: 'B9: Familienname mit ş als UTF-8-Bytes am Builder vorbei (M3)',
    zweck: 'Gegenstück zu V54 (Vorname → F7038 als Fehler). Kommt beim Familiennamen F7036?',
    quelle: 'Zeichensatz-Dokument; Prüfkatalog Blatt VR (F7036, F7038); SIT V54',
    erwartung: 'nicht übernommen, F7036',
    fenster: DI_VM,
    baue: (ctx) => {
      const b = anmeldungOhneVsnr(ctx, 'V84', { FANA: 'Karatas', VONA: 'Mirela', GEBD: '14021996' });
      return { ...b, inhalt: setzeFeld(b.inhalt, 2, feld(FELDER_E29, 'FANA'), 'KarataÅ\u009f') };
    },
  }),
  fall({
    id: 'B13',
    titel: 'Anmeldung mit der Datenträgernummer einer schon gesendeten Datei',
    zweck:
      'Andere Datei, gleiche Datenträgernummer (DTNR im Vorlaufsatz) wie V40. T02 (byte-gleich, also auch ' +
      'gleiche DTNR) wurde angenommen – prüft, ob ELDA die DTNR überhaupt auswertet.',
    quelle: 'E.2 Vorlaufsatz (DTNR); SIT T02',
    erwartung: 'übernommen (DTNR wird nicht geprüft) – oder ein E-Code',
    fenster: DI_VM,
    abhaengig: ['V40'],
    baue: (ctx) => {
      const b = anmeldungOhneVsnr(ctx, 'B13', { FANA: 'Nadler', VONA: 'Livia', GEBD: '07071994' });
      const dtnr = { name: 'DTNR', pos: 25, laenge: 6 };
      const alt = lies(ctx.bestandVon('V40').inhalt, 1, dtnr);
      return { ...b, inhalt: setzeFeld(b.inhalt, 1, dtnr, alt) };
    },
  }),
];
