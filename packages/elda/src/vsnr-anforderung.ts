import { EldaError } from './errors';
import { FELDER_E30, SATZLAENGE_E30 } from './felder-e30';
import { LEER_CODE_E30, PFLICHT_E30 } from './pflicht-e30';
import { pruefePflichtstufen } from './pflicht-gemeinsam';
import { pruefeVsnrAnforderungInhalt } from './pruefung-e30';
import {
  BEST_VSNR_ANFORDERUNG,
  VERSION_VSNR_ANFORDERUNG,
  baueBestand,
  type BestandOptionen,
  type RohSatz,
} from './bestand';

/**
 * Die fachlichen Felder einer VSNR-Anforderung, benannt wie in Kapitel E.30.
 * Alle Werte sind Zeichenketten in der Form, die das Dokument vorgibt.
 */
export interface VsnrAnforderungFelder {
  /**
   * Referenzwert. Er kommt als `REFV` in die Anmeldung, solange die
   * Versicherungsnummer noch nicht zurückgemeldet ist (Kapitel E.30.2, D.45).
   */
  REFW?: string;
  /** Beitragskontonummer beim zuständigen Versicherungsträger. */
  BKNR?: string;
  /** Dienstgebername. */
  DGNA?: string;
  /** Telefonnummer des Dienstgebers. */
  DTEL?: string;
  /** Mailadresse des Dienstgebers. */
  MAIL?: string;
  /** Erstes freies Informationsfeld, z. B. die betriebsinterne Personalnummer. */
  INF1?: string;
  /** Zweites freies Informationsfeld. */
  INF2?: string;
  /** Geburtsdatum TTMMJJJJ; auch 00MMJJJJ oder 0000JJJJ (Kapitel D.7). */
  GEBD?: string;
  /** Familienname (Kapitel D.8). */
  FANA?: string;
  /** Früherer Familienname, wenn bekannt (Kapitel D.8). */
  FNA1?: string;
  /** Vorname (Kapitel D.9). */
  VONA?: string;
  /** Akademischer Grad vor dem Familiennamen (Kapitel D.10). */
  AKGV?: string;
  /** Akademischer Grad nach dem Familiennamen (Kapitel D.10). */
  AKGH?: string;
  /** Geschlecht: 1 männlich, 2 weiblich, 3 divers, 4 offen, 6 inter, 7 keine Angabe. */
  GESL?: string;
  /** Staatsangehörigkeit als ISOA3-Code der Staatencode-Tabelle, z. B. `AUT` (Kapitel D.11). */
  STSL?: string;
  /** Wohnort: internationales KFZ-Kennzeichen, `A` für Österreich (Kapitel D.12). */
  WKFZ?: string;
  /** Wohnort: Postleitzahl. */
  PLZL?: string;
  /** Wohnort: Ort. */
  WORT?: string;
  /** Wohnort: Straße. */
  WSTR?: string;
  /** Wohnort: Hausnummer. */
  WHNR?: string;
  /** Wohnort: Stock, Tür, Rest — getrennt durch „/" (Kapitel D.12). */
  WTUR?: string;
}

/**
 * Baut eine VSNR-Anforderung (Satzart `VS`, Kapitel E.30), geprüft gegen die
 * Pflichtstufen aus E.30.1 und die entscheidbaren Regeln des Prüfkatalogs
 * (Blatt `VS`). Das Ergebnis ist eingefroren wie bei der Versichertenmeldung.
 *
 * Wozu (E.30.2, Seite 343): Ist für eine anzumeldende Person noch keine
 * Versicherungsnummer vergeben, fordert der Dienstgeber mit diesem Satz eine
 * an — vorab oder spätestens zeitgleich mit der Anmeldung. Die Anmeldung trägt
 * dann statt der VSNR das Geburtsdatum und den Referenzwert dieser Anforderung
 * (`REFV`). Die vergebene Nummer kommt über das Clearingsystem mit diesem
 * Referenzwert zurück; danach gilt für alle Meldungen die VSNR (D.45).
 *
 * Ist die Nummer nur unbekannt, aber schon vergeben, kann sie laut E.30.2 im
 * „WEB-BE-Kunden Portal" abgefragt werden.
 */
export function vsnrAnforderung(felder: VsnrAnforderungFelder): RohSatz {
  const werte: Record<string, string | undefined> = { ...felder };
  pruefePflichtstufen('Satzart VS (VSNR Anforderung)', PFLICHT_E30, FELDER_E30, werte, LEER_CODE_E30);
  pruefeVsnrAnforderungInhalt(werte);
  return Object.freeze({
    satzart: 'VS',
    werte: Object.freeze(werte),
    felder: FELDER_E30,
    satzlaenge: SATZLAENGE_E30,
  });
}

/** Zuständiger Träger ÖGK-V (Kapitel D.4, Seite 67). */
const VSTR_OEGK_V = '19';

/**
 * Klammert VSNR-Anforderungen zu einem Datenbestand mit der
 * Bestandsbezeichnung `VS` und der Satzstruktur-Version `01`.
 *
 * Laut Kapitel C.1 trägt ein Bestand Daten zu genau einer Verarbeitung; ein
 * Satz einer anderen Satzart wird deshalb abgewiesen. Die zugehörige Anmeldung
 * geht als eigener Bestand (`erstelleBestand`, Bestandsbezeichnung `VR`).
 *
 * `F6512` (Prüfkatalog, Status `N`): Beim Träger ÖGK-V darf die
 * Beitragskontonummer nicht mit einem Leerzeichen beginnen.
 */
export function erstelleVsnrAnforderungBestand(saetze: readonly RohSatz[], opt: BestandOptionen): Buffer {
  for (const s of saetze) {
    if (s.satzart !== 'VS') {
      throw new EldaError(
        `Ein VS-Bestand nimmt nur VSNR-Anforderungen auf, nicht Satzart ${s.satzart} (Kapitel C.1).`,
      );
    }
    if (opt.versicherungstraeger === VSTR_OEGK_V && s.werte.BKNR?.startsWith(' ')) {
      throw new EldaError(
        'F6512: Die Beitragskontonummer darf bei der ÖGK-V nicht mit einem Leerzeichen beginnen.',
      );
    }
  }
  return baueBestand(saetze, {
    ...opt,
    bestandsbezeichnung: BEST_VSNR_ANFORDERUNG,
    satzstrukturVersion: VERSION_VSNR_ANFORDERUNG,
  });
}
