import {
  buildEnvelope,
  callSoap,
  findDescendant,
  childText,
  sessionErrorFor,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';
import { normalisiereUid } from './normalisieren';
import { UidEingabeError, type UidErgebnis, type KeinAntwortGrund } from './ergebnis';

const ENDPOINT = 'https://finanzonline.bmf.gv.at/fonuid/ws/uidAbfrage/';
const NS = 'https://finanzonline.bmf.gv.at/fon/ws/uidAbfrage';

const TRANSIENT: Record<number, KeinAntwortGrund> = {
  [-2]: 'wartung',
  12: 'ms_nicht_erreichbar',
  1511: 'ms_nicht_erreichbar',
  1512: 'ueberlast',
};
const RATENLIMIT = new Set([1513, 1514]);
const NICHT_BER = new Set([10, 11, -4, 103, 104, 105]);

export async function fonUidAbfrage(args: {
  session: Session;
  antragsteller: string;
  uid: string;
  stufe: 1 | 2;
  transport?: TransportOptions;
}): Promise<UidErgebnis> {
  const ziel = normalisiereUid(args.uid);
  const tn = normalisiereUid(args.antragsteller);
  const datum = new Date().toISOString();
  const body = buildEnvelope({
    namespace: NS,
    bodyElement: 'uidAbfrageServiceRequest',
    fields: [
      { name: 'tid', value: args.session.tid },
      { name: 'benid', value: args.session.benid },
      { name: 'id', value: args.session.id },
      { name: 'uid_tn', value: tn.voll },
      { name: 'uid', value: ziel.voll },
      { name: 'stufe', value: String(args.stufe) },
    ],
  });
  const root = await callSoap({ endpoint: ENDPOINT, soapAction: 'uidAbfrage', body }, args.transport);
  const resp = findDescendant(root, 'uidAbfrageServiceResponse');
  const rcText = resp ? childText(resp, 'rc') : undefined;
  const rc = Number.parseInt(rcText ?? '', 10);
  if (rc === -1) throw sessionErrorFor(-1, resp ? childText(resp, 'msg') : undefined);
  const base = {
    quelle: 'fon' as const,
    uid: ziel.voll,
    land: ziel.land,
    abfragedatum: datum,
    rohRc: String(rc),
  };
  if (rc === 0) {
    const erg: UidErgebnis = { ...base, ergebnis: 'gueltig' };
    const name = resp && childText(resp, 'name');
    if (name) erg.name = name;
    const adr = resp
      ? ['adrz1', 'adrz2', 'adrz3', 'adrz4', 'adrz5', 'adrz6']
          .map((k) => childText(resp, k))
          .filter(Boolean)
          .join(', ')
      : '';
    if (adr) erg.adresse = adr;
    erg.nachweis = {
      art: 'fon-bescheid-in-databox',
      datum,
      hinweis: 'Bescheid liegt am Folgetag in der DataBox (§132 BAO)',
    };
    return erg;
  }
  if (rc === 1) return { ...base, ergebnis: 'ungueltig' };
  if (rc === 4 || rc === 5)
    throw new UidEingabeError(`FON-UID rc ${rc}: ${(resp && childText(resp, 'msg')) || 'ungültige Eingabe'}`);
  if (RATENLIMIT.has(rc))
    return { ...base, ergebnis: 'keine_antwort', grund: 'ratenlimit', wiederholbar: false };
  if (NICHT_BER.has(rc))
    return { ...base, ergebnis: 'keine_antwort', grund: 'nicht_berechtigt', wiederholbar: false };
  const grund = TRANSIENT[rc];
  if (grund) return { ...base, ergebnis: 'keine_antwort', grund, wiederholbar: true };
  return { ...base, ergebnis: 'keine_antwort', grund: 'technisch', wiederholbar: true };
}
