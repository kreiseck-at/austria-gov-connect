import { createEldaTransferRoh, type EldaDatei, type EldaTransferRoh } from './transfer-roh';
import type { EldaConfig } from './konfiguration';
import {
  AUFLISTEN_ZUSTAENDE,
  EMPFANGEN_ZUSTAENDE,
  SENDEN_ZUSTAENDE,
  zustandOderWurf,
} from './klassifikation';
import { EldaProtocolError } from './errors';
import type { Ruecksendung } from './zuordnung';

/**
 * Ergebnis von {@link EldaTransfer.senden}. Die Methode kehrt nur zurück, wenn
 * die Datei bei ELDA liegt — ein `ok`-Feld gibt es deshalb nicht.
 */
export interface Gesendet {
  /**
   * `'angenommen'` (Status 000), `'nochInArbeit'` (404 — angenommen, die
   * Verarbeitung dauert über 40 Sekunden) oder `'duplikat'` (405 — die Datei lag
   * ELDA bereits vor). Keiner der drei Fälle ist ein Fehler.
   */
  zustand: 'angenommen' | 'nochInArbeit' | 'duplikat';
  /**
   * Von ELDA vergebene Protokollnummer — der Schlüssel, mit dem später das
   * Verarbeitungsprotokoll abgeholt wird. Bei `'duplikat'` die der
   * Originalsendung, sofern ELDA sie im Feld mitliefert.
   */
  protokollnummer?: string;
  /** Interne ELDA-Datei-ID der übermittelten Sendung. */
  dateiId?: string;
  /** Zeitstempel (ISO-8601 mit Offset), zu dem ELDA die Datei angenommen hat. */
  eldaZeitstempel?: string;
  /** Klartext-Meldung von ELDA; bei `'duplikat'` nennt sie die Protokollnummer des Originals. */
  meldung?: string;
  /** Der Status-Code, der zu diesem Ergebnis geführt hat. */
  statusCode: string;
}

/** Felder, die alle Varianten von {@link Empfangen} gemeinsam tragen. */
interface EmpfangenBasis {
  /** Der Status-Code, der zu diesem Ergebnis geführt hat. */
  statusCode: string;
  /** Klartext-Meldung von ELDA, sofern vorhanden. */
  meldung?: string;
}

/** Ergebnis von {@link EldaTransfer.empfangen}. Über `zustand` verengbar. */
export type Empfangen =
  | (EmpfangenBasis & {
      /** Die Rücksendung liegt vor (Status 000) — `datei` enthält den Inhalt. */
      zustand: 'datei';
      /** Die abgeholte Rücksendungsdatei. */
      datei: EldaDatei;
    })
  | (EmpfangenBasis & {
      /** Keine Rücksendung mit dieser Protokollnummer bekannt (Status 406). */
      zustand: 'nichtVorhanden';
    })
  | (EmpfangenBasis & {
      /**
       * Die Rücksendung wurde bereits abgeholt und ist damit nicht mehr abrufbar
       * (Status 408).
       *
       * Laut FAQ 8.2 der Schnittstellenbeschreibung ist das typischerweise die
       * Folge gleichzeitiger Aufrufe mehrerer Clients derselben Seriennummer.
       * Trat unmittelbar davor ein `FonTransportError` auf, ist die zweite
       * Lesart genauso möglich: Der eigene vorige Aufruf hat die Zustellung
       * verbraucht und die Bytes gingen beim Transport verloren. Dieses Paket
       * wiederholt `empfangen` deshalb nie von sich aus.
       */
      zustand: 'bereitsEmpfangen';
    });

/**
 * ELDA-Transfer-Client. Fachliche Status-Codes, die ein Aufrufer sinnvoll
 * behandeln kann, kommen als `zustand` zurück; alle übrigen werfen einen
 * `EldaStatusError`, der Code, Meldung und das vollständige rohe Ergebnis
 * mitführt.
 */
export interface EldaTransfer {
  /**
   * Überträgt eine Datei (= eine Meldung) an ELDA. `inhalt` wird base64-kodiert.
   *
   * Rückkehr heißt: ELDA hat die Datei. Es heißt NICHT, dass sie fachlich in
   * Ordnung ist — die inhaltliche Rückmeldung kommt asynchron als Rücksendung
   * über {@link ruecksendungenAuflisten} und {@link empfangen}.
   */
  senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<Gesendet>;
  /**
   * Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle). Ein leeres
   * Array heißt eindeutig „keine offen" — ein Zugangs- oder Serverfehler hätte
   * geworfen.
   */
  ruecksendungenAuflisten(): Promise<Ruecksendung[]>;
  /**
   * Holt EINE Rücksendung per Protokollnummer. **Einmalig und unwiderruflich** —
   * danach ist sie bei ELDA nicht mehr abrufbar. Den Inhalt dauerhaft sichern,
   * bevor weitergearbeitet wird.
   *
   * `transport.retries` gilt für diese Methode **nicht**; ein `FonTransportError`
   * von hier heißt nicht „nichts passiert". Begründung und Umgang: siehe
   * `EldaTransferRoh.empfangen`.
   */
  empfangen(protokollnummer: string | number): Promise<Empfangen>;
  /**
   * Die rohe Variante: gibt Ergebnisobjekte mit `ok`/`statusCode`/`meldung`
   * zurück und wirft bei fachlichen Status-Codes nie. Für Aufrufer, die jede
   * Entscheidung selbst treffen wollen. Nutzt denselben Transport und dieselbe
   * Konfiguration.
   */
  readonly roh: EldaTransferRoh;
}

/**
 * Baut den ELDA-Transfer-Client. Zustandslos außer der übergebenen
 * Konfiguration; die Konfiguration wird beim Bauen geprüft.
 */
export function createEldaTransfer(config: EldaConfig): EldaTransfer {
  const roh = createEldaTransferRoh(config);

  return {
    roh,

    async senden(args): Promise<Gesendet> {
      const erg = await roh.senden(args);
      const gesendet: Gesendet = {
        zustand: zustandOderWurf(SENDEN_ZUSTAENDE, erg),
        statusCode: erg.statusCode,
      };
      if (erg.protokollnummer !== undefined) gesendet.protokollnummer = erg.protokollnummer;
      if (erg.dateiId !== undefined) gesendet.dateiId = erg.dateiId;
      if (erg.eldaZeitstempel !== undefined) gesendet.eldaZeitstempel = erg.eldaZeitstempel;
      if (erg.meldung !== undefined) gesendet.meldung = erg.meldung;
      return gesendet;
    },

    async ruecksendungenAuflisten(): Promise<Ruecksendung[]> {
      const erg = await roh.ruecksendungenAuflisten();
      zustandOderWurf(AUFLISTEN_ZUSTAENDE, erg);
      return erg.ruecksendungen;
    },

    async empfangen(protokollnummer): Promise<Empfangen> {
      const erg = await roh.empfangen(protokollnummer);
      const zustand = zustandOderWurf(EMPFANGEN_ZUSTAENDE, erg);
      const meldungZusatz = erg.meldung !== undefined ? ` ELDA-Meldung: ${erg.meldung}` : '';
      if (zustand === 'datei') {
        if (!erg.datei) {
          throw new EldaProtocolError(
            `Antwort auf 'empfangen' meldet statusCode ${erg.statusCode}, enthält aber keine <datei>. ` +
              'Die Rücksendung gilt bei ELDA damit als abgeholt, ohne dass Inhalt vorliegt — ' +
              'das wird nicht als leeres Ergebnis durchgereicht.' +
              meldungZusatz,
            erg,
          );
        }
        const treffer: Empfangen = { zustand, datei: erg.datei, statusCode: erg.statusCode };
        if (erg.meldung !== undefined) treffer.meldung = erg.meldung;
        return treffer;
      }
      if (erg.datei) {
        // ELDA hat die <datei> in genau diesem Aufruf bereits ausgeliefert — sie liegt in `erg`
        // vor. Ein zweiter `empfangen`-Aufruf ist KEIN verlässlicher Weg, sie erneut zu holen:
        // `empfangen` ist einmalig, die Rücksendung gilt damit bereits als abgeholt. Deshalb wird
        // der Inhalt nicht kommentarlos verworfen, sondern am Fehler mitgeführt (`ergebnis.datei`).
        throw new EldaProtocolError(
          `Antwort auf 'empfangen' meldet statusCode ${erg.statusCode} ('${zustand}'), enthält aber dennoch ` +
            'eine <datei> — dieser Status sieht keinen Dateiinhalt vor. Der bereits ausgelieferte Inhalt ' +
            'wird nicht verworfen, sondern hängt am Fehler (siehe `ergebnis.datei`): ein erneuter Aufruf ' +
            'von empfangen wäre KEIN verlässlicher Weg, ihn zu holen, weil die Rücksendung damit bereits ' +
            'als abgeholt gilt.' +
            meldungZusatz,
          erg,
        );
      }
      const ohneDatei: Empfangen = { zustand, statusCode: erg.statusCode };
      if (erg.meldung !== undefined) ohneDatei.meldung = erg.meldung;
      return ohneDatei;
    },
  };
}
