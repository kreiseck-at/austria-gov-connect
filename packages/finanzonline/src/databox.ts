import {
  buildEnvelope,
  callSoap,
  findDescendant,
  childText,
  FonProtocolError,
  FonRcError,
  sessionErrorFor,
  type XmlNode,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';

const DATABOX_ENDPOINT = 'https://finanzonline.bmf.gv.at/fon/ws/databox';
const DATABOX_NAMESPACE = 'https://finanzonline.bmf.gv.at/fon/ws/databox';

/** Ein Eintrag der DataBox-Liste (`databoxListEntry`); nur Metadaten, kein Dateiinhalt. */
export interface DataboxEintrag {
  stnr?: string;
  name: string;
  anbringen: string;
  zrvon: string;
  zrbis: string;
  datbesch: string;
  erltyp: string;
  fileart: 'XML' | 'PDF';
  tsZust: string;
  applkey: string;
  filebez: string;
  gelesen: boolean;
  betreff?: string;
}

export interface Databox {
  /**
   * Listet DataBox-Einträge (`getDatabox`). Ohne `erltyp` nur ungelesene; mit
   * `von`/`bis` das Zustellfenster (gelesen + ungelesen).
   *
   * `erltyp` = Art des DataBox-Inhalts laut BMF-Spec (viele sind rollengebunden):
   * `P` (Protokolle), `B` (Bescheide/Ergänzungsersuchen/Bescheinigungen),
   * `I` (Informationen), `M` (Mitteilungen), `EU` (EU-Erledigungen),
   * `FB` (Firmenbuchzustellungen), `GM` (Grundsteuermessbeträge),
   * `E` (Prüfungsergebnisse), `DL` (Dienstgeberbeitragslisten),
   * `KG` (Kommunalsteuergrundlagen), `SS` (Selbstberechnungserklärungen),
   * `QL` (Quotenlisten), `AE`/`AF`/`AK`/`AZ` (Amtshilfeersuchen, Notare).
   *
   * Zeitfenster-Regeln (sonst `FonRcError`): `von` max. 31 Tage zurück (`rc -5`),
   * Spanne `von`–`bis` max. 7 Tage (`rc -6`); ohne beide bei gesetztem Fenster
   * `rc -4`. `rc -1` (Session) wirft `FonSessionExpiredError`.
   */
  liste(args?: { erltyp?: string; von?: Date; bis?: Date }): Promise<DataboxEintrag[]>;
  /**
   * Ruft den Inhalt eines DataBox-Eintrags ab (`getDataboxEntry`).
   *
   * **Achtung:** Der Abruf markiert den Eintrag in der DataBox als gelesen.
   *
   * @param applkey Schlüssel des Eintrags aus {@link Databox.liste}.
   * @param fileart Dateiart des Eintrags (aus {@link Databox.liste}), da die Entry-Antwort selbst keine `fileart` liefert.
   */
  eintrag(applkey: string, fileart: 'XML' | 'PDF'): Promise<{ fileart: 'XML' | 'PDF'; inhalt: Buffer }>;
  /**
   * Holt die asynchronen rkdb-Ergebnisprotokolle (`erltyp=P`, `anbringen=RKDB`)
   * als XML-Strings ab — Bequemlichkeit über {@link Databox.liste} +
   * {@link Databox.eintrag}. **Markiert die abgeholten Protokolle als gelesen.**
   * Den XML-String parst der Aufrufer mit `parseErgebnisprotokoll` aus
   * `@kreiseck/rksv` und ordnet die Einzelergebnisse über `paketNr`/`kundeninfo`
   * seinen Einreichungen zu.
   */
  rkdbProtokolle(args?: {
    von?: Date;
    bis?: Date;
  }): Promise<Array<{ applkey: string; tsZust: string; xml: string }>>;
}

function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

function normalizeFileart(value: string | undefined): 'XML' | 'PDF' {
  // FON liefert fileart klein geschrieben (real verifiziert: <fileart>xml</fileart>),
  // daher case-insensitiv normalisieren — sonst würde 'pdf' fälschlich zu 'XML'.
  return value?.trim().toUpperCase() === 'PDF' ? 'PDF' : 'XML';
}

function toIsoDateTime(d: Date): string {
  return d.toISOString().slice(0, 19);
}

/**
 * Prüft eine DataBox-Antwort: fehlendes Element/`rc` → {@link FonProtocolError}; `rc` -1 (Session
 * abgelaufen) routet über {@link sessionErrorFor} zu {@link FonSessionExpiredError}.
 */
function pruefeRc(resp: XmlNode | undefined, op: string): asserts resp is XmlNode {
  if (!resp) throw new FonProtocolError(`Antwort enthält kein ${op}Response`);
  const rcText = childText(resp, 'rc');
  const rc = Number.parseInt(rcText ?? '', 10);
  if (rcText === undefined || Number.isNaN(rc)) {
    throw new FonProtocolError(`${op}Response ohne gültiges rc: "${rcText}"`);
  }
  if (rc === -1) throw sessionErrorFor(-1, childText(resp, 'msg'));
  if (rc !== 0) throw new FonRcError(rc, childText(resp, 'msg'), op);
}

function parseEintrag(result: XmlNode): DataboxEintrag {
  const eintrag: DataboxEintrag = {
    name: childText(result, 'name') ?? '',
    anbringen: childText(result, 'anbringen') ?? '',
    zrvon: childText(result, 'zrvon') ?? '',
    zrbis: childText(result, 'zrbis') ?? '',
    datbesch: childText(result, 'datbesch') ?? '',
    erltyp: childText(result, 'erltyp') ?? '',
    fileart: normalizeFileart(childText(result, 'fileart')),
    tsZust: childText(result, 'ts_zust') ?? '',
    applkey: childText(result, 'applkey') ?? '',
    filebez: childText(result, 'filebez') ?? '',
    gelesen: childText(result, 'status') === '1',
  };
  const stnr = childText(result, 'stnr');
  if (stnr) eintrag.stnr = stnr;
  const betreff = childText(result, 'betreff');
  if (betreff) eintrag.betreff = betreff;
  return eintrag;
}

/** Baut den DataBox-Client (`getDatabox`) aus einer bestehenden {@link Session}. Zustandslos außer der übergebenen Konfiguration. */
export function createDatabox(session: Session, opts?: { transport?: TransportOptions }): Databox {
  const transport = opts?.transport;

  async function liste(args?: { erltyp?: string; von?: Date; bis?: Date }): Promise<DataboxEintrag[]> {
    const fields = [
      { name: 'tid', value: session.tid },
      { name: 'benid', value: session.benid },
      { name: 'id', value: session.id },
      { name: 'erltyp', value: args?.erltyp ?? '' },
    ];
    if (args?.von) fields.push({ name: 'ts_zust_von', value: toIsoDateTime(args.von) });
    if (args?.bis) fields.push({ name: 'ts_zust_bis', value: toIsoDateTime(args.bis) });

    const body = buildEnvelope({
      namespace: DATABOX_NAMESPACE,
      bodyElement: 'getDataboxRequest',
      fields,
    });

    const root = await callSoap({ endpoint: DATABOX_ENDPOINT, soapAction: 'getDatabox', body }, transport);

    const resp = findDescendant(root, 'getDataboxResponse');
    pruefeRc(resp, 'getDatabox');

    return childrenNamed(resp, 'result').map(parseEintrag);
  }

  async function eintrag(
    applkey: string,
    fileart: 'XML' | 'PDF',
  ): Promise<{ fileart: 'XML' | 'PDF'; inhalt: Buffer }> {
    const fields = [
      { name: 'tid', value: session.tid },
      { name: 'benid', value: session.benid },
      { name: 'id', value: session.id },
      { name: 'applkey', value: applkey },
    ];

    const body = buildEnvelope({
      namespace: DATABOX_NAMESPACE,
      bodyElement: 'getDataboxEntryRequest',
      fields,
    });

    const root = await callSoap(
      { endpoint: DATABOX_ENDPOINT, soapAction: 'getDataboxEntry', body },
      transport,
    );

    const resp = findDescendant(root, 'getDataboxEntryResponse');
    pruefeRc(resp, 'getDataboxEntry');

    const inhalt = Buffer.from(childText(resp, 'result') ?? '', 'base64');
    return { fileart, inhalt };
  }

  async function rkdbProtokolle(args?: {
    von?: Date;
    bis?: Date;
  }): Promise<Array<{ applkey: string; tsZust: string; xml: string }>> {
    const eintraege = (await liste({ erltyp: 'P', von: args?.von, bis: args?.bis })).filter(
      (e) => e.anbringen === 'RKDB' && e.fileart === 'XML',
    );
    const out: Array<{ applkey: string; tsZust: string; xml: string }> = [];
    for (const e of eintraege) {
      const { inhalt } = await eintrag(e.applkey, 'XML');
      out.push({ applkey: e.applkey, tsZust: e.tsZust, xml: inhalt.toString('utf8') });
    }
    return out;
  }

  return { liste, eintrag, rkdbProtokolle };
}
