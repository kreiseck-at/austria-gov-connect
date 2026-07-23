import {
  buildEnvelope,
  callSoap,
  findDescendant,
  childText,
  FonError,
  FonProtocolError,
  sessionErrorFor,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';

const FILEUPLOAD_ENDPOINT = 'https://finanzonline.bmf.gv.at/fon/ws/fileupload';
const FILEUPLOAD_NAMESPACE = 'https://finanzonline.bmf.gv.at/fon/ws/fileupload';

/**
 * Zulässige Anbringen-Arten (`art`) laut FileUpload-XSD-Enum. Bestimmt die Art
 * der Übermittlung, z. B. `U30` (Umsatzsteuervoranmeldung), `U13`
 * (Zusammenfassende Meldung), `JAHR_ERKL`, `L1`, `KOM`, `NOVA`, `DIGI`, …
 */
export const ANBRINGEN = [
  'U30',
  'JAHR_ERKL',
  'L1',
  'KOM',
  'SB',
  '108',
  '108AB',
  'U13',
  'GIR',
  'RZ',
  'DUE',
  'UEB',
  'FVAN',
  'ZEAN',
  'SBS',
  'KOMU',
  'EUST',
  'TVW',
  'SBZ',
  'VAT',
  'VATAB',
  'BET',
  'LFH',
  'FPH',
  'NOVA',
  'STAB',
  'KA1',
  'KDUEB',
  'UEB_SA',
  'VPDGD',
  '107',
  '107AB',
  '107HW',
  '107HWAB',
  'NOVASB',
  'NOVASBAB',
  'SOER',
  'DIGI',
  'KDX',
  'QUOTE',
] as const;

export type Anbringen = (typeof ANBRINGEN)[number];

export interface FileUpload {
  /**
   * Übermittelt eine Erklärung/Datei (`upload`). `data` ist der BMF-XML-Payload
   * der jeweiligen `art` (UTF-8; eingebettete PDFs base64). Die Antwort ist
   * synchron nur `{ rc, msg }` (0 = angenommen, negativ = siehe `msg`); das
   * eigentliche Übermittlungsprotokoll kommt asynchron in die DataBox
   * (`erltyp=P`). `rc -1` (Session abgelaufen) wirft `FonSessionExpiredError`.
   */
  upload(args: { art: Anbringen; data: string }): Promise<{ rc: number; msg?: string }>;
}

/**
 * Baut den FileUpload-Client aus einer bestehenden {@link Session}.
 * `uebermittlung` steuert Produktion (`echt` → `P`) vs. Test (`test` → `T`).
 */
export function createFileUpload(
  session: Session,
  config: { uebermittlung: 'test' | 'echt'; transport?: TransportOptions },
): FileUpload {
  async function upload(args: { art: Anbringen; data: string }): Promise<{ rc: number; msg?: string }> {
    if (!ANBRINGEN.includes(args.art)) {
      throw new FonError(`Unbekannte art: ${args.art}`);
    }

    const body = buildEnvelope({
      namespace: FILEUPLOAD_NAMESPACE,
      bodyElement: 'fileuploadRequest',
      fields: [
        { name: 'tid', value: session.tid },
        { name: 'benid', value: session.benid },
        { name: 'id', value: session.id },
        { name: 'art', value: args.art },
        { name: 'uebermittlung', value: config.uebermittlung === 'echt' ? 'P' : 'T' },
        { name: 'data', value: args.data },
      ],
    });

    const root = await callSoap(
      { endpoint: FILEUPLOAD_ENDPOINT, soapAction: 'upload', body },
      config.transport,
    );

    const resp = findDescendant(root, 'fileuploadResponse');
    if (!resp) throw new FonProtocolError('Antwort enthält kein fileuploadResponse');
    const rcText = childText(resp, 'rc');
    const rc = Number.parseInt(rcText ?? '', 10);
    if (rcText === undefined || Number.isNaN(rc)) {
      throw new FonProtocolError(`fileuploadResponse ohne gültiges rc: "${rcText}"`);
    }
    const msg = childText(resp, 'msg');
    if (rc === -1) throw sessionErrorFor(-1, msg);
    return msg ? { rc, msg } : { rc };
  }

  return { upload };
}
