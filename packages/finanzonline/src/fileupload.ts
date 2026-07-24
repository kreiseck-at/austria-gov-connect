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
 * Zulässige Anbringen-Arten (`art`) des FileUpload-Webservices. Vollständige
 * Liste 1:1 aus der BMF-Spezifikation „File-Upload-Webservice" (Stand
 * 04.03.2026) übernommen — nicht geraten.
 */
export const ANBRINGEN = [
  'BET', //      Beteiligte einer Personengesellschaft/-gemeinschaft
  'BIL', //      E-Bilanz
  'DUE', //      Depotübertragung
  'EUST', //     EU-Quellensteuer
  'FPH', //      Flugabgabe – Flugplatzhalter
  'FVAN', //     Fristverlängerung für Abgabenerklärungen
  'IVF', //      Investmentfonds
  'JAHR_ERKL', //Jahreserklärung (E1, U1, K1, K2, E6)
  'JAB', //      Jahresabschluss Firmenbuch
  'KA1', //      Kapitalertragssteuererklärung
  'KOM', //      Kommunalsteuerbemessungsgrundlage
  'KOMU', //     Kommunalsteuererklärung
  'LFH', //      Flugabgabe – Luftfahrzeughalter
  'L1', //       Arbeitnehmerveranlagung
  'NOVA', //     Normverbrauchsabgabe
  'RZ', //       Rückzahlung
  'SB', //       Buchung von Selbstbemessungsabgaben
  'SBS', //      Berichtigung von Selbstbemessungsabgaben
  'SBZ', //      Meldung zur Zahlung von Selbstbemessungsabgaben
  'STAB', //     Erklärung über die Stabilitätsabgabe
  'TVW', //      Teamverwaltung
  'UEB', //      Übertragung innerhalb der Finanzverwaltung
  'UEB_SA', //   Sonderausgaben
  'U13', //      Zusammenfassende Meldung (innergem. Warenlieferungen)
  'U30', //      Umsatzsteuervoranmeldung
  'VAT', //      Vorsteuererstattung anderer EU-Mitgliedstaat
  'VATAB', //    Vorsteuererstattung anderer EU-Mitgliedstaat – Abschluss
  'VPDGD', //    Country by Country Reporting (CbC)
  'ZEAN', //     Zahlungserleichterung
  '107', //      Leitungsrechte gem. § 107 Abs. 8 EStG 1988
  '107AB', //    Leitungsrechte gem. § 107 Abs. 8 EStG 1988 – Abschluss
  '108', //      Prämienbegünstigte Vorsorge § 108 EStG
  '108AB', //    Prämienbegünstigte Vorsorge § 108 EStG – Abschluss
  'SOER', //     Sonstige Erklärungen
  'DIGI', //     Digitalsteuererklärung
  'QUOTE', //    Quotenmeldung
  '107HW', //    Hochwasserschäden-Maßnahmen gem. § 107 EStG
  '107HWAB', //  Hochwasserschäden-Maßnahmen gem. § 107 EStG – Abschluss
  'GIR', //      Mindeststeuer-Bericht (Globe Information Return)
] as const;

export type Anbringen = (typeof ANBRINGEN)[number];

export interface FileUpload {
  /**
   * Übermittelt eine Erklärung/Datei (`upload`). `data` ist der BMF-XML-Payload
   * der jeweiligen `art` (UTF-8; eingebettete PDFs base64). Die Nutzdaten werden
   * XML-escaped übertragen — laut Spec ist auch ein CDATA-Abschnitt zulässig,
   * escaped funktioniert aber (live gegen FON mit rc=0 verifiziert, 2026-07-24).
   *
   * Antwort synchron `{ rc, msg }`. Returncodes (BMF-Spec):
   * `0` = ok · `-1` = Session ungültig/abgelaufen (→ `FonSessionExpiredError`) ·
   * `-2` = Wartung · `-3` = technischer Fehler · `-4` = Fehler vom Parser ·
   * `-5` = keine Berechtigung für diese `art`. Technische Fehler kommen als
   * SOAP-Fault. Das Übermittlungsprotokoll liegt anschließend asynchron in der
   * DataBox (`erltyp=P`, filebez `Webservice_<art>_<ts>_<paketnr>`).
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
