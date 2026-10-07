import { parseXml, firstChild, childText, type XmlNode } from '@kreiseck/finanzonline-core';
import { EldaProtocolError } from './errors';

/**
 * Rücksendungen lesen: die Mitteilung zu einer Sendung und den
 * Clearing-Datensatz 2.0.
 *
 * Zu einer angenommenen Sendung stellt ELDA nach wenigen Sekunden zwei
 * Rücksendungen ein – eine Mitteilung (`mitteilung_<Protokollnummer>.xml`) und
 * ein Protokoll im Klartext (`mbd_<Protokollnummer>_<Beitragskontonummer>`).
 * Erst nach der fachlichen Verarbeitung durch den Versicherungsträger kommt,
 * wenn etwas zu klären ist, ein Clearing-Datensatz (`cm_<Nummer>.xml`). Beides
 * beobachtet auf der SIT-Plattform der Sozialversicherung (Oktober 2026).
 *
 * Die Mitteilung sagt nur, ob ELDA die Meldungen **formal** übernommen hat.
 * Ob der Träger sie **fachlich** verarbeitet hat, steht allein im Clearing –
 * eine Abmeldung kann `uebernommen` sein und trotzdem mit einem Clearingfall
 * „nicht verarbeitet“ zurückkommen.
 *
 * Der Aufbau des Clearing-Datensatzes 2.0 folgt den XML-Schemas der ÖGK
 * („SV-Clearingsystem: Clearing-Datensatz“, Dialogfall
 * `https://online_2_0.elda.at/dgdialog/`, Inhalt
 * `http://mvb_clearing_2_0_0.dialog.sozvers.at`) und Kapitel J der DM-Org.
 * Die Mitteilung folgt dem Schema `elda_mitteilung-3.0.xsd` (ELDA,
 * „Mitteilungsfiles“ unter den Downloads für Dienstgeber); Elemente, die das
 * Schema nicht kennt, gehen nicht verloren.
 */

// --- Art einer Rücksendung ------------------------------------------------

export type RuecksendungsArt =
  | { art: 'mitteilung'; protokollnummer: string }
  | { art: 'protokoll'; protokollnummer: string; beitragskontonummer: string }
  | { art: 'clearing' }
  | { art: 'unbekannt' };

/**
 * Erkennt die Art einer Rücksendung an ihrem Dateinamen.
 *
 * Bei Mitteilung und Protokoll ist die Protokollnummer die der eigenen
 * **Sendung** – darüber ordnet {@link findeRuecksendung} sie zu. Ein
 * Clearing-Datensatz trägt dagegen seine eigene Nummer; er wird über den
 * Referenzwert der Meldung zugeordnet (`Dialogfall.referenzwert`).
 */
export function artDerRuecksendung(dateiName: string): RuecksendungsArt {
  const name = dateiName.trim();
  let m = /^mitteilung_(\d+)\.xml$/.exec(name);
  if (m) return { art: 'mitteilung', protokollnummer: m[1]! };
  m = /^mbd_(\d+)_(\d+)$/.exec(name);
  if (m) return { art: 'protokoll', protokollnummer: m[1]!, beitragskontonummer: m[2]! };
  if (/^cm_\d+\.xml$/.test(name)) return { art: 'clearing' };
  return { art: 'unbekannt' };
}

// --- gemeinsame Helfer ----------------------------------------------------

const alsText = (xml: string | Buffer): string => (Buffer.isBuffer(xml) ? xml.toString('utf8') : xml);

function wurzel(xml: string | Buffer, erwartet: string, was: string): XmlNode {
  let root: XmlNode;
  try {
    root = parseXml(alsText(xml));
  } catch (err) {
    throw new EldaProtocolError(`${was}: kein lesbares XML (${(err as Error).message}).`, undefined, {
      cause: err,
    });
  }
  if (root.name !== erwartet) {
    throw new EldaProtocolError(`${was}: erwartet wird <${erwartet}>, gefunden <${root.name}>.`);
  }
  return root;
}

/** Text eines Kindelements, getrimmt; leer zählt als nicht vorhanden. */
function feld(node: XmlNode, name: string): string | undefined {
  const wert = childText(node, name)?.trim();
  return wert ? wert : undefined;
}

function zahl(node: XmlNode, name: string): number | undefined {
  const wert = feld(node, name);
  return wert !== undefined && /^\d+$/.test(wert) ? Number(wert) : undefined;
}

// --- Mitteilung -----------------------------------------------------------

/** `status` einer Mitteilung laut `elda_mitteilung-3.0.xsd`. */
export const MITTEILUNG_STATUS = {
  uebernommen: 'alle Meldungen übernommen',
  teilweise_uebernommen: 'mindestens eine Meldung nicht übernommen – diese korrigiert neu senden',
  nicht_uebernommen: 'keine Meldung übernommen – alle korrigiert neu senden',
  offen: 'Verarbeitung noch nicht abgeschlossen – eine weitere Mitteilung folgt',
} as const;

/** Ein Code der Mitteilung (`E…`/`W…`, Klartext in Kapitel H.22 „ELDA-FC“). */
export interface MitteilungCode {
  /** `value`, z. B. `E17`. */
  code: string;
  /** `elda_text` – der fertige Fehlertext. */
  text: string;
  /** Attribut `typ`: `warnung` oder `fehler`. */
  typ?: string;
  /** Zeile, die den Code verursacht (Leerzeilen zählt ELDA nicht mit). */
  zeilennummer?: number;
}

export interface MitteilungMeldung {
  /** Status der einzelnen Meldung: `uebernommen` oder `nicht_uebernommen`. */
  status: string;
  referenznummer?: string;
  /** Zeile der Meldung im Bestand (der Vorlaufsatz ist Zeile 1). */
  zeilennummer?: number;
  codes: MitteilungCode[];
  /** Elemente, die das Schema nicht kennt – Name → Text. */
  weitere: Record<string, string>;
}

export interface Mitteilung {
  protokollnummer?: string;
  dateiname?: string;
  /** Seriennummer des Übermittlers. */
  seriennummer?: string;
  /** Status der ganzen Sendung, siehe {@link MITTEILUNG_STATUS}. */
  status: string;
  /** Empfangene und übernommene Meldungen je Bestand (`VR`, `MB`, …). */
  bestaende: { code: string; empfangen?: number; uebernommen?: number }[];
  meldungen: MitteilungMeldung[];
  /** Codes, die keiner einzelnen Meldung zuzuordnen sind (z. B. `E17`, Mehrfachübermittlung). */
  codes: MitteilungCode[];
}

const BEKANNT_MELDUNG = new Set(['referenznummer', 'zeilennummer', 'codes']);

/** Ein Attribut ohne Rücksicht auf ein Namensraum-Präfix (`typ` ist im Schema global). */
function attribut(node: XmlNode, name: string): string | undefined {
  const schluessel = Object.keys(node.attrs).find((k) => k === name || k.endsWith(`:${name}`));
  return schluessel === undefined ? undefined : node.attrs[schluessel];
}

function codesVon(node: XmlNode): MitteilungCode[] {
  return (firstChild(node, 'codes')?.children ?? [])
    .filter((c) => c.name === 'code')
    .map((c) => {
      const zeile = attribut(c, 'zeilennummer')?.trim();
      return {
        code: feld(c, 'value') ?? '',
        text: childText(c, 'elda_text')?.trim() ?? '',
        ...optional('typ', attribut(c, 'typ')?.trim() || undefined),
        ...optional('zeilennummer', zeile && /^\d+$/.test(zeile) ? Number(zeile) : undefined),
      };
    });
}

/**
 * Liest eine Mitteilung (`mitteilung_<Protokollnummer>.xml`).
 *
 * Steht der Status auf `offen`, war die Verarbeitung bei ELDA noch nicht
 * abgeschlossen; laut Schema folgt dann eine weitere Mitteilung.
 *
 * @throws EldaProtocolError wenn das XML nicht lesbar ist oder die Wurzel nicht
 *   `protokoll` heißt.
 */
export function liesMitteilung(xml: string | Buffer): Mitteilung {
  const root = wurzel(xml, 'protokoll', 'Mitteilung');
  const summen = firstChild(root, 'bestand_summen');
  const meldungen = firstChild(root, 'meldungen');
  return {
    ...optional('protokollnummer', root.attrs.protokollnummer || undefined),
    ...optional('dateiname', root.attrs.dateiname || undefined),
    ...optional('seriennummer', root.attrs.seriennummer || undefined),
    status: feld(root, 'status') ?? '',
    bestaende: (summen?.children ?? [])
      .filter((c) => c.name === 'bestand')
      .map((b) => ({
        code: b.attrs.code ?? '',
        ...optional('empfangen', zahl(b, 'meldungen_empfangen')),
        ...optional('uebernommen', zahl(b, 'meldungen_uebernommen')),
      })),
    meldungen: (meldungen?.children ?? [])
      .filter((c) => c.name === 'meldung')
      .map((m) => {
        const weitere: Record<string, string> = {};
        for (const c of m.children) {
          if (!BEKANNT_MELDUNG.has(c.name)) weitere[c.name] = c.text.trim();
        }
        return {
          status: m.attrs.status ?? '',
          ...optional('referenznummer', feld(m, 'referenznummer')),
          ...optional('zeilennummer', zahl(m, 'zeilennummer')),
          codes: codesVon(m),
          weitere,
        };
      }),
    codes: codesVon(root),
  };
}

function optional<K extends string, V>(name: K, wert: V | undefined): { [P in K]?: V } {
  return (wert === undefined ? {} : { [name]: wert }) as { [P in K]?: V };
}

// --- Clearing-Datensatz 2.0 -------------------------------------------------

/** `zustellungsgrund` laut Schema: Dialogfall gemeldet, urgiert, obsolet gesetzt. */
export const ZUSTELLUNGSGRUND = { M: 'gemeldet', U: 'urgiert', O: 'obsolet gesetzt' } as const;

/** `dringlichkeit` laut Schema (Dialogfall und Clearing-Information). */
export const DRINGLICHKEIT = {
  D: 'dringend, Handlung nötig',
  K: 'Kontrollfall, Meldung kontrollieren',
  N: 'nicht dringend',
} as const;

/** `meldungStatus` laut ÖGK („SV-Clearingsystem: Clearing-Datensatz“). */
export const MELDUNG_STATUS = {
  NV: 'nicht verarbeitet',
  IA: 'in Arbeit',
  VA: 'verarbeitet',
  ST: 'storniert',
} as const;

/** `meldungStatusZusatz` laut ÖGK, mit der Verfahrensart, für die er gilt. */
export const MELDUNG_STATUS_ZUSATZ = {
  NB: 'nicht verbucht (Selbstabrechnung)',
  OB: 'noch nicht verbucht (Selbstabrechnung)',
  VB: 'verbucht (Selbstabrechnung)',
  TB: 'teilweise verbucht (Selbstabrechnung)',
  NV: 'Verrechnung nicht möglich (Vorschreibung)',
  OV: 'Verrechnung noch nicht möglich (Vorschreibung)',
  VV: 'Verrechnung möglich (Vorschreibung)',
} as const;

/** Inhaltsversion, die dieses Paket dekodiert. */
export const MVB_CLEARING_VERSION = 'MVB_CLEARING_2_0_0';

export interface Fachinformation {
  typ: string;
  /** Welche Wahl des Schemas belegt ist; der Wert bleibt Text. */
  art: 'numerisch' | 'alphaNumerisch' | 'datum';
  wert: string;
}

export interface ClearingInformation {
  dringlichkeit?: string;
  /** `informationCodeFachsystem`, z. B. `BW1838`. */
  code?: string;
  /** `informationTextFachsystem` – der Rückfragetext im Klartext. */
  text: string;
  /** `clearingDatenExtern`: die Werte, die im Text eingesetzt sind. */
  daten: { typCode: string; bezeichnung: string; wert: string }[];
}

export interface ClearingInhalt {
  meldungStatus?: string;
  meldungStatusZusatz?: string;
  stornoMeldungZulaessig?: string;
  informationen: ClearingInformation[];
}

export interface Dialogfall {
  testkennzeichen: string;
  version: string;
  zustellungsgrund: string;
  bereitstellungsdatum: string;
  dringlichkeit?: string;
  traegercode: string;
  beitragskontonummer: string;
  /** Referenzwert der Meldung, auf die sich der Fall bezieht – oder ein interner. */
  referenzwert: string;
  versicherungsnummer?: string;
  familienname?: string;
  vorname?: string;
  fachinformationen: Fachinformation[];
  projektCode: string;
  bestandBez: string;
  satzart: string;
  satzartBez: string;
  meldung: {
    version: string;
    /** Dekodiert, wenn `version` {@link MVB_CLEARING_VERSION} ist, sonst `undefined`. */
    inhalt?: ClearingInhalt;
    /** Der dekodierte Inhalt als Bytes – immer vorhanden. */
    inhaltRoh: Buffer;
  };
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function liesFachinformation(f: XmlNode): Fachinformation | undefined {
  const typ = feld(f, 'typ');
  const wert = firstChild(f, 'wert');
  const wahl = wert?.children.find((c) => ['numerisch', 'alphaNumerisch', 'datum'].includes(c.name));
  if (!typ || !wahl) return undefined;
  return { typ, art: wahl.name as Fachinformation['art'], wert: wahl.text.trim() };
}

function liesInhalt(bytes: Buffer): ClearingInhalt {
  const root = wurzel(bytes, 'clearingInformationenExtern', 'Clearing-Inhalt');
  return {
    ...optional('meldungStatus', feld(root, 'meldungStatus')),
    ...optional('meldungStatusZusatz', feld(root, 'meldungStatusZusatz')),
    ...optional('stornoMeldungZulaessig', feld(root, 'stornoMeldungZulaessig')),
    informationen: root.children
      .filter((c) => c.name === 'clearingInformationExtern')
      .map((i) => ({
        ...optional('dringlichkeit', feld(i, 'dringlichkeit')),
        ...optional('code', feld(i, 'informationCodeFachsystem')),
        text: feld(i, 'informationTextFachsystem') ?? '',
        daten: i.children
          .filter((c) => c.name === 'clearingDatenExtern')
          .map((d) => ({
            typCode: feld(d, 'datenParameterTypeCode') ?? '',
            bezeichnung: feld(d, 'datenParameterBezeichnung') ?? '',
            wert: feld(d, 'datenParameterWert') ?? '',
          })),
      })),
  };
}

/**
 * Liest einen Clearing-Datensatz 2.0 (`cm_<Nummer>.xml`): je Dialogfall die
 * Meldungsinfo und den Base64-kodierten Inhalt, dekodiert und gelesen.
 *
 * @throws EldaProtocolError wenn das XML nicht lesbar ist, die Wurzel nicht
 *   `dialogfallListe` heißt oder ein Inhalt kein sauberes Base64 ist.
 */
export function liesClearing(xml: string | Buffer): Dialogfall[] {
  const root = wurzel(xml, 'dialogfallListe', 'Clearing-Datensatz');
  return root.children
    .filter((c) => c.name === 'dialogfall')
    .map((fall, i) => {
      const info = firstChild(fall, 'meldungInfo');
      const meldung = firstChild(fall, 'meldung');
      if (!info || !meldung) {
        throw new EldaProtocolError(`Clearing-Datensatz: Dialogfall ${i + 1} ohne meldungInfo oder meldung.`);
      }
      const b64 = (childText(meldung, 'inhalt') ?? '').replace(/\s+/g, '');
      if (b64.length % 4 !== 0 || !BASE64.test(b64)) {
        throw new EldaProtocolError(
          `Clearing-Datensatz: Dialogfall ${i + 1}: Inhalt ist kein sauberes Base64.`,
        );
      }
      const inhaltRoh = Buffer.from(b64, 'base64');
      const version = feld(meldung, 'version') ?? '';
      return {
        testkennzeichen: feld(fall, 'testkennzeichen') ?? '',
        version: feld(fall, 'version') ?? '',
        zustellungsgrund: feld(fall, 'zustellungsgrund') ?? '',
        bereitstellungsdatum: feld(info, 'bereitstellungsdatum') ?? '',
        ...optional('dringlichkeit', feld(info, 'dringlichkeit')),
        traegercode: feld(info, 'traegercode') ?? '',
        beitragskontonummer: feld(info, 'beitragskontonummer') ?? '',
        referenzwert: feld(info, 'referenzwert') ?? '',
        ...optional('versicherungsnummer', feld(info, 'versicherungsnummer')),
        ...optional('familienname', feld(info, 'familienname')),
        ...optional('vorname', feld(info, 'vorname')),
        fachinformationen: info.children
          .filter((c) => c.name === 'fachinformation')
          .map(liesFachinformation)
          .filter((f): f is Fachinformation => f !== undefined),
        projektCode: feld(info, 'projektCode') ?? '',
        bestandBez: feld(info, 'bestandBez') ?? '',
        satzart: feld(info, 'satzart') ?? '',
        satzartBez: feld(info, 'satzartBez') ?? '',
        meldung: {
          version,
          ...(version === MVB_CLEARING_VERSION ? { inhalt: liesInhalt(inhaltRoh) } : {}),
          inhaltRoh,
        },
      };
    });
}
