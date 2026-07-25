import {
  callSoap,
  findDescendant,
  firstChild,
  childText,
  type TransportOptions,
  type XmlNode,
} from '@kreiseck/finanzonline-core';
import { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
import { baueSecurity, type SecurityQuelle } from './security';
import { baueEldaEnvelope, type EldaFeld } from './envelope';
import { istOk } from './status';
import { EldaProtocolError } from './errors';
import type { Ruecksendung } from './zuordnung';

/** Konfiguration für {@link createEldaTransfer}. */
export interface EldaConfig extends SecurityQuelle {
  /**
   * Betriebsumgebung, bestimmt den Endpoint aus `ELDA_ENDPOINTS` (Produktion,
   * Kundentest oder SIT). Standard: `'produktion'`.
   */
  umgebung?: EldaUmgebung;
  /**
   * Expliziter Endpoint-Override — hat Vorrang vor `umgebung` (z. B. für Tests
   * oder einen abweichenden Proxy).
   */
  endpoint?: string;
  /**
   * Transport-Feineinstellungen (Timeout, Retries, `fetch`-Implementierung) —
   * siehe `TransportOptions` aus `@kreiseck/finanzonline-core`.
   */
  transport?: TransportOptions;
}

/** Ergebnis von {@link EldaTransfer.senden}. `ok` = `statusCode === '000'` (= von ELDA EMPFANGEN). */
export interface SendenErgebnis {
  /** ELDA-Status-Code aus `serviceResult.statusCode` (siehe `ELDA_STATUS`), z. B. `'000'` bei Erfolg. */
  statusCode: string;
  /** `true` genau dann, wenn `statusCode === '000'` — die Datei wurde von ELDA angenommen ("EMPFANGEN"). */
  ok: boolean;
  /**
   * Von ELDA vergebene Protokollnummer der Sendung — der Schlüssel, mit dem
   * später über {@link EldaTransfer.ruecksendungenAuflisten} (per `zuordnung`)
   * oder direkt über {@link EldaTransfer.empfangen} das zugehörige
   * Verarbeitungsprotokoll abgeholt wird. Nur gesetzt, wenn ELDA eine
   * Protokollnummer zurückliefert.
   */
  protokollnummer?: string;
  /** Interne ELDA-Datei-ID der übermittelten Sendung. Nur bei Erfolg gesetzt. */
  dateiId?: string;
  /** Zeitstempel (ISO-8601 mit Offset), zu dem ELDA die Datei angenommen hat. */
  eldaZeitstempel?: string;
  /** Klartext-Meldung aus `serviceResult.messages` — v. a. bei Fehlern relevant (trägt z. B. den auslösenden Fehlercode). */
  meldung?: string;
}

/** Ergebnis von {@link EldaTransfer.empfangen}. */
export interface EmpfangenErgebnis {
  /** ELDA-Status-Code, z. B. `'000'` bei Erfolg, `'406'` wenn keine Rücksendung mit dieser Protokollnummer existiert. */
  statusCode: string;
  /** `true` genau dann, wenn `statusCode === '000'`. */
  ok: boolean;
  /** Die abgeholte Rücksendungsdatei. Nur gesetzt, wenn ELDA eine `<datei>` geliefert hat. */
  datei?: {
    /** Interne ELDA-Datei-ID. */
    id?: string;
    /** Dateiname der Rücksendung, wie von ELDA vergeben. */
    name?: string;
    /** Dateiinhalt, aus dem inline übermittelten Base64 dekodiert. */
    inhalt: Buffer;
    /** Numerischer Dateityp laut ELDA (z. B. Protokoll- vs. Fehlerdatei). Nur gesetzt, wenn ELDA einen gültigen, numerischen Wert liefert. */
    dateiTyp?: number;
    /** MD5-Prüfsumme des Dateiinhalts, wie von ELDA übermittelt. */
    md5?: string;
  };
  /** Klartext-Meldung aus `serviceResult.messages`. */
  meldung?: string;
}

/** Ergebnis von {@link EldaTransfer.ruecksendungenAuflisten}. */
export interface AuflistenErgebnis {
  /**
   * ELDA-Status-Code des Aufrufs selbst (z. B. `'557'` bei ungültigem API-Key,
   * `'552'` bei Nonce-Replay) — unabhängig davon, ob und wie viele
   * Rücksendungen offen sind. Ein leeres `ruecksendungen`-Array bei
   * `statusCode !== '000'` bedeutet NICHT "keine offen", sondern dass der
   * Aufruf selbst fehlgeschlagen ist.
   */
  statusCode: string;
  /** `true` genau dann, wenn `statusCode === '000'`. */
  ok: boolean;
  /** Abholbereite Rücksendungen. Leeres Array, wenn keine offen sind (auch bei `ok: true`). */
  ruecksendungen: Ruecksendung[];
  /** Klartext-Meldung aus `serviceResult.messages`. */
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
  /**
   * Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle) samt dem
   * Status-Code des Aufrufs selbst — siehe {@link AuflistenErgebnis}.
   */
  ruecksendungenAuflisten(): Promise<AuflistenErgebnis>;
  /**
   * Holt EINE Rücksendung per Protokollnummer. Einmalig — danach nicht mehr
   * abrufbar. MTOM/XOP-referenzierte Payloads werden (noch) nicht unterstützt
   * und führen zu einem {@link EldaProtocolError}, statt eine leere Datei
   * vorzutäuschen.
   */
  empfangen(protokollnummer: string | number): Promise<EmpfangenErgebnis>;
}

function statusUndMeldung(resp: XmlNode): { statusCode: string; meldung?: string } {
  const sr = findDescendant(resp, 'serviceResult');
  const statusCode = (sr && childText(sr, 'statusCode')) || '';
  const meldung = sr ? childText(sr, 'messages') : undefined;
  return { statusCode, meldung };
}

/**
 * Liefert das `<return>`-Element einer Antwort. Fehlt es, ist die Antwort nicht
 * sinnvoll auswertbar (jeder weitere Feld-Zugriff würde stillschweigend
 * `undefined` liefern) — das wird laut geworfen statt eine halb geparste
 * Erfolgsantwort vorzutäuschen.
 */
function holeReturn(root: XmlNode, methode: string): XmlNode {
  const resp = findDescendant(root, 'return');
  if (!resp) {
    throw new EldaProtocolError(`Antwort auf '${methode}' enthält kein <return>-Element.`);
  }
  return resp;
}

/** Baut den ELDA-Transfer-Client. Zustandslos außer der übergebenen Konfiguration. */
export function createEldaTransfer(config: EldaConfig): EldaTransfer {
  const endpoint = config.endpoint ?? ELDA_ENDPOINTS[config.umgebung ?? 'produktion'];

  async function ruf(methode: string, felder: EldaFeld[]): Promise<XmlNode> {
    const body = baueEldaEnvelope(methode, baueSecurity(config), felder);
    return callSoap({ endpoint, soapAction: methode, body }, config.transport);
  }

  return {
    async senden(args): Promise<SendenErgebnis> {
      const inhalt = typeof args.inhalt === 'string' ? Buffer.from(args.inhalt, 'utf8') : args.inhalt;
      const root = await ruf('senden', [
        { name: 'dateiName', value: args.dateiName },
        { name: 'payload', value: inhalt.toString('base64') },
      ]);
      const resp = holeReturn(root, 'senden');
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

    async ruecksendungenAuflisten(): Promise<AuflistenErgebnis> {
      const root = await ruf('ruecksendungenAuflisten', []);
      const resp = holeReturn(root, 'ruecksendungenAuflisten');
      const { statusCode, meldung } = statusUndMeldung(resp);
      const ruecksendungen = resp.children
        .filter((c) => c.name === 'ruecksendungen')
        .map((c) => ({
          protokollnummer: childText(c, 'protokollnummer') ?? '',
          dateiName: childText(c, 'dateiName') ?? '',
        }));
      const erg: AuflistenErgebnis = { statusCode, ok: istOk(statusCode), ruecksendungen };
      if (meldung) erg.meldung = meldung;
      return erg;
    },

    async empfangen(protokollnummer): Promise<EmpfangenErgebnis> {
      const root = await ruf('empfangen', [{ name: 'protokollnummer', value: String(protokollnummer) }]);
      const resp = holeReturn(root, 'empfangen');
      const { statusCode, meldung } = statusUndMeldung(resp);
      const erg: EmpfangenErgebnis = { statusCode, ok: istOk(statusCode) };
      const datei = findDescendant(resp, 'datei');
      if (datei) {
        const payloadNode = firstChild(datei, 'payload');
        const xopReferenz = payloadNode?.children.some((c) => c.name === 'Include');
        if (xopReferenz) {
          throw new EldaProtocolError(
            'Payload ist MTOM/XOP-referenziert (<xop:Include>), dieser Client erwartet inline Base64. ' +
              'MTOM wird von diesem Client derzeit nicht unterstützt.',
          );
        }
        const inhaltB64 = payloadNode?.text ?? '';
        if (!inhaltB64 && istOk(statusCode)) {
          throw new EldaProtocolError(
            'Antwort meldet statusCode 000 mit einer <datei>, aber der Payload ist leer ' +
              '(weder Base64 noch MTOM/XOP-Referenz) — die Datei wäre sonst stillschweigend verloren.',
          );
        }
        const d: EmpfangenErgebnis['datei'] = { inhalt: Buffer.from(inhaltB64, 'base64') };
        const id = childText(datei, 'id');
        if (id) d.id = id;
        const name = childText(datei, 'name');
        if (name) d.name = name;
        const md5 = childText(datei, 'md5');
        if (md5) d.md5 = md5;
        const dateiTyp = childText(datei, 'dateiTyp');
        if (dateiTyp) {
          const parsed = Number.parseInt(dateiTyp, 10);
          if (Number.isFinite(parsed)) d.dateiTyp = parsed;
        }
        erg.datei = d;
      }
      if (meldung) erg.meldung = meldung;
      return erg;
    },
  };
}
