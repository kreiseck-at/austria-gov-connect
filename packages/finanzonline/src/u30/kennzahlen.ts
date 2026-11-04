/**
 * Kennzahlen der Umsatzsteuervoranmeldung (U30).
 *
 * Reihenfolge, Blöcke und Wertetypen 1:1 aus dem amtlichen Schema
 * `BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_07_2026.xsd` (Stand 24.04.2026); das Schema
 * ab 01/2022 ist identisch ohne KZ 124/125. Bedeutung und Steuersatz aus dem
 * Formular U 30-2026 (Version 13.03.2026).
 *
 * Wertetypen: `kz` = größer 0 (null wird weggelassen), `kznull` = ab 0,
 * `kzvorz` = mit Vorzeichen.
 */

export type Kennzahl =
  | 'kz000'
  | 'kz001'
  | 'kz021'
  | 'kz011'
  | 'kz012'
  | 'kz015'
  | 'kz017'
  | 'kz018'
  | 'kz019'
  | 'kz016'
  | 'kz020'
  | 'kz022'
  | 'kz124'
  | 'kz029'
  | 'kz006'
  | 'kz037'
  | 'kz052'
  | 'kz007'
  | 'kz056'
  | 'kz057'
  | 'kz048'
  | 'kz044'
  | 'kz032'
  | 'kz070'
  | 'kz071'
  | 'kz072'
  | 'kz125'
  | 'kz073'
  | 'kz008'
  | 'kz088'
  | 'kz076'
  | 'kz077'
  | 'kz060'
  | 'kz061'
  | 'kz083'
  | 'kz065'
  | 'kz066'
  | 'kz082'
  | 'kz087'
  | 'kz089'
  | 'kz064'
  | 'kz062'
  | 'kz063'
  | 'kz067'
  | 'kz090';

/** Kennzahlen, für die FinanzOnline die Steuer aus der Bemessungsgrundlage rechnet. */
export type SatzKennzahl =
  | 'kz022'
  | 'kz124'
  | 'kz029'
  | 'kz006'
  | 'kz037'
  | 'kz052'
  | 'kz007'
  | 'kz072'
  | 'kz125'
  | 'kz073'
  | 'kz008'
  | 'kz088';

export interface KennzahlInfo {
  kz: Kennzahl;
  /** Dreistellige Kennzahl wie im Formular, z. B. `'022'`. */
  nummer: string;
  /** Block im XML (bestimmt die Elternelemente). */
  block: 'L' | 'STEUERFREI' | 'VERSTEUERT' | 'IGE' | 'VERSTEUERT_IGE' | 'VORSTEUER';
  typ: 'kz' | 'kznull' | 'kzvorz';
  /** Steuersatz in Promille (20 % = 200, 4,9 % = 49), nur bei Satz-Kennzahlen. */
  satzPromille?: number;
  bedeutung: string;
  /** Erster zulässiger Zeitraum (`JJJJ-MM`), falls eingeschränkt. */
  abZeitraum?: '2026-07';
}

function k(
  nummer: string,
  block: KennzahlInfo['block'],
  bedeutung: string,
  extra: Partial<Pick<KennzahlInfo, 'typ' | 'satzPromille' | 'abZeitraum'>> = {},
): KennzahlInfo {
  return Object.freeze({
    kz: `kz${nummer}` as Kennzahl,
    nummer,
    block,
    typ: extra.typ ?? 'kz',
    bedeutung,
    ...extra,
  });
}

/** Alle Kennzahlen in der Reihenfolge des XSD; Liste und Einträge sind eingefroren. */
export const KENNZAHLEN: readonly KennzahlInfo[] = Object.freeze([
  k('000', 'L', 'Gesamtbetrag der Bemessungsgrundlage für Lieferungen und sonstige Leistungen', {
    typ: 'kznull',
  }),
  k('001', 'L', 'Eigenverbrauch'),
  k('021', 'L', 'Umsätze mit Übergang der Steuerschuld auf den Leistungsempfänger (abzuziehen)'),
  k('011', 'STEUERFREI', 'steuerfrei mit Vorsteuerabzug: Ausfuhrlieferungen'),
  k('012', 'STEUERFREI', 'steuerfrei mit Vorsteuerabzug: Lohnveredelungen'),
  k('015', 'STEUERFREI', 'steuerfrei mit Vorsteuerabzug: § 6 Abs. 1 Z 2 bis 6, § 23 Abs. 5'),
  k('017', 'STEUERFREI', 'innergemeinschaftliche Lieferungen'),
  k('018', 'STEUERFREI', 'innergemeinschaftliche Lieferungen neuer Fahrzeuge ohne UID'),
  k('019', 'STEUERFREI', 'steuerfrei ohne Vorsteuerabzug: Grundstücksumsätze'),
  k('016', 'STEUERFREI', 'steuerfrei ohne Vorsteuerabzug: Kleinunternehmer'),
  k('020', 'STEUERFREI', 'übrige steuerfreie Umsätze ohne Vorsteuerabzug (mit VST)'),
  k('022', 'VERSTEUERT', 'Normalsteuersatz 20 %', { satzPromille: 200 }),
  k('124', 'VERSTEUERT', 'ermäßigter Steuersatz 4,9 %', { satzPromille: 49, abZeitraum: '2026-07' }),
  k('029', 'VERSTEUERT', 'ermäßigter Steuersatz 10 %', { satzPromille: 100 }),
  k('006', 'VERSTEUERT', 'ermäßigter Steuersatz 13 %', { satzPromille: 130 }),
  k('037', 'VERSTEUERT', 'Jungholz und Mittelberg 19 %', { satzPromille: 190 }),
  k('052', 'VERSTEUERT', 'Zusatzsteuer pauschalierte Land- und Forstwirtschaft 10 %', {
    satzPromille: 100,
  }),
  k('007', 'VERSTEUERT', 'Zusatzsteuer pauschalierte Land- und Forstwirtschaft 7 %', {
    satzPromille: 70,
  }),
  k('056', 'VERSTEUERT', 'Steuerschuld § 11 Abs. 12 und 14, § 16 Abs. 2, Art. 7 Abs. 4'),
  k('057', 'VERSTEUERT', 'Steuerschuld § 19 Abs. 1 zweiter Satz, Abs. 1c, 1e, Art. 25 Abs. 5'),
  k('048', 'VERSTEUERT', 'Steuerschuld § 19 Abs. 1a (Bauleistungen)'),
  k('044', 'VERSTEUERT', 'Steuerschuld § 19 Abs. 1b'),
  k('032', 'VERSTEUERT', 'Steuerschuld § 19 Abs. 1d'),
  k('070', 'IGE', 'Gesamtbetrag der Bemessungsgrundlagen innergemeinschaftliche Erwerbe', {
    typ: 'kznull',
  }),
  k('071', 'IGE', 'davon steuerfrei gemäß Art. 6 Abs. 2'),
  k('072', 'VERSTEUERT_IGE', 'innergemeinschaftliche Erwerbe 20 %', { satzPromille: 200 }),
  k('125', 'VERSTEUERT_IGE', 'innergemeinschaftliche Erwerbe 4,9 %', {
    satzPromille: 49,
    abZeitraum: '2026-07',
  }),
  k('073', 'VERSTEUERT_IGE', 'innergemeinschaftliche Erwerbe 10 %', { satzPromille: 100 }),
  k('008', 'VERSTEUERT_IGE', 'innergemeinschaftliche Erwerbe 13 %', { satzPromille: 130 }),
  k('088', 'VERSTEUERT_IGE', 'innergemeinschaftliche Erwerbe Jungholz und Mittelberg 19 %', {
    satzPromille: 190,
  }),
  k('076', 'VERSTEUERT_IGE', 'nicht zu versteuernde Erwerbe Art. 3 Abs. 8, im Bestimmungsland besteuert'),
  k('077', 'VERSTEUERT_IGE', 'nicht zu versteuernde Erwerbe Art. 3 Abs. 8, gelten im Inland als besteuert'),
  k('060', 'VORSTEUER', 'Gesamtbetrag der Vorsteuern'),
  k('061', 'VORSTEUER', 'Vorsteuern entrichtete Einfuhrumsatzsteuer'),
  k('083', 'VORSTEUER', 'Vorsteuern geschuldete, auf dem Abgabenkonto verbuchte Einfuhrumsatzsteuer'),
  k('065', 'VORSTEUER', 'Vorsteuern aus dem innergemeinschaftlichen Erwerb'),
  k('066', 'VORSTEUER', 'Vorsteuern zur Steuerschuld KZ 057'),
  k('082', 'VORSTEUER', 'Vorsteuern zur Steuerschuld KZ 048 (Bauleistungen)'),
  k('087', 'VORSTEUER', 'Vorsteuern zur Steuerschuld KZ 044'),
  k('089', 'VORSTEUER', 'Vorsteuern zur Steuerschuld KZ 032'),
  k('064', 'VORSTEUER', 'Vorsteuern für innergemeinschaftliche Lieferungen neuer Fahrzeuge'),
  k('062', 'VORSTEUER', 'davon nicht abzugsfähig (mindert die Vorsteuer)'),
  k('063', 'VORSTEUER', 'Berichtigung gemäß § 12 Abs. 10 und 11', { typ: 'kzvorz' }),
  k('067', 'VORSTEUER', 'Berichtigung gemäß § 16', { typ: 'kzvorz' }),
  k('090', 'VORSTEUER', 'sonstige Berichtigungen', { typ: 'kzvorz' }),
]);

const NACH_KZ: ReadonlyMap<string, KennzahlInfo> = new Map(KENNZAHLEN.map((info) => [info.kz, info]));

export function istKennzahl(s: string): s is Kennzahl {
  return NACH_KZ.has(s);
}

export function istSatzKennzahl(s: string): s is SatzKennzahl {
  return NACH_KZ.get(s)?.satzPromille !== undefined;
}

export function kennzahlInfo(kz: Kennzahl): KennzahlInfo {
  const info = NACH_KZ.get(kz);
  if (!info) throw new TypeError(`Unbekannte Kennzahl: ${kz}`);
  return info;
}
