import { EldaError } from './errors';
import {
  BLOCK_ARBEITSORT,
  BLOCK_DIENSTGEBER,
  BLOCK_SELBSTAENDIG,
  FELDER_E27,
  PLAETZE_ARBEITSORT,
  PLAETZE_DIENSTGEBER,
  PLAETZE_SELBSTAENDIG,
} from './felder-e27';
import type { Pflichtstufe } from './pflicht-e29';

/** Satzarten des Antrags auf zwischenstaatliche Bescheinigung (Kapitel E.27, Feld SART). */
export type E27Satzart = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'EA';

/** Klartext je Satzart, wie ihn die Feldtabelle auf Seite 290 abdruckt. */
export const E27_SATZART_TEXT: Readonly<Record<E27Satzart, string>> = {
  E1: 'Entsendung eines Arbeitnehmers in einen anderen Staat (EU/EWR/CH/GB)',
  E2: 'Beschäftigung für einen Arbeitgeber in mehreren Staaten',
  E3: 'Beschäftigung für mehrere Arbeitgeber in mehreren Staaten',
  E4: 'Selbständige und unselbständige Tätigkeit in verschiedenen Staaten',
  E5: 'Entsendung eines Arbeitnehmers in einen Staat mit bilateralem Abkommen',
  EA: 'Ausnahmeregelung grenzüberschreitende Telearbeit',
};

/** Meldeart (Feld MART, Seite 290): `01` Meldung, `02` Storno. */
export type E27Meldeart = '01' | '02';

const SATZARTEN: readonly E27Satzart[] = ['E1', 'E2', 'E3', 'E4', 'E5', 'EA'];

type Zeile = Readonly<Record<E27Satzart, Pflichtstufe>>;

function zeile(
  e1: Pflichtstufe,
  e2: Pflichtstufe,
  e3: Pflichtstufe,
  e4: Pflichtstufe,
  e5: Pflichtstufe,
  ea: Pflichtstufe,
): Zeile {
  return { E1: e1, E2: e2, E3: e3, E4: e4, E5: e5, EA: ea };
}

const ALLE = (s: Pflichtstufe): Zeile => zeile(s, s, s, s, s, s);

/**
 * Matrix aus Kapitel E.27.1, „zwingende Angabe je Satzart, Meldeart ‚01‘ =
 * Meldung" (Seiten 296–299). Felder in Blöcken stehen unter ihrem Grundnamen
 * (`DGNA`, nicht `DGNA_1`); die Stufe gilt für jeden belegten Platz des Blocks.
 *
 * Zwei Einträge weichen vom reinen Abdruck ab und sind hier begründet:
 *
 * - **UIDU** druckt die 43. Ergänzung als „Z1*-" mit der Fußnote „zwingend
 *   erforderlich bei MART 02 Storno". Für die Meldung (MART 01) bleibt also `-`;
 *   der Prüfkatalog 43.1.0.0 (Blatt ES, Nr. 22) bestätigt das mit F7635
 *   „belegt und Feld MART=01". Für das Storno gilt die eigene Matrix
 *   {@link PFLICHT_E27_STORNO}.
 * - Die Reservefelder (19, 31, 35, 42, 43, 46, 48) stehen nicht in der Matrix;
 *   sie bleiben immer in Grundstellung.
 */
const MATRIX_MELDUNG: Readonly<Record<string, Zeile>> = {
  MART: ALLE('Z'),
  VONA: ALLE('Z'),
  FANA: ALLE('Z'),
  GESL: ALLE('Z'),
  GEBD: ALLE('Z'),
  GEBO: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', '-'),
  VSNR: ALLE('Z'),
  STSL: ALLE('Z'),
  STRA: ALLE('Z'),
  WKFZ: ALLE('Z'),
  PLZL: ALLE('Z'),
  WORT: ALLE('Z'),
  WTEL: zeile('-', 'Z3', 'Z3', 'Z3', '-', '-'),
  WMAIL: zeile('-', 'Z3', 'Z3', 'Z3', '-', '-'),
  // Block Dienstgeber
  DGNA: ALLE('Z'),
  BKNR: zeile('Z', 'Z1', 'Z1', 'Z1', 'Z', 'Z1'),
  VTBK: zeile('Z', 'Z1', 'Z1', 'Z1', 'Z', 'Z1'),
  DGSTR: ALLE('Z'),
  DGKFZ: ALLE('Z'),
  DGPLZ: ALLE('Z'),
  DGORT: ALLE('Z'),
  DGTEL: ALLE('Z3'),
  DGMAIL: ALLE('Z3'),
  DGWS: zeile('Z', 'Z', 'Z', 'Z', '-', 'Z'),
  BBEG: zeile('Z', 'Z', 'Z', 'Z', 'Z', '-'),
  BEND: zeile('Z', 'Z', 'Z', 'Z', 'Z', '-'),
  MARGDG: zeile('-', '-', 'Z', 'Z', '-', '-'),
  BEAT: zeile('-', 'Z', 'Z', 'Z', '-', '-'),
  ANKZ: zeile('-', 'Z', 'Z', 'Z', '-', '-'),
  STAATHB: zeile('-', 'Z1', 'Z1', 'Z1', '-', '-'),
  // ohne Block
  DGPS: zeile('Z', '-', '-', '-', '-', '-'),
  AGSTAAT: zeile('Z', '-', '-', '-', 'Z', '-'),
  AGNA: zeile('Z1', '-', '-', '-', 'Z1', '-'),
  AGSTR: zeile('Z1', '-', '-', '-', 'Z1', '-'),
  AGPLZ: zeile('Z1', '-', '-', '-', 'Z1', '-'),
  AGORT: zeile('Z1', '-', '-', '-', 'Z1', '-'),
  BFEST: zeile('Z', '-', '-', '-', 'Z', '-'),
  ANABL: zeile('Z', '-', '-', '-', '-', '-'),
  ANABLJ: zeile('Z1', '-', '-', '-', '-', '-'),
  BUEL: zeile('Z', '-', '-', '-', '-', '-'),
  ANATJ: zeile('-', 'Z', 'Z', 'Z', '-', '-'),
  // Block selbständige Tätigkeit
  STFNA: zeile('-', '-', '-', 'Z', '-', '-'),
  STREFO: zeile('-', '-', '-', 'Z3', '-', '-'),
  STSTR: zeile('-', '-', '-', 'Z', '-', '-'),
  STKFZ: zeile('-', '-', '-', 'Z', '-', '-'),
  STPLZ: zeile('-', '-', '-', 'Z', '-', '-'),
  STORT: zeile('-', '-', '-', 'Z', '-', '-'),
  STTEL: zeile('-', '-', '-', 'Z3', '-', '-'),
  STMAIL: zeile('-', '-', '-', 'Z3', '-', '-'),
  STAS: zeile('-', '-', '-', 'Z', '-', '-'),
  START: zeile('-', '-', '-', 'Z', '-', '-'),
  MARGST: zeile('-', '-', '-', 'Z', '-', '-'),
  // ohne Block
  UIDM: ALLE('Z'),
  UIDU: ALLE('-'),
  FNA1: zeile('-', '-', '-', '-', 'Z3', '-'),
  ANIV: zeile('-', '-', '-', '-', 'Z', '-'),
  VSNA: zeile('-', '-', '-', '-', 'Z3', 'Z3'),
  APNR: zeile('-', '-', '-', '-', 'Z3', '-'),
  AAKT: zeile('-', '-', '-', '-', 'Z3', '-'),
  // Block Arbeitsorte
  AOST: zeile('-', 'Z', 'Z', 'Z', '-', 'Z'),
  AOKBS: zeile('-', 'Z', 'Z', 'Z', '-', 'Z'),
  AOFNSN: zeile('-', 'Z1', 'Z1', 'Z1', '-', 'Z'),
  AOSTRA: zeile('-', 'Z1', 'Z1', 'Z1', '-', 'Z'),
  AOPLZL: zeile('-', 'Z1', 'Z1', 'Z1', '-', 'Z'),
  AOORT: zeile('-', 'Z1', 'Z1', 'Z1', '-', 'Z'),
  AUET: zeile('-', '-', '-', 'Z', '-', '-'),
  // ohne Block
  AZRV: zeile('-', 'Z', 'Z', 'Z', '-', '-'),
  AZRB: zeile('-', 'Z', 'Z', 'Z', '-', '-'),
  ANFL: zeile('Z', 'Z', 'Z', 'Z', '-', '-'),
  AUSMTE: zeile('-', '-', '-', '-', '-', 'Z'),
  ANTVON: zeile('-', '-', '-', '-', '-', 'Z'),
  ANTBIS: zeile('-', '-', '-', '-', '-', 'Z'),
};

/**
 * Matrix aus Kapitel E.27.2, „zwingende Angabe je Satzart, Meldeart ‚02‘ =
 * Storno" (Seiten 300–303), neu in der 43. Ergänzung. Außer MART, UIDM und UIDU
 * bleibt alles in Grundstellung; die Beitragskontonummer ist bei E1–E5 `Z1*`,
 * bei EA `Z1`. Die Fußnote auf Seite 303: „Für Anträge (MART 01), bei denen zum
 * Zeitpunkt der Antragstellung noch keine gültige UUID gemäß dem einheitlichen
 * UUID-Standard verwendet wurde, sind in der Stornomeldung (MART 02) zusätzlich
 * die im ursprünglichen Antrag übermittelte/n Beitragskontonummern (BKNR)
 * verpflichtend mitzusenden." Ob das zutrifft, weiß nur der Aufrufer — die
 * Stufe bleibt `Z1` und wird nicht erzwungen.
 */
const MATRIX_STORNO: Readonly<Record<string, Zeile>> = Object.fromEntries(
  Object.keys(MATRIX_MELDUNG).map((feld) => {
    if (feld === 'MART' || feld === 'UIDM' || feld === 'UIDU') return [feld, ALLE('Z')];
    if (feld === 'BKNR') return [feld, ALLE('Z1')];
    return [feld, ALLE('-')];
  }),
);

function nachSatzart(
  matrix: Readonly<Record<string, Zeile>>,
): Readonly<Record<E27Satzart, Readonly<Record<string, Pflichtstufe>>>> {
  return Object.freeze(
    SATZARTEN.reduce(
      (acc, sa) => {
        acc[sa] = Object.freeze(Object.fromEntries(Object.entries(matrix).map(([f, z]) => [f, z[sa]])));
        return acc;
      },
      {} as Record<E27Satzart, Record<string, Pflichtstufe>>,
    ),
  );
}

/** Pflichtstufen der Meldung (MART 01) je Satzart, Blockfelder unter ihrem Grundnamen. */
export const PFLICHT_E27 = nachSatzart(MATRIX_MELDUNG);

/** Pflichtstufen des Stornos (MART 02) je Satzart, Blockfelder unter ihrem Grundnamen. */
export const PFLICHT_E27_STORNO = nachSatzart(MATRIX_STORNO);

/** Ein Block des Satzes: Grundnamen seiner Felder und die Anzahl der Plätze. */
interface Block {
  name: string;
  felder: readonly string[];
  plaetze: number;
}

const ohneReserve = (felder: readonly { name: string }[]): string[] =>
  felder.map((f) => f.name).filter((n) => n !== 'RESE');

export const BLOECKE: readonly Block[] = [
  { name: 'Dienstgeber', felder: ohneReserve(BLOCK_DIENSTGEBER), plaetze: PLAETZE_DIENSTGEBER },
  {
    name: 'selbständige Tätigkeit',
    felder: ohneReserve(BLOCK_SELBSTAENDIG),
    plaetze: PLAETZE_SELBSTAENDIG,
  },
  { name: 'Arbeitsort', felder: ohneReserve(BLOCK_ARBEITSORT), plaetze: PLAETZE_ARBEITSORT },
];

const BLOCK_VON: ReadonlyMap<string, Block> = new Map(
  BLOECKE.flatMap((b) => b.felder.map((f) => [f, b] as const)),
);

/**
 * Wie oft ein Block bei der Meldung belegt sein muss bzw. darf. Quellen:
 *
 * - Dienstgeber (Seite 291 und 295): „bei E3 mindestens 2mal, bei E4 mindestens
 *   1mal erforderlich, bei E1, E2, E5 und EA nur 1mal zulässig"; höchstens 5.
 *   Dazu Prüfkatalog Blatt ES: F7610 „Block 1 leer" (alle Satzarten), F7515
 *   „Block befüllt (2 bis 5)" (E1, E2, E5, EA), F7622 „Block 2 leer" (E3).
 * - Selbständige Tätigkeit (Seite 295): „für E4 mindestens 1mal zu verwenden und
 *   können max. 3mal wiederholt werden". Bei allen anderen Satzarten stehen die
 *   Felder 50–60 auf `-`.
 * - Arbeitsorte (Seite 294): „bei E2 – E4, bei EA mindestens 1 mal"; höchstens
 *   32. Dazu F7608 „Block 1 leer" (E2, E3, E4). Bei E1 und E5 stehen die Felder
 *   68–74 auf `-`.
 */
export const BLOCK_ANZAHL: Readonly<
  Record<E27Satzart, Readonly<Record<string, { min: number; max: number }>>>
> = {
  E1: {
    Dienstgeber: { min: 1, max: 1 },
    'selbständige Tätigkeit': { min: 0, max: 0 },
    Arbeitsort: { min: 0, max: 0 },
  },
  E2: {
    Dienstgeber: { min: 1, max: 1 },
    'selbständige Tätigkeit': { min: 0, max: 0 },
    Arbeitsort: { min: 1, max: 32 },
  },
  E3: {
    Dienstgeber: { min: 2, max: 5 },
    'selbständige Tätigkeit': { min: 0, max: 0 },
    Arbeitsort: { min: 1, max: 32 },
  },
  E4: {
    Dienstgeber: { min: 1, max: 5 },
    'selbständige Tätigkeit': { min: 1, max: 3 },
    Arbeitsort: { min: 1, max: 32 },
  },
  E5: {
    Dienstgeber: { min: 1, max: 1 },
    'selbständige Tätigkeit': { min: 0, max: 0 },
    Arbeitsort: { min: 0, max: 0 },
  },
  EA: {
    Dienstgeber: { min: 1, max: 1 },
    'selbständige Tätigkeit': { min: 0, max: 0 },
    Arbeitsort: { min: 1, max: 32 },
  },
};

const NUMERISCH: ReadonlySet<string> = new Set(FELDER_E27.filter((f) => f.typ === 'n').map((f) => f.name));

/**
 * Belegt im Sinne der Feldtyp-Beschreibung (Seite 295): bei numerischen Feldern
 * ist ein Wert aus lauter Nullen die Grundstellung, bei alphanumerischen ist es
 * nur das Leerfeld. Dieselbe Regel wie in `pflicht-e29.ts`.
 */
export function belegtE27(name: string, wert: string | undefined): boolean {
  if (wert === undefined) return false;
  const t = wert.trim();
  if (t === '') return false;
  if (NUMERISCH.has(name) && /^0+$/.test(t)) return false;
  return true;
}

/** Ist Platz `platz` des Blocks belegt — also irgendein Feld darin? */
export function platzBelegt(
  block: Block,
  platz: number,
  werte: Readonly<Record<string, string | undefined>>,
): boolean {
  return block.felder.some((f) => belegtE27(`${f}_${platz}`, werte[`${f}_${platz}`]));
}

function text(satzart: E27Satzart, meldeart: E27Meldeart): string {
  return `Satzart ${satzart} (${E27_SATZART_TEXT[satzart]}), ${meldeart === '01' ? 'Meldung' : 'Storno'}`;
}

/**
 * Prüft die objektiv entscheidbaren Stufen: `Z` muss belegt sein, `-` muss leer
 * bleiben, und die Blöcke müssen in der zulässigen Anzahl belegt sein. Bei
 * Blockfeldern gilt `Z` für jeden belegten Platz, `-` für alle Plätze. `Z1` hängt
 * an einer fachlichen Bedingung und wird — soweit die Bedingung im Satz selbst
 * steht — in `pruefung-e27.ts` geprüft; `Z3` ist freigestellt.
 *
 * Belegte Plätze müssen lückenlos vorne liegen: Ein Satz mit Dienstgeber auf
 * Platz 2, aber leerem Platz 1 wiese der Prüfkatalog als F7610 („Block 1 leer")
 * ab, obwohl die Anzahl stimmt.
 */
export function pruefePflichtE27(
  satzart: E27Satzart,
  meldeart: E27Meldeart,
  werte: Readonly<Record<string, string | undefined>>,
): void {
  const matrix = meldeart === '01' ? PFLICHT_E27[satzart] : PFLICHT_E27_STORNO[satzart];
  const wo = text(satzart, meldeart);

  for (const [feld, stufe] of Object.entries(matrix)) {
    const block = BLOCK_VON.get(feld);
    if (block === undefined) {
      if (stufe === 'Z' && !belegtE27(feld, werte[feld])) {
        throw new EldaError(`${wo}: Feld ${feld} ist zwingend anzugeben.`);
      }
      if (stufe === '-' && belegtE27(feld, werte[feld])) {
        throw new EldaError(`${wo}: Feld ${feld} ist in Grundstellung zu übermitteln.`);
      }
      continue;
    }
    for (let platz = 1; platz <= block.plaetze; platz++) {
      const name = `${feld}_${platz}`;
      if (stufe === '-' && belegtE27(name, werte[name])) {
        throw new EldaError(`${wo}: Feld ${name} ist in Grundstellung zu übermitteln.`);
      }
      if (stufe === 'Z' && platzBelegt(block, platz, werte) && !belegtE27(name, werte[name])) {
        throw new EldaError(
          `${wo}: Feld ${name} ist zwingend anzugeben (Block ${block.name}, Platz ${platz}).`,
        );
      }
    }
  }

  if (meldeart === '02') return;

  for (const block of BLOECKE) {
    const belegt: number[] = [];
    for (let platz = 1; platz <= block.plaetze; platz++) {
      if (platzBelegt(block, platz, werte)) belegt.push(platz);
    }
    const { min, max } = BLOCK_ANZAHL[satzart][block.name]!;
    if (belegt.some((platz, i) => platz !== i + 1)) {
      throw new EldaError(
        `${wo}: Block ${block.name} ist lückenhaft belegt; die Plätze sind ab 1 zu füllen.`,
      );
    }
    if (belegt.length < min || belegt.length > max) {
      throw new EldaError(
        `${wo}: Block ${block.name} ist ${belegt.length}-mal belegt, zulässig ${min === max ? `genau ${min}` : `${min} bis ${max}`}.`,
      );
    }
  }
}
