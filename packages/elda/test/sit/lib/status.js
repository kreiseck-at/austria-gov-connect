'use strict';

// Status je Testfall – allein aus dem Laufprotokoll abgeleitet, nie getrennt
// gepflegt. Damit gibt es genau eine Quelle dafür, was erledigt ist.
//
//   offen         noch nie mit Antwort gelaufen (ein Netzfehler ohne Antwort
//                 zählt nicht – der Fall wird wieder eingeplant)
//   gelaufen      der Server hat geantwortet, noch keine passende Rücksendung
//   rueckmeldung  mindestens eine Rücksendung trägt seine Protokollnummer
//   <Urteil>      bestanden | abweichung | blockiert | entfaellt – von Hand
//                 vergeben, nachdem die Rücksendung gelesen ist

const { wocheVon } = require('./fenster');

const URTEILE = Object.freeze(['bestanden', 'abweichung', 'blockiert', 'entfaellt']);

/** Hat der Server geantwortet – mit Status-Code oder wenigstens mit einer HTTP-Antwort (Fault, Wartung)? */
const hatAntwort = (lauf) => lauf.statusCode !== undefined || lauf.http?.status !== undefined;

/** Die Protokollnummer steht als eigenständige Zahl im Dateinamen (`1557643` passt nicht auf `15576431`). */
function enthaeltNummer(text, nummer) {
  return new RegExp(`(?<!\\d)${String(nummer)}(?!\\d)`).test(String(text ?? ''));
}

function statusJeFall(katalog, ereignisse) {
  const laeufe = ereignisse.filter((e) => e.art === 'lauf');
  const rueck = ereignisse.filter((e) => e.art === 'ruecksendung');
  const urteile = ereignisse.filter((e) => e.art === 'urteil');

  const ergebnis = new Map();
  for (const fall of katalog) {
    const eigene = laeufe.filter((l) => l.fall === fall.id);
    const beantwortet = eigene.filter(hatAntwort);
    const nummern = [
      ...new Set(
        beantwortet
          .map((l) => l.protokollnummer)
          .filter(Boolean)
          .map(String),
      ),
    ];
    const ruecksendungen = rueck.filter((r) => nummern.some((n) => enthaeltNummer(r.dateiName, n)));
    const urteil = urteile.filter((u) => u.fall === fall.id).at(-1);
    const status = urteil
      ? urteil.status
      : ruecksendungen.length > 0
        ? 'rueckmeldung'
        : beantwortet.length > 0
          ? 'gelaufen'
          : 'offen';
    ergebnis.set(fall.id, {
      status,
      versuche: eigene.length,
      laeufe: beantwortet.length,
      letzter: eigene.at(-1),
      protokollnummern: nummern,
      ruecksendungen,
      urteil,
    });
  }
  return ergebnis;
}

/**
 * Fälle, die in dieser Woche erfolgreich gelaufen sind (Status 000). Nur sie
 * taugen als Vorlauf: Nach dem Wochen-Neustart gibt es im SIT nichts mehr, worauf
 * sich eine Richtigstellung oder ein Storno beziehen könnte.
 */
function gelaufenInWoche(ereignisse, woche) {
  return new Set(
    ereignisse
      .filter((e) => e.art === 'lauf' && e.statusCode === '000' && wocheVon(new Date(e.zeit)) === woche)
      .map((e) => e.fall),
  );
}

module.exports = { URTEILE, statusJeFall, gelaufenInWoche, enthaeltNummer, hatAntwort };
