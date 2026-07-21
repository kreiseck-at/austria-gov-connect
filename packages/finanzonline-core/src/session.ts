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
  logout(): Promise<void>;
}

const TID = /^[0-9A-Za-z]{8,12}$/;
const HERSTELLER = /^[0-9A-Za-z]{10,24}$/;
const BENID_LOGOUT = /^[0-9A-Za-z]{5,12}$/;
const SESSION_ID = /^[0-9A-Za-z]{10,24}$/;

function requireMatch(value: string, re: RegExp, field: string): void {
  if (!re.test(value)) {
    throw new FonError(`Ungültiges Feld ${field}: entspricht nicht ${re.source}`);
  }
}

function requireLength(value: string, min: number, max: number, field: string): void {
  if (value.length < min || value.length > max) {
    throw new FonError(`Ungültiges Feld ${field}: Länge muss zwischen ${min} und ${max} liegen`);
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
  requireMatch(config.tid, TID, 'tid');
  requireLength(config.benid, 5, 12, 'benid');
  requireLength(config.pin, 5, 128, 'pin');
  requireMatch(config.herstellerid, HERSTELLER, 'herstellerid');

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
    async logout(): Promise<void> {
      if (loggedOut) return;
      requireMatch(config.tid, TID, 'tid');
      requireMatch(config.benid, BENID_LOGOUT, 'benid');
      requireMatch(sessionId, SESSION_ID, 'id');

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
