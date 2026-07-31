import { type XmlNode, firstChild, childText, findDescendant } from '@kreiseck/finanzonline-core';
import { rcInfo } from './returncodes';

/**
 * Findet den `rkdbResponse`-Knoten: entweder die Wurzel selbst (asynchrones
 * Ergebnisprotokoll aus der DataBox — dort ist `<rkdbResponse>` die Wurzel, ohne
 * SOAP-Envelope) oder ein Nachfahre (synchrone SOAP-Antwort im Envelope).
 */
export function rkdbResponseNode(root: XmlNode): XmlNode | undefined {
  return root.name === 'rkdbResponse' ? root : findDescendant(root, 'rkdbResponse');
}

/** Einzelprüfung aus einem `verificationResult`-Baum (z. B. Belegprüfung); kann rekursiv Teilprüfungen enthalten. */
export interface Pruefung {
  /** Maschinenlesbare Prüf-ID des Dienstes (`verificationId`), z. B. `MATCH_COMPANY`. */
  id?: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  /** Menschenlesbare Beschreibung der Prüfung (`verificationTextualDescription`). */
  beschreibung?: string;
  detail?: string;
  teilpruefungen?: Pruefung[];
}

/**
 * Betriebsstatus, den eine Statusabfrage liefert.
 *
 * Der Wertebereich bleibt absichtlich offen (`string & {}`): ein unbekannter
 * Wert soll die Auswertung nicht brechen, während die bekannten vier beim
 * Tippen vorgeschlagen werden.
 */
export type FonStatus = 'AKTIVIERT' | 'REGISTRIERT' | 'IN_BETRIEB' | 'AUSFALL';

/**
 * Ergebnis einer Statusabfrage (`status.kasse`/`status.see`): Betriebsstatus samt Zeitstempeln.
 *
 * Nur für Einheiten **in Betrieb**. Ist eine Einheit außer Betrieb genommen,
 * antwortet der Dienst mit `B32`/`B33` und ohne `abfrage_ergebnis` — dann fehlt
 * dieses Feld ganz, und „nie registriert" ist von „bereits abgemeldet" über das
 * Webservice nicht zu unterscheiden (am 31.07.2026 nachgemessen).
 */
export interface StatusErgebnis {
  status: FonStatus | (string & {});
  tsRegistrierung?: string;
  tsStatus?: string;
}

/**
 * Ergebnis eines einzelnen Vorgangs (`result` im rkdb-Antwortprotokoll).
 * Fachliche Returncodes lösen keinen Fehler aus — `ok`/`rc`/`msg` tragen sie durch;
 * `belegpruefung`/`status` sind nur bei den jeweils passenden Vorgangsarten gesetzt.
 */
export interface Ergebnis {
  satznr: number;
  ok: boolean;
  rc: string;
  msg: string;
  /** Zeitstempel des Antwort-Envelopes (`ts_erstellung` auf rkdbResponse-Ebene), sofern vorhanden. */
  tsErstellung?: string;
  /** Vom Dienst unverändert zurückgegebenes `kundeninfo`, falls im Vorgang gesetzt. */
  kundeninfo?: string;
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
    const beschreibung = childText(vr, 'verificationTextualDescription');
    if (beschreibung) p.beschreibung = beschreibung;
    const detail = childText(vr, 'verificationResultDetailedMessage');
    if (detail) p.detail = detail;
    if (teil) p.teilpruefungen = parsePruefungen(teil);
    return p;
  });
}

export function parseRkdbErgebnisse(root: XmlNode): Ergebnis[] {
  const resp = rkdbResponseNode(root);
  if (!resp) return [];
  // Antwort-Envelope-Zeitstempel steht einmal auf rkdbResponse-Ebene und gilt
  // für alle enthaltenen result-Einträge.
  const tsErstellung = childText(resp, 'ts_erstellung');
  return childrenNamed(resp, 'result').map((result) => {
    const msgNode = firstChild(result, 'rkdbMessage');
    const rc = (msgNode ? childText(msgNode, 'rc') : undefined) ?? '';
    const msg = (msgNode ? childText(msgNode, 'msg') : undefined) ?? '';
    const satznr = Number.parseInt(childText(result, 'satznr') ?? '0', 10);
    const erg: Ergebnis = { satznr, ok: rcInfo(rc).kind === 'ok', rc, msg };

    if (tsErstellung) erg.tsErstellung = tsErstellung;

    const kundeninfo = childText(result, 'kundeninfo');
    if (kundeninfo) erg.kundeninfo = kundeninfo;

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
  const resp = rkdbResponseNode(root);
  const info = resp ? childText(resp, 'info') : undefined;
  return { ergebnisse: parseRkdbErgebnisse(root), info: info || undefined };
}
