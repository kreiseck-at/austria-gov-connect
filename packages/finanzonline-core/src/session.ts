import { SESSION_ENDPOINT, SESSION_NAMESPACE } from './endpoints';
import { buildEnvelope } from './soap/envelope';
import { callSoap, type TransportOptions } from './transport';
import { type XmlNode, findDescendant, childText } from './soap/parse';
import { FonError, FonProtocolError, sessionErrorFor } from './errors';

export interface SessionConfig {
  tid: string;
  benid: string;
  pin: string;
  herstellerid: string;
  transport?: TransportOptions;
}

export interface Session {
  readonly id: string;
  readonly tid: string;
  readonly benid: string;
  logout(): Promise<void>;
}

const TID = /^[0-9A-Za-z]{8,12}$/;
const HERSTELLER = /^[0-9A-Za-z]{10,24}$/;
const BENID_LOGOUT = /^[0-9A-Za-z]{5,12}$/;
const SESSION_ID = /^[0-9A-Za-z]{10,24}$/;

function requireMatch(value: string, re: RegExp, field: string, hinweis: string): void {
  if (!re.test(value)) {
    throw new FonError(`Feld ${field} (${hinweis}) ungültig: erwartet Muster ${re.source}`);
  }
}

function requireLength(value: string, min: number, max: number, field: string, hinweis: string): void {
  if (value.length < min || value.length > max) {
    throw new FonError(`Feld ${field} (${hinweis}) ungültig: Länge muss ${min}–${max} Zeichen sein`);
  }
}

function readRc(root: XmlNode, responseElement: string): { rc: number; msg?: string } {
  const resp = findDescendant(root, responseElement);
  if (!resp) throw new FonProtocolError(`Antwort enthält kein ${responseElement}`);
  const rcText = childText(resp, 'rc');
  if (rcText === undefined) throw new FonProtocolError(`Antwort ${responseElement} ohne rc`);
  const rc = Number.parseInt(rcText, 10);
  if (Number.isNaN(rc)) throw new FonProtocolError(`rc ist keine Zahl: "${rcText}"`);
  return { rc, msg: childText(resp, 'msg') };
}

export async function createSession(config: SessionConfig): Promise<Session> {
  requireMatch(config.tid, TID, 'tid', 'Teilnehmer-Identifikation');
  requireLength(config.benid, 5, 12, 'benid', 'Benutzer-ID des Webservice-Benutzers');
  requireLength(config.pin, 5, 128, 'pin', 'PIN des Webservice-Benutzers');
  requireMatch(config.herstellerid, HERSTELLER, 'herstellerid', 'UID des Softwareherstellers');

  const loginBody = buildEnvelope({
    namespace: SESSION_NAMESPACE,
    bodyElement: 'loginRequest',
    fields: [
      { name: 'tid', value: config.tid },
      { name: 'benid', value: config.benid },
      { name: 'pin', value: config.pin },
      { name: 'herstellerid', value: config.herstellerid },
    ],
  });

  const root = await callSoap(
    { endpoint: SESSION_ENDPOINT, soapAction: 'login', body: loginBody },
    config.transport,
  );

  const { rc, msg } = readRc(root, 'loginResponse');
  if (rc !== 0) throw sessionErrorFor(rc, msg);

  const resp = findDescendant(root, 'loginResponse');
  const id = resp ? childText(resp, 'id') : undefined;
  if (!id) throw new FonProtocolError('loginResponse ohne id trotz rc=0');
  const sessionId = id;

  let loggedOut = false;
  return {
    id: sessionId,
    tid: config.tid,
    benid: config.benid,
    async logout(): Promise<void> {
      if (loggedOut) return;
      requireMatch(config.tid, TID, 'tid', 'Teilnehmer-Identifikation');
      requireMatch(config.benid, BENID_LOGOUT, 'benid', 'Benutzer-ID des Webservice-Benutzers');
      requireMatch(sessionId, SESSION_ID, 'id', 'Session-ID');

      const logoutBody = buildEnvelope({
        namespace: SESSION_NAMESPACE,
        bodyElement: 'logoutRequest',
        fields: [
          { name: 'tid', value: config.tid },
          { name: 'benid', value: config.benid },
          { name: 'id', value: sessionId },
        ],
      });

      const res = await callSoap(
        { endpoint: SESSION_ENDPOINT, soapAction: 'logout', body: logoutBody },
        config.transport,
      );
      const out = readRc(res, 'logoutResponse');
      loggedOut = true;
      if (out.rc !== 0) throw sessionErrorFor(out.rc, out.msg);
    },
  };
}
