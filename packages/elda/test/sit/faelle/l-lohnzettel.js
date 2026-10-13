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
const { kasseneckL16 } = require('../lib/kasseneck');
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
function bestand(ctx, id, aendere = (u) => u) {
  const u = aendere(uebermittlung(ctx, id));
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


/** Ein Lohnzettel für eine N1-Person (Konto A/15, März 2025, ein Monat 3.000 €, Werte wie L01 für einen Monat). */
function n1Lohnzettel(ctx, id, rolle, sozs) {
  const p = ctx.rolle(rolle);
  const jahr = Number(ctx.zrVon('V70').slice(0, 4));
  return {
    felder: {
      REFN: ctx.referenzwert(id).slice(0, 30),
      ARTL: '01',
      BELZ: '0103',
      ENLZ: '3103',
      SOZS: sozs,
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
    // Ein Monat: SV 18,07 % von 3.000 € = 542,10 €; KZ 245 = 3.000 − 542,10; Lohnsteuer wie L01 je Monat.
    betraege: { B210: 300_000, BIEB: 54_210, B230: 54_210, B245: 245_790, BIEL: 29_155, B260: 29_155 },
    _jahr: jahr,
  };
}

/** Ändert Felder bzw. Beträge des einen Lohnzettels der Übermittlung. */
const mit = (felder = {}, betraege = null, mehr = {}) => (u) => ({
  ...u,
  lohnzettel: [
    {
      ...u.lohnzettel[0],
      ...mehr,
      felder: { ...u.lohnzettel[0].felder, ...felder },
      betraege: betraege ?? u.lohnzettel[0].betraege,
    },
  ],
});

/** Gleiche Referenznummer wie der Lohnzettel aus `fallId` (Berichtigung/Storno, E.14 Feld KORR). */
const refnVon = (ctx, fallId) => ctx.referenzwertVon(fallId);

/**
 * L12: der L16, wie kasseneck ihn baut – `baueL16Uebermittlung` aus
 * `l16-elda-core.js` (Branch feature/l16-elda) auf synthetischen
 * Monatslohnzetteln in der Form von `lohnabrechnung-core` (Struktur wie im
 * kasseneck-Test `l16-elda-core.test.js`, Werte erfunden: zwei Monate je
 * 3.000 €, SV 542,10 €, Lohnsteuer 291,55 € wie L01).
 */
function kasseneckLohnzettel(ctx, id) {
  const k = kasseneckL16();
  const p = ctx.rolle('arbeiter');
  const jahr = Number(ctx.zrVon('V70').slice(0, 4));
  const iso = (ttmmjjjj) => `${ttmmjjjj.slice(4, 8)}-${ttmmjjjj.slice(2, 4)}-${ttmmjjjj.slice(0, 2)}`;
  const beleg = (monat) => ({
    id: monat,
    grundlagen: {
      dienstnehmerGruppe: 'arbeiter',
      eintritt: `${jahr}-02-01`,
      austritt: `${jahr}-03-31`,
      wochenstunden: 38.5,
      kvBasisStunden: 38.5,
    },
    brutto: {
      gesamtLaufend: 300_000,
      gesamtSZ: 0,
      sonderzahlung: { innerhalbSechstel: 0, ueberSechstel: 0 },
      ueberstunden: { steuerfreiTeil68: 0 },
    },
    sv: { dnLaufend: { betrag: 54_210 }, dnSZ: { betrag: 0 } },
    lst: {
      lstLaufend: 29_155,
      szBesteuerung: { lstSZ: 0, abs10RestCent: 0, ueberSechstel: { brutto: 0, svAnteil: 0 } },
      pendlerpauschale: { betrag: 0 },
      absetzbetraege: { avab: { angewendet: false }, familienbonus: { angewendet: false }, pendlereuro: { betrag: 0 } },
    },
    netto: {
      abzuege: [
        { art: 'sv_dn_laufend', betrag: 54_210 },
        { art: 'lst_laufend', betrag: 29_155 },
      ],
    },
  });
  const dg = ctx.dienstgeber('A');
  const { uebermittlung, hinweise } = k.baueL16Uebermittlung({
    payslips: [beleg(`${jahr}-02`), beleg(`${jahr}-03`)],
    jahr,
    employeeId: 'SIT-L12',
    mitarbeiter: {
      svnr: p.vsnr,
      vorname: p.vorname,
      nachname: p.familienname,
      strasse: 'Teststraße',
      hausnummer: '1',
      plz: '5020',
      ort: 'Salzburg',
      land: 'A',
      birthDate: iso(p.geburtsdatum),
    },
    betrieb: {
      name: dg.name,
      street: dg.anschrift.strasse,
      zip: dg.anschrift.plz,
      city: dg.anschrift.ort,
      steuernummer: '91-123/4565',
      land: 'A',
    },
    jahrAbgeschlossen: false,
  });
  const opt = ctx.bestandOptionen({ dg: 'A', traeger: '15' });
  const { versicherungstraeger: _vstr, ...lfOpt } = opt;
  const { befunde } = k.pruefeL16Uebermittlung(uebermittlung, { erstellt: lfOpt.erstellt, heute: lfOpt.erstellt });
  const n = befunde.filter((b) => b.status.startsWith('N'));
  if (n.length > 0) throw new Error(`${id}: kasseneck-L16 hat Befunde mit Status N: ${JSON.stringify(n)}`);
  return {
    inhalt: k.erstelleLohnzettelBestand(uebermittlung, lfOpt),
    dateiName: ctx.dateiName(id),
    referenzwerte: uebermittlung.lohnzettel.map((lz) => lz.felder.REFN),
    hinweise,
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
  fall({
    id: 'L03',
    titel: 'L16 wie L01 mit Korrekturindikation „A" (Anspruchsjahr)',
    zweck:
      'L01 kam mit Warnung 1706 „Uebermittlung ausserhalb des Aufrollungszeitraumes nicht zulaessig" (Katalog F1706: ' +
      'Jahr < laufendes Jahr, Eingang nach 30.04., Korrekturindikation ungleich „A"). Bewusste Probe: Fachlich ist „A" ' +
      'nur für Bezüge nach § 19 EStG gedacht (E.14 Feld KORR) – hier geht es nur darum, ob 1706 dann ausbleibt.',
    quelle: 'E.14 Feld 104 KORR (DM-Org 42, S. 228); Prüfkatalog L16 F1706, F9031 (A bei Art 01 zulässig)',
    erwartung: 'übernommen ohne 1706',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71'],
    rang: 42,
    baue: (ctx) => bestand(ctx, 'L03', mit({ KORR: 'A' })),
  }),
  fall({
    id: 'L04',
    titel: 'L16 wie L01 mit stark überhöhter Lohnsteuer (KZ 260 × 10)',
    zweck:
      'Rechnet ELDA auf der SIT das Normverhältnis (F7002/F7003, Rechenblatt)? KZ 260 bleibt mit den Vorfeldern ' +
      'stimmig (F7004). Das Rechenblatt für 2025 kennt das Paket nicht.',
    quelle: 'Prüfkatalog L16 F7002/F7003/F7004',
    erwartung: '7003 (Lohnsteuer zu hoch) als Hinweis – oder keine Reaktion',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71'],
    rang: 42,
    baue: (ctx) =>
      bestand(
        ctx,
        'L04',
        mit({}, { B210: 600_000, BIEB: 108_420, B230: 108_420, B245: 491_580, BIEL: 583_100, B260: 583_100 }),
      ),
  }),
  fall({
    id: 'L08',
    titel: 'Berichtigter Lohnzettel zu L01 (KORR „K", gleiche Referenznummer, geänderte Beträge)',
    zweck:
      'Erste Berichtigung über ELDA: gleiche Referenznummer, Jahr, Arbeitgeber, Arbeitnehmer und Lohnzettelart wie L01, ' +
      'Bruttobezüge 6.200 € statt 6.000 €. Beträge nach denselben Annahmen wie L01 neu gerechnet.',
    quelle: 'E.14 Feld 104 KORR („K" … Voraussetzung: gleiche Referenznummer …), DM-Org 42 S. 228',
    erwartung: 'übernommen (Warnung 1706 wie L01 möglich)',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71', 'L01'],
    rang: 43,
    baue: (ctx) =>
      bestand(
        ctx,
        'L08',
        mit(
          { KORR: 'K', REFN: refnVon(ctx, 'L01') },
          { B210: 620_000, BIEB: 112_034, B230: 112_034, B245: 507_966, BIEL: 63_225, B260: 63_225 },
        ),
      ),
  }),
  fall({
    id: 'L05',
    titel: 'Storno-Lohnzettel zu L01 (KORR „S", Kennzahlen unverändert)',
    zweck:
      'E.14 Feld KORR: „S" kennzeichnet einen Storno; es ist „nicht mehr notwendig alle Kennzahlen auf 0 zu setzen". ' +
      'D.31/D.32 beschreiben dagegen noch den Storno mit KZ 210 = 0, übrige Beträge leer und KORR „K". L05 prüft die ' +
      'Variante „S", L09 die alte Variante.',
    quelle: 'E.14 Feld 104 KORR (DM-Org 42, S. 228); D.31/D.32 (S. 109)',
    erwartung: 'übernommen',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71', 'L01', 'L08'],
    rang: 44,
    baue: (ctx) => bestand(ctx, 'L05', mit({ KORR: 'S', REFN: refnVon(ctx, 'L01') })),
  }),
  fall({
    id: 'L06',
    titel: 'L16 mit Kinderblock und Familienbonus Plus (ein Kind, Februar–März)',
    zweck:
      'Erster Kinderblock über ELDA: Kind 1 erfunden (prüfziffernrichtige VSNR), Familienbeihilfe-Bezieher, ganzer ' +
      'Familienbonus für zwei Monate (2 × 166,68 €), Lohnsteuer entsprechend vermindert. Eigene Referenznummer.',
    quelle: 'E.14 Kinderblock (Felder 196 ff.), Felder 142–146; Prüfkatalog L16 F9200 ff., KA00–KA63',
    erwartung: 'übernommen (ggf. Hinweise)',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71'],
    rang: 45,
    baue: (ctx) =>
      bestand(
        ctx,
        'L06',
        mit(
          { BFABO: 'J', KFABO: '1' },
          { B210: 600_000, BIEB: 108_420, B230: 108_420, B245: 491_580, FABO: 33_336, BIEL: 24_974, B260: 24_974 },
          {
            kinder: [
              {
                KFAM: 'Weinzierl',
                KVON: 'Livia',
                KSTAAT: 'A',
                KVSNR: '1235150315',
                KAFBZ: 'J',
                KBGFP: '02',
                KEGFP: '03',
              },
            ],
          },
        ),
      ),
  }),
  fall({
    id: 'L09',
    titel: 'Storno-Lohnzettel zu L06 nach D.31/D.32 (KZ 210 = 0, übrige Beträge leer, KORR „K")',
    zweck:
      'Die alte Storno-Form aus D.31/D.32 – widerspricht der Feldbeschreibung in E.14 („K" = Berichtigung, „S" = Storno). ' +
      'Welche Lesart nimmt ELDA?',
    quelle: 'D.31, D.32 (DM-Org 42, S. 109); E.14 Feld 104; Prüfkatalog F3602',
    erwartung: 'übernommen als Storno – oder Abweisung/Hinweis',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71', 'L06'],
    rang: 46,
    baue: (ctx) =>
      bestand(ctx, 'L09', mit({ KORR: 'K', REFN: refnVon(ctx, 'L06'), BFABO: undefined, KFABO: undefined }, { B210: 0 })),
  }),
  fall({
    id: 'L10',
    titel: 'Derselbe Lohnzettel wie L04 noch einmal (gleiche Referenznummer, ohne Korrekturindikation)',
    zweck:
      'Was macht ELDA mit einem doppelt gesendeten Lohnzettel? Der Katalog verlangt eine je Arbeitgeber, Jahr und ' +
      'Dienstverhältnis eindeutige Referenznummer (Feld 10); eine Berichtigung bräuchte „K". L04 wurde weder ' +
      'berichtigt noch storniert – L10 ist sein Duplikat in einem neuen Bestand.',
    quelle: 'Prüfkatalog L16 Feld 10 (Referenznummer); E.14 Feld 104 KORR',
    erwartung: 'Abweisung bzw. Hinweis wegen doppelter Referenznummer – oder übernommen (dann erkennt ELDA es nicht)',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71', 'L04'],
    rang: 47,
    baue: (ctx) =>
      bestand(
        ctx,
        'L10',
        mit(
          { REFN: refnVon(ctx, 'L04') },
          { B210: 600_000, BIEB: 108_420, B230: 108_420, B245: 491_580, BIEL: 583_100, B260: 583_100 },
        ),
      ),
  }),
  fall({
    id: 'L11',
    titel: 'Ein Bestand mit zwei Lohnzetteln (zwei L1 unter einem I1, GESA 2)',
    zweck:
      'So würde kasseneck die Lohnzettel eines Betriebs senden: mehrere Dienstnehmer in einer Datei. Zwei N1-Personen ' +
      'auf A/15 (01.03.–31.03.2025, Abmeldungen V73/V75). Kommt „LF 2/2"? Codes je Zeile?',
    quelle: 'E.13 (GESA), E.14; B.3 (LF)',
    erwartung: 'übernommen, LF 2/2 (Warnung 1706 je Lohnzettel möglich)',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V72', 'V73', 'V74', 'V75'],
    rang: 48,
    baue: (ctx) => {
      const a = n1Lohnzettel(ctx, 'L11-1', 'arbeiterlehrling', '2');
      const b = n1Lohnzettel(ctx, 'L11-2', 'angestelltenlehrling', '3');
      const basis = uebermittlung(ctx, 'L11');
      const u = {
        ...basis,
        arbeitgeber: { ...basis.arbeitgeber, GESA: 2 },
        lohnzettel: [a, b].map(({ _jahr, ...lz }) => lz),
      };
      const opt = ctx.bestandOptionen({ dg: 'A', traeger: '15' });
      const { versicherungstraeger: _vstr, ...lfOpt } = opt;
      const saetze = ctx.elda.lohnzettelSaetze(u, lfOpt.erstellt);
      const befunde = ctx.elda
        .pruefeLohnzettel(saetze, '28', { heute: lfOpt.erstellt })
        .filter((x) => x.status.startsWith('N'));
      if (befunde.length > 0) throw new Error(`L16 L11 hat Befunde mit Status N: ${JSON.stringify(befunde)}`);
      return {
        inhalt: ctx.elda.erstelleLohnzettelBestand(u, lfOpt),
        dateiName: ctx.dateiName('L11'),
        referenzwerte: u.lohnzettel.map((lz) => lz.felder.REFN),
      };
    },
  }),
  fall({
    id: 'L12',
    titel: 'L16 2025 für den Arbeiter aus V70/V71, gebaut von kasseneck (l16-elda-core)',
    zweck:
      'Derselbe Dienstnehmer wie L01, aber der Satz stammt aus dem Produkt: kasseneck baut aus seinen ' +
      'Monatslohnzetteln (synthetisch) die Übermittlung (Kennzahlen, soziale Stellung, Voll-/Teilzeit, ' +
      'Referenznummer), prüft sie mit dem Paket und schreibt den Bestand. Klärt, ob der kasseneck-L16 ' +
      'auf der SIT so durchgeht wie L01.',
    quelle: 'kasseneck feature/l16-elda: functions-lohn/l16-elda-core.js; E.13/E.14 (Version 28); SIT L01',
    erwartung: 'übernommen mit W 1706 (Lohnzettel 2025 nach dem 30.04.2026)',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V70', 'V71'],
    braucht: 'kasseneck-l16',
    rang: 49,
    baue: (ctx) => kasseneckLohnzettel(ctx, 'L12'),
  }),
];
