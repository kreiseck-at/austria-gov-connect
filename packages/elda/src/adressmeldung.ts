import { EldaError } from './errors';
import { FELDER_E31, SATZLAENGE_E31 } from './felder-e31';
import { LEER_CODE_E31, PFLICHT_E31 } from './pflicht-e31';
import { pruefePflichtstufen } from './pflicht-gemeinsam';
import { pruefeAdressmeldungInhalt } from './pruefung-e31';
import {
  BEST_ADRESSE_VERSICHERTER,
  VERSION_ADRESSE_VERSICHERTER,
  baueBestand,
  type BestandOptionen,
  type RohSatz,
} from './bestand';

/** Die fachlichen Felder einer Adressmeldung Versicherter, benannt wie in Kapitel E.31. */
export interface AdressmeldungFelder {
  /** Referenzwert: eindeutige Identifikation dieser Meldung (Kapitel D.43). */
  REFW?: string;
  /** Beitragskontonummer beim zuständigen Versicherungsträger. */
  BKNR?: string;
  /** Dienstgebername. */
  DGNA?: string;
  /** Telefonnummer des Dienstgebers. */
  DTEL?: string;
  /** Mailadresse des Dienstgebers. */
  MAIL?: string;
  /** Erstes freies Informationsfeld. */
  INF1?: string;
  /** Zweites freies Informationsfeld. */
  INF2?: string;
  /** Versicherungsnummer in der Form LLLPTTMMJJ. */
  VSNR?: string;
  /** Wohnort: internationales KFZ-Kennzeichen des ausländischen Hauptwohnsitzes — nicht `A`. */
  WKFZ?: string;
  /** Wohnort: Postleitzahl, bei ausländischen Adressen ohne KFZ-Kennzeichen (Kapitel D.12). */
  PLZL?: string;
  /** Wohnort: Ort. */
  WORT?: string;
  /** Wohnort: Straße. */
  WSTR?: string;
  /** Wohnort: Hausnummer. */
  WHNR?: string;
  /** Wohnort: Stock, Tür, Rest. */
  WTUR?: string;
}

/**
 * Baut eine Adressmeldung Versicherter (Satzart `AV`, Kapitel E.31), geprüft
 * gegen die Pflichtstufen aus E.31.1 und die entscheidbaren Regeln des
 * Prüfkatalogs (Blatt `AV`).
 *
 * Wozu (E.31.2.1, Seite 346): An die ÖGK geht die Meldung **ausschließlich**
 * für einen ausländischen Hauptwohnsitz — inländische Adressen bezieht die ÖGK
 * aus dem zentralen Melderegister. Verpflichtend ist sie bei der ersten
 * Beschäftigung mit bekannter VSNR, bei einer Wiederanmeldung mit neuem
 * ausländischen Hauptwohnsitz und bei einer Adressänderung während des
 * Dienstverhältnisses. Nicht nötig ist sie, wenn neben der Anmeldung eine
 * VSNR-Anforderung geht (die trägt die Adresse selbst) oder wenn der
 * ausländische Hauptwohnsitz bei einer erneuten Beschäftigung unverändert ist.
 */
export function adresseVersicherter(felder: AdressmeldungFelder): RohSatz {
  const werte: Record<string, string | undefined> = { ...felder };
  pruefePflichtstufen('Satzart AV (Adresse Versicherter)', PFLICHT_E31, FELDER_E31, werte, LEER_CODE_E31);
  pruefeAdressmeldungInhalt(werte);
  return Object.freeze({
    satzart: 'AV',
    werte: Object.freeze(werte),
    felder: FELDER_E31,
    satzlaenge: SATZLAENGE_E31,
  });
}

/** Zuständiger Träger ÖGK-V (Kapitel D.4, Seite 67). */
const VSTR_OEGK_V = '19';

/**
 * Klammert Adressmeldungen zu einem Datenbestand mit der Bestandsbezeichnung
 * `AV` und der Satzstruktur-Version `01`. Ein Satz einer anderen Satzart wird
 * abgewiesen (Kapitel C.1: Daten zu genau einer Verarbeitung).
 *
 * `F8012` (Prüfkatalog, Status `N`): Beim Träger ÖGK-V darf die
 * Beitragskontonummer nicht mit einem Leerzeichen beginnen.
 */
export function erstelleAdressmeldungBestand(saetze: readonly RohSatz[], opt: BestandOptionen): Buffer {
  for (const s of saetze) {
    if (s.satzart !== 'AV') {
      throw new EldaError(
        `Ein AV-Bestand nimmt nur Adressmeldungen Versicherter auf, nicht Satzart ${s.satzart} (Kapitel C.1).`,
      );
    }
    if (opt.versicherungstraeger === VSTR_OEGK_V && s.werte.BKNR?.startsWith(' ')) {
      throw new EldaError(
        'F8012: Die Beitragskontonummer darf bei der ÖGK-V nicht mit einem Leerzeichen beginnen.',
      );
    }
  }
  return baueBestand(saetze, {
    ...opt,
    bestandsbezeichnung: BEST_ADRESSE_VERSICHERTER,
    satzstrukturVersion: VERSION_ADRESSE_VERSICHERTER,
  });
}
