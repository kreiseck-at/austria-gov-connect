import { EldaError } from './errors';
import {
  FELDER_E27,
  PLAETZE_ARBEITSORT,
  PLAETZE_DIENSTGEBER,
  PLAETZE_SELBSTAENDIG,
  SATZLAENGE_E27,
} from './felder-e27';
import { pruefePflichtE27, type E27Meldeart, type E27Satzart } from './pflicht-e27';
import { pruefeInhaltE27 } from './pruefung-e27';
import {
  BEST_ZWISCHENSTAATLICH,
  VERSION_ZWISCHENSTAATLICH,
  baueBestand,
  type BestandOptionen,
  type RohSatz,
} from './bestand';

/**
 * Antrag auf zwischenstaatliche Bescheinigung (Bestand `ES`, Kapitel E.27):
 * Entsendung (E1, E5), Tätigkeit in mehreren Staaten (E2–E4) und die
 * Ausnahmevereinbarung bei grenzüberschreitender Telearbeit (EA). Die ÖGK bzw.
 * die BVAEB entscheidet daraufhin über die anzuwendenden Rechtsvorschriften und
 * stellt gegebenenfalls die Bescheinigung PD A1 aus (Kapitel E.27.3, Seite 304);
 * für EA entscheidet der Dachverband.
 *
 * Felder heißen wie in der Feldtabelle (Seiten 290–295). Die drei
 * Wiederholungsblöcke kommen als Listen: `dienstgeber` (Felder 16–33, bis zu 5),
 * `selbstaendig` (Felder 50–60, bis zu 3) und `arbeitsorte` (Felder 68–74, bis
 * zu 32). Kennzeichen sind `J`/`N`, Daten `TTMMJJJJ`.
 */

/** Ein Dienstgeber, Felder 16–33 (Seiten 291–292). */
export interface EsDienstgeber {
  /** Dienstgebername. */
  DGNA?: string;
  /** Beitragskontonummer beim für die Pflichtversicherung zuständigen Träger; `NEU` laut Prüfkatalog bei E1, E2, E5. */
  BKNR?: string;
  /** Beitragskontoführender Träger: `05` (BVAEB-EB, nur E1) oder `11`–`19` (ÖGK-Landesstellen). */
  VTBK?: string;
  /** Straße und Hausnummer des Unternehmenssitzes. */
  DGSTR?: string;
  /** Ländercode, ISO A2, z. B. `AT`. */
  DGKFZ?: string;
  DGPLZ?: string;
  DGORT?: string;
  DGTEL?: string;
  DGMAIL?: string;
  /** Wirtschaftssektor, Schlüsselzahl `00`–`12` (Seite 291). */
  DGWS?: string;
  /** Dauer der Entsendung / Beschäftigung — Beginn, TTMMJJJJ. */
  BBEG?: string;
  /** Dauer der Entsendung / Beschäftigung — voraussichtliches Ende, TTMMJJJJ. */
  BEND?: string;
  /** Marginale Tätigkeit (unter 5 %), E3/E4. */
  MARGDG?: string;
  /** Beamtenähnliche Art der Tätigkeit, E2–E4. */
  BEAT?: string;
  /** Mitglied einer Flug- oder Kabinenbesatzung, E2–E4. */
  ANKZ?: string;
  /** Staat der Heimatbasis, wenn ANKZ = J. */
  STAATHB?: string;
}

/** Eine selbständige Tätigkeit, Felder 50–60 (Seite 293), nur E4. */
export interface EsSelbstaendig {
  STFNA?: string;
  STREFO?: string;
  STSTR?: string;
  STKFZ?: string;
  STPLZ?: string;
  STORT?: string;
  STTEL?: string;
  STMAIL?: string;
  /** Selbständig seit, TTMMJJJJ. */
  STAS?: string;
  /** Art der Tätigkeit (Branche, Gewerbe). */
  START?: string;
  /** Marginale Tätigkeit (unter 5 %). */
  MARGST?: string;
}

/** Ein Arbeitsort, Felder 68–74 (Seite 294), E2–E4 und EA. */
export interface EsArbeitsort {
  /** Staat, in dem die Tätigkeit ausgeübt wird (Kapitel D.36). */
  AOST?: string;
  /** Feste Betriebsstätte, `J`/`N`. Bei `J` sind Firmenname und Anschrift anzugeben. */
  AOKBS?: string;
  AOFNSN?: string;
  AOSTRA?: string;
  AOPLZL?: string;
  AOORT?: string;
  /** Ausübung der Tätigkeit (E4): `U`, `S` oder `B`. */
  AUET?: string;
}

/** Ein Antrag (Meldeart `01`). */
export interface AntragFelder {
  /** UUID der Meldung (Kapitel D.68), z. B. aus `crypto.randomUUID()`. */
  UIDM: string;
  VONA?: string;
  FANA?: string;
  /** Geschlecht: 1 männlich, 2 weiblich, 3 divers, 4 offen, 6 inter, 7 keine Angabe. */
  GESL?: string;
  /** Geburtsdatum TTMMJJJJ. */
  GEBD?: string;
  /** Geburtsort. */
  GEBO?: string;
  /** Versicherungsnummer LLLPTTMMJJ. */
  VSNR?: string;
  /** Staatsangehörigkeit, ISO A2. */
  STSL?: string;
  /** Wohnort (bei E2–E4 und EA der Lebensmittelpunkt): Straße und Hausnummer. */
  STRA?: string;
  /** Wohnort, Staat ISO A2. */
  WKFZ?: string;
  PLZL?: string;
  WORT?: string;
  /** Wohnort, Telefon (E2–E4). */
  WTEL?: string;
  /** Wohnort, Mail (E2–E4). */
  WMAIL?: string;
  dienstgeber: readonly EsDienstgeber[];
  selbstaendig?: readonly EsSelbstaendig[];
  arbeitsorte?: readonly EsArbeitsort[];
  /** Das entsendende Unternehmen ist gewöhnlich in Österreich tätig (E1). */
  DGPS?: string;
  /** Staat, in den entsandt wird (E1, E5; Kapitel D.36). */
  AGSTAAT?: string;
  AGNA?: string;
  AGSTR?: string;
  AGPLZ?: string;
  AGORT?: string;
  /** Feste Beschäftigungsstelle im Beschäftigungsstaat (E1, E5). */
  BFEST?: string;
  /** Löst einen anderen entsandten Arbeitnehmer ab (E1). */
  ANABL?: string;
  /** Gründe, wenn ANABL = J. */
  ANABLJ?: string;
  /** Wird einem weiteren Unternehmen überlassen (E1). */
  BUEL?: string;
  /** Mindestens 25 % der Erwerbstätigkeit in Österreich (E2–E4). */
  ANATJ?: string;
  /** Früherer Name / Geburtsname (E5). */
  FNA1?: string;
  /** Tätig im internationalen Verkehr (E5). */
  ANIV?: string;
  /** Versicherungsnummer Ausland (E5, EA). */
  VSNA?: string;
  /** Personennummer Ausland (E5). */
  APNR?: string;
  /** Aktenzeichen / Matrikelnummer Ausland (E5). */
  AAKT?: string;
  /** Antragszeitraum von (E2–E4), TTMMJJJJ. */
  AZRV?: string;
  /** Antragszeitraum bis (E2–E4), TTMMJJJJ. */
  AZRB?: string;
  /** Flüchtling mit aufrechtem positivem Asylbescheid (E1–E4). */
  ANFL?: string;
  /** Telearbeit unter 50 % der Gesamtarbeitszeit (EA). */
  AUSMTE?: string;
  /** Antragszeitraum Telearbeit von (EA), TTMMJJJJ. */
  ANTVON?: string;
  /** Antragszeitraum Telearbeit bis (EA), TTMMJJJJ. */
  ANTBIS?: string;
}

/** Ein Storno (Meldeart `02`): neue UIDM, UIDU des Antrags, bei Bedarf dessen Beitragskontonummern. */
export interface StornoAntragFelder {
  /** Neue UUID dieser Stornomeldung. */
  UIDM: string;
  /** UIDM des zu stornierenden Antrags (Kapitel D.69). */
  UIDU: string;
  /**
   * Die im Antrag übermittelten Beitragskontonummern. Laut Fußnote auf Seite 303
   * nur verpflichtend, wenn der Antrag noch keine gültige UUID trug.
   */
  BKNR?: readonly string[];
}

const SATZARTEN: ReadonlySet<string> = new Set(['E1', 'E2', 'E3', 'E4', 'E5', 'EA']);

/** Legt die Einträge einer Blockliste auf `NAME_1`, `NAME_2`, … ab. */
function blockWerte(
  liste: readonly object[] | undefined,
  plaetze: number,
  was: string,
): Record<string, string | undefined> {
  const werte: Record<string, string | undefined> = {};
  if (liste === undefined) return werte;
  if (liste.length > plaetze) {
    throw new EldaError(`Der Satz hat ${plaetze} Plätze für ${was}, übergeben wurden ${liste.length}.`);
  }
  liste.forEach((eintrag, i) => {
    for (const [name, w] of Object.entries(eintrag as Record<string, unknown>)) {
      if (w !== undefined && typeof w !== 'string') {
        throw new EldaError(`${was}, Platz ${i + 1}: Feld ${name} muss eine Zeichenkette sein.`);
      }
      werte[`${name}_${i + 1}`] = w as string | undefined;
    }
  });
  return werte;
}

function baue(
  satzart: E27Satzart,
  meldeart: E27Meldeart,
  werte: Record<string, string | undefined>,
): RohSatz {
  if (!SATZARTEN.has(satzart)) {
    throw new EldaError(`Satzart '${satzart}' gibt es in Kapitel E.27 nicht (E1–E5, EA).`);
  }
  const bekannt = new Set(FELDER_E27.map((f) => f.name));
  for (const name of Object.keys(werte)) {
    if (!bekannt.has(name) || name === 'IDTEIL' || name === 'RESE') {
      throw new EldaError(
        `Unbekanntes Feld '${name}' — es gehört nicht zum Antrag auf zwischenstaatliche Bescheinigung.`,
      );
    }
  }
  pruefePflichtE27(satzart, meldeart, werte);
  pruefeInhaltE27(satzart, meldeart, werte);
  return Object.freeze({
    satzart,
    werte: Object.freeze({ ...werte }),
    felder: FELDER_E27,
    satzlaenge: SATZLAENGE_E27,
  });
}

/**
 * Antrag auf zwischenstaatliche Bescheinigung (Meldeart `01`). Prüft
 * Pflichtmatrix (E.27.1), Blockanzahlen und die Inhaltsregeln des
 * Prüfkatalogs; wirft beim ersten Verstoß mit Feld und Fehlercode.
 */
export function antragZwischenstaatlich(satzart: E27Satzart, felder: AntragFelder): RohSatz {
  const { dienstgeber, selbstaendig, arbeitsorte, ...rest } = felder;
  return baue(satzart, '01', {
    MART: '01',
    ...rest,
    ...blockWerte(dienstgeber, PLAETZE_DIENSTGEBER, 'Dienstgeber'),
    ...blockWerte(selbstaendig, PLAETZE_SELBSTAENDIG, 'selbständige Tätigkeiten'),
    ...blockWerte(arbeitsorte, PLAETZE_ARBEITSORT, 'Arbeitsorte'),
  });
}

/**
 * Storno eines Antrags (Meldeart `02`, Matrix E.27.2). Die Satzart ist die des
 * stornierten Antrags — die Stornomatrix ist je Satzart abgedruckt.
 */
export function stornoAntragZwischenstaatlich(satzart: E27Satzart, felder: StornoAntragFelder): RohSatz {
  const { BKNR, ...rest } = felder;
  return baue(satzart, '02', {
    MART: '02',
    ...rest,
    ...blockWerte(
      BKNR?.map((b) => ({ BKNR: b })),
      PLAETZE_DIENSTGEBER,
      'Beitragskontonummern',
    ),
  });
}

/**
 * Zuständiger Versicherungsträger (VSTR im Identifikationsteil) je Satzart.
 * Quellen: Kapitel E.27.3, Seite 305 („Derzeit sind folgende VSTR für diesen
 * Datenaustausch vorgesehen: ÖGK, BVAEB, DVSV"), Fußnote 69 („Für die
 * BVAEB-EB ist nur die Satzart E1 zulässig") und Kapitel D.4, Seite 68: „Die
 * Angabe von VSTR = 99 … ist nur für Datenmeldungen ‚Adresse der Arbeitsstätte
 * - Freiwilligenmeldung‘ (Satzart 47 und 48) sowie ‚Antrag auf zwischenstaatliche
 * Bescheinigung‘ (Satzart EA) möglich." Für EA ist der Dachverband zuständig
 * (Seite 304: „bei Ausnahmevereinbarungen … in Österreich: DVSV").
 */
function pruefeTraeger(satzarten: readonly string[], vstr: string): void {
  const v = vstr.trim();
  for (const sa of satzarten) {
    if (sa === 'EA' && v !== '99') {
      throw new EldaError(
        `Satzart EA geht an den Dachverband: VSTR muss 99 sein, nicht '${v}' (Kapitel E.27.3, D.4).`,
      );
    }
    if (sa !== 'EA' && v === '99') {
      throw new EldaError(
        `VSTR 99 ist laut Kapitel D.4 bei E.27 nur für die Satzart EA zulässig, nicht für ${sa}.`,
      );
    }
    if (sa !== 'EA' && !/^1[1-9]$/.test(v) && v !== '05') {
      throw new EldaError(
        `VSTR '${v}' ist für Satzart ${sa} nicht vorgesehen; zulässig sind die ÖGK (11–19) und die BVAEB-EB (05, nur E1).`,
      );
    }
    if (v === '05' && sa !== 'E1') {
      throw new EldaError(
        `Bei der BVAEB-EB (VSTR 05) ist nur die Satzart E1 zulässig (Fußnote 69), nicht ${sa}.`,
      );
    }
  }
}

/**
 * Klammert Anträge zu einem übertragbaren Bestand mit der Bestandsbezeichnung
 * `ES` und der Version `08`. Prüft zusätzlich, was nur über mehrere Sätze oder
 * mit dem Träger zusammen entscheidbar ist: die UIDM muss im Bestand eindeutig
 * sein (F7634) und der zuständige Träger zur Satzart passen.
 */
export function erstelleEsBestand(saetze: readonly RohSatz[], opt: BestandOptionen): Buffer {
  for (const s of saetze) {
    if (s.felder !== FELDER_E27) {
      throw new EldaError(
        `Satz der Satzart ${s.satzart} gehört nicht zu Kapitel E.27; ein Bestand trägt Daten zu genau einer Verarbeitung (Kapitel C.1).`,
      );
    }
  }
  pruefeTraeger(
    saetze.map((s) => s.satzart),
    opt.versicherungstraeger,
  );
  const gesehen = new Set<string>();
  for (const s of saetze) {
    const uidm = s.werte.UIDM?.trim().toLowerCase();
    if (uidm === undefined || uidm === '') continue;
    if (gesehen.has(uidm)) {
      throw new EldaError(
        'F7634: Dieselbe UIDM steht zweimal im Bestand; sie muss je Meldung eindeutig sein (Kapitel D.68).',
      );
    }
    gesehen.add(uidm);
  }
  return baueBestand(saetze, {
    ...opt,
    bestandsbezeichnung: BEST_ZWISCHENSTAATLICH,
    satzstrukturVersion: VERSION_ZWISCHENSTAATLICH,
  });
}
