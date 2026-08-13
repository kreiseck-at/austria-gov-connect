import { type Beleg } from './decode';
import { utf8Bytes, bytesZuBase64Url } from './text';

const HEADER = 'eyJhbGciOiJFUzI1NiJ9';

/**
 * Die Zeichenkette, ueber die signiert wird: fester JWS-Kopf, Punkt, und die
 * ersten zwoelf Segmente des maschinenlesbaren Codes als base64url.
 *
 * Steht bewusst in einer eigenen Datei und nicht mehr in pruefe.ts: dort haengt
 * die X.509-Pruefung dran, die es nur in Node gibt -- und verkettung.ts braucht
 * genau diese eine Funktion, sonst nichts davon.
 */
export function belegSigningInput(beleg: Beleg): string {
  const payload = '_' + beleg.segmente.slice(0, 12).join('_');
  return HEADER + '.' + bytesZuBase64Url(utf8Bytes(payload));
}
