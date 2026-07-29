import { EldaError } from './errors';
import { FELDER_E29 } from './felder-e29';

/** Satzarten der Versichertenmeldung reduziert (Kapitel E.29, Feld SART). */
export type Satzart = 'M3' | 'M4' | 'M6' | 'M8' | 'M9' | 'S3' | 'S4';

/** Klartext je Satzart, für Fehlermeldungen und Doku. */
export const SATZART_TEXT: Readonly<Record<Satzart, string>> = {
  M3: 'Anmeldung',
  M4: 'Abmeldung',
  M6: 'Änderungsmeldung',
  M8: 'Richtigstellung Anmeldung',
  M9: 'Richtigstellung Abmeldung',
  S3: 'Storno Anmeldung',
  S4: 'Storno Abmeldung',
};

/**
 * Pflichtstufen laut Legende zu Kapitel E.29.1:
 * - `Z`  Angabe zwingend
 * - `Z1` zwingend, wenn zutreffend
 * - `Z3` Angabe möglich
 * - `V`  zwingende Angabe bei Veränderung
 * - `-`  keine Angabe, Feld in Grundstellung
 */
export type Pflichtstufe = 'Z' | 'Z1' | 'Z3' | 'V' | '-';

type Zeile = Readonly<Record<Satzart, Pflichtstufe>>;

function zeile(
  m3: Pflichtstufe,
  m4: Pflichtstufe,
  m6: Pflichtstufe,
  m8: Pflichtstufe,
  m9: Pflichtstufe,
  s3: Pflichtstufe,
  s4: Pflichtstufe,
): Zeile {
  return { M3: m3, M4: m4, M6: m6, M8: m8, M9: m9, S3: s3, S4: s4 };
}

/**
 * Die Matrix aus Kapitel E.29.1, Feld für Feld und Satzart für Satzart. Für die
 * meisten Felder ein reines Datenabbild des Dokuments — die Reihenfolge folgt
 * der Feldnummer. Ausnahme: die in {@link ALTERNATIVGRUPPEN} aufgeführten
 * Feldgruppen. Dort druckt das Dokument eine einzelne Pflichtstufe für eine
 * verbundene Zelle, die sich mehrere Felder teilen; welches Einzelfeld diese
 * Stufe im Sinn hat, ist dem Dokument nicht zu entnehmen. Für `VSNR`/`GEBD`
 * (und bei M3/M4/M6 zusätzlich `REFV`) ist deshalb `Z1` statt des gedruckten
 * `Z` eingetragen — siehe {@link ALTERNATIVGRUPPEN} für die Begründung.
 */
const MATRIX: Readonly<Record<string, Zeile>> = {
  REFW: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  REFU: zeile('-', '-', '-', 'Z', 'Z', 'Z', 'Z'),
  BKNR: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  DGNA: zeile('Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  DTEL: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  MAIL: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  INF1: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  INF2: zeile('Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3', 'Z3'),
  // VSNR und GEBD stehen im Dokument nie einzeln, sondern immer in einer über
  // beide Felder zusammengefassten Zelle (bei M3/M4/M6 reicht die Zusammen-
  // fassung sogar bis REFV). Eine einzelne Pflichtstufe pro Feld herauszulesen
  // wäre Raten; die Zusammenfassung selbst ist objektiv nicht entscheidbar, da
  // ihr eine Alternativbedingung zugrunde liegt ("VSNR oder Geburtsdatum plus
  // Referenz der VSNR-Anforderung"). Deshalb Z1 statt Z — nicht erzwungen,
  // reale Bedingung folgt über den Prüfkatalog (Regel F7051, Task 5). Gruppen
  // im Detail: siehe ALTERNATIVGRUPPEN weiter unten.
  VSNR: zeile('Z1', 'Z1', 'Z1', 'Z1', 'Z1', 'Z1', 'Z1'),
  GEBD: zeile('Z1', 'Z1', 'Z1', 'Z1', 'Z1', 'Z1', 'Z1'),
  REFV: zeile('Z1', 'Z1', 'Z1', 'Z1', '-', '-', '-'),
  FANA: zeile('Z', 'Z', 'Z', '-', '-', '-', '-'),
  VONA: zeile('Z', 'Z', 'Z', '-', '-', '-', '-'),
  ADAT: zeile('Z1', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'),
  BDAT: zeile('-', '-', 'Z1', '-', '-', '-', '-'),
  RDAT: zeile('-', '-', '-', 'Z', 'Z', '-', '-'),
  // BBER, GERF und FRDV teilen sich für M6 im Dokument eine gemeinsame Zelle
  // mit einem einzelnen "V" (die drei Felder sind laut Kapitel E.29.2 genau
  // jene, die per Änderungsmeldung geändert werden dürfen) — nicht "-" wie bei
  // den übrigen Satzarten.
  BBER: zeile('Z', '-', 'V', '-', '-', '-', '-'),
  GERF: zeile('Z', 'Z', 'V', '-', 'Z', '-', '-'),
  FRDV: zeile('Z', '-', 'V', '-', '-', '-', '-'),
  EBSV: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  AGRD: zeile('-', 'Z', '-', '-', 'Z', '-', '-'),
  SAGR: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  KEAB: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  KEBI: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  UEAB: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  UEBI: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  BVAB: zeile('Z1', '-', '-', 'Z1', '-', '-', '-'),
  BVEN: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  BVJN: zeile('-', '-', 'V', '-', '-', '-', '-'),
  UMDA: zeile('-', 'Z1', '-', '-', 'Z1', '-', 'Z1'),
  RUMD: zeile('-', '-', '-', '-', 'Z1', '-', '-'),
  SOUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  ZTUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  ZKUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', '-'),
  RWUM: zeile('-', 'Z1', '-', '-', 'Z1', '-', 'Z1'),
  RUUM: zeile('-', '-', '-', '-', 'Z1', '-', 'Z1'),
  BKUM: zeile('-', '-', '-', '-', 'Z1', '-', '-'),
  VWAZ: zeile('Z1', '-', '-', 'Z1', '-', '-', '-'),
};

/**
 * Feldgruppen, die das Dokument (Kapitel E.29.1, Seite 303) als eine einzige,
 * über mehrere Feldzeilen verbundene Zelle druckt: zwingend ist dort die
 * GRUPPE als Ganzes, nicht jedes einzelne Feld — welches Feld welchen Anteil
 * an der Bedingung trägt, ist dem Dokument nicht zu entnehmen. Per Bild- und
 * Rahmenanalyse der gerenderten Seite verifiziert (fehlende Trennlinien
 * zwischen den betroffenen Feldzeilen in genau diesen Satzarten-Spalten):
 *
 * - `VSNR`+`GEBD`+`REFV` bei M3/M4/M6: ein einzelnes „Z" für alle drei Zeilen.
 *   Sinngemäß (Kapitel E.29.2, Satzart M3): entweder ist die VSNR bekannt,
 *   oder Geburtsdatum und Referenz der VSNR-Anforderung sind es gemeinsam.
 * - `VSNR`+`GEBD` bei M8/M9/S3/S4: ebenfalls ein einzelnes „Z"; `REFV` hat in
 *   diesen Satzarten dagegen eine eigene, unverschmolzene Zelle.
 * - `BBER`+`GERF`+`FRDV` bei M6: ein einzelnes „V" — die drei Felder sind laut
 *   Kapitel E.29.2 genau jene, die per Änderungsmeldung geändert werden
 *   dürfen und tragen deshalb dieselbe Pflichtstufe.
 *
 * `pruefePflicht` erzwingt aus diesem Grund für `VSNR`/`GEBD` bewusst nicht
 * `Z`, sondern `Z1` (siehe `MATRIX`); die tatsächliche Alternativbedingung
 * kennt dieses Paket nicht und prüft sie nicht selbst (Prüfkatalog, Regel
 * F7051, Folgetask).
 */
export const ALTERNATIVGRUPPEN: readonly {
  readonly satzarten: readonly Satzart[];
  readonly felder: readonly string[];
}[] = [
  { satzarten: ['M3', 'M4', 'M6'], felder: ['VSNR', 'GEBD', 'REFV'] },
  { satzarten: ['M8', 'M9', 'S3', 'S4'], felder: ['VSNR', 'GEBD'] },
  { satzarten: ['M6'], felder: ['BBER', 'GERF', 'FRDV'] },
];

/** Die Matrix nach Satzart aufgeschlüsselt, wie sie das API nach außen zeigt. */
export const PFLICHT_E29: Readonly<Record<Satzart, Readonly<Record<string, Pflichtstufe>>>> = Object.freeze(
  (['M3', 'M4', 'M6', 'M8', 'M9', 'S3', 'S4'] as const).reduce(
    (acc, sa) => {
      acc[sa] = Object.freeze(Object.fromEntries(Object.entries(MATRIX).map(([feld, z]) => [feld, z[sa]])));
      return acc;
    },
    {} as Record<Satzart, Record<string, Pflichtstufe>>,
  ),
);

/**
 * Die numerischen Felder (Typ `n`) laut Feldtabelle des Kapitels E.29 — abgeleitet aus
 * {@link FELDER_E29} statt hier erneut aufgezählt, damit die beiden Listen nicht
 * auseinanderlaufen können. Die Schlüssel von {@link MATRIX} sind genau die Feldnamen jener
 * Tabelle ohne den Identifikationsteil (in `pflicht-e29.test.ts` festgehalten), die
 * Zuordnung ist also lückenlos.
 */
const NUMERISCHE_FELDER: ReadonlySet<string> = new Set(
  FELDER_E29.filter((f) => f.typ === 'n').map((f) => f.name),
);

/**
 * Entscheidet, ob ein Feld belegt ist — die einzige Stelle, an der diese Prüfung das tut.
 *
 * Für numerische Felder ist ein Wert aus lauter Nullen die Grundstellung des Feldes und
 * damit unbelegt, unabhängig von seiner Stellenzahl. Das steht so im Dokument (Kapitel
 * C.1.1 bzw. E.1: „n numerisch: rechtsbündig, Grundstellung 0, führende Nullen") und gilt
 * hier aus demselben Grund wie in `pruefung-e29.ts` (`normalisiertNumerisch`) und in
 * `festsatz.ts` (`fuelleNumerisch`): Führende Nullen tragen in dieser Kodierung keine
 * Bedeutung, also bezeichnen `''`, `'0'` und `'00000000'` denselben Feldinhalt.
 *
 * Ohne diese Gleichsetzung widersprächen sich die drei Ebenen dieses Pakets. Ein
 * zurückgelesenes `EBSV = '00000000'` galt hier als „Angabe" und wurde in einer Satzart,
 * die das Feld auf `-` führt, mit „ist in Grundstellung zu übermitteln" abgewiesen — über
 * einen Wert, der die Grundstellung IST. Betroffen war jeder 772-Byte-Satz, der aus einer
 * Datei gelesen und erneut durch einen Builder geschickt wird; das ist im ELDA-Ablauf der
 * Normalfall und nicht der Sonderfall.
 *
 * Für alphanumerische Felder gilt die Regel ausdrücklich nicht: Dort ist die Grundstellung
 * blank, eine Ziffernfolge aus Nullen also ein echter Inhalt. Ein nicht-numerischer Wert in
 * einem numerischen Feld bleibt ebenfalls „belegt" — er wird erst beim Bau des Satzes
 * (`fuelle`) als Ziffernfehler abgewiesen, und das ist die Ebene, die dafür zuständig ist.
 */
function belegt(feld: string, wert: string | undefined): boolean {
  if (wert === undefined) return false;
  const getrimmt = wert.trim();
  if (getrimmt === '') return false;
  if (NUMERISCHE_FELDER.has(feld) && /^0+$/.test(getrimmt)) return false;
  return true;
}

/**
 * Prüft die objektiv entscheidbaren Stufen der Matrix: `Z` muss belegt sein,
 * `-` muss leer bleiben. `Z1` und `V` hängen an einer fachlichen Bedingung, die
 * dieses Paket nicht kennt, und werden deshalb nicht erzwungen; `Z3` ist
 * freigestellt.
 */
export function pruefePflicht(satzart: Satzart, werte: Readonly<Record<string, string | undefined>>): void {
  for (const [feld, stufen] of Object.entries(MATRIX)) {
    const stufe = stufen[satzart];
    if (stufe === 'Z' && !belegt(feld, werte[feld])) {
      throw new EldaError(
        `Satzart ${satzart} (${SATZART_TEXT[satzart]}): Feld ${feld} ist zwingend anzugeben.`,
      );
    }
    if (stufe === '-' && belegt(feld, werte[feld])) {
      throw new EldaError(
        `Satzart ${satzart} (${SATZART_TEXT[satzart]}): Feld ${feld} ist in Grundstellung zu übermitteln, ` +
          'eine Angabe ist hier nicht zulässig.',
      );
    }
  }
}
