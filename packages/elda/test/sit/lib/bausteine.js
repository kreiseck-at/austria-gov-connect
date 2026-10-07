'use strict';

const { kasseneck } = require('./kasseneck');

// Bausteine für die Fälle der Versichertenmeldung: ein Satz für eine Rolle bei
// einem Dienstgeberkonto, als fertiger Bestand. Die Fachprüfung macht das
// Paket – lehnt ein Builder einen Fall ab, ist das ein Befund über unsere
// Lesart, nicht etwas, das hier umgangen wird.

/** Satzarten, bei denen Familien- und Vorname laut E.29.1 zwingend sind (sonst Grundstellung). */
const MIT_NAMEN = new Set(['anmeldung', 'abmeldung', 'aenderungsmeldung']);

/**
 * @param ctx Kontext aus `baueKontext`
 * @param a.fall Fall-ID (für Referenzwert und Dateiname)
 * @param a.art Builder des Pakets: anmeldung, abmeldung, aenderungsmeldung,
 *   richtigstellungAnmeldung, richtigstellungAbmeldung, stornoAnmeldung, stornoAbmeldung
 * @param a.rolle, a.dg, a.traeger, a.freieDN wer, bei welchem Konto
 * @param a.felder übrige Felder des Satzes
 * @param a.optionen Abweichungen der Bestandsoptionen (z. B. testdaten, erstellt)
 */
function meldung(ctx, { fall, art, rolle, dg, traeger, freieDN = false, felder, optionen = {} }) {
  const bauer = ctx.elda[art];
  if (typeof bauer !== 'function') throw new Error(`Unbekannte Satzart-Funktion '${art}'.`);
  const person = ctx.rolle(rolle);
  const konto = ctx.konto(dg, { traeger, freieDN });
  const refw = ctx.referenzwert(fall);
  const satz = bauer({
    REFW: refw,
    BKNR: konto.bknr,
    DGNA: ctx.dienstgeber(dg).name,
    VSNR: person.vsnr,
    ...(MIT_NAMEN.has(art) ? { FANA: person.familienname, VONA: person.vorname } : {}),
    ...felder,
  });
  return {
    inhalt: ctx.elda.erstelleBestand([satz], ctx.bestandOptionen({ dg, traeger, ...optionen })),
    dateiName: ctx.dateiName(fall),
    referenzwerte: [refw],
  };
}

/**
 * Ein mBGM-Paket für EIN Beitragskonto und EINEN Beitragszeitraum, gerechnet
 * mit der Lohnlogik von kasseneck (Abrechnung → `baueMeldung`), gebaut und
 * geprüft mit diesem Paket. Ein einziger Prüfbefund (`pruefeAbfolge`,
 * `pruefeMbgmPaket`) bricht ab – gesendet wird nur, was kasseneck auch senden
 * würde. Das Paket muss alle im Monat Beschäftigten des Kontos enthalten.
 *
 * @param a.monat Beitragszeitraum als JJJJ-MM
 * @param a.bundesland für die Abrechnung (Dienstgeberabgaben)
 * @param a.beschaeftigte [{ rolle, mitarbeiter }] – `mitarbeiter` in der
 *   Eingabeform von kasseneck (dienstnehmerGruppe, eintritt, wochenstunden, …);
 *   Name und Versicherungsnummer kommen aus den Testdaten der Rolle.
 */
function mbgmPaket(ctx, { fall, dg, traeger, monat, bundesland, beschaeftigte, optionen = {} }) {
  const k = kasseneck();
  const parameter = k.ladeParameter(Number(monat.slice(0, 4)));
  const konto = ctx.konto(dg, { traeger });
  const referenzwerte = [];
  const eintraege = beschaeftigte.map(({ rolle, mitarbeiter }, i) => {
    const person = ctx.rolle(rolle);
    const abrechnung = k.erstelleAbrechnung({
      mitarbeiter: { id: rolle, austritt: null, salaryType: 'monthly', ...mitarbeiter },
      monat,
      parameter,
      bundesland,
      sonderzahlungKontext: null,
    });
    if (abrechnung.meta?.fehler) {
      throw new Error(
        `kasseneck rechnet ${rolle} für ${monat} nicht: ${JSON.stringify(abrechnung.meta.fehler)}`,
      );
    }
    const refw = ctx.referenzwert(`${fall}-${i + 1}`);
    referenzwerte.push(refw);
    return k.mbgm.baueMeldung({
      abrechnung,
      mitarbeiter: {
        versicherungsnummer: person.vsnr,
        familienname: person.familienname,
        vorname: person.vorname,
        lehrlingsArt: mitarbeiter.lehrlingsArt,
      },
      referenzwert: refw,
    });
  });
  const paketref = ctx.referenzwert(fall);
  const saetze = ctx.elda.erstelleMbgmPaket(
    eintraege,
    k.mbgm.bauePaketOptionen({
      elda: { beitragskontonummer: konto.bknr },
      dienstgebername: ctx.dienstgeber(dg).name,
      beitragszeitraum: `${monat.slice(5, 7)}${monat.slice(0, 4)}`,
      paketreferenzwert: paketref,
      // Die Testbetriebe der SIT sind Selbstabrechner (Stammdaten-Basispaket).
      abrechnungsartFuer: () => 'selbstabrechnung',
    }),
  );
  const befunde = [...ctx.elda.pruefeAbfolge(saetze), ...ctx.elda.pruefeMbgmPaket(saetze)];
  if (befunde.length > 0) {
    throw new Error(`mBGM-Paket ${fall} hat Befunde: ${JSON.stringify(befunde).slice(0, 500)}`);
  }
  return {
    inhalt: ctx.elda.erstelleMbgmBestand(saetze, ctx.bestandOptionen({ dg, traeger, ...optionen })),
    dateiName: ctx.dateiName(fall),
    referenzwerte: [paketref, ...referenzwerte],
  };
}

/** Geschlecht der Testdaten (m, w, x) als Code laut Kapitel E.12, Feld GESL. */
const GESL = { m: '1', w: '2', x: '3' };

/**
 * Ein gebauter Satz mit geänderten Werten – NUR für Negativtests. Der Builder
 * des Pakets hat den Satz vorher vollständig geprüft; geändert wird danach
 * genau das, was ELDA abweisen soll. Der Bestandsbau prüft nicht noch einmal.
 */
function abgewandelt(satz, aenderungen) {
  return Object.freeze({ ...satz, werte: Object.freeze({ ...satz.werte, ...aenderungen }) });
}

/**
 * Eine Meldung Familienhospizkarenz/Pflegekarenz (E.12) für eine Rolle, als
 * fertiger Bestand FH. Bei der Anmeldung (80) kommen Geschlecht und
 * Staatsangehörigkeit dazu – die Staatsangehörigkeit aus der Rolle
 * (`staatsangehoerigkeit`) oder `AUT`; eine Wohnanschrift nur, wenn die Rolle
 * eine `anschrift` hat (der Prüfkatalog warnt bei fehlender nur).
 *
 * @param a.art Builder des Pakets, z. B. familienhospizAnmeldung
 * @param a.felder übrige Felder (ADAT, KART, …)
 * @param a.aendern Werte, die NACH der Prüfung gesetzt werden (Negativtest)
 */
function familienhospiz(ctx, { fall, art, rolle, dg, traeger, felder, aendern }) {
  const bauer = ctx.elda[art];
  if (typeof bauer !== 'function') throw new Error(`Unbekannte Satzart-Funktion '${art}'.`);
  const person = ctx.rolle(rolle);
  const konto = ctx.konto(dg, { traeger });
  const refn = ctx.referenzwert(fall);
  const anmeldung = art === 'familienhospizAnmeldung';
  const anschrift = person.anschrift;
  let satz = bauer({
    BKNR: konto.bknr,
    DGNA: ctx.dienstgeber(dg).name,
    VSNR: person.vsnr,
    FANA: person.familienname,
    VONA: person.vorname,
    ...(anmeldung
      ? {
          GESL: GESL[person.geschlecht],
          STSL: person.staatsangehoerigkeit ?? 'AUT',
          ...(anschrift
            ? { WKFZ: anschrift.kfz, PLZL: anschrift.plz, WORT: anschrift.ort, STRA: anschrift.strasse }
            : {}),
        }
      : {}),
    REFN: refn,
    ...felder,
  });
  if (aendern) satz = abgewandelt(satz, aendern);
  return {
    inhalt: ctx.elda.erstelleFamilienhospizBestand([satz], ctx.bestandOptionen({ dg, traeger })),
    dateiName: ctx.dateiName(fall),
    referenzwerte: [refn],
  };
}

/**
 * Eine Schwerarbeitsmeldung (E.22) für eine Rolle, als fertiger Bestand SM.
 * Die Anschrift des Dienstgebers kommt aus den Testdaten.
 *
 * @param a.art schwerarbeitsmeldung oder stornoSchwerarbeitsmeldung
 * @param a.jahr Tätigkeitsjahr JJJJ
 * @param a.taetigkeiten [{ art, von, bis }]
 * @param a.aendern Werte, die NACH der Prüfung gesetzt werden (Negativtest)
 */
function schwerarbeit(ctx, { fall, art, rolle, dg, traeger, jahr, taetigkeiten, aendern }) {
  const bauer = ctx.elda[art];
  if (typeof bauer !== 'function') throw new Error(`Unbekannte Satzart-Funktion '${art}'.`);
  const person = ctx.rolle(rolle);
  const konto = ctx.konto(dg, { traeger });
  const d = ctx.dienstgeber(dg);
  const refn = ctx.referenzwert(fall);
  let satz = bauer({
    BKNR: konto.bknr,
    DGNA: d.name,
    DKFZ: d.anschrift.kfz,
    DPLZ: d.anschrift.plz,
    DORT: d.anschrift.ort,
    DSTR: d.anschrift.strasse,
    VSNR: person.vsnr,
    GEBD: person.geburtsdatum,
    FANA: person.familienname,
    VONA: person.vorname,
    JAHR: jahr,
    REFN: refn,
    taetigkeiten,
  });
  if (aendern) satz = abgewandelt(satz, aendern);
  return {
    inhalt: ctx.elda.erstelleSchwerarbeitBestand([satz], ctx.bestandOptionen({ dg, traeger })),
    dateiName: ctx.dateiName(fall),
    referenzwerte: [refn],
  };
}

/** Satztrenner CRLF → LF, sonst byte-gleich. */
function mitLf(inhalt) {
  return Buffer.from(inhalt.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
}

module.exports = { meldung, mbgmPaket, familienhospiz, schwerarbeit, abgewandelt, mitLf };
