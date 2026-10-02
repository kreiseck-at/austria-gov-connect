'use strict';

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

/** Satztrenner CRLF → LF, sonst byte-gleich. */
function mitLf(inhalt) {
  return Buffer.from(inhalt.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
}

module.exports = { meldung, mitLf };
