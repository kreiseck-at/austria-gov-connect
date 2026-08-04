import { EldaError } from './errors';
import { FELDER_E29, SATZLAENGE_E29 } from './felder-e29';
import { pruefePflicht, type Satzart } from './pflicht-e29';
import { pruefeInhalt } from './pruefung-e29';
import { BEST_VERSICHERTENMELDUNG, baueBestand, type BestandOptionen, type RohSatz } from './bestand';

/**
 * Die fachlichen Felder einer Versichertenmeldung, benannt wie in Kapitel E.29.
 * Alle Werte sind Zeichenketten in der Form, die das Dokument vorgibt — Datumsfelder
 * als `TTMMJJJJ`, Kennzeichen als `J`/`N`. Der Identifikationsteil gehört nicht
 * dazu; er entsteht beim Bau des Bestands.
 */
export interface MeldungsFelder {
  /** Referenzwert: eindeutige Identifikation dieser Meldung. Zwingend bei allen Satzarten. */
  REFW?: string;
  /** Referenzwert der Meldung, die storniert oder richtiggestellt werden soll. */
  REFU?: string;
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
  /** Versicherungsnummer in der Form LLLPTTMMJJ. */
  VSNR?: string;
  /** Geburtsdatum TTMMJJJJ; auch 00MMJJJJ oder 0000JJJJ zulässig. */
  GEBD?: string;
  /** Referenzwert der VSNR-Anforderung. */
  REFV?: string;
  /** Familienname. */
  FANA?: string;
  /** Vorname. */
  VONA?: string;
  /** An-/Abmelde- bzw. Änderungsdatum TTMMJJJJ. */
  ADAT?: string;
  /** Änderungsdatum BIS TTMMJJJJ. */
  BDAT?: string;
  /** Richtiges An-/Abmeldedatum TTMMJJJJ. */
  RDAT?: string;
  /** Beschäftigungsbereich, 01 bis 13. */
  BBER?: string;
  /** Geringfügigkeit, `J` oder `N`. */
  GERF?: string;
  /** Freier Dienstvertrag, `J` oder `N`. */
  FRDV?: string;
  /** Ende des Beschäftigungsverhältnisses TTMMJJJJ. */
  EBSV?: string;
  /** Abmeldegrund, Code. */
  AGRD?: string;
  /** Abmeldegrund, Text. */
  SAGR?: string;
  /** Kündigungsentschädigung ab TTMMJJJJ. */
  KEAB?: string;
  /** Kündigungsentschädigung bis TTMMJJJJ. */
  KEBI?: string;
  /** Urlaubsersatzleistung ab TTMMJJJJ. */
  UEAB?: string;
  /** Urlaubsersatzleistung bis TTMMJJJJ. */
  UEBI?: string;
  /** Betriebliche Vorsorge ab TTMMJJJJ. */
  BVAB?: string;
  /** Betriebliche Vorsorge Ende TTMMJJJJ. */
  BVEN?: string;
  /** Betriebliche Vorsorge, Kennzeichen. */
  BVJN?: string;
  /** Ummeldedatum TTMMJJJJ. */
  UMDA?: string;
  /** Richtiges Ummeldedatum TTMMJJJJ. */
  RUMD?: string;
  /** Sonderfall Ummeldung, `J` oder leer. */
  SOUM?: string;
  /** Zielversicherungsträger der Ummeldung, 11 bis 19. */
  ZTUM?: string;
  /** Beitragskontonummer der Ummeldung. */
  ZKUM?: string;
  /** Referenzwert der Ummeldung. */
  RWUM?: string;
  /** Referenzwert der ursprünglichen Meldung am Zielbeitragskonto. */
  RUUM?: string;
  /** Referenzwert Ummeldung bei Sonderfall Zielbeitragskontoänderung. */
  BKUM?: string;
  /** Ausmaß der vereinbarten wöchentlichen Arbeitszeit, vierstellig — siehe {@link wochenarbeitszeit}. */
  VWAZ?: string;
}

/**
 * Baut einen geprüften Rohsatz. Das Ergebnis ist eingefroren — mitsamt seiner Werte.
 *
 * `RohSatz.werte` ist im Typ zwar als `Readonly<...>` deklariert, das gilt aber nur beim
 * Übersetzen. Ein `satz.werte.AGRD = '99'` aus JavaScript heraus (oder nach einem `as`-Bruch)
 * ging bisher durch und veränderte den Satz NACH beiden Prüfungen: Pflichtmatrix und
 * Prüfkatalog hatten den Wert nie gesehen, `erstelleBestand` schreibt ihn trotzdem. Das
 * Einfrieren macht die Zusage des Typs zur Laufzeitzusage — ein solcher Schreibzugriff wirft
 * im Strict-Modus und bleibt sonst wirkungslos.
 *
 * `baueBestand` arbeitet weiterhin, weil es die Werte nicht verändert, sondern für den
 * Identifikationsteil eine Kopie bildet (`{ ...s.werte, IDTEIL }`).
 */
function baue(satzart: Satzart, felder: MeldungsFelder): RohSatz {
  const werte: Record<string, string | undefined> = { ...felder };
  pruefePflicht(satzart, werte);
  pruefeInhalt(satzart, werte);
  return Object.freeze({
    satzart,
    werte: Object.freeze(werte),
    felder: FELDER_E29,
    satzlaenge: SATZLAENGE_E29,
  });
}

/** Anmeldung (Satzart M3). Vor Arbeitsantritt zu übermitteln. */
export function anmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M3', felder);
}

/** Abmeldung (Satzart M4). */
export function abmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M4', felder);
}

/** Änderungsmeldung (Satzart M6). */
export function aenderungsmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M6', felder);
}

/** Richtigstellung einer Anmeldung (Satzart M8). */
export function richtigstellungAnmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M8', felder);
}

/** Richtigstellung einer Abmeldung (Satzart M9). */
export function richtigstellungAbmeldung(felder: MeldungsFelder): RohSatz {
  return baue('M9', felder);
}

/** Storno einer Anmeldung (Satzart S3). */
export function stornoAnmeldung(felder: MeldungsFelder): RohSatz {
  return baue('S3', felder);
}

/** Storno einer Abmeldung (Satzart S4). */
export function stornoAbmeldung(felder: MeldungsFelder): RohSatz {
  return baue('S4', felder);
}

/**
 * Rechnet Stunden und Minuten in das Format des Feldes `VWAZ` um: Stunden mit
 * kaufmännischer Rundung auf zwei Nachkommastellen, als vier Ziffern ohne
 * Dezimaltrenner. Das Dokument nennt als Beispiel 15 Stunden und 40 Minuten,
 * die als `1567` zu übermitteln sind.
 *
 * `stunden` und `minuten` müssen ganze Zahlen sein — nur dann ist die
 * kaufmännische Rundung frei von Fließkomma-Grenzfällen: Bei ganzzahligen
 * Minuten (0–59) liegt der Bruchteil von Stunden·100 immer bei 0, 1/3 oder
 * 2/3, nie exakt bei 1/2, ein Gleichstand beim Runden kann also rechnerisch
 * nicht auftreten. Bei gebrochenen Stundenangaben (z. B. `1.005`) gilt das
 * nicht mehr — dort landet die Rechnung in der Gleitkomma-Darstellung
 * mitunter hauchdünn unter statt auf der `.5`-Grenze und rundet falsch. Wer
 * Dezimalstunden hat, rechnet sie selbst in Stunden und Minuten um.
 */
export function wochenarbeitszeit(stunden: number, minuten = 0): string {
  if (
    !Number.isInteger(stunden) ||
    !Number.isInteger(minuten) ||
    stunden < 0 ||
    minuten < 0 ||
    minuten > 59
  ) {
    throw new EldaError(
      `Ungültige Arbeitszeit: ${stunden} Stunden, ${minuten} Minuten. Stunden und Minuten müssen ` +
        'ganze Zahlen sein, Stunden ab 0, Minuten 0 bis 59.',
    );
  }
  const hundertstel = Math.round((stunden + minuten / 60) * 100);
  if (hundertstel > 9999) {
    throw new EldaError(`Die wöchentliche Arbeitszeit ${stunden}:${minuten} passt nicht in vier Ziffern.`);
  }
  return String(hundertstel).padStart(4, '0');
}

/**
 * Klammert Versichertenmeldungen zu einem übertragbaren Datenbestand. Das
 * Ergebnis geht unverändert als `inhalt` an `senden`.
 *
 * Die Bestandsbezeichnung `VR` setzt diese Funktion selbst — ein Bestand trägt
 * laut Kapitel C.1 Daten zu genau einer Verarbeitung, und welche das ist, folgt
 * aus den Sätzen darin. Für die monatliche Beitragsgrundlagenmeldung gibt es
 * deshalb `erstelleMbgmBestand` (Bestandsbezeichnung `MB`); die beiden Arten
 * lassen sich nicht im selben Bestand mischen.
 */
export function erstelleBestand(meldungen: readonly RohSatz[], opt: BestandOptionen): Buffer {
  return baueBestand(meldungen, { ...opt, bestandsbezeichnung: BEST_VERSICHERTENMELDUNG });
}
