'use strict';

// Reine Helfer für `sit.js auswerten`: Zuordnung der Rücksendungen zu den Fällen.

const { ZUSTELLUNGSGRUND } = require('../../../dist/index.js');

/**
 * Referenzwert → Fall und Protokollnummer → Fall aus den Läufen des Laufprotokolls.
 */
function zuordnungAusLaeufen(ereignisse) {
  const nachReferenz = new Map();
  const nachProtokoll = new Map();
  for (const e of ereignisse) {
    if (e.art !== 'lauf') continue;
    for (const r of e.referenzwerte ?? []) nachReferenz.set(r, e.fall);
    if (e.protokollnummer) nachProtokoll.set(String(e.protokollnummer), e.fall);
  }
  return { nachReferenz, nachProtokoll };
}

/**
 * Die Fälle einer Mitteilung: über die Referenznummern der Meldungen, sonst über
 * die Protokollnummer der Sendung. Die Mitteilung zum Lohnzettel (LF) trägt eine
 * leere `referenznummer` – ohne den zweiten Weg stünde dort kein Fall.
 */
function faelleDerMitteilung(mitteilung, protokollnummer, { nachReferenz, nachProtokoll }) {
  const refs = mitteilung.meldungen
    .map((x) => (x.referenznummer ? (nachReferenz.get(x.referenznummer) ?? x.referenznummer) : undefined))
    .filter((r) => r !== undefined);
  if (refs.length > 0) return [...new Set(refs)];
  const fall = protokollnummer === undefined ? undefined : nachProtokoll.get(String(protokollnummer));
  return fall ? [fall] : [];
}

/**
 * Wie ein Dialogfall zugestellt wurde: leer für „gemeldet“ (M), sonst der Grund –
 * „obsolet gesetzt“ (O) heißt erledigt, der Fall ist kein neuer Hinweis.
 */
function zustellungsHinweis(dialogfall) {
  const z = dialogfall.zustellungsgrund;
  if (!z || z === 'M') return '';
  return ZUSTELLUNGSGRUND[z] ?? `Zustellung ${z}`;
}

/** Zählt ein Dialogfall zu den offenen Codes? Obsolet gesetzte nicht. */
const istOffen = (dialogfall) => dialogfall.zustellungsgrund !== 'O';

module.exports = { zuordnungAusLaeufen, faelleDerMitteilung, zustellungsHinweis, istOffen };
