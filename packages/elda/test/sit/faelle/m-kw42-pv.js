'use strict';

// Nachschlag Di 13.10. nachmittags:
//
// M57: eine mBGM im Vorschreibeverfahren (Paketkopf PV, mBGM G2, Basis BV,
//      Position V2) auf einem Konto, das auf der SIT als Selbstabrechner
//      geführt wird (A/14). Welcher Code kommt, wenn das Verfahren nicht zum
//      Konto passt – formal in der Mitteilung oder erst im Clearing?
//      Person: reserve_3 (V76, Eintritt 01.03.2025 auf A/14; V77 meldet zum
//      31.03.2025 ab), also ein Dienstverhältnis im Beitragszeitraum 03/2025.
// S14: eine VSNR-Anforderung für eine Testperson, die schon eine VSNR hat.
//      E.30.2: Anforderung nur, wenn noch keine VSNR vergeben ist. Weist ELDA
//      sie ab, oder kommt die bestehende VSNR im Clearing zurück?

const fall = (mehr) => ({ gefahr: null, abhaengig: [], aktion: 'senden', ...mehr });

/** 01. des Monats vor dem simulierten Datum, als JJJJ-MM. */
function vormonat(ctx) {
  const [j, m] = ctx.zr.split('-').map(Number);
  return new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 7);
}

module.exports = [
  fall({
    id: 'M57',
    titel: 'mBGM im Vorschreibeverfahren (PV) auf einem Selbstabrechner-Konto',
    zweck:
      'Das Konto A/14 ist auf der SIT ein Selbstabrechner-Konto. Eine mBGM mit Paketkopf PV (Vorschreibung) ' +
      'prüft, welcher Code kommt, wenn das Verfahren nicht zum Konto passt – formal oder im Clearing.',
    quelle: 'E.32.2.9 (Vorschreibung – regelmäßige Beschäftigung), D.59; Prüfkatalog Blatt mBGM Paket',
    erwartung: 'offen: Abweisung mit einem F-Code, oder übernommen und ein Clearingfall zum Verfahren',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    abhaengig: ['V76'],
    rang: 51,
    baue: (ctx) => {
      const konto = ctx.konto('A', { traeger: '14' });
      const bzr = vormonat(ctx);
      const p = ctx.rolle('reserve_3');
      const refw = ctx.referenzwert('M57-1');
      const paketref = ctx.referenzwert('M57');
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
                // Beim Vorschreiber der unbegrenzte Wert (D.59); Prozentsatz und
                // Beitrag schreibt das Paket im Verfahren Vorschreibung nicht.
                basen: [
                  {
                    typ: 'AB',
                    betragCent: 300_000,
                    positionen: [{ typ: 'T01', prozentsatz: 0, betragCent: 0 }],
                  },
                ],
              },
            ],
          },
        ],
        {
          verfahren: 'vorschreibung',
          paketreferenzwert: paketref,
          beitragskontonummer: konto.bknr,
          dienstgebername: ctx.dienstgeber('A').name,
          beitragszeitraum: `${bzr.slice(5, 7)}${bzr.slice(0, 4)}`,
          jaehrlicheAbrechnungGeringfuegiger: false,
        },
      );
      const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)].filter(
        (b) => b.schwere === 'fehler',
      );
      if (befunde.length > 0)
        throw new Error(`mBGM-Paket M57 hat Befunde: ${JSON.stringify(befunde).slice(0, 300)}`);
      return {
        inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg: 'A', traeger: '14' })),
        dateiName: ctx.dateiName('M57'),
        referenzwerte: [paketref, refw],
      };
    },
  }),
  fall({
    id: 'S14',
    titel: 'VSNR-Anforderung für eine Person, die schon eine VSNR hat (VS)',
    zweck:
      'E.30.2: Eine VSNR ist nur anzufordern, wenn noch keine vergeben ist. Hier die Daten der SIT-Testperson ' +
      '`arbeiter` (Name, Geburtsdatum, Geschlecht). Weist ELDA ab, oder liefert das Clearing die bestehende VSNR?',
    quelle: 'E.30, E.30.2; Prüfkatalog Blatt VS',
    erwartung:
      'offen: übernommen und Clearing mit der bestehenden VSNR, oder ein Code „Person bereits vorhanden"',
    fenster: ['di-nm', 'mi-vm', 'mi-nm'],
    rang: 52,
    baue: (ctx) => {
      const konto = ctx.konto('A', { traeger: '14' });
      const betrieb = ctx.dienstgeber('A');
      const p = ctx.rolle('arbeiter');
      const gesl = { m: '1', w: '2' }[p.geschlecht];
      if (!gesl) throw new Error(`S14: Geschlecht '${p.geschlecht}' der Testperson nicht zugeordnet.`);
      const refw = ctx.referenzwert('S14');
      const satz = ctx.elda.vsnrAnforderung({
        REFW: refw,
        BKNR: konto.bknr,
        DGNA: betrieb.name,
        FANA: p.familienname,
        VONA: p.vorname,
        GEBD: p.geburtsdatum,
        GESL: gesl,
        STSL: 'AUT',
        WKFZ: betrieb.anschrift.kfz,
        PLZL: betrieb.anschrift.plz,
        WORT: betrieb.anschrift.ort,
        WSTR: betrieb.anschrift.strasse,
      });
      return {
        inhalt: ctx.elda.erstelleVsnrAnforderungBestand(
          [satz],
          ctx.bestandOptionen({ dg: 'A', traeger: '14' }),
        ),
        dateiName: ctx.dateiName('S14'),
        referenzwerte: [refw],
      };
    },
  }),
];
