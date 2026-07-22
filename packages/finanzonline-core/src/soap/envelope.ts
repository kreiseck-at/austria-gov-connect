import { escapeXmlText } from './escape';

export interface EnvelopeField {
  name: string;
  value: string;
}

export interface EnvelopeSpec {
  namespace: string;
  bodyElement: string;
  fields: EnvelopeField[];
}

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';

export function buildEnvelope(spec: EnvelopeSpec): string {
  const body = spec.fields.map((f) => `<${f.name}>${escapeXmlText(f.value)}</${f.name}>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV}">` +
    '<soapenv:Body>' +
    `<${spec.bodyElement} xmlns="${spec.namespace}">${body}</${spec.bodyElement}>` +
    '</soapenv:Body>' +
    '</soapenv:Envelope>'
  );
}
