import type { RohSatz } from './bestand';
import type { Befund } from './pruefung-e32';

/**
 * Zulässige Abfolge der Satzarten im mBGM-Paket, Kapitel E.32.2.2.6
 * (Seiten 361–364).
 *
 * Das Dokument gibt dort eine **Übergangstabelle** vor: je Vorgängersatzart die
 * erlaubten Nachfolger. Genau darauf verweist der Prüfkatalog bei `F9070`
 * („Aufbau des mBGM-Pakets nicht korrekt (siehe DM Org., Kapitel E.32.2.2.6)")
 * — die Regel selbst steht nicht im Katalog, sondern hier.
 *
 * Da die Zugehörigkeit der Sätze allein aus ihrer Reihenfolge folgt, ist diese
 * Tabelle die einzige Stelle, an der sich ein strukturell falsches Paket
 * überhaupt erkennen lässt.
 */

/** Ein erlaubter Übergang. */
interface Uebergang {
  /** Satzart des Nachfolgers, oder `NEXT` für den Sammelbegriff des Dokuments. */
  readonly nach: string;
  /**
   * Der Übergang gilt nur, wenn die gerade offene mBGM eine dieser Satzarten
   * hat. Das Dokument regelt das über Fußnoten: Ein `V1` darf nur dann von
   * einem `T1`/`T4` gefolgt werden, wenn die mBGM ein `G1` ist — bei `G3` sind
   * es `T2`/`T5`, bei `G5` `T3`/`T6` (Fußnoten 70–75 bzw. 77–81).
   */
  readonly nurBeiMbgm?: readonly string[];
  /**
   * „nur für das BMJ" (Fußnoten 67–69). Betrifft die Satzarten `G7`/`R7`
   * („ohne Versicherten") und den Übergang `G7 → T1`. Für gewöhnliche
   * Dienstgeber ist dieser Weg nicht vorgesehen.
   */
  readonly nurBmj?: boolean;
}

/**
 * Was `NEXT` umfasst.
 *
 * **Hier widerspricht sich das Dokument.** Die Tabellenspalte schreibt
 * „nächste mBGM oder mBGM-Paket-**Ende**", die Anmerkung darunter zählt dagegen
 * `PS` (Paket-**Beginn**) auf und nennt `PE` nicht — auf Seite 362 für die
 * Selbstabrechnung, auf Seite 364 wortgleich für die Vorschreibung.
 *
 * Aufgelöst wird zugunsten der Spalte: Enthielte `NEXT` kein `PE`, könnte kein
 * Paket je enden, denn `PE` ist von keiner anderen Satzart aus erreichbar. Das
 * in der Anmerkung genannte `PS` ergibt dagegen erst *nach* einem `PE` einen
 * Sinn — dort steht es in der Tabelle ohnehin als eigene Zeile
 * (`PE → PS`, `PE → PV`).
 *
 * Diese Auslegung ist begründet, aber nicht durch den Wortlaut gedeckt. Sollte
 * ELDA ein Paket mit dieser Struktur zurückweisen, ist hier zu suchen.
 */
const NEXT_SELBSTABRECHNUNG = ['G1', 'G3', 'G5', 'G7', 'R1', 'R3', 'R5', 'R7', 'PE'] as const;
const NEXT_VORSCHREIBUNG = ['G2', 'G4', 'G6', 'R2', 'R4', 'R6', 'PE'] as const;

/** Übergangstabelle der Selbstabrechnung (Seiten 361–362). */
const ABFOLGE_SELBSTABRECHNUNG: Readonly<Record<string, readonly Uebergang[]>> = {
  PS: [
    { nach: 'G1' },
    { nach: 'G3' },
    { nach: 'G5' },
    { nach: 'G7', nurBmj: true },
    { nach: 'R1' },
    { nach: 'R3' },
    { nach: 'R5' },
    { nach: 'R7', nurBmj: true },
  ],
  G1: [{ nach: 'T1' }, { nach: 'T4' }],
  G3: [{ nach: 'T2' }, { nach: 'T5' }],
  G5: [{ nach: 'T3' }, { nach: 'T6' }],
  G7: [{ nach: 'T1', nurBmj: true }],
  R1: [{ nach: 'NEXT' }],
  R3: [{ nach: 'NEXT' }],
  R5: [{ nach: 'NEXT' }],
  R7: [{ nach: 'NEXT' }],
  T1: [{ nach: 'BS' }],
  T4: [{ nach: 'T1' }, { nach: 'T4' }, { nach: 'NEXT' }],
  T2: [{ nach: 'BS' }],
  T5: [{ nach: 'T5' }, { nach: 'NEXT' }],
  T3: [{ nach: 'BS' }],
  T6: [{ nach: 'T3' }, { nach: 'T6' }, { nach: 'NEXT' }],
  BS: [{ nach: 'V1' }],
  V1: [
    { nach: 'V1' },
    { nach: 'BS' },
    { nach: 'T1', nurBeiMbgm: ['G1'] },
    { nach: 'T4', nurBeiMbgm: ['G1'] },
    { nach: 'T2', nurBeiMbgm: ['G3'] },
    { nach: 'T5', nurBeiMbgm: ['G3'] },
    { nach: 'T3', nurBeiMbgm: ['G5'] },
    { nach: 'T6', nurBeiMbgm: ['G5'] },
    { nach: 'NEXT' },
  ],
  // PE beendet das Paket. Ein weiteres Paket darf folgen — auch eines des
  // jeweils anderen Verfahrens (Fußnoten 76 und 82).
  PE: [{ nach: 'PS' }, { nach: 'PV' }],
};

/** Übergangstabelle der Vorschreibung (Seiten 363–364). */
const ABFOLGE_VORSCHREIBUNG: Readonly<Record<string, readonly Uebergang[]>> = {
  PV: [{ nach: 'G2' }, { nach: 'G4' }, { nach: 'G6' }, { nach: 'R2' }, { nach: 'R4' }, { nach: 'R6' }],
  G2: [{ nach: 'T1' }, { nach: 'T4' }],
  // Anders als bei der Selbstabrechnung (G3 → T2, T5) führt die Tabelle für den
  // Vorschreiber nur T2 auf; T5 kommt dort überhaupt nicht vor.
  G4: [{ nach: 'T2' }],
  G6: [{ nach: 'T3' }, { nach: 'T6' }],
  R2: [{ nach: 'NEXT' }],
  R4: [{ nach: 'NEXT' }],
  R6: [{ nach: 'NEXT' }],
  T1: [{ nach: 'BV' }],
  T4: [{ nach: 'T1' }, { nach: 'T4' }, { nach: 'NEXT' }],
  T2: [{ nach: 'BV' }],
  T3: [{ nach: 'BV' }],
  T6: [{ nach: 'T3' }, { nach: 'T6' }, { nach: 'NEXT' }],
  BV: [{ nach: 'V2' }],
  V2: [
    { nach: 'V2' },
    { nach: 'BV' },
    { nach: 'T1', nurBeiMbgm: ['G2'] },
    { nach: 'T4', nurBeiMbgm: ['G2'] },
    { nach: 'T2', nurBeiMbgm: ['G4'] },
    { nach: 'T3', nurBeiMbgm: ['G6'] },
    { nach: 'T6', nurBeiMbgm: ['G6'] },
    { nach: 'NEXT' },
  ],
  PE: [{ nach: 'PV' }, { nach: 'PS' }],
};

/** Satzarten, die eine mBGM eröffnen. */
const MBGM_ARTEN = new Set([
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
]);

/** Was aus dem gegebenen Vorgänger heraus erlaubt ist, `NEXT` aufgelöst. */
function erlaubteNachfolger(
  von: string,
  selbstabrechnung: boolean,
  offeneMbgm: string | undefined,
  bmj: boolean,
): Set<string> {
  const tabelle = selbstabrechnung ? ABFOLGE_SELBSTABRECHNUNG : ABFOLGE_VORSCHREIBUNG;
  const next = selbstabrechnung ? NEXT_SELBSTABRECHNUNG : NEXT_VORSCHREIBUNG;
  const erlaubt = new Set<string>();
  for (const u of tabelle[von] ?? []) {
    if (u.nurBmj && !bmj) continue;
    if (u.nurBeiMbgm && (!offeneMbgm || !u.nurBeiMbgm.includes(offeneMbgm))) continue;
    if (u.nach === 'NEXT') for (const n of next) erlaubt.add(n);
    else erlaubt.add(u.nach);
  }
  return erlaubt;
}

/**
 * Prüft die Satzfolge eines mBGM-Pakets gegen die Übergangstabelle aus
 * Kapitel E.32.2.2.6.
 *
 * @param saetze die geordnete Satzfolge, wie `erstelleMbgmPaket` sie liefert
 * @param bmj erlaubt die nur für das Bundesministerium für Justiz vorgesehenen
 *   Wege (`G7`/`R7`, „mBGM ohne Versicherten"). Standard ist `false` — für
 *   jeden gewöhnlichen Dienstgeber sind diese Satzarten laut Fußnote nicht
 *   vorgesehen, und ein stillschweigend erlaubter Weg dorthin würde eine
 *   Meldung erzeugen, die ELDA zurückweist.
 * @returns Befunde mit dem Fehlercode `F9070`; leer, wenn die Folge zulässig ist
 */
export function pruefeAbfolge(saetze: readonly RohSatz[], bmj = false): Befund[] {
  if (saetze.length === 0) return [];
  const kopf = saetze[0];
  if (!kopf) return [];
  const selbstabrechnung = kopf.satzart === 'PS';

  const befunde: Befund[] = [];
  let offeneMbgm: string | undefined;

  for (let i = 0; i < saetze.length - 1; i++) {
    const von = saetze[i];
    const nach = saetze[i + 1];
    if (!von || !nach) break;
    if (MBGM_ARTEN.has(von.satzart)) offeneMbgm = von.satzart;

    const erlaubt = erlaubteNachfolger(von.satzart, selbstabrechnung, offeneMbgm, bmj);
    if (erlaubt.size === 0) {
      befunde.push({
        code: 'F9070',
        schwere: 'fehler',
        meldung:
          `Satz ${i + 1}: Auf '${von.satzart}' darf im ${selbstabrechnung ? 'Selbstabrechner' : 'Vorschreibe'}-Verfahren ` +
          'überhaupt kein Satz folgen (Kapitel E.32.2.2.6).',
      });
      continue;
    }
    if (!erlaubt.has(nach.satzart)) {
      befunde.push({
        code: 'F9070',
        schwere: 'fehler',
        meldung:
          `Satz ${i + 2}: Auf '${von.satzart}' darf '${nach.satzart}' nicht folgen. ` +
          `Zulässig wären: ${[...erlaubt].sort().join(', ')} (Kapitel E.32.2.2.6).`,
      });
    }
  }

  return befunde;
}

/**
 * Die Übergangstabellen als Daten — für Aufrufer, die eine eigene Prüfung oder
 * Darstellung bauen wollen.
 */
export const ABFOLGE = {
  selbstabrechnung: ABFOLGE_SELBSTABRECHNUNG,
  vorschreibung: ABFOLGE_VORSCHREIBUNG,
  nextSelbstabrechnung: NEXT_SELBSTABRECHNUNG,
  nextVorschreibung: NEXT_VORSCHREIBUNG,
} as const;
