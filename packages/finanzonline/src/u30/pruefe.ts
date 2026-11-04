import { FonError } from '@kreiseck/finanzonline-core';
import { steuerFuerSatz } from './berechne';
import type { U30Fehler, U30FehlerCode } from './fehler';
import { istKennzahl, istSatzKennzahl, kennzahlInfo, type Kennzahl } from './kennzahlen';
import { schnappschuss } from './schnappschuss';
import type { U30Erklaerung, U30Paket } from './typen';
import { laufenderMonat, zrVonBis } from './zeitraum';

const MAX_BETRAG = 999_999_999_999_999; // 9.999.999.999.999,99 € laut XSD
const MAX_NR = 999_999_999;
const MAX_ERKLAERUNGEN = 9999;
const MAX_KUNDENINFO = 50;
const VST_MUSTER = /^[0-9][0-9,a-zA-Z]{0,3}$/; // XSD: [0-9]{1}[0-9,a-z,A-Z]{0,3}
const ERSTER_ZEITRAUM = '2022-01'; // ältere Zeiträume haben ein anderes Schema (KZ 009/010)
const PAKET_FELDER = new Set(['paketNr', 'uebermittler', 'erklaerungen', 'erstellt']);
const ERKLAERUNG_FELDER = new Set([
  'steuernummer',
  'zeitraum',
  'kennzahlen',
  'vst',
  'ueberschussVerwenden',
  'rechnungskopien',
  'kundeninfo',
  'berichtigung',
  'erwarteteSteuer',
  'satzNr',
]);

/** Betrag in Cent als deutscher Euro-Text, z. B. 297819 → `2.978,19`. */
export function euro(cent: number): string {
  const neg = cent < 0;
  const betrag = Math.abs(cent);
  const ganz = Math.floor(betrag / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${ganz},${String(betrag % 100).padStart(2, '0')}`;
}

function istGueltigesDatum(v: unknown): v is Date {
  return v instanceof Date && !Number.isNaN(v.getTime());
}

const istObjekt = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function istNr(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_NR;
}

/** Luhn-Prüfziffer über alle 9 Stellen (wie `@kreiseck/validator` TaxNumber). */
function luhn(ziffern: string): boolean {
  let summe = 0;
  for (let i = 0; i < ziffern.length; i++) {
    let d = ziffern.charCodeAt(ziffern.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    summe += d;
  }
  return summe % 10 === 0;
}

function steuernummerBefund(s: unknown): 'ungueltig' | 'pruefziffer' | undefined {
  if (typeof s !== 'string' || !/^\d{9}$/.test(s)) return 'ungueltig';
  const n = Number(s);
  if (n < 10_000_010 || n > 989_999_999) return 'ungueltig';
  return luhn(s) ? undefined : 'pruefziffer';
}

function erlaubtesZeichen(codepoint: number): boolean {
  return (codepoint >= 0x20 && codepoint <= 0x7e) || (codepoint >= 0xa0 && codepoint <= 0xff);
}

/** Satznummer einer Erklärung: die angegebene oder die Position (1, 2, …). */
export function effektiveSatzNr(paket: U30Paket, index: number): number {
  return paket.erklaerungen[index]?.satzNr ?? index + 1;
}

/** IDENTIFIKATIONSBEGRIFF: `uebermittler` oder die gemeinsame Steuernummer aller Erklärungen. */
export function effektiverUebermittler(paket: U30Paket): string | undefined {
  if (paket.uebermittler !== undefined) return paket.uebermittler;
  const nummern = Array.isArray(paket.erklaerungen) ? paket.erklaerungen.map((e) => e?.steuernummer) : [];
  const erste = nummern[0];
  return typeof erste === 'string' && nummern.every((n) => n === erste) ? erste : undefined;
}

type Melde = (code: U30FehlerCode, nachricht: string, extra?: Omit<U30Fehler, 'code' | 'nachricht'>) => void;

const kzText = (kz: Kennzahl): string => `KZ ${kennzahlInfo(kz).nummer}`;

/**
 * Prüft ein U30-Paket vollständig, ohne Netz. Liefert **alle** Befunde (leer =
 * gültig) und wirft nur, wenn `optionen.jetzt` kein gültiges Datum ist. Nur
 * `undefined` heißt „nicht angegeben"; `null` oder ein falscher Typ ist ein Befund. Geprüft werden Form (Nummern, Steuernummer mit
 * Prüfziffer, Zeitraum, Wertebereiche, Vorzeichen, Zeichensatz), die
 * BMF-Prüfregeln „Prüfungen UVA ab 7/2026" und optional die erwartete Steuer
 * je Satz. Nicht prüfbar (das weiß nur FinanzOnline): bereits eingebracht,
 * Umsatzsteuersignal, Monat/Quartal passend zum Unternehmen.
 *
 * `jetzt` (Standard: aktuelle Zeit) bestimmt laufenden Monat und laufendes
 * Jahr in Wiener Zeit.
 */
export function pruefeU30(eingabe: U30Paket, optionen?: { jetzt?: Date }): U30Fehler[] {
  const paket = schnappschuss(eingabe);
  const fehler: U30Fehler[] = [];
  const melde: Melde = (code, nachricht, extra = {}) => fehler.push({ code, nachricht, ...extra });
  const jetzt = optionen?.jetzt ?? new Date();
  if (!istGueltigesDatum(jetzt)) throw new FonError('optionen.jetzt ist kein gültiges Datum.');
  const lauf = laufenderMonat(jetzt);

  for (const feld of Object.keys(paket)) {
    if (!PAKET_FELDER.has(feld)) melde('FELD_UNBEKANNT', `Unbekanntes Feld „${feld}" im Paket.`, { feld });
  }
  if (!istNr(paket.paketNr)) {
    melde('PAKETNR_UNGUELTIG', `Paketnummer muss eine ganze Zahl von 1 bis ${MAX_NR} sein.`, {
      feld: 'paketNr',
    });
  }
  if (paket.erstellt !== undefined && !istGueltigesDatum(paket.erstellt)) {
    melde('FELD_UNGUELTIG', 'erstellt muss ein gültiges Datum (Date) sein.', { feld: 'erstellt' });
  }
  const erklaerungen: unknown = paket.erklaerungen;
  if (!Array.isArray(erklaerungen) || erklaerungen.length < 1 || erklaerungen.length > MAX_ERKLAERUNGEN) {
    melde('ERKLAERUNGEN_ANZAHL', `Ein Paket braucht 1 bis ${MAX_ERKLAERUNGEN} Erklärungen.`, {
      feld: 'erklaerungen',
    });
    return fehler;
  }

  if (paket.uebermittler !== undefined) {
    if (steuernummerBefund(paket.uebermittler) !== undefined) {
      melde('UEBERMITTLER_UNGUELTIG', 'Steuernummer des Übermittlers ist ungültig.', {
        feld: 'uebermittler',
      });
    }
  } else if (effektiverUebermittler(paket) === undefined && paket.erklaerungen.length > 1) {
    melde(
      'UEBERMITTLER_FEHLT',
      'Die Erklärungen haben verschiedene Steuernummern; dann ist der Übermittler anzugeben.',
      { feld: 'uebermittler' },
    );
  }

  const satzNummern = new Set<number>();
  const zeitraeume: Array<{ steuernummer: string; zrvon: string; zrbis: string }> = [];
  paket.erklaerungen.forEach((e, i) => {
    if (e?.satzNr !== undefined && !istNr(e.satzNr)) {
      melde('SATZNR_UNGUELTIG', `Satznummer muss eine ganze Zahl von 1 bis ${MAX_NR} sein.`, {
        erklaerung: i,
        feld: 'satzNr',
      });
    } else {
      const nr = effektiveSatzNr(paket, i);
      if (satzNummern.has(nr)) {
        melde('SATZNR_DOPPELT', `Satznummer ${nr} kommt im Paket mehrfach vor.`, {
          erklaerung: i,
          feld: 'satzNr',
        });
      }
      satzNummern.add(nr);
    }
    const zr = zrVonBis(e?.zeitraum);
    if (zr && typeof e?.steuernummer === 'string') {
      const steuernummer = e.steuernummer;
      const ueberlappt = zeitraeume.some(
        (z) => z.steuernummer === steuernummer && z.zrvon <= zr.zrbis && zr.zrvon <= z.zrbis,
      );
      if (ueberlappt) {
        melde(
          'ERKLAERUNG_DOPPELT',
          `Für Steuernummer ${steuernummer} überschneidet sich der Zeitraum ${zr.zrvon} bis ${zr.zrbis} mit einer anderen Erklärung im Paket.`,
          { erklaerung: i },
        );
      }
      zeitraeume.push({ steuernummer, ...zr });
    }
    pruefeErklaerung(e ?? ({} as U30Erklaerung), lauf, (code, nachricht, extra = {}) =>
      melde(code, nachricht, { erklaerung: i, ...extra }),
    );
  });

  return fehler;
}

function pruefeErklaerung(e: U30Erklaerung, lauf: string, melde: Melde): void {
  for (const feld of Object.keys(e)) {
    if (!ERKLAERUNG_FELDER.has(feld))
      melde('FELD_UNBEKANNT', `Unbekanntes Feld „${feld}" in der Erklärung.`, { feld });
  }
  for (const feld of ['berichtigung', 'ueberschussVerwenden', 'rechnungskopien'] as const) {
    const wert: unknown = e[feld];
    if (wert !== undefined && typeof wert !== 'boolean') {
      melde('SCHALTER_UNGUELTIG', `${feld} muss true oder false sein.`, { feld });
    }
  }
  const befund = steuernummerBefund(e.steuernummer);
  if (befund === 'ungueltig') {
    melde('STEUERNUMMER_UNGUELTIG', 'Steuernummer muss aus 9 Ziffern ohne Trennzeichen bestehen.', {
      feld: 'steuernummer',
    });
  } else if (befund === 'pruefziffer') {
    melde('STEUERNUMMER_PRUEFZIFFER', 'Die Prüfziffer der Steuernummer stimmt nicht.', {
      feld: 'steuernummer',
    });
  }

  const zr = zrVonBis(e.zeitraum);
  if (!zr) {
    melde(
      'ZEITRAUM_UNGUELTIG',
      'Zeitraum muss genau ein Monat (1–12) oder ein Quartal (1–4) eines Jahres sein.',
      {
        feld: 'zeitraum',
      },
    );
  } else {
    if (zr.zrvon < ERSTER_ZEITRAUM) {
      melde('ZEITRAUM_NICHT_UNTERSTUETZT', 'Zeiträume vor 01/2022 werden nicht unterstützt.', {
        feld: 'zeitraum',
      });
    }
    const jahrJetzt = Number(lauf.slice(0, 4));
    if (Number(zr.zrvon.slice(0, 4)) < jahrJetzt - 5) {
      melde('ZEITRAUM_ZU_ALT', `Zulässig sind nur die Jahre ${jahrJetzt - 5} bis ${jahrJetzt}.`, {
        feld: 'zeitraum',
      });
    }
    if (zr.zrbis >= lauf) {
      melde('ZEITRAUM_NICHT_ABGESCHLOSSEN', 'Der Zeitraum muss vor dem laufenden Monat liegen.', {
        feld: 'zeitraum',
      });
    }
  }

  // Kennzahlen: Form
  const kennzahlenRoh: unknown = e.kennzahlen;
  if (kennzahlenRoh !== undefined && !istObjekt(kennzahlenRoh)) {
    melde('FELD_UNGUELTIG', 'kennzahlen muss ein Objekt sein, z. B. { kz000: 0 }.', { feld: 'kennzahlen' });
  }
  const roh: Record<string, unknown> = istObjekt(kennzahlenRoh) ? kennzahlenRoh : {};
  const werte: Partial<Record<Kennzahl, number>> = {};
  let betragFehler = false;
  for (const [schluessel, wert] of Object.entries(roh)) {
    if (wert === undefined) continue;
    if (!istKennzahl(schluessel)) {
      melde('KENNZAHL_UNBEKANNT', `Unbekannte Kennzahl „${schluessel}".`, { feld: 'kennzahlen' });
      continue;
    }
    const kennzahl = schluessel;
    if (typeof wert !== 'number' || !Number.isInteger(wert)) {
      melde('BETRAG_KEINE_GANZZAHL', `${kzText(kennzahl)}: Betrag muss eine ganze Zahl in Cent sein.`, {
        kennzahl,
      });
      betragFehler = true;
      continue;
    }
    if (wert < 0 && kennzahlInfo(kennzahl).typ !== 'kzvorz') {
      melde('BETRAG_NEGATIV', `${kzText(kennzahl)}: negative Beträge sind hier nicht zulässig.`, {
        kennzahl,
      });
      betragFehler = true;
      continue;
    }
    if (!Number.isSafeInteger(wert) || Math.abs(wert) > MAX_BETRAG) {
      melde('BETRAG_ZU_GROSS', `${kzText(kennzahl)}: Betrag über 9.999.999.999.999,99 €.`, { kennzahl });
      betragFehler = true;
      continue;
    }
    werte[kennzahl] = wert;
  }
  if (roh['kz000'] === undefined) {
    melde('KZ000_FEHLT', 'KZ 000 (steuerbarer Umsatz) muss angegeben werden; 0 ist zulässig.', {
      kennzahl: 'kz000',
    });
  }

  const vstAngegeben = e.vst !== undefined;
  if (vstAngegeben && (typeof e.vst !== 'string' || !VST_MUSTER.test(e.vst))) {
    melde(
      'VST_UNGUELTIG',
      'VST: eine Ziffer, danach bis zu 3 Ziffern oder Buchstaben (Ziffer des § 6 Abs. 1).',
      {
        feld: 'vst',
      },
    );
  }

  const w = (kz: Kennzahl): number => werte[kz] ?? 0;
  if (!betragFehler) {
    const steuerbar = w('kz000') + w('kz001') - w('kz021');
    const steuerfrei =
      w('kz011') + w('kz012') + w('kz015') + w('kz016') + w('kz017') + w('kz018') + w('kz019') + w('kz020');
    const steuerpflichtig =
      w('kz006') + w('kz007') + w('kz022') + w('kz029') + w('kz037') + w('kz052') + w('kz124');
    if (steuerfrei > steuerbar) {
      melde(
        'STEUERFREI_UEBER_STEUERBAR',
        'Die Summe der steuerfreien Umsätze ist größer als die der steuerbaren.',
      );
    }
    if (steuerpflichtig !== steuerbar - steuerfrei) {
      melde(
        'SUMME_STEUERPFLICHTIG_UNGLEICH',
        `Steuerbare minus steuerfreie Umsätze (${euro(steuerbar - steuerfrei)} €) ergeben nicht die Summe der zu versteuernden Umsätze (${euro(steuerpflichtig)} €).`,
      );
    }
    if ((w('kz065') > 0 || w('kz071') > 0) && w('kz070') === 0) {
      melde('IGE_OHNE_KZ070', 'KZ 065 und KZ 071 nur zusammen mit KZ 070 (innergemeinschaftliche Erwerbe).');
    }
    if (w('kz071') > w('kz070')) {
      melde('KZ071_UEBER_KZ070', 'KZ 071 (steuerfreie Erwerbe) ist größer als KZ 070.');
    }
    const igePflichtig = w('kz008') + w('kz072') + w('kz073') + w('kz088') + w('kz125');
    if (igePflichtig !== w('kz070') - w('kz071')) {
      melde(
        'SUMME_IGE_UNGLEICH',
        `KZ 070 minus KZ 071 (${euro(w('kz070') - w('kz071'))} €) ergibt nicht die Summe der steuerpflichtigen Erwerbe (${euro(igePflichtig)} €).`,
      );
    }
    const paare: Array<[Kennzahl, Kennzahl, U30FehlerCode, U30FehlerCode]> = [
      ['kz066', 'kz057', 'KZ066_OHNE_KZ057', 'KZ066_UEBER_KZ057'],
      ['kz082', 'kz048', 'KZ082_OHNE_KZ048', 'KZ082_UEBER_KZ048'],
      ['kz087', 'kz044', 'KZ087_OHNE_KZ044', 'KZ087_UEBER_KZ044'],
      ['kz089', 'kz032', 'KZ089_OHNE_KZ032', 'KZ089_UEBER_KZ032'],
    ];
    for (const [vorsteuer, schuld, ohne, ueber] of paare) {
      if (w(vorsteuer) > 0 && w(schuld) === 0) {
        melde(ohne, `${kzText(vorsteuer)} nur zusammen mit ${kzText(schuld)}.`, { kennzahl: vorsteuer });
      } else if (w(vorsteuer) > w(schuld)) {
        melde(ueber, `${kzText(vorsteuer)} darf ${kzText(schuld)} nicht übersteigen.`, {
          kennzahl: vorsteuer,
        });
      }
    }
    if (w('kz020') > 0 && !vstAngegeben) {
      melde('KZ020_OHNE_VST', 'Zu KZ 020 ist die Ziffer des § 6 Abs. 1 (VST) anzugeben.', {
        kennzahl: 'kz020',
      });
    }
    if (vstAngegeben && w('kz020') === 0) {
      melde('VST_OHNE_KZ020', 'VST nur zusammen mit einem Betrag in KZ 020.', { feld: 'vst' });
    }
    if (zr && zr.zrvon < '2026-07' && (w('kz124') !== 0 || w('kz125') !== 0)) {
      melde(
        'KZ124_125_ZU_FRUEH',
        'KZ 124 und 125 (4,9 %) sind erst ab 07/2026 bzw. 3. Quartal 2026 zulässig.',
        {
          kennzahl: w('kz124') !== 0 ? 'kz124' : 'kz125',
        },
      );
    }
  }

  if (e.berichtigung === true && e.ueberschussVerwenden === true) {
    melde(
      'ARE_BEI_BERICHTIGUNG',
      'Bei einer Berichtigung ist der Antrag auf Verwendung des Überschusses nicht möglich.',
      {
        feld: 'ueberschussVerwenden',
      },
    );
  }

  if (e.kundeninfo !== undefined) {
    if (typeof e.kundeninfo !== 'string') {
      melde('KUNDENINFO_ZEICHEN', 'KUNDENINFO muss Text sein.', { feld: 'kundeninfo' });
    } else {
      const zeichen = [...e.kundeninfo];
      if (zeichen.length > MAX_KUNDENINFO) {
        melde('KUNDENINFO_ZU_LANG', `KUNDENINFO darf höchstens ${MAX_KUNDENINFO} Zeichen haben.`, {
          feld: 'kundeninfo',
        });
      }
      if (zeichen.some((z) => !erlaubtesZeichen(z.codePointAt(0) ?? 0))) {
        melde(
          'KUNDENINFO_ZEICHEN',
          'KUNDENINFO darf nur druckbare Zeichen aus ISO-8859-1 enthalten (keine Zeilenumbrüche, kein €, keine Emojis).',
          { feld: 'kundeninfo' },
        );
      }
    }
  }

  const erwarteteSteuer: unknown = e.erwarteteSteuer;
  if (erwarteteSteuer !== undefined && !istObjekt(erwarteteSteuer)) {
    melde('FELD_UNGUELTIG', 'erwarteteSteuer muss ein Objekt sein, z. B. { kz022: 297818 }.', {
      feld: 'erwarteteSteuer',
    });
  }
  if (istObjekt(erwarteteSteuer)) {
    for (const [schluessel, erwartet] of Object.entries(erwarteteSteuer)) {
      if (erwartet === undefined) continue;
      if (!istSatzKennzahl(schluessel)) {
        melde('ERWARTETE_STEUER_KEIN_SATZ', `„${schluessel}" ist keine Kennzahl mit Steuersatz.`, {
          feld: 'erwarteteSteuer',
        });
        continue;
      }
      if (typeof erwartet !== 'number' || !Number.isSafeInteger(erwartet)) {
        melde(
          'BETRAG_KEINE_GANZZAHL',
          `Erwartete Steuer zu ${kzText(schluessel)} muss eine ganze Zahl in Cent sein.`,
          {
            kennzahl: schluessel,
            feld: 'erwarteteSteuer',
          },
        );
        continue;
      }
      if (betragFehler) continue;
      const satz = kennzahlInfo(schluessel).satzPromille ?? 0;
      const amtlich = steuerFuerSatz(w(schluessel), satz);
      if (erwartet !== amtlich) {
        melde(
          'STEUER_WEICHT_AB',
          `${kzText(schluessel)}: erwartet ${euro(erwartet)} €, amtlich gerundet ${euro(amtlich)} € (${euro(w(schluessel))} € × ${satz / 10} %).`,
          { kennzahl: schluessel, feld: 'erwarteteSteuer' },
        );
      }
    }
  }
}
