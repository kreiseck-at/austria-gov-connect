import { createHash } from 'node:crypto';
import { type Beleg, toStandardBase64 } from './decode';
import { belegSigningInput, type Pruefung } from './pruefe';

export function kompakteJws(beleg: Beleg): string {
  const sigB64url = Buffer.from(toStandardBase64(beleg.signatur), 'base64').toString('base64url');
  return belegSigningInput(beleg) + '.' + sigB64url;
}

export function verkettungswert(input: string | Beleg): string {
  const daten = typeof input === 'string' ? input : kompakteJws(input);
  return createHash('sha256').update(Buffer.from(daten, 'utf8')).digest().subarray(0, 8).toString('base64');
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
    detail: vorheriger ? 'Verkettungswert stimmt nicht mit Vorbeleg überein' : 'Verkettungswert stimmt nicht mit Kassen-ID überein (Startbeleg)',
  };
}
