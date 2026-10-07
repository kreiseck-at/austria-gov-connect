import { EldaError } from './errors';
import { FELDER_E12, SATZLAENGE_E12 } from './felder-e12';
import { pruefePflichtFH, type SatzartFH } from './pflicht-e12';
import { pruefeFamilienhospiz } from './pruefung-e12';
import {
  BEST_FAMILIENHOSPIZ,
  VERSION_FAMILIENHOSPIZ,
  baueBestand,
  type BestandOptionen,
  type RohSatz,
} from './bestand';

/**
 * Die fachlichen Felder einer Meldung Familienhospizkarenz/Pflegekarenz,
 * benannt wie in Kapitel E.12. Alle Werte sind Zeichenketten in der Form des
 * Dokuments — Datumsfelder als `TTMMJJJJ`, Beträge in Cent. Der
 * Identifikationsteil entsteht beim Bau des Bestands.
 *
 * Eine Referenz auf die ursprüngliche Meldung (wie `REFU` bei der
 * Versichertenmeldung) kennt diese Satzart nicht: Storno und Richtigstellung
 * nennen laut Kapitel D.13 das ADAT der Meldung, auf die sie sich beziehen.
 */
export interface FamilienhospizFelder {
  /** Beitragskontonummer beim zuständigen Versicherungsträger. */
  BKNR?: string;
  /** Dienstgebername. */
  DGNA?: string;
  /** Telefonnummer des Dienstgebers. */
  DTEL?: string;
  /** Weiterer Ordnungsbegriff des Dienstgebers, z. B. die Personalnummer. */
  WOBD?: string;
  /** Zusätzlicher Ordnungsbegriff, wenn WOBD nicht ausreicht. */
  ZOBD?: string;
  /** Versicherungsnummer LLLPTTMMJJ. */
  VSNR?: string;
  /** Geburtsdatum TTMMJJJJ; auch 00MMJJJJ oder 0000JJJJ zulässig. */
  GEBD?: string;
  /** Erster Familienname. */
  FANA?: string;
  /** Früherer Familienname 1 — nur bei der Anmeldung. */
  FNA1?: string;
  /** Früherer Familienname 2 — nur bei der Anmeldung. */
  FNA2?: string;
  /** Erster Vorname. */
  VONA?: string;
  /** Akademischer Grad vor dem Familiennamen. */
  AKGR?: string;
  /** Geschlecht: 1 männlich, 2 weiblich, 3 divers, 4 offen, 6 inter, 7 keine Angabe — nur bei der Anmeldung. */
  GESL?: string;
  /** Staatsangehörigkeit als ISO-A3-Code, z. B. `AUT` — nur bei der Anmeldung. */
  STSL?: string;
  /** Wohnort, internationales Kfz-Kennzeichen, z. B. `A`. */
  WKFZ?: string;
  /** Wohnort, Postleitzahl. */
  PLZL?: string;
  /** Wohnort, Ort. */
  WORT?: string;
  /** Wohnort, Straße. */
  STRA?: string;
  /** Zweiter Familienname. */
  FAN2?: string;
  /** Zweiter Vorname. */
  VON2?: string;
  /** Akademischer Grad nach dem Familiennamen. */
  AKG2?: string;
  /** An-/Abmeldedatum bzw. Änderungsdatum TTMMJJJJ (Kapitel D.13). */
  ADAT?: string;
  /** Richtiges An-/Abmeldedatum TTMMJJJJ — nur bei Richtigstellungen (Kapitel D.14). */
  RDAT?: string;
  /** Karenzart, siehe `KARENZART`. */
  KART?: string;
  /** Monatliches Bruttoentgelt vor Antritt der Karenz, in Cent — nur bei Karenzart 01 und 02. */
  EVFH?: string;
  /** Monatliches Bruttoentgelt während der Karenz, in Cent — nur bei Karenzart 01 und 02. */
  EWFH?: string;
  /** Referenznummer; ELDA meldet sie in der Rückantwort zurück. */
  REFN?: string;
}

/**
 * Baut einen geprüften Rohsatz: erst der Prüfkatalog (mit dessen Fehlercodes),
 * dann die Pflichtmatrix aus E.12.1 für alles, was der Katalog nicht abdeckt —
 * vor allem Felder, die in Grundstellung bleiben müssen. Das Ergebnis ist wie
 * bei der Versichertenmeldung eingefroren.
 */
function baue(satzart: SatzartFH, felder: FamilienhospizFelder): RohSatz {
  const werte: Record<string, string | undefined> = { ...felder };
  pruefeFamilienhospiz(satzart, werte);
  pruefePflichtFH(satzart, werte);
  return Object.freeze({
    satzart,
    werte: Object.freeze(werte),
    felder: FELDER_E12,
    satzlaenge: SATZLAENGE_E12,
  });
}

/** Anmeldung zur Familienhospizkarenz/Pflegekarenz (Satzart 80). */
export function familienhospizAnmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('80', felder);
}

/** Abmeldung, bei Wiederantritt der Beschäftigung bzw. Ende der Karenzierung (Satzart 81). */
export function familienhospizAbmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('81', felder);
}

/** Änderungsmeldung — berichtigt die Karenzart, bei 01/02 auch die Entgelte (Satzart 82). */
export function familienhospizAenderungsmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('82', felder);
}

/** Storno einer Anmeldung (Satzart 83); ADAT ist das der zu stornierenden Meldung. */
export function familienhospizStornoAnmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('83', felder);
}

/** Storno einer Abmeldung (Satzart 84); ADAT ist das der zu stornierenden Meldung. */
export function familienhospizStornoAbmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('84', felder);
}

/** Richtigstellung einer Anmeldung (Satzart 85): ADAT alt, RDAT richtig. */
export function familienhospizRichtigstellungAnmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('85', felder);
}

/** Richtigstellung einer Abmeldung (Satzart 86): ADAT alt, RDAT richtig. */
export function familienhospizRichtigstellungAbmeldung(felder: FamilienhospizFelder): RohSatz {
  return baue('86', felder);
}

/**
 * Klammert Familienhospiz-Meldungen zu einem übertragbaren Datenbestand mit
 * der Bestandsbezeichnung `FH` (Kapitel B.3 Punkt 10) und der Version 03 aus
 * dem Kapitelkopf von E.12. Die Sätze müssen aus den Funktionen dieses Moduls
 * stammen; ein Bestand trägt laut Kapitel C.1 Daten zu genau einer
 * Verarbeitung.
 */
export function erstelleFamilienhospizBestand(meldungen: readonly RohSatz[], opt: BestandOptionen): Buffer {
  for (const [i, m] of meldungen.entries()) {
    if (m.felder !== FELDER_E12) {
      throw new EldaError(
        `Satz ${i + 1} (Satzart ${m.satzart}) ist keine Familienhospiz-Meldung. Ein Bestand FH trägt ` +
          'nur Sätze aus Kapitel E.12 (Kapitel C.1: Daten zu genau einer Verarbeitung).',
      );
    }
  }
  return baueBestand(meldungen, {
    ...opt,
    bestandsbezeichnung: BEST_FAMILIENHOSPIZ,
    satzstrukturVersion: VERSION_FAMILIENHOSPIZ,
  });
}
