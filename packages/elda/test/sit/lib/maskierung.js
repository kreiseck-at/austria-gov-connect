'use strict';

// Die Seriennummer steht in keiner Datei der Ablage im Klartext.
//
// Ein Bestand trägt sie in jedem Satz im Feld OBUS (Identifikationsteil,
// Stellen 12–18, Kapitel E.1). Gespeichert wird der Bestand mit maskiertem
// OBUS; wer ihn byte-gleich wieder braucht (Duplikat-Test), setzt die Nummer
// mit `setzeObusEin` wieder ein. Rücksendungen werden beim Sichern Zeichen für
// Zeichen maskiert – gleiche Länge, damit Fixlängen-Protokolle lesbar bleiben.

const OBUS_START = 11; // 0-basiert: Stelle 12
const OBUS_LAENGE = 7;
const MASKE = '*'.repeat(OBUS_LAENGE);

function pruefeSeriennummer(seriennummer) {
  if (!/^\d{6,7}$/.test(String(seriennummer ?? ''))) {
    throw new Error('Seriennummer muss 6 oder 7 Ziffern haben.');
  }
  return String(seriennummer).padStart(OBUS_LAENGE, '0');
}

/** Wendet `ersetze` auf jeden Satz an; Satztrenner (CRLF oder LF) bleiben byte-gleich. */
function jeSatz(inhalt, ersetze) {
  const teile = inhalt.toString('latin1').split(/(\r\n|\n)/);
  return Buffer.from(teile.map((t, i) => (i % 2 === 0 ? ersetze(t) : t)).join(''), 'latin1');
}

function tauscheObus(satz, von, nach) {
  if (satz.length < OBUS_START + OBUS_LAENGE || satz.slice(OBUS_START, OBUS_START + OBUS_LAENGE) !== von) {
    return satz;
  }
  return satz.slice(0, OBUS_START) + nach + satz.slice(OBUS_START + OBUS_LAENGE);
}

/** OBUS jedes Satzes, das die Seriennummer trägt, wird zu `*******`. Ein anderes OBUS bleibt stehen. */
function maskiereObus(inhalt, seriennummer) {
  const obus = pruefeSeriennummer(seriennummer);
  return jeSatz(inhalt, (satz) => tauscheObus(satz, obus, MASKE));
}

/** Umkehrung von `maskiereObus`: jedes `*******` an der OBUS-Stelle wird wieder die Seriennummer. */
function setzeObusEin(inhalt, seriennummer) {
  const obus = pruefeSeriennummer(seriennummer);
  return jeSatz(inhalt, (satz) => tauscheObus(satz, MASKE, obus));
}

/**
 * Die Formen, in denen die Seriennummer im Klartext vorkommt: als OBUS (sieben
 * Stellen, aufgefüllt) und wie vergeben (ohne die führende Null). Die längere
 * zuerst – sonst bliebe von der OBUS-Form eine Null stehen.
 */
function formenDerSeriennummer(seriennummer) {
  const lang = pruefeSeriennummer(seriennummer);
  return [...new Set([lang, lang.replace(/^0/, '')])];
}

function ersetzeFormen(text, seriennummer) {
  let anzahl = 0;
  for (const form of formenDerSeriennummer(seriennummer)) {
    const teile = text.split(form);
    anzahl += teile.length - 1;
    text = teile.join('*'.repeat(form.length));
  }
  return { text, anzahl };
}

// Base64 steckt an zwei Stellen: im <payload> einer Rücksendung und in der
// `requestId:` einer Fehlerantwort (<messages>), die UUID, Seriennummer und
// eine Zahl trägt.
const PAYLOAD = /(<(?:[\w.-]+:)?payload>|requestId:)([^<]*)(<\/(?:[\w.-]+:)?payload>|(?=<))/g;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Liefert ELDA eine Rücksendung inline statt als MTOM-Anhang, steht sie als
 * Base64 im `<payload>`; eine Fehlerantwort trägt die Seriennummer Base64 in
 * der `requestId`. Dort fände sie keine Suche im Klartext. Das Base64 wird
 * dekodiert, maskiert und wieder kodiert; die Länge des Inhalts bleibt gleich.
 * Was kein sauberes Base64 ist (etwa ein `cid:`-Verweis), bleibt stehen.
 */
function maskierePayloads(text, seriennummer) {
  let anzahl = 0;
  const neu = text.replace(PAYLOAD, (ganz, auf, inhalt, zu) => {
    const b64 = inhalt.replace(/\s+/g, '');
    if (b64.length % 4 !== 0 || !BASE64.test(b64)) return ganz;
    const treffer = ersetzeFormen(Buffer.from(b64, 'base64').toString('latin1'), seriennummer);
    if (treffer.anzahl === 0) return ganz;
    anzahl += treffer.anzahl;
    return auf + Buffer.from(treffer.text, 'latin1').toString('base64') + zu;
  });
  return { text: neu, anzahl };
}

/**
 * Maskiert jedes Vorkommen der Seriennummer in beliebigen Bytes mit Sternen
 * gleicher Länge – im Klartext und in Base64-Payloads. Was eine Rücksendung
 * darüber hinaus kodiert trägt (etwa gepackt oder Base64 im Clearing-
 * Datensatz), erreicht diese Maskierung nicht.
 */
function maskiereText(bytes, seriennummer) {
  const payloads = maskierePayloads(bytes.toString('latin1'), seriennummer);
  const klartext = ersetzeFormen(payloads.text, seriennummer);
  return { bytes: Buffer.from(klartext.text, 'latin1'), anzahl: payloads.anzahl + klartext.anzahl };
}

/** Dasselbe für Zeichenketten – etwa Dateinamen, die ELDA vergibt. */
function ohneSeriennummer(text, seriennummer) {
  return ersetzeFormen(String(text), seriennummer).text;
}

module.exports = {
  maskiereObus,
  setzeObusEin,
  maskiereText,
  ohneSeriennummer,
  formenDerSeriennummer,
  maskierePayloads,
  MASKE,
};
