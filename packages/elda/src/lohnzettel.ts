import {
  baueBestand,
  BEST_LOHNZETTEL_FINANZ,
  wanduhrzeit,
  ZEITZONE_STANDARD,
  type BestandOptionen,
  type RohSatz,
} from './bestand';
import { EldaError } from './errors';
import { FELDER_I1, SATZLAENGE_I1 } from './felder-e13';
import {
  BETRAEGE_OHNE_VORZEICHEN,
  FELDER_L1,
  KINDERBLOECKE,
  KINDFELDER,
  kindfeld,
  LOHNZETTELVERSION,
  SATZLAENGE_L1,
  VORZEICHEN_L1,
  type Lohnzettelversion,
} from './felder-e14';
import { PFLICHT_I1, PFLICHT_L1 } from './pflicht-e14';

/**
 * Lohnzettel Finanz (L16) über ELDA: Bestand `LF` mit einem Informationssatz
 * (`I1`, Kapitel E.13) und den Mitteilungssätzen (`L1`, Kapitel E.14), je
 * Lohnzettel ein Satz.
 *
 * ELDA prüft die Sätze „gemäß den Bestimmungen des Bundesministeriums für
 * Finanzen" und leitet sie weiter; Fehler kommen mit den Fehlercodes des
 * Finanzministeriums zurück (E.13.2). Diese Codes kennt `pruefeLohnzettel`.
 *
 * **Welche Version?** Die Lohnzettelversion ist einheitlich für alle
 * Finanzsatzarten eines Bestands (B.3) und steht im Vorlaufsatz. Belegt sind:
 *
 * - **28** (42. Ergänzung): gültig ab 01.01.2026, zwingend ab 01.03.2026,
 *   „fachliche Gültigkeit für Zeiträume ab 01.01.2024".
 * - **29** (43. Ergänzung): gültig ab 01.01.2027, zwingend ab 01.03.2027,
 *   „fachliche Gültigkeit für Zeiträume ab 01.01.2027".
 *
 * Ein Lohnzettel für 2026 ist damit ein Lohnzettel der Version 28 — Version 29
 * ist fachlich erst für Zeiträume ab 2027 gültig. Was gilt, wenn ein
 * Lohnzettel 2026 nach dem 01.03.2027 berichtigt wird (Version 29 dann
 * zwingend, fachlich aber nicht für 2026), sagt keine der beiden Ergänzungen;
 * das Paket lässt Version 28 dafür zu und weist Version 29 für Jahre vor 2027
 * zurück.
 */

/**
 * Zuständiger Versicherungsträger im Identifikationsteil: `94`,
 * Bundesrechenzentrum GmbH. Kapitel D.4 (Seite 68) lässt 94 „nur für
 * Datenmeldungen „Lohnzettel Finanz – Informationssatz", „Lohnzettel Finanz –
 * Mitteilungssatz" …" zu; der ELDA-Fehlerkatalog (H.25, Warnung `W8`) verlangt
 * ihn: „zustaendiger Versicherungstraeger fuer <v1>-Lohnzettel ist falsch.
 * Wert muss 94 ( = BRZ) statt <v2> sein."
 */
export const VSTR_LOHNZETTEL = '94';

/** Angaben zum Arbeitgeber für den Informationssatz (Kapitel E.13). */
export interface LohnzettelArbeitgeber {
  /** Steuernummer des Arbeitgebers, neun Stellen samt Finanzamtsnummer, „Angabe mit führender Null". */
  STNRA: string;
  /** Name des Arbeitgebers. */
  ANAM: string;
  /** Adresse (Straße, Hausnummer). */
  AADR: string;
  /** Landeskennung, Kfz-Kennzeichen — `A` für Österreich. */
  ALKZ: string;
  /** Postleitzahl; bei unbekannter ausländischer Postleitzahl `9999`. */
  APLZ: string;
  /** Ort (Z3 im Informationssatz). */
  AORT?: string;
  /** Titel (Z3). */
  ATIT?: string;
  /** Steuernummer einer Lohnverrechnungsstelle, etwa der Steuerberatung (Z3). */
  STNRL?: string;
  /** DVR-Nummer der Lohnverrechnungsstelle (Z3). */
  DVRNL?: string;
  /** DVR-Nummer des Arbeitgebers (Z3). */
  DVRNA?: string;
  /** Telefonnummer (Z3). */
  ATEL?: string;
  /** Faxnummer (Z3). */
  AFAX?: string;
  /**
   * Gesamtanzahl der Mitteilungen des Jahres, „für den eine elektronische
   * Datenübermittlung vorgesehen ist" (Feld GESA). Darf laut E.13 nicht
   * kleiner sein als die Anzahl dieser Übermittlung.
   */
  GESA: number;
}

/** Feldwerte nach den Feldnamen der Feldtabelle E.14, z. B. `{ REFN: 'DV-0001', ARTL: '01' }`. */
export type LohnzettelFelder = Readonly<Record<string, string | undefined>>;

/** Ein Lohnzettel L16. */
export interface Lohnzettel {
  /**
   * Alle Felder außer Beträgen und Kindern, mit den Namen der Feldtabelle:
   * `REFN`, `ARTL`, `BELZ`, `ENLZ`, `SOZS`, `AVLN`, `AGBD`, `ANAM`, `AADR`,
   * `ALKZ`, `APLZ`, `AORT`, `GESW`/`GESM`/`GESD`, `VOLL`/`TEIL` usw.
   *
   * Nicht hierher gehören die Felder, die der Bau selbst setzt: `FSART`,
   * `DTUE`, `ZTUE` (aus dem Erstellungszeitpunkt), `JALZ` (aus `jahr`) und
   * `STNRA` (aus dem Arbeitgeber — der Katalog verlangt Gleichheit mit dem
   * Informationssatz, `F9900`/`F9990`), außerdem alle Vorzeichenfelder.
   */
  felder: LohnzettelFelder;
  /**
   * Beträge in **Cent**, ganzzahlig, mit Vorzeichen — `-1234` für −12,34 €.
   * Schlüssel ist der Name des Betragsfelds (`B210`, `B245`, `FABO`,
   * `BSBKFZ` …). Das Vorzeichenfeld setzt der Bau: blank bei 0, sonst `+`
   * oder `-`, sofern die Feldtabelle der Version es zulässt.
   */
  betraege?: Readonly<Record<string, number | undefined>>;
  /**
   * Bis zu 15 Kinder, je Kind die Felder des Kinderblocks ohne Nummer
   * (`KFAM`, `KVON`, `KSTAAT`, `KVSNR`, `KGEBD`, `KAFBZ` …).
   */
  kinder?: readonly LohnzettelFelder[];
}

/** Eine Übermittlung: ein Arbeitgeber, ein Jahr, eine Version, beliebig viele Lohnzettel. */
export interface LohnzettelUebermittlung {
  /** Einheitliche Lohnzettelversion — für Lohnzettel 2026 `'28'`. */
  version: Lohnzettelversion;
  /** Jahr des Lohnzahlungszeitraums: Feld JAHR im Informationssatz und JALZ in jedem Lohnzettel. */
  jahr: number;
  arbeitgeber: LohnzettelArbeitgeber;
  lohnzettel: readonly Lohnzettel[];
}

/**
 * Rahmen des Bestands. Der zuständige Versicherungsträger ist beim Lohnzettel
 * immer {@link VSTR_LOHNZETTEL} und wird deshalb nicht angegeben.
 */
export type LohnzettelBestandOptionen = Omit<BestandOptionen, 'versicherungstraeger'>;

/** Felder des Mitteilungssatzes, die der Bau selbst setzt. */
const L1_GESETZT = new Set(['IDTEIL', 'FSART', 'DTUE', 'ZTUE', 'JALZ', 'STNRA']);

/** Felder des Informationssatzes, die der Bau selbst setzt. */
const I1_GESETZT = new Set(['IDTEIL', 'FSART', 'ARTD', 'DTUE', 'ZTUE', 'STVE', 'JAHR', 'ANZA']);

/**
 * Felder mit der Pflichtstufe `Z`, deren Leerstand der Bau zurückweist.
 *
 * Nicht jede `Z`-Angabe der Tabelle E.14.1 lässt sich so durchsetzen:
 *
 * - `FIND` steht auf `Z`, Feld E.14 beschreibt es aber als Möglichkeit: „Durch
 *   Setzen der Fehlerindikation ‘J’ **kann** der Lohnzettel … für richtig
 *   erklärt werden." Ein Pflicht-`J` erklärte jeden Lohnzettel ungeprüft für
 *   richtig.
 * - `PVLN`/`PGBD` (Versicherungsnummer des Partners) stehen auf `Z`; der
 *   Prüfkatalog verlangt sie nur, wenn der Alleinverdienerabsetzbetrag
 *   berücksichtigt wurde (`F3101`).
 * - `V210`/`V245` sind Vorzeichenfelder, die nach der Feldregel bei einem
 *   Betrag von 0 blank sein **müssen**; der Bau setzt sie.
 * - `B210`, `B245`, `SOZS` und `AVLN` sind numerisch; 0 ist dort ein gültiger
 *   Inhalt (Storno mit KZ 210 = 0 laut D.31, soziale Stellung 0 „Sonstige /
 *   unbekannt", Laufnummer 0 ohne Versicherungsnummer laut `F1900`) und von
 *   der Grundstellung nicht zu unterscheiden.
 */
const L1_PFLICHT_DURCHGESETZT = [
  'REFN',
  'ARTL',
  'BELZ',
  'ENLZ',
  'AGBD',
  'ANAM',
  'AADR',
  'ALKZ',
  'APLZ',
] as const;

/** Wie {@link L1_PFLICHT_DURCHGESETZT}, für den Informationssatz. */
const I1_PFLICHT_DURCHGESETZT = ['STNRA', 'ANAM', 'AADR', 'ALKZ', 'APLZ'] as const;

function leer(wert: string | undefined): boolean {
  return wert === undefined || wert.trim() === '';
}

/** Felder mit der Stufe `-` dürfen nicht belegt werden: „keine Angabe, Feld Grundstellung". */
function pruefeKeineAngabe(
  werte: LohnzettelFelder,
  pflicht: Readonly<Record<string, string>>,
  satz: string,
): void {
  for (const [name, wert] of Object.entries(werte)) {
    if (leer(wert)) continue;
    if (pflicht[name] === '-' || name.startsWith('RESE_')) {
      throw new EldaError(
        `${satz}: Feld ${name} ist laut Pflichttabelle „keine Angabe, Feld Grundstellung" und darf ` +
          'nicht belegt werden.',
      );
    }
  }
}

/**
 * Setzt Betrag und Vorzeichen in die Werte. Das Vorzeichen folgt der Regel
 * unter der Feldtabelle E.14: blank bei 0, sonst ein für das Feld zulässiges
 * Vorzeichen.
 */
function setzeBetraege(
  ziel: Record<string, string | undefined>,
  betraege: Readonly<Record<string, number | undefined>>,
  version: Lohnzettelversion,
  satz: string,
): void {
  const vorzeichen = VORZEICHEN_L1[version];
  const ohne = new Set(BETRAEGE_OHNE_VORZEICHEN[version]);
  for (const [name, cent] of Object.entries(betraege)) {
    if (cent === undefined) continue;
    if (!Number.isSafeInteger(cent)) {
      throw new EldaError(
        `${satz}: Betrag ${name} muss ganzzahlig in Cent angegeben werden. Rechnen in Cent vermeidet ` +
          'Rundungsfehler wie 0,2845 × 95000 = 27027,4999…',
      );
    }
    const regel = vorzeichen[name];
    if (regel !== undefined) {
      if (cent < 0 && !regel.erlaubt.includes('-')) {
        throw new EldaError(
          `${satz}: Betrag ${name} ist negativ, das Vorzeichenfeld ${regel.vorzeichen} lässt in ` +
            `Version ${version} aber nur „+" oder blank zu.`,
        );
      }
      ziel[regel.vorzeichen] = cent === 0 ? undefined : cent < 0 ? '-' : '+';
      ziel[name] = String(Math.abs(cent));
    } else if (ohne.has(name)) {
      if (cent < 0) {
        throw new EldaError(`${satz}: Betrag ${name} hat kein Vorzeichenfeld und darf nicht negativ sein.`);
      }
      ziel[name] = String(cent);
    } else {
      throw new EldaError(`${satz}: '${name}' ist in Version ${version} kein Betragsfeld des Lohnzettels.`);
    }
  }
}

function baueL1(
  lz: Lohnzettel,
  index: number,
  u: LohnzettelUebermittlung,
  dtue: string,
  ztue: string,
): RohSatz {
  const satz = `Lohnzettel ${index + 1}`;
  const { version } = u;
  const vorzeichen = VORZEICHEN_L1[version];
  const betragsfelder = new Set([
    ...Object.keys(vorzeichen),
    ...Object.values(vorzeichen).map((r) => r.vorzeichen),
    ...BETRAEGE_OHNE_VORZEICHEN[version],
  ]);

  for (const name of Object.keys(lz.felder)) {
    if (L1_GESETZT.has(name)) {
      if (name === 'JALZ' && lz.felder.JALZ !== undefined && Number(lz.felder.JALZ) !== u.jahr) {
        throw new EldaError(
          `${satz}: JALZ ${lz.felder.JALZ} weicht vom Jahr der Übermittlung (${u.jahr}) ab. Laut D.32 ` +
            'muss es mit dem Feld JAHR des Informationssatzes übereinstimmen (Prüfkatalog F1704).',
        );
      }
      if (name === 'STNRA' && !leer(lz.felder.STNRA) && lz.felder.STNRA !== u.arbeitgeber.STNRA) {
        throw new EldaError(
          `${satz}: STNRA weicht von der Steuernummer des Informationssatzes ab (Prüfkatalog F9900/F9990).`,
        );
      }
      if (name !== 'JALZ' && name !== 'STNRA') {
        throw new EldaError(`${satz}: Feld ${name} setzt der Bau selbst und darf nicht angegeben werden.`);
      }
    }
    if (betragsfelder.has(name)) {
      throw new EldaError(
        `${satz}: ${name} ist ein Betrags- oder Vorzeichenfeld und gehört in \`betraege\`.`,
      );
    }
    if (/_K\d+$/.test(name)) {
      throw new EldaError(`${satz}: Felder des Kinderblocks gehören in \`kinder\`, nicht in \`felder\`.`);
    }
  }
  pruefeKeineAngabe(lz.felder, PFLICHT_L1[version], satz);
  for (const name of L1_PFLICHT_DURCHGESETZT) {
    if (leer(lz.felder[name])) {
      throw new EldaError(`${satz}: Feld ${name} ist laut Kapitel E.14.1 zwingend anzugeben.`);
    }
  }

  const werte: Record<string, string | undefined> = {
    ...lz.felder,
    FSART: 'L',
    DTUE: dtue,
    ZTUE: ztue,
    JALZ: String(u.jahr),
    STNRA: u.arbeitgeber.STNRA,
  };
  setzeBetraege(werte, lz.betraege ?? {}, version, satz);

  const kinder = lz.kinder ?? [];
  if (kinder.length > KINDERBLOECKE) {
    throw new EldaError(`${satz}: ${kinder.length} Kinder, der Satz hat Platz für ${KINDERBLOECKE}.`);
  }
  const erlaubt = new Set(KINDFELDER[version]);
  kinder.forEach((kind, i) => {
    for (const [name, wert] of Object.entries(kind)) {
      if (!erlaubt.has(name)) {
        throw new EldaError(
          `${satz}, Kind ${i + 1}: '${name}' ist in Version ${version} kein Feld des Kinderblocks.`,
        );
      }
      werte[kindfeld(name, i + 1)] = wert;
    }
  });

  return { satzart: 'L1', werte, felder: FELDER_L1[version], satzlaenge: SATZLAENGE_L1 };
}

function baueI1(u: LohnzettelUebermittlung, dtue: string, ztue: string): RohSatz {
  const ag = u.arbeitgeber;
  const satz = 'Informationssatz';
  const { GESA, ...felder } = ag;
  for (const name of Object.keys(felder)) {
    if (I1_GESETZT.has(name)) {
      throw new EldaError(`${satz}: Feld ${name} setzt der Bau selbst und darf nicht angegeben werden.`);
    }
  }
  pruefeKeineAngabe(felder, PFLICHT_I1, satz);
  for (const name of I1_PFLICHT_DURCHGESETZT) {
    if (leer(felder[name])) {
      throw new EldaError(`${satz}: Feld ${name} ist laut Kapitel E.13.1 zwingend anzugeben.`);
    }
  }
  if (!Number.isSafeInteger(GESA) || GESA < u.lohnzettel.length) {
    throw new EldaError(
      `${satz}: GESA (${GESA}) muss eine ganze Zahl sein und darf laut Kapitel E.13 „nicht kleiner als ` +
        `die Anzahl der Mitteilungen der aktuellen Übermittlung" (${u.lohnzettel.length}) sein.`,
    );
  }
  return {
    satzart: 'I1',
    werte: {
      ...felder,
      FSART: 'I',
      ARTD: 'LZ',
      DTUE: dtue,
      ZTUE: ztue,
      // E.13 Feld 14: „„03" ab Übermittlung 2002".
      STVE: '03',
      JAHR: String(u.jahr),
      GESA: String(GESA),
      ANZA: String(u.lohnzettel.length),
    },
    felder: FELDER_I1,
    satzlaenge: SATZLAENGE_I1,
  };
}

/**
 * Baut Informationssatz und Lohnzettel als Satzfolge, noch ohne Vorlauf- und
 * Schlusssatz — für `pruefeLohnzettel` oder zum Ansehen.
 *
 * @param erstellt Zeitpunkt der Übermittlung. Daraus werden DTUE und ZTUE in
 *   Wiener Ortszeit — E.13: „Datum und Uhrzeit in den Mitteilungssätzen …
 *   müssen gleich dem Datum und der Uhrzeit im zugehörigen Informationssatz
 *   sein." Beim Bestand ist es derselbe Zeitpunkt wie im Vorlaufsatz.
 */
export function lohnzettelSaetze(
  u: LohnzettelUebermittlung,
  erstellt: Date,
  zeitzone: string = ZEITZONE_STANDARD,
): RohSatz[] {
  const info = LOHNZETTELVERSION[u.version];
  if (info === undefined) {
    throw new EldaError(`Lohnzettelversion '${String(u.version)}' ist nicht belegt; bekannt sind 28 und 29.`);
  }
  if (!Number.isSafeInteger(u.jahr) || u.jahr < info.fachlichAbJahr) {
    throw new EldaError(
      `Version ${u.version} gilt laut Kapitel E.14 fachlich für Zeiträume ab 01.01.${info.fachlichAbJahr}; ` +
        `das Jahr ${u.jahr} liegt davor.`,
    );
  }
  if (u.lohnzettel.length === 0) {
    throw new EldaError('Eine Übermittlung ohne Lohnzettel wird nicht erzeugt.');
  }
  if (Number.isNaN(erstellt.getTime())) {
    throw new EldaError('Erstellungszeitpunkt ist kein gültiges Datum.');
  }
  const t = wanduhrzeit(erstellt, zeitzone);
  const dtue = `${t.jahr}${t.monat}${t.tag}`;
  const ztue = `${t.stunde}${t.minute}${t.sekunde}`;
  return [baueI1(u, dtue, ztue), ...u.lohnzettel.map((lz, i) => baueL1(lz, i, u, dtue, ztue))];
}

/**
 * Baut den Bestand `LF` für ELDA: Vorlaufsatz mit der Lohnzettelversion,
 * Informationssatz, Lohnzettel, Schlusssatz. Vorlauf- und Schlusssatz tragen
 * die größte Satzlänge (3500), der Informationssatz bleibt bei 1100
 * (Kapitel E.2).
 *
 * **Testen** lässt sich das nur im Kundentest: Die SIT-Plattform verarbeitet
 * den Bestand `LF` nicht (ÖGK „LSWH-Test – Regelbetrieb", 10/2023).
 */
export function erstelleLohnzettelBestand(
  u: LohnzettelUebermittlung,
  opt: LohnzettelBestandOptionen,
): Buffer {
  const saetze = lohnzettelSaetze(u, opt.erstellt, opt.zeitzone);
  return baueBestand(saetze, {
    ...opt,
    versicherungstraeger: VSTR_LOHNZETTEL,
    bestandsbezeichnung: BEST_LOHNZETTEL_FINANZ,
    satzstrukturVersion: u.version,
  });
}
