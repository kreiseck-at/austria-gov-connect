import { wienerOrtszeit } from '../wien';
import { U30PruefError } from './fehler';
import { KENNZAHLEN, type KennzahlInfo } from './kennzahlen';
import { effektiveSatzNr, effektiverUebermittler, pruefeU30 } from './pruefe';
import { schnappschuss } from './schnappschuss';
import type { U30Erklaerung, U30Paket } from './typen';
import { zrVonBis } from './zeitraum';

/** Innere Deklaration: FinanzOnline liest `data` als ISO-8859-1 (Testlauf 03.11.2026). */
const DEKLARATION = '<?xml version="1.0" encoding="iso-8859-1"?>\n';

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Cent → XSD-Dezimalzahl mit Punkt und zwei Nachkommastellen, z. B. -50 → `-0.50`. */
function betrag(cent: number): string {
  const neg = cent < 0;
  const b = Math.abs(cent);
  return `${neg ? '-' : ''}${Math.floor(b / 100)}.${String(b % 100).padStart(2, '0')}`;
}

function kennzahlElemente(e: U30Erklaerung, block: KennzahlInfo['block']): string {
  let xml = '';
  for (const info of KENNZAHLEN) {
    if (info.block !== block) continue;
    const wert = Object.hasOwn(e.kennzahlen, info.kz) ? e.kennzahlen[info.kz] : undefined;
    if (block === 'STEUERFREI' && info.kz === 'kz020' && e.vst !== undefined) {
      xml += `<VST>${escape(e.vst)}</VST>`; // XSD: …, KZ016, VST, KZ020
    }
    const schreiben = info.kz === 'kz000' ? true : wert !== undefined && wert !== 0;
    if (schreiben) xml += `<KZ${info.nummer} type="kz">${betrag(wert ?? 0)}</KZ${info.nummer}>`;
  }
  return xml;
}

const umschliesse = (element: string, inhalt: string): string =>
  inhalt === '' ? '' : `<${element}>${inhalt}</${element}>`;

function erklaerungXml(paket: U30Paket, index: number): string {
  const e = paket.erklaerungen[index] as U30Erklaerung;
  const zr = zrVonBis(e.zeitraum) as { zrvon: string; zrbis: string };
  const kundeninfo = e.kundeninfo ? `<KUNDENINFO>${escape(e.kundeninfo)}</KUNDENINFO>` : '';

  const lieferungen =
    kennzahlElemente(e, 'L') +
    umschliesse('STEUERFREI', kennzahlElemente(e, 'STEUERFREI')) +
    umschliesse('VERSTEUERT', kennzahlElemente(e, 'VERSTEUERT'));
  const erwerbe = umschliesse(
    'INNERGEMEINSCHAFTLICHE_ERWERBE',
    kennzahlElemente(e, 'IGE') + umschliesse('VERSTEUERT_IGE', kennzahlElemente(e, 'VERSTEUERT_IGE')),
  );
  const vorsteuer = umschliesse(
    'VORSTEUER',
    kennzahlElemente(e, 'VORSTEUER') +
      (e.ueberschussVerwenden === true ? '<ARE>J</ARE>' : '') +
      (e.rechnungskopien === true ? '<REPO>J</REPO>' : ''),
  );

  return (
    `<ERKLAERUNG art="U30"><SATZNR>${effektiveSatzNr(paket, index)}</SATZNR>` +
    `<ALLGEMEINE_DATEN><ANBRINGEN>U30</ANBRINGEN>` +
    `<ZRVON type="jahrmonat">${zr.zrvon}</ZRVON><ZRBIS type="jahrmonat">${zr.zrbis}</ZRBIS>` +
    `<FASTNR>${e.steuernummer}</FASTNR>${kundeninfo}</ALLGEMEINE_DATEN>` +
    `<LIEFERUNGEN_LEISTUNGEN_EIGENVERBRAUCH>${lieferungen}</LIEFERUNGEN_LEISTUNGEN_EIGENVERBRAUCH>` +
    `${erwerbe}${vorsteuer}</ERKLAERUNG>`
  );
}

/**
 * Baut das U30-XML (`ERKLAERUNGS_UEBERMITTLUNG`) genau nach dem amtlichen Schema
 * (Reihenfolge laut XSD, Deklaration ISO-8859-1, kompakt wie im Testlauf vom
 * 03.11.2026 von FinanzOnline angenommen). Prüft vorher mit {@link pruefeU30}
 * und wirft {@link U30PruefError}, statt ein fehlerhaftes XML zu liefern.
 *
 * Kennzahlen mit Wert 0 werden weggelassen (FinanzOnline wertet ein fehlendes
 * Element als 0), KZ 000 wird immer geschrieben. Erstellungsdatum und -uhrzeit
 * in Wiener Zeit aus `paket.erstellt` (Standard: `jetzt` bzw. aktuelle Zeit).
 */
export function baueU30Xml(eingabe: U30Paket, optionen?: { jetzt?: Date }): string {
  // Prüfung und Bau lesen dieselbe Momentaufnahme — nichts kommt an der Prüfung vorbei.
  const paket = schnappschuss(eingabe);
  const fehler = pruefeU30(paket, optionen);
  if (fehler.length > 0) throw new U30PruefError(fehler);

  const w = wienerOrtszeit(paket.erstellt ?? optionen?.jetzt ?? new Date());
  const uebermittler = effektiverUebermittler(paket) as string;
  const info =
    `<INFO_DATEN><ART_IDENTIFIKATIONSBEGRIFF>FASTNR</ART_IDENTIFIKATIONSBEGRIFF>` +
    `<IDENTIFIKATIONSBEGRIFF>${uebermittler}</IDENTIFIKATIONSBEGRIFF>` +
    `<PAKET_NR>${paket.paketNr}</PAKET_NR>` +
    `<DATUM_ERSTELLUNG type="datum">${w.jahr}-${w.monat}-${w.tag}</DATUM_ERSTELLUNG>` +
    `<UHRZEIT_ERSTELLUNG type="uhrzeit">${w.stunde}:${w.minute}:${w.sekunde}</UHRZEIT_ERSTELLUNG>` +
    `<ANZAHL_ERKLAERUNGEN>${paket.erklaerungen.length}</ANZAHL_ERKLAERUNGEN></INFO_DATEN>`;

  const erklaerungen = paket.erklaerungen.map((_, i) => erklaerungXml(paket, i)).join('');
  return `${DEKLARATION}<ERKLAERUNGS_UEBERMITTLUNG>${info}${erklaerungen}</ERKLAERUNGS_UEBERMITTLUNG>\n`;
}
