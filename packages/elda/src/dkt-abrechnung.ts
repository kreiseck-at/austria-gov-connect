import { EldaError } from './errors';
import { baueSatz, baueSatzText } from './festsatz';
import { SATZTRENNER, ZEITZONE_STANDARD, wanduhrzeit } from './bestand';
import { vpnrPruefzifferGueltig, vsnrPruefzifferGueltig } from './pruefziffer';
import {
  DKT_ADRESSE,
  DKT_ANGEHOERIGER,
  DKT_BEGINN,
  DKT_BEZUG,
  DKT_BLOCKLAENGE_EKVK,
  DKT_BLOCKLAENGE_LEISTUNG,
  DKT_BLOCK_BEGRUENDUNG,
  DKT_BLOCK_DIAGNOSE,
  DKT_BLOCK_LEISTUNG,
  DKT_DATEIENDE,
  DKT_EKVK,
  DKT_EKVK_PATIENT,
  DKT_EKVK_WEITERE,
  DKT_KOPF,
  DKT_KOPFLAENGE,
  DKT_LEISTUNG,
  DKT_SATZLAENGE,
  DKT_SCHLUSS,
  DKT_SUMME,
  DKT_TEXT,
  DKT_TRANSPORT,
  DKT_VERSICHERTER,
  DKT_VORLAUF,
  type DktFeld,
} from './dkt-felder';
import {
  AUVA_CODE,
  BEF,
  BEST_DKT,
  BUNDESLAND,
  EFORM,
  EGESL,
  FACHGEBIET_DKT,
  FART,
  GRU,
  KAT,
  KBS,
  NACA,
  NUR_LEISTUNGSZUSTAENDIG,
  OEGK_CODES,
  PROJ_DKT,
  SAMMELNUMMERN,
  TART,
  UFACHL,
  UIDV,
  VERSICHERUNGSTRAEGER,
  VERSION_DKT,
  type Bundesland,
} from './dkt-codes';

/**
 * Datenbestand der Vertragspartner-Abrechnung von Krankentransporten (DKT 2.2,
 * Abfolge E.2.1, Seite 49) — ohne Versand. Ein Bestand ist laut B.3 und C.1
 * (Seiten 11 und 13) genau eine Rechnung eines Vertragspartners für einen
 * Abrechnungszeitraum an einen verrechnungszuständigen Träger; die Eingabe ist
 * so geschnitten, dass sich das nicht anders ausdrücken lässt.
 *
 * Nicht enthalten, weil in den Quellen nicht ausreichend bestimmt (offene
 * Punkte, siehe README): negative Korrekturen durch den Vertragspartner
 * (VORZ 1, D.65), Sammelabrechnungen mehrerer Leistungserbringer (E.2.1:
 * „bedarf einer Vereinbarung"), Skonto (PSKO/SKO, D.40/D.47) und Wochen-,
 * Quartals- oder Jahreszeiträume (die ÖGK nimmt nur Monate an, siehe
 * {@link DktAbrechnung.abrechnungsmonat}).
 */

/** Datum im Format `JJJJ-MM-TT`. */
export type IsoDatum = string;
/** Uhrzeit im Format `HH:MM`. */
export type Uhrzeit = string;

/** Übermittelnde Stelle — Vorlaufsatz und VPNRU. */
export interface DktUebermittler {
  /**
   * HRST, „Firmenbezeichnung der übermittelnden Stelle" (D.28, 45 Stellen).
   * Das ist der Betrieb, der übermittelt — nicht der Softwarehersteller.
   */
  name: string;
  /** HKFZ, Staat nach ISO 3166 A3, z. B. `AUT` (D.48). */
  staat: string;
  /** HPLZ, Postleitzahl (D.38, 7 Stellen). */
  plz: string;
  /**
   * Vertragspartnernummer der Übermittlungsstelle VPNRU (D.63). Steht zugleich
   * in OBUS: „Ordnungsbegriff der übermittelnden Stelle bzw.
   * Vertragspartnernummer des Senders" (D.33; F.2 Inhalt: „Vertragspartnernummer
   * des Senders"). Sendet der Vertragspartner selbst, ist es seine eigene
   * Nummer — so auch das Muster E.3.
   */
  vpnr: string;
}

/** Rechnungslegender Vertragspartner, zugleich einziger Leistungserbringer. */
export interface DktVertragspartner {
  /** VPNR im Satzkopf und VPNRL in SART 00 (D.63). */
  vpnr: string;
  /**
   * Adresscode VPADR/VPADRL (D.5): vom Dachverband vergeben, „über das
   * e-card-System oder über die LEA-Suche" zu ermitteln. Im Satzkopf zweistellig.
   */
  adresscode: number;
  /** BLLE, Bundesland des Leistungserbringers (D.15). */
  bundesland: Bundesland;
  /** UFACHL, Unterteilung des Fachgebiets (D.55), z. B. `'57'` Fahrtendienst ohne Rollstuhl (Taxi). */
  fachgebietUnterteilung?: keyof typeof UFACHL;
  /** UID (D.56). Zwingend bei nicht steuerbefreiten Vertragspartnern. */
  uid?: string;
  /** ZVR, Zentrale Vereinsregisterzahl (D.68), für Vereine zwingend. */
  zvr?: string;
}

/** Herkunft oder Ziel eines Transports: Postleitzahl mit Staat oder Vertragspartnernummer (D.38). */
export type DktOrtsangabe = { staat: string; plz: string } | { vpnr: string };

/** Ein Transport — SART 20 (F.9). */
export interface DktTransport {
  /** LDAT, Transportdatum. */
  datum: IsoDatum;
  /** EBEG, Einsatzbeginn. */
  beginn: Uhrzeit;
  /** ANK, Ankunft Zielort; ohne Angabe Grundstellung 9999 (D.66). */
  ankunft?: Uhrzeit;
  /** WZV, Wartezeit von; ohne Angabe Grundstellung 9999 (D.66). */
  warteVon?: Uhrzeit;
  /** WZB, Wartezeit bis; ohne Angabe Grundstellung 9999 (D.66). */
  warteBis?: Uhrzeit;
  /** END, Einsatzende; `'ueber24h'` ergibt „9999 wenn über 24 Stunden Dauer" (D.66). */
  ende: Uhrzeit | 'ueber24h';
  /** TNR, Transportnummer (D.53). „Bei Taxi ist die Grundstellung blank erlaubt." */
  nummer?: string;
  /** KFZ, Kennzeichen, Fahrzeug- oder Funknummer (D.30). */
  kennzeichen?: string;
  /** ORTV, Transport von Ort oder Straße (D.34, 16 Stellen). */
  vonOrt?: string;
  /** PLZV (D.38). */
  von: DktOrtsangabe;
  /** ORTN, Transport nach Ort oder Straße (D.34, 16 Stellen). */
  nachOrt?: string;
  /** PLZN (D.38). */
  nach: DktOrtsangabe;
  /** GRU, Transportgrund (D.27). */
  grund: keyof typeof GRU;
  /** TART, Transportart (D.52). */
  art: keyof typeof TART;
  /** FART, Fahrzeugart (D.26). */
  fahrzeug: keyof typeof FART;
  /** ZKR, zeitkritisch (D.69). „Ein Taxitransport ist in der Regel nicht zeitkritisch." */
  zeitkritisch: boolean;
  /** BEF, Art der Beförderung (D.10). */
  befoerderung: keyof typeof BEF;
  /** NACA-Code (D.32). */
  naca?: keyof typeof NACA;
}

/** Kostenbeteiligung einer Leistung (KBS, SUMKB; D.29, D.31). */
export interface DktKostenbeteiligung {
  /** KBS, Kostenbeteiligungssatz (D.29). */
  satz: keyof typeof KBS;
  /** Nettoanteil in Cent; geht in KOBE des Summensatzes ein (D.31). */
  nettoCent: number;
  /** Umsatzsteueranteil in Cent; geht in KOBEUST ein (D.31). */
  ustCent: number;
}

/** Eine Leistung — Datenblock „L" (F.10.1). */
export interface DktLeistung {
  /** POSNR, Positions- bzw. Tarifnummer, 3 Stellen (D.37) — aus dem Tarif des Trägers. */
  position: string;
  /** TAR, Netto-Tarif je Kilometer/Pauschale/Flugminute in Cent (D.51). */
  tarifCent: number;
  /** ANZKM, Anzahl der Kilometer/Pauschalien/Flugminuten (D.9). */
  anzahl: number;
  /** UST, Umsatzsteuersatz in Prozent (D.57). Wird nur geprüft, nicht abgeleitet. */
  ustProzent: number;
  /** BEWNR, Bewilligungsnummer (D.12). */
  bewilligungsnummer?: string;
  kostenbeteiligung?: DktKostenbeteiligung;
  /**
   * Begründungen zu dieser Leistung, je ein Block „B" mit GRUN (42 Stellen).
   * F.10: „Erfordert eine Position eine medizinische Begründung, so muss der
   * (oder auch mehrere) Begründungsblock unmittelbar hinter dem Leistungsblock
   * folgen."
   */
  begruendungen?: readonly string[];
}

/** Diagnose — Datenblock „D" (F.10.2, D.17, D.18). */
export type DktDiagnose =
  | { icd10: readonly { code: string; untergliederung1?: string; untergliederung2?: string }[] }
  | { text: string };

/** Ein Fall der Ebene 2: ein Versicherter mit genau einem Transport (E.2.1). */
export interface DktFall {
  versicherter: {
    /** VSTRL, leistungszuständiger Träger (D.62). */
    traeger: string;
    /** BLNDL (D.15). Bei der AUVA zwingend. */
    bundesland?: Bundesland;
    familienname: string;
    vorname: string;
    /** VSNRV (D.61): mit gültiger Prüfziffer oder `0000TTMMJJ` ohne inländische Nummer. */
    vsnr: string;
    /** KAT, Versichertenkategorie bei zwischenstaatlichen Fällen (D.48). */
    kategorie?: string;
  };
  /** BSNR, Durchnummerierung je Leistungsfall, beginnt mit 1, wie auf dem Papierbeleg (D.14). */
  belegnummer: number;
  /** Ver(an)ordnender Arzt bzw. Stelle. */
  verordner: {
    /** VPNUW (D.63), auch eine Sammelnummer. */
    vpnr: string;
    /** ZUNUW (D.67, 10 Stellen). */
    familienname?: string;
    /** FACHU (D.25): „zu belegen, wenn VPNUW keine Sammelnummer ist". */
    fachgebiet?: string;
  };
  /** UEDAT, Datum des Antrages für Transport (D.16). */
  antragsdatum: IsoDatum;
  /**
   * SART 11 Bezugsdaten (F.8) — „bei Korrekturen zur Herstellung des Bezuges zur
   * seinerzeitigen Abrechnung". BSNR: „Bei der SART 11 ist die seinerzeitige
   * Transportauftragsnummer anzugeben" (D.14).
   */
  bezug?: {
    abrechnungsjahr: number;
    abrechnungsmonat: number;
    /** RNR der seinerzeitigen Abrechnung („aus SART23"). */
    rechnungsnummer: string;
    belegnummer: number;
  };
  /** SART 39 auf Transportebene (E.2 „Die Satzart 39 ist auf Transportebene oder auf Rechnungsebene möglich"). */
  texte?: readonly string[];
  /** SART 02. */
  angehoeriger?: { vsnr: string; familienname: string; vorname: string };
  /** SART 06 (E.2: bei unvollständiger VSNR, „Betreuten" oder UV-Abrechnung mit Aktenzeichen). */
  adresse?: { staat: string; plz: string; strasse: string; ort: string; uvAktenzeichen?: string };
  /** SART 07 Europäische Krankenversicherungskarte (F.7). */
  ekvk?: {
    patient: {
      staat: string;
      versicherungsnummer: string;
      familienname: string;
      vorname: string;
      geburtsdatum: IsoDatum;
    };
    weitere?: {
      geschlecht?: keyof typeof EGESL;
      institutionscode?: string;
      akronym?: string;
      kartennummer?: string;
      anspruchsende?: IsoDatum;
      form?: keyof typeof EFORM;
    };
  };
  transport: DktTransport;
  /** RNR in SART 21: „die vom Vertragspartner gemeldete Rechnungsnummer des Transportes" (D.43). */
  rechnungsnummer: string;
  /** Mindestens eine Leistung, chronologisch (F.10). */
  leistungen: readonly DktLeistung[];
  diagnose: DktDiagnose;
  /**
   * Mehrfachtransport: die Versicherungsnummern ALLER transportierten Patienten.
   * Quelle: ÖGK an den Fachverband, 16.12.2024, Seite 2 („bei
   * Mehrfachtransporten: Kürzel „MF" sowie Angabe der Versicherungsnummer") und
   * WKO-Fachverband „Klarstellung Mehrfachtransporte (ab 1.6.2025)": „im
   * Begründungsfeld „GRUN" im Datenblock Begründung „B" oder im Textsatz der
   * Satzart 39 … immer folgender Kommentar zu setzen: „MF" sowie die Angabe der
   * Versicherungsnummern aller transportierten Patienten."
   *
   * Wie der Text aufgebaut ist (Trennzeichen, Reihenfolge), steht nirgends. Der
   * Aufrufer schreibt ihn deshalb selbst in `texte` oder `begruendungen`; hier
   * wird nur geprüft, dass „MF" und jede Nummer darin vorkommen.
   */
  mehrfachtransport?: { vsnr: readonly string[] };
}

/** Eingabe für {@link erstelleDktAbrechnung}. */
export interface DktAbrechnung {
  /** VSTR, verrechnungszuständiger Träger (D.62). Ein Bestand je Träger (C.1). */
  traeger: string;
  /** VSTRA, zuständige Abrechnungsstelle (D.62). */
  abrechnungsstelle: string;
  /** BLNDA, Bundesland der zuständigen Abrechnungsstelle (D.15, zwingend). */
  bundeslandAbrechnungsstelle: Bundesland;
  /**
   * VSTRU, „Datenübernehmender Versicherungsträger – ELDA" (D.62). Das Muster
   * E.3 trägt `14` (ÖGK-O; ELDA ist das Datensammelsystem der ÖGK Oberösterreich,
   * C.3). Ausdrücklich steht der Wert nirgends — deshalb Eingabe.
   */
  datenuebernehmer: string;
  /** DTNR, „Lfd. Nr. des Datenträgers pro übermittelnder Stelle und übernehmendem Versicherungsträger" (D.20). */
  datentraegernummer: number;
  /** Erstellungszeitpunkt für EDAT/EZEI/ERDAT, umgerechnet in Wiener Ortszeit. */
  erstellt: Date;
  /** IANA-Zeitzone, Voreinstellung `Europe/Vienna`. */
  zeitzone?: string;
  /** `true` → BEST `T1` (Testdaten), `false` → `TK` (Echtdaten), D.39. */
  testdaten: boolean;
  uebermittler: DktUebermittler;
  vertragspartner: DktVertragspartner;
  /** AJAHR (vierstellig übergeben, zweistellig geschrieben, D.6). */
  abrechnungsjahr: number;
  /**
   * ABZR, Kalendermonat 1–12. Die DKT kennt auch Quartale, Halbjahre, Jahre und
   * Wochen (D.4); die ÖGK nimmt seit 2025 nur noch den Kalendermonat an: „Künftig
   * wird beim Abrechnungszeitraum nur mehr der Kalendermonat und das Jahr
   * akzeptiert" (ÖGK an den Fachverband, 16.12.2024, Seite 2).
   */
  abrechnungsmonat: number;
  /** ABRA (D.2). */
  abrechnungsart: 'normal' | 'nachverrechnung';
  /** RNR in SART 23: „Rechnungsnummer der Transportabrechnung" (D.43). */
  rechnungsnummer: string;
  /** RDAT, Rechnungslegungsdatum (D.16). */
  rechnungsdatum: IsoDatum;
  /**
   * IBAN für die Anweisung, als SART 39 „IBAN:…" nach den Summensätzen (F.12,
   * Seite 71): „Ab 01.01.2026 ist die Bankverbindung, explizit der IBAN,
   * verpflichtend im elektronischen Datensatz zu übermitteln."
   */
  iban?: string;
  /** Weitere SART 39 auf Rechnungsebene, nach dem IBAN-Satz. */
  hinweise?: readonly string[];
  /** Die Fälle der Ebene 2, mindestens einer. */
  faelle: readonly DktFall[];
}

// --- Prüfhelfer -----------------------------------------------------------

function fehler(text: string): EldaError {
  return new EldaError(`DKT: ${text}`);
}

function pruefeCode<T extends Readonly<Record<string, unknown>>>(
  tabelle: T,
  wert: string,
  feld: string,
  quelle: string,
): void {
  if (!Object.prototype.hasOwnProperty.call(tabelle, wert)) {
    throw fehler(`${feld} '${wert}' ist kein Code laut ${quelle}.`);
  }
}

function pruefeVpnr(vpnr: string, feld: string): void {
  if (!vpnrPruefzifferGueltig(vpnr)) {
    throw fehler(`${feld}: keine sechsstellige Vertragspartnernummer mit gültiger Prüfziffer (D.63).`);
  }
}

/** D.61: Prüfziffer nach D.61 Punkt 1.3, oder `0000TTMMJJ`, „wo keine inländische Versicherungsnummer besteht". */
function pruefeVsnr(vsnr: string, feld: string): void {
  if (/^0000\d{6}$/.test(vsnr)) return;
  if (!vsnrPruefzifferGueltig(vsnr)) {
    throw fehler(
      `${feld}: keine zehnstellige Versicherungsnummer mit gültiger Prüfziffer und nicht in der Form ` +
        '0000TTMMJJ (D.61).',
    );
  }
}

function pruefeGanzzahl(wert: number, feld: string, min: number, max: number): void {
  if (!Number.isSafeInteger(wert) || wert < min || wert > max) {
    throw fehler(`${feld} muss eine ganze Zahl von ${min} bis ${max} sein.`);
  }
}

interface Tag {
  jahr: number;
  monat: number;
  tag: number;
}

function zerlegeDatum(iso: IsoDatum, feld: string): Tag {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw fehler(`${feld}: Datum im Format JJJJ-MM-TT erwartet.`);
  const [jahr, monat, tag] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(jahr, monat - 1, tag));
  if (probe.getUTCFullYear() !== jahr || probe.getUTCMonth() !== monat - 1 || probe.getUTCDate() !== tag) {
    throw fehler(`${feld}: kein gültiges Kalenderdatum.`);
  }
  return { jahr, monat, tag };
}

const zwei = (z: number): string => String(z).padStart(2, '0');
const ttmmjj = (t: Tag): string => `${zwei(t.tag)}${zwei(t.monat)}${zwei(t.jahr % 100)}`;
const ttmmjjjj = (t: Tag): string => `${zwei(t.tag)}${zwei(t.monat)}${String(t.jahr).padStart(4, '0')}`;
const tagZahl = (t: Tag): number => t.jahr * 10000 + t.monat * 100 + t.tag;

/** Uhrzeit `HH:MM` → `HHMM` (D.66, Format HHMM). */
function hhmm(zeit: Uhrzeit, feld: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(zeit);
  if (!m) throw fehler(`${feld}: Uhrzeit im Format HH:MM (00:00–23:59) erwartet.`);
  return `${m[1]}${m[2]}`;
}

/** D.66: „ANK, WZB, WZV — Grundstellung: 9999". */
const GRUNDSTELLUNG_ZEIT = '9999';

/**
 * PLZV/PLZN (D.38): „Die Postleitzahlen setzen sich aus einem Länderkennzeichen
 * nach ISO A3 in den ersten 3 Stellen und der Postleitzahl in den folgenden 5
 * Stellen zusammen … rechtsbündig mit führenden blank … z.B.: 'AUT 2500'".
 * Eine Vertragspartnernummer steht linksbündig (Feldtyp a/n, F.1; Muster E.3:
 * „833482  ").
 */
function ortsangabe(o: DktOrtsangabe, feld: string): string {
  if ('vpnr' in o) {
    pruefeVpnr(o.vpnr, feld);
    return o.vpnr;
  }
  if (!/^[A-Z]{3}$/.test(o.staat))
    throw fehler(`${feld}: Länderkennzeichen nach ISO 3166 A3 erwartet (D.38).`);
  if (!/^[0-9A-Z]{1,5}$/.test(o.plz)) {
    throw fehler(
      `${feld}: Postleitzahl mit 1 bis 5 Ziffern oder Großbuchstaben ohne Trennzeichen erwartet (D.38).`,
    );
  }
  return o.staat + o.plz.padStart(5, ' ');
}

/**
 * Namen in SART 01 werden auf Feldlänge gekürzt. F.7.1 (Seite 61): „Sind die
 * Namen länger als 30 bzw. 15 Zeichen, so werden diese im Datensatz der Satzart
 * 01 abgeschnitten angegeben"; das Muster E.3 kürzt ebenso den Namen des
 * Verordners auf zehn Stellen („LANDESKRAN"). Andere Felder kürzt dieser Code
 * nie.
 */
function gekuerzt(text: string, laenge: number): string {
  return text.trim().slice(0, laenge);
}

/**
 * IBAN-Prüfsumme nach ISO 13616 (Modulo 97). Die DKT verlangt nur „jenen IBAN,
 * an welchen die Anweisung erfolgen soll" (D.54, F.12); dass er gültig ist,
 * ist Voraussetzung jeder Anweisung.
 */
function pruefeIban(iban: string): void {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    throw fehler(
      'IBAN: elektronisches Format ohne Leerzeichen erwartet (Ländercode, Prüfziffern, Kontoteil).',
    );
  }
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const z of umgestellt) {
    const wert = z >= 'A' ? String(z.charCodeAt(0) - 55) : z;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  if (rest !== 1) throw fehler('IBAN: Prüfziffern stimmen nicht (ISO 13616).');
}

/**
 * Umsatzsteuerbetrag UBE „von SUM" (D.50), je Summensatz einmal aus der
 * Nettosumme gerechnet. Die DKT nennt keine Rundungsregel; gerundet wird
 * kaufmännisch auf ganze Cent (ab einem halben Cent auf). Das ist eine
 * Festlegung des Betreibers, keine Vorgabe des Dokuments — sollte ein Träger
 * anders rechnen, meldet er Ablehnungsgrund 33 „USt. falsch" (D.1).
 */
function umsatzsteuer(nettoCent: number, prozent: number): number {
  return Math.floor((nettoCent * prozent + 50) / 100);
}

// --- Satzbau ------------------------------------------------------------------

interface Kopfwerte {
  VSTRA: string;
  BLNDA: string;
  VPNR: string;
  VPADR: string;
  AJAHR: string;
  ABZR: string;
}

function satz(felder: readonly DktFeld[], werte: Record<string, string | undefined>): Buffer {
  return baueSatz(felder, werte, DKT_SATZLAENGE);
}

function block(
  felder: readonly DktFeld[],
  werte: Record<string, string | undefined>,
  laenge: number,
): string {
  return baueSatzText(felder, werte, laenge);
}

/** Ein Element der Satzfolge, bevor die Satznummer feststeht. */
type Entwurf = { sart: string; felder: readonly DktFeld[]; werte: Record<string, string | undefined> };

/** Datenblöcke eines Falls in der Reihenfolge von F.10: L (mit seinen B) chronologisch, dann D. */
function bloeckeDesFalls(fall: DktFall, nr: string): string[] {
  const bloecke: string[] = [];
  fall.leistungen.forEach((l, i) => {
    const feld = `${nr}, Leistung ${i + 1}`;
    if (!/^[0-9A-Za-z]{3}$/.test(l.position)) throw fehler(`${feld}: POSNR muss drei Zeichen haben (D.37).`);
    pruefeGanzzahl(l.anzahl, `${feld}: ANZKM`, 1, 9999);
    pruefeGanzzahl(l.tarifCent, `${feld}: Tarif in Cent`, 0, 99_999_999);
    pruefeGanzzahl(l.ustProzent, `${feld}: UST`, 0, 99);
    // F.10.1 (Seite 66): „Bei Pauschalbeträgen, deren tariflicher Wert mehr als
    // € 999.99 beträgt, wird das Datenfeld TAR mit „00000" und das Datenfeld
    // ANZKM mit „1" belegt. Im Datenfeld BETR wird der tatsächliche Tarifwert
    // angegeben."
    const grossePauschale = l.tarifCent > 99_999;
    if (grossePauschale && l.anzahl !== 1) {
      throw fehler(
        `${feld}: Tarif über 999,99 € ist nur als einzelne Pauschale darstellbar (F.10.1: TAR 00000, ANZKM 1).`,
      );
    }
    const betrag = l.tarifCent * l.anzahl; // D.11: „Bei SART 21 Betrag = TAR * ANZKM"
    const kb = l.kostenbeteiligung;
    if (kb !== undefined) {
      pruefeCode(KBS, kb.satz, `${feld}: KBS`, 'D.29');
      pruefeGanzzahl(kb.nettoCent, `${feld}: Kostenbeteiligung netto`, 0, 99_999_999);
      pruefeGanzzahl(kb.ustCent, `${feld}: Kostenbeteiligung USt`, 0, 99_999_999);
    }
    bloecke.push(
      block(
        DKT_BLOCK_LEISTUNG,
        {
          BLOKZ: 'L',
          POSNR: l.position,
          TAR: String(grossePauschale ? 0 : l.tarifCent),
          ANZKM: String(l.anzahl),
          BETR: String(betrag),
          UST: String(l.ustProzent),
          KBS: kb?.satz,
          // D.31: „Bei SART 21 SUMKB = Brutto-Summe der Kostenbeteiligung"
          SUMKB: kb === undefined ? undefined : String(kb.nettoCent + kb.ustCent),
          BEWNR: l.bewilligungsnummer,
        },
        DKT_BLOCKLAENGE_LEISTUNG,
      ),
    );
    for (const grun of l.begruendungen ?? []) {
      bloecke.push(block(DKT_BLOCK_BEGRUENDUNG, { BLOKZ: 'B', GRUN: grun }, DKT_BLOCKLAENGE_LEISTUNG));
    }
  });

  // D.17/D.18: ICD-10-Code (DIAKZ 3) als 6 × (3+1+1) Stellen, sonst Text (DIAKZ 2).
  const d = fall.diagnose;
  let diakz: string;
  let diagn: string;
  if ('icd10' in d) {
    if (d.icd10.length < 1 || d.icd10.length > 6)
      throw fehler(`${nr}: ein bis sechs ICD-10-Diagnosen (D.17).`);
    diakz = '3';
    diagn = d.icd10
      .map((c, i) => {
        if (!/^[0-9A-Za-z]{3}$/.test(c.code))
          throw fehler(`${nr}: Diagnose ${i + 1}: DIAG hat drei Stellen (D.17).`);
        for (const u of [c.untergliederung1, c.untergliederung2]) {
          if (u !== undefined && !/^[0-9A-Za-z]$/.test(u)) {
            throw fehler(`${nr}: Diagnose ${i + 1}: Untergliederung hat eine Stelle (D.17).`);
          }
        }
        return c.code + (c.untergliederung1 ?? ' ') + (c.untergliederung2 ?? ' ');
      })
      .join('');
  } else {
    if (d.text.trim() === '') throw fehler(`${nr}: Diagnosetext ist leer (D.17).`);
    diakz = '2';
    diagn = d.text;
  }
  bloecke.push(
    block(DKT_BLOCK_DIAGNOSE, { BLOKZ: 'D', DIAKZ: diakz, DIAGN: diagn }, DKT_BLOCKLAENGE_LEISTUNG),
  );
  return bloecke;
}

function pruefeTransport(
  t: DktTransport,
  nr: string,
  abzrEnde: number,
  erstelltTag: number,
  fall: DktFall,
): void {
  pruefeCode(GRU, t.grund, `${nr}: GRU`, 'D.27');
  pruefeCode(TART, t.art, `${nr}: TART`, 'D.52');
  pruefeCode(FART, t.fahrzeug, `${nr}: FART`, 'D.26');
  pruefeCode(BEF, t.befoerderung, `${nr}: BEF`, 'D.10');
  if (t.naca !== undefined) pruefeCode(NACA, t.naca, `${nr}: NACA`, 'D.32');

  const datum = tagZahl(zerlegeDatum(t.datum, `${nr}: LDAT`));
  // D.4: „Eine Verrechnung von Transporten, deren Transportdatum nach dem in der
  // Abrechnung angeführten Abrechnungszeitraum/Abrechnungsjahr liegt, kann nicht
  // erfolgen."
  if (datum > abzrEnde) throw fehler(`${nr}: Transportdatum liegt nach dem Abrechnungszeitraum (D.4).`);
  // D.1 Ablehnungsgrund 42: „Transportdatum ist größer als Tagesdatum".
  if (datum > erstelltTag)
    throw fehler(`${nr}: Transportdatum liegt nach dem Erstellungsdatum (D.1, Code 42).`);

  // D.53: „Bei Taxi ist die Grundstellung blank erlaubt." — sonst zwingend.
  if ((t.nummer ?? '').trim() === '' && t.fahrzeug !== '05') {
    throw fehler(`${nr}: TNR ist zwingend; nur bei Taxi (FART 05) darf sie leer bleiben (D.53).`);
  }
  // D.52: „99 sonstiger Transport (Begründungsblock notwendig)".
  if (t.art === '99' && !fall.leistungen.some((l) => (l.begruendungen ?? []).length > 0)) {
    throw fehler(`${nr}: Transportart 99 verlangt einen Begründungsblock (D.52).`);
  }
  // D.32: NACA „muss erfasst werden, wenn als Transportart „Erste-Hilfe-Einsatz"
  // (16) oder „Belassung" (15) oder „Verlegung" (07) in Zusammenhang mit einem
  // NAW-Einsatz angegeben ist". Ob sich „NAW-Einsatz" nur auf die Verlegung oder
  // auf alle drei bezieht, lässt der Satz offen; erzwungen wird nur, was beide
  // Lesarten verlangen: Notarztwagen (FART 02) und eine der drei Transportarten.
  if (t.fahrzeug === '02' && ['07', '15', '16'].includes(t.art) && t.naca === undefined) {
    throw fehler(`${nr}: NACA-Code ist beim NAW-Einsatz mit Transportart ${t.art} zwingend (D.32).`);
  }
  // D.38, Belegung PLZV/PLZN je Transportart. Für „Am Ort belassen" Hin-/Rück
  // nennt D.38 beim Ziel die Postleitzahl des Behandlungsortes; beim Ziel der
  // Kombinationen 05/06 wird deshalb nichts erzwungen.
  const vonVpnr = 'vpnr' in t.von;
  const nachVpnr = 'vpnr' in t.nach;
  if (['01', '03'].includes(t.art) && !nachVpnr) {
    throw fehler(`${nr}: Bei einem Hintransport ist in PLZN die Vertragspartnernummer anzugeben (D.38).`);
  }
  if (['02', '04'].includes(t.art) && (!vonVpnr || nachVpnr)) {
    throw fehler(
      `${nr}: Bei einem Heimtransport steht in PLZV die Vertragspartnernummer, in PLZN die Postleitzahl (D.38).`,
    );
  }
  if (['05', '06'].includes(t.art) && vonVpnr) {
    throw fehler(`${nr}: Bei einem Hin- und Rücktransport steht in PLZV die Postleitzahl (D.38).`);
  }
}

/**
 * Baut den DKT-Datenbestand einer Abrechnung: Vorlaufsatz, SART 00, je Fall
 * 01 / 11 / 39 / 02 / 06 / 07 / 20 / 21, dann je USt-Satz eine SART 23, die
 * Textsätze der Rechnungsebene, SART 99 und den Schlusssatz (E.2.1). Sätze zu je
 * 128 Zeichen, getrennt durch CRLF wie bei den übrigen ELDA-Beständen (siehe
 * `SATZTRENNER`).
 *
 * Geldbeträge sind ganze Cent. Was die DKT bestimmt, wird hier gerechnet
 * (BETR, SUM, ZSUM, REBE, Satzzähler); was sie offen lässt, wird nicht ergänzt.
 */
export function erstelleDktAbrechnung(e: DktAbrechnung): Buffer {
  // --- Rahmen ---
  for (const [feld, code] of [
    ['VSTR', e.traeger],
    ['VSTRA', e.abrechnungsstelle],
    ['VSTRU', e.datenuebernehmer],
  ] as const) {
    pruefeCode(VERSICHERUNGSTRAEGER, code, feld, 'D.62');
    if (NUR_LEISTUNGSZUSTAENDIG.includes(code)) {
      throw fehler(`${feld} '${code}' ist seit 01.03.2022 nur noch im Feld VSTRL zulässig (D.62).`);
    }
  }
  pruefeCode(BUNDESLAND, e.bundeslandAbrechnungsstelle, 'BLNDA', 'D.15');
  pruefeCode(BUNDESLAND, e.vertragspartner.bundesland, 'BLLE', 'D.15');
  if (e.vertragspartner.fachgebietUnterteilung !== undefined) {
    pruefeCode(UFACHL, e.vertragspartner.fachgebietUnterteilung, 'UFACHL', 'D.55');
  }
  pruefeVpnr(e.vertragspartner.vpnr, 'VPNR');
  pruefeVpnr(e.uebermittler.vpnr, 'VPNRU');
  pruefeGanzzahl(e.vertragspartner.adresscode, 'VPADR', 0, 99);
  pruefeGanzzahl(e.datentraegernummer, 'DTNR', 1, 999_999);
  pruefeGanzzahl(e.abrechnungsjahr, 'Abrechnungsjahr', 1000, 9999);
  pruefeGanzzahl(e.abrechnungsmonat, 'Abrechnungsmonat', 1, 12);
  if (!/^[A-Z]{3}$/.test(e.uebermittler.staat)) throw fehler('HKFZ: Staat nach ISO 3166 A3 erwartet (D.48).');
  if (e.vertragspartner.zvr !== undefined && !/^\d{9}$/.test(e.vertragspartner.zvr)) {
    throw fehler('ZVR: neun Ziffern erwartet (D.68).');
  }
  if (e.faelle.length === 0)
    throw fehler('Eine Abrechnung enthält mindestens einen Fall (E.2.1, Ebene 2 „>=1").');
  // B.3: bei der AUVA „pro Transport und Versicherten … in einem Datenbestand".
  if (e.traeger === AUVA_CODE && e.faelle.length !== 1) {
    throw fehler('Bei der AUVA ist je Transport und Versichertem ein eigener Datenbestand zu liefern (B.3).');
  }

  const zone = e.zeitzone ?? ZEITZONE_STANDARD;
  const uhr = wanduhrzeit(e.erstellt, zone);
  const erstellt: Tag = { jahr: Number(uhr.jahr), monat: Number(uhr.monat), tag: Number(uhr.tag) };
  const erstelltTag = tagZahl(erstellt);
  const letzterTagImMonat = new Date(Date.UTC(e.abrechnungsjahr, e.abrechnungsmonat, 0)).getUTCDate();
  const abzrEnde = tagZahl({ jahr: e.abrechnungsjahr, monat: e.abrechnungsmonat, tag: letzterTagImMonat });
  const rdat = zerlegeDatum(e.rechnungsdatum, 'RDAT');

  // F.12: IBAN „ab 01.01.2026 … verpflichtend". Ob der Stichtag am
  // Übermittlungstag oder am Abrechnungszeitraum hängt, sagt das Dokument nicht;
  // verlangt wird er, sobald einer der beiden ihn erreicht.
  const ibanPflicht = erstelltTag >= 20260101 || e.abrechnungsjahr * 100 + e.abrechnungsmonat >= 202601;
  if (e.iban === undefined) {
    if (ibanPflicht) throw fehler('Ab 01.01.2026 ist der IBAN als SART 39 „IBAN:" zu übermitteln (F.12).');
  } else {
    pruefeIban(e.iban);
  }

  const istOegk = OEGK_CODES.includes(e.traeger);
  const kopf: Kopfwerte = {
    VSTRA: e.abrechnungsstelle,
    BLNDA: e.bundeslandAbrechnungsstelle,
    VPNR: e.vertragspartner.vpnr,
    VPADR: String(e.vertragspartner.adresscode),
    AJAHR: zwei(e.abrechnungsjahr % 100),
    ABZR: zwei(e.abrechnungsmonat),
  };

  // --- Ebene 2 ---
  const entwuerfe: Entwurf[] = [];
  const leistungsbloecke: { ust: number; betrag: number; kb?: DktKostenbeteiligung }[] = [];
  const transportjahre = new Set<number>();
  let ustPflichtig = false;

  e.faelle.forEach((f, i) => {
    const nr = `Fall ${i + 1}`;
    const v = f.versicherter;
    pruefeCode(VERSICHERUNGSTRAEGER, v.traeger, `${nr}: VSTRL`, 'D.62');
    if (v.bundesland !== undefined) pruefeCode(BUNDESLAND, v.bundesland, `${nr}: BLNDL`, 'D.15');
    // D.15: „Die Angabe ist zwingend bei der AUVA … beim Feld BLNDL."
    if (e.traeger === AUVA_CODE && v.bundesland === undefined) {
      throw fehler(`${nr}: BLNDL ist bei der AUVA zwingend (D.15).`);
    }
    if (v.kategorie !== undefined) pruefeCode(KAT, v.kategorie, `${nr}: KAT`, 'D.48');
    pruefeVsnr(v.vsnr, `${nr}: VSNRV`);
    pruefeGanzzahl(f.belegnummer, `${nr}: BSNR`, 1, 99_999);
    pruefeVpnr(f.verordner.vpnr, `${nr}: VPNUW`);
    const sammelnummer = Object.prototype.hasOwnProperty.call(SAMMELNUMMERN, f.verordner.vpnr);
    // D.25 und F.4: FACHU „ist zu belegen, wenn VPNUW keine Sammelnummer ist".
    if (!sammelnummer && f.verordner.fachgebiet === undefined) {
      throw fehler(`${nr}: FACHU ist zu belegen, wenn VPNUW keine Sammelnummer ist (D.25).`);
    }
    if (f.verordner.fachgebiet !== undefined && !/^\d{2}$/.test(f.verordner.fachgebiet)) {
      throw fehler(`${nr}: FACHU hat zwei Ziffern (D.25).`);
    }
    if (f.leistungen.length === 0) throw fehler(`${nr}: mindestens eine Leistung (E.2.1, SART 21 „>=1").`);

    const alleTexte = [...(f.texte ?? []), ...f.leistungen.flatMap((l) => l.begruendungen ?? [])];
    // ÖGK an den Fachverband, 16.12.2024, Seite 2: Begründung verpflichtend „bei
    // Eingabe von Sammelnummer …: Angabe jeweiliger Ort und Name erforderlich".
    if (istOegk && sammelnummer && alleTexte.length === 0) {
      throw fehler(
        `${nr}: Bei einer Sammelnummer als VPNUW verlangt die ÖGK eine Begründung mit Ort und Name ` +
          '(GRUN oder SART 39; Schreiben vom 16.12.2024).',
      );
    }
    if (f.mehrfachtransport !== undefined) {
      if (f.mehrfachtransport.vsnr.length < 2) {
        throw fehler(`${nr}: Ein Mehrfachtransport hat mindestens zwei Patienten.`);
      }
      f.mehrfachtransport.vsnr.forEach((n, j) => pruefeVsnr(n, `${nr}: Mehrfachtransport, VSNR ${j + 1}`));
      const fehlt = ['MF', ...f.mehrfachtransport.vsnr].filter((s) => !alleTexte.some((t) => t.includes(s)));
      if (fehlt.length > 0) {
        throw fehler(
          `${nr}: Beim Mehrfachtransport müssen GRUN oder SART 39 „MF" und die Versicherungsnummern aller ` +
            `Patienten enthalten; es fehlt ${fehlt.length === 1 && fehlt[0] === 'MF' ? '„MF"' : 'mindestens eine Angabe'} ` +
            '(ÖGK 16.12.2024; WKO-Fachverband, Klarstellung Mehrfachtransporte ab 1.6.2025).',
        );
      }
    }

    pruefeTransport(f.transport, nr, abzrEnde, erstelltTag, f);
    transportjahre.add(zerlegeDatum(f.transport.datum, `${nr}: LDAT`).jahr);

    // SART 01 (F.4)
    entwuerfe.push({
      sart: '01',
      felder: DKT_VERSICHERTER,
      werte: {
        VSTRL: v.traeger,
        BLNDL: v.bundesland,
        BSNR: String(f.belegnummer),
        ZUNVS: gekuerzt(v.familienname, 30),
        VONVS: gekuerzt(v.vorname, 15),
        VSNRV: v.vsnr,
        KAT: v.kategorie,
        VPNUW: f.verordner.vpnr,
        ZUNUW: f.verordner.familienname === undefined ? undefined : gekuerzt(f.verordner.familienname, 10),
        FACHU: f.verordner.fachgebiet,
        UEDAT: ttmmjj(zerlegeDatum(f.antragsdatum, `${nr}: UEDAT`)),
        // D.65: VORZ „für Korrekturen durch den Vertragspartner"; negative
        // Korrekturen sind nicht Teil dieses Baus.
        VORZ: '0',
      },
    });

    // SART 11 (F.8)
    if (f.bezug !== undefined) {
      const b = f.bezug;
      pruefeGanzzahl(b.abrechnungsjahr, `${nr}: Bezug AJAHR`, 1000, 9999);
      pruefeGanzzahl(b.abrechnungsmonat, `${nr}: Bezug ABZR`, 1, 12);
      pruefeGanzzahl(b.belegnummer, `${nr}: Bezug BSNR`, 1, 99_999);
      if (b.rechnungsnummer.trim() === '') throw fehler(`${nr}: Bezug RNR ist leer (F.8).`);
      entwuerfe.push({
        sart: '11',
        felder: DKT_BEZUG,
        werte: {
          AJAHR: zwei(b.abrechnungsjahr % 100),
          ABZR: zwei(b.abrechnungsmonat),
          RNR: b.rechnungsnummer,
          BSNR: String(b.belegnummer),
        },
      });
    }

    // SART 39 auf Transportebene
    for (const t of f.texte ?? []) entwuerfe.push({ sart: '39', felder: DKT_TEXT, werte: { TXT: t } });

    // SART 02 (F.5)
    if (f.angehoeriger !== undefined) {
      pruefeVsnr(f.angehoeriger.vsnr, `${nr}: VSNRA`);
      entwuerfe.push({
        sart: '02',
        felder: DKT_ANGEHOERIGER,
        werte: {
          VSNRA: f.angehoeriger.vsnr,
          AZUNA: f.angehoeriger.familienname,
          AVONA: f.angehoeriger.vorname,
        },
      });
    }

    // SART 06 (F.6)
    if (f.adresse !== undefined) {
      const ad = f.adresse;
      if (!/^[A-Z]{3}$/.test(ad.staat)) throw fehler(`${nr}: LKZ nach ISO 3166 A3 erwartet (D.48).`);
      entwuerfe.push({
        sart: '06',
        felder: DKT_ADRESSE,
        werte: {
          LKZ: ad.staat,
          // D.38: PLZL „rechtsbündig mit führenden blank und ohne Trennzeichen".
          // Das Muster E.3 schreibt sie linksbündig — offener Punkt, hier gilt der Text.
          PLZL: ad.plz.padStart(9, ' '),
          STRA: ad.strasse,
          ORT: ad.ort,
          UVAZ: ad.uvAktenzeichen,
        },
      });
    }

    // SART 07 (F.7)
    if (f.ekvk !== undefined) {
      const p = f.ekvk.patient;
      if (!/^[A-Z]{2}$/.test(p.staat)) throw fehler(`${nr}: ESTAAT nach ISO 3166-1 A2 erwartet (D.22).`);
      const geb = zerlegeDatum(p.geburtsdatum, `${nr}: EGEBD`);
      // F.7.1: „Das Datenfeld VSNRV des Datensatzes der Satzart 01, wird bei der
      // Verwendung des Datensatzes 07 mit folgendem Wert befüllt: 0000TTMMJJ".
      if (v.vsnr !== `0000${ttmmjj(geb)}`) {
        throw fehler(
          `${nr}: Mit EKVK-Datensatz ist VSNRV als 0000TTMMJJ (Geburtsdatum) zu befüllen (F.7.1).`,
        );
      }
      entwuerfe.push({
        sart: '07',
        felder: DKT_EKVK,
        werte: {
          BLOCK: block(
            DKT_EKVK_PATIENT,
            {
              BLOKZ: 'P',
              ESTAAT: p.staat,
              EVSNR: p.versicherungsnummer,
              EZUNA: p.familienname,
              EVONA: p.vorname,
              EGEBD: ttmmjjjj(geb),
            },
            DKT_BLOCKLAENGE_EKVK,
          ),
        },
      });
      const w = f.ekvk.weitere;
      if (w !== undefined) {
        if (w.geschlecht !== undefined) pruefeCode(EGESL, w.geschlecht, `${nr}: EGESL`, 'D.22');
        if (w.form !== undefined) pruefeCode(EFORM, w.form, `${nr}: EFORM`, 'D.22');
        entwuerfe.push({
          sart: '07',
          felder: DKT_EKVK,
          werte: {
            BLOCK: block(
              DKT_EKVK_WEITERE,
              {
                BLOKZ: 'E',
                EGESL: w.geschlecht,
                EIC: w.institutionscode,
                EAKRO: w.akronym,
                EKANR: w.kartennummer,
                EAEND:
                  w.anspruchsende === undefined
                    ? undefined
                    : ttmmjjjj(zerlegeDatum(w.anspruchsende, `${nr}: EAEND`)),
                EFORM: w.form,
              },
              DKT_BLOCKLAENGE_EKVK,
            ),
          },
        });
      }
    }

    // SART 20 (F.9)
    const t = f.transport;
    entwuerfe.push({
      sart: '20',
      felder: DKT_TRANSPORT,
      werte: {
        LDAT: ttmmjj(zerlegeDatum(t.datum, `${nr}: LDAT`)),
        EBEG: hhmm(t.beginn, `${nr}: EBEG`),
        ANK: t.ankunft === undefined ? GRUNDSTELLUNG_ZEIT : hhmm(t.ankunft, `${nr}: ANK`),
        WZV: t.warteVon === undefined ? GRUNDSTELLUNG_ZEIT : hhmm(t.warteVon, `${nr}: WZV`),
        WZB: t.warteBis === undefined ? GRUNDSTELLUNG_ZEIT : hhmm(t.warteBis, `${nr}: WZB`),
        END: t.ende === 'ueber24h' ? '9999' : hhmm(t.ende, `${nr}: END`),
        TNR: t.nummer,
        KFZ: t.kennzeichen,
        ORTV: t.vonOrt,
        PLZV: ortsangabe(t.von, `${nr}: PLZV`),
        ORTN: t.nachOrt,
        PLZN: ortsangabe(t.nach, `${nr}: PLZN`),
        GRU: t.grund,
        TART: t.art,
        FART: t.fahrzeug,
        ZKR: t.zeitkritisch ? '1' : '0',
        BEF: t.befoerderung,
        NACA: t.naca,
      },
    });

    // SART 21 (F.10): je Satz bis zu zwei Blöcke.
    if (f.rechnungsnummer.trim() === '') throw fehler(`${nr}: RNR des Transportes ist leer (D.43).`);
    const bloecke = bloeckeDesFalls(f, nr);
    for (let b = 0; b < bloecke.length; b += 2) {
      entwuerfe.push({
        sart: '21',
        felder: DKT_LEISTUNG,
        werte: { RNR: f.rechnungsnummer, BLO1: bloecke[b], BLO2: bloecke[b + 1] },
      });
    }
    for (const l of f.leistungen) {
      leistungsbloecke.push(
        l.kostenbeteiligung === undefined
          ? { ust: l.ustProzent, betrag: l.tarifCent * l.anzahl }
          : { ust: l.ustProzent, betrag: l.tarifCent * l.anzahl, kb: l.kostenbeteiligung },
      );
      if (l.ustProzent > 0) ustPflichtig = true;
    }
  });

  // ÖGK an den Fachverband, 16.12.2024, „Jahresabgrenzung": „im Jänner und
  // Februar 2025 durchgeführte Transporte der Jahre 2024 und 2025 getrennt zu
  // verrechnen" — begründet mit den Rechnungsvorschriften der ÖGK. Das Schreiben
  // nennt nur den Jahreswechsel 2024/25; hier ist es verallgemeinert auf „nie
  // zwei Transportjahre in einem ÖGK-Bestand". Das schadet nicht, weil mehrere
  // Abrechnungen je Zeitraum ausdrücklich zulässig sind (dasselbe Schreiben).
  if (istOegk && transportjahre.size > 1) {
    throw fehler(
      'Transporte verschiedener Kalenderjahre sind für die ÖGK getrennt zu verrechnen (Jahresabgrenzung, ' +
        'Schreiben vom 16.12.2024).',
    );
  }
  // D.56: UID „ist bei nicht steuerbefreiten Vertragspartnern zwingend". Wer
  // Umsatzsteuer verrechnet, ist nicht steuerbefreit.
  if (ustPflichtig && e.vertragspartner.uid === undefined) {
    throw fehler('UID ist zwingend, wenn Umsatzsteuer verrechnet wird (D.56).');
  }

  // --- SART 23 je USt-Satz (F.11) ---
  const saetze = [...new Set(leistungsbloecke.map((l) => l.ust))].sort((x, y) => x - y);
  for (const ust of saetze) {
    const gruppe = leistungsbloecke.filter((l) => l.ust === ust);
    const sum = gruppe.reduce((s, l) => s + l.betrag, 0);
    const kobe = gruppe.reduce((s, l) => s + (l.kb?.nettoCent ?? 0), 0);
    const kobeUst = gruppe.reduce((s, l) => s + (l.kb?.ustCent ?? 0), 0);
    const zsum = sum - kobe; // D.50: „ZSUM = SUM - KOBE"
    const ube = umsatzsteuer(sum, ust); // D.50: „UBE = Umsatzsteuerbetrag von SUM"
    const rebe = zsum + ube - kobeUst; // D.41: „REBE = ZSUM + UBE - KOBEUST"
    if (zsum < 0 || rebe < 0) {
      throw fehler(
        `USt-Satz ${ust} %: Kostenbeteiligung übersteigt die Summe; negative Werte sind nicht Teil dieses Baus.`,
      );
    }
    entwuerfe.push({
      sart: '23',
      felder: DKT_SUMME,
      werte: {
        RNR: e.rechnungsnummer,
        RDAT: ttmmjj(rdat),
        UST: String(ust),
        ANZLB: String(gruppe.length),
        SUM: String(sum),
        KOBE: String(kobe),
        ZSUM: String(zsum),
        UBE: String(ube),
        REBE: String(rebe),
        KOBEUST: String(kobeUst),
      },
    });
  }

  // --- SART 39 auf Rechnungsebene, nach den Summensätzen (F.12) ---
  if (e.iban !== undefined)
    entwuerfe.push({ sart: '39', felder: DKT_TEXT, werte: { TXT: `IBAN:${e.iban}` } });
  for (const h of e.hinweise ?? []) entwuerfe.push({ sart: '39', felder: DKT_TEXT, werte: { TXT: h } });

  // --- Sätze mit Satzkopf, SART 99, Vorlauf- und Schlusssatz ---
  const anzahl = (...sarten: string[]): number => entwuerfe.filter((x) => sarten.includes(x.sart)).length;
  const zaehler: Record<string, number> = {
    ANZ01: anzahl('01'),
    ANZ02: anzahl('02'),
    ANZ20: anzahl('20'),
    ANZ21: anzahl('21'),
    ANZ06: anzahl('06'),
    ANZ23: anzahl('23'),
    ANZ07: anzahl('07'),
    ANZ11: anzahl('11'),
    ANZ39: anzahl('39'),
    ANZ85: 0,
  };
  for (const [feld, wert] of Object.entries(zaehler)) {
    const stellen = DKT_DATEIENDE.find((f) => f.name === feld)!.laenge;
    if (String(wert).length > stellen) {
      // F.14: „Ergibt die berechnete Anzahl einer Satzart mehr als 4 Stellen, muss
      // eine 2. Abrechnung mit neuer Rechnungsnummer erstellt werden."
      throw fehler(`${feld} hat mehr als ${stellen} Stellen; die Abrechnung ist zu teilen (F.14).`);
    }
  }

  const mitKopf = (satznummer: number, x: Entwurf): Buffer =>
    satz(x.felder, {
      ...x.werte,
      SART: x.sart,
      KOPF: baueSatzText(DKT_KOPF, { ...kopf, SATNR: String(satznummer) }, DKT_KOPFLAENGE),
    });

  const saetzeMitKopf: Buffer[] = [];
  let satznummer = 1;
  saetzeMitKopf.push(
    mitKopf(satznummer++, {
      sart: '00',
      felder: DKT_BEGINN,
      werte: {
        DPNR: '01',
        ERDAT: ttmmjj(erstellt),
        UIDV: UIDV[e.traeger],
        VPADR: String(e.vertragspartner.adresscode),
        UFACHL: e.vertragspartner.fachgebietUnterteilung,
        FACHL: FACHGEBIET_DKT,
        BLLE: e.vertragspartner.bundesland,
        VPADRL: String(e.vertragspartner.adresscode),
        VPNRL: e.vertragspartner.vpnr,
        VERSD: VERSION_DKT,
        ABRA: e.abrechnungsart === 'normal' ? '1' : '2',
        VPNRU: e.uebermittler.vpnr,
        UID: e.vertragspartner.uid,
        ZVR: e.vertragspartner.zvr,
      },
    }),
  );
  for (const x of entwuerfe) saetzeMitKopf.push(mitKopf(satznummer++, x));
  saetzeMitKopf.push(
    mitKopf(satznummer++, {
      sart: '99',
      felder: DKT_DATEIENDE,
      werte: { ...Object.fromEntries(Object.entries(zaehler).map(([k, w]) => [k, String(w)])), ANDP: '01' },
    }),
  );
  if (satznummer - 1 > 99_999) throw fehler('Mehr als 99999 Sätze passen nicht in SATNR (D.46).');

  const umschlag = { VSTRU: e.datenuebernehmer, OBUS: e.uebermittler.vpnr, VSTR: e.traeger };
  const vorlauf = satz(DKT_VORLAUF, {
    ...umschlag,
    SART: '00',
    PROJ: PROJ_DKT,
    BEST: e.testdaten ? BEST_DKT.test : BEST_DKT.echt,
    DTNR: String(e.datentraegernummer),
    EDAT: ttmmjjjj(erstellt),
    EZEI: `${uhr.stunde}${uhr.minute}${uhr.sekunde}`,
    HRST: e.uebermittler.name,
    HKFZ: e.uebermittler.staat,
    HPLZ: e.uebermittler.plz,
    VSTRA: e.abrechnungsstelle,
    VERS: VERSION_DKT,
  });
  // D.44: SANZ „Satzanzahl inklusive Vorlauf- und Schlusssatz".
  const schluss = satz(DKT_SCHLUSS, { ...umschlag, SART: '99', SANZ: String(saetzeMitKopf.length + 2) });

  const alle = [vorlauf, ...saetzeMitKopf, schluss];
  return Buffer.concat(alle.flatMap((s, i) => (i === 0 ? [s] : [SATZTRENNER, s])));
}
