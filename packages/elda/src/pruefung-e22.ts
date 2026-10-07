import { TAETIGKEITSBLOECKE } from './felder-e22';
import { pruefeAllgemein, wirf } from './pruefung-allgemein';
import { normalisiert, normalisiertNumerisch, tageImMonat } from './pruefung-e29';

type Werte = Readonly<Record<string, string | undefined>>;

/**
 * Art der Tätigkeit laut Feld 17 `TART` (Kapitel E.22, Seite 267 der 43. Ergänzung, 260 der 42.): die Ziffer
 * von § 1 Abs. 1 der Schwerarbeitsverordnung.
 *
 * - `1` Schicht- oder Wechseldienst
 * - `2` regelmäßige Hitze oder Kälte
 * - `4` schwere körperliche Arbeit
 * - `5` berufsbedingte Pflege
 * - `6` Anspruch auf Pflegegeld (mindestens Stufe 3)
 *
 * Z 3 fehlt in der Liste: Laut E.22.2 besteht dafür keine Meldepflicht. Für Z 6
 * besteht ebenfalls keine, eine Meldung ist aber möglich.
 *
 * Das Feld ist zwei Stellen lang und alphanumerisch (linksbündig, Rest blank),
 * die Codes sind einstellig abgedruckt. Gesendet wird die Ziffer, wie sie
 * dasteht — `'1'` wird zu `'1 '`. Ob ELDA auch `'01'` annimmt, steht nirgends.
 */
export const TAETIGKEIT = Object.freeze({
  SCHICHT_ODER_WECHSELDIENST: '1',
  HITZE_ODER_KAELTE: '2',
  SCHWERE_KOERPERLICHE_ARBEIT: '4',
  BERUFSBEDINGTE_PFLEGE: '5',
  PFLEGEGELD_AB_STUFE_3: '6',
} as const);

/** Zulässige Werte von {@link TAETIGKEIT}. */
export type Taetigkeit = (typeof TAETIGKEIT)[keyof typeof TAETIGKEIT];

const TART_CODES: ReadonlySet<string> = new Set(Object.values(TAETIGKEIT));

/** `TTMM` als gültiger Tag im Tätigkeitsjahr — der 29.02. nur im Schaltjahr. */
function gueltigesTtmm(ttmm: string, jahr: number): boolean {
  if (!/^\d{4}$/.test(ttmm)) return false;
  const tt = Number(ttmm.slice(0, 2));
  const mm = Number(ttmm.slice(2, 4));
  if (mm < 1 || mm > 12) return false;
  return tt >= 1 && tt <= tageImMonat(mm, jahr);
}

/** `TTMM` als vergleichbare Zahl `MMTT`. */
const alsZahl = (ttmm: string): number => Number(ttmm.slice(2, 4) + ttmm.slice(0, 2));

/**
 * Prüfregeln des Prüfkatalogs 43.1.0.0 für die Schwerarbeitsmeldung (Bestand
 * `SM`, Satzarten 65 und 66): Blatt `Allgemein` (siehe `pruefeAllgemein`) und
 * Blatt `SM` (Kapitel H.12), jeweils die Zeilen mit Status N. Wirft beim ersten
 * Verstoß mit dem Code des Katalogs; bei den Tätigkeitsblöcken trägt der Code
 * wie im Katalog die Blocknummer (`F5511_3` für Block 3).
 *
 * - `F5500`/`F5501` Tätigkeitsjahr leer bzw. ungültig („Format JJJJ").
 * - `F5511_n`/`F5521_n` Beginn bzw. Ende ungültig („Format TTMM"). Geprüft
 *   wird ein Kalendertag im Tätigkeitsjahr, der 29.02. also nur im Schaltjahr.
 * - `F5530_n` „TART/TVON/TBIS semantisch falsch (z.B. TVON > TBIS oder nur ein
 *   Feld belegt)". Umgesetzt sind genau die beiden genannten Beispiele: Beginn
 *   nach dem Ende, und ein Block, in dem nur eines der drei Felder belegt ist —
 *   dazu ein Block mit nur Beginn oder nur Ende.
 * - `F5580_n` Tätigkeitsart nicht in {@link TAETIGKEIT}.
 *
 * Nicht geprüft (Status W): leere Tätigkeitsart in einem Block mit Zeitraum
 * (`F5579`), die Anschrift des Dienstgebers (`F5540`–`F5570`) und
 * Überschneidungen bei gleicher Tätigkeit (`F5581`). Die Anschrift erzwingt
 * trotzdem die Pflichtmatrix (Kapitel E.22.1: „Z").
 */
export function pruefeSchwerarbeit(werte: Werte): void {
  pruefeAllgemein(werte);

  const jahrText = normalisiertNumerisch(werte.JAHR);
  if (jahrText === undefined) wirf('F5500', 'Das Tätigkeitsjahr (JAHR) ist zu befüllen.');
  if (!/^\d{4}$/.test(jahrText)) wirf('F5501', 'Das Tätigkeitsjahr (JAHR) ist ungültig. Erwartet: JJJJ.');
  const jahr = Number(jahrText);

  for (let n = 1; n <= TAETIGKEITSBLOECKE; n++) {
    const tart = normalisiert(werte[`TART_${n}`]);
    const tvon = normalisiertNumerisch(werte[`TVON_${n}`]);
    const tbis = normalisiertNumerisch(werte[`TBIS_${n}`]);

    if (tvon !== undefined && !gueltigesTtmm(tvon, jahr)) {
      wirf(`F5511_${n}`, `Block ${n}: Tätigkeit VON (TVON) ist ungültig. Erwartet: TTMM im Tätigkeitsjahr.`);
    }
    if (tbis !== undefined && !gueltigesTtmm(tbis, jahr)) {
      wirf(`F5521_${n}`, `Block ${n}: Tätigkeit BIS (TBIS) ist ungültig. Erwartet: TTMM im Tätigkeitsjahr.`);
    }
    const belegt = [tart, tvon, tbis].filter((w) => w !== undefined).length;
    if (belegt === 1 || (tvon === undefined) !== (tbis === undefined)) {
      wirf(`F5530_${n}`, `Block ${n}: Art, Beginn und Ende der Tätigkeit sind unvollständig angegeben.`);
    }
    if (tvon !== undefined && tbis !== undefined && alsZahl(tvon) > alsZahl(tbis)) {
      wirf(`F5530_${n}`, `Block ${n}: Der Beginn der Tätigkeit (TVON) liegt nach ihrem Ende (TBIS).`);
    }
    if (tart !== undefined && !TART_CODES.has(tart)) {
      wirf(`F5580_${n}`, `Block ${n}: Ungültiger Code der Tätigkeitsart (TART). Zulässig: 1, 2, 4, 5, 6.`);
    }
  }
}
