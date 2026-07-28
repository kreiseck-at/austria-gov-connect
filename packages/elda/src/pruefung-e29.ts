import { EldaError } from './errors';
import type { Satzart } from './pflicht-e29';

type Werte = Readonly<Record<string, string | undefined>>;

function belegt(wert: string | undefined): boolean {
  return wert !== undefined && wert.trim() !== '';
}

function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

/** Wandelt ein Datum der Form TTMMJJJJ in eine vergleichbare Zahl JJJJMMTT. */
function alsZahl(datum: string): number {
  return Number(datum.slice(4, 8) + datum.slice(2, 4) + datum.slice(0, 2));
}

/**
 * Zulässige Formen des Geburtsdatums laut Prüfkatalog: vollständiges Datum,
 * unbekannter Tag (`00MMJJJJ`) oder nur das Jahr (`0000JJJJ`).
 */
function gueltigesGeburtsdatum(gebd: string): boolean {
  if (!/^\d{8}$/.test(gebd)) return false;
  const tt = Number(gebd.slice(0, 2));
  const mm = Number(gebd.slice(2, 4));
  const jjjj = Number(gebd.slice(4, 8));
  if (jjjj < 1000) return false;
  if (tt === 0 && mm === 0) return true;
  if (tt === 0) return mm >= 1 && mm <= 12;
  return tt >= 1 && tt <= 31 && mm >= 1 && mm <= 12;
}

function gueltigesDatum(wert: string): boolean {
  if (!/^\d{8}$/.test(wert)) return false;
  const tt = Number(wert.slice(0, 2));
  const mm = Number(wert.slice(2, 4));
  return tt >= 1 && tt <= 31 && mm >= 1 && mm <= 12;
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

/** Satzarten, bei denen der Prüfkatalog SOUM (F7107) und ZTUM (F7114) prüft. */
const UMMELDUNG_ZIEL_PRUEFUNG: ReadonlySet<Satzart> = new Set<Satzart>(['M4', 'M9']);

/** Satzarten, bei denen der Prüfkatalog das Format von VWAZ prüft (F7116). */
const VWAZ_FORMAT_PRUEFUNG: ReadonlySet<Satzart> = new Set<Satzart>(['M3', 'M8']);

/**
 * Satzarten, bei denen VSNR, GEBD und REFV laut Kapitel E.29.1 (Task 4, {@link
 * ALTERNATIVGRUPPEN}) eine gemeinsame, verbundene Zelle bilden: entweder ist die VSNR
 * bekannt, oder Geburtsdatum und Referenz der VSNR-Anforderung sind es gemeinsam. Bei
 * M8/M9/S3/S4 bilden nur VSNR und GEBD eine solche Gruppe, REFV steht dort für sich.
 */
const VSNR_GEBD_REFV_GRUPPE: ReadonlySet<Satzart> = new Set<Satzart>(['M3', 'M4', 'M6']);

/**
 * Prüft den Satzinhalt gegen die Regeln des ELDA-Prüfkatalogs, Blatt `VR`, soweit sie
 * sich ohne fachliche Zusatzkenntnis entscheiden lassen. Der Fehlercode des Katalogs steht
 * im Meldungstext, damit sich eine spätere Rückmeldung von ELDA zuordnen lässt.
 *
 * Zusätzlich zu den im Katalog unter F7051 geführten Regeln ("VSNR oder GEBD, mindestens
 * eines muss belegt sein") erzwingt diese Funktion für M3/M4/M6 — wo VSNR, GEBD und REFV
 * laut Kapitel E.29.2 (Satzart M3, Seite 305) eine Alternative bilden ("entweder gültige
 * VSNR, oder Geburtsdatum UND Referenz der VSNR-Anforderung gemeinsam") — dass ohne VSNR
 * auch REFV belegt sein muss. Diese Ergänzung trägt mangels eigenen Katalog-Codes ebenfalls
 * F7051 im Meldungstext; sie stammt nicht aus dem Prüfkatalog, sondern ist aus Kapitel
 * E.29.2 und der Zellverbund-Analyse aus Task 4 abgeleitet.
 *
 * Alle hier geprüften Werte sind entweder rein numerisch oder feste einzelne ASCII-Buch-
 * staben (`J`/`N`, Grundstellungen aus Nullen). Eine Normalisierung nach NFC ist für keinen
 * dieser Vergleiche relevant, da keiner der geprüften Werte zusammengesetzte Zeichen (z. B.
 * Umlaute) enthalten kann; Freitextfelder wie FANA/VONA werden hier bewusst nicht inhaltlich
 * geprüft (siehe F7036/F7038 unten).
 *
 * Nicht geprüft werden unter anderem die Prüfziffer der Versicherungsnummer (das Verfahren
 * ist in den Quellen nicht beschrieben), die trägerabhängige Länge der Beitragskontonummer,
 * die Schreibweise von Namen (F7036/F7038, erfordert manuelle Durchsicht) und die Regeln
 * rund um die Ummeldung. ELDA prüft diese serverseitig.
 */
export function pruefeInhalt(satzart: Satzart, werte: Werte): void {
  if (!belegt(werte.BKNR)) wirf('F7000', 'Die Beitragskontonummer (BKNR) darf nicht leer sein.');

  if (belegt(werte.GEBD) && !gueltigesGeburtsdatum(werte.GEBD!)) {
    wirf(
      'F7030',
      `Das Geburtsdatum (GEBD) '${werte.GEBD}' ist ungültig. Zulässig: TTMMJJJJ, 00MMJJJJ oder 0000JJJJ.`,
    );
  }

  const vsnrBelegt = belegt(werte.VSNR) && werte.VSNR !== '0000000000';
  const gebdBelegt = belegt(werte.GEBD);
  const refvBelegt = belegt(werte.REFV);

  if (!vsnrBelegt && !gebdBelegt) {
    wirf(
      'F7051',
      'Es muss mindestens eines der Felder Versicherungsnummer (VSNR) oder Geburtsdatum (GEBD) belegt sein.',
    );
  }

  // F7050 (Prüfkatalog): Ist ein Referenzwert der VSNR-Anforderung (REFV) angegeben, muss
  // das Geburtsdatum belegt sein — unabhängig davon, ob zusätzlich eine VSNR vorliegt.
  if (VSNR_GEBD_REFV_GRUPPE.has(satzart) && refvBelegt && !gebdBelegt) {
    wirf(
      'F7050',
      'Bei Angabe eines Referenzwertes der VSNR-Anforderung (REFV) muss das Geburtsdatum (GEBD) befüllt sein.',
    );
  }

  // Eigene Ergänzung (nicht im Prüfkatalog, siehe JSDoc oben): Fehlt die VSNR bei M3/M4/M6,
  // ist die Alternative nur vollständig, wenn neben dem Geburtsdatum auch REFV vorliegt.
  // An dieser Stelle ist GEBD bereits belegt (sonst hätte die F7051-Prüfung oben bereits
  // geworfen), es fehlt also nur noch REFV.
  if (VSNR_GEBD_REFV_GRUPPE.has(satzart) && !vsnrBelegt && !refvBelegt) {
    wirf(
      'F7051',
      'Ohne Versicherungsnummer (VSNR) muss neben dem Geburtsdatum (GEBD) auch der Referenzwert der ' +
        'VSNR-Anforderung (REFV) angegeben sein (Kapitel E.29.2, Satzart M3: „VSNR Anforderung“); ' +
        'dieser Teil der Regel trägt mangels eigenen Katalog-Codes ebenfalls F7051, stammt aber nicht ' +
        'aus dem Prüfkatalog selbst.',
    );
  }

  if (ADAT_PFLICHT.has(satzart) && !belegt(werte.ADAT)) {
    wirf('F7060', `Das An-/Abmelde- bzw. Änderungsdatum (ADAT) darf bei Satzart ${satzart} nicht leer sein.`);
  }
  if (belegt(werte.ADAT)) {
    if (ADAT_FORMAT_PRUEFUNG.has(satzart) && !gueltigesDatum(werte.ADAT!)) {
      wirf('F7061', `Das Datum (ADAT) '${werte.ADAT}' ist ungültig. Erwartet: TTMMJJJJ.`);
    }
    if (alsZahl(werte.ADAT!) < 20190101)
      wirf('F7062', 'Das Datum (ADAT) darf nicht vor dem 01.01.2019 liegen.');
  }

  if (satzart === 'M8' || satzart === 'M9') {
    if (!belegt(werte.RDAT))
      wirf('F7065', 'Das richtige An-/Abmeldedatum (RDAT) darf bei einer Richtigstellung nicht leer sein.');
    if (!gueltigesDatum(werte.RDAT!))
      wirf('F7066', `Das Datum (RDAT) '${werte.RDAT}' ist ungültig. Erwartet: TTMMJJJJ.`);
    if (alsZahl(werte.RDAT!) < 20190101)
      wirf('F7067', 'Das Datum (RDAT) darf nicht vor dem 01.01.2019 liegen.');
  }

  if (satzart === 'M3' && belegt(werte.BBER) && !/^(0[1-9]|1[0-3])$/.test(werte.BBER!)) {
    wirf('F7069', `Der Beschäftigungsbereich (BBER) '${werte.BBER}' ist ungültig. Zulässig sind 01 bis 13.`);
  }

  if (UMMELDUNG_ZIEL_PRUEFUNG.has(satzart) && belegt(werte.SOUM) && werte.SOUM !== 'J') {
    wirf(
      'F7107',
      `Der Sonderfall Ummeldung (SOUM) '${werte.SOUM}' ist ungültig. Zulässig sind 'J' oder leer.`,
    );
  }

  if (UMMELDUNG_ZIEL_PRUEFUNG.has(satzart) && belegt(werte.ZTUM) && !/^1[1-9]$/.test(werte.ZTUM!)) {
    wirf(
      'F7114',
      `Der Zielversicherungsträger Ummeldung (ZTUM) '${werte.ZTUM}' ist ungültig. Zulässig sind 11 bis 19.`,
    );
  }

  if (VWAZ_FORMAT_PRUEFUNG.has(satzart) && belegt(werte.VWAZ) && !/^\d{4}$/.test(werte.VWAZ!)) {
    wirf('F7116', `Das Ausmaß der wöchentlichen Arbeitszeit (VWAZ) '${werte.VWAZ}' muss vierstellig sein.`);
  }
  if (
    satzart === 'M3' &&
    !belegt(werte.VWAZ) &&
    belegt(werte.ADAT) &&
    alsZahl(werte.ADAT!) > 20251231 &&
    belegt(werte.BBER) &&
    VWAZ_PFLICHT_BBER.has(werte.BBER!) &&
    werte.FRDV === 'N'
  ) {
    wirf(
      'F7115',
      'Bei einer Anmeldung mit Meldedatum nach dem 31.12.2025 ist das Ausmaß der vereinbarten ' +
        `wöchentlichen Arbeitszeit (VWAZ) anzugeben, wenn der Beschäftigungsbereich '${werte.BBER}' beträgt ` +
        'und kein freier Dienstvertrag (FRDV) vorliegt.',
    );
  }
}
