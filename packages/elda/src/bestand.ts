import { EldaError } from './errors';
import { baueSatz, type Feld } from './festsatz';
import { IDENTIFIKATIONSTEIL, LAENGE_IDENTIFIKATIONSTEIL } from './felder-e29';

/** Angaben zum Hersteller der übermittelnden Software (Vorlaufsatz, Kapitel E.2). */
export interface Hersteller {
  /** Herstellername. */
  name: string;
  /** Internationales Kraftfahrzeugkennzeichen, z. B. `A`. */
  kfz: string;
  plz: string;
  ort: string;
  strasse: string;
  /** Optional laut Dokument. */
  telefon?: string;
  /** Software-Identifikationsnummer; optional laut Dokument. */
  softwareId?: string;
  /** Mailadresse des Herstellers; steht im Schlusssatz. */
  mail: string;
}

/** Rahmenangaben eines Datenbestands. */
export interface BestandOptionen {
  /** Seriennummer zum Datensammelsystem (Feld OBUS im Identifikationsteil, Kapitel E.1). */
  seriennummer: string;
  /** Zuständiger Versicherungsträger (Feld VSTR). */
  versicherungstraeger: string;
  /** Datenübernehmender Versicherungsträger (Feld UVST); ohne Angabe gleich `versicherungstraeger`. */
  datenuebernehmer?: string;
  /** Datenträgernummer, laufende Nummerierung der übermittelten Bestände. */
  datentraegernummer: string;
  /**
   * Erstellungszeitpunkt; liefert Datum und Zeit im Vorlaufsatz (Felder EDAT/EZEI).
   *
   * Ein echter Zeitpunkt — üblicherweise das Ergebnis von `new Date()`. Die
   * Umrechnung in die Wanduhrzeit der maßgeblichen Zeitzone (siehe `zeitzone`)
   * geschieht intern in `baueBestand`, inklusive Sommerzeit. Das Dokument
   * kennt kein Zeitzonenfeld im Satz und erwähnt an keiner Stelle UTC — für
   * ein rein österreichisches System kann die stillschweigende Konvention nur
   * die Wiener Ortszeit sein. Es ist an dieser Stelle also weder nötig noch
   * korrekt, selbst vorverschobene `Date`-Objekte zu konstruieren.
   */
  erstellt: Date;
  /**
   * Zeitzone für die Umrechnung von `erstellt` in EDAT/EZEI, als IANA-Kennung.
   * Voreinstellung `'Europe/Vienna'`. Nur für Sonderfälle zu überschreiben —
   * die Voreinstellung deckt den regulären Betrieb ab.
   */
  zeitzone?: string;
  /** `true` setzt PROJ auf `TM` (Testdaten), `false` auf `DM`. */
  testdaten: boolean;
  hersteller: Hersteller;
  /**
   * Versionsnummer Mitteilungsfile (Feld VNMF), steuert in welcher
   * XML-Struktur-Version ELDA das Mitteilungsfile zurückmeldet — z. B. `'3.0'`.
   * Optional laut Dokument; ohne Angabe verwendet ELDA seine Standardversion.
   */
  mitteilungsfileVersion?: string;
}

/** Ein noch nicht umschlossener Satz samt seiner Feldtabelle. */
export interface RohSatz {
  /** Satzart, geht in den Identifikationsteil (Feld SART) ein. */
  satzart: string;
  /** Feldwerte des Satzes, ohne Identifikationsteil — der wird von `baueBestand` ergänzt. */
  werte: Readonly<Record<string, string | undefined>>;
  /** Feldtabelle, gegen die `werte` gebaut wird. */
  felder: readonly Feld[];
  /** Satzlänge dieses Satzes. */
  satzlaenge: number;
}

/** Bestandsbezeichnung für Versichertenmeldungen ab 2019 (Kapitel E.2, Feld BEST). */
const BEST_VERSICHERTENMELDUNG = 'VR';

/** Versionsnummer der Satzstrukturen laut Kapitel E.29 (Version 03). */
const VERSION_SATZSTRUKTUR = '03';

/** Satzart des Vorlaufsatzes laut Kapitel E.2. */
const SART_VORLAUFSATZ = '00';

/** Satzart des Schlusssatzes laut Kapitel E.3. */
const SART_SCHLUSSSATZ = '99';

/** Zeitzone für EDAT/EZEI, sofern `BestandOptionen.zeitzone` nicht abweicht. */
const ZEITZONE_STANDARD = 'Europe/Vienna';

/**
 * Zerlegt einen Zeitpunkt in die Wanduhrzeit-Bestandteile einer Zeitzone —
 * Grundlage für EDAT/EZEI. Verwendet `Intl.DateTimeFormat`, das die
 * IANA-Zeitzonendatenbank auswertet (Sommerzeit inklusive) und nicht von
 * `process.env.TZ` abhängt; Node 22 bringt die dafür nötigen ICU-Daten mit.
 */
function wanduhrzeit(
  zeitpunkt: Date,
  zeitzone: string,
): { tag: string; monat: string; jahr: string; stunde: string; minute: string; sekunde: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zeitzone,
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const teile = formatter.formatToParts(zeitpunkt);
  const wert = (typ: string): string => {
    const gefunden = teile.find((t) => t.type === typ)?.value;
    if (gefunden === undefined) {
      throw new EldaError(`Zeitzone '${zeitzone}': Bestandteil '${typ}' konnte nicht ermittelt werden.`);
    }
    return gefunden;
  };
  return {
    tag: wert('day'),
    monat: wert('month'),
    jahr: wert('year').padStart(4, '0'),
    stunde: wert('hour'),
    minute: wert('minute'),
    sekunde: wert('second'),
  };
}

/**
 * Baut den 20 Zeichen langen Identifikationsteil laut Kapitel E.1. Die
 * Satznummer ist je Bestand bei 1 beginnend und lückenlos aufsteigend — der
 * Vorlaufsatz trägt die 1.
 */
export function baueIdentifikationsteil(satzart: string, satznummer: number, opt: BestandOptionen): string {
  return baueSatz(
    IDENTIFIKATIONSTEIL,
    {
      SART: satzart,
      SANR: String(satznummer),
      UVST: opt.datenuebernehmer ?? opt.versicherungstraeger,
      OBUS: opt.seriennummer,
      VSTR: opt.versicherungstraeger,
    },
    LAENGE_IDENTIFIKATIONSTEIL,
  ).toString('latin1');
}

/**
 * Feldtabelle des Vorlaufsatzes laut Kapitel E.2. PROJ und BEST sind laut
 * Dokument Typ `a` (alphabetisch), nicht `a/n` — hier ohne Auswirkung auf das
 * Ergebnis, da `baueSatz` beide Typen gleich behandelt, aber der Quelle
 * zuliebe korrekt übernommen.
 */
function vorlaufFelder(satzlaenge: number): readonly Feld[] {
  return [
    { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
    { nr: 2, name: 'PROJ', pos: 21, laenge: 2, typ: 'a' },
    { nr: 3, name: 'BEST', pos: 23, laenge: 2, typ: 'a' },
    { nr: 4, name: 'DTNR', pos: 25, laenge: 6, typ: 'a/n' },
    { nr: 5, name: 'EDAT', pos: 31, laenge: 8, typ: 'n' },
    { nr: 6, name: 'EZEI', pos: 39, laenge: 6, typ: 'n' },
    { nr: 7, name: 'HRST', pos: 45, laenge: 45, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 8, name: 'HKFZ', pos: 90, laenge: 3, typ: 'a/n' },
    { nr: 9, name: 'HPLZ', pos: 93, laenge: 7, typ: 'a/n' },
    { nr: 10, name: 'HORT', pos: 100, laenge: 20, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 11, name: 'HSTR', pos: 120, laenge: 30, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 12, name: 'VERS', pos: 150, laenge: 2, typ: 'n' },
    { nr: 13, name: 'HTEL', pos: 152, laenge: 20, typ: 'a/n' },
    { nr: 14, name: 'SOID', pos: 172, laenge: 70, typ: 'a/n' },
    { nr: 15, name: 'VNMF', pos: 242, laenge: 5, typ: 'a/n' },
    { nr: 16, name: 'RESE', pos: 247, laenge: satzlaenge - 246, typ: 'a/n' },
  ];
}

/** Feldtabelle des Schlusssatzes laut Kapitel E.3. */
function schlussFelder(satzlaenge: number): readonly Feld[] {
  return [
    { nr: 1, name: 'IDTEIL', pos: 1, laenge: 20, typ: 'a/n' },
    { nr: 2, name: 'SANZ', pos: 21, laenge: 6, typ: 'n' },
    { nr: 3, name: 'ELNR', pos: 27, laenge: 6, typ: 'n' },
    { nr: 4, name: 'HEMA', pos: 33, laenge: 60, typ: 'a/n', klasse: 'unternehmen' },
    { nr: 5, name: 'RESE', pos: 93, laenge: satzlaenge - 92, typ: 'a/n' },
  ];
}

/**
 * Klammert Meldungssätze zu einem Datenbestand: Vorlaufsatz, die Sätze mit
 * fortlaufender Satznummer, Schlusssatz mit der Satzanzahl. Das Ergebnis ist
 * ISO-8859-15-kodiert und kann unverändert als Dateiinhalt an `senden`
 * übergeben werden.
 */
export function baueBestand(saetze: readonly RohSatz[], opt: BestandOptionen): Buffer {
  if (saetze.length === 0) {
    throw new EldaError('Ein Datenbestand ohne Meldungssätze ergibt keinen Sinn und wird nicht erzeugt.');
  }
  if (Number.isNaN(opt.erstellt.getTime())) {
    throw new EldaError('Erstellungszeitpunkt (opt.erstellt) ist kein gültiges Datum.');
  }
  // Reduktion statt Math.max(...spread): Ein Spread-Aufruf über sehr viele
  // Sätze würde die Argumentliste sprengen und einen undurchsichtigen
  // RangeError werfen statt eines EldaError.
  const satzlaenge = saetze.reduce((max, s) => (s.satzlaenge > max ? s.satzlaenge : max), 0);

  const { tag, monat, jahr, stunde, minute, sekunde } = wanduhrzeit(
    opt.erstellt,
    opt.zeitzone ?? ZEITZONE_STANDARD,
  );
  const edat = `${tag}${monat}${jahr}`;
  const ezei = `${stunde}${minute}${sekunde}`;

  const teile: Buffer[] = [];
  let nummer = 1;

  teile.push(
    baueSatz(
      vorlaufFelder(satzlaenge),
      {
        IDTEIL: baueIdentifikationsteil(SART_VORLAUFSATZ, nummer++, opt),
        PROJ: opt.testdaten ? 'TM' : 'DM',
        BEST: BEST_VERSICHERTENMELDUNG,
        DTNR: opt.datentraegernummer,
        EDAT: edat,
        EZEI: ezei,
        HRST: opt.hersteller.name,
        HKFZ: opt.hersteller.kfz,
        HPLZ: opt.hersteller.plz,
        HORT: opt.hersteller.ort,
        HSTR: opt.hersteller.strasse,
        VERS: VERSION_SATZSTRUKTUR,
        HTEL: opt.hersteller.telefon,
        SOID: opt.hersteller.softwareId,
        VNMF: opt.mitteilungsfileVersion,
      },
      satzlaenge,
    ),
  );

  for (const s of saetze) {
    teile.push(
      baueSatz(
        s.felder,
        { ...s.werte, IDTEIL: baueIdentifikationsteil(s.satzart, nummer++, opt) },
        s.satzlaenge,
      ),
    );
  }

  // SANZ zählt laut Kapitel E.3 ausdrücklich "inkl. Vorlauf- und Schlusssatz" —
  // also die gesamte Satzanzahl des Bestands, nicht nur die Meldungssätze.
  const satzanzahl = saetze.length + 2;

  teile.push(
    baueSatz(
      schlussFelder(satzlaenge),
      {
        IDTEIL: baueIdentifikationsteil(SART_SCHLUSSSATZ, nummer, opt),
        SANZ: String(satzanzahl),
        // ELNR "ELDA-Seriennummer" ist laut Kapitel E.3 ausdrücklich "nur für
        // den SV-internen Gebrauch" bestimmt und nicht zwingend. Die
        // übermittelnde Stelle befüllt dieses Feld nicht — es bleibt auf
        // Grundstellung (numerisch: Nullen). `opt.seriennummer` ist ein
        // anderer Wert (OBUS, Seriennummer zum Datensammelsystem) und gehört
        // nicht hierher.
        HEMA: opt.hersteller.mail,
      },
      satzlaenge,
    ),
  );

  return Buffer.concat(teile);
}
