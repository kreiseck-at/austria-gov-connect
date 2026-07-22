import {
  callSoap,
  sessionErrorFor,
  RKDB_ENDPOINT,
  type Session,
  type TransportOptions,
} from '@kreiseck/finanzonline-core';
import { buildRkdbEnvelope, buildStatusEnvelope } from './request';
import { parseRkdbAntwort, type Ergebnis, type RkdbAntwort } from './antwort';
import { RksvError, type ArtSe, type Vorgang } from './vorgaenge';
import { rcIsTechnical } from './returncodes';
import { makeKasse } from './kasse';
import { makeSee } from './see';
import { makeBeleg } from './beleg';

/** Konfiguration für {@link createRksv}: Session, Übermittlungsart (`test`/`echt`), optional `fastnr` und Transport-Overrides. */
export interface RksvConfig {
  session: Session;
  uebermittlung: 'test' | 'echt';
  fastnr?: string;
  transport?: TransportOptions;
}

/** Antwort auf {@link Rksv.uebermittlePaket}: bei genau einem Vorgang synchron mit Ergebnis, sonst asynchron nur mit Hinweis. */
export type Quittung =
  { verarbeitung: 'synchron'; ergebnisse: Ergebnis[] } | { verarbeitung: 'asynchron'; hinweis: string };

/** Öffentliche API des rkdb-Clients: Paketübermittlung sowie bequeme Einzelvorgang-Hüllen je Vorgangsart. */
export interface Rksv {
  /** Sendet ein Paket Vorgänge. Genau ein Vorgang (und nicht erzwungen asynchron) läuft synchron; sonst landet das Ergebnis in der DataBox. */
  uebermittlePaket(args: {
    paketNr: number;
    vorgaenge: Vorgang[];
    erzwingeAsynchron?: boolean;
  }): Promise<Quittung>;
  /** Registrierkasse: registrieren, Ausfall melden, Wiederinbetriebnahme melden, außer Betrieb nehmen. Fachliche rc werfen nicht, stecken in `Ergebnis`. */
  kasse: {
    registriere(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      benutzerschluessel: string;
      anmerkung?: string;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
    meldeAusfall(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      begruendung: 1 | 5 | 99;
      beginn: Date;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
    meldeWiederinbetriebnahme(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      ende: Date;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
    nimmAusserBetrieb(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      begruendung: 6 | 7;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
  };
  /** Signatur-/Siegelerstellungseinheit (SEE): dieselben vier Vorgänge wie `kasse`, adressiert über `zertifikatsseriennummer`. */
  see: {
    registriere(args: {
      paketNr: number;
      artSe: ArtSe;
      vdaId: string;
      zertifikatsseriennummer?: string;
      zertifikat?: string;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
    meldeAusfall(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      begruendung: 1 | 2 | 99;
      beginn: Date;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
    meldeWiederinbetriebnahme(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      ende: Date;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
    nimmAusserBetrieb(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      begruendung: 6 | 7;
      kundeninfo?: string;
    }): Promise<Ergebnis>;
  };
  /** Belegprüfung: liefert das volle `Ergebnis` (rc `0` = alle Teilprüfungen PASS, `43` = mind. ein FAIL; Baum in `belegpruefung`). */
  beleg: {
    pruefe(args: { paketNr: number; beleg: string; kundeninfo?: string }): Promise<Ergebnis>;
  };
  /** Statusabfrage (synchron, kein Vorgang): liefert den aktuellen Betriebsstatus von Kasse bzw. SEE. */
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

/** Baut den rkdb-Client aus einer bestehenden {@link Session}. Zustandslos außer der übergebenen Konfiguration. */
export function createRksv(config: RksvConfig): Rksv {
  const s = config.session;

  async function uebermittlePaket({
    paketNr,
    vorgaenge,
    erzwingeAsynchron,
  }: {
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
    // Synchron vs. asynchron ist request-bestimmt (BMF-Handbuch, an realen
    // Antworten 2026-07-22 verifiziert): genau ein Element -> synchron mit
    // echtem Ergebnis; mehr als eines ODER erzwinge_asynchron -> asynchron, die
    // Einzelergebnisse landen in der DataBox. Die SOAP-Antwort ist bei async nur
    // eine Empfangsbestätigung (ein `result` mit rc 0) — KEIN Einzelergebnis;
    // sie darf nicht als synchrones Ergebnis missdeutet werden.
    const istAsync = vorgaenge.length > 1 || erzwingeAsynchron === true;
    const { ergebnisse, info } = await ruf(config, body);
    if (istAsync) {
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
