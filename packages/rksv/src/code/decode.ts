import { base32Decode } from './base32';
import { base64ZuBytes, bytesZuBase64, bytesZuUtf8 } from './text';

export class RksvCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RksvCodeError';
  }
}

export interface Betraege {
  normal: string;
  ermaessigt1: string;
  ermaessigt2: string;
  null: string;
  besonders: string;
}

export type Besonderheit = 'see-ausfall' | 'trainingsbuchung' | 'stornobuchung';

export interface Beleg {
  raw: string;
  ocr: boolean;
  rka: { kennzeichen: string; suite: string; zda: string };
  kassenId: string;
  belegnummer: string;
  zeitpunkt: string;
  betraege: Betraege;
  umsatzzaehler: string;
  zertifikatsseriennummer: string;
  sigVoriger: string;
  signatur: string;
  /**
   * Die auffaelligste Eigenschaft des Belegs, falls es eine gibt. Trainings- und
   * Stornobuchung gehen dem SEE-Ausfall vor: beides zugleich kommt vor (in der
   * BMF-Testsuite, Szenario 1, bei 16 von 34 dieser Buchungen), und die Belegart
   * ist die Auskunft, die man in diesem Feld sucht. Ob die Signatureinheit
   * ausgefallen war, steht unabhaengig davon in `seeAusfall` — wer darauf
   * abfragt, nimmt dieses Feld und nicht `besonderheit`.
   */
  besonderheit?: Besonderheit;
  /**
   * Der Signaturwert traegt statt einer Signatur den Ausfalltext (Anlage Z6),
   * die Signatur ist also nicht pruefbar. Unabhaengig von `besonderheit`, weil
   * ein Beleg zugleich Trainings- oder Stornobuchung sein kann.
   */
  seeAusfall: boolean;
  segmente: string[];
}

const AUSFALL_TEXT = 'Sicherheitseinrichtung ausgefallen';
const BASE32_ONLY = /^[A-Z2-7]+=*$/;

// Markerwerte im Umsatzzaehler-Feld (Segment 10) bei Trainings- und
// Stornobuchungen, § 10 Abs. 3 RKSV.
//
// Erzeuger schreiben das Kuerzel dort in derselben base64-Form, in der sonst der
// verschluesselte Zaehler steht: base64("TRA") = "VFJB", base64("STO") = "U1RP".
// Belegt an der offiziellen BMF-Pruefwerkzeug-Testsuite (Szenario 1: 17-mal
// VFJB, 17-mal U1RP, kein einziges literales TRA/STO) und an der
// Belegerzeugung des Registrierkassen-Backends. Bis 0.10.0 stand hier nur die
// literale Schreibweise -- damit wurde in echten Daten keine einzige dieser
// Buchungen erkannt.
//
// Die literale Schreibweise bleibt trotzdem stehen. Sie kostet nichts, und die
// beiden Fehlerrichtungen wiegen nicht gleich schwer: eine zusaetzlich erkannte
// Buchung faellt bei der Durchsicht auf, eine uebersehene geht still in die
// Umsatzsumme ein und entzieht sich den Regeln, die nur fuer sie gelten.
//
// Die base32-Form des OCR-Codes (Anlage Z 14) steht bewusst NICHT in der
// Tabelle: das Feld wird vor der Erkennung nach base64 umkodiert, aus
// "KRJEC===" wird "VFJB". Siehe die Erlaeuterung in decodeBelegCode.
const MARKER = new Map<string, Besonderheit>([
  ['VFJB', 'trainingsbuchung'],
  ['U1RP', 'stornobuchung'],
  ['TRA', 'trainingsbuchung'],
  ['STO', 'stornobuchung'],
]);

// Die literalen Kuerzel zusaetzlich einzeln, weil sie beim Umkodieren anders
// behandelt werden muessen als die kodierten Formen -- siehe decodeBelegCode.
const MARKER_LITERAL = new Set(['TRA', 'STO']);

/**
 * Erkennt am -- bereits nach base64 umkodierten -- Umsatzzaehler-Feld, ob der
 * Beleg eine Trainings- oder Stornobuchung ist. Einzige Stelle im Paket, an der
 * diese Kuerzel verglichen werden.
 */
export function buchungsmarker(umsatzzaehlerFeld: string): Besonderheit | undefined {
  return MARKER.get(umsatzzaehlerFeld);
}

/**
 * Traegt der Signaturwert statt einer Signatur den Ausfalltext (Anlage Z6)?
 * Einzige Stelle, an der dieser Text verglichen wird.
 */
export function istAusfallSignatur(signatur: string): boolean {
  return bytesZuUtf8(base64ZuBytes(toStandardBase64(signatur))) === AUSFALL_TEXT;
}

export function toStandardBase64(s: string): string {
  let out = s.replace(/-/g, '+').replace(/_/g, '/');
  while (out.length % 4 !== 0) out += '=';
  return out;
}

function base32ToBase64(s: string): string {
  return bytesZuBase64(base32Decode(s));
}

/**
 * Dekodiert den maschinenlesbaren Belegcode. 1:1 gegen die RKSV-Anlage
 * (Detailspezifikationen, BGBl. II Nr. 410/2015) verifiziert:
 * - 13 Segmente = signierte Belegdaten (JWS-Payload, Anlage Z5) + Signaturwert
 *   (Anlage Z12), getrennt durch `_`.
 * - Segment 0 = Registrierkassenalgorithmuskennzeichen `R{N}-{C}{M}` (Anlage Z2);
 *   Segmente 1–11 = Kassen-ID, Belegnummer, Datum (ISO 8601 o. Zone), 5 Beträge
 *   (Normal/Ermäßigt-1/Ermäßigt-2/Null/Besonders), Umsatzzähler (AES-256-ICM,
 *   opak — offline kein Schlüssel), Zertifikatsseriennummer, Verkettungswert
 *   (Anlage Z4); Segment 12 = Signaturwert.
 * - QR: Signaturwert in Standard-base64 (Anlage Z12 verlangt Umkodierung von
 *   base64url wegen `_`-Konflikt). OCR-Variante (Anlage Z14): base32 für genau
 *   Umsatzzähler, Verkettungswert und Signaturwert.
 * - `TRA`/`STO` im Umsatzzähler-Feld = Trainings-/Stornobuchung (§ 10 Abs. 3),
 *   in der Praxis base64-kodiert als `VFJB`/`U1RP` — siehe `MARKER`;
 *   Signaturwert = „Sicherheitseinrichtung ausgefallen" bei SEE-Ausfall (Anlage Z6).
 */
export function decodeBelegCode(code: string): Beleg {
  const raw = code.trim();
  if (raw[0] !== '_') throw new RksvCodeError('Belegcode muss mit "_" beginnen');
  const parts = raw.split('_');
  // führendes '_' erzeugt ein leeres erstes Element; danach 13 Segmente
  const seg = parts.slice(1);
  if (seg.length !== 13 || seg.some((s) => s.length === 0)) {
    throw new RksvCodeError(`Belegcode muss genau 13 nichtleere Segmente haben (waren ${seg.length})`);
  }

  const ocr = BASE32_ONLY.test(seg[12]!);
  const s10raw = seg[9]!;

  // Entscheidung zum Feld `umsatzzaehler`: es fuehrt immer die base64-Form, also
  // genau das, was im QR-Code steht. Der OCR-Code kodiert dieselben Bytes in
  // base32 (Anlage Z 14) und wird deshalb umkodiert -- auch dann, wenn er den
  // Marker traegt. Aus base32("TRA") = "KRJEC===" wird so "VFJB": QR- und
  // OCR-Fassung desselben Belegs liefern denselben Wert, und `segmente` bleibt
  // die Grundlage, aus der belegSigningInput die signierten Daten
  // zusammensetzt.
  //
  // Ausgenommen ist nur die literale Schreibweise: "TRA"/"STO" sind kein
  // kodierter Wert, base32-Dekodieren machte Unrat daraus. Sie werden
  // unveraendert durchgereicht.
  const umsatzzaehler = MARKER_LITERAL.has(s10raw) ? s10raw : ocr ? base32ToBase64(s10raw) : s10raw;
  const sigVoriger = ocr ? base32ToBase64(seg[11]!) : seg[11]!;
  const signatur = ocr ? base32ToBase64(seg[12]!) : seg[12]!;

  const kennzeichen = seg[0]!;
  const dash = kennzeichen.indexOf('-');
  const suite = dash === -1 ? kennzeichen : kennzeichen.slice(0, dash);
  const zda = dash === -1 ? '' : kennzeichen.slice(dash + 1);

  // Beides zugleich ist kein Sonderfall, sondern Alltag: in Szenario 1 der
  // BMF-Testsuite sind 16 der 34 Trainings- und Stornobuchungen waehrend eines
  // Ausfalls der Signatureinheit entstanden. Solange die Marker nicht erkannt
  // wurden, fiel das nicht auf -- diese Belege galten schlicht als Ausfall.
  const seeAusfall = istAusfallSignatur(signatur);
  const besonderheit = buchungsmarker(umsatzzaehler) ?? (seeAusfall ? 'see-ausfall' : undefined);

  const kanonisch = [...seg];
  kanonisch[9] = umsatzzaehler;
  kanonisch[11] = sigVoriger;
  kanonisch[12] = signatur;

  return {
    raw,
    ocr,
    rka: { kennzeichen, suite, zda },
    kassenId: seg[1]!,
    belegnummer: seg[2]!,
    zeitpunkt: seg[3]!,
    betraege: {
      normal: seg[4]!,
      ermaessigt1: seg[5]!,
      ermaessigt2: seg[6]!,
      null: seg[7]!,
      besonders: seg[8]!,
    },
    umsatzzaehler,
    zertifikatsseriennummer: seg[10]!,
    sigVoriger,
    signatur,
    besonderheit,
    seeAusfall,
    segmente: kanonisch,
  };
}
