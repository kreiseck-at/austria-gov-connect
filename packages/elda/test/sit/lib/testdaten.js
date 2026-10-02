'use strict';

// Testdaten des Stammdaten-Basispakets der SIT-Plattform.
//
// Die echten Werte stehen nur in `testdaten.local.json` (gitignoriert); im Code
// stehen Rollen. Welche Testperson welche Rolle spielt, entscheidet allein die
// lokale Datei. `testdaten.beispiel.json` zeigt die Form mit erfundenen Werten.

const fs = require('node:fs');

const ROLLEN = Object.freeze([
  'arbeiter',
  'angestellte',
  'arbeiterlehrling',
  'angestelltenlehrling',
  'geringfuegig',
  'freier_dn',
  'reserve_1',
  'reserve_2',
  'reserve_3',
]);

function verlange(bedingung, text) {
  if (!bedingung) throw new Error(`Testdaten: ${text}`);
}

const nichtLeer = (w) => typeof w === 'string' && w.trim() !== '';

function pruefeTestdaten(roh) {
  verlange(roh && typeof roh === 'object', 'kein Objekt');
  verlange(
    roh.seriennummer === undefined,
    'die Seriennummer gehört nicht in die Testdaten, sondern in den Schlüsselbund (ELDA_SIT_SERIENNUMMER)',
  );
  verlange(nichtLeer(roh.kontaktMail), 'kontaktMail fehlt');
  verlange(roh.dienstgeber && Object.keys(roh.dienstgeber).length > 0, 'dienstgeber fehlen');

  for (const [dg, d] of Object.entries(roh.dienstgeber)) {
    verlange(nichtLeer(d.name), `Dienstgeber ${dg}: name fehlt`);
    for (const f of ['kfz', 'plz', 'ort', 'strasse']) {
      verlange(nichtLeer(d.anschrift?.[f]), `Dienstgeber ${dg}: anschrift.${f} fehlt`);
    }
    verlange(Array.isArray(d.konten) && d.konten.length > 0, `Dienstgeber ${dg}: konten fehlen`);
    d.konten.forEach((k, i) => {
      verlange(
        /^\d{2}$/.test(k.traeger ?? ''),
        `Dienstgeber ${dg}, Konto ${i + 1}: traeger muss zweistellig sein`,
      );
      verlange(
        /^\d{6,10}$/.test(k.bknr ?? ''),
        `Dienstgeber ${dg}, Konto ${i + 1}: bknr muss 6 bis 10 Ziffern haben`,
      );
      verlange(
        typeof k.freieDN === 'boolean',
        `Dienstgeber ${dg}, Konto ${i + 1}: freieDN muss true/false sein`,
      );
    });
  }

  for (const rolle of ROLLEN) {
    const p = roh.rollen?.[rolle];
    verlange(p, `Rolle '${rolle}' fehlt`);
    verlange(nichtLeer(p.familienname), `Rolle ${rolle}: familienname fehlt`);
    verlange(nichtLeer(p.vorname), `Rolle ${rolle}: vorname fehlt`);
    verlange(/^\d{8}$/.test(p.geburtsdatum ?? ''), `Rolle ${rolle}: geburtsdatum muss TTMMJJJJ sein`);
    verlange(['m', 'w', 'x'].includes(p.geschlecht), `Rolle ${rolle}: geschlecht muss m, w oder x sein`);
    verlange(/^\d{10}$/.test(p.vsnr ?? ''), `Rolle ${rolle}: vsnr muss zehnstellig sein`);
  }

  function dienstgeber(dg) {
    const d = roh.dienstgeber[dg];
    if (!d) throw new Error(`Testdaten: Dienstgeber '${dg}' gibt es nicht.`);
    return d;
  }

  return Object.freeze({
    dienstgeber,
    rolle(name) {
      const p = roh.rollen?.[name];
      if (!p) throw new Error(`Testdaten: Rolle '${name}' gibt es nicht.`);
      return { ...p };
    },
    konto(dg, { traeger, freieDN = false } = {}) {
      const treffer = dienstgeber(dg).konten.filter((k) => k.traeger === traeger && k.freieDN === freieDN);
      if (treffer.length === 0) {
        throw new Error(
          `Testdaten: kein Konto für Dienstgeber ${dg}, Träger ${traeger}, freie DN ${freieDN}.`,
        );
      }
      if (treffer.length > 1)
        throw new Error(`Testdaten: Konto für Dienstgeber ${dg}, Träger ${traeger} ist mehrdeutig.`);
      return { ...treffer[0] };
    },
    /** Vorlaufsatz: die übermittelnde Stelle – wie in kasseneck der Dienstgeber selbst. */
    hersteller(dg) {
      const d = dienstgeber(dg);
      return { name: d.name, ...d.anschrift, mail: roh.kontaktMail };
    },
  });
}

function ladeTestdaten(pfad) {
  return pruefeTestdaten(JSON.parse(fs.readFileSync(pfad, 'utf8')));
}

module.exports = { ROLLEN, ladeTestdaten, pruefeTestdaten };
