'use strict';

// Ablage der SIT-Läufe: je Lauf ein Ordner (Anfrage, Antwort, Bestand), die
// abgeholten Rücksendungen und ein Laufprotokoll, an das nur angehängt wird.
// Das Protokoll ist die einzige Quelle dafür, was schon gelaufen ist – daraus
// leiten sich Status, Abhängigkeiten und Referenzwerte ab.
//
// Die Ablage liegt gitignoriert neben dem Werkzeug. Ordner 0700, Dateien 0600,
// und eine Datei wird nie überschrieben: Was einmal gesichert ist, bleibt.

const fs = require('node:fs');
const path = require('node:path');

function sichererName(text) {
  const name = String(text ?? '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 120);
  if (!name) throw new Error('Dateiname ist leer.');
  return name;
}

function erstelleAblage(basis) {
  fs.mkdirSync(basis, { recursive: true, mode: 0o700 });
  const protokollDatei = path.join(basis, 'laufprotokoll.jsonl');

  function neuerOrdner(...teile) {
    const ordner = path.join(basis, ...teile);
    fs.mkdirSync(ordner, { recursive: true, mode: 0o700 });
    fs.chmodSync(ordner, 0o700);
    return ordner;
  }

  function neuerLauf(fallId) {
    const stempel = new Date().toISOString().replace(/[:.]/g, '-');
    const grund = `${stempel}_${sichererName(fallId)}`;
    let id = grund;
    for (let n = 2; fs.existsSync(path.join(basis, 'laeufe', id)); n += 1) id = `${grund}-${n}`;
    return { id, ordner: neuerOrdner('laeufe', id) };
  }

  function schreibe(ordner, name, daten) {
    const ziel = path.join(ordner, sichererName(name));
    fs.writeFileSync(ziel, daten, { mode: 0o600, flag: 'wx' });
    return ziel;
  }

  function protokolliere(ereignis) {
    const zeile = JSON.stringify({ zeit: new Date().toISOString(), ...ereignis });
    fs.appendFileSync(protokollDatei, `${zeile}\n`, { mode: 0o600 });
  }

  function ereignisse() {
    if (!fs.existsSync(protokollDatei)) return [];
    return fs
      .readFileSync(protokollDatei, 'utf8')
      .split('\n')
      .map((zeile, i) => ({ zeile, nr: i + 1 }))
      .filter(({ zeile }) => zeile.trim() !== '')
      .map(({ zeile, nr }) => {
        try {
          return JSON.parse(zeile);
        } catch {
          throw new Error(`Laufprotokoll Zeile ${nr} ist kaputt – von Hand prüfen, nicht überspringen.`);
        }
      });
  }

  return {
    basis,
    neuerLauf,
    schreibe,
    protokolliere,
    ereignisse,
    ruecksendungsOrdner: () => neuerOrdner('ruecksendungen'),
  };
}

module.exports = { erstelleAblage, sichererName };
