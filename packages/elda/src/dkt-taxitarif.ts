import { EldaError } from './errors';

/**
 * Tarif für die Krankenbeförderung durch Vertragstaxis nach dem Gesamtvertrag
 * zwischen dem Fachverband für die Beförderungsgewerbe mit Personenkraftwagen
 * und dem Dachverband (§ 9, Anlage 2) — die Positionen, mit denen eine Fahrt in
 * der DKT-Abrechnung als Leistung (Datenblock „L") erscheint.
 *
 * Quellen:
 * - „TARIFLISTE Krankenbeförderung durch Vertragstaxi, gültig ab 01.01.2025"
 *   samt Erläuterungen 1–3 (ÖGK an den Fachverband, 16.12.2024, Seite 3).
 * - Gesamtvertrag § 9 Abs. 3–5 und 7.
 * - Fachverband-Rundschreiben „Krankenbeförderungs-Tarife 2026" vom 15.12.2025:
 *   Die Valorisierung nach § 9 Abs. 3 „wird für den Zeitraum 01.01.2026 bis
 *   31.12.2026 nicht angewendet" — die Liste von 2025 gilt 2026 unverändert.
 * - ÖGK-Informationsblatt „Krankenbeförderung ab 01.01.2024" (Stand 27.02.2026).
 * - WKO-Fachverband, Klarstellung „Mehrfachtransporte" (ab 1.6.2025).
 *
 * Die Tarife stehen als Daten mit Gültigkeitszeitraum. Ab 01.01.2027 wird wieder
 * valorisiert (§ 9 Abs. 3); für Fahrten außerhalb eines hinterlegten Zeitraums
 * bricht die Rechnung ab, statt mit alten Sätzen weiterzurechnen.
 *
 * Gerechnet wird je Fahrt in eine Richtung („sowohl für den Transport zur …
 * Behandlungsstelle … als auch retour", § 9 Abs. 4): Hin- und Rückfahrt sind zwei
 * Aufrufe. Abgegolten werden nur Kilometer mit dem Versicherten an Bord — „keine
 * Leerkilometer, keine Wartezeiten" (Informationsblatt; § 9 Abs. 7).
 */

/** Landeshauptstädte mit Ortspauschale. Wien führt die Tarifliste ohne Betrag („-"). */
export type Landeshauptstadt =
  'Bregenz' | 'Eisenstadt' | 'Salzburg' | 'Graz' | 'Innsbruck' | 'Klagenfurt' | 'St. Pölten' | 'Linz';

/** Eine Tarifposition in der Form, in der sie in den Datenblock „L" eingeht. */
export interface TaxiLeistung {
  /** POSNR laut Tarifliste. */
  position: string;
  /** Positionsbezeichnung laut Tarifliste. */
  bezeichnung: string;
  /** Netto-Tarif in Cent (TAR). */
  tarifCent: number;
  /** Kilometer bzw. 1 bei einer Pauschale (ANZKM). */
  anzahl: number;
  /** Nettobetrag in Cent, Tarif × Anzahl. */
  betragCent: number;
}

interface Paar {
  /** Position ohne und mit Rollstuhl-Aufschlag. */
  readonly normal: readonly [position: string, cent: number];
  readonly rollstuhl: readonly [position: string, cent: number];
}

interface Tarifstand {
  /** Erster und letzter Fahrttag, für den der Stand belegt ist (JJJJ-MM-TT). */
  readonly von: string;
  readonly bis: string;
  readonly km: Paar;
  readonly kmMehrfach: Paar;
  readonly mindestpauschale: Paar;
  readonly stadt: Readonly<Record<Landeshauptstadt, Paar>>;
}

const paar = (pn: string, n: number, pr: string, r: number): Paar => ({
  normal: [pn, n],
  rollstuhl: [pr, r],
});

/**
 * Tarifliste gültig ab 01.01.2025, Positionen 050–071. Die Rollstuhl-Positionen
 * („+15 %") und die halben Sätze („1/2 mehrfach") sind dort als eigene Beträge
 * ausgewiesen; sie werden übernommen, nicht nachgerechnet. Positionen 072–074
 * (Wien, Ausland) stehen ohne Betrag in der Liste und fehlen deshalb.
 */
const TARIFE: readonly Tarifstand[] = [
  {
    von: '2025-01-01',
    bis: '2026-12-31',
    km: paar('050', 186, '051', 214),
    kmMehrfach: paar('052', 93, '053', 108),
    mindestpauschale: paar('054', 1035, '055', 1190),
    stadt: {
      Bregenz: paar('056', 1242, '057', 1428),
      Eisenstadt: paar('058', 1242, '059', 1428),
      Salzburg: paar('060', 1242, '061', 1428),
      Graz: paar('062', 1449, '063', 1666),
      Innsbruck: paar('064', 1449, '065', 1666),
      Klagenfurt: paar('066', 1449, '067', 1666),
      'St. Pölten': paar('068', 1449, '069', 1666),
      Linz: paar('070', 1656, '071', 1904),
    },
  },
];

function fehler(text: string): EldaError {
  return new EldaError(`Taxitarif: ${text}`);
}

function tarifstand(datum: string): Tarifstand {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw fehler('Fahrtdatum im Format JJJJ-MM-TT erwartet.');
  const stand = TARIFE.find((t) => datum >= t.von && datum <= t.bis);
  if (stand === undefined) {
    throw fehler(
      `Für den ${datum} ist kein Tarif hinterlegt (belegt: ${TARIFE.map((t) => `${t.von} bis ${t.bis}`).join(', ')}). ` +
        'Die Tarife werden jährlich valorisiert (Gesamtvertrag § 9 Abs. 3).',
    );
  }
  return stand;
}

function pruefeKilometer(kilometer: number): void {
  if (!Number.isSafeInteger(kilometer) || kilometer < 1 || kilometer > 9999) {
    throw fehler('Kilometer müssen eine ganze Zahl von 1 bis 9999 sein (ganze Kilometer, § 9 Abs. 5).');
  }
}

const BEZEICHNUNG = {
  km: 'km-Tarif',
  kmMehrfach: 'km-Tarif 1/2 mehrfach',
  mindestpauschale: 'Mindestpauschale',
} as const;

function leistung(p: Paar, rollstuhl: boolean, bezeichnung: string, anzahl: number): TaxiLeistung {
  const [position, tarifCent] = rollstuhl ? p.rollstuhl : p.normal;
  return {
    position,
    bezeichnung: rollstuhl ? `${bezeichnung} +15 % Rollstuhl` : bezeichnung,
    tarifCent,
    anzahl,
    betragCent: tarifCent * anzahl,
  };
}

/** Eingabe für {@link taxiEinzelfahrt}. */
export interface TaxiEinzelfahrt {
  /** Fahrtdatum (JJJJ-MM-TT) — bestimmt den Tarifstand. */
  datum: string;
  /**
   * Entfernung in ganzen Kilometern laut Distanzanzeiger, Abholort bis
   * Bestimmungsort (§ 9 Abs. 5).
   */
  kilometer: number;
  /**
   * Patient sitzt im eigenen Rollstuhl in einem dafür ausgerüsteten Fahrzeug —
   * „Aufschlag von 15 % auf den jeweiligen Tarif" (Erläuterung 3).
   */
  rollstuhl?: boolean;
  /**
   * Ausgangs- und Zielort liegen innerhalb des Stadtgebiets dieser
   * Landeshauptstadt (Ortstafel) — dann gilt die Ortspauschale (Erläuterung 3).
   * Ob das zutrifft, weiß nur der Aufrufer.
   */
  ortspauschale?: Landeshauptstadt;
}

/**
 * Leistung für die Fahrt eines einzelnen Versicherten in eine Richtung.
 *
 * - Innerhalb einer Landeshauptstadt: die Ortspauschale (Erläuterung 3).
 * - Sonst der km-Tarif, mindestens aber die Mindestpauschale: „Für kurze
 *   Strecken ist eine Mindestpauschale vorgesehen" (Informationsblatt). Ab
 *   welcher Strecke, nennt keine Quelle; als Mindestbetrag gelesen greift sie,
 *   solange Kilometer × km-Tarif darunter liegt — dieselbe Lesart wie in
 *   Erläuterung 2 („unterschreitet die Mindestpauschale").
 */
export function taxiEinzelfahrt(e: TaxiEinzelfahrt): TaxiLeistung {
  const stand = tarifstand(e.datum);
  pruefeKilometer(e.kilometer);
  const rollstuhl = e.rollstuhl === true;
  if (e.ortspauschale !== undefined) {
    const p = stand.stadt[e.ortspauschale];
    if (p === undefined) {
      throw fehler(`Für '${String(e.ortspauschale)}' führt die Tarifliste keine Ortspauschale.`);
    }
    return leistung(p, rollstuhl, `Pauschale ${e.ortspauschale}`, 1);
  }
  const nachKm = leistung(stand.km, rollstuhl, BEZEICHNUNG.km, e.kilometer);
  const mindest = leistung(stand.mindestpauschale, rollstuhl, BEZEICHNUNG.mindestpauschale, 1);
  return nachKm.betragCent < mindest.betragCent ? mindest : nachKm;
}

/** Eingabe für {@link taxiMehrfachtransport}. */
export interface TaxiMehrfachtransport {
  /** Fahrtdatum (JJJJ-MM-TT). */
  datum: string;
  /**
   * Strecke „vom Ausgangsort des ersten Versicherten bis zum Zielort des letzten
   * Versicherten" in ganzen Kilometern (§ 9 Abs. 4, Erläuterung 1). Sie gilt für
   * alle Versicherten der Fahrt.
   */
  kilometer: number;
  /** Die transportierten Versicherten in der Reihenfolge der Abrechnung, mindestens zwei. */
  versicherte: readonly { rollstuhl?: boolean }[];
}

/**
 * Leistungen eines Mehrfachtransports, je Versichertem eine — oder `null`, wenn
 * für ihn nichts verrechenbar ist.
 *
 * - Erster Versicherter 100 %, ab dem zweiten 50 % des km-Tarifs (§ 9 Abs. 4,
 *   Erläuterung 1).
 * - „Bei Mehrfachtransporten kommen keine Pauschalen zur Anwendung. Sollte …
 *   die Summe aller transportierten Versicherten … die Mindestpauschale
 *   [unterschreiten], so ist die Mindestpauschale nur für einen Versicherten
 *   verrechenbar" (Erläuterung 2). Verrechnet wird sie hier beim ersten
 *   Versicherten; die übrigen bekommen `null`. Für welchen Versicherten sie zu
 *   verrechnen ist und ob dabei dessen Rollstuhl-Aufschlag gilt, sagt die Quelle
 *   nicht — gewählt ist der erste samt seinem Aufschlag.
 *
 * Nicht geprüft, weil dafür die Einzelstrecken nötig wären: ob überhaupt ein
 * Mehrfachtransport abzurechnen ist (siehe {@link alsMehrfachtransportAbzurechnen})
 * und dass die Erstattung „die Höhe von Einzeltransporten nicht überschreiten"
 * darf (Informationsblatt).
 */
export function taxiMehrfachtransport(e: TaxiMehrfachtransport): (TaxiLeistung | null)[] {
  const stand = tarifstand(e.datum);
  pruefeKilometer(e.kilometer);
  if (e.versicherte.length < 2) throw fehler('Ein Mehrfachtransport hat mindestens zwei Versicherte.');
  const leistungen = e.versicherte.map((v, i) =>
    i === 0
      ? leistung(stand.km, v.rollstuhl === true, BEZEICHNUNG.km, e.kilometer)
      : leistung(stand.kmMehrfach, v.rollstuhl === true, BEZEICHNUNG.kmMehrfach, e.kilometer),
  );
  const mindest = leistung(
    stand.mindestpauschale,
    e.versicherte[0]!.rollstuhl === true,
    BEZEICHNUNG.mindestpauschale,
    1,
  );
  const summe = leistungen.reduce((s, l) => s + l.betragCent, 0);
  if (summe < mindest.betragCent) return [mindest, ...leistungen.slice(1).map(() => null)];
  return leistungen;
}

/**
 * Klarstellung der ÖGK zu Mehrfachtransporten (über den WKO-Fachverband, gültig
 * für Transporte ab 1. Juni 2025, mit SVS und BVAEB abgestimmt): Ein
 * Mehrfachtransport ist nur dann als solcher abzurechnen, „wenn der zweite (oder
 * jeder weitere) Patient zumindest die Hälfte der Strecke des ersten Patienten
 * befördert wird"; sonst „sind stattdessen Einzeltransporte abzurechnen".
 * Beispiele dort: 100 km und 90 km → Mehrfachtransport; 100 km und 10 km →
 * Einzeltransporte.
 *
 * Die Kennzeichnung „MF" samt Versicherungsnummern ist in beiden Fällen zu
 * setzen („egal ob als Einzeltransport abgerechnet oder nicht").
 */
export function alsMehrfachtransportAbzurechnen(
  kilometerErster: number,
  kilometerWeitere: readonly number[],
): boolean {
  pruefeKilometer(kilometerErster);
  if (kilometerWeitere.length < 1) throw fehler('Mindestens ein weiterer Patient ist anzugeben.');
  kilometerWeitere.forEach(pruefeKilometer);
  return kilometerWeitere.every((km) => km * 2 >= kilometerErster);
}
