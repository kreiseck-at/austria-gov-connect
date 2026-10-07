import { EldaError } from './errors';
import { FELDER_E22, SATZLAENGE_E22, TAETIGKEITSBLOECKE } from './felder-e22';
import { pruefePflichtSM, type SatzartSM } from './pflicht-e22';
import { pruefeSchwerarbeit } from './pruefung-e22';
import {
  BEST_SCHWERARBEIT,
  VERSION_SCHWERARBEIT,
  baueBestand,
  type BestandOptionen,
  type RohSatz,
} from './bestand';

/** Eine Tätigkeit im Tätigkeitsjahr — ein Block der Felder 17–19. */
export interface Schwerarbeitszeit {
  /** Art der Tätigkeit, siehe `TAETIGKEIT` (Feld TART). */
  art: string;
  /** Beginn TTMM (Feld TVON). */
  von: string;
  /** Ende TTMM (Feld TBIS). */
  bis: string;
}

/**
 * Die fachlichen Felder einer Schwerarbeitsmeldung, benannt wie in Kapitel
 * E.22. Die bis zu 26 Tätigkeitsblöcke kommen als Liste `taetigkeiten`; dieses
 * Modul verteilt sie der Reihe nach auf die Blöcke 1 bis 26.
 */
export interface SchwerarbeitsFelder {
  /** Beitragskontonummer beim zuständigen Versicherungsträger. */
  BKNR?: string;
  /** Dienstgebername. */
  DGNA?: string;
  /** Weiterer Ordnungsbegriff des Dienstgebers, z. B. die Personalnummer. */
  WOBD?: string;
  /** Zusätzlicher Ordnungsbegriff, wenn WOBD nicht ausreicht. */
  ZOBD?: string;
  /** Telefonnummer des Dienstgebers. */
  DTEL?: string;
  /** Mailadresse des Dienstgebers. */
  MAIL?: string;
  /** Dienstgeber, Land als Kfz-Kennzeichen, z. B. `A`. */
  DKFZ?: string;
  /** Dienstgeber, Postleitzahl. */
  DPLZ?: string;
  /** Dienstgeber, Ort. */
  DORT?: string;
  /** Dienstgeber, Straße und Hausnummer. */
  DSTR?: string;
  /** Versicherungsnummer LLLPTTMMJJ. */
  VSNR?: string;
  /** Geburtsdatum TTMMJJJJ. */
  GEBD?: string;
  /** Erster Familienname. */
  FANA?: string;
  /** Erster Vorname. */
  VONA?: string;
  /** Kalenderjahr, in dem die Schwerarbeit verrichtet wurde, JJJJ. */
  JAHR?: string;
  /** Referenznummer; ELDA meldet sie in der Rückantwort zurück. */
  REFN?: string;
  /** Die Tätigkeiten des Jahres, höchstens 26. */
  taetigkeiten?: readonly Schwerarbeitszeit[];
}

function baue(satzart: SatzartSM, felder: SchwerarbeitsFelder): RohSatz {
  const { taetigkeiten = [], ...rest } = felder;
  if (taetigkeiten.length > TAETIGKEITSBLOECKE) {
    // Wie mehr als 26 Tätigkeiten zu melden sind (weiterer Satz? zusammenfassen?),
    // sagt Kapitel E.22 nicht. Geraten wird nicht.
    throw new EldaError(
      `Eine Schwerarbeitsmeldung hat Platz für ${TAETIGKEITSBLOECKE} Tätigkeiten (Kapitel E.22), ` +
        `übergeben wurden ${taetigkeiten.length}.`,
    );
  }
  const werte: Record<string, string | undefined> = { ...rest };
  taetigkeiten.forEach((t, i) => {
    werte[`TART_${i + 1}`] = t.art;
    werte[`TVON_${i + 1}`] = t.von;
    werte[`TBIS_${i + 1}`] = t.bis;
  });
  pruefeSchwerarbeit(werte);
  pruefePflichtSM(satzart, werte);
  return Object.freeze({
    satzart,
    werte: Object.freeze(werte),
    felder: FELDER_E22,
    satzlaenge: SATZLAENGE_E22,
  });
}

/**
 * Schwerarbeitsmeldung (Satzart 65): die Tätigkeiten eines Kalenderjahres für
 * eine versicherte Person. Was meldepflichtig ist, regelt Kapitel E.22.2 —
 * u. a. Schicht- oder Wechseldienst erst ab sechs Nachtdiensten im Monat, die
 * Ziffern 2, 4 und 5 erst ab 15 Arbeitstagen im Monat, nichts bei geringfügiger
 * Beschäftigung. Diese Bedingungen kennt das Paket nicht; es baut, was es
 * bekommt.
 */
export function schwerarbeitsmeldung(felder: SchwerarbeitsFelder): RohSatz {
  return baue('65', felder);
}

/**
 * Storno einer Schwerarbeitsmeldung (Satzart 66). Kapitel E.22 führt für den
 * Storno dieselben Felder mit denselben Stufen wie für die Meldung und
 * beschreibt nicht, wie ELDA den Storno der ursprünglichen Meldung zuordnet.
 */
export function stornoSchwerarbeitsmeldung(felder: SchwerarbeitsFelder): RohSatz {
  return baue('66', felder);
}

/**
 * Klammert Schwerarbeitsmeldungen zu einem übertragbaren Datenbestand mit der
 * Bestandsbezeichnung `SM` (Kapitel B.3 Punkt 18) und der Version 02 aus dem
 * Kapitelkopf von E.22.
 */
export function erstelleSchwerarbeitBestand(meldungen: readonly RohSatz[], opt: BestandOptionen): Buffer {
  for (const [i, m] of meldungen.entries()) {
    if (m.felder !== FELDER_E22) {
      throw new EldaError(
        `Satz ${i + 1} (Satzart ${m.satzart}) ist keine Schwerarbeitsmeldung. Ein Bestand SM trägt ` +
          'nur Sätze aus Kapitel E.22 (Kapitel C.1: Daten zu genau einer Verarbeitung).',
      );
    }
  }
  return baueBestand(meldungen, {
    ...opt,
    bestandsbezeichnung: BEST_SCHWERARBEIT,
    satzstrukturVersion: VERSION_SCHWERARBEIT,
  });
}
