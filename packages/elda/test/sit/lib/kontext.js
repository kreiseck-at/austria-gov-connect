'use strict';

// Der Kontext, den jeder Testfall beim Bauen bekommt: simuliertes Datum,
// Testdaten über Rollen, eindeutige Referenzwerte und der Zugriff auf frühere
// Läufe derselben Woche (Referenzwert, Protokollnummer, Bestand). Ein Fall
// rechnet damit nichts selbst aus, was das Werkzeug wissen muss.

const fs = require('node:fs');
const path = require('node:path');
const { zrDatum, ttmmjjjj, simuliertesErstellt, wienerZeit, wocheVon } = require('./fenster');
const { setzeObusEin } = require('./maskierung');

/** JJMMTTHHMMSS nach Wiener Uhr – kurz genug für Referenzwerte und Dateinamen. */
function stempelVon(jetzt) {
  const w = wienerZeit(jetzt);
  return (w.datum.slice(2) + w.zeit).replace(/[-:]/g, '');
}

/**
 * @param a.seriennummer Seriennummer zum Datensammelsystem (OBUS) – aus dem
 *   Schlüsselbund, nie aus einer Datei. Ohne sie lässt sich kein Bestand bauen.
 */
function baueKontext({
  fenster,
  testdaten,
  ereignisse,
  jetzt = new Date(),
  elda,
  ablage,
  softwareId,
  seriennummer,
}) {
  const zr = zrDatum(fenster);
  const woche = wocheVon(jetzt);
  const stempel = stempelVon(jetzt);
  const erstellt = simuliertesErstellt(fenster, jetzt);

  const erfolgreich = ereignisse.filter(
    (e) => e.art === 'lauf' && e.statusCode === '000' && wocheVon(new Date(e.zeit)) === woche,
  );
  function letzterErfolg(fallId) {
    const lauf = erfolgreich.filter((e) => e.fall === fallId).at(-1);
    if (!lauf) {
      throw new Error(
        `${fallId} ist in dieser Woche noch nicht erfolgreich gelaufen – zuerst ${fallId} senden.`,
      );
    }
    return lauf;
  }

  let referenzZaehler = 0;
  let datentraeger = ereignisse.filter((e) => e.art === 'lauf' && e.aktion === 'senden').length;

  return Object.freeze({
    fenster,
    zr,
    jetzt,
    erstellt,
    elda,
    ttmmjjjj,
    rolle: (name) => testdaten.rolle(name),
    konto: (dg, wahl) => testdaten.konto(dg, wahl),
    dienstgeber: (dg) => testdaten.dienstgeber(dg),

    referenzwert(fallId) {
      referenzZaehler += 1;
      return `SIT-${fallId}-${stempel}${referenzZaehler > 1 ? `-${referenzZaehler}` : ''}`;
    },
    referenzwertVon(fallId) {
      const wert = letzterErfolg(fallId).referenzwerte?.[0];
      if (!wert) throw new Error(`${fallId} hat keinen Referenzwert protokolliert.`);
      return wert;
    },
    /** Protokollnummer der zuletzt abgeholten Rücksendung (für den Test „nochmal abholen“). */
    letzteRuecksendung() {
      const r = ereignisse.filter((e) => e.art === 'ruecksendung' && !e.ausFehler).at(-1);
      if (!r) throw new Error('Noch keine Rücksendung abgeholt – erst `abholen --ja`.');
      return r.protokollnummer;
    },
    protokollnummerVon(fallId) {
      return letzterErfolg(fallId).protokollnummer;
    },
    /** Simuliertes Datum, an dem der Vorlauf tatsächlich gelaufen ist – Folgemeldungen rechnen damit. */
    zrVon(fallId) {
      const zr = letzterErfolg(fallId).zr;
      if (!zr) throw new Error(`${fallId} hat kein simuliertes Datum protokolliert.`);
      return zr;
    },
    bestandVon(fallId) {
      const lauf = letzterErfolg(fallId);
      const datei = path.join(ablage.basis, 'laeufe', lauf.ordner, 'bestand.dat');
      // Gespeichert ist der Bestand mit maskiertem OBUS – für ein Duplikat wieder byte-gleich machen.
      return { dateiName: lauf.dateiName, inhalt: setzeObusEin(fs.readFileSync(datei), seriennummer) };
    },

    bestandOptionen({ dg, traeger, testdaten: alsTest = true, erstellt: anderer } = {}) {
      if (!seriennummer) throw new Error('Seriennummer fehlt – ELDA_SIT_SERIENNUMMER setzen.');
      datentraeger += 1;
      return {
        seriennummer,
        versicherungstraeger: traeger,
        datentraegernummer: String(datentraeger).padStart(6, '0'),
        erstellt: anderer ?? erstellt,
        testdaten: alsTest,
        hersteller: { ...testdaten.hersteller(dg), ...(softwareId ? { softwareId } : {}) },
      };
    },
    dateiName: (fallId) => `sit-${fallId}-${stempel}.dat`,
  });
}

module.exports = { baueKontext };
