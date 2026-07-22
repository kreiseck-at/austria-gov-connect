import { normalisiereUid } from './normalisieren';
import { viesUserErrorAusgang, UidEingabeError, type UidErgebnis } from './ergebnis';

export interface ViesConfig { basis?: string; fetchImpl?: typeof fetch; }
const DEFAULT_BASIS = 'https://ec.europa.eu/taxation_customs/vies';

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
