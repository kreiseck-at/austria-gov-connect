import { FonError, type Session, type TransportOptions } from '@kreiseck/finanzonline-core';
import { createDatabox } from '../databox';
import { createFileUpload } from '../fileupload';
import { paketNrAusFilebez, parseU30Protokoll, type U30Protokoll } from './protokoll';
import type { U30Paket } from './typen';
import { baueU30Xml } from './xml';

/** Ergebnis von {@link U30Client.sende}. */
export interface U30Sendeergebnis {
  paketNr: number;
  uebermittlung: 'T' | 'P';
  /**
   * `rc === 0`: FinanzOnline hat das Paket **zur Prüfung übernommen**. Eingebracht
   * ist die UVA erst, wenn das Übermittlungsprotokoll das bestätigt
   * ({@link U30Client.protokolle}).
   */
  angenommen: boolean;
  /** Returncode des FileUpload-Webservice: 0 ok · −2 Wartung · −3 technischer Fehler · −4 Parser · −5 keine Berechtigung. */
  rc: number;
  msg?: string;
  /** Genau das gesendete XML, zum Aufbewahren. */
  xml: string;
}

/** Ein U30-Übermittlungsprotokoll aus der DataBox. */
export interface U30ProtokollEintrag {
  applkey: string;
  tsZust: string;
  filebez: string;
  paketNr?: number;
  /** Roh-XML zum Aufbewahren (Testprotokolle löscht FinanzOnline 31 Tage nach Zustellung). */
  xml: string;
  protokoll: U30Protokoll;
}

export interface U30Client {
  /**
   * Prüft, baut und übermittelt ein Paket. **Standard ist der Testmodus `T`**;
   * echt (`P`) nur mit `echt: true`. Jeder andere Wert für `echt` wirft vor dem
   * Netz. Bei Prüffehlern wirft `U30PruefError` — es wird nichts gesendet.
   * Es gibt nie eine automatische Wiederholung (sonst drohte eine verdeckte
   * Doppelübermittlung). rc −1 wirft `FonSessionExpiredError`, SOAP-Faults
   * `FonSoapFaultError`, Netzfehler `FonTransportError`.
   */
  sende(paket: U30Paket, optionen?: { echt?: boolean; jetzt?: Date }): Promise<U30Sendeergebnis>;
  /**
   * Holt die U30-Übermittlungsprotokolle (DataBox `erltyp=P`, Dateiname
   * `Webservice_U30_…`) im Zustellfenster und wertet sie aus; mit `paketNr`
   * nur das passende. **Öffnen markiert die Einträge in der DataBox als
   * gelesen.** Wartet nicht: Das Protokoll kommt nach Sekunden bis Minuten;
   * wann abgeholt wird, entscheidet der Aufrufer. Fenster: höchstens 31 Tage
   * zurück, höchstens 7 Tage Spanne.
   */
  protokolle(args: { von: Date; bis: Date; paketNr?: number }): Promise<U30ProtokollEintrag[]>;
}

/** Client für die Umsatzsteuervoranmeldung (U30) über eine bestehende {@link Session}. */
export function createU30(session: Session, optionen?: { transport?: TransportOptions }): U30Client {
  const transport = optionen?.transport;

  async function sende(paket: U30Paket, o?: { echt?: boolean; jetzt?: Date }): Promise<U30Sendeergebnis> {
    const echt: unknown = o?.echt;
    if (echt !== undefined && echt !== true && echt !== false) {
      throw new FonError(`echt muss true oder false sein, nicht ${JSON.stringify(echt)}`);
    }
    const xml = baueU30Xml(paket, { jetzt: o?.jetzt }); // prüft und wirft U30PruefError, vor dem Netz

    const fileUpload = createFileUpload(session, {
      uebermittlung: echt === true ? 'echt' : 'test',
      transport: { ...transport, retries: 0 },
    });
    const { rc, msg } = await fileUpload.upload({ art: 'U30', data: xml });
    const ergebnis: U30Sendeergebnis = {
      paketNr: paket.paketNr,
      uebermittlung: echt === true ? 'P' : 'T',
      angenommen: rc === 0,
      rc,
      xml,
    };
    if (msg !== undefined) ergebnis.msg = msg;
    return ergebnis;
  }

  async function protokolle(args: {
    von: Date;
    bis: Date;
    paketNr?: number;
  }): Promise<U30ProtokollEintrag[]> {
    const box = createDatabox(session, transport ? { transport } : undefined);
    const eintraege = (await box.liste({ erltyp: 'P', von: args.von, bis: args.bis })).filter((e) => {
      if (e.fileart !== 'XML' || !e.filebez.startsWith('Webservice_U30_')) return false;
      return args.paketNr === undefined || paketNrAusFilebez(e.filebez) === args.paketNr;
    });
    const out: U30ProtokollEintrag[] = [];
    for (const e of eintraege) {
      const { inhalt } = await box.eintrag(e.applkey, 'XML');
      const xml = inhalt.toString('utf8');
      const eintrag: U30ProtokollEintrag = {
        applkey: e.applkey,
        tsZust: e.tsZust,
        filebez: e.filebez,
        xml,
        protokoll: parseU30Protokoll(xml),
      };
      const nr = paketNrAusFilebez(e.filebez);
      if (nr !== undefined) eintrag.paketNr = nr;
      out.push(eintrag);
    }
    return out;
  }

  return { sende, protokolle };
}
