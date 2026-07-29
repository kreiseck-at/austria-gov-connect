import { createHash } from 'node:crypto';
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
import { EldaError, EldaProtocolError } from './errors';
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
  /**
   * Dateiinhalt, aus dem inline übermittelten Base64 dekodiert. Liefert ELDA
   * eine `md5`, ist sie gegen genau diesen Inhalt geprüft (siehe
   * {@link EldaTransferRoh.empfangen}).
   */
  inhalt: Buffer;
  /**
   * Dateityp laut ELDA, **unverändert** als Text.
   *
   * Die Tabelle der Schnittstellenbeschreibung (Abschnitt 4.2 „Datei") nennt als
   * Typ `Integer`, die Beispiel-Ausgabe desselben Dokuments (Abschnitt 7.4.3.3)
   * zeigt aber `Node dateiTyp with value XML`. Das Dokument widerspricht sich
   * also selbst; welche der beiden Formen im Betrieb kommt, ist erst mit einem
   * echten Zugang zu klären. Deshalb wird der Wert weder nach `number` gedeutet
   * noch — wie zuvor — bei nicht-numerischem Inhalt stillschweigend verworfen.
   */
  dateiTyp?: string;
  /**
   * MD5-Prüfsumme des Dateiinhalts, wie von ELDA übermittelt (Abschnitt 4.2:
   * „Wert aus datei.md5"). Ist sie gesetzt, wurde `inhalt` bereits gegen sie
   * geprüft — bei Abweichung kommt gar kein Ergebnis, sondern ein
   * {@link EldaProtocolError}.
   */
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
   *
   * **Zur Kodierung:** Ein `string` wird als **UTF-8** kodiert. Ein E.29-Bestand
   * ist dagegen **ISO-8859-15** — deshalb `inhalt` immer als `Buffer` übergeben,
   * so wie `erstelleBestand` ihn liefert. Ein von Hand zusammengesetzter String
   * mit Umlauten (ä, ö, ü, ß) oder dem Euro-Zeichen ginge sonst still als
   * Mehrbyte-UTF-8 auf die Leitung und verschöbe damit jedes Fixlängenfeld
   * dahinter.
   */
  senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<SendenErgebnis>;
  /**
   * Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle) samt dem
   * Status-Code des Aufrufs selbst — siehe {@link AuflistenErgebnis}.
   */
  ruecksendungenAuflisten(): Promise<AuflistenErgebnis>;
  /**
   * Holt EINE Rücksendung per Protokollnummer. Einmalig und unwiderruflich —
   * danach nicht mehr abrufbar (FAQ 8.2 der Schnittstellenbeschreibung).
   *
   * **`transport.retries` gilt hier NICHT.** Ein Transportfehler kann auftreten,
   * nachdem ELDA die Zustellung bereits als verbraucht verbucht hat (etwa wenn
   * der Body-Download in die Zeitüberschreitung läuft — das Zeitlimit von
   * `callSoap` umfasst den gesamten Body). Ein automatischer zweiter Versuch
   * bekäme dann nur noch `408` („bereits empfangen") und der Aufrufer hielte den
   * selbst verursachten Verlust für einen fremden Abruf. Deshalb wird
   * `empfangen` nie automatisch wiederholt.
   *
   * **Ein `FonTransportError` aus `empfangen` heißt daher nicht „nichts
   * passiert".** Die Rücksendung kann bei ELDA bereits als abgeholt gelten. Vor
   * einem eigenen zweiten Versuch prüfen, ob die Protokollnummer noch in
   * {@link ruecksendungenAuflisten} steht.
   *
   * Der Inhalt wird geprüft, statt blind dekodiert: Ist der `<payload>` kein
   * wohlgeformtes Base64 oder passt er nicht zur mitgelieferten `md5`, wirft
   * diese Methode einen {@link EldaProtocolError}, an dem der rohe Payload
   * hängt — `Buffer.from(…, 'base64')` überginge beides stillschweigend.
   *
   * MTOM/XOP wird von diesem Client (noch) nicht unterstützt. Je nachdem, wie
   * ELDA antwortet, äußert sich das in zwei verschiedenen Fehlern:
   * - **Echte MTOM-Antwort** (`multipart/related` mit MIME-Teilen): Der Body ist
   *   kein XML, das Parsing scheitert bereits im Transport von
   *   `@kreiseck/finanzonline-core` — es kommt ein `FonProtocolError`
   *   („Antwort ist kein gültiges XML"). Dessen `rohantwort` trägt den
   *   ungeparsten Body und damit den MIME-Teil mit den Protokoll-Bytes: die
   *   einzige verbliebene Kopie.
   * - **Reguläre XML-Antwort mit XOP-Referenz** (`<payload><xop:Include href="cid:…"/></payload>`,
   *   z. B. wenn das Attachment fehlt oder abgetrennt wurde): Das erkennt dieser
   *   Client und wirft einen {@link EldaProtocolError}, statt eine leere Datei
   *   vorzutäuschen.
   *
   * @throws EldaError wenn `protokollnummer` leer, `undefined` oder keine
   * nicht-negative Ganzzahl ist — ohne Prüfung ginge `"undefined"` bzw. ein
   * leeres Element auf die Leitung und ELDA antwortete mit `406`, ununterscheidbar
   * von einer echten, aber falsch adressierten Abfrage.
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
 * Prüft eine Protokollnummer, bevor sie auf die Leitung geht. Ohne diese Prüfung
 * ginge `String(undefined)` als Literal `"undefined"` bzw. ein leerer String als
 * leeres Element in den Request; ELDA antwortete darauf mit `406` („Datei mit
 * Protokollnummer nicht vorhanden") — nicht zu unterscheiden von einer echten,
 * aber falsch adressierten Abfrage. `findeRuecksendung` weist eine leere Nadel
 * aus demselben Grund zurück.
 *
 * Laut Abschnitt 3.5 („EmpfangenRequest") ist `protokollnummer` vom Typ `Long`:
 * Zahlen müssen deshalb ganzzahlig und nicht negativ sein (`1.5` oder `1e21`
 * würden über `String()` sonst zu `"1.5"` bzw. `"1e+21"`). Strings werden nur
 * getrimmt und auf „nicht leer" geprüft — sie stammen im Normalfall unverändert
 * aus `ruecksendungenAuflisten`, und ihnen darüber hinaus eine Form
 * vorzuschreiben wäre geraten.
 */
function pruefeProtokollnummer(wert: string | number): string {
  if (typeof wert === 'number') {
    if (!Number.isSafeInteger(wert) || wert < 0) {
      throw new EldaError(
        `empfangen: protokollnummer ist '${String(wert)}'. Laut Spec (3.5) ist sie vom Typ Long — ` +
          'erlaubt ist eine nicht-negative Ganzzahl oder ein nicht-leerer String.',
      );
    }
    return String(wert);
  }
  const text = typeof wert === 'string' ? wert.trim() : '';
  if (text === '') {
    throw new EldaError(
      `empfangen: protokollnummer ist ${typeof wert === 'string' ? 'leer' : `'${String(wert)}'`}. ` +
        'Ohne Protokollnummer ginge ein sinnloser Request auf die Leitung, den ELDA mit 406 ' +
        '("nicht vorhanden") beantwortet — ununterscheidbar von einer echten Fehladressierung.',
    );
  }
  return text;
}

/**
 * Prüft, ob `wert` wohlgeformtes Base64 ist (ohne Whitespace, Länge durch 4
 * teilbar, nur das Alphabet aus RFC 4648 plus höchstens zwei `=` am Ende).
 *
 * `Buffer.from(wert, 'base64')` überspringt ungültige Zeichen stillschweigend
 * und akzeptiert abgeschnittene Eingaben ohne Fehler. Eine unterwegs
 * verstümmelte Rücksendung käme damit als erfolgreiche Abholung mit falschen
 * Bytes an — und `empfangen` ist einmalig, ein zweiter Blick darauf gibt es
 * nicht. Konkreter Fall aus der Spec selbst: SoapUI stellt eine
 * Attachment-Referenz als `<payload>cid:1526066113758</payload>` dar
 * (Abschnitt 7.4.1.2); `c`, `i` und `d` sind gültige Base64-Zeichen, der Rest
 * würde übersprungen und das Ergebnis als geglückte Abholung gemeldet.
 */
function istWohlgeformtesBase64(wert: string): boolean {
  return wert.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(wert);
}

/** Was einem Protokollfehler aus `empfangen` als `ergebnis` mitgegeben wird. */
interface EmpfangenTeilErgebnis {
  statusCode?: string;
  ok?: boolean;
  meldung?: string;
  datei?: Partial<EldaDatei>;
  /** Der `<payload>` im Rohzustand — gesetzt, wenn er nicht sauber dekodierbar war. */
  rohPayload?: string;
}

/**
 * Liest eine `<datei>` vollständig aus: Metadaten und dekodierten, gegen `md5`
 * geprüften Inhalt.
 *
 * Die Metadaten werden VOR dem Payload gelesen, denn sie hängen an jedem der
 * Protokollfehler unten mit: ELDA hat die einmalige Zustellung zu diesem
 * Zeitpunkt bereits verbraucht, und diese Felder sind alles, was von der Antwort
 * sonst übrig bliebe. Ausschließlich aus der geparsten Antwort, nie aus
 * Konfiguration oder Request.
 *
 * `statusCode` ist bewusst optional: Fehlt er in der Antwort, wird trotzdem
 * zuerst die Datei gelesen, damit der Aufrufer sie über den Fehler noch bekommt.
 */
function leseDatei(datei: XmlNode, statusCode: string | undefined, meldung: string | undefined): EldaDatei {
  const metadaten: Pick<EldaDatei, 'id' | 'name' | 'md5' | 'dateiTyp'> = {};
  const id = feldText(datei, 'id');
  if (id) metadaten.id = id;
  const name = feldText(datei, 'name');
  if (name) metadaten.name = name;
  const md5 = feldText(datei, 'md5');
  if (md5) metadaten.md5 = md5;
  const dateiTyp = feldText(datei, 'dateiTyp');
  if (dateiTyp) metadaten.dateiTyp = dateiTyp;

  const teilErgebnis = (zusatz: { inhalt?: Buffer; rohPayload?: string } = {}): EmpfangenTeilErgebnis => {
    const t: EmpfangenTeilErgebnis = {};
    if (statusCode !== undefined) {
      t.statusCode = statusCode;
      t.ok = istOk(statusCode);
    }
    if (meldung) t.meldung = meldung;
    const d: Partial<EldaDatei> = { ...metadaten };
    if (zusatz.inhalt) d.inhalt = zusatz.inhalt;
    if (Object.keys(d).length > 0) t.datei = d;
    if (zusatz.rohPayload !== undefined) t.rohPayload = zusatz.rohPayload;
    return t;
  };

  const payloadNode = firstChild(datei, 'payload');
  if (payloadNode?.children.some((c) => c.name === 'Include')) {
    throw new EldaProtocolError(
      'Payload ist MTOM/XOP-referenziert (<xop:Include>), dieser Client erwartet inline Base64. ' +
        'MTOM wird von diesem Client derzeit nicht unterstützt.',
      teilErgebnis(),
    );
  }

  const rohPayload = payloadNode?.text ?? '';
  // Base64 darf laut RFC 2045 umgebrochen sein, und ELDA darf pretty-printed
  // antworten — deshalb JEDER Whitespace raus, nicht nur der an den Rändern.
  const kompakt = rohPayload.replace(/\s+/g, '');
  const statusIstOk = statusCode !== undefined && istOk(statusCode);

  if (kompakt === '') {
    if (statusIstOk) {
      throw new EldaProtocolError(
        'Antwort meldet statusCode 000 mit einer <datei>, aber der Payload ist leer ' +
          '(weder Base64 noch MTOM/XOP-Referenz) — die Datei wäre sonst stillschweigend verloren.',
        teilErgebnis(),
      );
    }
    return { inhalt: Buffer.alloc(0), ...metadaten };
  }

  if (!istWohlgeformtesBase64(kompakt)) {
    throw new EldaProtocolError(
      'Der <payload> der Rücksendung ist kein wohlgeformtes Base64. Node würde ungültige Zeichen ' +
        'stillschweigend überspringen und abgeschnittene Eingaben klaglos annehmen — das Ergebnis ' +
        'wären falsche Bytes, gemeldet als geglückte Abholung. Der rohe Payload hängt am Fehler ' +
        '(siehe `ergebnis.rohPayload`).',
      teilErgebnis({ rohPayload }),
    );
  }

  const inhalt = Buffer.from(kompakt, 'base64');

  if (metadaten.md5) {
    let berechnet: string;
    try {
      berechnet = createHash('md5').update(inhalt).digest('hex');
    } catch (err) {
      throw new EldaProtocolError(
        'Die von ELDA mitgelieferte MD5-Prüfsumme lässt sich in dieser Node-Umgebung nicht ' +
          'berechnen (z. B. FIPS-Modus). Ungeprüft wird der Inhalt nicht als Erfolg gemeldet; ' +
          'er hängt vollständig am Fehler (siehe `ergebnis.datei.inhalt`).',
        teilErgebnis({ inhalt, rohPayload }),
        { cause: err },
      );
    }
    if (berechnet.toLowerCase() !== metadaten.md5.toLowerCase()) {
      throw new EldaProtocolError(
        `MD5-Abweichung: ELDA meldet '${metadaten.md5}', der dekodierte Payload ergibt '${berechnet}'. ` +
          'Der Inhalt ist unterwegs verändert oder abgeschnitten worden und wird nicht als geglückte ' +
          'Abholung gemeldet. Er hängt unverändert am Fehler (siehe `ergebnis.datei.inhalt` und ' +
          '`ergebnis.rohPayload`) — ein zweiter Aufruf von empfangen wäre kein verlässlicher Weg an ihn.',
        teilErgebnis({ inhalt, rohPayload }),
      );
    }
  }

  return { inhalt, ...metadaten };
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
   *
   * `wiederholbar: false` schaltet die Wiederholung für eine Methode ganz ab.
   * Das gilt für `empfangen` und ist der Grund, warum diese Unterscheidung
   * überhaupt existiert — siehe {@link EldaTransferRoh.empfangen}: Der Aufruf
   * ist einmalig und unwiderruflich, und aus einem `FonTransportError` ist NICHT
   * ableitbar, ob die Anfrage den Server je erreicht hat. `callSoap` faltet
   * jeden Fehlschlag — DNS, verweigerte Verbindung, TLS, Verbindungsabbruch
   * mitten im Body, Zeitüberschreitung — in genau diese eine Fehlerklasse mit
   * einem Meldungstext; und das Zeitlimit umfasst dort auch den Body-Download
   * (`await res.text()` läuft unter demselben `AbortController`). Gerade der
   * gefährliche Fall — ELDA hat die Zustellung verbucht und liefert gerade aus —
   * ist damit von einem folgenlosen Verbindungsfehler nicht zu trennen. Eine
   * Heuristik über `err.cause.code` wäre geraten und durch jeden Proxy hinweg
   * ohnehin falsch. Bleibt: nicht wiederholen.
   */
  async function ruf(methode: string, felder: EldaFeld[], wiederholbar = true): Promise<XmlNode> {
    const maxWiederholungen = wiederholbar ? retries : 0;
    for (let versuch = 0; ; versuch++) {
      const body = baueEldaEnvelope(methode, baueSecurity(config), felder);
      try {
        return await callSoap({ endpoint, soapAction: methode, body }, { ...transport, retries: 0 });
      } catch (err) {
        if (versuch >= maxWiederholungen || !(err instanceof FonTransportError)) throw err;
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
      const nummer = pruefeProtokollnummer(protokollnummer);
      // `wiederholbar: false` — siehe `ruf` und EldaTransferRoh.empfangen: ein
      // automatischer zweiter Versuch könnte die eigene, bereits verbrauchte
      // Zustellung als fremdes `408` zurückmelden.
      const root = await ruf('empfangen', [{ name: 'protokollnummer', value: nummer }], false);
      const resp = holeReturn(root, 'empfangen');

      // Status-Code hier nur LESEN, noch nicht werfen: Liegt eine <datei> bei, hat ELDA die
      // einmalige Zustellung bereits verbraucht. Ein Wurf vor dem Lesen der Datei würde die
      // einzige Kopie des Verarbeitungsprotokolls wegwerfen — genau das, was `errors.ts` für
      // die übrigen Fälle ausdrücklich zusichert.
      const sr = findDescendant(resp, 'serviceResult');
      const statusCode = sr ? feldText(sr, 'statusCode') : undefined;
      const meldung = sr ? feldText(sr, 'messages') : undefined;

      const dateiNode = findDescendant(resp, 'datei');
      const datei = dateiNode ? leseDatei(dateiNode, statusCode, meldung) : undefined;

      if (statusCode === undefined) {
        const ergebnis: EmpfangenTeilErgebnis = {};
        if (meldung) ergebnis.meldung = meldung;
        if (datei) ergebnis.datei = datei;
        throw new EldaProtocolError(
          "Antwort auf 'empfangen' enthält kein auswertbares <serviceResult><statusCode>. " +
            'Ohne Status-Code lässt sich Erfolg nicht von Fehlschlag unterscheiden.' +
            (datei
              ? ' ELDA hat dennoch eine <datei> ausgeliefert; sie hängt vollständig am Fehler ' +
                '(siehe `ergebnis.datei`), denn ein zweiter Aufruf von empfangen wäre KEIN ' +
                'verlässlicher Weg, sie zu holen.'
              : ''),
          ergebnis,
        );
      }

      const erg: EmpfangenErgebnis = { statusCode, ok: istOk(statusCode) };
      if (datei) erg.datei = datei;
      if (meldung) erg.meldung = meldung;
      return erg;
    },
  };
}
