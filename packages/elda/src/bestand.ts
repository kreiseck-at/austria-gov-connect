import { EldaError } from './errors';
import { baueSatz, baueSatzText, type Feld } from './festsatz';
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

/**
 * `BestandOptionen` plus der Bestandsbezeichnung — der internen Sicht auf einen
 * Bestand. Der Aufrufer sieht sie nicht: Welche Verarbeitung ein Bestand trägt,
 * folgt aus den Sätzen darin und wird deshalb von der bauenden Funktion gesetzt,
 * nicht vom Aufrufer angegeben.
 */
export interface BestandRahmen extends BestandOptionen {
  /** Feld BEST im Vorlaufsatz; siehe {@link BEST_VERSICHERTENMELDUNG}, {@link BEST_MBGM}. */
  bestandsbezeichnung: string;
}

/** Ein noch nicht umschlossener Satz samt seiner Feldtabelle. */
export interface RohSatz {
  /** Satzart, geht in den Identifikationsteil (Feld SART) ein. */
  satzart: string;
  /** Feldwerte des Satzes, ohne Identifikationsteil — der wird von `baueBestand` ergänzt. */
  werte: Readonly<Record<string, string | undefined>>;
  /** Feldtabelle, gegen die `werte` gebaut wird. */
  felder: readonly Feld[];
  /**
   * Satzlänge dieses Satzes. Die Sätze eines Bestands dürfen unterschiedlich
   * lang sein — Kapitel E.2 sieht das ausdrücklich vor; Vorlauf- und
   * Schlusssatz tragen dann die größte im Bestand vorkommende Satzlänge.
   */
  satzlaenge: number;
}

/**
 * Bestandsbezeichnungen laut Kapitel B.3 („Verarbeitungen"). Sie sagen dem
 * Datensammelsystem, welche Verarbeitung der Bestand trägt — und ein Bestand
 * trägt laut Kapitel C.1 ausdrücklich Daten „zu EINER Verarbeitung". Ein
 * falscher Wert liefert die Sätze also nicht bloß mit einer schiefen Aufschrift
 * ab, er liefert sie an der falschen Verarbeitung ab.
 *
 * Deshalb steht der Wert nicht mehr fest im Bestandsbau, sondern kommt von der
 * Funktion, die die Sätze baut: `erstelleBestand` (Versichertenmeldungen) und
 * `erstelleMbgmBestand` (monatliche Beitragsgrundlagenmeldung) setzen ihn je
 * selbst. Ein Aufrufer kann ihn damit weder vergessen noch verwechseln.
 */
/** Versichertenmeldung reduziert, ab 01.01.2019 (Kapitel B.3 Punkt 2, E.29). */
export const BEST_VERSICHERTENMELDUNG = 'VR';

/** Monatliche Beitragsgrundlagenmeldung, für Zeiträume ab 01.01.2019 (Kapitel B.3 Punkt 7, E.32). */
export const BEST_MBGM = 'MB';

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
  // baueSatzText statt baueSatz: Der Identifikationsteil geht als Feldwert in
  // den umschließenden Satz ein und wird erst dort nach ISO-8859-15 kodiert.
  // Hier zu kodieren und sofort wieder mit latin1 zu dekodieren wäre nicht nur
  // überflüssig, sondern ein Tabellenwechsel — siehe JSDoc von baueSatzText.
  return baueSatzText(
    IDENTIFIKATIONSTEIL,
    {
      SART: satzart,
      SANR: String(satznummer),
      UVST: opt.datenuebernehmer ?? opt.versicherungstraeger,
      OBUS: opt.seriennummer,
      VSTR: opt.versicherungstraeger,
    },
    LAENGE_IDENTIFIKATIONSTEIL,
  );
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
 *
 * Die Sätze dürfen unterschiedlich lang sein: Vorlauf- und Schlusssatz tragen
 * dann die größte im Bestand vorkommende Satzlänge (Kapitel E.2), jeder
 * Datensatz bleibt bei seiner eigenen.
 */
export function baueBestand(saetze: readonly RohSatz[], opt: BestandRahmen): Buffer {
  if (saetze.length === 0) {
    throw new EldaError('Ein Datenbestand ohne Meldungssätze ergibt keinen Sinn und wird nicht erzeugt.');
  }
  if (!/^[A-Z]{2}$/.test(opt.bestandsbezeichnung)) {
    throw new EldaError(
      `Bestandsbezeichnung '${opt.bestandsbezeichnung}' ist unbrauchbar. Kapitel B.3 kennt ` +
        'ausschließlich zweistellige Großbuchstaben-Codes (VR, MB, LF …); sie benennen die ' +
        'Verarbeitung, an die der Bestand geliefert wird.',
    );
  }
  if (Number.isNaN(opt.erstellt.getTime())) {
    throw new EldaError('Erstellungszeitpunkt (opt.erstellt) ist kein gültiges Datum.');
  }
  // Satzlänge des Bestands = MAXIMUM über die Sätze. Sätze unterschiedlicher
  // Länge in einem Bestand sind ausdrücklich vorgesehen, nicht auszuschließen.
  //
  // Kapitel E.2 (Seite 175), wörtlich: „Die Satzlänge des Vorlaufsatzes
  // entspricht der Satzlänge der nachfolgenden Datensätze. Hinweis: Bei
  // Beständen mit Datensätzen unterschiedlicher Satzlängen kommt die Satzlänge
  // jenes Datensatzes zur Anwendung der die maximal mögliche Satzlänge im
  // Bestand aufweist." Kapitel C.1 (Seite 49) dazu: „Die Übermittlung erfolgt
  // in variabler Satzlänge."
  //
  // Der Hinweis in E.2 regelt genau diesen Fall, und er regelt nur den
  // Umschlag: Vorlauf- und Schlusssatz werden über ihr Reserve-Feld auf das
  // Maximum aufgefüllt, jeder Datensatz behält seine eigene Länge. Das Maximum
  // ist dabei der einzige brauchbare Wert für den Umschlag — er kündigt die
  // Satzlänge des Bestands an, und kein Datensatz darf länger ausfallen als
  // angekündigt. Ein kleinerer Wert wiese den längsten Datensatz als überlang
  // aus; genau deshalb nennt der Hinweis „die maximal mögliche Satzlänge im
  // Bestand".
  //
  // Der konkrete Anlassfall ist der Lohnzettel Finanz: Ein solcher Bestand
  // besteht aus einem Informationssatz (Satzart I1, Satzlänge 1100, Kapitel
  // E.13, Seite 220) gefolgt von den Mitteilungssätzen (Satzart L1, Satzlänge
  // 3500, Kapitel E.14, Seite 233). Eine Gleichheitsforderung machte diesen
  // Bestand unbaubar.
  //
  // Zur Vorgeschichte, damit sie nicht ein viertes Mal falsch ausgelegt wird:
  // Kapitel C.1.2 (Seite 52) nennt die Satzlängen als erste der vier Prüfungen
  // bei Übernahme eines Datenpaketes (Satzlängen, Satzfolgen, Projektcodes,
  // Satzanzahl), und ein Fehler dort weist die gesamte Übertragungssendung
  // zurück. Das ist richtig — geprüft wird dort aber, ob jeder Satz die zu
  // SEINER Satzart gehörende Länge hat, nicht ob alle Sätze gleich lang sind.
  // Welche Satzart ein Satz trägt, steht in seinen ersten zwei Stellen
  // (Identifikationsteil, Kapitel E.1); die Satzfolge eines Bestands ist damit
  // auch bei gemischten Längen auflösbar. Aus C.1.2 auf einen Einheitswert je
  // Bestand zu schließen, widerspricht dem ausdrücklichen Hinweis in E.2.
  const satzlaenge = Math.max(...saetze.map((s) => s.satzlaenge));

  // Kapitel D.43 (REFW – Referenzwert, Seite 123): „Der Referenzwert wird grundsätzlich vom
  // meldenden System ermittelt/belegt und dient der eindeutigen Identifikation einer Meldung
  // an einen SV-Träger. Daher muss dieser Wert für alle Meldungen zu einer
  // Beitragskontonummer eindeutig sein. Die Wiederverwendung eines bereits für eine Meldung
  // oder ein mBGM-Paket vergebenen Werts ist nicht zulässig."
  //
  // Ein doppelter Referenzwert ist der teuerste Fehler dieser Art: Der Wert stellt den Bezug
  // zwischen abhängigen Meldungen her (REFU, Kapitel D.44) und trägt die Rückmeldung aus dem
  // Clearing-System. Wird er zweimal vergeben, zeigt eine spätere Richtigstellung oder ein
  // Storno auf zwei Meldungen zugleich — strukturell einwandfrei, fachlich unauflösbar.
  // Typischer Auslöser ist eine Schleife, die den Referenzwert aus einem Feld ableitet, das
  // sich in zwei Sätzen desselben Bestands nicht unterscheidet.
  //
  // Geprüft wird genau die Aussage der Quelle: Eindeutigkeit JE BEITRAGSKONTONUMMER. Derselbe
  // Referenzwert an zwei verschiedenen Beitragskonten wird nicht abgewiesen — der Satz auf
  // Seite 123 grenzt die Eindeutigkeit ausdrücklich auf eine Beitragskontonummer ein. Über
  // Bestandsgrenzen hinweg kann diese Prüfung ohnehin nichts sagen; dafür ist das meldende
  // System zuständig.
  const gesehen = new Map<string, number>();
  for (const [i, s] of saetze.entries()) {
    const refw = s.werte.REFW?.trim();
    if (refw === undefined || refw === '') continue;
    // ' ' als Trennzeichen: Es gehört zu keinem der beiden Felder und kann deshalb
    // keine Kollision zweier verschiedener Paare erzeugen.
    const schluessel = `${s.werte.BKNR?.trim() ?? ''} ${refw}`;
    const zuerst = gesehen.get(schluessel);
    if (zuerst !== undefined) {
      throw new EldaError(
        `Der Referenzwert (REFW) '${refw}' kommt im Bestand zweimal vor: in Satz ${zuerst} ` +
          `(Satzart ${saetze[zuerst - 1]!.satzart}) und in Satz ${i + 1} (Satzart ${s.satzart}), ` +
          'beide zur selben Beitragskontonummer. Laut Kapitel D.43 muss der Referenzwert für ' +
          'alle Meldungen zu einer Beitragskontonummer eindeutig sein; er stellt den Bezug für ' +
          'Richtigstellung, Storno und Clearing her.',
      );
    }
    gesehen.set(schluessel, i + 1);
  }

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
        BEST: opt.bestandsbezeichnung,
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
