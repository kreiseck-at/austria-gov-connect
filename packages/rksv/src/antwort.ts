import { type XmlNode, firstChild, childText, findDescendant } from '@kreiseck/finanzonline-core';
import { rcInfo } from './returncodes';

export interface Pruefung {
  /** Maschinenlesbare Prüf-ID des Dienstes (`verificationId`), z. B. `MATCH_COMPANY`. */
  id?: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  detail?: string;
  teilpruefungen?: Pruefung[];
}

export interface StatusErgebnis {
  status: string;
  tsRegistrierung?: string;
  tsStatus?: string;
}

export interface Ergebnis {
  satznr: number;
  ok: boolean;
  rc: string;
  msg: string;
  belegpruefung?: Pruefung[];
  status?: StatusErgebnis;
}

function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

function normalizeState(s: string | undefined): 'PASS' | 'FAIL' | 'NOT_EXECUTED' {
  return s === 'PASS' || s === 'FAIL' || s === 'NOT_EXECUTED' ? s : 'NOT_EXECUTED';
}

function parsePruefungen(list: XmlNode): Pruefung[] {
  return childrenNamed(list, 'verificationResult').map((vr) => {
    const teil = firstChild(vr, 'verificationResultList');
    const p: Pruefung = {
      name: childText(vr, 'verificationName') ?? '',
      status: normalizeState(childText(vr, 'verificationState')),
    };
    const id = childText(vr, 'verificationId');
    if (id) p.id = id;
    const detail = childText(vr, 'verificationResultDetailedMessage');
    if (detail) p.detail = detail;
    if (teil) p.teilpruefungen = parsePruefungen(teil);
    return p;
  });
}

export function parseRkdbErgebnisse(root: XmlNode): Ergebnis[] {
  const resp = findDescendant(root, 'rkdbResponse');
  if (!resp) return [];
  return childrenNamed(resp, 'result').map((result) => {
    const msgNode = firstChild(result, 'rkdbMessage');
    const rc = (msgNode ? childText(msgNode, 'rc') : undefined) ?? '';
    const msg = (msgNode ? childText(msgNode, 'msg') : undefined) ?? '';
    const satznr = Number.parseInt(childText(result, 'satznr') ?? '0', 10);
    const erg: Ergebnis = { satznr, ok: rcInfo(rc).kind === 'ok', rc, msg };

    const vrl = firstChild(result, 'verificationResultList');
    if (vrl) erg.belegpruefung = parsePruefungen(vrl);

    const ab = firstChild(result, 'abfrage_ergebnis');
    if (ab) {
      erg.status = {
        status: childText(ab, 'status') ?? '',
        tsRegistrierung: childText(ab, 'ts_registrierung'),
        tsStatus: childText(ab, 'ts_status'),
      };
    }
    return erg;
  });
}

export interface RkdbAntwort {
  ergebnisse: Ergebnis[];
  /** Empfangs-/Verarbeitungshinweis des Dienstes (nur bei asynchroner Verarbeitung gesetzt). */
  info?: string;
}

export function parseRkdbAntwort(root: XmlNode): RkdbAntwort {
  const resp = findDescendant(root, 'rkdbResponse');
  const info = resp ? childText(resp, 'info') : undefined;
  return { ergebnisse: parseRkdbErgebnisse(root), info: info || undefined };
}
