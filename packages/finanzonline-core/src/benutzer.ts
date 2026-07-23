import { randomInt } from 'node:crypto';
import { FonError } from './errors';

/**
 * Muster für die Benutzer-Identifikation (`benid`) eines FON-Webservice-Benutzers:
 * 8–12 Zeichen, nur Buchstaben/Ziffern, mindestens ein Buchstabe UND eine Ziffer.
 * (Verifiziert an der FinanzOnline-Benutzerverwaltung.)
 */
export const BENID_MUSTER = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{8,12}$/;

export function istGueltigeBenid(benid: string): boolean {
  return BENID_MUSTER.test(benid);
}

/**
 * Erzeugt eine benid aus Präfix + nullführender Nummer, z. B.
 * `generiereBenid('KASSENECK', 1)` → `"KASSENECK001"`. Wirft, wenn das Ergebnis
 * die FON-Regel verletzt (z. B. länger als 12 Zeichen).
 */
export function generiereBenid(praefix: string, nummer: number, stellen = 3): string {
  const benid = praefix + String(nummer).padStart(stellen, '0');
  if (!istGueltigeBenid(benid)) {
    throw new FonError(
      `Generierte benid "${benid}" verletzt die FON-Regel (8–12 alphanumerisch, Buchstabe + Ziffer)`,
    );
  }
  return benid;
}

/** Von FinanzOnline im Passwort erlaubte Sonderzeichen. */
export const PASSWORT_SONDERZEICHEN = '!#$%*+,-./:;=?@\\_()[]{}|~';

/**
 * Prüft ein Passwort gegen die FON-Regel: 8–128 Zeichen, je mindestens ein
 * Klein-, Großbuchstabe, eine Ziffer und ein erlaubtes Sonderzeichen, nur
 * erlaubte Zeichen, und ungleich der `benid` (falls angegeben).
 */
export function istGueltigesPasswort(passwort: string, benid?: string): boolean {
  if (passwort.length < 8 || passwort.length > 128) return false;
  if (benid !== undefined && passwort === benid) return false;
  const zeichen = [...passwort];
  const hatKlein = /[a-z]/.test(passwort);
  const hatGross = /[A-Z]/.test(passwort);
  const hatZiffer = /[0-9]/.test(passwort);
  const hatSonder = zeichen.some((c) => PASSWORT_SONDERZEICHEN.includes(c));
  const nurErlaubt = zeichen.every((c) => /[A-Za-z0-9]/.test(c) || PASSWORT_SONDERZEICHEN.includes(c));
  return hatKlein && hatGross && hatZiffer && hatSonder && nurErlaubt;
}

/**
 * Erzeugt ein kryptografisch zufälliges Passwort (via `node:crypto`), das die
 * FON-Regel garantiert erfüllt (je ein Zeichen aus allen vier Kategorien, Rest
 * zufällig, sicher gemischt). Standardlänge 16.
 */
export function generierePasswort(laenge = 16): string {
  if (laenge < 8 || laenge > 128) {
    throw new FonError('Passwortlänge muss zwischen 8 und 128 liegen');
  }
  const KLEIN = 'abcdefghijklmnopqrstuvwxyz';
  const GROSS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ZIFFER = '0123456789';
  const ALLE = KLEIN + GROSS + ZIFFER + PASSWORT_SONDERZEICHEN;
  const waehle = (s: string): string => s[randomInt(s.length)]!;

  const zeichen: string[] = [waehle(KLEIN), waehle(GROSS), waehle(ZIFFER), waehle(PASSWORT_SONDERZEICHEN)];
  while (zeichen.length < laenge) zeichen.push(waehle(ALLE));
  // Fisher-Yates-Mischen mit kryptografischem Zufall
  for (let i = zeichen.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [zeichen[i], zeichen[j]] = [zeichen[j]!, zeichen[i]!];
  }
  return zeichen.join('');
}
