import type { RohSatz } from './bestand';
import { EldaError } from './errors';
import { KINDERBLOECKE, kindfeld, VORZEICHEN_L1, type Lohnzettelversion } from './felder-e14';
import { L16_PRUEFKATALOG, type L16Regel } from './pruefkatalog-l16';

/**
 * Inhaltliche Prüfungen des Lohnzettels L16 nach dem Prüfkatalog des
 * Finanzministeriums (`pruefkatalog-l16.ts`, Version 09 vom 17.02.2026, „für
 * Lohnzettel mit Zeitraum ab 1.1.2026").
 *
 * **Umfang.** Nachgerechnet werden die Regeln, deren Bedingung der Katalog
 * eindeutig formuliert — Summenregeln, Plausibilitätsgrenzen, Abhängigkeiten
 * zwischen Feldern, die Lohnzettelarten-Einschränkungen und das Rechenblatt
 * `FC 7002, 7003 für KJ 2026`. {@link L16_GEPRUEFT} listet sie;
 * {@link L16_NICHT_GEPRUEFT} die übrigen Codes des Katalogs. Nicht dabei sind
 * insbesondere:
 *
 * - Format-, Wertebereichs- und Vorzeichenregeln („unzulässiger Wert",
 *   „Unzulässiges Vorzeichen"): Die stellt `erstelleLohnzettelBestand` beim
 *   Bau sicher.
 * - Regeln mit „auf Monate aliquotiert" (`F4802`, `F5205`, `F5402`, `F7402`,
 *   `F8202`, `F9121`) und `F7006`/`F7010`: Wie der Katalog aliquotiert, steht
 *   nicht dabei.
 * - Prüfziffern (Versicherungsnummer `F2001`/`KA20`, Steuernummer `F9991`):
 *   Die Verfahren stehen in keiner der verwendeten Quellen.
 * - `F7011`/`F7012`: ob sie `F7002`/`F7003` ersetzen oder ergänzen, sagt der
 *   Katalog nicht.
 *
 * **Bezugsdatum.** Regeln, die vom „laufenden Jahr" oder vom „aktuellen Datum
 * bei ELDA Eingang" sprechen (`F1702`, `F1703`, `F1705`, `F1706`), rechnen hier
 * mit dem Übermittlungsdatum DTUE des Lohnzettels — dem Tag, an dem die Datei
 * an ELDA geht.
 *
 * **Anwendbarkeit.** Jede Regel gilt nur für die Lohnzettelarten der Spalte
 * „Prfg. nur bei LZ-Art". Regeln mit `N` in der Spalte „Prfg. b.
 * Zeitraum-unterbrechg." entfallen, wenn ANME = `J`; ist die Zelle leer, gilt
 * die Regel immer. Bei unzulässiger Lohnzettelart meldet die Prüfung nur
 * `F1100` — welche Regeln dann anzuwenden wären, ist offen.
 *
 * **Version.** Der Katalog gilt für Version 28 (Zeiträume ab 2026). Für
 * Version 29 (Zeiträume ab 2027) liegt noch kein Katalog vor; die Prüfung
 * verweigert sie, statt den falschen anzuwenden.
 */

/** Ein Befund mit dem Code, den ELDA dafür zurückmelden würde. */
export interface LohnzettelBefund {
  /** Fehlercode laut Katalog, z. B. `'F7004'`; im Kinderblock `KA…` für Kind 1, `KB…` für Kind 2 usw. */
  code: string;
  /** Nummer des Lohnzettels in der Übermittlung, ab 1. */
  lohnzettel: number;
  /** Fehlerstatus laut Katalog, ungedeutet (`N`, `P`, `G` …). */
  status: string;
  /** Fehlerindikation laut Katalog, ungedeutet. */
  indikation: string;
  /** Fehlertext laut Blatt `Fehlertexte`. */
  meldung: string;
}

/** Lesezugriff auf einen Lohnzettel. Beträge in Cent, mit Vorzeichen. */
interface Kontext {
  w: Readonly<Record<string, string | undefined>>;
  info: Readonly<Record<string, string | undefined>>;
  version: Lohnzettelversion;
  artl: number;
}

function s(k: Kontext, name: string): string {
  return (k.w[name] ?? '').trim();
}

/** Ganzzahl eines numerischen Feldes; leer = 0. */
function n(k: Kontext, name: string): number {
  const wert = s(k, name);
  return wert === '' ? 0 : Number.parseInt(wert, 10);
}

/** Betrag in Cent samt Vorzeichen. */
function b(k: Kontext, name: string): number {
  const betrag = n(k, name);
  const regel = VORZEICHEN_L1[k.version][name];
  return regel !== undefined && s(k, regel.vorzeichen) === '-' ? -betrag : betrag;
}

function ja(k: Kontext, name: string): boolean {
  return s(k, name) === 'J';
}

/** Euro in Cent — die Grenzen des Katalogs stehen in Euro. */
function euro(betrag: number): number {
  return Math.round(betrag * 100);
}

/** TTMM + Jahr als Datum, oder `undefined` bei ungültigem Kalendertag. */
function datum(ttmm: string, jahr: number): Date | undefined {
  if (!/^\d{4}$/.test(ttmm)) return undefined;
  const tag = Number(ttmm.slice(0, 2));
  const monat = Number(ttmm.slice(2, 4));
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  return d.getUTCFullYear() === jahr && d.getUTCMonth() === monat - 1 && d.getUTCDate() === tag
    ? d
    : undefined;
}

/** JJJJMMTT als Datum. */
function datumJjjjmmtt(wert: string): Date | undefined {
  if (!/^\d{8}$/.test(wert)) return undefined;
  return datum(wert.slice(6, 8) + wert.slice(4, 6), Number(wert.slice(0, 4)));
}

/** TTMMJJJJ als Datum. */
function datumTtmmjjjj(wert: string): Date | undefined {
  if (!/^\d{8}$/.test(wert)) return undefined;
  return datum(wert.slice(0, 4), Number(wert.slice(4, 8)));
}

/** Kalendertage des Lohnzahlungszeitraums, Beginn und Ende eingeschlossen. */
function tage(k: Kontext): number | undefined {
  const jahr = n(k, 'JALZ');
  const von = datum(s(k, 'BELZ'), jahr);
  const bis = datum(s(k, 'ENLZ'), jahr);
  if (von === undefined || bis === undefined || bis < von) return undefined;
  return Math.round((bis.getTime() - von.getTime()) / 86_400_000) + 1;
}

/** Zulässige Lohnzettelarten laut `F1100`. */
const LOHNZETTELARTEN = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);

/** Finanzamtsnummern laut `F9901`. */
const FINANZAMT = new Set(
  '03,04,06,07,08,09,11,12,15,16,18,22,23,29,33,38,41,46,51,52,53,54,57,59,61,65,67,68,69,71,72,81,82,83,84,90,91,93,97,98'.split(
    ',',
  ),
);

/**
 * Rechenblatt `FC 7002, 7003 für KJ 2026`: die „Jahressteuer nach Tarif"
 * (SUMME I), gegen die KZ 260 geprüft wird. Beträge in Euro, wie im Blatt.
 *
 * Für eine Bemessungsgrundlage der sonstigen Bezüge bis 2.615 € enthält das
 * Blatt keine Zeile — dann liefert die Funktion `undefined`, und die Prüfung
 * entfällt.
 */
export function jahressteuerNachRechenblatt2026(e: {
  kz220: number;
  kz225: number;
  kz245: number;
  freibetrag105: number;
  freibetrag35: number;
  sozialeStellung: number;
  tage: number;
  avabOderAeab: boolean;
  kinder: number;
  erhoehterPab: boolean;
  pendlerpauschale: number;
  fabo: number;
}): number | undefined {
  const bmg = e.kz220 - e.kz225;
  let steuerSonstige: number;
  let ueberhang = 0;
  if (bmg > 2615 && bmg <= 25000) {
    steuerSonstige = Math.min((bmg - 620) * 0.06, (bmg - 2490) * 0.3);
  } else if (bmg > 25000 && bmg <= 50000) {
    steuerSonstige = (bmg - 25000) * 0.27 + 1462.8;
  } else if (bmg > 50000 && bmg <= 83333) {
    steuerSonstige = (bmg - 50000) * 0.3575 + 8212.8;
  } else if (bmg > 83333) {
    steuerSonstige = 20129.3475;
    ueberhang = bmg - 83333;
  } else {
    return undefined;
  }

  const faktor = e.tage / 365;
  const summeA = (e.kz245 + ueberhang - e.freibetrag105 - e.freibetrag35) / faktor;
  const summeB = e.sozialeStellung < 6 ? summeA - 132 : summeA;

  let summeH: number;
  if (summeB <= 13539) summeH = 0;
  else if (summeB <= 21992) summeH = (summeB - 13539) * 0.2;
  else if (summeB <= 36458) summeH = (summeB - 21992) * 0.3 + 1690.6;
  else if (summeB <= 70365) summeH = (summeB - 36458) * 0.4 + 6030.4;
  else if (summeB <= 104859) summeH = (summeB - 70365) * 0.48 + 19593.2;
  else if (summeB <= 1000000) summeH = (summeB - 104859) * 0.5 + 36150.32;
  else summeH = (summeB - 1000000) * 0.55 + 483720.82;

  // „SUMME H - FABO Plus Betrag darf nicht negativ sein"
  let steuer = Math.max(0, summeH - e.fabo);

  if (e.avabOderAeab) {
    if (e.kinder === 1) steuer -= 612;
    else if (e.kinder === 2) steuer -= 828;
    else if (e.kinder > 2) steuer -= 828 + 273 * (e.kinder - 2);
  }

  if (e.sozialeStellung < 6) {
    if (e.pendlerpauschale > 0) {
      if (summeA <= 15069) steuer -= 853;
      else if (summeA >= 16056) steuer -= 496;
      else steuer -= ((16056 - summeA) * 357) / 987 + 496;
    } else {
      steuer -= 496;
    }
  } else if (e.erhoehterPab) {
    if (summeA < 24616) steuer -= 1502;
    else if (summeA < 31494) steuer -= ((31494 - summeA) * 1502) / 6878;
  } else {
    if (summeA < 21614) steuer -= 1020;
    else if (summeA < 31494) steuer -= ((31494 - summeA) * 1020) / 9880;
  }

  // „nicht kleiner 0 und aliquot (außer Steuer sonstige Bezüge)"
  return Math.max(0, steuer) * faktor + steuerSonstige;
}

/** Ergebnis des Rechenblatts für einen Lohnzettel: ob `F7002` oder `F7003` anschlägt. */
function rechenblatt(k: Kontext): { f7002: boolean; f7003: boolean } | undefined {
  if (n(k, 'JALZ') !== 2026) return undefined;
  const dauer = tage(k);
  if (dauer === undefined) return undefined;
  const summeI = jahressteuerNachRechenblatt2026({
    kz220: b(k, 'B220') / 100,
    kz225: b(k, 'B225') / 100,
    kz245: b(k, 'B245') / 100,
    freibetrag105: b(k, 'BFB1') / 100,
    freibetrag35: b(k, 'BFB3') / 100,
    sozialeStellung: n(k, 'SOZS'),
    tage: dauer,
    avabOderAeab: ja(k, 'AVAB') || ja(k, 'AEAB'),
    kinder: n(k, 'ANZK'),
    erhoehterPab: ja(k, 'EPAB'),
    pendlerpauschale: b(k, 'BPEN') / 100,
    fabo: b(k, 'FABO') / 100,
  });
  if (summeI === undefined) return undefined;
  const summeF = summeI * 0.1 < 730 ? -730 : summeI * -0.1;
  const summeG = summeI * 0.25 < 730 ? 730 : summeI * 0.25;
  const differenz = b(k, 'B260') / 100 - summeI;
  return { f7002: differenz < summeF, f7003: differenz > summeG };
}

/** „ungleich 'blank' oder 0" bei Betragsfeldern. */
function belegt(k: Kontext, name: string): boolean {
  return b(k, name) !== 0;
}

/** Bedingungen der Regeln — wörtlich nach der Spalte „Fehler wenn". */
const REGELN: Readonly<Record<string, (k: Kontext) => boolean>> = {
  // Referenznummer: „'blank'"
  F1000: (k) => s(k, 'REFN') === '',
  // „Feld 99 ^=09 und Feld 100 ^= 5314563" — Steuernummer der BUAK
  F1101: (k) => s(k, 'STNRA') !== '095314563',
  F1500: (k) => {
    const t = Number(s(k, 'BELZ').slice(0, 2));
    return !(t >= 1 && t <= 31);
  },
  F1501: (k) => {
    const m = Number(s(k, 'BELZ').slice(2, 4));
    return !(m >= 1 && m <= 12);
  },
  F1600: (k) => {
    const t = Number(s(k, 'ENLZ').slice(0, 2));
    return !(t >= 1 && t <= 31);
  },
  F1601: (k) => {
    const m = Number(s(k, 'ENLZ').slice(2, 4));
    return !(m >= 1 && m <= 12);
  },
  // Kapitel D.32: „Das Ende des Lohnzahlungszeitraumes … muss größer als der Beginn … sein."
  // Gemeldet wird nur ein Ende VOR dem Beginn; ob ein eintägiger Zeitraum zulässig ist, lässt
  // die Katalogzeile („Feld 15< = Feld 16") offen.
  F1603: (k) => {
    const jahr = n(k, 'JALZ');
    const von = datum(s(k, 'BELZ'), jahr);
    const bis = datum(s(k, 'ENLZ'), jahr);
    return von !== undefined && bis !== undefined && bis < von;
  },
  F1700: (k) => n(k, 'JALZ') < 2002,
  F1702: (k) => {
    const dtue = datumJjjjmmtt(s(k, 'DTUE'));
    return dtue !== undefined && n(k, 'JALZ') > dtue.getUTCFullYear();
  },
  // „Datum (Feld 16 u. Feld 17) > Datum (Feld 8) + 2 Monate (Toleranz)"
  F1703: (k) => {
    const dtue = datumJjjjmmtt(s(k, 'DTUE'));
    const ende = datum(s(k, 'ENLZ'), n(k, 'JALZ'));
    if (dtue === undefined || ende === undefined) return false;
    const grenze = new Date(Date.UTC(dtue.getUTCFullYear(), dtue.getUTCMonth() + 2, dtue.getUTCDate()));
    return ende > grenze;
  },
  F1704: (k) => s(k, 'JALZ') !== (k.info.JAHR ?? '').trim(),
  // „Wenn Feld 17 < Vorjahr - 10"
  F1705: (k) => {
    const dtue = datumJjjjmmtt(s(k, 'DTUE'));
    return dtue !== undefined && n(k, 'JALZ') < dtue.getUTCFullYear() - 1 - 10;
  },
  // „(Feld 17 < laufendes Jahr) und (aktuelles Datum bei ELDA Eingang > 30.04.) und (Korrekturinidkator ungleich "A")"
  F1706: (k) => {
    const dtue = datumJjjjmmtt(s(k, 'DTUE'));
    if (dtue === undefined) return false;
    const jahr = dtue.getUTCFullYear();
    return n(k, 'JALZ') < jahr && dtue > new Date(Date.UTC(jahr, 3, 30)) && s(k, 'KORR') !== 'A';
  },
  F1800: (k) => !/^[0-8]$/.test(s(k, 'SOZS')),
  F1803: (k) => !/^[0-5]$/.test(s(k, 'SOZS')),
  F1900: (k) => {
    const lfnr = n(k, 'AVLN');
    return lfnr !== 0 && lfnr < 1000;
  },
  F2700: (k) => !['', 'J', 'N'].includes(s(k, 'GESW')),
  F2800: (k) => !['', 'J', 'N'].includes(s(k, 'GESM')),
  F2891: (k) => !['', 'J', 'N'].includes(s(k, 'GESD')),
  F2801: (k) => ['GESW', 'GESM', 'GESD'].filter((f) => ja(k, f)).length !== 1,
  F2900: (k) => !['', 'J', 'N'].includes(s(k, 'VOLL')),
  F3000: (k) => !['', 'J', 'N'].includes(s(k, 'TEIL')),
  F3001: (k) => ja(k, 'VOLL') === ja(k, 'TEIL'),
  F3100: (k) => !['', 'J', 'N'].includes(s(k, 'AVAB')),
  // „‘J’ und Feld 33 gleich ‘blank’" — Feld 33 ist PGBD
  F3101: (k) => ja(k, 'AVAB') && n(k, 'PGBD') === 0,
  F3102: (k) => ja(k, 'AVAB') && n(k, 'ANZK') < 1,
  F3400: (k) => !['', 'J', 'N'].includes(s(k, 'AEAB')),
  F3401: (k) => ja(k, 'AEAB') && n(k, 'ANZK') < 1,
  // „Feld 36 'blank' oder 0 und Feld 64 und Feld 70 ungleich 'blank' oder 0"
  F3601: (k) => !belegt(k, 'B210') && belegt(k, 'B245') && belegt(k, 'B260'),
  F3603: (k) => b(k, 'B210') < b(k, 'BSBKFZ') + b(k, 'BSBWR') + b(k, 'BSBSB'),
  F3801: (k) => belegt(k, 'B215'),
  F3803: (k) => [6, 7, 8].includes(n(k, 'SOZS')) && belegt(k, 'B215'),
  F3804: (k) => b(k, 'B215') > 0,
  F3805: (k) => b(k, 'B215') > euro(9300),
  F3806: (k) => b(k, 'B215') !== b(k, 'SB681') + b(k, 'SB682'),
  // „Betrag ist nicht 14,29 % der KZ 210 (Toleranz +/- € 10)"
  F4004: (k) => Math.abs(b(k, 'B220') - b(k, 'B210') * 0.1429) > euro(10),
  // „Feld 16 = '3112' und Feld 40 > (Feld 36 - Feld 40 - Feld 58 - Feld 72)/6 (Toleranz +€ 100,-)"
  F9330: (k) =>
    s(k, 'ENLZ') === '3112' &&
    b(k, 'B220') > (b(k, 'B210') - b(k, 'B220') - b(k, 'BSTF') - b(k, 'BSOB')) / 6 + euro(100),
  F4201: (k) => belegt(k, 'BIEB'),
  F4202: (k) => b(k, 'BIEB') < b(k, 'B225') + b(k, 'B226'),
  // Regeln zu Feld 44 (KZ 225) — sie setzen eine belegte KZ 225 voraus.
  F4400: (k) => belegt(k, 'B225') && !belegt(k, 'B220') && !belegt(k, 'BIEB'),
  F4405: (k) => belegt(k, 'B225') && !belegt(k, 'BIEB'),
  F4402: (k) => belegt(k, 'B225'),
  F4600: (k) => belegt(k, 'B226') && !belegt(k, 'BIEB'),
  F4603: (k) => belegt(k, 'B226') && !belegt(k, 'BSTF') && !belegt(k, 'MAGB') && !belegt(k, 'MAPR'),
  // „ungleich Feld 42 - Feld 44 - Feld 46 (+/- 1,00 Toleranz)"
  F4800: (k) => Math.abs(b(k, 'B230') - (b(k, 'BIEB') - b(k, 'B225') - b(k, 'B226'))) > 100,
  F5201: (k) => belegt(k, 'BAUS'),
  F5202: (k) => n(k, 'SOZS') > 5 && belegt(k, 'BAUS'),
  F5401: (k) => belegt(k, 'BPEN'),
  F5403: (k) => n(k, 'SOZS') > 5 && belegt(k, 'BPEN'),
  F5404: (k) => belegt(k, 'BPEN') && !belegt(k, 'BPEND'),
  F5601: (k) => belegt(k, 'BEFB'),
  F5602: (k) => b(k, 'BEFB') > b(k, 'B210') * 0.02,
  F5801: (k) => belegt(k, 'BSTF'),
  F5804: (k) =>
    (belegt(k, 'BSTF') || belegt(k, 'MAGB')) && b(k, 'BSTF') + b(k, 'MAGB') + b(k, 'MAPR') < b(k, 'B226'),
  F6002: (k) => b(k, 'BSSB') !== b(k, 'B210'),
  // Summenformel „2026" aus dem Blatt `FC 6201`, Toleranz ± 0,40 €.
  F6201: (k) =>
    Math.abs(
      [
        'BAUS',
        'BPEN',
        'BEFB',
        'BSTF',
        'BSSB',
        'ENTW',
        'PREI',
        'WBKB',
        'MAGB',
        'MAPR',
        'ZUKB',
        'BZUKG',
        'MAKBG',
        'MABST',
        'ZUCSG',
        'GUTSC',
        'MARAB',
      ].reduce((summe, f) => summe + b(k, f), 0) - b(k, 'B243'),
    ) > 40,
  // „Feld 36 - Feld 38 - Feld 40 - Feld 48 - Feld 62 ungleich Wert Feld 64 +/- 1,00 Toleranz"
  F6401: (k) =>
    Math.abs(b(k, 'B210') - b(k, 'B215') - b(k, 'B220') - b(k, 'B230') - b(k, 'B243') - b(k, 'B245')) > 100,
  F6402: (k) => b(k, 'ENTW') > 0 && belegt(k, 'B245'),
  F6403: (k) => !belegt(k, 'B245') && belegt(k, 'B260'),
  F6404: (k) => belegt(k, 'B245'),
  F6601: (k) => belegt(k, 'BIEL'),
  F6602: (k) => b(k, 'ENTW') > 0 && belegt(k, 'BIEL'),
  F6801: (k) => belegt(k, 'BABL'),
  F6802: (k) => belegt(k, 'BABL') && !belegt(k, 'BSTF'),
  F6803: (k) => b(k, 'BIEL') < b(k, 'BABL'),
  F7001: (k) => belegt(k, 'B260'),
  F7002: (k) => rechenblatt(k)?.f7002 === true,
  F7003: (k) => rechenblatt(k)?.f7003 === true,
  // „ungleich Wert Feld 66 - Feld 68 +/- 0,20 Toleranz"
  F7004: (k) => Math.abs(b(k, 'B260') - (b(k, 'BIEL') - b(k, 'BABL'))) > 20,
  F7005: (k) => b(k, 'B260') !== b(k, 'BIEL'),
  // „ungleich 15 % von (Feld 36 - Feld 48 - Feld 52 - Feld 58) +/- 3,00 Toleranz"
  F7008: (k) =>
    Math.abs(b(k, 'B260') - (b(k, 'B210') - b(k, 'B230') - b(k, 'BAUS') - b(k, 'BSTF')) * 0.15) > 300,
  F7009: (k) => b(k, 'ENTW') > 0 && belegt(k, 'B260'),
  F7013: (k) => belegt(k, 'B260'),
  F7201: (k) => belegt(k, 'BSOB'),
  F7202: (k) => b(k, 'BSOB') > b(k, 'B210') - b(k, 'B215') - b(k, 'B220'),
  F7401: (k) => belegt(k, 'BFB1'),
  F8001: (k) => belegt(k, 'BAUF'),
  F8002: (k) => b(k, 'BAUF') > euro(500),
  F8201: (k) => belegt(k, 'BFB3'),
  F8500: (k) => n(k, 'PVON') > 12,
  F8501: (k) => n(k, 'PVON') !== 0 && (!belegt(k, 'BPFG') || n(k, 'PBIS') === 0),
  F8600: (k) => n(k, 'PBIS') > 12,
  F8601: (k) => n(k, 'PBIS') !== 0 && (!belegt(k, 'BPFG') || n(k, 'PVON') === 0),
  F8602: (k) => n(k, 'PBIS') < n(k, 'PVON'),
  F8801: (k) => belegt(k, 'BPFG'),
  F8802: (k) => belegt(k, 'BPFG') && (n(k, 'PVON') === 0 || n(k, 'PBIS') === 0),
  F9001: (k) => belegt(k, 'BSFB'),
  F9002: (k) => n(k, 'SOZS') > 5 && belegt(k, 'BSFB'),
  // Steuernummer: FA-Teil (erste zwei Stellen) und STNR-Teil gleich dem Informationssatz
  F9900: (k) =>
    s(k, 'STNRA').padStart(9, '0').slice(0, 2) !== (k.info.STNRA ?? '').trim().padStart(9, '0').slice(0, 2),
  F9990: (k) =>
    s(k, 'STNRA').padStart(9, '0').slice(2) !== (k.info.STNRA ?? '').trim().padStart(9, '0').slice(2),
  F9901: (k) => !FINANZAMT.has(s(k, 'STNRA').padStart(9, '0').slice(0, 2)),
  F9020: (k) => !['', 'J', 'N'].includes(s(k, 'ANME')),
  F9030: (k) => !['', 'K', 'S', 'A'].includes(s(k, 'KORR')),
  F9031: (k) => s(k, 'KORR') === 'A',
  F9042: (k) => n(k, 'ANZK') > 0 && !ja(k, 'AVAB') && !ja(k, 'AEAB'),
  F9050: (k) => !['', 'J', 'N'].includes(s(k, 'EPAB')),
  F9051: (k) => ja(k, 'EPAB') && ja(k, 'AVAB'),
  F9052: (k) => ja(k, 'EPAB') && n(k, 'PGBD') === 0,
  F9071: (k) => belegt(k, 'ENTW'),
  F9072: (k) => b(k, 'ENTW') > 0 && n(k, 'SOZS') > 5,
  F9073: (k) => b(k, 'ENTW') > 0 && belegt(k, 'B245'),
  F9092: (k) => belegt(k, 'PREI'),
  F9093: (k) => b(k, 'PREI') > euro(8640),
  F9094: (k) => n(k, 'SOZS') > 5 && belegt(k, 'PREI'),
  F9100: (k) => n(k, 'WERK') > 12,
  F9101: (k) => n(k, 'SOZS') > 5 && n(k, 'WERK') !== 0,
  F9122: (k) => belegt(k, 'BPEND') && !belegt(k, 'BPEN') && !belegt(k, 'KOUN'),
  F9123: (k) => belegt(k, 'BPEND'),
  F9130: (k) => n(k, 'UEBMO') > 12,
  F9161: (k) => s(k, 'KORR') !== 'S' && s(k, 'LDKZA') === '',
  F9172: (k) => b(k, 'WBKB') > euro(10000) + euro(10),
  F9173: (k) => b(k, 'WBKB') > b(k, 'B210') * 0.2 + euro(10),
  F9190: (k) => !['', 'J', 'N'].includes(s(k, 'ERVAB')),
  F9191: (k) => !['', 'N'].includes(s(k, 'ERVAB')),
  F9192: (k) => ja(k, 'ERVAB') && b(k, 'B245') > euro(16056),
  F9193: (k) => !belegt(k, 'BPEN') && ja(k, 'ERVAB'),
  F9200: (k) => !['', 'J', 'N'].includes(s(k, 'BFABO')),
  F9201: (k) => !['', 'N'].includes(s(k, 'BFABO')),
  F9202: (k) => ja(k, 'BFABO') && n(k, 'KFABO') === 0,
  F9211: (k) => n(k, 'KFABO') > 0 && !ja(k, 'BFABO'),
  F9212: (k) => n(k, 'KFABO') !== 0,
  // „Feld 143 stimmt nicht mit Anzahl der Kinderblöcke überein (Prüfung jeweils ob Feld "Kind Familienname" ausgefüllt ist)"
  F9213: (k) => n(k, 'KFABO') !== kinder(k).length,
  // „Wenn Feld 145 > FABO Kind 1 (166,68 * Anzahl Monate ganzer Fabo … + 83,34 * Anzahl Monate halber Fabo …) plus FABO weitere Kinder"
  F9230: (k) => {
    let hoechst = 0;
    for (const i of kinder(k)) {
      const ganz =
        n(k, kindfeld('KBGFP', i)) > 0 ? n(k, kindfeld('KEGFP', i)) - n(k, kindfeld('KBGFP', i)) + 1 : 0;
      const halb =
        n(k, kindfeld('KBHFP', i)) > 0 ? n(k, kindfeld('KEHFP', i)) - n(k, kindfeld('KBHFP', i)) + 1 : 0;
      hoechst += 16668 * ganz + 8334 * halb;
    }
    return b(k, 'FABO') > hoechst;
  },
  F9410: (k) => {
    const dauer = tage(k);
    return dauer !== undefined && n(k, 'HOTA') > dauer;
  },
  F9431: (k) => b(k, 'HOPA') > 0 && n(k, 'HOTA') === 0,
  F9432: (k) => b(k, 'HOPA') > euro(300),
  F9433: (k) => n(k, 'HOTA') > 0 && b(k, 'HOPA') > n(k, 'HOTA') * euro(3),
  F9480: (k) => b(k, 'MAGB') > euro(3000),
  F9490: (k) => belegt(k, 'MAGB'),
  F9500: (k) => belegt(k, 'MAGB') && n(k, 'JALZ') < 2022,
  F9510: (k) => b(k, 'MAGB') > b(k, 'B210'),
  F9520: (k) => !['', 'J', 'N'].includes(s(k, 'FLABZ')),
  F9530: (k) => !['', 'J', 'N'].includes(s(k, 'AUEZG')),
  F9531: (k) => !['', 'N'].includes(s(k, 'AUEZG')) && ![6, 7, 8].includes(n(k, 'SOZS')),
  F9532: (k) => !['', 'N'].includes(s(k, 'AUEZG')) && n(k, 'JALZ') !== 2022,
  F9551: (k) => b(k, 'MAGB') + b(k, 'TEPR') > euro(3000),
  F9552: (k) => belegt(k, 'TEPR'),
  F9553: (k) => belegt(k, 'TEPR') && (n(k, 'JALZ') < 2022 || n(k, 'JALZ') > 2023),
  F9554: (k) => b(k, 'TEPR') > b(k, 'B210'),
  F9571: (k) => b(k, 'MAGB') + b(k, 'MAPR') > euro(3000) && b(k, 'MAGB') <= euro(3000),
  F9572: (k) => belegt(k, 'MAPR'),
  // `F9573` fehlt bewusst: Der Katalog führt „Feld 17 < 2024 oder > 2024", der Fehlertext
  // nennt die Mitarbeiterprämie 2024 und 2025, und `F9575` prüft ausdrücklich Jahre nach
  // 2024. Wörtlich genommen schlüge die Regel 2026 bei jeder Mitarbeiterprämie an.
  F9574: (k) => b(k, 'MAPR') > b(k, 'B210'),
  F9575: (k) => b(k, 'MAPR') > euro(1000) && n(k, 'JALZ') > 2024,
  F9581: (k) => n(k, 'STUM') !== 0,
  // Prozentfelder: „Erste zwei Stellen Vorkommastellen, letzte zwei Stellen sind Nachkommastellen"
  F9582: (k) => n(k, 'STUM') > 1000,
  F9583: (k) => n(k, 'STUM') !== 0 && n(k, 'STUMJ') === 0,
  F9591: (k) => n(k, 'STUMJ') !== 0,
  F9592: (k) => n(k, 'STUMJ') > 1000,
  F9600: (k) => !['', 'J', 'N'].includes(s(k, 'ZF673')),
  F9601: (k) => !['', 'N'].includes(s(k, 'ZF673')),
  F9602: (k) => ja(k, 'ZF673') && !belegt(k, 'FSVB') && !belegt(k, 'BSTF'),
  F9610: (k) => !['', 'J', 'N'].includes(s(k, 'BDOZ')),
  F9611: (k) => !['', 'N'].includes(s(k, 'BDOZ')),
  F9612: (k) => ja(k, 'BDOZ') && belegt(k, 'FSVB'),
  F9622: (k) => belegt(k, 'FSVB'),
  F9623: (k) => belegt(k, 'FSVB') && b(k, 'BSOB') < b(k, 'FSVB') / 3,
  F9624: (k) => belegt(k, 'FSVB') && b(k, 'BABL') < b(k, 'FSVB') * 0.275,
  F9630: (k) => !['', 'J', 'N'].includes(s(k, 'PLST')),
  F9631: (k) => !['', 'N'].includes(s(k, 'PLST')),
  F9632: (k) => ja(k, 'PLST') && b(k, 'BIEL') < b(k, 'B210') * 0.2,
  F9633: (k) => ja(k, 'PLST') && (ja(k, 'AVAB') || ja(k, 'AEAB') || ja(k, 'BFABO') || ja(k, 'EPAB')),
  F9651: (k) => belegt(k, 'KAKL'),
  F9652: (k) => belegt(k, 'KAKL') && n(k, 'JALZ') !== 2025,
  F9671: (k) => b(k, 'ZUKB') > euro(2000) * n(k, 'AKZKB'),
  F9672: (k) => belegt(k, 'ZUKB'),
  F9673: (k) => b(k, 'ZUKB') > b(k, 'B210'),
  F9674: (k) => belegt(k, 'ZUKB') && n(k, 'JALZ') < 2025,
  F9680: (k) => ungueltigOderZukuenftig(k, 'GEBD'),
  F9690: (k) => ungueltigOderZukuenftig(k, 'GEBP'),
  F9705: (k) => {
    const kfz = ['SBK00', 'SBK15', 'SBK20', 'SBKDW'];
    return (
      (b(k, 'BSBKFZ') > 0 && kfz.every((f) => !ja(k, f))) ||
      (b(k, 'BSBKFZ') === 0 && kfz.some((f) => ja(k, f)))
    );
  },
  F9710: (k) => b(k, 'SB681') > euro(7200),
  F9715: (k) => b(k, 'SB682') > euro(2100),
  F9720: (k) => b(k, 'BZUKG') > euro(300),
  F9725: (k) => b(k, 'MAKBG') > euro(3000),
  F9730: (k) => b(k, 'MABST') > euro(4500),
  F9735: (k) => b(k, 'ZUCSG') > euro(200),
  F9740: (k) => b(k, 'GUTSC') > euro(2928),
  F9743: (k) => b(k, 'MARAB') > euro(1000),
  F9745: (k) => !['', 'J', 'N'].includes(s(k, 'SBK00')),
  F9750: (k) => !['', 'J', 'N'].includes(s(k, 'SBK15')),
  F9755: (k) => !['', 'J', 'N'].includes(s(k, 'SBK20')),
  F9760: (k) => !['', 'J', 'N'].includes(s(k, 'SBKDW')),
  F9765: (k) =>
    ['SBK00', 'SBK15', 'SBK20', 'SBKDW'].some((f) => ja(k, f)) &&
    !belegt(k, 'AKKFZ') &&
    s(k, 'ENLZ') === '3112',
  F9770: (k) => belegt(k, 'KEAKFZ') && !ja(k, 'SBK00') && !ja(k, 'SBKDW'),
  F9771: (k) => belegt(k, 'KEAKFZ') && n(k, 'JALZ') < 2026,
  F9775: (k) => belegt(k, 'AGLAG') && !ja(k, 'SBK00') && !ja(k, 'SBKDW'),
  F9780: (k) => b(k, 'AGLAG') > euro(2000),
  F9781: (k) => belegt(k, 'AGLAG') && n(k, 'JALZ') < 2026,
};

/** Nummern der Kinderblöcke, deren Familienname ausgefüllt ist (so zählt `F9213`). */
function kinder(k: Kontext): number[] {
  const nummern: number[] = [];
  for (let i = 1; i <= KINDERBLOECKE; i++) {
    if (s(k, kindfeld('KFAM', i)) !== '') nummern.push(i);
  }
  return nummern;
}

function ungueltigOderZukuenftig(k: Kontext, name: string): boolean {
  const wert = s(k, name);
  if (wert === '' || /^0+$/.test(wert)) return false;
  const d = datumTtmmjjjj(wert);
  const dtue = datumJjjjmmtt(s(k, 'DTUE'));
  return d === undefined || (dtue !== undefined && d > dtue);
}

/**
 * Regeln des Kinderblocks, je Kind. Der Katalog führt sie für Kind 1 mit `KA…`;
 * „Die Fehlercodenummern der Kinder beginnen mit "K" gefolgt vom Kinderblock
 * "A" = Block 1, "B" = Block 2 etc."
 */
const KINDREGELN: Readonly<Record<string, (k: Kontext, f: (name: string) => string) => boolean>> = {
  // „wenn Feld 1500 'blank' und Feld 1501 bis Feld 1512 ungleich 'blank'"
  KA02: (k, f) =>
    s(k, f('KFAM')) === '' &&
    [
      'KVON',
      'KSTAAT',
      'KSTWE',
      'KVSNR',
      'KGEBD',
      'KAFBZ',
      'KAPFB',
      'KAUHZ',
      'KBGFP',
      'KEGFP',
      'KBHFP',
      'KEHFP',
    ].some((name) => !['', '0', '00', '0000000000', '00000000'].includes(s(k, f(name)))),
  KA11: (k, f) => s(k, f('KSTAAT')) === 'A' && n(k, f('KVSNR')) === 0,
  KA12: (k, f) => s(k, f('KFAM')) !== '' && s(k, f('KSTAAT')) === '',
  KA15: (k, f) => !['', 'J', 'N'].includes(s(k, f('KSTWE'))),
  KA21: (k, f) => s(k, f('KSTAAT')) === 'A' && n(k, f('KVSNR')) === 0,
  KA30: (k, f) => !['', 'J', 'N'].includes(s(k, f('KAFBZ'))),
  KA31: (k, f) => ja(k, f('KAFBZ')) && (ja(k, f('KAPFB')) || ja(k, f('KAUHZ'))),
  KA35: (k, f) => !['', 'J', 'N'].includes(s(k, f('KAPFB'))),
  KA36: (k, f) => ja(k, f('KAPFB')) && (ja(k, f('KAFBZ')) || ja(k, f('KAUHZ'))),
  KA40: (k, f) => !['', 'J', 'N'].includes(s(k, f('KAUHZ'))),
  KA41: (k, f) => ja(k, f('KAUHZ')) && (ja(k, f('KAFBZ')) || ja(k, f('KAPFB'))),
  KA42: (k, f) => s(k, f('KFAM')) !== '' && !ja(k, f('KAFBZ')) && !ja(k, f('KAPFB')) && !ja(k, f('KAUHZ')),
  KA45: (k, f) => n(k, 'JALZ') > 2018 && ja(k, 'BFABO') && n(k, f('KBGFP')) > 12,
  KA50: (k, f) => n(k, 'JALZ') > 2018 && ja(k, 'BFABO') && n(k, f('KEGFP')) > 12,
  KA51: (k, f) => n(k, f('KEGFP')) < n(k, f('KBGFP')),
  KA55: (k, f) => n(k, 'JALZ') > 2018 && ja(k, 'BFABO') && n(k, f('KBHFP')) > 12,
  KA60: (k, f) => n(k, 'JALZ') > 2018 && ja(k, 'BFABO') && n(k, f('KEHFP')) > 12,
  KA61: (k, f) => n(k, f('KEHFP')) < n(k, f('KBHFP')),
  KA62: (k, f) => {
    const ganz = n(k, f('KBGFP')) > 0 ? n(k, f('KEGFP')) - n(k, f('KBGFP')) + 1 : 0;
    const halb = n(k, f('KBHFP')) > 0 ? n(k, f('KEHFP')) - n(k, f('KBHFP')) + 1 : 0;
    return ganz + halb > 12;
  },
  KA63: (k, f) => s(k, f('KFAM')) !== '' && n(k, f('KBGFP')) === 0 && n(k, f('KBHFP')) === 0,
};

/** Codes des Katalogs, die `pruefeLohnzettel` nachrechnet. */
export const L16_GEPRUEFT: readonly string[] = [...Object.keys(REGELN), ...Object.keys(KINDREGELN)];

/** Codes des Katalogs, die `pruefeLohnzettel` nicht nachrechnet. */
export const L16_NICHT_GEPRUEFT: readonly string[] = [...L16_PRUEFKATALOG.keys()].filter(
  (code) => !L16_GEPRUEFT.includes(code),
);

function anwendbar(regel: L16Regel, k: Kontext): boolean {
  if (!regel.lzArten.includes(k.artl)) return false;
  if (regel.unterbrechung === 'N' && ja(k, 'ANME')) return false;
  return true;
}

function befund(regel: L16Regel, code: string, lohnzettel: number): LohnzettelBefund {
  return {
    code,
    lohnzettel,
    status: regel.status,
    indikation: regel.indikation,
    meldung: regel.text ?? '',
  };
}

/**
 * Prüft Informationssatz und Lohnzettel gegen die nachgerechneten Regeln des
 * Prüfkatalogs.
 *
 * @param saetze die Satzfolge aus `lohnzettelSaetze` — ein `I1`, danach die `L1`.
 * @returns alle Befunde; ein leeres Array heißt: keine der nachgerechneten
 *   Regeln schlägt an. Das ist keine Zusage, dass ELDA den Lohnzettel annimmt.
 */
export function pruefeLohnzettel(saetze: readonly RohSatz[], version: Lohnzettelversion): LohnzettelBefund[] {
  if (version !== '28') {
    throw new EldaError(
      `Für Lohnzettelversion ${version} liegt kein Prüfkatalog vor; der verwendete gilt für Zeiträume ab ` +
        '2026 und damit für Version 28.',
    );
  }
  const info = saetze[0];
  if (info === undefined || info.satzart !== 'I1') {
    throw new EldaError('Die Satzfolge muss mit dem Informationssatz (I1) beginnen.');
  }
  const befunde: LohnzettelBefund[] = [];
  saetze.slice(1).forEach((satz, i) => {
    if (satz.satzart !== 'L1') {
      throw new EldaError(`Satz ${i + 2}: Satzart ${satz.satzart} ist kein Lohnzettel (L1).`);
    }
    const nummer = i + 1;
    const artl = Number.parseInt((satz.werte.ARTL ?? '').trim(), 10);
    const k: Kontext = { w: satz.werte, info: info.werte, version, artl };
    if (!LOHNZETTELARTEN.has(artl)) {
      befunde.push(befund(L16_PRUEFKATALOG.get('F1100')!, 'F1100', nummer));
      return;
    }
    for (const [code, wenn] of Object.entries(REGELN)) {
      const regel = L16_PRUEFKATALOG.get(code)!;
      if (anwendbar(regel, k) && wenn(k)) befunde.push(befund(regel, code, nummer));
    }
    for (const kind of range(KINDERBLOECKE)) {
      const buchstabe = String.fromCharCode(64 + kind);
      const f = (name: string): string => kindfeld(name, kind);
      for (const [code, wenn] of Object.entries(KINDREGELN)) {
        const regel = L16_PRUEFKATALOG.get(code)!;
        if (anwendbar(regel, k) && wenn(k, f))
          befunde.push(befund(regel, `K${buchstabe}${code.slice(2)}`, nummer));
      }
    }
  });
  return befunde;
}

function range(bis: number): number[] {
  return Array.from({ length: bis }, (_, i) => i + 1);
}
