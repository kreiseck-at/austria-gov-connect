export { createSession, type Session, type SessionConfig } from './session';
export { SESSION_ENDPOINT, SESSION_NAMESPACE, RKDB_ENDPOINT, RKDB_NAMESPACE } from './endpoints';
export {
  FonError,
  FonTransportError,
  FonProtocolError,
  FonSoapFaultError,
  FonSessionError,
  FonSessionExpiredError,
  SESSION_RC_MESSAGES,
} from './errors';
export { buildEnvelope, type EnvelopeField, type EnvelopeSpec } from './soap/envelope';
export { callSoap, type TransportOptions, type SoapCallSpec } from './transport';
export { parseXml, type XmlNode } from './soap/parse';
export { detectFault, type SoapFault } from './soap/fault';
export { escapeXmlText } from './soap/escape';
export { firstChild, childText, findDescendant, textContent } from './soap/parse';
export { sessionErrorFor } from './errors';
