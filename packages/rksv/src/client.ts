import {
  callSoap,
  sessionErrorFor,
  RKDB_ENDPOINT,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';
import { buildRkdbEnvelope, buildStatusEnvelope } from './request';
import { parseRkdbErgebnisse, type Ergebnis, type StatusErgebnis } from './antwort';
import { type Vorgang } from './vorgaenge';
import { rcIsTechnical } from './returncodes';

export interface RksvConfig {
  session: Session;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  transport?: TransportOptions;
}

export type Quittung =
  | { verarbeitung: 'synchron'; ergebnisse: Ergebnis[] }
  | { verarbeitung: 'asynchron'; hinweis: string };

export interface Rksv {
  uebermittlePaket(args: {
    paketNr: number;
    vorgaenge: Vorgang[];
    erzwingeAsynchron?: boolean;
  }): Promise<Quittung>;
  statusKasse(args: { paketNr: number; kassenidentifikationsnummer: string }): Promise<StatusErgebnis | undefined>;
  statusSee(args: { paketNr: number; zertifikatsseriennummer: string }): Promise<StatusErgebnis | undefined>;
  _config: RksvConfig;
}

function throwIfTechnical(ergebnisse: Ergebnis[]): void {
  for (const e of ergebnisse) {
    if (rcIsTechnical(e.rc)) {
      throw sessionErrorFor(Number.parseInt(e.rc, 10), e.msg);
    }
  }
}

async function ruf(config: RksvConfig, body: string): Promise<Ergebnis[]> {
  const root = await callSoap({ endpoint: RKDB_ENDPOINT, soapAction: 'rkdb', body }, config.transport);
  const ergebnisse = parseRkdbErgebnisse(root);
  throwIfTechnical(ergebnisse);
  return ergebnisse;
}

export function createRksv(config: RksvConfig): Rksv {
  const s = config.session;

  return {
    _config: config,

    async uebermittlePaket({ paketNr, vorgaenge, erzwingeAsynchron }): Promise<Quittung> {
      const body = buildRkdbEnvelope({
        tid: s.tid,
        benid: s.benid,
        id: s.id,
        uebermittlung: config.uebermittlung,
        fastnr: config.fastnr,
        paketNr,
        tsErstellung: new Date(),
        erzwingeAsynchron,
        vorgaenge,
      });
      const istAsync = vorgaenge.length > 1 || erzwingeAsynchron === true;
      const ergebnisse = await ruf(config, body);
      if (istAsync) {
        return {
          verarbeitung: 'asynchron',
          hinweis: 'Paket asynchron übernommen; das Ergebnisprotokoll liegt in der DataBox.',
        };
      }
      return { verarbeitung: 'synchron', ergebnisse };
    },

    async statusKasse({ paketNr, kassenidentifikationsnummer }): Promise<StatusErgebnis | undefined> {
      const body = buildStatusEnvelope({
        tid: s.tid,
        benid: s.benid,
        id: s.id,
        uebermittlung: config.uebermittlung,
        fastnr: config.fastnr,
        paketNr,
        tsErstellung: new Date(),
        ziel: { art: 'status_kasse', kassenidentifikationsnummer },
      });
      const ergebnisse = await ruf(config, body);
      return ergebnisse[0]?.status;
    },

    async statusSee({ paketNr, zertifikatsseriennummer }): Promise<StatusErgebnis | undefined> {
      const body = buildStatusEnvelope({
        tid: s.tid,
        benid: s.benid,
        id: s.id,
        uebermittlung: config.uebermittlung,
        fastnr: config.fastnr,
        paketNr,
        tsErstellung: new Date(),
        ziel: { art: 'status_se', zertifikatsseriennummer },
      });
      const ergebnisse = await ruf(config, body);
      return ergebnisse[0]?.status;
    },
  };
}
