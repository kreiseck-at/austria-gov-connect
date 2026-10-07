/**
 * Codekataloge der mBGM: Verrechnungsbasis-Typen (D.58) und
 * Verrechnungspositions-Typen (D.60), samt der Regeln, welche Position zu
 * welcher Basis gehört (D.60, Seiten 149–161).
 *
 * **Nicht enthalten ist die Tarifgruppe** (BSGR/ERGB). Deren zulässige Werte
 * stehen ausdrücklich nicht im Dokument: „Zulässige Werte für die Tarifgruppe
 * siehe Tarifsystem (Das Tarifsystem ist auf der Webseite der
 * Sozialversicherung abrufbar: https://www.sozialversicherung.at/tarifsystem)."
 * (D.48, Seite 128). Der Katalog wird periodisch geändert — die Fassung vom
 * 01.07.2026 führt allein für die ÖGK 228 gültige Tarifgruppen. Ihn hier
 * mitzuliefern hieße, nach der nächsten Änderung stillschweigend falsche
 * Meldungen zu bauen. Die Tarifgruppe übergibt deshalb der Aufrufer.
 */

// --- D.58 Verrechnungsbasis-Typ (Seiten 140–141) ---------------------------

/** Verrechnungsbasis-Typen laut D.58. */
export const VBTY_CODES = {
  AB: 'allgemeine Beitragsgrundlage',
  UU: 'Beitragsgrundlage bei unbezahltem Urlaub',
  SZ: 'Sonderzahlung',
  BV: 'Beitragsgrundlage zur BV',
  BB: 'Beitrag zur BV',
  AZ: 'allgemeine Beitragsgrundlage für spezielle AV-Minderung',
  SA: 'Sonderzahlung für spezielle AV-Minderung',
  SO: 'Beitragsgrundlage DAG fallweise / kürzer als ein Monat vereinbarte geringfügige Beschäftigung',
  SW: 'Differenzbeitragsgrundlage SW-Entschädigung',
  EH: 'Differenzbeitragsgrundlage Entwicklungshelfer',
  SE: 'Service-Entgelt',
  AA: 'Auflösungsabgabe (gültig bis 31.12.2019)',
  PA: 'allgemeine Beitragsgrundlage PV ÖBB',
  PS: 'Sonderzahlung PV ÖBB',
  SR: 'Differenzbeitragsgrundlage SW-Entschädigungs-Reduktion',
  KE: 'Beitragsgrundlage für gekürztes Entgelt',
  UH: 'allgemeine Beitragsgrundlage für die Berechnung der Beiträge zur Unfallversicherung über der Höchstbeitragsgrundlage',
  RP: 'Allgemeine Beitragsgrundlage für PV-Reduktion',
} as const;

/**
 * Wozu die besonderen Basistypen da sind — aus den Spezialfällen in
 * Kapitel E.32.2.15. Ohne diesen Zusammenhang wirken sie wie Dubletten der
 * allgemeinen Beitragsgrundlage.
 *
 * - `AZ`/`SA` — **abweichende Grundlage für die AV-Minderung** (E.32.2.15.1).
 *   Weicht die Beitragsgrundlage für die SV vom tatsächlichen Entgelt ab (etwa
 *   bei Altersteilzeit: fiktive Grundlage in Höhe des Einkommens vor der
 *   Herabsetzung), darf die Minderung des AV-Beitrags nur das **tatsächliche**
 *   Entgelt betreffen — den Dienstnehmeranteil aus der Differenz trägt der
 *   Dienstgeber allein, er kann nicht entfallen. Deshalb eine eigene Basis.
 *   Genau darum tragen `AZ` und `SA` **keine** Standard-Tarifgruppenverrechnung.
 * - `UU` — **unbezahlter Urlaub** (E.32.2.15.2). Normale Versicherungszeit und
 *   unbezahlter Urlaub im selben Beitragszeitraum gehören in **eine** mBGM,
 *   dort aber getrennt.
 * - `SR` — **Reduktion der SW-Entschädigung bei Kurzarbeit** (E.32.2.15.6). Die
 *   Standardverrechnung rechnet auf dem Einkommen vor der Kurzarbeit und ergibt
 *   damit einen zu hohen Schlechtwetterentschädigungsbeitrag; über diese Basis
 *   und den Abschlag `A21` wird die Differenz wieder herausgerechnet.
 *
 * Zur Verrechnungszeit-Unterbrechung (E.32.2.15.5) hält das Dokument fest:
 * „Bei Übermittlung der mBGM ist jedenfalls darauf zu achten, dass es zu keinen
 * Rundungsdifferenzen kommt. Somit muss das Einkommen vor und nach der
 * Unterbrechung gem. Granularität der Tarifblöcke auch in der Lohnverrechnung
 * getrennt voneinander betrachtet/berechnet werden." Das betrifft den
 * Aufrufer, nicht dieses Paket — ein nachträgliches Aufteilen einer bereits
 * gerundeten Summe erzeugt genau die Differenzen, die dort gemeint sind.
 */

/** Ein Verrechnungsbasis-Typ. */
export type VbtyCode = keyof typeof VBTY_CODES;

/**
 * Aus D.58: „Jeder Verrechnungsbasis-Typ darf für einen Tarifblock nur einmal
 * verwendet werden. Alle zu diesem Verrechnungsbasis-Typ gehörigen
 * Verrechnungspositionen sind diesem Typ unterzuordnen."
 */
export const VBTY_NUR_EINMAL_JE_TARIFBLOCK = true;

// --- D.60 Verrechnungspositions-Typ (Seiten 149–161) -----------------------

/**
 * Einschränkung eines Positionstyps, wie sie das Dokument in Fußnoten führt.
 * Ohne Eintrag gilt der Typ allgemein.
 */
export interface VptyEinschraenkung {
  /** Wörtlich aus der Fußnote. */
  readonly text: string;
  /** Fußnotennummer im Dokument, zur Rückverfolgung. */
  readonly fussnote: number;
}

/** Kategorie eines Positionstyps laut D.60, Seite 150. */
export type VptyArt = 'standard' | 'vorsorge' | 'abschlag' | 'zuschlag';

/** Ein Verrechnungspositions-Typ mit Bezeichnung, Kategorie und Einschränkung. */
export interface VptyEintrag {
  readonly bezeichnung: string;
  readonly art: VptyArt;
  readonly einschraenkung?: VptyEinschraenkung;
}

const NUR_BVAEB: VptyEinschraenkung = { text: 'Nur zu verwenden für die BVAEB', fussnote: 50 };
const AB_07_2026: VptyEinschraenkung = { text: 'Gültig für Beitragszeiträume ab 07/2026', fussnote: 60 };
const NUR_BKK_WIEN: VptyEinschraenkung = {
  text: 'Nur zu verwenden für die BKK der Wiener Verkehrsbetriebe',
  fussnote: 51,
};

/**
 * Die 48 Verrechnungspositions-Typen laut D.60.
 *
 * Aus D.60 (Seite 150): „Der Verrechnungsposition-Typ legt fest, um welche Art
 * von Verrechnung es sich handelt. […] Dabei werden grundsätzlich vier Arten
 * von Verrechnung unterschieden: 1) Standard-Tarifgruppenverrechnung
 * 2) Verrechnung der betrieblichen Vorsorge 3) Abschläge (das sind
 * Verrechnungspositionen, die den Gesamt-Beitrag reduzieren) 4) Zuschläge (das
 * sind Verrechnungspositionen, die den Gesamt-Beitrag erhöhen)."
 *
 * Die Einschränkungen stammen aus den Fußnoten derselben Seiten. Sie sind
 * bewusst als Daten hinterlegt und nicht in Code gegossen: Ob eine Meldung
 * einen auf die BVAEB beschränkten Typ verwenden darf, hängt vom
 * Versicherungsträger ab, den dieses Paket nicht kennt.
 */
export const VPTY_CODES: Readonly<Record<string, VptyEintrag>> = {
  T01: { bezeichnung: 'Standard-Tarifgruppenverrechnung', art: 'standard' },
  T02: { bezeichnung: 'Standard-Tarifgruppenverrechnung (Sonderzahlung)', art: 'standard' },
  T03: { bezeichnung: 'Standard-Tarifgruppenverrechnung (unbezahlter Urlaub)', art: 'standard' },
  P01: {
    bezeichnung: 'Standard-Tarifgruppenverrechnung PV-BGL ÖBB',
    art: 'standard',
    einschraenkung: NUR_BVAEB,
  },
  P02: {
    bezeichnung: 'Standard-Tarifgruppenverrechnung PV-BGL ÖBB (Sonderzahlung)',
    art: 'standard',
    einschraenkung: NUR_BVAEB,
  },

  V01: { bezeichnung: 'Betriebliche Vorsorge', art: 'vorsorge' },

  // Minderung der AV bei geringem Einkommen. Seite 152: „Ab dem 01.01.2027 muss
  // für die Minderung der AV bei geringem Einkommen der Beginn des
  // Dienstverhältnisses berücksichtigt werden. Für zum 31. Dezember 2026
  // aufrechte Dienstverhältnisse gelten die Abschläge Mind. AV (ALT) […], für
  // nach dem 31. Dezember 2026 beginnende Dienstverhältnisse gelten die
  // Abschläge Mind. AV (NEU) […]". Den Beginn des Dienstverhältnisses kennt die
  // mBGM nicht; die Wahl zwischen ALT und NEU trifft der Aufrufer.
  A01: {
    bezeichnung: 'Mind. AV (ALT) – Bereich 3',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2027', fussnote: 44 },
  },
  A02: {
    bezeichnung: 'Mind. AV (ALT) – Bereich 2',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2029', fussnote: 45 },
  },
  A03: {
    bezeichnung: 'Mind. AV (ALT) – Bereich 1',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2031', fussnote: 46 },
  },
  A04: {
    bezeichnung: 'Mind. AV (ALT) – Bereich 1 (Lg.)',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2028', fussnote: 47 },
  },
  A05: {
    bezeichnung: 'Minderung AV auf 1% (Lg.)',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2026', fussnote: 48 },
  },
  A07: { bezeichnung: 'WF-Entfall Neugründerförderung', art: 'abschlag' },
  A08: { bezeichnung: 'UV-Entfall Neugründerförderung', art: 'abschlag' },
  A09: { bezeichnung: 'UV-Entfall 60. LJ vollendet', art: 'abschlag' },
  A10: { bezeichnung: 'AV+IE Entfall Pensionsanspruch', art: 'abschlag' },
  A11: {
    bezeichnung: 'Bonus-Altfall',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2025', fussnote: 49 },
  },
  A12: { bezeichnung: 'AV Entfall Pensionsanspruch (IE-freie DV)', art: 'abschlag' },
  A13: { bezeichnung: 'Entfall AV - Lehrlingssonderfall alt', art: 'abschlag' },
  A14: { bezeichnung: 'Entfall AV - Lehrlingssonderfall', art: 'abschlag' },
  A15: { bezeichnung: 'Minderung PV um 50%', art: 'abschlag' },
  A16: { bezeichnung: 'Entf. UV (NeuFög) Bergbau', art: 'abschlag', einschraenkung: NUR_BVAEB },
  A17: { bezeichnung: 'Entf. UV (60. LJ) Bergbau', art: 'abschlag', einschraenkung: NUR_BVAEB },
  A18: { bezeichnung: 'ALV Entfall – Aktion 56/58', art: 'abschlag', einschraenkung: NUR_BKK_WIEN },
  A19: { bezeichnung: 'UV-Entfall 60. LJ vollendet', art: 'abschlag', einschraenkung: NUR_BKK_WIEN },
  A20: { bezeichnung: 'Anspruch Vorzeitige Alterspension', art: 'abschlag', einschraenkung: NUR_BKK_WIEN },
  A21: { bezeichnung: 'Reduktion der SW-Entschädigung', art: 'abschlag' },
  A22: {
    bezeichnung: 'Reduktion DN-Anteil PV',
    art: 'abschlag',
    einschraenkung: { text: 'Nur gültig für Beitragszeiträume in den Jahren 2024 und 2025', fussnote: 52 },
  },
  A23: {
    bezeichnung: 'Reduktion DN-Anteil KV-Pensionisten 2025',
    art: 'abschlag',
    einschraenkung: {
      text: 'Nur zu verwenden für die BVAEB für Beitragszeiträume 06/2025 bis 12/2025',
      fussnote: 53,
    },
  },
  A24: {
    bezeichnung: 'WF-Entfall NeuFög Ergänzung Wien',
    art: 'abschlag',
    einschraenkung: { text: 'Nur gültig für Beitragskonten in Wien', fussnote: 54 },
  },
  A25: {
    bezeichnung: 'Mind. AV (NEU) – Bereich 1',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2028', fussnote: 55 },
  },
  A26: {
    bezeichnung: 'Mind. AV (NEU) – Bereich 2',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2027', fussnote: 56 },
  },
  A27: {
    bezeichnung: 'Mind. AV (NEU) – Bereich 1 (Lg.)',
    art: 'abschlag',
    einschraenkung: { text: 'Gültig bis 31.12.2027', fussnote: 57 },
  },

  Z01: { bezeichnung: 'Dienstgeberabgabe', art: 'zuschlag' },
  Z02: { bezeichnung: 'Service-Entgelt', art: 'zuschlag' },
  Z03: { bezeichnung: 'Auflösungsabgabe (gültig bis 31.12.2019)', art: 'zuschlag' },
  Z04: { bezeichnung: 'BV-Zuschlag bei jährlicher Zahlung', art: 'zuschlag' },
  Z05: { bezeichnung: 'Weiterbildungsbeitrag - AÜG', art: 'zuschlag' },
  Z06: { bezeichnung: 'KV-Beitrag für SW-Entschädigung', art: 'zuschlag' },
  Z07: { bezeichnung: 'Differenzbeitrag Entwicklungshelfer', art: 'zuschlag' },
  Z10: {
    bezeichnung: 'LK-Umlage für SZ und unbezahlten Urlaub',
    art: 'zuschlag',
    einschraenkung: {
      text: 'Nur zu verwenden in Kärnten (für Sonderzahlungen) sowie Kärnten und Steiermark (bei unbezahltem Urlaub)',
      fussnote: 58,
    },
  },
  Z11: { bezeichnung: 'KV-Beitrag für SW-Entschädigung Lehrling', art: 'zuschlag' },
  Z12: { bezeichnung: 'KV-Beitrag für gekürztes Entgelt', art: 'zuschlag', einschraenkung: NUR_BVAEB },
  Z13: {
    bezeichnung: 'UV-Beitrag über der Höchstbeitragsgrundlage',
    art: 'zuschlag',
    einschraenkung: NUR_BVAEB,
  },
  Z14: {
    bezeichnung: 'Zuschlag zum WF in Wien',
    art: 'zuschlag',
    einschraenkung: { text: 'Nur gültig für Beitragskonten in Wien', fussnote: 59 },
  },
  Z15: {
    bezeichnung: 'Beitrag Sozialfonds Bewachungsgewerbe',
    art: 'zuschlag',
    einschraenkung: AB_07_2026,
  },
  Z16: {
    bezeichnung: 'Beitrag Sozialfonds Gebäudereinigungsgewerbe',
    art: 'zuschlag',
    einschraenkung: AB_07_2026,
  },
  Z21: { bezeichnung: 'UF-Beitrag für Beamte der Stadt Wien', art: 'zuschlag', einschraenkung: NUR_BKK_WIEN },
  Z22: {
    bezeichnung: 'Mitversicherung gem. § 51d ASVG – Verrechnung über Dienstgeber',
    art: 'zuschlag',
    einschraenkung: NUR_BKK_WIEN,
  },
};

/** Ein Verrechnungspositions-Typ. */
export type VptyCode = keyof typeof VPTY_CODES;

// --- Zulässige Kombinationen (D.60, Seiten 153–156) ------------------------

/**
 * Verrechnungsbasis-Typen, zu denen es **genau eine** Verrechnungsposition
 * geben muss (D.60, Seite 155): „Das bedeutet, dass es zu einer
 * Verrechnungsbasis vom Typ auf der linken Seite der Liste immer genau eine
 * Verrechnungsposition von Typ auf der rechten Seite der Liste geben muss."
 *
 * `SW` ist der einzige Basistyp mit zwei zulässigen Positionen — je nachdem, ob
 * die Entschädigung einen Lehrling betrifft. „Genau eine" heißt dort: eine der
 * beiden, nicht beide.
 *
 * `KE`, `UH` und `RP` fehlten hier bis zum 04.08.2026, mit der Begründung, das
 * Dokument führe für sie keine Zuordnung. Das war falsch: Alle drei stehen in
 * derselben Liste auf Seite 155, in Schwarzdruck, also nicht einmal neu in
 * dieser Ergänzung. Solange sie fehlten, wurde zu einer Basis dieser Typen
 * weder die Zulässigkeit der Position geprüft noch die zwingende Position
 * eingefordert — beides ging kommentarlos durch.
 */
export const EINS_ZU_EINS: Readonly<Record<string, readonly VptyCode[]>> = {
  BV: ['V01'],
  BB: ['Z04'],
  SO: ['Z01'],
  SW: ['Z06', 'Z11'],
  EH: ['Z07'],
  SE: ['Z02'],
  AA: ['Z03'],
  PA: ['P01'],
  PS: ['P02'],
  SR: ['A21'],
  KE: ['Z12'],
  UH: ['Z13'],
  RP: ['A22'],
};

/**
 * Einschränkungen der Verrechnungsbasis-Typen aus den Fußnoten zu D.58
 * (Seite 140).
 *
 * Bis zum 04.08.2026 waren nur die Einschränkungen der POSITIONS-Typen
 * hinterlegt. Dass auch Basistypen eingeschränkt sind, ging unter — `PA` und
 * `PS` waren nur mittelbar gedeckt, weil ihre zwingenden Positionen `P01`/`P02`
 * ihrerseits auf die BVAEB beschränkt sind. Für `KE`, `UH` und `RP` gab es gar
 * keine Entsprechung.
 */
export const VBTY_EINSCHRAENKUNG: Readonly<Record<string, string>> = {
  // Fußnote 40
  PA: 'Nur zu verwenden für die BVAEB',
  PS: 'Nur zu verwenden für die BVAEB',
  KE: 'Nur zu verwenden für die BVAEB',
  UH: 'Nur zu verwenden für die BVAEB',
  // Fußnote 41 — zeitlich, nicht trägerbezogen: Die Verwendbarkeit wird
  // gesondert kommuniziert, dann ab Beitragszeitraum 01/2024.
  RP: 'Verwendbarkeit wird gesondert kommuniziert, dann ab Beitragszeitraum 01/2024',
};

/**
 * Zulässigkeit je Kombination aus Verrechnungsbasis- und
 * Verrechnungspositions-Typ für die fünf „klassischen" Beitragsgrundlagen
 * (D.60, Seite 156).
 *
 * - `Z`  Angabe zwingend erforderlich
 * - `Z1` Angabe zulässig (zwingend, wenn zutreffend)
 * - fehlender Eintrag: nicht zulässig
 *
 * Lesart: `KOMBINATION.AB.T01 === 'Z'` heißt, dass zu einer Verrechnungsbasis
 * vom Typ `AB` zwingend eine Position `T01` gehört.
 */
export const KOMBINATION: Readonly<Record<string, Readonly<Record<string, 'Z' | 'Z1'>>>> = {
  AB: {
    T01: 'Z',
    A01: 'Z1',
    A02: 'Z1',
    A03: 'Z1',
    A04: 'Z1',
    A05: 'Z1',
    A07: 'Z1',
    A08: 'Z1',
    A09: 'Z1',
    A10: 'Z1',
    A11: 'Z1',
    A12: 'Z1',
    A13: 'Z1',
    A14: 'Z1',
    A15: 'Z1',
    A16: 'Z1',
    A17: 'Z1',
    A23: 'Z1',
    A24: 'Z1',
    A25: 'Z1',
    A26: 'Z1',
    A27: 'Z1',
    Z01: 'Z1',
    Z05: 'Z1',
    Z14: 'Z1',
    Z15: 'Z1',
    Z16: 'Z1',
  },
  SZ: {
    T02: 'Z',
    A01: 'Z1',
    A02: 'Z1',
    A03: 'Z1',
    A04: 'Z1',
    A05: 'Z1',
    A08: 'Z1',
    A09: 'Z1',
    A10: 'Z1',
    A11: 'Z1',
    A12: 'Z1',
    A13: 'Z1',
    A14: 'Z1',
    A15: 'Z1',
    A16: 'Z1',
    A17: 'Z1',
    A23: 'Z1',
    A25: 'Z1',
    A26: 'Z1',
    A27: 'Z1',
    Z01: 'Z1',
    Z05: 'Z1',
    Z10: 'Z1',
    Z15: 'Z1',
    Z16: 'Z1',
  },
  AZ: {
    A01: 'Z1',
    A02: 'Z1',
    A03: 'Z1',
    A04: 'Z1',
    A05: 'Z1',
    A25: 'Z1',
    A26: 'Z1',
    A27: 'Z1',
  },
  SA: {
    A01: 'Z1',
    A02: 'Z1',
    A03: 'Z1',
    A04: 'Z1',
    A05: 'Z1',
    A25: 'Z1',
    A26: 'Z1',
    A27: 'Z1',
  },
  UU: {
    T03: 'Z',
    A01: 'Z1',
    A02: 'Z1',
    A03: 'Z1',
    A04: 'Z1',
    A05: 'Z1',
    A08: 'Z1',
    A09: 'Z1',
    A10: 'Z1',
    A11: 'Z1',
    A12: 'Z1',
    A13: 'Z1',
    A14: 'Z1',
    A15: 'Z1',
    A16: 'Z1',
    A17: 'Z1',
    A25: 'Z1',
    A26: 'Z1',
    A27: 'Z1',
    Z05: 'Z1',
    Z10: 'Z1',
    Z15: 'Z1',
    Z16: 'Z1',
  },
};

Object.freeze(VBTY_CODES);
Object.freeze(VPTY_CODES);
Object.freeze(EINS_ZU_EINS);
Object.freeze(KOMBINATION);
for (const zeile of Object.values(KOMBINATION)) Object.freeze(zeile);
for (const eintrag of Object.values(VPTY_CODES)) Object.freeze(eintrag);

/**
 * Welche Verrechnungspositions-Typen zu einem Basistyp zulässig sind.
 *
 * Führt beide Tabellen aus D.60 zusammen: die 1:1-Beziehungen (Seite 155) und
 * die Kombinationstabelle der klassischen Beitragsgrundlagen.
 *
 * @returns `undefined`, wenn das Dokument für diesen Basistyp keine Zuordnung
 *   führt. Dann wird **nicht** geprüft — eine Ablehnung wäre geraten.
 *
 *   Hier stand einmal, das betreffe `KE`, `UH` und `RP`. Das war falsch: Alle
 *   drei stehen in der 1:1-Liste auf Seite 155. Seit sie dort eingetragen sind,
 *   liefert diese Funktion für sie ein Ergebnis, und `undefined` bleibt dem
 *   Fall vorbehalten, dass ein Basistyp tatsächlich in keiner der beiden
 *   Tabellen vorkommt.
 */
export function erlaubtePositionen(vbty: string): ReadonlySet<string> | undefined {
  const einsZuEins = EINS_ZU_EINS[vbty];
  if (einsZuEins) return new Set(einsZuEins);
  const zeile = KOMBINATION[vbty];
  if (zeile) return new Set(Object.keys(zeile));
  return undefined;
}

/**
 * Positionstypen, die zu einem Basistyp **zwingend** gehören — im Dokument mit
 * `Z` gekennzeichnet, bei den 1:1-Beziehungen durch „immer genau eine".
 */
export function zwingendePositionen(vbty: string): readonly string[] {
  const einsZuEins = EINS_ZU_EINS[vbty];
  // Bei SW hängt es davon ab, ob ein Lehrling betroffen ist — beide Positionen
  // sind zulässig, keine ist für sich zwingend. Dass GENAU EINE davon kommen
  // muss, trägt deshalb nicht diese Liste, sondern `genauEinePosition`.
  if (einsZuEins) return einsZuEins.length === 1 ? einsZuEins : [];
  const zeile = KOMBINATION[vbty];
  if (!zeile) return [];
  return Object.entries(zeile)
    .filter(([, stufe]) => stufe === 'Z')
    .map(([code]) => code);
}

/**
 * Ob zu einer Verrechnungsbasis dieses Typs **genau eine** Position gehören
 * muss.
 *
 * Der Wortlaut auf Seite 155: „Das bedeutet, dass es zu einer
 * Verrechnungsbasis vom Typ auf der linken Seite der Liste immer genau eine
 * Verrechnungsposition von Typ auf der rechten Seite der Liste geben muss."
 *
 * „Genau eine" gilt auch für `SW`, wo zwei Typen zur Auswahl stehen: einer von
 * beiden, nicht beide und nicht keiner. Das ließ sich über
 * {@link zwingendePositionen} nicht ausdrücken — dort ist `SW` leer, weil
 * keiner der beiden Typen für sich zwingend ist. Die Folge war, dass eine
 * `SW`-Basis ganz ohne Position durchging.
 */
export function genauEinePosition(vbty: string): boolean {
  return EINS_ZU_EINS[vbty] !== undefined;
}
