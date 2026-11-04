import { FonProtocolError, parseXml, type XmlNode } from '@kreiseck/finanzonline-core';

/** Ein Satz (eine Erklärung) im Übermittlungsprotokoll. */
export interface U30ProtokollSatz {
  satzNr: number | 'INFO_DATEN';
  fastnr?: string;
  kundeninfo?: string;
  /** FEHLTEXT-Einträge; leer = für diesen Satz kein Fehler gemeldet. */
  fehler: string[];
  drucktext?: string;
  /** Zahllast/Gutschrift laut FinanzOnline; `cent` negativ bei Gutschrift, fehlt, wenn unlesbar. */
  druckbetrag?: { roh: string; cent?: number };
}

/** Ausgewertetes U30-Übermittlungsprotokoll aus der DataBox. */
export interface U30Protokoll {
  /** Aus dem TEXT: „TEST-Übermittlung" → T, „PRODUKTIONS-Übermittlung" → P. */
  uebermittlung?: 'T' | 'P';
  /** `vollstaendig` = zur Gänze übernommen/eingebracht; `teilweise` = „nicht (vollständig)". */
  ergebnis: 'vollstaendig' | 'teilweise' | 'nicht' | 'unbekannt';
  /** Ganzes Paket nicht angenommen (SATZNR INFO_DATEN oder „nicht eingebracht/übernommen"). */
  paketAbgelehnt: boolean;
  paketNr?: number;
  uebermittler?: string;
  anzahlErklaerungen?: number;
  /** Wie geliefert, z. B. `2026-11-03`. */
  datum?: string;
  /** Wie geliefert, z. B. `20.20.46`. */
  uhrzeit?: string;
  text?: string;
  saetze: U30ProtokollSatz[];
  /** FEHLTEXT, der keinem Satz zugeordnet ist (Fehler auf Paketebene). */
  paketFehler: string[];
  /** Satznummern mit FEHLTEXT. Eine Erklärung gilt als übernommen, wenn das Paket nicht abgelehnt ist und ihre Satznummer hier fehlt. */
  abgelehnteSaetze: number[];
  /** Namen von Elementen, die der Parser nicht kennt (Format des Produktionsprotokolls ist noch nicht an echten Daten bestätigt). */
  unbekannteElemente: string[];
}

/** Dekodiert Bytes nach der XML-Deklaration (ISO-8859-1 oder sonst UTF-8). */
function dekodiere(bytes: Buffer): string {
  const kopf = bytes.subarray(0, 200).toString('latin1');
  const kodierung = /encoding\s*=\s*["']([^"']+)["']/i.exec(kopf)?.[1]?.toLowerCase();
  return kodierung === 'iso-8859-1' || kodierung === 'latin1'
    ? bytes.toString('latin1')
    : bytes.toString('utf8');
}

const ganzzahl = (s: string): number | undefined => (/^\d{1,15}$/.test(s) ? Number(s) : undefined);

/** `2.185,34` / `2185,34` / `2185.34` → Cent; sonst `undefined`. */
function druckbetragCent(roh: string): number | undefined {
  const s = roh.trim();
  const deutsch = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})$/.exec(s);
  const punkt = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  const m = deutsch ?? punkt;
  if (!m) return undefined;
  const euro = Number((m[2] ?? '').replace(/\./g, ''));
  const cent = Number((m[3] ?? '').padEnd(2, '0'));
  const betrag = euro * 100 + cent;
  if (!Number.isSafeInteger(betrag)) return undefined;
  return m[1] === '-' ? -betrag : betrag;
}

function ergebnisAusText(text: string | undefined): U30Protokoll['ergebnis'] {
  if (text === undefined) return 'unbekannt';
  if (/zur Gänze (übernommen|eingebracht)/.test(text)) return 'vollstaendig';
  if (/nicht \(vollständig\) (übernommen|eingebracht)/.test(text)) return 'teilweise';
  if (/nicht (übernommen|eingebracht)/.test(text)) return 'nicht';
  return 'unbekannt';
}

function uebermittlungAusText(text: string | undefined): 'T' | 'P' | undefined {
  if (text === undefined) return undefined;
  if (/TEST-Übermittlung/.test(text)) return 'T';
  // „PODUKTIONS" steht so (Tippfehler) im BMF-Dokument „Allgemeines – Protokolle".
  if (/P(R)?ODUKTIONS-Übermittlung/.test(text)) return 'P';
  return undefined;
}

/**
 * Liest ein U30-Übermittlungsprotokoll (flaches `<XML>`, wie es FinanzOnline
 * in die DataBox legt). Jedes `SATZNR` beginnt einen neuen Satz; FEHLTEXT,
 * FASTNR, KUNDENINFO, DRUCKTEXT und DRUCKBETRAG gehören zum laufenden Satz.
 * Unbekanntes wird gesammelt, nicht verworfen und nicht als Fehler behandelt.
 *
 * Bestätigt an echten Testprotokollen vom 03.11.2026; das Produktionsformat
 * (DRUCKTEXT/DRUCKBETRAG) folgt der BMF-Beschreibung und ist noch nicht an
 * echten Daten gesehen.
 */
export function parseU30Protokoll(xml: string | Buffer): U30Protokoll {
  const text = (typeof xml === 'string' ? xml : dekodiere(xml)).replace(/^\uFEFF/, '');
  let wurzel: XmlNode;
  try {
    wurzel = parseXml(text);
  } catch (err) {
    throw new FonProtocolError(`U30-Protokoll ist kein gültiges XML: ${(err as Error).message}`, {
      cause: err,
      rohantwort: text,
    });
  }
  if (wurzel.name !== 'XML') {
    throw new FonProtocolError(`U30-Protokoll: Wurzel <XML> erwartet, gefunden <${wurzel.name}>`, {
      rohantwort: text,
    });
  }

  const p: U30Protokoll = {
    ergebnis: 'unbekannt',
    paketAbgelehnt: false,
    saetze: [],
    paketFehler: [],
    abgelehnteSaetze: [],
    unbekannteElemente: [],
  };
  let satz: U30ProtokollSatz | undefined;

  for (const kind of wurzel.children) {
    const wert = kind.text.trim();
    switch (kind.name) {
      case 'ART_IDENTIFIKATIONSBEGRIFF':
        break;
      case 'IDENTIFIKATIONSBEGRIFF':
        p.uebermittler = wert;
        break;
      case 'PAKET_NR': {
        const n = ganzzahl(wert);
        if (n !== undefined) p.paketNr = n;
        break;
      }
      case 'DATUM_ERSTELLUNG':
        p.datum = wert;
        break;
      case 'UHRZEIT_ERSTELLUNG':
        p.uhrzeit = wert;
        break;
      case 'ANZAHL_ERKLAERUNGEN': {
        const n = ganzzahl(wert);
        if (n !== undefined) p.anzahlErklaerungen = n;
        break;
      }
      case 'TEXT':
        p.text = wert;
        break;
      case 'SATZNR': {
        const n = ganzzahl(wert);
        if (n === undefined && wert !== 'INFO_DATEN') {
          p.unbekannteElemente.push(kind.name);
          satz = undefined;
          break;
        }
        satz = { satzNr: n ?? 'INFO_DATEN', fehler: [] };
        p.saetze.push(satz);
        break;
      }
      case 'FEHLTEXT':
      case 'FASTNR':
      case 'KUNDENINFO':
      case 'DRUCKTEXT':
      case 'DRUCKBETRAG':
        if (!satz) {
          if (kind.name === 'FEHLTEXT') p.paketFehler.push(wert);
          else p.unbekannteElemente.push(kind.name);
        } else if (kind.name === 'FEHLTEXT') {
          satz.fehler.push(wert);
        } else if (kind.name === 'FASTNR') {
          satz.fastnr = wert;
        } else if (kind.name === 'KUNDENINFO') {
          satz.kundeninfo = wert;
        } else if (kind.name === 'DRUCKTEXT') {
          satz.drucktext = wert;
        } else {
          const cent = druckbetragCent(wert);
          satz.druckbetrag = cent === undefined ? { roh: wert } : { roh: wert, cent };
        }
        break;
      default:
        p.unbekannteElemente.push(kind.name);
    }
  }

  // Vorzeichen erst am Ende: DRUCKTEXT kann vor oder nach DRUCKBETRAG stehen.
  for (const s of p.saetze) {
    if (
      s.druckbetrag?.cent !== undefined &&
      /Gutschrift/i.test(s.drucktext ?? '') &&
      s.druckbetrag.cent > 0
    ) {
      s.druckbetrag.cent = -s.druckbetrag.cent;
    }
  }

  const ergebnis = ergebnisAusText(p.text);
  p.ergebnis = ergebnis;
  const uebermittlung = uebermittlungAusText(p.text);
  if (uebermittlung) p.uebermittlung = uebermittlung;
  p.abgelehnteSaetze = p.saetze.flatMap((s) =>
    typeof s.satzNr === 'number' && s.fehler.length > 0 ? [s.satzNr] : [],
  );
  p.paketAbgelehnt = ergebnis === 'nicht' || p.saetze.some((s) => s.satzNr === 'INFO_DATEN');
  return p;
}

/**
 * Ob eine Erklärung (Satz) laut Protokoll übernommen wurde — nur bei positivem
 * Beleg `true`. `false` bei abgelehntem Paket oder FEHLTEXT zum Satz.
 * `undefined`, wenn das Protokoll das nicht sicher sagt (`ergebnis` unbekannt):
 * dann **nicht** als eingebracht werten und das Roh-XML ansehen.
 */
export function istUebernommen(protokoll: U30Protokoll, satzNr: number): boolean | undefined {
  if (protokoll.paketAbgelehnt || protokoll.abgelehnteSaetze.includes(satzNr)) return false;
  if (protokoll.ergebnis === 'vollstaendig' || protokoll.ergebnis === 'teilweise') return true;
  return undefined;
}

/** Paketnummer aus dem DataBox-Dateinamen `Webservice_U30_<Zeitstempel>_<PAKET_NR>`. */
export function paketNrAusFilebez(filebez: string): number | undefined {
  const m = /^Webservice_U30_.+_(\d{1,9})$/.exec(filebez);
  return m ? Number(m[1]) : undefined;
}
