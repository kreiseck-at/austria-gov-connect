import { EldaError } from './errors';
import type { RohSatz } from './bestand';
import {
  FELDER_PAKET,
  FELDER_MBGM,
  FELDER_TARIFBLOCK,
  FELDER_TARIFBLOCK_FALLWEISE,
  FELDER_TARIFBLOCK_KURZ,
  FELDER_VERRECHNUNGSBASIS,
  FELDER_VERRECHNUNGSPOSITION,
  SATZLAENGE_PAKET,
  SATZLAENGE_MBGM,
  SATZLAENGE_TARIFBLOCK,
  SATZLAENGE_TARIFBLOCK_FALLWEISE,
  SATZLAENGE_TARIFBLOCK_KURZ,
  SATZLAENGE_VERRECHNUNGSBASIS,
  SATZLAENGE_VERRECHNUNGSPOSITION,
} from './felder-e32';
import {
  VBTY_CODES,
  VPTY_CODES,
  erlaubtePositionen,
  zwingendePositionen,
  type VbtyCode,
  type VptyCode,
} from './codes-e32';
import { HOECHSTANZAHL } from './pruefung-e32';

/**
 * Zusammenbau der monatlichen Beitragsgrundlagenmeldung (Kapitel E.32).
 *
 * Die mBGM ist eine **Hierarchie aus Sätzen, deren Zugehörigkeit sich allein
 * aus der Reihenfolge ergibt** (Seite 337): „Alle nachfolgenden Satzarten bis
 * zur nächsten mBGM oder zum mBGM-Paket-Ende gehören zu diesem
 * Versicherten/dieser mBGM." Es gibt keine Verweis-IDs zwischen den Ebenen.
 * Deshalb erzeugt dieses Modul eine geordnete Satzfolge und nicht eine Menge.
 */

// --- Verfahren -------------------------------------------------------------

/**
 * Abrechnungsverfahren des Beitragskontos. Es bestimmt jede Satzart des Pakets
 * und ist **keine Eigenschaft der Meldung, sondern des Beitragskontos** — die
 * ÖGK legt es fest.
 *
 * Der Unterschied ist nicht kosmetisch: Beim Vorschreiber sind Prozentsatz und
 * Beitrag jeder Verrechnungsposition mit `Z4` gekennzeichnet — sie dürfen
 * mitgegeben werden, ihr Inhalt wird aber **nicht übernommen**. Dort rechnet
 * die ÖGK. Zusätzlich erwartet sie laut D.59 (Seite 141) den **unbegrenzten**
 * Beitragsgrundlagenbetrag, während die Selbstabrechnung den mit der
 * Höchstbeitragsgrundlage gedeckelten Wert verlangt. Derselbe Lohn führt also
 * je nach Verfahren zu einem anderen Betrag.
 */
export type Verfahren = 'selbstabrechnung' | 'vorschreibung';

// --- D.54 Verrechnungsgrundlage -------------------------------------------

/**
 * Verrechnungsgrundlage (`VERG`, D.54, Seite 134). **Keine Ja/Nein-Angabe**,
 * sondern eine Matrix: Sie sagt, ob es im Beitragszeitraum eine
 * Versicherungszeit gibt — und getrennt danach, ob sich Zeit und Verrechnung
 * auf die Sozialversicherung, die betriebliche Vorsorge oder beides beziehen.
 */
export const VERRECHNUNGSGRUNDLAGE = {
  /** SV-Verrechnung und BV-Verrechnung mit Zeit in der SV und BV. */
  SV_UND_BV_MIT_ZEIT: '1',
  /** SV-Verrechnung mit Zeit in der SV. */
  SV_MIT_ZEIT: '2',
  /** BV-Verrechnung mit Zeit in der BV. */
  BV_MIT_ZEIT: '3',
  /** SV-Verrechnung ohne Zeit in der SV. */
  SV_OHNE_ZEIT: '4',
  /** BV-Verrechnung ohne Zeit in der BV. */
  BV_OHNE_ZEIT: '5',
  /** SV-Verrechnung und BV-Verrechnung ohne Zeit in der SV und BV. */
  SV_UND_BV_OHNE_ZEIT: '6',
} as const;

/** Zulässige Werte der Verrechnungsgrundlage. */
export type Verrechnungsgrundlage = (typeof VERRECHNUNGSGRUNDLAGE)[keyof typeof VERRECHNUNGSGRUNDLAGE];

/** Verrechnungsgrundlagen, die eine Versicherungszeit ausweisen. */
const MIT_VERSICHERUNGSZEIT: ReadonlySet<string> = new Set(['1', '2', '3']);

// --- Eingabe ---------------------------------------------------------------

/** Eine einzelne Verrechnungsposition — die unterste Ebene der mBGM. */
export interface Verrechnungsposition {
  /** Positionstyp laut D.60, z. B. `'T01'` für die Standard-Tarifgruppenverrechnung. */
  typ: VptyCode;
  /**
   * Prozentsatz, kaufmännisch als Zahl — `12.75` für 12,75 %. Auf dem Draht
   * stehen drei Nachkommastellen ohne Trennzeichen (D.61), das übernimmt dieses
   * Modul. Ein negativer Wert setzt das Vorzeichenfeld `VPVZ` auf `'-'`.
   *
   * **Nur bei der Selbstabrechnung anzugeben.** Im Vorschreibeverfahren rechnet
   * die ÖGK; das Feld ist dort `Z4` — siehe {@link betragCent}.
   */
  prozentsatz?: number;
  /**
   * Beitrag in **Cent**, ganzzahlig. Das Vorzeichen wird nach `RSVZ`
   * übernommen; übergeben wird also `-1234` und nicht ein getrenntes
   * Vorzeichen.
   *
   * **Nur bei der Selbstabrechnung anzugeben.** Im Vorschreibeverfahren tragen
   * `VPVZ`, `VPTA`, `RSVZ` und `RSUM` die Pflichtstufe `Z4` — „Angabe möglich,
   * Feldinhalt wird **nicht übernommen**". Das Dokument lässt sie im
   * abgedruckten Beispiel 19 durchgehend leer, und der Prüfkatalog führt für
   * die Satzart `PV` keine Summenprüfung. Dieses Modul schreibt sie dort
   * deshalb nicht: Ein übertragener Wert hätte keinen Nutzen, aber ein Risiko —
   * beim Vorschreiber ist der richtige Grundlagenbetrag der **unbegrenzte**,
   * bei der Selbstabrechnung der mit der Höchstbeitragsgrundlage gedeckelte
   * (D.59). Wer versehentlich den falschen übergibt, schickt still Zahlen, die
   * zwar verworfen werden, aber in Mitschnitten und Protokollen stehen.
   */
  betragCent?: number;
}

/** Eine Verrechnungsbasis mit den ihr untergeordneten Positionen. */
export interface Verrechnungsbasis {
  /** Basistyp laut D.58, z. B. `'AB'` für die allgemeine Beitragsgrundlage. */
  typ: VbtyCode;
  /**
   * Betrag in **Cent**, ganzzahlig (D.59).
   *
   * Bei der Selbstabrechnung ist der mit der Höchstbeitragsgrundlage
   * **begrenzte**, beim Vorschreiber der **unbegrenzte** Wert einzusetzen. Für
   * die Beitragsgrundlage zur BV (`'BV'`) ist eine Begrenzung generell
   * unzulässig. Welcher Wert richtig ist, weiß nur der Aufrufer — dieses Modul
   * prüft ihn nicht gegen eine Höchstbeitragsgrundlage.
   */
  betragCent: number;
  /** Die dieser Basis untergeordneten Positionen, in der zu meldenden Reihenfolge. */
  positionen: readonly Verrechnungsposition[];
}

/**
 * Beschäftigungsfolge im Sinne von E.32.2.2.2. Sie bestimmt die Satzarten der
 * gesamten Meldung — mBGM **und** Tarifblock — und ist damit keine Nebenangabe:
 *
 * | Folge | mBGM (S / V) | Storno (S / V) | Tarifblock |
 * |---|---|---|---|
 * | `regelmaessig` | `G1` / `G2` | `R1` / `R2` | `T1` bzw. `T4` |
 * | `fallweise` | `G3` / `G4` | `R3` / `R4` | `T2` bzw. `T5` |
 * | `kuerzerAlsEinMonat` | `G5` / `G6` | `R5` / `R6` | `T3` bzw. `T6` |
 *
 * Je Versichertem und Beitragszeitraum ist **eine** mBGM pro Folge zulässig
 * (Grundsatz 1). Mehrere gleichartige Beschäftigungen gehören in dieselbe
 * mBGM, dort als mehrere Tarifblöcke.
 */
export type Beschaeftigungsfolge = 'regelmaessig' | 'fallweise' | 'kuerzerAlsEinMonat';

/** Ein Tarifblock mit den ihm untergeordneten Verrechnungsbasen. */
export interface Tarifblock {
  /**
   * Beschäftigtengruppe (`BSGR`, 4 Stellen) — zusammen mit den Ergänzungen die
   * Tarifgruppe. Zulässige Werte stehen **nicht** im Dokument, sondern im
   * Tarifsystem der Sozialversicherung; dieses Modul prüft nur die Form.
   */
  beschaeftigtengruppe: string;
  /** Bis zu fünf Ergänzungen zur Beschäftigtengruppe (`ERGB`, je 3 Stellen). */
  ergaenzungen?: readonly string[];
  /**
   * Beginn der Verrechnung (`VVON`) — der Tag im Beitragszeitraum, ab dem der
   * Tarifblock gilt. **Nur bei regelmäßiger Beschäftigung.** Bei einer mBGM
   * ohne Versicherungszeit ist laut D.63 zwingend `1` einzusetzen; das
   * erzwingt dieses Modul.
   */
  beginnDerVerrechnung?: number;
  /**
   * Beschäftigungstag (`FTAG`, D.55) — **nur bei fallweiser Beschäftigung**.
   * Je Beschäftigungstag ein eigener Tarifblock (E.32.2.2.2, Grundsatz 2a).
   */
  beschaeftigungstag?: number;
  /**
   * Erster Tag der kürzer als einen Monat vereinbarten Beschäftigung (`BTAB`,
   * D.56) — **nur bei dieser Beschäftigungsfolge**. Je Beschäftigungsabschnitt
   * ein eigener Tarifblock (Grundsatz 2b).
   */
  ersterTag?: number;
  /** Letzter Tag der kürzer als einen Monat vereinbarten Beschäftigung (`BTBS`, D.57). */
  letzterTag?: number;
  /**
   * Ob der Tarifblock (auch) eine Kündigungsentschädigung oder
   * Urlaubsersatzleistung enthält (`KEUE`, D.64). In einem Tarifblock ohne
   * Verrechnung ist das Feld gesperrt.
   */
  enthaeltKuendigungsentschaedigungOderUrlaubsersatz?: boolean;
  /** `true` erzeugt einen Tarifblock ohne Verrechnung (Satzart `T4` statt `T1`). */
  ohneVerrechnung?: boolean;
  /** Die diesem Tarifblock untergeordneten Verrechnungsbasen. */
  basen: readonly Verrechnungsbasis[];
}

/** Eine mBGM für einen Versicherten. */
export interface Beitragsgrundlagenmeldung {
  /** Eindeutige Identifikation dieser Meldung (`REFW`). */
  referenzwert: string;
  /**
   * Versicherungsnummer (`VSNR`, 10 Stellen). Entweder diese oder
   * {@link referenzVsnrAnforderung} muss angegeben sein — die Pflichtmatrix
   * druckt für beide Felder eine gemeinsame Zelle.
   */
  versicherungsnummer?: string;
  /** Referenzwert der VSNR-Anforderung (`REFV`), wenn die Nummer noch fehlt. */
  referenzVsnrAnforderung?: string;
  /** Familienname (`FANA`). */
  familienname: string;
  /** Vorname (`VONA`). */
  vorname: string;
  /** Verrechnungsgrundlage (`VERG`) — siehe {@link VERRECHNUNGSGRUNDLAGE}. */
  verrechnungsgrundlage: Verrechnungsgrundlage;
  /**
   * Beschäftigungsfolge — bestimmt Satzart der mBGM und des Tarifblocks.
   * Ohne Angabe gilt `regelmaessig`, der Normalfall.
   */
  folge?: Beschaeftigungsfolge;
  /** Die Tarifblöcke dieses Versicherten, in der zu meldenden Reihenfolge. */
  tarifbloecke: readonly Tarifblock[];
  /** Freies Informationsfeld für den Dienstgeber (`INF1`, 12 Stellen). */
  info1?: string;
  /** Zweites freies Informationsfeld (`INF2`, 12 Stellen). */
  info2?: string;
}

/*
 * Noch nicht über diese Schicht erreichbar:
 *
 * - **mBGM ohne Versicherten** (`G7`/`R7`). Laut den Fußnoten 67–69 zu
 *   Kapitel E.32.2.2.6 „nur für das BMJ" — für gewöhnliche Dienstgeber also
 *   gar nicht vorgesehen. Über die Satzschicht und `baueBestand` wäre die
 *   Meldung baubar; `pruefeAbfolge` lässt den Weg nur mit ausdrücklichem
 *   `bmj`-Schalter durch.
 *
 * Nicht geprüft, weil dieses Modul die Angaben nicht hat:
 *
 * - **Ob mehr als ein Tarifblock je mBGM sachlich berechtigt ist.** Dass
 *   grundsätzlich nur einer zulässig ist, prüft `pruefeMbgmPaket` als Warnung
 *   (ÖGK-FAK 3.1.11). Welcher der Ausnahmefälle vorliegt — mehrere
 *   Beschäftigungen im Zeitraum, unterschiedliche Verrechnung, Unterbrechung
 *   durch Abmeldung —, geht aus den übergebenen Daten nicht hervor. Bei
 *   fallweiser und kürzer-als-ein-Monat vereinbarter Beschäftigung ist je
 *   Beschäftigungszeit ohnehin ein eigener Block vorgesehen (FAK 3.2.8).
 * - **Ob die Voraussetzung für ein Storno erfüllt ist.** Zulässig ist es in
 *   beiden Verfahren; im Vorschreibeverfahren allerdings nur, solange die
 *   stornierte mBGM noch nicht vorgeschrieben wurde, oder bei einer
 *   Falschmeldung. Ob vorgeschrieben wurde, weiß nur der Aufrufer.
 * - **Ob das Storno der ursprünglichen Meldung zugeordnet werden kann.** Die
 *   ÖGK nennt in FAK 3.2.7 die Kriterien vollständig: Referenzwert der
 *   ursprünglichen Meldung, Beitragskontonummer und Beitragszeitraum des
 *   Pakets, Satzart der mBGM, Versicherungsnummer und Summe der Beiträge.
 *   Beitragskontonummer und Beitragszeitraum stammen aus den Paketoptionen und
 *   stimmen damit bauartbedingt; die Satzart leitet sich aus `folge` ab. Übrig
 *   bleiben `referenzUrspruenglicheMeldung`, `versicherungsnummer` und
 *   `summeCent` — sie muss der Aufrufer aus der ursprünglichen Meldung
 *   übernehmen. Passt eines davon nicht, weist ELDA das Storno nicht ab,
 *   sondern legt einen **Clearingfall** an: Es lässt sich weder verarbeiten
 *   noch seinerseits stornieren.
 */

/**
 * Storno einer bereits übermittelten mBGM.
 *
 * Eine Storno-Meldung besteht **nur aus dem mBGM-Satz** — Tarifblock,
 * Verrechnungsbasis und Verrechnungsposition sind dort ausdrücklich unzulässig
 * (E.32.2.2.2 und E.32.2.2.6).
 *
 * **Wann ein Storno nötig ist, unterscheidet sich nach Verfahren:**
 *
 * - *Selbstabrechnung:* „Bei Änderungen einer mBGM ist im Bereich der
 *   Selbstabrechnung **immer** ein Storno der zuletzt übermittelten mBGM mit
 *   nachfolgender neuer mBGM erforderlich." Auch beim Nachreichen fehlender
 *   Teile — eine Differenzmeldung gibt es nicht.
 * - *Vorschreibung:* Bei **regelmäßiger** Beschäftigung ist grundsätzlich
 *   **kein** Storno zulässig; die neue mBGM überschreibt die bisherige. Ein
 *   Storno ist nur zulässig, solange noch nicht vorgeschrieben wurde, oder bei
 *   einer Falschmeldung (etwa falsche Versicherungsnummer). Bei fallweiser
 *   Beschäftigung ist Storno und Neumeldung dagegen stets erforderlich.
 *
 * Dieses Modul erzwingt die Verfahrensregel nicht — ob bereits vorgeschrieben
 * wurde, weiß nur der Aufrufer.
 */
export interface Stornomeldung {
  /** Eindeutige Identifikation dieser Storno-Meldung (`REFW`). */
  referenzwert: string;
  /**
   * Referenzwert der zu stornierenden Meldung (`REFU`). Zwingend — über ihn
   * wird die ursprüngliche mBGM identifiziert.
   */
  referenzUrspruenglicheMeldung: string;
  /**
   * Versicherungsnummer (`VSNR`). Beim Storno **einzeln zwingend**; die
   * Alternative „Versicherungsnummer ODER Referenz auf die VSNR-Anforderung"
   * gilt hier nicht (Pflichtmatrix, Seite 345).
   */
  versicherungsnummer: string;
  /**
   * Beschäftigungsfolge der zu stornierenden Meldung. Sie bestimmt die Satzart
   * des Stornos, und die zählt laut ÖGK-FAK 3.2.7 zu den Kriterien, über die
   * die ÖGK das Storno der ursprünglichen mBGM zuordnet: Ein `R1` storniert
   * kein `G3`.
   */
  folge?: Beschaeftigungsfolge;
  /**
   * Summe der Beiträge (`VSUM`) in **Cent**, nicht negativ.
   *
   * Aus E.32.2.2.2: „Das Datenfeld für die Summe der Beiträge für einen
   * Versicherten (VSUM) besitzt kein Vorzeichen. […] Allerdings ist bei der
   * Summierung der mBGM in einem mBGM-Paket (im Datenfeld GSUM) die VSUM der
   * Storno-mBGM **abzuziehen**." Genau das tut dieses Modul.
   *
   * Der Betrag muss dem der zu stornierenden mBGM entsprechen (Seite 338).
   * Er ist eines der Kriterien, über die die ÖGK das Storno der ursprünglichen
   * Meldung zuordnet (FAK 3.2.7) — nicht bloß eine Plausibilitätsangabe.
   * Prüfen lässt sich das hier nicht: Die ursprüngliche Meldung liegt diesem
   * Modul nicht vor.
   *
   * Ein Teilstorno gibt es nicht. Auch wenn nur ein einzelner Tag oder eine
   * einzelne Verrechnungsbasis falsch war, ist die **gesamte** mBGM zu
   * stornieren und neu zu melden: „Da keine Differenzmeldungen möglich sind,
   * ist es auch nicht möglich, einzelne Tarifblöcke zu korrigieren" (FAK
   * 3.2.8).
   */
  summeCent: number;
  /** Freies Informationsfeld (`INF1`). */
  info1?: string;
  /** Zweites freies Informationsfeld (`INF2`). */
  info2?: string;
}

/** Ein Eintrag im Paket: entweder eine Meldung oder ein Storno. */
export type MbgmEintrag = Beitragsgrundlagenmeldung | Stornomeldung;

/** Unterscheidet Storno von Meldung, ohne dass der Aufrufer etwas markieren muss. */
function istStorno(e: MbgmEintrag): e is Stornomeldung {
  return 'referenzUrspruenglicheMeldung' in e;
}

/** Satzart der mBGM je Folge, Verfahren und Meldungsart. */
const SATZART_MBGM: Readonly<Record<Beschaeftigungsfolge, Readonly<Record<string, string>>>> = {
  regelmaessig: { selbstMeldung: 'G1', vorMeldung: 'G2', selbstStorno: 'R1', vorStorno: 'R2' },
  fallweise: { selbstMeldung: 'G3', vorMeldung: 'G4', selbstStorno: 'R3', vorStorno: 'R4' },
  kuerzerAlsEinMonat: { selbstMeldung: 'G5', vorMeldung: 'G6', selbstStorno: 'R5', vorStorno: 'R6' },
};

/** Satzart des Tarifblocks je Folge — mit und ohne Verrechnung. */
const SATZART_TARIFBLOCK: Readonly<Record<Beschaeftigungsfolge, readonly [string, string]>> = {
  regelmaessig: ['T1', 'T4'],
  fallweise: ['T2', 'T5'],
  kuerzerAlsEinMonat: ['T3', 'T6'],
};

/** Angaben, die für das ganze Paket gelten. */
export interface PaketOptionen {
  /** Abrechnungsverfahren des Beitragskontos — siehe {@link Verfahren}. */
  verfahren: Verfahren;
  /** Eindeutige Identifikation des Pakets (`REFP`). */
  paketreferenzwert: string;
  /** Beitragskontonummer beim zuständigen Versicherungsträger (`BKNR`). */
  beitragskontonummer: string;
  /** Dienstgebername (`DGNA`). */
  dienstgebername: string;
  /** Beitragszeitraum als `MMJJJJ` (`BZRM`), z. B. `'072026'`. */
  beitragszeitraum: string;
  /**
   * Ob das Paket geringfügig Beschäftigte enthält, deren Beiträge **jährlich**
   * verrechnet werden (`JAGB`). Zwingende Angabe, auch wenn sie `false` ist.
   */
  jaehrlicheAbrechnungGeringfuegiger: boolean;
  /**
   * Paketkennung (`MPKE`) — die fachliche Kennung des Verarbeitungslaufs der
   * Lohnverrechnung. Sie wird laut D.50 bei der Beitragsbuchung mitgeführt und
   * im Beitragskonto (WEBEKU) den einzelnen Forderungsbuchungen zugeordnet.
   * Damit lässt sich später von einer Buchung auf den auslösenden Lauf
   * zurückschließen — dringend zu empfehlen, auch wenn das Feld optional ist.
   */
  paketkennung?: string;
  /** Telefonnummer des Dienstgebers (`DTEL`). */
  telefon?: string;
  /** Mailadresse des Dienstgebers (`MAIL`). */
  mail?: string;
}

// --- Formatierung ----------------------------------------------------------

function ganzzahl(wert: number, feld: string): number {
  if (!Number.isInteger(wert)) {
    throw new EldaError(
      `${feld}: ${wert} ist keine ganze Zahl. Beträge sind in Cent anzugeben — ` +
        'ein Bruchteil eines Cent kann nicht übermittelt werden.',
    );
  }
  return wert;
}

/** Zerlegt einen vorzeichenbehafteten Betrag in Vorzeichenfeld und Ziffernfolge. */
function betragMitVorzeichen(wert: number, feld: string): { vorzeichen: string; ziffern: string } {
  ganzzahl(wert, feld);
  return { vorzeichen: wert < 0 ? '-' : '+', ziffern: String(Math.abs(wert)) };
}

/**
 * Prozentsatz nach D.61: sechs Stellen, kein Dezimaltrennzeichen, drei
 * Nachkommastellen. 12,75 % wird also zu `012750`.
 *
 * Gerundet wird kaufmännisch auf drei Nachkommastellen. Ein Wert, der mehr
 * Stellen mitbringt, als das Feld tragen kann, wird NICHT stillschweigend
 * gekürzt, sondern abgelehnt.
 */
function prozentsatz(wert: number, feld: string): { vorzeichen: string; ziffern: string } {
  if (!Number.isFinite(wert)) {
    throw new EldaError(`${feld}: ${wert} ist kein gültiger Prozentsatz.`);
  }
  const tausendstel = Math.round(Math.abs(wert) * 1000);
  if (tausendstel > 999999) {
    throw new EldaError(
      `${feld}: ${wert} % passt nicht in sechs Stellen mit drei Nachkommastellen ` + '(höchstens 999,999 %).',
    );
  }
  return { vorzeichen: wert < 0 ? '-' : '+', ziffern: String(tausendstel) };
}

// --- Zusammenbau -----------------------------------------------------------

function pruefeMeldung(m: Beitragsgrundlagenmeldung, nr: number, selbst: boolean): void {
  const wo = `Meldung ${nr} (${m.referenzwert || 'ohne Referenzwert'})`;
  const folge = m.folge ?? 'regelmaessig';
  if (!m.referenzwert?.trim()) {
    throw new EldaError(`${wo}: Referenzwert (REFW) fehlt — er identifiziert die Meldung eindeutig.`);
  }
  const hatVsnr = !!m.versicherungsnummer?.trim();
  const hatRefv = !!m.referenzVsnrAnforderung?.trim();
  if (!hatVsnr && !hatRefv) {
    throw new EldaError(
      `${wo}: Weder Versicherungsnummer (VSNR) noch Referenzwert der VSNR-Anforderung (REFV) ` +
        'angegeben. Die Pflichtmatrix führt beide in einer gemeinsamen Zelle: „wenn keine ' +
        'Versicherungsnummer angegeben wird, muss ein Referenzwert auf eine VSNR Anforderung ' +
        'angegeben werden."',
    );
  }
  if (m.tarifbloecke.length > HOECHSTANZAHL.tarifblock && folge === 'regelmaessig') {
    throw new EldaError(
      `${wo}: ${m.tarifbloecke.length} Tarifblöcke. E.32.2.2.3 lässt bei regelmäßiger ` +
        `Beschäftigung höchstens ${HOECHSTANZAHL.tarifblock} zu.`,
    );
  }
  if (m.tarifbloecke.length > HOECHSTANZAHL.tarifblockTagesbezogen) {
    throw new EldaError(
      `${wo}: ${m.tarifbloecke.length} Tarifblöcke. Bei tagesbezogener Beschäftigung ist die ` +
        `Anzahl durch die Kalendertage des Monats begrenzt (höchstens ` +
        `${HOECHSTANZAHL.tarifblockTagesbezogen}).`,
    );
  }
  if (!m.tarifbloecke.length) {
    throw new EldaError(
      `${wo}: keine Tarifblöcke. Eine mBGM ohne Tarifblock ist nur als Satzart G7 ` +
        '(„ohne Versicherten") vorgesehen, die laut Fußnote nur für das BMJ gilt.',
    );
  }
  // Im Vorschreibeverfahren führt die Abfolgetabelle bei G4 ausschließlich T2 —
  // ein Tarifblock ohne Verrechnung ist dort nicht vorgesehen (Seite 363).
  if (!selbst && folge === 'fallweise' && m.tarifbloecke.some((t) => t.ohneVerrechnung)) {
    throw new EldaError(
      `${wo}: Bei fallweiser Beschäftigung im Vorschreibeverfahren ist kein Tarifblock ohne ` +
        'Verrechnung vorgesehen — die Abfolgetabelle führt zu G4 ausschließlich T2 (E.32.2.2.6).',
    );
  }

  const ohneZeit = !MIT_VERSICHERUNGSZEIT.has(m.verrechnungsgrundlage);
  m.tarifbloecke.forEach((t, i) => {
    const woT = `${wo}, Tarifblock ${i + 1}`;

    // Je Beschäftigungsfolge trägt der Tarifblock ein anderes Zeitfeld
    // (E.32.2.2.3). Ein fehlendes oder ein überzähliges ist beides ein Fehler:
    // Das überzählige landete sonst stillschweigend nirgends.
    if (folge === 'regelmaessig') {
      if (t.beginnDerVerrechnung === undefined) {
        throw new EldaError(`${woT}: Beginn der Verrechnung (VVON) fehlt.`);
      }
      if (t.beschaeftigungstag !== undefined || t.ersterTag !== undefined || t.letzterTag !== undefined) {
        throw new EldaError(
          `${woT}: Beschäftigungstag bzw. erster/letzter Tag gehören nicht zur regelmäßigen ` +
            'Beschäftigung — dort stellt VVON den Bezug zur Versicherungszeit her.',
        );
      }
      if (ohneZeit && t.beginnDerVerrechnung !== 1) {
        throw new EldaError(
          `${woT}: Bei einer mBGM ohne Versicherungszeit (VERG=${m.verrechnungsgrundlage}) ist ` +
            `der Beginn der Verrechnung laut D.63 zwingend mit 01 zu belegen, angegeben wurde ` +
            `${t.beginnDerVerrechnung}.`,
        );
      }
    } else if (folge === 'fallweise') {
      if (t.beschaeftigungstag === undefined) {
        throw new EldaError(`${woT}: Beschäftigungstag (FTAG) fehlt.`);
      }
      if (t.beginnDerVerrechnung !== undefined) {
        throw new EldaError(`${woT}: VVON gehört nicht zur fallweisen Beschäftigung — dort zählt FTAG.`);
      }
    } else {
      if (t.ersterTag === undefined || t.letzterTag === undefined) {
        throw new EldaError(`${woT}: Erster und letzter Tag (BTAB/BTBS) sind zwingend.`);
      }
      if (t.letzterTag < t.ersterTag) {
        throw new EldaError(`${woT}: Letzter Tag (${t.letzterTag}) liegt vor dem ersten (${t.ersterTag}).`);
      }
      if (t.beginnDerVerrechnung !== undefined) {
        throw new EldaError(`${woT}: VVON gehört nicht hierher — den Bezug stellen BTAB und BTBS her.`);
      }
    }

    if (t.ohneVerrechnung && t.basen.length > 0) {
      throw new EldaError(
        `${woT}: Ein Tarifblock ohne Verrechnung darf keine Verrechnungsbasis tragen. ` +
          'E.32.2.2.3: „Diese beinhalten keine Verrechnung, daher ist nachfolgend keine ' +
          'Übermittlung einer Verrechnungsbasis zulässig."',
      );
    }
    if (t.basen.length > HOECHSTANZAHL.verrechnungsbasis) {
      throw new EldaError(
        `${woT}: ${t.basen.length} Verrechnungsbasen, zulässig sind höchstens ` +
          `${HOECHSTANZAHL.verrechnungsbasis} (E.32.2.2.4).`,
      );
    }
    if (t.ohneVerrechnung && t.enthaeltKuendigungsentschaedigungOderUrlaubsersatz) {
      throw new EldaError(
        `${woT}: In einem Tarifblock ohne Verrechnung ist KEUE gesperrt (Pflichtmatrix, Seite 347).`,
      );
    }
    if ((t.ergaenzungen?.length ?? 0) > 5) {
      throw new EldaError(
        `${woT}: höchstens fünf Ergänzungen zur Beschäftigtengruppe (BLOCK FÜR 5 ERGÄNZUNGEN), ` +
          `angegeben wurden ${t.ergaenzungen?.length}.`,
      );
    }

    const gesehen = new Set<string>();
    for (const b of t.basen) {
      if (!(b.typ in VBTY_CODES)) {
        throw new EldaError(`${woT}: unbekannter Verrechnungsbasis-Typ '${b.typ}'.`);
      }
      if (gesehen.has(b.typ)) {
        throw new EldaError(
          `${woT}: Der Verrechnungsbasis-Typ '${b.typ}' kommt mehrfach vor. D.58: „Jeder ` +
            'Verrechnungsbasis-Typ darf für einen Tarifblock nur einmal verwendet werden."',
        );
      }
      gesehen.add(b.typ);
      if (b.positionen.length > HOECHSTANZAHL.verrechnungsposition) {
        throw new EldaError(
          `${woT}, Basis '${b.typ}': ${b.positionen.length} Verrechnungspositionen, zulässig ` +
            `sind höchstens ${HOECHSTANZAHL.verrechnungsposition} (E.32.2.2.5).`,
        );
      }
      const erlaubt = erlaubtePositionen(b.typ);
      for (const p of b.positionen) {
        if (!(p.typ in VPTY_CODES)) {
          throw new EldaError(`${woT}: unbekannter Verrechnungspositions-Typ '${p.typ}'.`);
        }
        // Nur prüfen, wo das Dokument eine Zuordnung führt. Für KE, UH und RP
        // tut es das nicht — dort wäre eine Ablehnung geraten.
        if (erlaubt && !erlaubt.has(p.typ)) {
          throw new EldaError(
            `${woT}: Die Verrechnungsposition '${p.typ}' ist zur Verrechnungsbasis '${b.typ}' ` +
              `nicht zulässig (D.60). Zulässig wären: ${[...erlaubt].sort().join(', ')}.`,
          );
        }
      }
      for (const pflicht of zwingendePositionen(b.typ)) {
        if (!b.positionen.some((p) => p.typ === pflicht)) {
          throw new EldaError(
            `${woT}: Zur Verrechnungsbasis '${b.typ}' fehlt die zwingende Verrechnungsposition ` +
              `'${pflicht}' (D.60).`,
          );
        }
      }
    }
  });
}

function pruefeStorno(st: Stornomeldung, nr: number): void {
  const wo = `Storno ${nr} (${st.referenzwert || 'ohne Referenzwert'})`;
  if (!st.referenzwert?.trim()) {
    throw new EldaError(`${wo}: Referenzwert (REFW) fehlt.`);
  }
  if (!st.referenzUrspruenglicheMeldung?.trim()) {
    throw new EldaError(
      `${wo}: Referenzwert der ursprünglichen Meldung (REFU) fehlt. Über ihn wird die zu ` +
        'stornierende mBGM identifiziert (D.44).',
    );
  }
  if (!st.versicherungsnummer?.trim()) {
    throw new EldaError(
      `${wo}: Versicherungsnummer (VSNR) fehlt. Beim Storno ist sie einzeln zwingend — die ` +
        'Alternative zur VSNR-Anforderung gilt dort nicht (Pflichtmatrix, Seite 345).',
    );
  }
  ganzzahl(st.summeCent, wo);
  if (st.summeCent < 0) {
    throw new EldaError(
      `${wo}: Die Summe der Beiträge ist ${st.summeCent}. Das Feld VSUM trägt kein Vorzeichen; ` +
        'der Betrag einer Storno-mBGM ist laut E.32.2.2.2 „immer größer oder gleich 0". ' +
        'Abgezogen wird er erst bei der Bildung der Gesamtsumme des Pakets.',
    );
  }
}

/**
 * Baut die vollständige Satzfolge eines mBGM-Pakets: Paket-Beginn, je Eintrag
 * die mBGM (bei einer Meldung mit ihren Tarifblöcken, Verrechnungsbasen und
 * -positionen; bei einem Storno ohne), zum Schluss der Paket-Ende-Satz.
 *
 * Die Reihenfolge ist bedeutungstragend und darf vom Aufrufer nicht verändert
 * werden — die Zugehörigkeit der Sätze ergibt sich allein aus ihr.
 *
 * `GSUM` und `ANZM` werden aus den übergebenen Einträgen berechnet, nicht
 * entgegengenommen: Eine von Hand gesetzte Summe, die nicht zur Satzfolge
 * passt, ist einer der häufigsten Rückweisungsgründe (`F9051`) und lässt sich
 * hier vollständig vermeiden. Storno-Beträge werden dabei **abgezogen**.
 *
 * @returns geordnete Rohsätze, geeignet für `baueBestand`.
 */
export function erstelleMbgmPaket(eintraege: readonly MbgmEintrag[], opt: PaketOptionen): RohSatz[] {
  if (!eintraege.length) {
    throw new EldaError('Ein mBGM-Paket ohne Meldungen ist nicht vorgesehen.');
  }
  if (!/^\d{6}$/.test(opt.beitragszeitraum)) {
    throw new EldaError(
      `Beitragszeitraum '${opt.beitragszeitraum}' muss genau sechs Ziffern im Format MMJJJJ ` +
        "haben — z. B. '072026' für Juli 2026.",
    );
  }
  const selbst = opt.verfahren === 'selbstabrechnung';
  eintraege.forEach((e, i) => {
    if (istStorno(e)) pruefeStorno(e, i + 1);
    else pruefeMeldung(e, i + 1, selbst);
  });

  const saetze: RohSatz[] = [];
  const meldungssaetze: RohSatz[] = [];
  let gesamtCent = 0;

  for (const e of eintraege) {
    const folge = e.folge ?? 'regelmaessig';
    const arten = SATZART_MBGM[folge];

    if (istStorno(e)) {
      // Storno: nur der mBGM-Satz, keine untergeordneten Sätze.
      gesamtCent -= e.summeCent;
      meldungssaetze.push({
        satzart: (selbst ? arten.selbstStorno : arten.vorStorno) as string,
        felder: FELDER_MBGM,
        satzlaenge: SATZLAENGE_MBGM,
        werte: {
          REFW: e.referenzwert,
          REFU: e.referenzUrspruenglicheMeldung,
          VSNR: e.versicherungsnummer,
          VSUM: selbst ? String(e.summeCent) : undefined,
          INF1: e.info1,
          INF2: e.info2,
        },
      });
      continue;
    }

    const m = e;
    let summeCent = 0;
    const untersaetze: RohSatz[] = [];
    const [mitVerrechnung, ohneVerrechnung] = SATZART_TARIFBLOCK[folge];
    const tarifblockFelder =
      folge === 'fallweise'
        ? FELDER_TARIFBLOCK_FALLWEISE
        : folge === 'kuerzerAlsEinMonat'
          ? FELDER_TARIFBLOCK_KURZ
          : FELDER_TARIFBLOCK;
    const tarifblockLaenge =
      folge === 'fallweise'
        ? SATZLAENGE_TARIFBLOCK_FALLWEISE
        : folge === 'kuerzerAlsEinMonat'
          ? SATZLAENGE_TARIFBLOCK_KURZ
          : SATZLAENGE_TARIFBLOCK;

    for (const t of m.tarifbloecke) {
      const ergb: Record<string, string | undefined> = {};
      (t.ergaenzungen ?? []).forEach((wert, i) => {
        ergb[`ERGB${i + 1}`] = wert;
      });
      const zeitfelder: Record<string, string | undefined> =
        folge === 'fallweise'
          ? { FTAG: String(t.beschaeftigungstag) }
          : folge === 'kuerzerAlsEinMonat'
            ? { BTAB: String(t.ersterTag), BTBS: String(t.letzterTag) }
            : { VVON: String(t.beginnDerVerrechnung) };
      // KEUE gibt es nur im Tarifblock der regelmäßigen und der kürzer als ein
      // Monat vereinbarten Beschäftigung; der fallweise Tarifblock hat das Feld
      // gar nicht (Feldtabellen, Seiten 341–342).
      const keue =
        folge !== 'fallweise' && !t.ohneVerrechnung && t.enthaeltKuendigungsentschaedigungOderUrlaubsersatz
          ? 'J'
          : undefined;

      untersaetze.push({
        satzart: t.ohneVerrechnung ? ohneVerrechnung : mitVerrechnung,
        felder: tarifblockFelder,
        satzlaenge: tarifblockLaenge,
        werte: { BSGR: t.beschaeftigtengruppe, ...ergb, ...zeitfelder, ...(keue ? { KEUE: keue } : {}) },
      });

      for (const b of t.basen) {
        untersaetze.push({
          satzart: selbst ? 'BS' : 'BV',
          felder: FELDER_VERRECHNUNGSBASIS,
          satzlaenge: SATZLAENGE_VERRECHNUNGSBASIS,
          werte: { VBTY: b.typ, VBBT: String(ganzzahl(b.betragCent, `Verrechnungsbasis ${b.typ}`)) },
        });

        for (const p of b.positionen) {
          // Beim Vorschreiber bleiben VPVZ, VPTA, RSVZ und RSUM in
          // Grundstellung: Pflichtstufe Z4 — „Angabe möglich, Feldinhalt wird
          // nicht übernommen". Siehe die Begründung bei `Verrechnungsposition`.
          if (!selbst) {
            untersaetze.push({
              satzart: 'V2',
              felder: FELDER_VERRECHNUNGSPOSITION,
              satzlaenge: SATZLAENGE_VERRECHNUNGSPOSITION,
              werte: { VPTY: p.typ },
            });
            continue;
          }
          if (p.prozentsatz === undefined || p.betragCent === undefined) {
            throw new EldaError(
              `Verrechnungsposition ${p.typ}: Bei der Selbstabrechnung sind Prozentsatz und ` +
                'Beitrag zwingend (Pflichtstufe Z bzw. Z1 für die Satzart V1). Ohne sie kann ' +
                'die Gesamtsumme des Pakets nicht gebildet werden.',
            );
          }
          const pz = prozentsatz(p.prozentsatz, `Verrechnungsposition ${p.typ}`);
          const be = betragMitVorzeichen(p.betragCent, `Verrechnungsposition ${p.typ}`);
          summeCent += p.betragCent;
          untersaetze.push({
            satzart: 'V1',
            felder: FELDER_VERRECHNUNGSPOSITION,
            satzlaenge: SATZLAENGE_VERRECHNUNGSPOSITION,
            werte: {
              VPTY: p.typ,
              VPVZ: pz.vorzeichen,
              VPTA: pz.ziffern,
              RSVZ: be.vorzeichen,
              RSUM: be.ziffern,
            },
          });
        }
      }
    }

    gesamtCent += summeCent;
    const vsum = betragMitVorzeichen(summeCent, `Meldung ${m.referenzwert}`);
    meldungssaetze.push({
      satzart: (selbst ? arten.selbstMeldung : arten.vorMeldung) as string,
      felder: FELDER_MBGM,
      satzlaenge: SATZLAENGE_MBGM,
      werte: {
        REFW: m.referenzwert,
        REFV: m.referenzVsnrAnforderung,
        VSNR: m.versicherungsnummer,
        FANA: m.familienname,
        VONA: m.vorname,
        // VSUM trägt kein eigenes Vorzeichenfeld; ein negativer Gesamtbetrag je
        // Versichertem ist über die Vorzeichen der Einzelpositionen abgebildet.
        // Beim Vorschreiber ist das Feld Z4 und bleibt leer.
        VSUM: selbst ? vsum.ziffern : undefined,
        VERG: m.verrechnungsgrundlage,
        INF1: m.info1,
        INF2: m.info2,
      },
    });
    meldungssaetze.push(...untersaetze);
  }

  const gesamt = betragMitVorzeichen(gesamtCent, 'Gesamtsumme des Pakets');
  saetze.push({
    satzart: selbst ? 'PS' : 'PV',
    felder: FELDER_PAKET,
    satzlaenge: SATZLAENGE_PAKET,
    werte: {
      REFP: opt.paketreferenzwert,
      BKNR: opt.beitragskontonummer,
      DGNA: opt.dienstgebername,
      MPKE: opt.paketkennung,
      JAGB: opt.jaehrlicheAbrechnungGeringfuegiger ? 'J' : 'N',
      DTEL: opt.telefon,
      MAIL: opt.mail,
      BZRM: opt.beitragszeitraum,
      // GSVZ und GSUM sind beim Vorschreiber Z4; der Prüfkatalog führt die
      // Summenprüfungen F9050/F9051 ausdrücklich nur für die Satzart PS.
      GSVZ: selbst ? gesamt.vorzeichen : undefined,
      GSUM: selbst ? gesamt.ziffern : undefined,
      ANZM: String(eintraege.length),
    },
  });
  saetze.push(...meldungssaetze);
  saetze.push({
    satzart: 'PE',
    felder: FELDER_PAKET,
    satzlaenge: SATZLAENGE_PAKET,
    werte: { REFP: opt.paketreferenzwert, ANZM: String(eintraege.length) },
  });

  return saetze;
}
