import type { RohSatz } from './bestand';

/**
 * Prüfregeln des mBGM-Pakets aus dem Prüfkatalog der 42. Ergänzung,
 * Version 42.1.0.0.A7, Blatt `Paket` („H.20 mBGM – Paketsprüfungen").
 *
 * **Zum Umfang:** Der Prüfkatalog führt für die mBGM ausschließlich
 * Paketprüfungen. Eigene Feldprüfungen für die Satzarten `G`, `T`, `BS`/`BV`
 * und `V` gibt es dort nicht — geprüft wird der Aufbau des Pakets als Ganzes
 * (`F9070`, mit Verweis auf Kapitel E.32.2.2.6).
 *
 * Nicht zu verwechseln mit dem Blatt `BG` desselben Katalogs: Das führt die
 * Satzarten **40 und 42** und gehört damit zum *Lohnzettel SV
 * (Beitragsgrundlagenmeldung)* — einer Jahresmeldung —, nicht zur monatlichen
 * Beitragsgrundlagenmeldung. Die Kürzel ähneln sich, die Verfahren nicht.
 *
 * Der Status je Regel stammt aus der Spalte „Status": `N` weist die Meldung
 * zurück, `W` ist eine Warnung.
 */

/** Schwere eines Befundes laut Prüfkatalog-Spalte „Status". */
export type Schwere = 'fehler' | 'warnung';

/** Ein Befund mit dem Fehlercode, den ELDA dafür vergibt. */
export interface Befund {
  /** Fehlercode laut Prüfkatalog, z. B. `'F9051'`. */
  code: string;
  /** `fehler` weist die Meldung zurück, `warnung` nicht. */
  schwere: Schwere;
  /** Klartext, an der Formulierung des Katalogs orientiert. */
  meldung: string;
}

/**
 * Höchstanzahlen je mBGM laut `F9072` (Warnung).
 *
 * Wörtlich: „max. Höchstanzahl überschritten (T1/T4=15; T2/T3/T5/T6=31;
 * BS/NEXT/BV=10; V1/V2=10)".
 *
 * Die 31 bei den tagesbezogenen Tarifblöcken ist die Zahl der Kalendertage
 * eines Monats — je Tag ein Block. Der Eintrag `NEXT` in der Katalogzeile ist
 * keine Satzart dieses Kapitels; er bleibt hier unberücksichtigt.
 */
export const HOECHSTANZAHL = {
  /** Tarifblöcke der regelmäßigen Beschäftigung je mBGM. */
  tarifblock: 15,
  /** Tarifblöcke für fallweise oder kürzer als einen Monat vereinbarte Beschäftigung. */
  tarifblockTagesbezogen: 31,
  /** Verrechnungsbasen je Tarifblock. */
  verrechnungsbasis: 10,
  /** Verrechnungspositionen je Verrechnungsbasis. */
  verrechnungsposition: 10,
} as const;

/**
 * Zulässige Länge der Beitragskontonummer je Versicherungsträger, laut den
 * Warnungen `F9013`–`F9019` und `F9080`–`F9082`.
 *
 * Das ist eine **Warnung**, kein Fehler: Eine abweichende Länge weist ELDA
 * nicht zurück. Welcher Träger zuständig ist, weiß dieses Paket nicht — die
 * Prüfung steht deshalb als Werkzeug bereit und läuft nicht von selbst.
 */
export const BKNR_LAENGE: Readonly<Record<string, readonly number[]>> = {
  'ÖGK-W': [8],
  'ÖGK-N': [9],
  'ÖGK-B': [7],
  'ÖGK-O': [8, 10],
  'ÖGK-ST': [7],
  'ÖGK-K': [7],
  'ÖGK-S': [7],
  'ÖGK-T': [7],
  'ÖGK-V': [6],
  BVAEB: [5, 10],
};

/** Frühester fachlich gültiger Beitragszeitraum (`F9040`): Zeiträume ab 01.01.2019. */
const FRUEHESTER_ZEITRAUM = { monat: 1, jahr: 2019 };

function zahl(wert: string | undefined): number {
  return Number.parseInt(wert ?? '', 10);
}

/**
 * Prüft eine fertige mBGM-Satzfolge gegen die Paketprüfungen des Katalogs.
 *
 * Die meisten dieser Befunde kann `erstelleMbgmPaket` gar nicht erzeugen — es
 * rechnet `GSUM` und `ANZM` selbst und füllt die Pflichtfelder. Der Wert liegt
 * woanders: Wer die Sätze von Hand oder aus einer anderen Quelle
 * zusammenstellt, bekommt hier **denselben Fehlercode genannt, den ELDA
 * vergeben würde** — und muss ihn nicht aus einem Rücksendungsprotokoll
 * rückwärts erschließen.
 *
 * @returns alle Befunde; ein leeres Array heißt: keine der kodierten Regeln
 *   schlägt an. Das ist keine Zusage, dass ELDA die Meldung annimmt.
 */
export function pruefeMbgmPaket(saetze: readonly RohSatz[]): Befund[] {
  const befunde: Befund[] = [];
  const kopf = saetze[0];
  const ende = saetze[saetze.length - 1];

  if (!kopf || !ende) {
    return [
      { code: 'F9070', schwere: 'fehler', meldung: 'Aufbau des mBGM-Pakets nicht korrekt: leere Satzfolge.' },
    ];
  }
  if (!['PS', 'PV'].includes(kopf.satzart) || ende.satzart !== 'PE') {
    befunde.push({
      code: 'F9070',
      schwere: 'fehler',
      meldung:
        'Aufbau des mBGM-Pakets nicht korrekt (siehe DM Org., Kapitel E.32.2.2.6): ' +
        `Das Paket muss mit PS oder PV beginnen und mit PE enden, gefunden wurden ` +
        `'${kopf.satzart}' und '${ende.satzart}'.`,
    });
  }

  const selbstabrechnung = kopf.satzart === 'PS';

  if (!kopf.werte.REFP?.trim()) {
    befunde.push({ code: 'F9000', schwere: 'fehler', meldung: 'Paketreferenzwert (REFP) ist leer.' });
  }
  if (!kopf.werte.BKNR?.trim()) {
    befunde.push({ code: 'F9010', schwere: 'fehler', meldung: 'Beitragskontonummer (BKNR) ist leer.' });
  }
  if (!kopf.werte.DGNA?.trim()) {
    befunde.push({ code: 'F9020', schwere: 'fehler', meldung: 'Dienstgebername (DGNA) ist leer.' });
  }

  const jagb = kopf.werte.JAGB;
  if (!jagb?.trim()) {
    befunde.push({
      code: 'F9030',
      schwere: 'fehler',
      meldung: 'Jährliche Abrechnung für geringfügig Beschäftigte (JAGB) ist leer.',
    });
  } else if (jagb !== 'J' && jagb !== 'N') {
    befunde.push({
      code: 'F9031',
      schwere: 'fehler',
      meldung: `JAGB ist ungültig: '${jagb}'. Gültig sind ausschließlich 'J' und 'N'.`,
    });
  }

  const bzrm = kopf.werte.BZRM ?? '';
  const monat = zahl(bzrm.slice(0, 2));
  const jahr = zahl(bzrm.slice(2));
  const zeitraumGueltig =
    /^\d{6}$/.test(bzrm) &&
    monat >= 1 &&
    monat <= 12 &&
    (jahr > FRUEHESTER_ZEITRAUM.jahr ||
      (jahr === FRUEHESTER_ZEITRAUM.jahr && monat >= FRUEHESTER_ZEITRAUM.monat));
  if (!zeitraumGueltig) {
    befunde.push({
      code: 'F9040',
      schwere: 'fehler',
      meldung:
        `Beitragszeitraum (BZRM) ist ungültig: '${bzrm}'. Erwartet wird MMJJJJ, ` +
        'fachlich gültig sind Zeiträume ab 01.01.2019.',
    });
  }

  // GSVZ und GSUM werden laut Katalog NUR beim Selbstabrechner geprüft. Beim
  // Vorschreiber sind sie mit Z4 gekennzeichnet — der Inhalt wird dort nicht
  // übernommen, und der Prüfkatalog führt für PV keine entsprechende Regel.
  const mbgmSaetze = saetze.filter((s) => /^[GR]\d$/.test(s.satzart));
  if (selbstabrechnung) {
    const gsvz = kopf.werte.GSVZ;
    if (gsvz !== '+' && gsvz !== '-') {
      befunde.push({
        code: 'F9050',
        schwere: 'fehler',
        meldung: `Vorzeichen der Gesamtsumme (GSVZ) ist ungültig: '${gsvz ?? ''}'. Gültig sind '+' und '-'.`,
      });
    }
    const summeMeldungen = mbgmSaetze.reduce((s, m) => s + (zahl(m.werte.VSUM) || 0), 0);
    const gsum = zahl(kopf.werte.GSUM) || 0;
    if (gsum !== summeMeldungen) {
      befunde.push({
        code: 'F9051',
        schwere: 'fehler',
        meldung:
          `Gesamtsumme der Beiträge im Paket (GSUM=${gsum}) ist ungleich der Summe der ` +
          `enthaltenen mBGM (${summeMeldungen}).`,
      });
    }
  }

  const anzm = zahl(kopf.werte.ANZM);
  if (anzm !== mbgmSaetze.length) {
    befunde.push({
      code: 'F9060',
      schwere: 'fehler',
      meldung: `Anzahl der mBGM im Paket (ANZM=${kopf.werte.ANZM ?? ''}) stimmt nicht mit den ${mbgmSaetze.length} enthaltenen mBGM überein.`,
    });
  }
  if (zahl(ende.werte.ANZM) !== mbgmSaetze.length) {
    befunde.push({
      code: 'F9060',
      schwere: 'fehler',
      meldung: `Anzahl der mBGM im Ende-Satz (ANZM=${ende.werte.ANZM ?? ''}) stimmt nicht mit den ${mbgmSaetze.length} enthaltenen mBGM überein.`,
    });
  }

  // F9072: Höchstanzahlen je mBGM bzw. je übergeordnetem Satz.
  let tarifbloecke = 0;
  let tagesbezogen = 0;
  let basen = 0;
  let positionen = 0;
  const ueberschritten = new Set<string>();
  for (const s of saetze) {
    if (/^[GR]\d$/.test(s.satzart)) {
      tarifbloecke = 0;
      tagesbezogen = 0;
    } else if (s.satzart === 'T1' || s.satzart === 'T4') {
      if (++tarifbloecke > HOECHSTANZAHL.tarifblock) ueberschritten.add('T1/T4');
      basen = 0;
    } else if (/^T[2356]$/.test(s.satzart)) {
      if (++tagesbezogen > HOECHSTANZAHL.tarifblockTagesbezogen) ueberschritten.add('T2/T3/T5/T6');
      basen = 0;
    } else if (s.satzart === 'BS' || s.satzart === 'BV') {
      if (++basen > HOECHSTANZAHL.verrechnungsbasis) ueberschritten.add('BS/BV');
      positionen = 0;
    } else if (s.satzart === 'V1' || s.satzart === 'V2') {
      if (++positionen > HOECHSTANZAHL.verrechnungsposition) ueberschritten.add('V1/V2');
    }
  }
  for (const was of ueberschritten) {
    befunde.push({
      code: 'F9072',
      schwere: 'warnung',
      meldung: `Höchstanzahl überschritten (${was}). Zulässig sind T1/T4=15, T2/T3/T5/T6=31, BS/BV=10, V1/V2=10.`,
    });
  }

  return befunde;
}

/**
 * Prüft die Länge einer Beitragskontonummer gegen den zuständigen
 * Versicherungsträger (`F9013`–`F9019`, `F9080`–`F9082`).
 *
 * Getrennt von {@link pruefeMbgmPaket}, weil der Träger nicht aus der Meldung
 * hervorgeht. Für Salzburg gilt `'ÖGK-S'` mit sieben Stellen.
 *
 * @returns `undefined`, wenn die Länge passt oder der Träger unbekannt ist.
 */
export function pruefeBeitragskontonummer(bknr: string, traeger: string): Befund | undefined {
  const erlaubt = BKNR_LAENGE[traeger];
  if (!erlaubt) return undefined;
  const laenge = bknr.trim().length;
  if (erlaubt.includes(laenge)) return undefined;
  return {
    code: 'F9013',
    schwere: 'warnung',
    meldung:
      `Ungültige Beitragskontonummer für ${traeger}: ${laenge} Stellen, ` +
      `zulässig ${erlaubt.join(' oder ')}.`,
  };
}
