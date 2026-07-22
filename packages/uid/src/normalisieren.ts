import { UidEingabeError } from './ergebnis';

const LAENDER = [
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'EL',
  'ES',
  'FI',
  'FR',
  'GB',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'SE',
  'SI',
  'SK',
  'XI',
] as const;

export function normalisiereUid(roh: string): { land: string; nummer: string; voll: string } {
  if (typeof roh !== 'string') throw new UidEingabeError('UID muss ein String sein');
  const voll = roh.replace(/[\s.-]/g, '').toUpperCase();
  const land = voll.slice(0, 2);
  const nummer = voll.slice(2);
  const gueltig =
    (LAENDER.includes(land as (typeof LAENDER)[number]) && /^[A-Z0-9]{8,12}$/.test(nummer)) ||
    (land === 'RO' && /^\d{2,10}$/.test(nummer));
  if (!gueltig) throw new UidEingabeError(`UID-Format ungültig: ${roh}`);
  return { land, nummer, voll };
}
