import { EldaError } from './errors';
import { PLAETZE_ARBEITSORT, PLAETZE_DIENSTGEBER, PLAETZE_SELBSTAENDIG } from './felder-e27';
import { PFLICHT_E27, type E27Meldeart, type E27Satzart } from './pflicht-e27';
import { alsZahl, gueltigeVsnrStruktur, gueltigesDatum, gueltigesGeburtsdatum } from './pruefung-e29';

type Werte = Readonly<Record<string, string | undefined>>;

/**
 * Inhaltsprüfung des Antrags auf zwischenstaatliche Bescheinigung nach dem
 * Prüfkatalog 43.1.0.0, Blatt `ES` (Fehlercodes F75xx/F76xx) und Blatt
 * `Allgemein` (F0xxx), sowie nach den Codelisten der Organisationsbeschreibung.
 * Jede Regel nennt ihren Code; die Meldung trägt ihn vorne, wie bei E.29.
 *
 * Umgesetzt sind nur Regeln mit dem Status `N` (Nichtübernahme). Regeln mit
 * Status `W` (Warnung, z. B. F7626 Groß-/Kleinschreibung, „wird vorerst noch
 * nicht aktiviert!") und Regeln, deren Kriterium die Quellen nicht nennen
 * (DGPLZ/PLZL „ungültig lt. Kapitel D.12" — D.12 beschreibt das Format, aber
 * keine Prüfung), bleiben ELDA überlassen.
 *
 * Nicht umsetzbar sind die Zeilen des Blatts ES zu Feldern, die die Version 08
 * des Satzes nicht mehr hat: DGP (F7505/F7543), BKFZ (F7506), AGKFZ (F7512),
 * BFRIST (F7530/F7531), BBEGIN (F7535/F7536), BZEIT (F7550/F7551), ANAT
 * (F7560/F7561), BSTAAT (F7565/F7566), STAB (F7574/F7575), STSTAAT
 * (F7577/F7582), STEND (F7578/F7579) und BART (F7598). Sie stehen im Katalog,
 * aber kein Feld der Feldtabelle auf den Seiten 290–295 trägt diese Namen.
 *
 * Bewusst nicht umgesetzt:
 *
 * - **F7665** „Antragszeitraum, von mehr als 3 Monate in der Vergangenheit"
 *   (EA): hängt vom Tag der Prüfung ab, nicht vom Satz.
 * - **F7595/F7596/F7597** (VSNA, APNR, AAKT bei E5 „leer"): Die Matrix auf
 *   Seite 298 führt alle drei als `Z3` (optional), Kapitel D.65 sagt, Anzahl und
 *   Kombination hingen vom jeweiligen Abkommen ab. Welche Nummer welches
 *   Abkommen verlangt, steht nirgends — der Widerspruch bleibt offen (README,
 *   Ausblick).
 * - **F7634** Eindeutigkeit der UIDM über alle Meldungen eines Beitragskontos:
 *   innerhalb eines Bestands prüft das `erstelleEsBestand`, darüber hinaus nur
 *   ELDA. Ebenso **F7636** (UIDU zeigt auf eine bei ELDA vorhandene Meldung).
 * - Die Prüfziffer der Versicherungsnummer (Verfahren in keiner Quelle).
 */

function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

function wert(werte: Werte, name: string): string | undefined {
  const w = werte[name];
  if (w === undefined) return undefined;
  const t = w.trim().normalize('NFC');
  return t === '' ? undefined : t;
}

/** Wie {@link wert}, ein Wert aus lauter Nullen ist bei numerischen Feldern die Grundstellung. */
function zahl(werte: Werte, name: string): string | undefined {
  const t = wert(werte, name);
  return t === undefined || /^0+$/.test(t) ? undefined : t;
}

const JN: ReadonlySet<string> = new Set(['J', 'N']);

/** Feld 5 GESL, Seite 290; Prüfkatalog Blatt Allgemein Nr. 27 (F0082): 1, 2, 3, 4, 6, 7. */
const GESCHLECHT: ReadonlySet<string> = new Set(['1', '2', '3', '4', '6', '7']);

/** Feld 26 DGWS, Seite 291: Schlüsselzahlen 00 bis 12. */
const WIRTSCHAFTSSEKTOR: ReadonlySet<string> = new Set(
  Array.from({ length: 13 }, (_, i) => String(i).padStart(2, '0')),
);

/** Feld 74 AUET, Seite 294. */
const AUSUEBUNG: ReadonlySet<string> = new Set(['U', 'S', 'B']);

/**
 * Kapitel D.36, Seite 115, „Satzarten E1 bis E4": die in AGSTAAT, AOST und
 * STAATHB zulässigen Staaten — EU, EWR, Schweiz und Vereinigtes Königreich,
 * Österreich eingeschlossen. Fußnote 33: „In der Satzart E1 ist im Feld AGSTAAT
 * ‚Österreich‘ nicht zulässig." Der Prüfkatalog verweist für AOST (F7607), STAATHB
 * (F7563) und AGSTAAT (F7611) auf genau diese Tabelle.
 */
export const STAATEN_E1_BIS_E4: ReadonlySet<string> = new Set([
  'BE',
  'HR',
  'SE',
  'BG',
  'LV',
  'SK',
  'DK',
  'LT',
  'SI',
  'DE',
  'LU',
  'ES',
  'EE',
  'MT',
  'CZ',
  'FI',
  'NL',
  'HU',
  'FR',
  'AT',
  'CY',
  'GR',
  'PL',
  'IS',
  'IE',
  'PT',
  'LI',
  'IT',
  'RO',
  'NO',
  'CH',
  'GB',
]);

/**
 * Kapitel D.36, Seite 116, „Satzart E5": die 24 Staaten mit bilateralem
 * Abkommen. `QU` steht für Quebec (Fußnote 37: „im ISO-A2 Code nicht
 * vorhanden"), `YU` für Kosovo — beides so abgedruckt.
 */
export const STAATEN_E5: ReadonlySet<string> = new Set([
  'AL',
  'JP',
  'PH',
  'AU',
  'CA',
  'QU',
  'BA',
  'KR',
  'CH',
  'BR',
  'YU',
  'RS',
  'CL',
  'MK',
  'TN',
  'DK',
  'MD',
  'TR',
  'IN',
  'MN',
  'US',
  'IL',
  'ME',
  'UY',
]);

/**
 * Prüfkatalog Blatt ES Nr. 40 (F7663): „ANFL=J und Feld STSL=BE, BG, DK, DE, EE,
 * FI, FR, GR, IE, IT, HR, LV, LT, LU, MT, NL, AT, PL, PT, RO, SE, SK, ES, CZ, HU,
 * CY, LI, NO". Übernommen wie abgedruckt — Island fehlt in dieser Liste.
 */
const STSL_NICHT_BEI_FLUECHTLING: ReadonlySet<string> = new Set([
  'BE',
  'BG',
  'DK',
  'DE',
  'EE',
  'FI',
  'FR',
  'GR',
  'IE',
  'IT',
  'HR',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'AT',
  'PL',
  'PT',
  'RO',
  'SE',
  'SK',
  'ES',
  'CZ',
  'HU',
  'CY',
  'LI',
  'NO',
]);

/**
 * Länge der Beitragskontonummer je beitragskontoführendem Träger, Prüfkatalog
 * Blatt Allgemein Nr. 14 (F0162–F0171, Status N, Satzarten E1–E5). Die
 * zehnstellige Form ist bei allen Landesstellen zulässig.
 */
const BKNR_LAENGE_JE_VTBK: Readonly<Record<string, readonly number[]>> = {
  '11': [8, 10],
  '12': [9, 10],
  '13': [7, 10],
  '14': [8, 10],
  '15': [7, 10],
  '16': [7, 10],
  '17': [7, 10],
  '18': [7, 10],
  '19': [6, 10],
};
const BKNR_CODE_JE_VTBK: Readonly<Record<string, string>> = {
  '11': 'F0162',
  '12': 'F0163',
  '13': 'F0164',
  '14': 'F0165',
  '15': 'F0166',
  '16': 'F0167',
  '17': 'F0168',
  '18': 'F0169',
  '19': 'F0171',
};

/** Prüfkatalog Blatt Allgemein Nr. 2 (F0011): „"NEU" ist gültig nur bei SART … E1, E2, E5". */
const BKNR_NEU_ERLAUBT: ReadonlySet<E27Satzart> = new Set<E27Satzart>(['E1', 'E2', 'E5']);

/**
 * Textform einer UUID nach RFC 4122: 8-4-4-4-12 Hexadezimalziffern. Kapitel
 * D.68 verlangt eine „UUID gemäß ISO/IEC 9834-8 und technisch RFC 4122-konform";
 * der Prüfkatalog prüft die Zeichen (F7662: „0-9, a-f, Bindestrich, ‚case
 * insensitiv‘"). Version und Variante prüft er nicht, deshalb hier auch nicht.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zwei Großbuchstaben — die Form des ISO-A2-Codes aus D.11/D.12. */
const ISO_A2 = /^[A-Z]{2}$/;

function jn(werte: Werte, name: string, code: string): void {
  const w = wert(werte, name);
  if (w !== undefined && !JN.has(w)) wirf(code, `Feld ${name}: zulässig sind J oder N.`);
}

function datum(werte: Werte, name: string, code: string): void {
  const w = zahl(werte, name);
  if (w !== undefined && !gueltigesDatum(w)) wirf(code, `Feld ${name}: ungültiges Datum, erwartet TTMMJJJJ.`);
}

/** Prüft die Inhaltsregeln eines Antrags oder Stornos; wirft beim ersten Verstoß. */
export function pruefeInhaltE27(satzart: E27Satzart, meldeart: E27Meldeart, werte: Werte): void {
  const uidm = wert(werte, 'UIDM');
  if (uidm !== undefined && !UUID.test(uidm)) {
    wirf('F7662', 'Die UIDM ist keine UUID in RFC-4122-Form (8-4-4-4-12 Hexadezimalziffern), Kapitel D.68.');
  }
  const uidu = wert(werte, 'UIDU');
  if (uidu !== undefined && !UUID.test(uidu)) {
    wirf('F7662', 'Die UIDU ist keine UUID in RFC-4122-Form (8-4-4-4-12 Hexadezimalziffern), Kapitel D.69.');
  }
  // F7634 verlangt eine UIDM, die für alle gültigen Meldungen zum Beitragskonto eindeutig
  // ist. Ein Storno, dessen UIDM gleich der UIDU ist, trüge die UIDM der stornierten
  // Meldung ein zweites Mal — das ist genau dieser Fall, nur schon im Satz erkennbar.
  if (uidm !== undefined && uidu !== undefined && uidm.toLowerCase() === uidu.toLowerCase()) {
    wirf('F7634', 'UIDM und UIDU sind gleich; ein Storno braucht eine eigene, neue UIDM.');
  }

  for (let platz = 1; platz <= PLAETZE_DIENSTGEBER; platz++) pruefeBknr(satzart, werte, platz);

  if (meldeart === '02') return;

  // --- Person ----------------------------------------------------------------
  const gebd = zahl(werte, 'GEBD');
  if (gebd !== undefined && !gueltigesGeburtsdatum(gebd)) {
    wirf('F7587', 'Das Geburtsdatum (GEBD) ist ungültig. Zulässig: TTMMJJJJ, 00MMJJJJ oder 0000JJJJ.');
  }
  const vsnr = zahl(werte, 'VSNR');
  if (vsnr !== undefined && !gueltigeVsnrStruktur(vsnr)) {
    wirf(
      'F7589',
      'Die Versicherungsnummer (VSNR) ist ungültig: erwartet LLLPTTMMJJ mit Tag 01–31 und Monat ' +
        '01–15 (Kapitel D.6). Die Prüfziffer wird nicht nachgerechnet.',
    );
  }
  const gesl = wert(werte, 'GESL');
  if (gesl !== undefined && !GESCHLECHT.has(gesl)) {
    wirf('F0082', 'Das Geschlecht (GESL) ist ungültig; zulässig sind 1, 2, 3, 4, 6 und 7.');
  }
  const wkfz = wert(werte, 'WKFZ');
  if (wkfz !== undefined && !ISO_A2.test(wkfz)) {
    wirf('F7616', 'WKFZ: erwartet ein Staatenschlüssel nach ISO A2, zwei Großbuchstaben (Kapitel D.12).');
  }

  // --- Dienstgeber -------------------------------------------------------------
  for (let platz = 1; platz <= PLAETZE_DIENSTGEBER; platz++) {
    const n = (f: string): string => `${f}_${platz}`;
    const dgkfz = wert(werte, n('DGKFZ'));
    if (dgkfz !== undefined && !ISO_A2.test(dgkfz)) {
      wirf(`F7506_${platz}`, `${n('DGKFZ')}: erwartet ein Staatenschlüssel nach ISO A2 (Kapitel D.12).`);
    }
    const dgws = wert(werte, n('DGWS'));
    if (dgws !== undefined && !WIRTSCHAFTSSEKTOR.has(dgws.padStart(2, '0'))) {
      wirf(`F7509_${platz}`, `${n('DGWS')}: zulässig sind die Schlüsselzahlen 00 bis 12 (Seite 291).`);
    }
    datum(werte, n('BBEG'), `F7521_${platz}`);
    datum(werte, n('BEND'), `F7523_${platz}`);
    const bbeg = zahl(werte, n('BBEG'));
    const bend = zahl(werte, n('BEND'));
    if (bbeg !== undefined && bend !== undefined && alsZahl(bend) < alsZahl(bbeg)) {
      wirf(`F7524_${platz}`, `${n('BEND')} liegt vor ${n('BBEG')}.`);
    }
    if (
      satzart === 'E5' &&
      wert(werte, 'AGSTAAT') === 'JP' &&
      bbeg !== undefined &&
      alsZahl(bbeg) < 20251201
    ) {
      wirf(
        'F7527',
        'Entsendung nach Japan (AGSTAAT JP): der Beginn (BBEG) darf nicht vor dem 01.12.2025 liegen.',
      );
    }
    jn(werte, n('ANKZ'), `F7541_${platz}`);
    const stbh = wert(werte, n('STAATHB'));
    if (PFLICHT_E27[satzart].STAATHB !== '-' && wert(werte, n('ANKZ')) === 'J' && stbh === undefined) {
      wirf(`F7599_${platz}`, `${n('STAATHB')} ist anzugeben, wenn ${n('ANKZ')} = J (Heimatbasis).`);
    }
    if (stbh !== undefined && !STAATEN_E1_BIS_E4.has(stbh)) {
      wirf(`F7563_${platz}`, `${n('STAATHB')}: kein Staat der Tabelle „Satzarten E1 bis E4" (Kapitel D.36).`);
    }
    jn(werte, n('MARGDG'), `F7639_${platz}`);
    jn(werte, n('BEAT'), `F7641_${platz}`);
    pruefeVtbk(satzart, werte, platz);
  }

  // --- Entsendung (E1, E5) -------------------------------------------------------
  jn(werte, 'DGPS', 'F7542');
  const agstaat = wert(werte, 'AGSTAAT');
  if (agstaat !== undefined) {
    if (satzart === 'E5' ? !STAATEN_E5.has(agstaat) : !STAATEN_E1_BIS_E4.has(agstaat) || agstaat === 'AT') {
      wirf(
        'F7611',
        satzart === 'E5'
          ? 'AGSTAAT: kein Staat der Tabelle „Satzart E5" (bilaterale Abkommen, Kapitel D.36).'
          : 'AGSTAAT: kein Staat der Tabelle „Satzarten E1 bis E4" oder Österreich (Kapitel D.36, Fußnote 33).',
      );
    }
  }
  jn(werte, 'BFEST', 'F7526');
  if (wert(werte, 'BFEST') === 'J') {
    if (wert(werte, 'AGNA') === undefined) wirf('F7511', 'AGNA ist anzugeben, wenn BFEST = J.');
    if (wert(werte, 'AGPLZ') === undefined) wirf('F7513', 'AGPLZ ist anzugeben, wenn BFEST = J.');
    if (wert(werte, 'AGORT') === undefined) wirf('F7514', 'AGORT ist anzugeben, wenn BFEST = J.');
    if (wert(werte, 'AGSTR') === undefined) wirf('F7624', 'AGSTR ist anzugeben, wenn BFEST = J.');
  }
  jn(werte, 'ANABL', 'F7546');
  if (wert(werte, 'ANABL') === 'J' && wert(werte, 'ANABLJ') === undefined) {
    wirf('F7629', 'ANABLJ (Gründe) ist anzugeben, wenn ANABL = J.');
  }
  jn(werte, 'BUEL', 'F7556');
  jn(werte, 'ANIV', 'F7594');

  // --- Selbständige Tätigkeit (E4) -----------------------------------------------
  for (let platz = 1; platz <= PLAETZE_SELBSTAENDIG; platz++) {
    const stkfz = wert(werte, `STKFZ_${platz}`);
    if (stkfz !== undefined && !ISO_A2.test(stkfz)) {
      wirf(`F7562_${platz}`, `STKFZ_${platz}: erwartet ein Staatenschlüssel nach ISO A2 (Kapitel D.12).`);
    }
    datum(werte, `STAS_${platz}`, `F7601_${platz}`);
    jn(werte, `MARGST_${platz}`, `F7643_${platz}`);
  }

  // --- Arbeitsorte (E2–E4, EA) ----------------------------------------------------
  jn(werte, 'ANATJ', 'F7628');
  let oesterreich = false;
  for (let platz = 1; platz <= PLAETZE_ARBEITSORT; platz++) {
    const n = (f: string): string => `${f}_${platz}`;
    const aost = wert(werte, n('AOST'));
    if (aost !== undefined && !STAATEN_E1_BIS_E4.has(aost)) {
      wirf(`F7607_${platz}`, `${n('AOST')}: kein Staat der Tabelle „Satzarten E1 bis E4" (Kapitel D.36).`);
    }
    if (aost === 'AT') oesterreich = true;
    jn(werte, n('AOKBS'), `F7604_${platz}`);
    if (wert(werte, n('AOKBS')) === 'J') {
      const fehlt = (f: string): boolean => wert(werte, n(f)) === undefined;
      if (fehlt('AOFNSN')) wirf(`F7605_${platz}`, `${n('AOFNSN')} ist anzugeben, wenn ${n('AOKBS')} = J.`);
      if (fehlt('AOORT')) wirf(`F7606_${platz}`, `${n('AOORT')} ist anzugeben, wenn ${n('AOKBS')} = J.`);
      if (fehlt('AOSTRA')) wirf(`F7609_${platz}`, `${n('AOSTRA')} ist anzugeben, wenn ${n('AOKBS')} = J.`);
      if (fehlt('AOPLZL')) wirf(`F7613_${platz}`, `${n('AOPLZL')} ist anzugeben, wenn ${n('AOKBS')} = J.`);
    }
    const auet = wert(werte, n('AUET'));
    if (auet !== undefined && !AUSUEBUNG.has(auet)) {
      wirf(`F7652_${platz}`, `${n('AUET')}: zulässig sind U, S oder B.`);
    }
  }
  if (wert(werte, 'ANATJ') === 'J' && !oesterreich) {
    wirf('F7650', 'ANATJ = J verlangt mindestens einen Arbeitsort mit AOST = AT (Kapitel D.36, Fußnote 34).');
  }

  // --- Zeiträume und Kennzeichen -------------------------------------------------
  datum(werte, 'AZRV', 'F7645');
  datum(werte, 'AZRB', 'F7647');
  jn(werte, 'ANFL', 'F7649');
  const stsl = wert(werte, 'STSL');
  if (wert(werte, 'ANFL') === 'J' && stsl !== undefined && STSL_NICHT_BEI_FLUECHTLING.has(stsl)) {
    wirf('F7663', 'ANFL = J verträgt sich nicht mit einer EU/EWR-Staatsbürgerschaft im Feld STSL.');
  }
  jn(werte, 'AUSMTE', 'F7654');
  datum(werte, 'ANTVON', 'F7656');
  datum(werte, 'ANTBIS', 'F7658');
}

/** Beitragskontonummer eines Dienstgeber-Platzes: Form, „NEU", Länge je VTBK, Pflicht bei DGKFZ AT. */
function pruefeBknr(satzart: E27Satzart, werte: Werte, platz: number): void {
  const name = `BKNR_${platz}`;
  const roh = werte[name];
  // F0012: „erster Feldwert ein Leerzeichen". Das Feld ist linksbündig; ein
  // führendes Leerzeichen verschöbe die Nummer, statt bloß zu stören.
  if (roh !== undefined && roh.trim() !== '' && roh.startsWith(' ')) {
    wirf('F0012', `${name}: beginnt mit einem Leerzeichen.`);
  }
  const bknr = wert(werte, name);
  if (bknr === undefined) return;
  if (bknr === 'NEU') {
    if (!BKNR_NEU_ERLAUBT.has(satzart)) {
      wirf('F0011', `${name}: „NEU" ist nur bei den Satzarten E1, E2 und E5 zulässig.`);
    }
    return;
  }
  // F0162–F0171 nennt der Katalog nur für E1–E5; EA bleibt deshalb ohne Längenprüfung.
  const vtbk = zahl(werte, `VTBK_${platz}`);
  const laengen = vtbk === undefined ? undefined : BKNR_LAENGE_JE_VTBK[vtbk.padStart(2, '0')];
  if (laengen !== undefined && satzart !== 'EA' && !laengen.includes(bknr.length)) {
    wirf(
      BKNR_CODE_JE_VTBK[vtbk!.padStart(2, '0')]!,
      `${name}: beim Träger ${vtbk} sind ${laengen.join(' oder ')} Stellen zulässig.`,
    );
  }
}

/** Beitragskontoführender Träger eines Dienstgeber-Platzes. */
function pruefeVtbk(satzart: E27Satzart, werte: Werte, platz: number): void {
  const vtbk = zahl(werte, `VTBK_${platz}`);
  const bknr = wert(werte, `BKNR_${platz}`);
  const dgkfz = wert(werte, `DGKFZ_${platz}`);
  if (satzart === 'E2' || satzart === 'E3' || satzart === 'E4' || satzart === 'EA') {
    // Blatt Allgemein Nr. 15 (F0183): BKNR „leer und Feld DGKFZ = AT" bei E2, E3, E4, EA.
    if (dgkfz === 'AT' && bknr === undefined) {
      wirf(
        'F0183',
        `BKNR_${platz} ist anzugeben, wenn der Dienstgeber in Österreich sitzt (DGKFZ_${platz} = AT).`,
      );
    }
  }
  if (satzart === 'E2' || satzart === 'E3' || satzart === 'E4') {
    // Blatt ES Nr. 13: VTBK „leer und DGKFZ = AT" (F7661) und „leer und BKNR nicht leer" (F7664_n).
    if (vtbk === undefined && dgkfz === 'AT') {
      wirf('F7661', `VTBK_${platz} ist anzugeben, wenn DGKFZ_${platz} = AT.`);
    }
    if (vtbk === undefined && bknr !== undefined) {
      wirf(`F7664_${platz}`, `VTBK_${platz} ist anzugeben, wenn BKNR_${platz} belegt ist.`);
    }
  }
  if (vtbk === undefined) return;
  const v = vtbk.padStart(2, '0');
  const landesstelle = /^1[1-9]$/.test(v);
  // Blatt ES Nr. 13: E1 „gültig 05, 11-19" (F7661_n), E2–E5 „gültig 11-19" (F7660_n).
  // Für EA nennt der Katalog keine Zeile; Seite 291 nennt 05 und 11–19, Fußnote 69
  // auf Seite 305 lässt die BVAEB-EB nur bei E1 zu — bleibt also 11–19.
  if (satzart === 'E1') {
    if (!landesstelle && v !== '05') wirf(`F7661_${platz}`, `VTBK_${platz}: zulässig sind 05 und 11 bis 19.`);
  } else if (!landesstelle) {
    wirf(`F7660_${platz}`, `VTBK_${platz}: zulässig sind 11 bis 19.`);
  }
}
