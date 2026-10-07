import type { RohSatz } from './bestand';
import { EldaError } from './errors';
import type { Befund } from './pruefung-e32';

/**
 * Beitrag einer Verrechnungsposition nach D.61/D.62 (DM-Org, 43. Ergänzung,
 * Seiten 162–163; in der 42. Ergänzung Seiten 160–161).
 *
 * Wortlaut D.62: „Dieser ergibt sich durch Multiplikation des
 * Verrechnungsbasis-Betrags (siehe Kapitel D.59 VBBT – Verrechnungsbasis
 * Betrag) mit dem Prozentsatz (siehe Kapitel D.61 VPTA – Prozentsatz für
 * Verrechnungsposition) unter Berücksichtigung des Vorzeichens (Datenfeld
 * VPVZ), kaufmännisch gerundet auf zwei Nachkommastellen." E.32.2.2.5 (Seite
 * 369 der 43., Seite 358 der 42. Ergänzung) wiederholt das für jede Position
 * einzeln: Gerundet wird je Position, nicht über eine Summe.
 *
 * Gerechnet wird ausschließlich in ganzen Zahlen: Cent mal Tausendstelprozent,
 * geteilt durch 100 000. Mit Gleitkommazahlen kippt genau der Halbcent-Fall —
 * `0.2845 * 95000` ergibt in JavaScript `27027.499999999996`, `Math.round`
 * macht daraus 27 027 Cent, die ÖGK bucht 27 028 (Clearing `BW1917`, SIT
 * 07.10.2026).
 *
 * „Kaufmännisch" heißt: ab einem halben Cent wird vom Betrag her aufgerundet.
 * Bei einem negativen Prozentsatz gilt das für den Betrag, das Vorzeichen kommt
 * danach dazu.
 *
 * @param basisCent Verrechnungsbasis-Betrag in Cent, ganzzahlig, nicht negativ
 *   (`VBBT` hat kein Vorzeichenfeld, D.59).
 * @param prozentsatz Prozentsatz kaufmännisch als Zahl — `28.45` für 28,45 %.
 *   Er wird wie in der Meldung auf drei Nachkommastellen gebracht (D.61).
 * @returns der Beitrag in Cent, mit Vorzeichen.
 */
export function berechneBeitragCent(basisCent: number, prozentsatz: number): number {
  if (!Number.isSafeInteger(basisCent) || basisCent < 0) {
    throw new EldaError(
      `Verrechnungsbasis ${basisCent}: erwartet wird ein ganzzahliger, nicht negativer Cent-Betrag.`,
    );
  }
  if (!Number.isFinite(prozentsatz)) {
    throw new EldaError(`${prozentsatz} ist kein gültiger Prozentsatz.`);
  }
  const tausendstel = Math.round(Math.abs(prozentsatz) * 1000);
  const betrag = Number(gerundet(BigInt(basisCent), BigInt(tausendstel)));
  return prozentsatz < 0 && betrag !== 0 ? -betrag : betrag;
}

/** Cent × Tausendstelprozent / 100 000, kaufmännisch auf ganze Cent. */
function gerundet(basisCent: bigint, tausendstel: bigint): bigint {
  const produkt = basisCent * tausendstel;
  const ganz = produkt / 100_000n;
  const rest = produkt % 100_000n;
  return rest * 2n >= 100_000n ? ganz + 1n : ganz;
}

function ganzzahl(wert: string | undefined): bigint | undefined {
  const t = wert?.trim() ?? '';
  return /^\d+$/.test(t) ? BigInt(t) : undefined;
}

function euro(cent: bigint): string {
  const negativ = cent < 0n;
  const b = negativ ? -cent : cent;
  const s = `${b / 100n},${String(b % 100n).padStart(2, '0')}`;
  return negativ ? `-${s}` : s;
}

function prozent(tausendstel: bigint): string {
  return `${tausendstel / 1000n},${String(tausendstel % 1000n).padStart(3, '0')}`;
}

/**
 * Rechnet jede Verrechnungsposition `V1` (Selbstabrechnung) aus der
 * vorangehenden Verrechnungsbasis `BS` nach und meldet Abweichungen.
 *
 * Code `DM-D.62`: Die Regel steht eindeutig im DM-Org, der Prüfkatalog führt
 * für die Satzart `V1` aber keine Prüfung (siehe `pruefung-e32.ts`). Beobachtet
 * ist nur der Rundungsfall: ELDA nahm die Meldung an, die ÖGK buchte den
 * nachgerechneten Beitrag und meldete das als Clearing `BW1917` (nicht
 * dringend, SIT-Plattform 07.10.2026). Deshalb `warnung`. Wie der Träger auf
 * größere Abweichungen reagiert, ist nicht beobachtet.
 *
 * Beim Vorschreiber (`V2`) rechnet die ÖGK selbst; dort gibt es nichts
 * nachzurechnen. Positionen ohne lesbare Basis oder ohne Prozentsatz
 * übergeht diese Prüfung — das fangen andere Regeln ab.
 */
export function pruefeBeitraege(saetze: readonly RohSatz[]): Befund[] {
  const befunde: Befund[] = [];
  let wer: string | undefined;
  let basis: bigint | undefined;
  for (const s of saetze) {
    if (/^[GR]\d$/.test(s.satzart)) {
      wer = s.werte.VSNR?.trim() || s.werte.REFW?.trim() || s.satzart;
      basis = undefined;
    } else if (/^T\d$/.test(s.satzart) || s.satzart === 'BV') {
      basis = undefined;
    } else if (s.satzart === 'BS') {
      basis = ganzzahl(s.werte.VBBT);
    } else if (s.satzart === 'V1' && basis !== undefined) {
      const tausendstel = ganzzahl(s.werte.VPTA);
      if (tausendstel === undefined) continue;
      const betrag = gerundet(basis, tausendstel);
      const soll = s.werte.VPVZ?.trim() === '-' ? -betrag : betrag;
      const rsum = ganzzahl(s.werte.RSUM) ?? 0n;
      const rsvz = s.werte.RSVZ?.trim();
      const ist = rsvz === '-' ? -rsum : rsum;
      // D.62: Ergibt die Rundung 0,00 €, ist RSVZ mit „+" zu belegen.
      const vorzeichenFalsch = soll === 0n && rsvz !== '+';
      if (ist !== soll || vorzeichenFalsch) {
        const vpty = s.werte.VPTY?.trim() ?? 'V1';
        befunde.push({
          code: 'DM-D.62',
          schwere: 'warnung',
          meldung:
            `${wer ?? 'Meldung'}: Verrechnungsposition ${vpty} meldet ${euro(ist)} €` +
            (vorzeichenFalsch && ist === soll ? ` mit Vorzeichen '${rsvz ?? ''}'` : '') +
            `, ${euro(basis)} € × ${s.werte.VPVZ?.trim() === '-' ? '-' : ''}${prozent(tausendstel)} % ` +
            `ergibt kaufmännisch gerundet ${euro(soll)} €` +
            (soll === 0n ? ' (Vorzeichen „+")' : '') +
            '. Bei einer Rundungsabweichung buchte die ÖGK auf der SIT-Plattform den nachgerechneten ' +
            'Beitrag und meldete das als Clearing BW1917.',
        });
      }
    }
  }
  return befunde;
}
