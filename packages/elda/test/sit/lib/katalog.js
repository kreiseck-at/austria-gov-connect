'use strict';

// Der Testkatalog als Code: jede Datei in `faelle/` exportiert eine Liste von
// Fällen. Diese Liste ist die einzige Quelle der Wahrheit; die Übersicht als
// Markdown wird daraus erzeugt.

const fs = require('node:fs');
const path = require('node:path');
const { FENSTER } = require('./fenster');

const GRUPPEN = Object.freeze(['Z', 'T', 'B', 'V', 'M', 'S', 'R', 'C', 'W', 'K', 'L', 'D', 'J']);
const AKTIONEN = Object.freeze(['auflisten', 'senden', 'empfangen', 'beobachten']);
const GEFAHREN = Object.freeze([null, 'sperre', 'verbraucht']);

/**
 * Standardrang je Gruppe für die Reihenfolge im Fenster: erst die Meldungen, die
 * alles Weitere tragen (V), dann Transport (T) und Umschlag (B), zuletzt die
 * harmlosen Negativtests (Z). Ein Fall kann mit `rang` abweichen – Z01 läuft
 * mit Rang 0 immer zuerst, weil ohne Zugang nichts anderes Sinn hat.
 */
const RANG = Object.freeze({ V: 10, M: 20, S: 25, T: 30, B: 40, C: 45, R: 50, Z: 60 });
const rangVon = (fall) => fall.rang ?? RANG[fall.id[0]] ?? 70;

function validiereFall(fall) {
  const id = fall?.id;
  const fehler = (text) => {
    throw new Error(`Fall ${id ?? '?'}: ${text}`);
  };
  if (typeof id !== 'string' || !/^[A-Z]\d{2,3}$/.test(id)) fehler('id muss wie V01 aussehen');
  if (!GRUPPEN.includes(id[0])) fehler(`unbekannte Gruppe ${id[0]}`);
  for (const feld of ['titel', 'zweck', 'quelle', 'erwartung']) {
    if (typeof fall[feld] !== 'string' || fall[feld].trim() === '') fehler(`${feld} fehlt`);
  }
  if (!AKTIONEN.includes(fall.aktion)) fehler(`unbekannte Aktion ${fall.aktion}`);
  if (!GEFAHREN.includes(fall.gefahr ?? null)) fehler(`unbekannte Gefahr ${fall.gefahr}`);
  if (!Array.isArray(fall.abhaengig)) fehler('abhaengig muss eine Liste sein');

  if (fall.aktion === 'beobachten') {
    if (!Array.isArray(fall.aus) || fall.aus.length === 0) fehler('beobachten braucht aus');
    if (fall.baue !== undefined) fehler('beobachten baut keine Anfrage');
    return;
  }
  if (typeof fall.baue !== 'function') fehler('baue fehlt');
  const fensterOk =
    fall.fenster === 'jedes' ||
    (Array.isArray(fall.fenster) && fall.fenster.length > 0 && fall.fenster.every((f) => f in FENSTER));
  if (!fensterOk) fehler(`fenster ungültig: ${JSON.stringify(fall.fenster)}`);
  if (
    fall.aufrufe !== undefined &&
    !(Number.isInteger(fall.aufrufe) && fall.aufrufe >= 1 && fall.aufrufe <= 3)
  ) {
    fehler('aufrufe muss 1, 2 oder 3 sein');
  }
  if (fall.rang !== undefined && !Number.isInteger(fall.rang)) fehler('rang muss eine ganze Zahl sein');
}

/** Vorläufe, die in dieser Woche noch nicht erfolgreich gelaufen sind. */
const fehlendeVorlaeufe = (fall, gelaufenDieseWoche) =>
  fall.abhaengig.filter((id) => !gelaufenDieseWoche.has(id));

function ladeKatalog(verzeichnis) {
  const dateien = fs
    .readdirSync(verzeichnis)
    .filter((n) => n.endsWith('.js') && !n.endsWith('.test.js'))
    .sort();
  const faelle = [];
  for (const datei of dateien) {
    const inhalt = require(path.join(verzeichnis, datei));
    if (!Array.isArray(inhalt)) throw new Error(`${datei} exportiert keine Liste von Fällen.`);
    for (const fall of inhalt) {
      validiereFall(fall);
      faelle.push(Object.freeze({ ...fall, datei }));
    }
  }
  const ids = new Set();
  for (const f of faelle) {
    if (ids.has(f.id)) throw new Error(`Fall ${f.id} ist doppelt.`);
    ids.add(f.id);
  }
  for (const f of faelle) {
    for (const a of [...f.abhaengig, ...(f.aus ?? [])]) {
      if (!ids.has(a)) throw new Error(`Fall ${f.id}: Abhängigkeit ${a} gibt es nicht.`);
    }
  }
  return faelle;
}

const erlaubtIn = (fall, fenster) => fall.fenster === 'jedes' || fall.fenster.includes(fenster);

/**
 * Was in diesem Fenster laufen soll, in sinnvoller Reihenfolge:
 * offene Fälle, die hier erlaubt sind, dazu ihre Vorläufe, die in dieser Woche
 * noch fehlen (Wochen-Neustart). Abhängigkeiten zuerst, Sperrgefahr zuletzt.
 * Fehlt ein Vorlauf, der hier nicht laufen darf, ist der Fall blockiert.
 */
function planFuer(katalog, fenster, status, gelaufenDieseWoche) {
  const nachId = new Map(katalog.map((f) => [f.id, f]));
  const grund = new Map();
  const blockiert = [];

  function vorlaeufe(fall, gesehen = new Set()) {
    const fehlend = [];
    for (const id of fall.abhaengig) {
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      const vor = nachId.get(id);
      fehlend.push(...vorlaeufe(vor, gesehen));
      if (!gelaufenDieseWoche.has(id)) fehlend.push(vor);
    }
    return fehlend;
  }

  for (const fall of katalog) {
    if (fall.aktion === 'beobachten' || !erlaubtIn(fall, fenster)) continue;
    if (status.get(fall.id)?.status !== 'offen') continue;
    const fehlend = vorlaeufe(fall);
    const nichtHier = fehlend.filter((v) => !erlaubtIn(v, fenster));
    if (nichtHier.length > 0) {
      const v = nichtHier[0];
      blockiert.push({
        fall,
        grund: `braucht ${v.id} in dieser Woche – läuft nur in ${v.fenster === 'jedes' ? 'jedem Fenster' : v.fenster.join(', ')}`,
      });
      continue;
    }
    for (const v of fehlend) if (!grund.has(v.id)) grund.set(v.id, 'vorlauf');
    grund.set(fall.id, 'offen');
  }

  // Katalogreihenfolge, Abhängigkeiten davor, Sperrgefahr ans Ende.
  const geordnet = [];
  const besucht = new Set();
  function besuche(fall) {
    if (besucht.has(fall.id)) return;
    besucht.add(fall.id);
    for (const id of fall.abhaengig) if (grund.has(id)) besuche(nachId.get(id));
    geordnet.push(fall);
  }
  const ausgewaehlt = katalog
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => grund.has(f.id))
    .sort((a, b) => rangVon(a.f) - rangVon(b.f) || a.i - b.i)
    .map(({ f }) => f);
  for (const f of ausgewaehlt.filter((f) => f.gefahr !== 'sperre')) besuche(f);
  for (const f of ausgewaehlt.filter((f) => f.gefahr === 'sperre')) besuche(f);

  return { reihenfolge: geordnet.map((fall) => ({ fall, grund: grund.get(fall.id) })), blockiert };
}

function alsMarkdown(katalog, status) {
  const zeilen = [
    '| ID | Titel | Aktion | Fenster | Gefahr | Erwartung | Stand |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const f of katalog) {
    const fenster =
      f.aktion === 'beobachten'
        ? `aus ${f.aus.join(', ')}`
        : f.fenster === 'jedes'
          ? 'jedes'
          : f.fenster.join(', ');
    zeilen.push(
      `| ${f.id} | ${f.titel} | ${f.aktion} | ${fenster} | ${f.gefahr ?? '–'} | ${f.erwartung} | ${status.get(f.id)?.status ?? 'offen'} |`,
    );
  }
  return zeilen.join('\n');
}

module.exports = {
  GRUPPEN,
  AKTIONEN,
  GEFAHREN,
  RANG,
  rangVon,
  fehlendeVorlaeufe,
  validiereFall,
  ladeKatalog,
  planFuer,
  alsMarkdown,
};
