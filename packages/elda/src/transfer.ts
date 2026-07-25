import {
  callSoap,
  findDescendant,
  childText,
  type TransportOptions,
  type XmlNode,
} from '@kreiseck/finanzonline-core';
import { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
import { baueSecurity, type SecurityQuelle } from './security';
import { baueEldaEnvelope, type EldaFeld } from './envelope';
import { istOk } from './status';
import type { Ruecksendung } from './zuordnung';

/** Konfiguration für {@link createEldaTransfer}. */
export interface EldaConfig extends SecurityQuelle {
  /** Standard: 'produktion'. */
  umgebung?: EldaUmgebung;
  /** Optionaler Endpoint-Override (sonst aus `umgebung`). */
  endpoint?: string;
  transport?: TransportOptions;
}

/** Ergebnis von {@link EldaTransfer.senden}. `ok` = `statusCode === '000'` (= von ELDA EMPFANGEN). */
export interface SendenErgebnis {
  statusCode: string;
  ok: boolean;
  protokollnummer?: string;
  dateiId?: string;
  eldaZeitstempel?: string;
  meldung?: string;
}

/** Ergebnis von {@link EldaTransfer.empfangen}. */
export interface EmpfangenErgebnis {
  statusCode: string;
  ok: boolean;
  datei?: { id?: string; name?: string; inhalt: Buffer; dateiTyp?: number; md5?: string };
  meldung?: string;
}

/** ELDA-Transfer-Client. */
export interface EldaTransfer {
  /**
   * Überträgt eine Datei (= eine Meldung) an ELDA. `inhalt` ist der Datei-Payload
   * (String oder Buffer), wird base64-kodiert. `statusCode '000'` heißt „von ELDA
   * EMPFANGEN" — die fachliche Verarbeitung kommt asynchron über {@link empfangen}.
   */
  senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<SendenErgebnis>;
  /** Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle). */
  ruecksendungenAuflisten(): Promise<Ruecksendung[]>;
  /** Holt EINE Rücksendung per Protokollnummer. Einmalig — danach nicht mehr abrufbar. */
  empfangen(protokollnummer: string | number): Promise<EmpfangenErgebnis>;
}

function statusUndMeldung(resp: XmlNode): { statusCode: string; meldung?: string } {
  const sr = findDescendant(resp, 'serviceResult');
  const statusCode = (sr && childText(sr, 'statusCode')) || '';
  const meldung = sr ? childText(sr, 'messages') : undefined;
  return { statusCode, meldung };
}

/** Baut den ELDA-Transfer-Client. Zustandslos außer der übergebenen Konfiguration. */
export function createEldaTransfer(config: EldaConfig): EldaTransfer {
  const endpoint = config.endpoint ?? ELDA_ENDPOINTS[config.umgebung ?? 'produktion'];
  const quelle: SecurityQuelle = {
    seriennummer: config.seriennummer,
    kundenpasswort: config.kundenpasswort,
    apiKey: config.apiKey,
  };

  async function ruf(methode: string, felder: EldaFeld[]): Promise<XmlNode> {
    const body = baueEldaEnvelope(methode, baueSecurity(quelle), felder);
    return callSoap({ endpoint, soapAction: methode, body }, config.transport);
  }

  return {
    async senden(args): Promise<SendenErgebnis> {
      const inhalt = typeof args.inhalt === 'string' ? Buffer.from(args.inhalt, 'utf8') : args.inhalt;
      const root = await ruf('senden', [
        { name: 'dateiName', value: args.dateiName },
        { name: 'payload', value: inhalt.toString('base64') },
      ]);
      const resp = findDescendant(root, 'return') ?? root;
      const { statusCode, meldung } = statusUndMeldung(resp);
      const erg: SendenErgebnis = { statusCode, ok: istOk(statusCode) };
      const protokollnummer = childText(resp, 'protokollnummer');
      if (protokollnummer) erg.protokollnummer = protokollnummer;
      const dateiId = childText(resp, 'dateiId');
      if (dateiId) erg.dateiId = dateiId;
      const eldaZeitstempel = childText(resp, 'eldaZeitstempel');
      if (eldaZeitstempel) erg.eldaZeitstempel = eldaZeitstempel;
      if (meldung) erg.meldung = meldung;
      return erg;
    },

    async ruecksendungenAuflisten(): Promise<Ruecksendung[]> {
      const root = await ruf('ruecksendungenAuflisten', []);
      const resp = findDescendant(root, 'return') ?? root;
      return resp.children
        .filter((c) => c.name === 'ruecksendungen')
        .map((c) => ({
          protokollnummer: childText(c, 'protokollnummer') ?? '',
          dateiName: childText(c, 'dateiName') ?? '',
        }));
    },

    async empfangen(protokollnummer): Promise<EmpfangenErgebnis> {
      const root = await ruf('empfangen', [{ name: 'protokollnummer', value: String(protokollnummer) }]);
      const resp = findDescendant(root, 'return') ?? root;
      const { statusCode, meldung } = statusUndMeldung(resp);
      const erg: EmpfangenErgebnis = { statusCode, ok: istOk(statusCode) };
      const datei = findDescendant(resp, 'datei');
      if (datei) {
        const inhaltB64 = childText(datei, 'payload') ?? '';
        const d: EmpfangenErgebnis['datei'] = { inhalt: Buffer.from(inhaltB64, 'base64') };
        const id = childText(datei, 'id');
        if (id) d.id = id;
        const name = childText(datei, 'name');
        if (name) d.name = name;
        const md5 = childText(datei, 'md5');
        if (md5) d.md5 = md5;
        const dateiTyp = childText(datei, 'dateiTyp');
        if (dateiTyp) d.dateiTyp = Number.parseInt(dateiTyp, 10);
        erg.datei = d;
      }
      if (meldung) erg.meldung = meldung;
      return erg;
    },
  };
}
