import {
  callSoap,
  sessionErrorFor,
  RKDB_ENDPOINT,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';
import { buildRkdbEnvelope, buildStatusEnvelope } from './request';
import { parseRkdbAntwort, type Ergebnis, type Pruefung, type RkdbAntwort } from './antwort';
import { RksvError, type ArtSe, type Vorgang } from './vorgaenge';
import { rcIsTechnical } from './returncodes';
import { makeKasse } from './kasse';
import { makeSee } from './see';
import { makeBeleg } from './beleg';

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
  kasse: {
    registriere(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      benutzerschluessel: string;
      anmerkung?: string;
    }): Promise<Ergebnis>;
    meldeAusfall(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      begruendung: 1 | 5 | 99;
      beginn: Date;
    }): Promise<Ergebnis>;
    meldeWiederinbetriebnahme(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      ende: Date;
    }): Promise<Ergebnis>;
    nimmAusserBetrieb(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      begruendung: 6 | 7;
    }): Promise<Ergebnis>;
  };
  see: {
    registriere(args: {
      paketNr: number;
      artSe: ArtSe;
      vdaId: string;
      zertifikatsseriennummer?: string;
      zertifikat?: string;
    }): Promise<Ergebnis>;
    meldeAusfall(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      begruendung: 1 | 2 | 99;
      beginn: Date;
    }): Promise<Ergebnis>;
    meldeWiederinbetriebnahme(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      ende: Date;
    }): Promise<Ergebnis>;
    nimmAusserBetrieb(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      begruendung: 6 | 7;
    }): Promise<Ergebnis>;
  };
  beleg: {
    pruefe(args: { paketNr: number; beleg: string }): Promise<Pruefung[]>;
  };
  status: {
    kasse(args: { paketNr: number; kassenidentifikationsnummer: string }): Promise<Ergebnis>;
    see(args: { paketNr: number; zertifikatsseriennummer: string }): Promise<Ergebnis>;
  };
}

function throwIfTechnical(ergebnisse: Ergebnis[]): void {
  for (const e of ergebnisse) {
    if (rcIsTechnical(e.rc)) {
      throw sessionErrorFor(Number.parseInt(e.rc, 10), e.msg);
    }
  }
}

async function ruf(config: RksvConfig, body: string): Promise<RkdbAntwort> {
  const root = await callSoap({ endpoint: RKDB_ENDPOINT, soapAction: 'rkdb', body }, config.transport);
  const antwort = parseRkdbAntwort(root);
  throwIfTechnical(antwort.ergebnisse);
  return antwort;
}

/** Signatur der internen Einzelvorgang-Hülle: sendet genau einen Vorgang und liefert dessen Ergebnis. */
export type Einzel = (paketNr: number, vorgang: Vorgang) => Promise<Ergebnis>;

export function createRksv(config: RksvConfig): Rksv {
  const s = config.session;

  async function uebermittlePaket({ paketNr, vorgaenge, erzwingeAsynchron }: {
    paketNr: number;
    vorgaenge: Vorgang[];
    erzwingeAsynchron?: boolean;
  }): Promise<Quittung> {
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
    // Synchron vs. asynchron aus der ANTWORT ableiten, nicht aus dem Request:
    // der FON-Dienst antwortet auch auf Mehrfach-Pakete synchron, wenn er die
    // Ergebnisse mitschickt. Nur wenn keine `result`-Einträge zurückkommen, ist
    // das Paket asynchron übernommen (Ergebnisprotokoll in der DataBox).
    const { ergebnisse, info } = await ruf(config, body);
    if (ergebnisse.length === 0) {
      return {
        verarbeitung: 'asynchron',
        hinweis: info ?? 'Paket asynchron übernommen; das Ergebnisprotokoll liegt in der DataBox.',
      };
    }
    return { verarbeitung: 'synchron', ergebnisse };
  }

  const einzel: Einzel = async (paketNr, vorgang) => {
    const q = await uebermittlePaket({ paketNr, vorgaenge: [vorgang] });
    if (q.verarbeitung !== 'synchron' || q.ergebnisse.length === 0) {
      throw new RksvError('Erwartetes synchrones Ergebnis blieb aus');
    }
    return q.ergebnisse[0]!;
  };

  return {
    uebermittlePaket,

    kasse: makeKasse(einzel),
    see: makeSee(einzel),
    beleg: makeBeleg(einzel),

    status: {
      async kasse({ paketNr, kassenidentifikationsnummer }): Promise<Ergebnis> {
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
        const erg = (await ruf(config, body)).ergebnisse[0];
        if (!erg) throw new RksvError('Statusabfrage ohne Ergebnis');
        return erg;
      },

      async see({ paketNr, zertifikatsseriennummer }): Promise<Ergebnis> {
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
        const erg = (await ruf(config, body)).ergebnisse[0];
        if (!erg) throw new RksvError('Statusabfrage ohne Ergebnis');
        return erg;
      },
    },
  };
}
