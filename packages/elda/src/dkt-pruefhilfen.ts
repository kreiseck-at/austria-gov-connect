import { EldaError } from './errors';
import { baueSatzText, type Feld } from './festsatz';
import {
  DKT_ADRESSE,
  DKT_BLOCK_BEGRUENDUNG,
  DKT_BLOCK_DIAGNOSE,
  DKT_BLOCK_LEISTUNG,
  DKT_LEISTUNG,
  DKT_SUMME,
  DKT_TEXT,
  DKT_TRANSPORT,
  DKT_VERSICHERTER,
  DKT_VORLAUF,
  type DktFeld,
} from './dkt-felder';
import { ABLG } from './dkt-codes';
import { SATZTRENNER } from './bestand';
import { gekuerzt, umsatzsteuer } from './dkt-abrechnung';

function feld(tabelle: readonly DktFeld[], name: string): DktFeld {
  const f = tabelle.find((x) => x.name === name);
  if (f === undefined) throw new EldaError(`DKT: Feld ${name} fehlt in der Feldtabelle.`);
  return f;
}

/**
 * Texteingaben einer Krankentransport-Abrechnung und das Feld der DKT, in dem
 * sie landen. Zeichenvorrat und Länge kommen aus derselben Feldtabelle, mit der
 * `erstelleDktAbrechnung` den Satz baut.
 */
export const DKT_EINGABEFELDER = {
  /** ZUNVS / AZUNA, Familienname (D.67): 30 Stellen alphabetisch. */
  familienname: feld(DKT_VERSICHERTER, 'ZUNVS'),
  /** VONVS / AVONA, Vorname (D.64): 15 Stellen alphabetisch. */
  vorname: feld(DKT_VERSICHERTER, 'VONVS'),
  /** ZUNUW, Familienname des ver(an)ordnenden Arztes (D.67): 10 Stellen alphabetisch. */
  verordnerName: feld(DKT_VERSICHERTER, 'ZUNUW'),
  /** STRA, Straße in SART 06 (D.49). */
  strasse: feld(DKT_ADRESSE, 'STRA'),
  /** ORT in SART 06 (D.34): 25 Stellen. */
  ort: feld(DKT_ADRESSE, 'ORT'),
  /** ORTV / ORTN, Transport von/nach Ort oder Straße (D.34): 16 Stellen. */
  transportOrt: feld(DKT_TRANSPORT, 'ORTV'),
  /** HRST, Name der übermittelnden Stelle im Vorlaufsatz (D.28). */
  uebermittlerName: feld(DKT_VORLAUF, 'HRST'),
  /** GRUN, Begründung im Datenblock „B" (D.54): 42 Stellen. */
  begruendung: feld(DKT_BLOCK_BEGRUENDUNG, 'GRUN'),
  /** TXT, Textsatz SART 39 (D.54): 100 Stellen. */
  text: feld(DKT_TEXT, 'TXT'),
  /** DIAGN als Text (D.17): 30 Stellen. */
  diagnosetext: feld(DKT_BLOCK_DIAGNOSE, 'DIAGN'),
  /** RNR, Rechnungsnummer des Transportes bzw. der Abrechnung (D.43): 10 Stellen. */
  rechnungsnummer: feld(DKT_LEISTUNG, 'RNR'),
  /** KFZ, Kennzeichen, Fahrzeug- oder Funknummer (D.30): 8 Stellen. */
  kennzeichen: feld(DKT_TRANSPORT, 'KFZ'),
  /** TNR, Transportnummer (D.53): 8 Stellen. */
  transportnummer: feld(DKT_TRANSPORT, 'TNR'),
  /** BEWNR, Bewilligungsnummer (D.12): 8 Stellen. */
  bewilligungsnummer: feld(DKT_BLOCK_LEISTUNG, 'BEWNR'),
} as const satisfies Readonly<Record<string, DktFeld>>;

/** Name einer Texteingabe, siehe {@link DKT_EINGABEFELDER}. */
export type DktEingabefeld = keyof typeof DKT_EINGABEFELDER;

/**
 * Ergebnis von {@link pruefeDktEingabe}. `gekuerzt` steht nur bei Namen, die
 * länger sind als ihr Feld: der Wert, der im Satz landet.
 */
export type DktEingabepruefung =
  { zulaessig: true; gekuerzt?: string } | { zulaessig: false; meldung: string };

/** Die Namensfelder der SART 01: Der Satzbau kürzt sie auf Feldlänge (F.7.1), statt abzuweisen. */
const KUERZBAR: ReadonlySet<DktEingabefeld> = new Set(['familienname', 'vorname', 'verordnerName']);

/**
 * Prüft eine Texteingabe so, wie `erstelleDktAbrechnung` sie beim Satzbau prüft:
 * Länge und Zeichenvorrat des Zielfelds. Gedacht für die Eingabemaske, damit ein
 * unzulässiger Name beim Erfassen auffällt und nicht erst bei der
 * Monatsabrechnung.
 *
 * Namen und Adressen: „Für Datenfelder, die Adressen und Namen beinhalten,
 * dürfen keine diakritischen Zeichen verwendet werden" (F.1). Namensfelder sind
 * „alphabetisch" (D.64, D.67); ob Bindestrich, Apostroph und Punkt dort zulässig
 * sind, sagt die DKT nicht — sie werden abgewiesen. Freitext (Begründung,
 * Textsatz, Diagnosetext) trägt den vollen Zeichensatz ISO 8859-15.
 *
 * Zu lange Namen des Versicherten und des Verordners sind zulässig und werden
 * gekürzt: „Sind die Namen länger als 30 bzw. 15 Zeichen, so werden diese im
 * Datensatz der Satzart 01 abgeschnitten angegeben" (F.7.1). Alle anderen Felder
 * werden bei Überlänge abgewiesen.
 *
 * Ein leerer Wert ist hier zulässig; ob das Feld Pflicht ist, entscheidet der
 * Satzbau.
 */
export function pruefeDktEingabe(eingabefeld: DktEingabefeld, wert: string): DktEingabepruefung {
  const ziel: Feld = { ...DKT_EINGABEFELDER[eingabefeld], pos: 1 };
  const inhalt = KUERZBAR.has(eingabefeld) ? gekuerzt(wert, ziel.laenge) : wert;
  try {
    baueSatzText([ziel], { [ziel.name]: inhalt }, ziel.laenge);
    return inhalt === wert.trim() || !KUERZBAR.has(eingabefeld)
      ? { zulaessig: true }
      : { zulaessig: true, gekuerzt: inhalt };
  } catch (e) {
    if (e instanceof EldaError) return { zulaessig: false, meldung: e.message };
    throw e;
  }
}

// --- Testhilfe: Retourdatenträger --------------------------------------------

/** Ergebnis eines Falls in {@link erstelleDktTestRuecksendung}. */
export type DktTestErgebnis =
  | { art: 'angenommen' }
  /** Anerkannter Betrag kleiner als der verrechnete; nur für Fälle mit genau einer Leistung. */
  | { art: 'gekuerzt'; anerkanntCent: number; ablehnungsgrund: string }
  /** Alle Leistungen des Falls mit Betrag 0. */
  | { art: 'abgelehnt'; ablehnungsgrund: string };

const lies = (text: string, f: DktFeld, ab = 0): string =>
  text.slice(ab + f.pos - 1, ab + f.pos - 1 + f.laenge);

function setze(text: string, f: DktFeld, wert: string | number, ab = 0): string {
  const roh = String(wert);
  if (roh.length > f.laenge)
    throw new EldaError(`DKT-Testhilfe: Wert für ${f.name} ist länger als ${f.laenge} Stellen.`);
  const inhalt = f.typ === 'n' ? roh.padStart(f.laenge, '0') : roh.padEnd(f.laenge, ' ');
  const von = ab + f.pos - 1;
  return text.slice(0, von) + inhalt + text.slice(von + f.laenge);
}

const SART = feld(DKT_LEISTUNG, 'SART');
const BLOCK = [feld(DKT_LEISTUNG, 'BLO1'), feld(DKT_LEISTUNG, 'BLO2')] as const;
const L = {
  BLOKZ: feld(DKT_BLOCK_LEISTUNG, 'BLOKZ'),
  BETR: feld(DKT_BLOCK_LEISTUNG, 'BETR'),
  UST: feld(DKT_BLOCK_LEISTUNG, 'UST'),
  ABLG: feld(DKT_BLOCK_LEISTUNG, 'ABLG'),
};
const S = Object.fromEntries(
  ['UST', 'SUM', 'KOBE', 'ZSUM', 'UBE', 'REBE', 'ABST', 'KOBEUST'].map((n) => [n, feld(DKT_SUMME, n)]),
) as Record<'UST' | 'SUM' | 'KOBE' | 'ZSUM' | 'UBE' | 'REBE' | 'ABST' | 'KOBEUST', DktFeld>;

/**
 * **Testhilfe.** Baut aus einer mit `erstelleDktAbrechnung` erzeugten Abrechnung
 * einen Retourdatenträger (BEST `TR`) mit wählbarem Ergebnis je Fall — für
 * Tests, die eine Rückmeldung den gesendeten Fahrten zuordnen.
 *
 * Der Aufbau folgt allein der Beschreibung (E.2.2): SART 21 wird zu 22 mit dem
 * „anerkannten Betrag" (D.11) und dem Ablehnungsgrund (D.1), SART 23 zu 24 mit
 * neu gerechneten Summen und Abrechnungsstatus (D.3); alle übrigen Sätze
 * bleiben, wie sie gesendet wurden. **Ein echter Retourdatenträger eines Trägers
 * lag bei der Entwicklung nicht vor** — was ein Träger tatsächlich zurückschickt
 * (Korrektursätze 41/60/62/64, Pauschalen 85, Hinweise 39, Kostenbeteiligung),
 * bildet diese Hilfe nicht nach. Nicht für den Versand gedacht.
 *
 * @param gesendet   die gesendete Abrechnung (BEST `TK` oder `T1`)
 * @param ergebnisse Ergebnis je Belegnummer (BSNR); nicht genannte Fälle gelten
 *                   als angenommen
 */
export function erstelleDktTestRuecksendung(
  gesendet: Buffer,
  ergebnisse: Readonly<Record<number, DktTestErgebnis>>,
): Buffer {
  const trenner = SATZTRENNER.toString('latin1');
  const zeilen = gesendet.toString('latin1').split(trenner);
  const best = feld(DKT_VORLAUF, 'BEST');
  const bisher = lies(zeilen[0] ?? '', best);
  if (bisher !== 'TK' && bisher !== 'T1') {
    throw new EldaError(
      `DKT-Testhilfe: erwartet wird eine gesendete Abrechnung (BEST TK oder T1), nicht '${bisher}'.`,
    );
  }
  for (const [nr, e] of Object.entries(ergebnisse)) {
    if (e.art !== 'angenommen' && !Object.prototype.hasOwnProperty.call(ABLG, e.ablehnungsgrund)) {
      throw new EldaError(`DKT-Testhilfe: Fall ${nr}: ABLG '${e.ablehnungsgrund}' ist kein Code laut D.1.`);
    }
  }
  zeilen[0] = setze(zeilen[0]!, best, 'TR');

  // Leistungsblöcke je Fall einsammeln: [Zeile, Blockanfang].
  const bloecke = new Map<number, [zeile: number, ab: number][]>();
  let bsnr: number | undefined;
  zeilen.forEach((z, i) => {
    if (i === 0 || i === zeilen.length - 1) return;
    const sart = lies(z, SART);
    if (sart === '01') {
      bsnr = Number(lies(z, feld(DKT_VERSICHERTER, 'BSNR')));
      bloecke.set(bsnr, []);
    } else if (sart === '21' && bsnr !== undefined) {
      for (const b of BLOCK) if (lies(z, L.BLOKZ, b.pos - 1) === 'L') bloecke.get(bsnr)!.push([i, b.pos - 1]);
    }
  });
  for (const nr of Object.keys(ergebnisse)) {
    if (!bloecke.has(Number(nr)))
      throw new EldaError(`DKT-Testhilfe: Belegnummer ${nr} kommt in der Abrechnung nicht vor.`);
  }

  const summe = new Map<string, number>();
  let geaendert = false;
  for (const [nr, stellen] of bloecke) {
    const e = ergebnisse[nr] ?? { art: 'angenommen' };
    if (e.art === 'gekuerzt' && stellen.length !== 1) {
      throw new EldaError(
        `DKT-Testhilfe: Fall ${nr}: 'gekuerzt' gilt nur für Fälle mit genau einer Leistung.`,
      );
    }
    for (const [i, ab] of stellen) {
      const verrechnet = Number(lies(zeilen[i]!, L.BETR, ab));
      let anerkannt = verrechnet;
      if (e.art === 'abgelehnt') anerkannt = 0;
      if (e.art === 'gekuerzt') {
        if (!Number.isSafeInteger(e.anerkanntCent) || e.anerkanntCent <= 0 || e.anerkanntCent >= verrechnet) {
          throw new EldaError(
            `DKT-Testhilfe: Fall ${nr}: anerkannter Betrag muss über 0 und unter dem verrechneten liegen.`,
          );
        }
        anerkannt = e.anerkanntCent;
      }
      if (e.art !== 'angenommen') {
        geaendert = true;
        zeilen[i] = setze(setze(zeilen[i]!, L.BETR, anerkannt, ab), L.ABLG, e.ablehnungsgrund, ab);
      }
      const ust = lies(zeilen[i]!, L.UST, ab);
      summe.set(ust, (summe.get(ust) ?? 0) + anerkannt);
    }
  }

  return Buffer.from(
    zeilen
      .map((z, i) => {
        if (i === 0 || i === zeilen.length - 1) return z;
        const sart = lies(z, SART);
        if (sart === '21') return setze(z, SART, '22');
        if (sart !== '23') return z;
        const ust = lies(z, S.UST);
        const sum = summe.get(ust) ?? 0;
        const zsum = sum - Number(lies(z, S.KOBE)); // D.50
        const ube = umsatzsteuer(sum, Number(ust)); // D.50
        const rebe = zsum + ube - Number(lies(z, S.KOBEUST)); // D.41
        const neu: [DktFeld, string | number][] = [
          [SART, '24'],
          [S.SUM, sum],
          [S.ZSUM, zsum],
          [S.UBE, ube],
          [S.REBE, rebe],
          [S.ABST, geaendert && sum !== Number(lies(z, S.SUM)) ? '01' : '00'],
        ];
        return neu.reduce((t, [f, w]) => setze(t, f, w), z);
      })
      .join(trenner),
    'latin1',
  );
}
