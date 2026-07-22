import { normalisiereUid } from './normalisieren';
import { viesUserErrorAusgang, UidEingabeError, type UidErgebnis } from './ergebnis';

export interface ViesConfig { basis?: string; fetchImpl?: typeof fetch; }
const DEFAULT_BASIS = 'https://ec.europa.eu/taxation_customs/vies';
const MATCH: Record<number, 'match'|'kein_match'|'nicht_geprueft'> = { 1: 'match', 2: 'kein_match', 3: 'nicht_geprueft' };

interface ViesApproxAntwort {
  isValid?: boolean;
  userError?: string;
  name?: string;
  address?: string;
  requestIdentifier?: string;
  viesApproximate?: { matchName?: number; matchStreet?: number; matchPostalCode?: number; matchCity?: number };
}

export async function viesPruefe(uid: string, cfg: ViesConfig = {}): Promise<UidErgebnis> {
  const { land, nummer, voll } = normalisiereUid(uid);
  const f = cfg.fetchImpl ?? fetch;
  const basis = cfg.basis ?? DEFAULT_BASIS;
  const datum = new Date().toISOString();
  let data: { isValid?: boolean; userError?: string; name?: string; address?: string };
  try {
    const res = await f(`${basis}/rest-api/ms/${land}/vat/${nummer}`, { headers: { Accept: 'application/json' } });
    data = (await res.json()) as typeof data;
  } catch {
    return { ergebnis: 'keine_antwort', quelle: 'vies', uid: voll, land, abfragedatum: datum, grund: 'timeout', wiederholbar: true };
  }
  const userError = data.userError ?? (data.isValid ? 'VALID' : 'INVALID');
  if (userError === 'INVALID_INPUT') throw new UidEingabeError(`VIES: ungültige Eingabe für ${voll}`);
  const a = viesUserErrorAusgang(userError);
  const erg: UidErgebnis = { ...a, quelle: 'vies', uid: voll, land, abfragedatum: datum, rohRc: userError };
  if (a.ergebnis === 'gueltig') { if (data.name) erg.name = data.name; if (data.address) erg.adresse = data.address; }
  return erg;
}

export async function viesBestaetige(
  args: { uid: string; antragsteller: string; name?: string; strasse?: string; plz?: string; ort?: string },
  cfg: ViesConfig = {},
): Promise<UidErgebnis & { matches?: Record<'name'|'strasse'|'plz'|'ort','match'|'kein_match'|'nicht_geprueft'> }> {
  const ziel = normalisiereUid(args.uid);
  const anb = normalisiereUid(args.antragsteller);
  const f = cfg.fetchImpl ?? fetch;
  const basis = cfg.basis ?? DEFAULT_BASIS;
  const datum = new Date().toISOString();
  const body = {
    countryCode: ziel.land, vatNumber: ziel.nummer,
    requesterMemberStateCode: anb.land, requesterNumber: anb.nummer,
    traderName: args.name, traderStreet: args.strasse, traderPostalCode: args.plz, traderCity: args.ort,
  };
  let data: ViesApproxAntwort;
  try {
    const res = await f(`${basis}/rest-api/check-vat-number`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    data = (await res.json()) as ViesApproxAntwort;
  } catch {
    return { ergebnis: 'keine_antwort', quelle: 'vies', uid: ziel.voll, land: ziel.land, abfragedatum: datum, grund: 'timeout', wiederholbar: true };
  }
  const userError = data.userError ?? (data.isValid ? 'VALID' : 'INVALID');
  if (userError === 'INVALID_INPUT') throw new UidEingabeError(`VIES: ungültige Eingabe für ${ziel.voll}`);
  const a = viesUserErrorAusgang(userError);
  const erg: UidErgebnis & { matches?: Record<'name'|'strasse'|'plz'|'ort', 'match'|'kein_match'|'nicht_geprueft'> } = { ...a, quelle: 'vies', uid: ziel.voll, land: ziel.land, abfragedatum: datum, rohRc: userError };
  if (data.name) erg.name = data.name; if (data.address) erg.adresse = data.address;
  const ap = data.viesApproximate;
  if (ap) erg.matches = { name: MATCH[ap.matchName ?? 0] ?? 'nicht_geprueft', strasse: MATCH[ap.matchStreet ?? 0] ?? 'nicht_geprueft', plz: MATCH[ap.matchPostalCode ?? 0] ?? 'nicht_geprueft', ort: MATCH[ap.matchCity ?? 0] ?? 'nicht_geprueft' };
  if (a.ergebnis === 'gueltig' && data.requestIdentifier) erg.nachweis = { art: 'vies-konsultationsnummer', id: data.requestIdentifier, datum };
  return erg;
}
