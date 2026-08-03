import type { RohSatz } from './bestand';
import { pruefeAbfolge } from './abfolge-e32';

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
  /**
   * Fehlercode laut Prüfkatalog, z. B. `'F9051'`.
   *
   * Codes, die **nicht** mit `F` beginnen, stammen nicht aus dem Prüfkatalog:
   *
   * - `FAK-` samt Abschnittsnummer: aus dem Fragen-Antworten-Katalog der ÖGK.
   *   ELDA weist deswegen nichts zurück, sie sind immer `warnung`.
   * - `DM-` samt Kapitelnummer: eine Regel, die das DM-ORG eindeutig aufstellt,
   *   der der Prüfkatalog aber keinen Fehlercode zuordnet. Die Regel gilt, nur
   *   ihre Ahndung durch ELDA ist unbelegt.
   *
   * Wer wissen will, ob ELDA das Paket zurückweist, filtert über das Präfix.
   */
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

/**
 * Der Fehlercode je Träger.
 *
 * Der Katalog vergibt für jeden Träger einen EIGENEN Code — `F9013` gilt allein
 * für die ÖGK-W. Bis zum 04.08.2026 meldete diese Datei für jeden Träger
 * `F9013`; für neun von zehn war das der falsche Code. Wer ihn im
 * Rücksendungsprotokoll nachschlägt, landet beim falschen Bundesland.
 */
const BKNR_CODE: Readonly<Record<string, string>> = {
  'ÖGK-W': 'F9013',
  'ÖGK-N': 'F9014',
  'ÖGK-B': 'F9015',
  'ÖGK-O': 'F9016',
  'ÖGK-ST': 'F9017',
  'ÖGK-K': 'F9018',
  'ÖGK-S': 'F9019',
  'ÖGK-T': 'F9080',
  'ÖGK-V': 'F9081',
  BVAEB: 'F9082',
};

/**
 * Beschäftigungsfolge je mBGM-Satzart (E.32.2.2.2): „Regelmäßige Beschäftigung
 * (Normalfall)", „Fallweise Beschäftigung", „Für kürzer als ein Monat
 * vereinbarte Beschäftigung". Je Versichertem und Beitragszeitraum ist von
 * jeder Kategorie nur eine mBGM zulässig.
 */
const BESCHAEFTIGUNGSFOLGE: Readonly<Record<string, string>> = {
  G1: 'regelmäßig',
  G2: 'regelmäßig',
  G3: 'fallweise',
  G4: 'fallweise',
  G5: 'kürzer als ein Monat vereinbart',
  G6: 'kürzer als ein Monat vereinbart',
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

  // F9000 gilt laut Katalog für PS, PV UND PE. Der Referenzwert ist auch im
  // Ende-Satz Pflicht (E.32.1); geprüft wurde bis 04.08.2026 nur der Kopf.
  if (!kopf.werte.REFP?.trim()) {
    befunde.push({
      code: 'F9000',
      schwere: 'fehler',
      meldung: 'Paketreferenzwert (REFP) im Kopfsatz ist leer.',
    });
  }
  if (ende.satzart === 'PE' && !ende.werte.REFP?.trim()) {
    befunde.push({
      code: 'F9000',
      schwere: 'fehler',
      meldung: 'Paketreferenzwert (REFP) im Ende-Satz ist leer.',
    });
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
    // Storno-Meldungen werden ABGEZOGEN, nicht addiert. E.32.2.2.2, Grundsätze
    // für das Storno (Selbstabrechnung), Punkt 4: „Das Datenfeld für die Summe
    // der Beiträge für einen Versicherten (VSUM) besitzt kein Vorzeichen. […]
    // Allerdings ist bei der Summierung der mBGM in einem mBGM-Paket (im
    // Datenfeld GSUM) die VSUM der Storno-mBGM abzuziehen."
    const summeMeldungen = mbgmSaetze.reduce((s, m) => {
      const betrag = zahl(m.werte.VSUM) || 0;
      return m.satzart.startsWith('R') ? s - betrag : s + betrag;
    }, 0);
    // GSUM trägt selbst kein Vorzeichen — das steht getrennt in GSVZ. Ein Paket,
    // das nur Storni enthält, hat deshalb einen positiven GSUM und GSVZ = '-'
    // (Beispiele 14 bis 17). Ohne diese Umrechnung schlüge F9051 bei jedem
    // Storno an, obwohl das Paket genau so aussieht, wie das Dokument es
    // abdruckt.
    const gsum = (zahl(kopf.werte.GSUM) || 0) * (kopf.werte.GSVZ === '-' ? -1 : 1);
    if (gsum !== summeMeldungen) {
      befunde.push({
        code: 'F9051',
        schwere: 'fehler',
        meldung:
          `Gesamtsumme der Beiträge im Paket (GSVZ=${kopf.werte.GSVZ ?? ''}, ` +
          `GSUM=${kopf.werte.GSUM ?? ''}) ist ungleich der Summe der enthaltenen mBGM ` +
          `(${summeMeldungen}; Storni abgezogen).`,
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
  // E.32.2.2.2, Grundsatz 1: „Es ist nur eine mBGM pro Beitragszeitraum und
  // Beschäftigungsfolge (regelmäßig, fallweise oder kürzer als ein Monat
  // vereinbart) zulässig. […] Auch wenn z.B. in einem Kalendermonat mehrere
  // (regelmäßige) Beschäftigungen liegen, ist nur eine mBGM zulässig."
  //
  // Ein Paket deckt genau einen Beitragszeitraum ab, deshalb genügt hier der
  // Vergleich je Versichertem. Storno-Sätze bleiben außen vor: Zu einer
  // stornierten Meldung darf im selben Paket eine neue folgen — genau das
  // verlangt Grundsatz 1 der Storno-Regeln bei jeder Änderung.
  const gesehen = new Map<string, Set<string>>();
  for (const m of mbgmSaetze) {
    if (m.satzart.startsWith('R')) continue;
    const vsnr = m.werte.VSNR?.trim();
    if (!vsnr) continue;
    const folge = BESCHAEFTIGUNGSFOLGE[m.satzart];
    if (!folge) continue;
    const bisher = gesehen.get(vsnr) ?? new Set<string>();
    if (bisher.has(folge)) {
      befunde.push({
        // KEIN Katalogcode: Der Prüfkatalog bindet F9070 ausschließlich an den
        // Aufbau nach E.32.2.2.6. Diese Regel steht in E.32.2.2.2 und ist
        // eindeutig („ist nur eine mBGM zulässig"), aber mit welchem Code ELDA
        // sie ahndet — und ob überhaupt — ist unbelegt. Sie deshalb als F9070
        // auszugeben hiesse, einen Code zu erfinden.
        code: 'DM-E.32.2.2.2',
        schwere: 'fehler',
        meldung:
          `Versicherungsnummer ${vsnr}: mehr als eine mBGM für die Beschäftigungsfolge ` +
          `„${folge}" im selben Beitragszeitraum. E.32.2.2.2 lässt nur eine zu — mehrere ` +
          'gleichartige Beschäftigungen in einem Kalendermonat sind in EINE mBGM ' +
          'zusammenzufassen (dort über mehrere Tarifblöcke).',
      });
    }
    bisher.add(folge);
    gesehen.set(vsnr, bisher);
  }

  // Fragen-Antworten-Katalog der ÖGK, Abschnitt 3.1.11 (Stand 01.01.2026):
  // „Grundsätzlich ist in einer mBGM nur ein Tarifblock zulässig. Mehr als ein
  // Tarifblock in einer mBGM ist allerdings unter anderem zwingend
  // erforderlich: Bei regelmäßiger Beschäftigung, wenn mehr als eine
  // Beschäftigung in einem Beitragszeitraum vorliegt (gilt für zeitlich
  // hintereinanderliegende Beschäftigungen und auch für parallele
  // Beschäftigungen […])."
  //
  // Nur eine Warnung, und das aus zwei Gründen. „Unter anderem" heißt, dass die
  // Ausnahmeliste nicht abschließend ist — E.32.2.2.2 nennt fünf Fälle, der FAK
  // einen, und keine der beiden Aufzählungen beansprucht Vollständigkeit. Und
  // der Prüfkatalog kennt dafür keinen Fehlercode: ELDA weist ein solches Paket
  // nicht zurück.
  //
  // Nur für die regelmäßige Beschäftigung. Bei fallweiser und bei kürzer als
  // einem Monat vereinbarter Beschäftigung sind mehrere Tarifblöcke der
  // Normalfall — FAK 3.2.8: „bei diesen mBGM wird ja pro Beschäftigungszeit je
  // ein Tarifblock gemeldet".
  let regelmaessigeMbgm: string | undefined;
  let regelmaessigeBloecke = 0;
  const mehrfach = new Set<string>();
  const merken = () => {
    if (regelmaessigeMbgm && regelmaessigeBloecke > 1) mehrfach.add(regelmaessigeMbgm);
  };
  for (const s of saetze) {
    if (/^[GR]\d$/.test(s.satzart)) {
      merken();
      regelmaessigeMbgm =
        s.satzart === 'G1' || s.satzart === 'G2' ? s.werte.VSNR?.trim() || s.satzart : undefined;
      regelmaessigeBloecke = 0;
    } else if (regelmaessigeMbgm && (s.satzart === 'T1' || s.satzart === 'T4')) {
      regelmaessigeBloecke++;
    }
  }
  merken();
  for (const wer of mehrfach) {
    befunde.push({
      code: 'FAK-3.1.11',
      schwere: 'warnung',
      meldung:
        `${wer}: mehr als ein Tarifblock in einer mBGM für regelmäßige Beschäftigung. ` +
        'Grundsätzlich ist nur einer zulässig; mehrere sind es nur, wenn im Beitragszeitraum ' +
        'mehr als eine Beschäftigung vorliegt — zeitlich hintereinander oder parallel, etwa bei ' +
        'Aufnahme einer neuen Beschäftigung während laufender Kündigungsentschädigung oder ' +
        'Urlaubsersatzleistung (ÖGK-FAK 3.1.11).',
    });
  }

  // Die eigentliche Strukturregel steht nicht im Prüfkatalog, sondern in
  // Kapitel E.32.2.2.6 — der Katalog verweist bei F9070 nur darauf.
  befunde.push(...pruefeAbfolge(saetze));

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
 * @returns alle Befunde; ein leeres Array heißt: nichts zu beanstanden, oder der
 *   Träger ist unbekannt.
 */
export function pruefeBeitragskontonummer(bknr: string, traeger: string): Befund[] {
  const erlaubt = BKNR_LAENGE[traeger];
  if (!erlaubt) return [];
  const befunde: Befund[] = [];

  // F9012 — die einzige trägerbezogene BKNR-Prüfung mit Status `N`: Sie weist
  // die Meldung zurück, während die Längenprüfungen nur warnen. Der Katalog
  // wörtlich: „erster Feldwert ein Leerzeichen (gilt nur für Träger 19 -
  // ÖGK-V)". Geprüft wird deshalb der ROHE Wert, nicht der getrimmte.
  if (traeger === 'ÖGK-V' && bknr.startsWith(' ')) {
    befunde.push({
      code: 'F9012',
      schwere: 'fehler',
      meldung:
        'Die Beitragskontonummer beginnt mit einem Leerzeichen. Bei der ÖGK-V weist ELDA ' +
        'die Meldung dafür zurück.',
    });
  }

  const laenge = bknr.trim().length;
  if (!erlaubt.includes(laenge)) {
    befunde.push({
      code: BKNR_CODE[traeger] ?? 'F9013',
      schwere: 'warnung',
      meldung:
        `Ungültige Beitragskontonummer für ${traeger}: ${laenge} Stellen, ` +
        `zulässig ${erlaubt.join(' oder ')}.`,
    });
  }

  return befunde;
}
