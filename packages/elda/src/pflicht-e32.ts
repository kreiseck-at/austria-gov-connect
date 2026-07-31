/**
 * Pflichtmatrix der monatlichen Beitragsgrundlagenmeldung, Kapitel E.32.1
 * (Seiten 344–348).
 *
 * Jede Zelle unten ist an den **gerenderten Seitenbildern** abgelesen, nicht am
 * `pdftotext`-Auszug. Bei E.29 sind auf genau diesem Weg elf Fehler entstanden:
 * Verbundene Zellen verschwinden im Textauszug spurlos und tauchen dort als
 * scheinbar eigenständige Zeilen wieder auf.
 */

/** Satzarten des mBGM-Pakets. */
export type PaketArt = 'PS' | 'PV' | 'PE';
/** Satzarten der mBGM selbst — Meldung (G) und Storno (R). */
export type MbgmArt =
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7'
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
/** Satzarten der Tarifblöcke. */
export type TarifblockArt = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
/** Satzarten der Verrechnungsbasis. */
export type VerrechnungsbasisArt = 'BS' | 'BV';
/** Satzarten der Verrechnungsposition. */
export type VerrechnungspositionArt = 'V1' | 'V2';

/** Jede in E.32 vorkommende Satzart. */
export type E32Satzart =
  | PaketArt | MbgmArt | TarifblockArt | VerrechnungsbasisArt | VerrechnungspositionArt;

/**
 * Pflichtstufen laut den Legenden zu Kapitel E.32.1.
 *
 * `Z4` ist neu gegenüber E.29 und **nicht** dasselbe wie `Z3`: Das Feld darf
 * belegt werden, sein Inhalt wird aber von der Gegenstelle **verworfen**. Wer
 * sich darauf verlässt, dass ein beim Vorschreiber gemeldeter Betrag ankommt,
 * irrt — dort rechnet die ÖGK selbst.
 */
export type Pflichtstufe = 'Z' | 'Z1' | 'Z3' | 'Z4' | '-';

/** Klartext je Satzart, für Fehlermeldungen und Doku. */
export const E32_SATZART_TEXT: Readonly<Record<E32Satzart, string>> = {
  PS: 'mBGM-Paket Beginn (Selbstabrechner)',
  PV: 'mBGM-Paket Beginn (Vorschreiber)',
  PE: 'mBGM-Paket Ende',
  G1: 'mBGM (Selbstabrechner)',
  G2: 'mBGM (Vorschreiber)',
  G3: 'mBGM fallweise Beschäftigte (Selbstabrechner)',
  G4: 'mBGM fallweise Beschäftigte (Vorschreiber)',
  G5: 'mBGM kürzer als ein Monat vereinbarte Beschäftigung (Selbstabrechner)',
  G6: 'mBGM kürzer als ein Monat vereinbarte Beschäftigung (Vorschreiber)',
  G7: 'mBGM ohne Versicherten',
  R1: 'Storno mBGM (Selbstabrechner)',
  R2: 'Storno mBGM (Vorschreiber)',
  R3: 'Storno mBGM fallweise Beschäftigte (Selbstabrechner)',
  R4: 'Storno mBGM fallweise Beschäftigte (Vorschreiber)',
  R5: 'Storno mBGM kürzer als ein Monat vereinbarte Beschäftigung (Selbstabrechner)',
  R6: 'Storno mBGM kürzer als ein Monat vereinbarte Beschäftigung (Vorschreiber)',
  R7: 'Storno mBGM ohne Versicherten',
  T1: 'Tarifblock',
  T2: 'Tarifblock fallweise Beschäftigte',
  T3: 'Tarifblock kürzer als ein Monat vereinbarte Beschäftigung',
  T4: 'Tarifblock ohne Verrechnung',
  T5: 'Tarifblock fallweise Beschäftigte ohne Verrechnung',
  T6: 'Tarifblock kürzer als ein Monat vereinbarte Beschäftigung ohne Verrechnung',
  BS: 'Verrechnungsbasis (Selbstabrechner)',
  BV: 'Verrechnungsbasis (Vorschreiber)',
  V1: 'Verrechnungsposition (Selbstabrechner)',
  V2: 'Verrechnungsposition (Vorschreiber)',
};

/** Satzarten, die zur Selbstabrechnung gehören. */
export const SELBSTABRECHNER: ReadonlySet<E32Satzart> = new Set<E32Satzart>([
  'PS', 'G1', 'G3', 'G5', 'R1', 'R3', 'R5', 'BS', 'V1',
]);
/** Satzarten, die zum Vorschreibeverfahren gehören. */
export const VORSCHREIBER: ReadonlySet<E32Satzart> = new Set<E32Satzart>([
  'PV', 'G2', 'G4', 'G6', 'R2', 'R4', 'R6', 'BV', 'V2',
]);

// --- mBGM-Paket, Seite 344 -------------------------------------------------

/** Pflichtstufen des mBGM-Paket-Satzes je Satzart. */
export const PFLICHT_PAKET: Readonly<Record<string, Readonly<Record<PaketArt, Pflichtstufe>>>> = {
  REFP: { PS: 'Z', PV: 'Z', PE: 'Z' },
  BKNR: { PS: 'Z', PV: 'Z', PE: '-' },
  DGNA: { PS: 'Z', PV: 'Z', PE: '-' },
  MPKE: { PS: 'Z3', PV: 'Z3', PE: '-' },
  JAGB: { PS: 'Z', PV: 'Z', PE: '-' },
  DTEL: { PS: 'Z3', PV: 'Z3', PE: '-' },
  MAIL: { PS: 'Z3', PV: 'Z3', PE: '-' },
  BZRM: { PS: 'Z', PV: 'Z', PE: '-' },
  GSVZ: { PS: 'Z1', PV: 'Z4', PE: '-' },
  GSUM: { PS: 'Z1', PV: 'Z4', PE: '-' },
  ANZM: { PS: 'Z', PV: 'Z', PE: 'Z' },
};

// --- mBGM, Seiten 344–346 --------------------------------------------------

type MbgmZeile = Readonly<Record<MbgmArt, Pflichtstufe>>;

/**
 * Hilfskonstruktor: Die G- und R-Satzarten unterscheiden sich fast nur nach
 * Verfahren (Selbstabrechner/Vorschreiber) und danach, ob es eine Meldung oder
 * ein Storno ist. `G7`/`R7` („ohne Versicherten") fallen aus beiden Mustern
 * heraus und werden deshalb einzeln übergeben.
 */
function mbgmZeile(
  gSelbst: Pflichtstufe,
  gVorschreiber: Pflichtstufe,
  rSelbst: Pflichtstufe,
  rVorschreiber: Pflichtstufe,
  g7: Pflichtstufe,
  r7: Pflichtstufe,
): MbgmZeile {
  return {
    G1: gSelbst, G3: gSelbst, G5: gSelbst,
    G2: gVorschreiber, G4: gVorschreiber, G6: gVorschreiber,
    R1: rSelbst, R3: rSelbst, R5: rSelbst,
    R2: rVorschreiber, R4: rVorschreiber, R6: rVorschreiber,
    G7: g7, R7: r7,
  };
}

/**
 * Pflichtstufen des mBGM-Satzes.
 *
 * Zu `REFV`/`VSNR`: Bei den G-Satzarten druckt das Dokument **eine verbundene
 * Zelle** über beide Felder mit `Z*` und der Fußnote „wenn keine
 * Versicherungsnummer angegeben wird, muss ein Referenzwert auf eine VSNR
 * Anforderung angegeben werden". Welches der beiden Felder gemeint ist, steht
 * dort nicht — es ist eine Alternative. Deshalb hier `Z1` statt `Z`; die
 * eigentliche Bedingung steht in {@link ALTERNATIVGRUPPEN_E32}.
 *
 * Bei den R-Satzarten sind die Zellen **getrennt**: `REFV` ist `-`, `VSNR` ist
 * `Z`. Die Alternative gilt dort also nicht.
 */
export const PFLICHT_MBGM: Readonly<Record<string, MbgmZeile>> = {
  //                     G1/3/5  G2/4/6  R1/3/5  R2/4/6   G7    R7
  REFW: mbgmZeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  REFU: mbgmZeile('-', '-', 'Z', 'Z', '-', 'Z'),
  REFV: mbgmZeile('Z1', 'Z1', '-', '-', '-', '-'),
  VSNR: mbgmZeile('Z1', 'Z1', 'Z', 'Z', '-', '-'),
  FANA: mbgmZeile('Z', 'Z', '-', '-', '-', '-'),
  VONA: mbgmZeile('Z', 'Z', '-', '-', '-', '-'),
  VSUM: mbgmZeile('Z1', 'Z4', 'Z1', 'Z4', 'Z', 'Z'),
  VERG: mbgmZeile('Z', 'Z', '-', '-', '-', '-'),
  INF1: mbgmZeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  INF2: mbgmZeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
};

/**
 * Verbundene Zellen der Pflichtmatrix: Felder, die sich im Dokument eine
 * einzige Pflichtstufe teilen. Mindestens eines der genannten Felder muss
 * belegt sein.
 *
 * Fußnote auf den Seiten 344 und 345: „wenn keine Versicherungsnummer
 * angegeben wird, muss ein Referenzwert auf eine VSNR Anforderung angegeben
 * werden."
 *
 * Gilt **nur** für G1–G6. Nicht für die Storno-Satzarten (dort ist VSNR einzeln
 * zwingend) und nicht für G7/R7 (dort gibt es keinen Versicherten).
 */
export const ALTERNATIVGRUPPEN_E32: ReadonlyArray<{
  readonly satzarten: readonly MbgmArt[];
  readonly felder: readonly string[];
  readonly begruendung: string;
}> = [
  {
    satzarten: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'],
    felder: ['VSNR', 'REFV'],
    begruendung:
      'Entweder die Versicherungsnummer oder der Referenzwert der VSNR-Anforderung ' +
      'muss angegeben sein (E.32.1, Fußnote zu den Seiten 344 und 345).',
  },
];

// --- Tarifblöcke, Seite 347 ------------------------------------------------

/** Pflichtstufen des Tarifblocks `T1`/`T4`. */
export const PFLICHT_TARIFBLOCK: Readonly<Record<string, Readonly<Record<'T1' | 'T4', Pflichtstufe>>>> = {
  BSGR: { T1: 'Z', T4: 'Z' },
  ERGB: { T1: 'Z1', T4: 'Z1' },
  VVON: { T1: 'Z', T4: 'Z' },
  KEUE: { T1: 'Z1', T4: '-' },
};

/** Pflichtstufen des Tarifblocks fallweise Beschäftigte `T2`/`T5`. */
export const PFLICHT_TARIFBLOCK_FALLWEISE: Readonly<
  Record<string, Readonly<Record<'T2' | 'T5', Pflichtstufe>>>
> = {
  BSGR: { T2: 'Z', T5: 'Z' },
  ERGB: { T2: 'Z1', T5: 'Z1' },
  FTAG: { T2: 'Z', T5: 'Z' },
};

/** Pflichtstufen des Tarifblocks kürzer als ein Monat `T3`/`T6`. */
export const PFLICHT_TARIFBLOCK_KURZ: Readonly<
  Record<string, Readonly<Record<'T3' | 'T6', Pflichtstufe>>>
> = {
  BSGR: { T3: 'Z', T6: 'Z' },
  ERGB: { T3: 'Z1', T6: 'Z1' },
  BTAB: { T3: 'Z', T6: 'Z' },
  BTBS: { T3: 'Z', T6: 'Z' },
  KEUE: { T3: 'Z1', T6: '-' },
};

// --- Verrechnung, Seite 348 ------------------------------------------------

/** Pflichtstufen der Verrechnungsbasis `BS`/`BV`. */
export const PFLICHT_VERRECHNUNGSBASIS: Readonly<
  Record<string, Readonly<Record<VerrechnungsbasisArt, Pflichtstufe>>>
> = {
  VBTY: { BS: 'Z', BV: 'Z' },
  VBBT: { BS: 'Z', BV: 'Z' },
};

/**
 * Pflichtstufen der Verrechnungsposition `V1`/`V2`.
 *
 * **Hier liegt der Kernunterschied der beiden Verfahren.** Beim Vorschreiber
 * sind Prozentsatz und Beitrag durchgehend `Z4`: Sie dürfen mitgegeben werden,
 * werden aber nicht übernommen. Gemeldet wird dort nur, welcher Positionstyp
 * zutrifft — gerechnet wird bei der ÖGK.
 */
export const PFLICHT_VERRECHNUNGSPOSITION: Readonly<
  Record<string, Readonly<Record<VerrechnungspositionArt, Pflichtstufe>>>
> = {
  VPTY: { V1: 'Z', V2: 'Z' },
  VPVZ: { V1: 'Z', V2: 'Z4' },
  VPTA: { V1: 'Z', V2: 'Z4' },
  RSVZ: { V1: 'Z', V2: 'Z4' },
  RSUM: { V1: 'Z1', V2: 'Z4' },
};

for (const matrix of [
  PFLICHT_PAKET,
  PFLICHT_MBGM,
  PFLICHT_TARIFBLOCK,
  PFLICHT_TARIFBLOCK_FALLWEISE,
  PFLICHT_TARIFBLOCK_KURZ,
  PFLICHT_VERRECHNUNGSBASIS,
  PFLICHT_VERRECHNUNGSPOSITION,
]) {
  Object.freeze(matrix);
  for (const zeile of Object.values(matrix)) Object.freeze(zeile);
}
