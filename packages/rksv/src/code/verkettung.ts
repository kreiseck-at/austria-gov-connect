import { type Beleg, toStandardBase64 } from './decode';
import { belegSigningInput } from './signaturbasis';
import { type Pruefung } from './pruefungstyp';
import { utf8Bytes, bytesZuBase64, bytesZuBase64Url, base64ZuBytes } from './text';
import { sha256 } from './sha256';

export function kompakteJws(beleg: Beleg): string {
  return belegSigningInput(beleg) + '.' + bytesZuBase64Url(base64ZuBytes(toStandardBase64(beleg.signatur)));
}

export function verkettungswert(input: string | Beleg): string {
  const daten = typeof input === 'string' ? input : kompakteJws(input);
  return bytesZuBase64(sha256(utf8Bytes(daten)).subarray(0, 8));
}

export function pruefeVerkettung(beleg: Beleg, vorheriger?: Beleg): Pruefung {
  const erwartet = vorheriger ? verkettungswert(vorheriger) : verkettungswert(beleg.kassenId);
  const ist = beleg.sigVoriger;
  if (ist === erwartet) {
    return { name: 'Verkettung', status: 'PASS' };
  }
  return {
    name: 'Verkettung',
    status: 'FAIL',
    detail: vorheriger
      ? 'Verkettungswert stimmt nicht mit Vorbeleg überein'
      : 'Verkettungswert stimmt nicht mit Kassen-ID überein (Startbeleg)',
  };
}
