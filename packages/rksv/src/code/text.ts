// Umgebungsneutrale Byte- und Base64-Helfer.
//
// Der Grund: `Buffer` gibt es nur in Node. Damit dieselbe Verkettungspruefung
// auch im Browser des Pruefportals laeuft, darf der Kern dieses Pakets nichts
// Node-Eigenes anfassen. TextEncoder/TextDecoder und btoa/atob sind seit Jahren
// in beiden Welten vorhanden; die Base64-Umwandlung ist hier von Hand
// geschrieben, weil btoa nur mit Zeichenketten aus Codepunkten unter 256
// arbeitet und die Umwege darum mehr kosten als diese zwanzig Zeilen.
const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function bytesZuUtf8(b: Uint8Array): string {
  return new TextDecoder('utf-8').decode(b);
}

export function bytesZuBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const rest = b.length - i;
    const n = (b[i]! << 16) | ((rest > 1 ? b[i + 1]! : 0) << 8) | (rest > 2 ? b[i + 2]! : 0);
    out += ZEICHEN[(n >>> 18) & 63]! + ZEICHEN[(n >>> 12) & 63]!;
    out += rest > 1 ? ZEICHEN[(n >>> 6) & 63]! : '=';
    out += rest > 2 ? ZEICHEN[n & 63]! : '=';
  }
  return out;
}

export function bytesZuBase64Url(b: Uint8Array): string {
  return bytesZuBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64ZuBytes(s: string): Uint8Array {
  const rein = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array((rein.length * 3) >> 2);
  let bits = 0;
  let sammler = 0;
  let j = 0;
  for (const z of rein) {
    sammler = (sammler << 6) | ZEICHEN.indexOf(z);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (sammler >>> bits) & 255;
    }
  }
  return out.subarray(0, j);
}
