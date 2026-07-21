import { type XmlNode, findDescendant, firstChild, childText } from './parse';

export interface SoapFault {
  faultcode: string;
  faultstring: string;
  detail?: string;
}

export function detectFault(root: XmlNode): SoapFault | undefined {
  const fault = findDescendant(root, 'Fault');
  if (!fault) return undefined;
  const detail = firstChild(fault, 'detail')?.text;
  return {
    faultcode: childText(fault, 'faultcode') ?? '',
    faultstring: childText(fault, 'faultstring') ?? '',
    detail: detail && detail.length > 0 ? detail : undefined,
  };
}
