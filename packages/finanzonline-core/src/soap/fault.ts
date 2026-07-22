import { type XmlNode, findDescendant, firstChild, childText, textContent } from './parse';

export interface SoapFault {
  faultcode: string;
  faultstring: string;
  detail?: string;
}

export function detectFault(root: XmlNode): SoapFault | undefined {
  const fault = findDescendant(root, 'Fault');
  if (!fault) return undefined;
  const detailNode = firstChild(fault, 'detail');
  // `detail` kann den nützlichen Text in einem verschachtelten Element tragen
  // (z. B. <detail><fon:ValidationError>…</fon:ValidationError></detail>) — daher
  // den gesamten Textinhalt inkl. Nachfahren einsammeln, nicht nur den direkten.
  const detail = detailNode ? textContent(detailNode).trim() : '';
  return {
    faultcode: childText(fault, 'faultcode') ?? '',
    faultstring: childText(fault, 'faultstring') ?? '',
    detail: detail.length > 0 ? detail : undefined,
  };
}
