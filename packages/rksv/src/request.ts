import { escapeXmlText } from '@kreiseck/finanzonline-core';
import { type Vorgang, vorgangArt, vorgangXml, isoDateTime, RksvError, zertSnEl } from './vorgaenge';

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';
const RKDB_NS = 'https://finanzonline.bmf.gv.at/rkdb';

export interface RkdbPaket {
  tid: string;
  benid: string;
  id: string;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  paketNr: number;
  tsErstellung: Date;
  erzwingeAsynchron?: boolean;
  vorgaenge: Vorgang[];
}

export interface StatusAbfrage {
  tid: string;
  benid: string;
  id: string;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  paketNr: number;
  tsErstellung: Date;
  ziel:
    | { art: 'status_kasse'; kassenidentifikationsnummer: string }
    | { art: 'status_se'; zertifikatsseriennummer: string };
}

function el(name: string, value: string): string {
  return `<${name}>${escapeXmlText(value)}</${name}>`;
}

function artUebermittlung(u: 'test' | 'echt'): string {
  return u === 'test' ? 'T' : 'P';
}

function kopf(tid: string, benid: string, id: string, u: 'test' | 'echt'): string {
  return el('tid', tid) + el('benid', benid) + el('id', id) + el('art_uebermittlung', artUebermittlung(u));
}

function requirePaketNr(paketNr: number): void {
  if (!Number.isInteger(paketNr) || paketNr < 1 || paketNr > 999_999_999) {
    throw new RksvError(`paketNr muss ganzzahlig in 1..999999999 liegen, war ${paketNr}`);
  }
}

function envelope(inner: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV}"><soapenv:Body>` +
    `<rkdbRequest xmlns="${RKDB_NS}">${inner}</rkdbRequest>` +
    '</soapenv:Body></soapenv:Envelope>'
  );
}

export function buildRkdbEnvelope(p: RkdbPaket): string {
  requirePaketNr(p.paketNr);
  if (p.vorgaenge.length < 1) throw new RksvError('vorgaenge darf nicht leer sein');
  const art = vorgangArt(p.vorgaenge[0]!);
  for (const v of p.vorgaenge) {
    if (vorgangArt(v) !== art) {
      throw new RksvError(`Ein Paket darf nur eine Vorgangsart enthalten (gemischt: ${art} und ${vorgangArt(v)})`);
    }
  }
  const fastnr = p.fastnr !== undefined ? el('fastnr', p.fastnr) : '';
  const erzwinge = p.erzwingeAsynchron === true ? el('erzwinge_asynchron', 'true') : '';
  const vorgangXmls = p.vorgaenge.map((v, i) => vorgangXml(v, i + 1)).join('');
  const rkdb =
    '<rkdb>' + fastnr + el('paket_nr', String(p.paketNr)) + el('ts_erstellung', isoDateTime(p.tsErstellung)) + vorgangXmls + '</rkdb>';
  return envelope(kopf(p.tid, p.benid, p.id, p.uebermittlung) + erzwinge + rkdb);
}

export function buildStatusEnvelope(s: StatusAbfrage): string {
  requirePaketNr(s.paketNr);
  const fastnr = s.fastnr !== undefined ? el('fastnr', s.fastnr) : '';
  const gemeinsam = fastnr + el('paket_nr', String(s.paketNr)) + el('ts_erstellung', isoDateTime(s.tsErstellung)) + el('satznr', '1');
  const block =
    s.ziel.art === 'status_kasse'
      ? `<status_kasse>${gemeinsam}${el('kassenidentifikationsnummer', s.ziel.kassenidentifikationsnummer)}</status_kasse>`
      : `<status_see>${gemeinsam}${zertSnEl(s.ziel.zertifikatsseriennummer)}</status_see>`;
  return envelope(kopf(s.tid, s.benid, s.id, s.uebermittlung) + block);
}
