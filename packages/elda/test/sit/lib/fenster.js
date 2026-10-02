'use strict';

// Testfenster der SIT-Plattform und die „Zeitreise".
//
// Laut Testkalender (Rubrik LOHNSOFTWAREHERSTELLER, Stand 10/2026) gibt es Montag
// bis Mittwoch je zwei Fenster; jedes simuliert ein festes Datum, an dem die
// Anlage „steht". Donnerstag und Freitag sind Wartung, täglich 06–07 Uhr ebenso.
// Die Anlage wird nach jedem Wochenzyklus zurückgesetzt (ÖGK, „LSWH-Test –
// Regelbetrieb", 10/2023).
//
// Ab 02.11.2026 (KW45) stellt der SIT auf eine neue Zeitreise um. Bis die neue
// Tabelle hier steht, verweigert das Werkzeug jeden Netzaufruf (GUELTIG_BIS) –
// ein Lauf mit falschem simuliertem Datum erzeugt nur Fehlbefunde.

const FENSTER = Object.freeze({
  'mo-vm': Object.freeze({ wochentag: 1, von: '07:00', bis: '09:00', datum: '2025-01-01' }),
  'mo-nm': Object.freeze({ wochentag: 1, von: '12:00', bis: '14:00', datum: '2025-02-01' }),
  'di-vm': Object.freeze({ wochentag: 2, von: '07:00', bis: '09:00', datum: '2025-03-01' }),
  'di-nm': Object.freeze({ wochentag: 2, von: '12:00', bis: '14:00', datum: '2025-04-01' }),
  'mi-vm': Object.freeze({ wochentag: 3, von: '07:00', bis: '09:00', datum: '2026-04-01' }),
  'mi-nm': Object.freeze({ wochentag: 3, von: '12:00', bis: '14:00', datum: '2026-05-01' }),
});

/** Letzter Tag, für den diese Tabelle gilt (Sonntag vor KW45). */
const GUELTIG_BIS = '2026-11-01';

/** Montag bis Mittwoch ohne Testmöglichkeit laut Testkalender 2026 (Feiertage und gesperrte Tage). */
const TESTFREIE_TAGE = Object.freeze([
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-26',
  '2026-10-27',
  '2026-10-28',
  '2026-12-07',
  '2026-12-08',
  '2026-12-09',
  '2026-12-28',
  '2026-12-29',
  '2026-12-30',
]);

const WOCHENTAG = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const WIEN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

/** Wiener Wanduhr eines Zeitpunkts. */
function wienerZeit(date) {
  const teile = Object.fromEntries(WIEN.formatToParts(date).map((t) => [t.type, t.value]));
  return {
    datum: `${teile.year}-${teile.month}-${teile.day}`,
    zeit: `${teile.hour}:${teile.minute}:${teile.second}`,
    wochentag: WOCHENTAG[teile.weekday],
  };
}

/** Das Fenster, das zu diesem Zeitpunkt offen ist – oder `null`. */
function aktivesFenster(jetzt) {
  const w = wienerZeit(jetzt);
  if (w.datum > GUELTIG_BIS) return null;
  if (TESTFREIE_TAGE.includes(w.datum)) return null;
  const hhmm = w.zeit.slice(0, 5);
  for (const [name, f] of Object.entries(FENSTER)) {
    if (f.wochentag === w.wochentag && hhmm >= f.von && hhmm < f.bis) return name;
  }
  return null;
}

/** Das simulierte Datum eines Fensters als ISO-Datum. */
function zrDatum(fenster) {
  const f = FENSTER[fenster];
  if (!f) throw new Error(`Unbekanntes Fenster '${fenster}' – erlaubt: ${Object.keys(FENSTER).join(', ')}.`);
  return f.datum;
}

/**
 * Der Zeitpunkt, an dem die Wiener Wanduhr `datum` `zeit` zeigt. Wien liegt bei
 * UTC+1 oder UTC+2; probiert wird beides, genommen wird, was zurückgerechnet passt.
 */
function wienerZeitpunkt(datum, zeit) {
  const [j, m, t] = datum.split('-').map(Number);
  const [hh, mm, ss] = zeit.split(':').map(Number);
  for (const versatz of [1, 2]) {
    const kandidat = new Date(Date.UTC(j, m - 1, t, hh - versatz, mm, ss));
    const w = wienerZeit(kandidat);
    if (w.datum === datum && w.zeit === zeit) return kandidat;
  }
  throw new Error(`${datum} ${zeit} gibt es in Wien nicht (Zeitumstellung).`);
}

/**
 * Erstellungszeitpunkt für einen Bestand im SIT: das simulierte Datum des
 * Fensters mit der aktuellen Wiener Uhrzeit. Der ÖGK-Vortrag zum LSWH-Test
 * verlangt: „Einlangedatum der Meldungen (EDAT) nicht nach dem 01. des Monats".
 */
function simuliertesErstellt(fenster, jetzt) {
  return wienerZeitpunkt(zrDatum(fenster), wienerZeit(jetzt).zeit);
}

/**
 * ISO-Kalenderwoche eines ISO-Datums, z. B. '2026-W41'. Die Anlage wird nach
 * jedem Wochenzyklus zurückgesetzt – was in einer anderen Woche lief, gibt es im
 * SIT nicht mehr.
 */
function isoWoche(iso) {
  const [j, m, t] = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahr = d.getUTCFullYear();
  const woche = Math.ceil(((d - Date.UTC(jahr, 0, 1)) / 86_400_000 + 1) / 7);
  return `${jahr}-W${String(woche).padStart(2, '0')}`;
}

/** ISO-Datum plus `tage` Kalendertage (auch negativ). */
function plusTage(iso, tage) {
  const [j, m, t] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10);
}

/** Wiener Kalenderwoche eines Zeitpunkts. */
const wocheVon = (date) => isoWoche(wienerZeit(date).datum);

/** '2025-03-01' → '01032025' (Datumsformat der Fixlängensätze). */
function ttmmjjjj(iso) {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!treffer) throw new Error(`Erwartet ein ISO-Datum JJJJ-MM-TT, erhalten: '${iso}'.`);
  return `${treffer[3]}${treffer[2]}${treffer[1]}`;
}

module.exports = {
  FENSTER,
  GUELTIG_BIS,
  TESTFREIE_TAGE,
  wienerZeit,
  aktivesFenster,
  zrDatum,
  wienerZeitpunkt,
  simuliertesErstellt,
  ttmmjjjj,
  isoWoche,
  wocheVon,
  plusTage,
};
