// Umgebungsneutraler Kern: laeuft in Node und im Browser. Nichts hier darf
// node:-Module oder Buffer anfassen -- browserfaehig.test.ts liest den
// uebersetzten Code und faellt, sobald doch etwas davon hereinkommt.
// Die Node-gebundene Signaturpruefung liegt unter ./signatur.
export {
  decodeBelegCode,
  RksvCodeError,
  toStandardBase64,
  type Beleg,
  type Betraege,
  type Besonderheit,
} from './decode';
export { belegSigningInput } from './signaturbasis';
export { type Pruefung } from './pruefungstyp';
export { pruefeVerkettung, verkettungswert, kompakteJws } from './verkettung';
export { base32Decode, base32Encode } from './base32';
