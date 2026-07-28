import {
  callSoap,
  findDescendant,
  firstChild,
  childText,
  FonTransportError,
  type XmlNode,
} from '@kreiseck/finanzonline-core';
import { baueSecurity } from './security';
import { baueEldaEnvelope, type EldaFeld } from './envelope';
import { istOk } from './status';
import { EldaProtocolError } from './errors';
import type { Ruecksendung } from './zuordnung';
import { loeseEndpoint, type EldaConfig } from './konfiguration';

export type { EldaConfig };

/** Ergebnis von {@link EldaTransferRoh.senden}. `ok` = `statusCode === '000'` (= von ELDA EMPFANGEN). */
export interface SendenErgebnis {
  /** ELDA-Status-Code aus `serviceResult.statusCode` (siehe `ELDA_STATUS`), z. B. `'000'` bei Erfolg. */
  statusCode: string;
  /** `true` genau dann, wenn `statusCode === '000'` — die Datei wurde von ELDA angenommen ("EMPFANGEN"). */
  ok: boolean;
  /**
   * Von ELDA vergebene Protokollnummer der Sendung — der Schlüssel, mit dem
   * später über {@link EldaTransferRoh.ruecksendungenAuflisten} (per `findeRuecksendung`)
   * oder direkt über {@link EldaTransferRoh.empfangen} das zugehörige
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

/** Eine von ELDA abgeholte Rücksendungsdatei. */
export interface EldaDatei {
  /** Interne ELDA-Datei-ID. */
  id?: string;
  /** Dateiname der Rücksendung, wie von ELDA vergeben. */
  name?: string;
  /** Dateiinhalt, aus dem inline übermittelten Base64 dekodiert. */
  inhalt: Buffer;
  /** Numerischer Dateityp laut ELDA. Nur gesetzt, wenn ELDA einen gültigen numerischen Wert liefert. */
  dateiTyp?: number;
  /** MD5-Prüfsumme des Dateiinhalts, wie von ELDA übermittelt. */
  md5?: string;
}

/** Ergebnis von {@link EldaTransferRoh.empfangen}. */
export interface EmpfangenErgebnis {
  /** ELDA-Status-Code, z. B. `'000'` bei Erfolg, `'406'` wenn keine Rücksendung mit dieser Protokollnummer existiert. */
  statusCode: string;
  /** `true` genau dann, wenn `statusCode === '000'`. */
  ok: boolean;
  /** Die abgeholte Rücksendungsdatei. Nur gesetzt, wenn ELDA eine `<datei>` geliefert hat. */
  datei?: EldaDatei;
  /** Klartext-Meldung aus `serviceResult.messages`. */
  meldung?: string;
}

/** Ergebnis von {@link EldaTransferRoh.ruecksendungenAuflisten}. */
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

/** ELDA-Transfer-Client (rohe Variante, siehe {@link createEldaTransferRoh}). */
export interface EldaTransferRoh {
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
   * abrufbar.
   *
   * MTOM/XOP wird von diesem Client (noch) nicht unterstützt. Je nachdem, wie
   * ELDA antwortet, äußert sich das in zwei verschiedenen Fehlern:
   * - **Echte MTOM-Antwort** (`multipart/related` mit MIME-Teilen): Der Body ist
   *   kein XML, das Parsing scheitert bereits im Transport von
   *   `@kreiseck/finanzonline-core` — es kommt ein `FonProtocolError`
   *   („Antwort ist kein gültiges XML").
   * - **Reguläre XML-Antwort mit XOP-Referenz** (`<payload><xop:Include href="cid:…"/></payload>`,
   *   z. B. wenn das Attachment fehlt oder abgetrennt wurde): Das erkennt dieser
   *   Client und wirft einen {@link EldaProtocolError}, statt eine leere Datei
   *   vorzutäuschen.
   */
  empfangen(protokollnummer: string | number): Promise<EmpfangenErgebnis>;
}

/**
 * Liest den Text eines Kindelements und trimmt ihn. ELDA darf seine Antworten
 * pretty-printed liefern (`<statusCode>\n  000\n</statusCode>`) — ungetrimmt
 * wäre jeder Vergleich falsch (`istOk` würde bei einer erfolgreichen Sendung
 * `false` liefern und der Aufrufer womöglich ein Duplikat senden). Ein nach dem
 * Trimmen leerer Wert zählt — wie ein fehlendes Element — als „nicht vorhanden".
 */
function feldText(node: XmlNode, name: string): string | undefined {
  const roh = childText(node, name);
  if (roh === undefined) return undefined;
  const wert = roh.trim();
  return wert === '' ? undefined : wert;
}

/**
 * Liest `serviceResult` einer Antwort. Fehlt das Element oder trägt es keinen
 * `statusCode`, ist nicht entscheidbar, ob der Aufruf erfolgreich war — das wird
 * laut geworfen (konsistent zu {@link holeReturn}), statt stillschweigend einen
 * leeren Status-Code und damit `ok: false` vorzutäuschen.
 */
function statusUndMeldung(resp: XmlNode, methode: string): { statusCode: string; meldung?: string } {
  const sr = findDescendant(resp, 'serviceResult');
  const statusCode = sr ? feldText(sr, 'statusCode') : undefined;
  if (!sr || !statusCode) {
    throw new EldaProtocolError(
      `Antwort auf '${methode}' enthält kein auswertbares <serviceResult><statusCode>. ` +
        'Ohne Status-Code lässt sich Erfolg nicht von Fehlschlag unterscheiden.',
    );
  }
  return { statusCode, meldung: feldText(sr, 'messages') };
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

/**
 * Baut den ELDA-Transfer-Client. Zustandslos außer der übergebenen Konfiguration.
 *
 * Rohe Variante — gibt Ergebnisobjekte zurück und wirft bei fachlichen
 * Status-Codes nie. Der komfortable Einstieg ist `createEldaTransfer` aus
 * `./transfer`.
 */
export function createEldaTransferRoh(config: EldaConfig): EldaTransferRoh {
  const endpoint = loeseEndpoint(config);

  const { retries: retriesRoh = 0, ...transport } = config.transport ?? {};
  // Fail closed: ein ungültiger Wert (NaN, negativ, gebrochen, Infinity — etwa
  // aus einer unbesetzten Env-Variable) macht `versuch >= retries` sonst
  // dauerhaft `false` (NaN) bzw. dauerhaft wahr in der falschen Richtung
  // (Infinity) und die Wiederholung liefe endlos. Deshalb einmal hier auf `0`
  // normalisiert, statt die Prüfung in die Schleifenbedingung zu verlagern.
  const retries = Number.isSafeInteger(retriesRoh) && retriesRoh >= 0 ? retriesRoh : 0;

  /**
   * Führt einen Webservice-Aufruf aus und wiederholt ihn bei Transportfehlern.
   *
   * Die Wiederholung liegt bewusst hier und nicht im Transport: `nonce` und
   * `created` dürfen nicht wiederverwendet werden (ELDA antwortet sonst mit
   * `552` bzw. `551`), deshalb werden Security-Parameter UND Envelope für jeden
   * Versuch neu gebaut und `callSoap` mit `retries: 0` aufgerufen. Wiederholt
   * wird nur bei `FonTransportError` — SOAP-Faults, Protokollfehler und
   * fachliche Status-Codes werden unverändert durchgereicht.
   */
  async function ruf(methode: string, felder: EldaFeld[]): Promise<XmlNode> {
    for (let versuch = 0; ; versuch++) {
      const body = baueEldaEnvelope(methode, baueSecurity(config), felder);
      try {
        return await callSoap({ endpoint, soapAction: methode, body }, { ...transport, retries: 0 });
      } catch (err) {
        if (versuch >= retries || !(err instanceof FonTransportError)) throw err;
      }
    }
  }

  return {
    async senden(args): Promise<SendenErgebnis> {
      const inhalt = typeof args.inhalt === 'string' ? Buffer.from(args.inhalt, 'utf8') : args.inhalt;
      const root = await ruf('senden', [
        { name: 'dateiName', value: args.dateiName },
        { name: 'payload', value: inhalt.toString('base64') },
      ]);
      const resp = holeReturn(root, 'senden');
      const { statusCode, meldung } = statusUndMeldung(resp, 'senden');
      const erg: SendenErgebnis = { statusCode, ok: istOk(statusCode) };
      const protokollnummer = feldText(resp, 'protokollnummer');
      if (protokollnummer) erg.protokollnummer = protokollnummer;
      const dateiId = feldText(resp, 'dateiId');
      if (dateiId) erg.dateiId = dateiId;
      const eldaZeitstempel = feldText(resp, 'eldaZeitstempel');
      if (eldaZeitstempel) erg.eldaZeitstempel = eldaZeitstempel;
      if (meldung) erg.meldung = meldung;
      return erg;
    },

    async ruecksendungenAuflisten(): Promise<AuflistenErgebnis> {
      const root = await ruf('ruecksendungenAuflisten', []);
      const resp = holeReturn(root, 'ruecksendungenAuflisten');
      const { statusCode, meldung } = statusUndMeldung(resp, 'ruecksendungenAuflisten');
      const ruecksendungen = resp.children
        .filter((c) => c.name === 'ruecksendungen')
        .map((c) => {
          const protokollnummer = feldText(c, 'protokollnummer');
          if (!protokollnummer) {
            throw new EldaProtocolError(
              "Antwort auf 'ruecksendungenAuflisten' enthält eine <ruecksendungen> ohne " +
                'Protokollnummer. Eine solche Rücksendung ist nicht abholbar — sie wird nicht ' +
                'als leerer Eintrag erfunden.',
            );
          }
          // Ein fehlender dateiName macht die Rücksendung nur für `findeRuecksendung`
          // unbrauchbar, nicht für `empfangen` — deshalb kein Abbruch.
          return { protokollnummer, dateiName: feldText(c, 'dateiName') ?? '' };
        });
      const erg: AuflistenErgebnis = { statusCode, ok: istOk(statusCode), ruecksendungen };
      if (meldung) erg.meldung = meldung;
      return erg;
    },

    async empfangen(protokollnummer): Promise<EmpfangenErgebnis> {
      const root = await ruf('empfangen', [{ name: 'protokollnummer', value: String(protokollnummer) }]);
      const resp = holeReturn(root, 'empfangen');
      const { statusCode, meldung } = statusUndMeldung(resp, 'empfangen');
      const erg: EmpfangenErgebnis = { statusCode, ok: istOk(statusCode) };
      const datei = findDescendant(resp, 'datei');
      if (datei) {
        // Metadaten VOR dem Payload lesen: Sie hängen unten an beiden Protokollfehlern mit, denn
        // ELDA hat die einmalige Zustellung in beiden Fällen bereits verbraucht — die Bytes selbst
        // sind nicht mehr zu retten, aber diese Felder sind alles, was von der Antwort sonst übrig
        // bliebe. Ausschließlich aus der geparsten Antwort, nie aus Konfiguration oder Request.
        const bekannteMetadaten: Pick<EldaDatei, 'id' | 'name' | 'md5' | 'dateiTyp'> = {};
        const id = feldText(datei, 'id');
        if (id) bekannteMetadaten.id = id;
        const name = feldText(datei, 'name');
        if (name) bekannteMetadaten.name = name;
        const md5 = feldText(datei, 'md5');
        if (md5) bekannteMetadaten.md5 = md5;
        const dateiTyp = feldText(datei, 'dateiTyp');
        if (dateiTyp) {
          const parsed = Number.parseInt(dateiTyp, 10);
          if (Number.isFinite(parsed)) bekannteMetadaten.dateiTyp = parsed;
        }
        const teilErgebnis: {
          statusCode: string;
          ok: boolean;
          meldung?: string;
          datei?: Omit<EldaDatei, 'inhalt'>;
        } = { statusCode, ok: istOk(statusCode) };
        if (meldung) teilErgebnis.meldung = meldung;
        if (Object.keys(bekannteMetadaten).length > 0) teilErgebnis.datei = bekannteMetadaten;

        const payloadNode = firstChild(datei, 'payload');
        const xopReferenz = payloadNode?.children.some((c) => c.name === 'Include');
        if (xopReferenz) {
          throw new EldaProtocolError(
            'Payload ist MTOM/XOP-referenziert (<xop:Include>), dieser Client erwartet inline Base64. ' +
              'MTOM wird von diesem Client derzeit nicht unterstützt.',
            teilErgebnis,
          );
        }
        const inhaltB64 = payloadNode?.text.trim() ?? '';
        if (!inhaltB64 && istOk(statusCode)) {
          throw new EldaProtocolError(
            'Antwort meldet statusCode 000 mit einer <datei>, aber der Payload ist leer ' +
              '(weder Base64 noch MTOM/XOP-Referenz) — die Datei wäre sonst stillschweigend verloren.',
            teilErgebnis,
          );
        }
        erg.datei = { inhalt: Buffer.from(inhaltB64, 'base64'), ...bekannteMetadaten };
      }
      if (meldung) erg.meldung = meldung;
      return erg;
    },
  };
}
