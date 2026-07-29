/**
 * Begründungscodes für Ausfall und Außerbetriebnahme.
 *
 * Quelle: BMF, „Registrierkassen-Webservice", Abschnitt 4 (Stand 12.05.2017).
 * Die Wortlaute sind wörtlich übernommen — sie erscheinen in FinanzOnline an
 * derselben Stelle und sollen dort wiedererkennbar sein.
 *
 * Welche Codes zulässig sind, hängt am Vorgang: der Ausfall einer
 * Signatur- bzw. Siegelerstellungseinheit kennt andere Gründe als der Ausfall
 * einer Registrierkasse. Die Außerbetriebnahme dagegen teilt sich beide
 * Einheiten (Abschnitt 4.3 gilt ausdrücklich für SEE **und** Kasse).
 */

export type BegruendungVorgang = 'ausfall_see' | 'ausfall_kasse' | 'ausserbetriebnahme';

export interface BegruendungInfo {
  code: number;
  text: string;
}

/** Ausfall Signatur- bzw. Siegelerstellungseinheit (Abschnitt 4.1). */
const AUSFALL_SEE: readonly BegruendungInfo[] = [
  { code: 1, text: 'Diebstahl oder sonstiger Verlust' },
  { code: 2, text: 'Signatur- bzw. Siegelerstellung unmöglich oder fehlerhaft' },
  { code: 99, text: 'Sonstiger Grund' },
];

/** Ausfall Registrierkasse (Abschnitt 4.2). */
const AUSFALL_KASSE: readonly BegruendungInfo[] = [
  { code: 1, text: 'Diebstahl oder sonstiger Verlust' },
  { code: 5, text: 'Erfassung der Geschäftsvorfälle oder Belegerstellung nicht korrekt möglich' },
  { code: 99, text: 'Sonstiger Grund' },
];

/** Außerbetriebnahme — gilt für SEE und Registrierkasse gleichermaßen (Abschnitt 4.3). */
const AUSSERBETRIEBNAHME: readonly BegruendungInfo[] = [
  { code: 6, text: 'Planmäßige Außerbetriebnahme' },
  { code: 7, text: 'Außerbetriebnahme aufgrund eines irreparablen Ausfalls' },
];

export const BEGRUENDUNGEN: Record<BegruendungVorgang, readonly BegruendungInfo[]> = {
  ausfall_see: AUSFALL_SEE,
  ausfall_kasse: AUSFALL_KASSE,
  ausserbetriebnahme: AUSSERBETRIEBNAHME,
};

/** Die für einen Vorgang zulässigen Codes, in der Reihenfolge der Spec. */
export function begruendungCodes(vorgang: BegruendungVorgang): readonly number[] {
  return BEGRUENDUNGEN[vorgang].map((b) => b.code);
}

/**
 * Amtlicher Wortlaut zu einem Code, oder `null`, wenn der Code für diesen
 * Vorgang nicht vorgesehen ist. Bewusst `null` statt eines geratenen Textes:
 * ein erfundener Grund wäre in einer Behördenmeldung schlimmer als keiner.
 */
export function begruendungText(vorgang: BegruendungVorgang, code: number): string | null {
  return BEGRUENDUNGEN[vorgang].find((b) => b.code === code)?.text ?? null;
}

/** Ob der Code für diesen Vorgang zulässig ist. */
export function istBegruendungZulaessig(vorgang: BegruendungVorgang, code: number): boolean {
  return begruendungText(vorgang, code) !== null;
}
