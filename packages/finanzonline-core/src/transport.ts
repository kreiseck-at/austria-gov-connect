import { parseXml, type XmlNode } from './soap/parse';
import { detectFault } from './soap/fault';
import { FonTransportError, FonSoapFaultError, FonProtocolError } from './errors';

export interface TransportOptions {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

export interface SoapCallSpec {
  endpoint: string;
  soapAction: string;
  body: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function callSoap(spec: SoapCallSpec, opts: TransportOptions = {}): Promise<XmlNode> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 0;
  const doFetch = opts.fetchImpl ?? fetch;

  let status = 0;
  let responseText = '';
  let attempt = 0;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(spec.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${spec.soapAction}"`,
        },
        body: spec.body,
        signal: controller.signal,
      });
      status = res.status;
      responseText = await res.text();
      clearTimeout(timer);
      break;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < retries) {
        attempt++;
        continue;
      }
      const reason = controller.signal.aborted
        ? `Zeitüberschreitung nach ${timeoutMs} ms`
        : (err as Error).message;
      throw new FonTransportError(`Übertragung fehlgeschlagen: ${reason}`, { cause: err });
    }
  }

  let root: XmlNode;
  try {
    root = parseXml(responseText);
  } catch (err) {
    // Der ungeparste Body hängt am Fehler (nicht an der `message`, siehe
    // `FonProtocolError.rohantwort`): Bei Diensten mit einmaliger Zustellung —
    // ELDA `empfangen` — ist er die letzte Stelle, an der die Nutzdaten noch
    // existieren. Ihn hier zu verwerfen hieße, sie endgültig zu verlieren.
    throw new FonProtocolError(`Antwort ist kein gültiges XML (HTTP ${status}): ${(err as Error).message}`, {
      cause: err,
      httpStatus: status,
      rohantwort: responseText,
    });
  }

  const fault = detectFault(root);
  if (fault) {
    throw new FonSoapFaultError(fault.faultstring || 'SOAP-Fault', fault.faultcode, fault.detail);
  }
  if (status < 200 || status >= 300) {
    throw new FonProtocolError(`Unerwarteter HTTP-Status ${status} ohne SOAP-Fault`, {
      httpStatus: status,
      rohantwort: responseText,
    });
  }
  return root;
}
