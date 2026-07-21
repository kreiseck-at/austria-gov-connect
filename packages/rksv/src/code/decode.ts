import { base32Decode } from './base32';

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
  besonderheit?: Besonderheit;
  segmente: string[];
}

const AUSFALL_TEXT = 'Sicherheitseinrichtung ausgefallen';
const BASE32_ONLY = /^[A-Z2-7]+=*$/;

export function toStandardBase64(s: string): string {
  let out = s.replace(/-/g, '+').replace(/_/g, '/');
  while (out.length % 4 !== 0) out += '=';
  return out;
}

function base32ToBase64(s: string): string {
  return base32Decode(s).toString('base64');
}

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
  const istMarker = s10raw === 'TRA' || s10raw === 'STO';

  const umsatzzaehler = istMarker ? s10raw : ocr ? base32ToBase64(s10raw) : s10raw;
  const sigVoriger = ocr ? base32ToBase64(seg[11]!) : seg[11]!;
  const signatur = ocr ? base32ToBase64(seg[12]!) : seg[12]!;

  const kennzeichen = seg[0]!;
  const dash = kennzeichen.indexOf('-');
  const suite = dash === -1 ? kennzeichen : kennzeichen.slice(0, dash);
  const zda = dash === -1 ? '' : kennzeichen.slice(dash + 1);

  let besonderheit: Besonderheit | undefined;
  if (s10raw === 'TRA') besonderheit = 'trainingsbuchung';
  else if (s10raw === 'STO') besonderheit = 'stornobuchung';
  else if (Buffer.from(toStandardBase64(signatur), 'base64').toString('utf8') === AUSFALL_TEXT) {
    besonderheit = 'see-ausfall';
  }

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
    segmente: kanonisch,
  };
}
