import { escapeXmlText } from '@kreiseck/finanzonline-core';
import { ELDA_NAMESPACE } from './endpoints';
import type { SecurityFelder } from './security';

/** Ein methodenspezifisches Feld unter `arg0` (z. B. dateiName, payload, protokollnummer). */
export interface EldaFeld {
  name: string;
  value: string;
}

function el(name: string, value: string): string {
  return `<${name}>${escapeXmlText(value)}</${name}>`;
}

/**
 * Baut den SOAP-1.1-Envelope für eine Transfer-Webservice-Methode. Die
 * Methoden-Wrapper (`<v4:{methode}>`) ist namespace-qualifiziert; `arg0`,
 * `securityParameters` und die Felder sind (JAX-WS-typisch) unqualifiziert.
 */
export function baueEldaEnvelope(methode: string, security: SecurityFelder, felder: EldaFeld[]): string {
  const sec =
    '<securityParameters>' +
    el('apiKey', security.apiKey) +
    el('created', security.created) +
    el('kundenpasswort', security.kundenpasswort) +
    el('nonce', security.nonce) +
    el('seriennummer', security.seriennummer) +
    '</securityParameters>';
  const rest = felder.map((f) => el(f.name, f.value)).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soapenv:Body>' +
    `<v4:${methode} xmlns:v4="${ELDA_NAMESPACE}"><arg0>${sec}${rest}</arg0></v4:${methode}>` +
    '</soapenv:Body>' +
    '</soapenv:Envelope>'
  );
}
