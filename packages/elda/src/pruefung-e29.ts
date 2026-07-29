import { EldaError } from './errors';
import type { Satzart } from './pflicht-e29';

type Werte = Readonly<Record<string, string | undefined>>;

function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

/**
 * Trimmt einen Feldwert und normalisiert ihn nach NFC. Werte, die aus einem
 * längenfixierten Satz herausgeschnitten wurden, können mit Füllzeichen (in der Regel
 * Leerzeichen) aufgefüllt ankommen; ein exakter Vergleich oder ein `^...$`-Format-Regex auf
 * dem Rohwert würde einen an sich gültigen Wert dann fälschlich als ungültig oder als
 * unbelegt werten (bzw. umgekehrt eine Grundstellung wie `0000000000` mit Füllzeichen nicht
 * als solche erkennen). Liefert `undefined`, wenn nach dem Trimmen nichts übrig bleibt —
 * das ist die einzige Stelle, an der „belegt“ entschieden wird.
 */
function normalisiert(wert: string | undefined): string | undefined {
  if (wert === undefined) return undefined;
  const getrimmt = wert.trim().normalize('NFC');
  return getrimmt === '' ? undefined : getrimmt;
}

/** Wandelt ein Datum der Form TTMMJJJJ in eine vergleichbare Zahl JJJJMMTT. */
function alsZahl(datum: string): number {
  return Number(datum.slice(4, 8) + datum.slice(2, 4) + datum.slice(0, 2));
}

function istSchaltjahr(jjjj: number): boolean {
  return (jjjj % 4 === 0 && jjjj % 100 !== 0) || jjjj % 400 === 0;
}

const TAGE_PRO_MONAT: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Liefert die tatsächliche Anzahl Tage eines Monats, Februar im Schaltjahr eingeschlossen. */
function tageImMonat(mm: number, jjjj: number): number {
  if (mm === 2 && istSchaltjahr(jjjj)) return 29;
  return TAGE_PRO_MONAT[mm - 1] ?? 31;
}

/**
 * Zulässige Formen des Geburtsdatums laut Prüfkatalog: vollständiges Datum,
 * unbekannter Tag (`00MMJJJJ`) oder nur das Jahr (`0000JJJJ`). Beim vollständigen Datum wird
 * der Tag gegen die tatsächliche Länge des Monats geprüft (inklusive Schaltjahr) — die
 * Sonderformen mit Tag `00` bleiben davon unberührt.
 */
function gueltigesGeburtsdatum(gebd: string): boolean {
  if (!/^\d{8}$/.test(gebd)) return false;
  const tt = Number(gebd.slice(0, 2));
  const mm = Number(gebd.slice(2, 4));
  const jjjj = Number(gebd.slice(4, 8));
  if (jjjj < 1000) return false;
  if (tt === 0 && mm === 0) return true;
  if (tt === 0) return mm >= 1 && mm <= 12;
  if (mm < 1 || mm > 12) return false;
  return tt >= 1 && tt <= tageImMonat(mm, jjjj);
}

/** Prüft ein vollständiges Datum der Form TTMMJJJJ gegen die tatsächliche Monatslänge. */
function gueltigesDatum(wert: string): boolean {
  if (!/^\d{8}$/.test(wert)) return false;
  const tt = Number(wert.slice(0, 2));
  const mm = Number(wert.slice(2, 4));
  const jjjj = Number(wert.slice(4, 8));
  if (mm < 1 || mm > 12) return false;
  return tt >= 1 && tt <= tageImMonat(mm, jjjj);
}

/** Beschäftigungsbereiche, für die VWAZ ab 01.01.2026 zwingend ist (Prüfkatalog F7115). */
const VWAZ_PFLICHT_BBER: ReadonlySet<string> = new Set(['01', '02', '03', '04', '11']);

/** Satzarten, bei denen ADAT laut Prüfkatalog (Blatt VR, Zeile zu F7060) nicht leer sein darf. */
const ADAT_PFLICHT: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M6', 'M8', 'M9', 'S3', 'S4']);

/**
 * Satzarten, bei denen der Prüfkatalog das Format von ADAT prüft (F7061). Bei M8/M9 führt
 * ADAT unverändert das ursprüngliche An-/Abmeldedatum der richtigzustellenden Meldung fort
 * (siehe Kapitel E.29.2, Satzart M8) — der Katalog prüft das Format dort bewusst nicht
 * erneut, sondern nur das Feld RDAT (F7066). Per Zellverbund im Blatt VR verifiziert: die
 * Satzart-Spalte zu F7061 ist eine von F7060 unabhängige, explizit gesetzte Zelle mit dem
 * Wert „M3, M4, M6, S3, S4“ — M8/M9 fehlen dort bewusst.
 */
const ADAT_FORMAT_PRUEFUNG: ReadonlySet<Satzart> = new Set<Satzart>(['M3', 'M4', 'M6', 'S3', 'S4']);

/** Satzarten, bei denen der Prüfkatalog das Format von UMDA prüft (F7104, Blatt VR Nr. 30). */
const UMDA_FORMAT_PRUEFUNG: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M9', 'S4']);

/** Satzarten, bei denen der Prüfkatalog SOUM (F7107) und ZTUM (F7114) prüft. */
const UMMELDUNG_ZIEL_PRUEFUNG: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M9']);

/**
 * Satzarten, bei denen der Prüfkatalog den Abmeldegrund (AGRD) führt und gegen die Codeliste
 * aus Kapitel D.22 prüft (F7096; Blatt VR, Satzart-Spalte zu Nr. 27 „M4, M9"). Deckt sich mit
 * der Pflichtmatrix aus `pflicht-e29.ts`, wo AGRD nur für M4/M9 eine Pflichtstufe ungleich
 * `-` trägt.
 */
const AGRD_SATZARTEN: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M9']);

/**
 * Abmeldegründe laut Kapitel D.22 („AGRD – Abmeldegrund, Code“), Seite 94: die dort
 * abgedruckte Codeliste von „01 – Kündigung durch den Dienstgeber“ bis „00 – sonstiger Grund
 * mit Ende des Beschäftigungsverhältnisses“. Die Codes 26 und 28 fehlen bewusst — dieselbe
 * Lücke zeigt die zusammenfassende Aufzählung im Fließtext auf Seite 95 („Code 01 bis 25 oder
 * Code 27, 30, 32, 34“), es handelt sich also nicht um einen Abschreibfehler dieses Pakets.
 * Die Codes 31 und 33 sind im Dokument ausdrücklich als „interner SV-Abmeldegrund“
 * gekennzeichnet, bleiben aber gültige Werte des Feldes und sind deshalb Teil der Liste.
 */
const AGRD_CODES: ReadonlySet<string> = new Set([
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '27',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
]);

/** Satzarten, bei denen der Prüfkatalog das Format von VWAZ prüft (F7116). */
const VWAZ_FORMAT_PRUEFUNG: ReadonlySet<Satzart> = new Set<Satzart>(['M3', 'M8']);

/**
 * Satzarten, für die der Prüfkatalog F7050 führt (Blatt VR, Nr. 22 „REFV GEBD“, Spalte
 * Satzart wörtlich „M3, M4, M6“): Ist ein Referenzwert der VSNR-Anforderung (REFV)
 * angegeben, muss das Geburtsdatum (GEBD) belegt sein — unabhängig davon, ob zusätzlich
 * eine VSNR vorliegt. Die Menge stammt direkt aus der Satzart-Spalte des Katalogs, nicht
 * aus einer Zellverbund-Analyse (die verbundenen Zellen aus Kapitel E.29.1 betreffen eine
 * andere Regel, siehe {@link VSNR_FEHLT_REFV_PFLICHT}).
 */
const F7050_SATZARTEN: ReadonlySet<Satzart> = new Set<Satzart>(['M3', 'M4', 'M6']);

/**
 * Satzarten, bei denen laut Kapitel E.30.2 (VSNR-Anforderung, Erstellvorschriften, Seite
 * 332) ohne bekannte VSNR neben dem Geburtsdatum (GEBD) zusätzlich der Referenzwert der
 * VSNR-Anforderung (REFV) angegeben werden muss:
 *
 * „Ist vor Rückmeldung der VSNR eine Abmeldung (SART M4), Änderungsmeldung (SART M6) oder
 * Richtigstellung Anmeldung (SART M8) erforderlich, muss zwingend zusätzlich zum
 * Geburtsdatum (GEBD) auch der Referenzwert der VSNR-Anforderung (REFV) angegeben werden.“
 *
 * Bei M3 (Anmeldung) gilt das ausdrücklich NICHT: Dieselbe Stelle in E.30.2 sowie Kapitel
 * E.29.2 (Seite 305) erlauben dort das Geburtsdatum ohne REFV, wenn die Übermittlung der
 * VSNR-Anforderung zum Zeitpunkt der Anmeldung nicht möglich war — die Referenz wird dann
 * per Richtigstellung (SART M8) nachgetragen. Der Prüfkatalog kennt dafür folgerichtig
 * keinen eigenen Fehlercode; ELDA nimmt eine solche Anmeldung an. Es gibt für diese Regel
 * (M4/M6/M8) ebenfalls keinen eigenen Katalog-Code; die daraus abgeleitete Prüfung trägt
 * deshalb mangels Alternative F7051 im Meldungstext.
 */
const VSNR_FEHLT_REFV_PFLICHT: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M6', 'M8']);

/**
 * Prüft den Satzinhalt gegen die Regeln des ELDA-Prüfkatalogs, Blatt `VR`, soweit sie
 * sich ohne fachliche Zusatzkenntnis entscheiden lassen. Der Fehlercode des Katalogs steht
 * im Meldungstext, damit sich eine spätere Rückmeldung von ELDA zuordnen lässt.
 *
 * Zusätzlich zu der im Katalog unter F7051 geführten Regel ("VSNR oder GEBD, mindestens
 * eines muss belegt sein") erzwingt diese Funktion für M4/M6/M8, dass ohne VSNR auch der
 * Referenzwert der VSNR-Anforderung (REFV) belegt sein muss — Beleg und Ausnahme für M3
 * stehen bei {@link VSNR_FEHLT_REFV_PFLICHT} (Kapitel E.30.2, Seite 332). Diese Ergänzung
 * trägt mangels eigenen Katalog-Codes ebenfalls F7051 im Meldungstext; sie stammt nicht aus
 * dem Prüfkatalog, sondern ist aus Kapitel E.30.2 abgeleitet.
 *
 * Alle Feldwerte werden vor jedem Vergleich über {@link normalisiert} getrimmt und nach NFC
 * normalisiert: Werte, die aus einem längenfixierten Satz herausgeschnitten wurden, können
 * mit Füllzeichen aufgefüllt sein, und ein exakter Vergleich oder Format-Regex auf dem
 * Rohwert würde einen an sich gültigen Wert fälschlich ablehnen oder eine Grundstellung
 * übersehen. Da alle hier geprüften Werte rein numerisch oder feste einzelne
 * ASCII-Buchstaben (`J`/`N`) sind, ändert die NFC-Normalisierung selbst nichts an den
 * Vergleichsergebnissen — sie stellt nur sicher, dass sich das je nach Eingabekodierung
 * nicht unbemerkt ändert. Freitextfelder wie FANA/VONA werden hier bewusst nicht inhaltlich
 * geprüft (siehe F7036/F7038 unten).
 *
 * Ummeldung (Datenfelder 31–38, Kapitel E.29.2, Seite 319–321) und Abmeldegrund:
 *
 * - F7096: Der Abmeldegrund (AGRD) wird bei M4/M9 gegen die Codeliste aus Kapitel D.22
 *   geprüft (siehe {@link AGRD_CODES}).
 * - F7108/F7109/F7112/F7113: Ist das Ummeldedatum (UMDA) belegt, müssen Zielversicherungs-
 *   träger (ZTUM) und Beitragskontonummer Ummeldung (ZKUM) es ebenfalls sein; ist UMDA leer,
 *   müssen SOUM/ZTUM/ZKUM (bei M9 zusätzlich RUMD) ebenfalls leer bleiben. Zusammen bilden
 *   diese vier — allesamt echten — Katalog-Codes genau die „alles oder nichts"-Form, die die
 *   Matrix „Abmeldung mit Abmeldegrund 12 (Ummeldung)" (Seite 319, UMDA/ZTUM/ZKUM dort
 *   gemeinsam `Z`) und ihre Ausnahme „Ummeldung ohne Zielangaben" (Seite 321, dieselben
 *   Felder dort gemeinsam `-`) fordern — ohne dass dafür der Abmeldegrund (AGRD) selbst
 *   bekannt sein müsste: Keiner der vier Codes stellt auf AGRD ab, sie sind allein über UMDA
 *   entscheidbar.
 *
 * Bewusst NICHT umgesetzt ist F7105 („Feld UMDA befüllt und Feld AGRD ist nicht 12"), obwohl
 * es in derselben thematischen Nähe liegt: Kapitel E.29.2, Seite 326/327 („Beispiel 6,
 * Aufhebung einer Ummeldung") zeigt eine Richtigstellung (M9) mit AGRD = 02 bei zugleich
 * belegtem UMDA/ZTUM/ZKUM — dieses dokumentierte, mit einem Zahlenbeispiel belegte Verhalten
 * widerspricht F7105 wörtlich genommen. Es ist kein Extraktionsfehler: Die Matrix „Bei
 * Richtigstellung einer Abmeldung mit Abmeldegrund 12 (Ummeldung) auf Abmeldegrund ungleich
 * 12 (Ummeldung) zum Storno der Ummeldung" (Seite 320/321) führt UMDA/ZTUM/ZKUM ausdrücklich
 * als `Z`, obwohl der (neue) Abmeldegrund dort nicht 12 ist — die Meldung braucht diese
 * Felder, um die ursprüngliche Ummeldung am Zielkonto zu stornieren. F7105 wörtlich
 * umzusetzen würde dieses belegte Verhalten als Fehler ablehnen; ob ELDA dort serverseitig
 * eine engere, aus der Katalog-Zeile allein nicht ersichtliche Bedingung anwendet, bleibt
 * offen. Bis das geklärt ist, bleibt F7105 hier unimplementiert.
 *
 * Nicht geprüft werden außerdem unter anderem die Prüfziffer der Versicherungsnummer (das
 * Verfahren ist in den Quellen nicht beschrieben), die trägerabhängige Länge der
 * Beitragskontonummer, die Schreibweise von Namen (F7036/F7038, erfordert manuelle
 * Durchsicht) und die Abhängigkeit zwischen Abmeldegrund und Ende des
 * Beschäftigungsverhältnisses (F7111, Kapitel D.22, Seite 96). ELDA prüft diese serverseitig.
 */
export function pruefeInhalt(satzart: Satzart, werte: Werte): void {
  const bknr = normalisiert(werte.BKNR);
  const gebd = normalisiert(werte.GEBD);
  const vsnr = normalisiert(werte.VSNR);
  const refv = normalisiert(werte.REFV);
  const adat = normalisiert(werte.ADAT);
  const rdat = normalisiert(werte.RDAT);
  const umda = normalisiert(werte.UMDA);
  const rumd = normalisiert(werte.RUMD);
  const bber = normalisiert(werte.BBER);
  const soum = normalisiert(werte.SOUM);
  const ztum = normalisiert(werte.ZTUM);
  const zkum = normalisiert(werte.ZKUM);
  const vwaz = normalisiert(werte.VWAZ);
  const frdv = normalisiert(werte.FRDV);
  const agrd = normalisiert(werte.AGRD);

  if (bknr === undefined) wirf('F7000', 'Die Beitragskontonummer (BKNR) darf nicht leer sein.');

  if (gebd !== undefined && !gueltigesGeburtsdatum(gebd)) {
    wirf(
      'F7030',
      `Das Geburtsdatum (GEBD) '${gebd}' ist ungültig. Zulässig: TTMMJJJJ, 00MMJJJJ oder 0000JJJJ.`,
    );
  }

  const vsnrBelegt = vsnr !== undefined && vsnr !== '0000000000';
  const gebdBelegt = gebd !== undefined;
  const refvBelegt = refv !== undefined;

  if (!vsnrBelegt && !gebdBelegt) {
    wirf(
      'F7051',
      'Es muss mindestens eines der Felder Versicherungsnummer (VSNR) oder Geburtsdatum (GEBD) belegt sein.',
    );
  }

  // F7050 (Prüfkatalog): Ist ein Referenzwert der VSNR-Anforderung (REFV) angegeben, muss
  // das Geburtsdatum belegt sein — unabhängig davon, ob zusätzlich eine VSNR vorliegt.
  if (F7050_SATZARTEN.has(satzart) && refvBelegt && !gebdBelegt) {
    wirf(
      'F7050',
      'Bei Angabe eines Referenzwertes der VSNR-Anforderung (REFV) muss das Geburtsdatum (GEBD) befüllt sein.',
    );
  }

  // Eigene Ergänzung (nicht im Prüfkatalog, siehe VSNR_FEHLT_REFV_PFLICHT und JSDoc oben):
  // Fehlt die VSNR bei M4/M6/M8, ist die Alternative nur vollständig, wenn neben dem
  // Geburtsdatum auch REFV vorliegt. An dieser Stelle ist GEBD bereits belegt (sonst hätte
  // die F7051-Prüfung oben bereits geworfen), es fehlt also nur noch REFV. Bei M3 gilt diese
  // Zusatzpflicht ausdrücklich nicht (Kapitel E.29.2/E.30.2: Nachtrag per M8 zulässig).
  if (VSNR_FEHLT_REFV_PFLICHT.has(satzart) && !vsnrBelegt && !refvBelegt) {
    wirf(
      'F7051',
      'Ohne Versicherungsnummer (VSNR) muss bei Abmeldung, Änderungsmeldung oder Richtigstellung Anmeldung ' +
        'neben dem Geburtsdatum (GEBD) auch der Referenzwert der VSNR-Anforderung (REFV) angegeben sein ' +
        '(Kapitel E.30.2, Seite 332); dieser Teil der Regel trägt mangels eigenen Katalog-Codes ebenfalls ' +
        'F7051, stammt aber nicht aus dem Prüfkatalog selbst.',
    );
  }

  if (ADAT_PFLICHT.has(satzart) && adat === undefined) {
    wirf('F7060', `Das An-/Abmelde- bzw. Änderungsdatum (ADAT) darf bei Satzart ${satzart} nicht leer sein.`);
  }
  if (adat !== undefined) {
    if (ADAT_FORMAT_PRUEFUNG.has(satzart) && !gueltigesDatum(adat)) {
      wirf('F7061', `Das Datum (ADAT) '${adat}' ist ungültig. Erwartet: TTMMJJJJ.`);
    }
    if (alsZahl(adat) < 20190101) wirf('F7062', 'Das Datum (ADAT) darf nicht vor dem 01.01.2019 liegen.');
  }

  if (satzart === 'M8' || satzart === 'M9') {
    if (rdat === undefined) {
      wirf('F7065', 'Das richtige An-/Abmeldedatum (RDAT) darf bei einer Richtigstellung nicht leer sein.');
    }
    if (!gueltigesDatum(rdat!)) wirf('F7066', `Das Datum (RDAT) '${rdat}' ist ungültig. Erwartet: TTMMJJJJ.`);
    if (alsZahl(rdat!) < 20190101) wirf('F7067', 'Das Datum (RDAT) darf nicht vor dem 01.01.2019 liegen.');
  }

  // F7104 (Prüfkatalog, reine Formatprüfung wie F7061/F7066): UMDA muss TTMMJJJJ sein.
  if (UMDA_FORMAT_PRUEFUNG.has(satzart) && umda !== undefined && !gueltigesDatum(umda)) {
    wirf('F7104', `Das Ummeldedatum (UMDA) '${umda}' ist ungültig. Erwartet: TTMMJJJJ.`);
  }

  // F7106 (Prüfkatalog, reine Formatprüfung wie F7061/F7066): RUMD muss TTMMJJJJ sein (nur M9).
  if (satzart === 'M9' && rumd !== undefined && !gueltigesDatum(rumd)) {
    wirf('F7106', `Das richtige Ummeldedatum (RUMD) '${rumd}' ist ungültig. Erwartet: TTMMJJJJ.`);
  }

  if (satzart === 'M3' && bber !== undefined && !/^(0[1-9]|1[0-3])$/.test(bber)) {
    wirf('F7069', `Der Beschäftigungsbereich (BBER) '${bber}' ist ungültig. Zulässig sind 01 bis 13.`);
  }

  // F7096 (Prüfkatalog): AGRD gegen die Codeliste aus Kapitel D.22 (siehe AGRD_CODES).
  if (AGRD_SATZARTEN.has(satzart) && agrd !== undefined && !AGRD_CODES.has(agrd)) {
    wirf('F7096', `Der Abmeldegrund (AGRD) '${agrd}' ist ungültig. Zulässige Codes siehe Kapitel D.22.`);
  }

  if (UMMELDUNG_ZIEL_PRUEFUNG.has(satzart) && soum !== undefined && soum !== 'J') {
    wirf('F7107', `Der Sonderfall Ummeldung (SOUM) '${soum}' ist ungültig. Zulässig sind 'J' oder leer.`);
  }

  if (UMMELDUNG_ZIEL_PRUEFUNG.has(satzart) && ztum !== undefined && !/^1[1-9]$/.test(ztum)) {
    wirf(
      'F7114',
      `Der Zielversicherungsträger Ummeldung (ZTUM) '${ztum}' ist ungültig. Zulässig sind 11 bis 19.`,
    );
  }

  // F7108 (Prüfkatalog, A1): Ist das Ummeldedatum (UMDA) belegt, muss auch der
  // Zielversicherungsträger Ummeldung (ZTUM) belegt sein.
  if (UMMELDUNG_ZIEL_PRUEFUNG.has(satzart) && umda !== undefined && ztum === undefined) {
    wirf(
      'F7108',
      `Der Zielversicherungsträger Ummeldung (ZTUM) darf bei Satzart ${satzart} nicht leer sein, ` +
        'wenn das Ummeldedatum (UMDA) belegt ist.',
    );
  }

  // F7109 (Prüfkatalog, A1): Ist das Ummeldedatum (UMDA) belegt, muss auch die
  // Beitragskontonummer Ummeldung (ZKUM) belegt sein.
  if (UMMELDUNG_ZIEL_PRUEFUNG.has(satzart) && umda !== undefined && zkum === undefined) {
    wirf(
      'F7109',
      `Die Beitragskontonummer Ummeldung (ZKUM) darf bei Satzart ${satzart} nicht leer sein, ` +
        'wenn das Ummeldedatum (UMDA) belegt ist.',
    );
  }

  // F7112 (Prüfkatalog, A1, nur M4): Ist das Ummeldedatum (UMDA) leer, dürfen SOUM, ZTUM und
  // ZKUM nicht belegt sein — sonst wäre die Ummeldung nur teilweise angegeben.
  if (
    satzart === 'M4' &&
    umda === undefined &&
    (soum !== undefined || ztum !== undefined || zkum !== undefined)
  ) {
    wirf(
      'F7112',
      'Ohne Ummeldedatum (UMDA) dürfen Sonderfall Ummeldung (SOUM), Zielversicherungsträger ' +
        'Ummeldung (ZTUM) und Beitragskontonummer Ummeldung (ZKUM) nicht belegt sein.',
    );
  }

  // F7113 (Prüfkatalog, A1, nur M9): wie F7112, zusätzlich mit RUMD (das Feld existiert nur bei M9).
  if (
    satzart === 'M9' &&
    umda === undefined &&
    (rumd !== undefined || soum !== undefined || ztum !== undefined || zkum !== undefined)
  ) {
    wirf(
      'F7113',
      'Ohne Ummeldedatum (UMDA) dürfen Richtiges Ummeldedatum (RUMD), Sonderfall Ummeldung (SOUM), ' +
        'Zielversicherungsträger Ummeldung (ZTUM) und Beitragskontonummer Ummeldung (ZKUM) nicht ' +
        'belegt sein.',
    );
  }

  if (VWAZ_FORMAT_PRUEFUNG.has(satzart) && vwaz !== undefined && !/^\d{4}$/.test(vwaz)) {
    wirf('F7116', `Das Ausmaß der wöchentlichen Arbeitszeit (VWAZ) '${vwaz}' muss vierstellig sein.`);
  }
  if (
    satzart === 'M3' &&
    vwaz === undefined &&
    adat !== undefined &&
    alsZahl(adat) > 20251231 &&
    bber !== undefined &&
    VWAZ_PFLICHT_BBER.has(bber) &&
    frdv === 'N'
  ) {
    wirf(
      'F7115',
      'Bei einer Anmeldung mit Meldedatum nach dem 31.12.2025 ist das Ausmaß der vereinbarten ' +
        `wöchentlichen Arbeitszeit (VWAZ) anzugeben, wenn der Beschäftigungsbereich '${bber}' beträgt ` +
        'und kein freier Dienstvertrag (FRDV) vorliegt.',
    );
  }
}
