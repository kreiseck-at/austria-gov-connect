import { normalisiereUid } from './normalisieren';
import { viesUserErrorAusgang, UidEingabeError, type UidErgebnis } from './ergebnis';

export interface ViesConfig {
  basis?: string;
  fetchImpl?: typeof fetch;
}
const DEFAULT_BASIS = 'https://ec.europa.eu/taxation_customs/vies';

function mapMatch(wert?: string): 'match' | 'kein_match' | 'nicht_geprueft' {
  return wert === 'VALID' ? 'match' : wert === 'INVALID' ? 'kein_match' : 'nicht_geprueft';
}

// VIES gibt bei nicht offengelegten Daten den Platzhalter "---" (oder leer)
// zurück (z. B. Deutschland gibt Name/Adresse aus Datenschutzgründen nicht frei).
// Solche Werte sind KEINE echten Stammdaten -> als "nicht vorhanden" behandeln.
function echterWert(v?: string): string | undefined {
  const t = (v ?? '').trim();
  return t && !/^-+$/.test(t) ? t : undefined;
}

interface ViesApproxAntwort {
  valid?: boolean;
  userError?: string;
  name?: string;
  address?: string;
  requestIdentifier?: string;
  traderNameMatch?: string;
  traderStreetMatch?: string;
  traderPostalCodeMatch?: string;
  traderCityMatch?: string;
}

export async function viesPruefe(uid: string, cfg: ViesConfig = {}): Promise<UidErgebnis> {
  const { land, nummer, voll } = normalisiereUid(uid);
  const f = cfg.fetchImpl ?? fetch;
  const basis = cfg.basis ?? DEFAULT_BASIS;
  const datum = new Date().toISOString();
  let data: { isValid?: boolean; userError?: string; name?: string; address?: string };
  try {
    const res = await f(`${basis}/rest-api/ms/${land}/vat/${nummer}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok)
      return {
        ergebnis: 'keine_antwort',
        quelle: 'vies',
        uid: voll,
        land,
        abfragedatum: datum,
        grund: 'ms_nicht_erreichbar',
        wiederholbar: true,
        rohRc: 'HTTP_' + res.status,
      };
    data = (await res.json()) as typeof data;
  } catch {
    return {
      ergebnis: 'keine_antwort',
      quelle: 'vies',
      uid: voll,
      land,
      abfragedatum: datum,
      grund: 'timeout',
      wiederholbar: true,
    };
  }
  const userError =
    data.userError ?? (data.isValid === true ? 'VALID' : data.isValid === false ? 'INVALID' : undefined);
  if (userError === 'INVALID_INPUT') throw new UidEingabeError(`VIES: ungültige Eingabe für ${voll}`);
  if (userError === undefined)
    return {
      ergebnis: 'keine_antwort',
      quelle: 'vies',
      uid: voll,
      land,
      abfragedatum: datum,
      grund: 'technisch',
      wiederholbar: true,
    };
  const a = viesUserErrorAusgang(userError);
  const erg: UidErgebnis = { ...a, quelle: 'vies', uid: voll, land, abfragedatum: datum, rohRc: userError };
  if (a.ergebnis === 'gueltig') {
    const echterName = echterWert(data.name);
    if (echterName) erg.name = echterName;
    const echteAdresse = echterWert(data.address);
    if (echteAdresse) erg.adresse = echteAdresse;
  }
  return erg;
}

export async function viesBestaetige(
  args: { uid: string; antragsteller: string; name?: string; strasse?: string; plz?: string; ort?: string },
  cfg: ViesConfig = {},
): Promise<
  UidErgebnis & {
    matches?: Record<'name' | 'strasse' | 'plz' | 'ort', 'match' | 'kein_match' | 'nicht_geprueft'>;
  }
> {
  const ziel = normalisiereUid(args.uid);
  const anb = normalisiereUid(args.antragsteller);
  const f = cfg.fetchImpl ?? fetch;
  const basis = cfg.basis ?? DEFAULT_BASIS;
  const datum = new Date().toISOString();
  const body = {
    countryCode: ziel.land,
    vatNumber: ziel.nummer,
    requesterMemberStateCode: anb.land,
    requesterNumber: anb.nummer,
    traderName: args.name,
    traderStreet: args.strasse,
    traderPostalCode: args.plz,
    traderCity: args.ort,
  };
  let data: ViesApproxAntwort;
  try {
    const res = await f(`${basis}/rest-api/check-vat-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok)
      return {
        ergebnis: 'keine_antwort',
        quelle: 'vies',
        uid: ziel.voll,
        land: ziel.land,
        abfragedatum: datum,
        grund: 'ms_nicht_erreichbar',
        wiederholbar: true,
        rohRc: 'HTTP_' + res.status,
      };
    data = (await res.json()) as ViesApproxAntwort;
  } catch {
    return {
      ergebnis: 'keine_antwort',
      quelle: 'vies',
      uid: ziel.voll,
      land: ziel.land,
      abfragedatum: datum,
      grund: 'timeout',
      wiederholbar: true,
    };
  }
  const userError =
    data.userError ?? (data.valid === true ? 'VALID' : data.valid === false ? 'INVALID' : undefined);
  if (userError === 'INVALID_INPUT') throw new UidEingabeError(`VIES: ungültige Eingabe für ${ziel.voll}`);
  if (userError === undefined)
    return {
      ergebnis: 'keine_antwort',
      quelle: 'vies',
      uid: ziel.voll,
      land: ziel.land,
      abfragedatum: datum,
      grund: 'technisch',
      wiederholbar: true,
    };
  const a = viesUserErrorAusgang(userError);
  const erg: UidErgebnis & {
    matches?: Record<'name' | 'strasse' | 'plz' | 'ort', 'match' | 'kein_match' | 'nicht_geprueft'>;
  } = { ...a, quelle: 'vies', uid: ziel.voll, land: ziel.land, abfragedatum: datum, rohRc: userError };
  if (a.ergebnis === 'gueltig') {
    const echterName = echterWert(data.name);
    if (echterName) erg.name = echterName;
    const echteAdresse = echterWert(data.address);
    if (echteAdresse) erg.adresse = echteAdresse;
  }
  if (
    data.traderNameMatch !== undefined ||
    data.traderStreetMatch !== undefined ||
    data.traderPostalCodeMatch !== undefined ||
    data.traderCityMatch !== undefined
  )
    erg.matches = {
      name: mapMatch(data.traderNameMatch),
      strasse: mapMatch(data.traderStreetMatch),
      plz: mapMatch(data.traderPostalCodeMatch),
      ort: mapMatch(data.traderCityMatch),
    };
  if (a.ergebnis === 'gueltig' && data.requestIdentifier)
    erg.nachweis = { art: 'vies-konsultationsnummer', id: data.requestIdentifier, datum };
  return erg;
}

export async function viesStatus(cfg: ViesConfig = {}) {
  const f = cfg.fetchImpl ?? fetch;
  const basis = cfg.basis ?? DEFAULT_BASIS;
  const res = await f(`${basis}/rest-api/check-status`, { headers: { Accept: 'application/json' } });
  const data = (await res.json()) as {
    vow?: { available?: boolean };
    countries?: Array<{ countryCode: string; availability: string }>;
  };
  const land: Record<string, 'verfuegbar' | 'nicht_verfuegbar' | 'beobachtet'> = {};
  for (const c of data.countries ?? [])
    land[c.countryCode] =
      c.availability === 'Available'
        ? 'verfuegbar'
        : c.availability === 'Monitored'
          ? 'beobachtet'
          : 'nicht_verfuegbar';
  return { vowVerfuegbar: data.vow?.available === true, land };
}
