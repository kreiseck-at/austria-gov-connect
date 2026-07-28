import type { TransportOptions } from '@kreiseck/finanzonline-core';
import { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
import { EldaError } from './errors';
import type { SecurityQuelle } from './security';

/** Gemeinsame Felder jeder Konfiguration. */
interface EldaBasisConfig extends SecurityQuelle {
  /**
   * Transport-Feineinstellungen (Timeout, Retries, `fetch`-Implementierung) —
   * siehe `TransportOptions` aus `@kreiseck/finanzonline-core`.
   *
   * `retries` ist die Anzahl ZUSÄTZLICHER Versuche nach einem Transportfehler
   * (Standard `0`). Dieser Client wiederholt selbst und baut dabei für jeden
   * Versuch frische `securityParameters` (neuer `nonce`, neues `created`): ELDA
   * lehnt einen wiederholten `nonce` mit `552` ab und ein `created` älter als
   * 60 Sekunden mit `551`. Wiederholt wird ausschließlich bei Transportfehlern.
   * Ein ungültiger Wert (`NaN`, negativ, gebrochen, `Infinity`) gilt als `0`.
   */
  transport?: TransportOptions;
}

/**
 * Konfiguration des ELDA-Clients. Entweder `umgebung` oder `endpoint` muss
 * gesetzt sein — `umgebung` hat bewusst KEINEN Default: ein vergessenes Feld
 * darf keine echten Meldungen in den Echtbetrieb schicken.
 */
export type EldaConfig = EldaBasisConfig &
  (
    | {
        /** Betriebsumgebung, bestimmt den Endpoint aus `ELDA_ENDPOINTS`. */
        umgebung: EldaUmgebung;
        /** Expliziter Endpoint-Override — hat Vorrang vor `umgebung`. */
        endpoint?: string;
      }
    | {
        umgebung?: EldaUmgebung;
        /** Expliziter Endpoint; ohne `umgebung` zulässig (Mock, Proxy). */
        endpoint: string;
      }
  );

const UMGEBUNGEN = Object.keys(ELDA_ENDPOINTS) as EldaUmgebung[];

function pflichtfeld(wert: unknown, name: string): string {
  if (typeof wert !== 'string' || wert.trim() === '') {
    throw new EldaError(
      `'${name}' fehlt oder ist leer. Die ELDA-Zugangsdaten müssen vollständig sein — ` +
        'ohne sie beantwortet ELDA jeden Aufruf mit Status 558.',
    );
  }
  return wert;
}

/**
 * Prüft die Konfiguration und liefert den Endpoint. Die Prüfung läuft zur
 * Laufzeit, weil Aufrufer aus reinem JavaScript keinen Compiler haben: ohne sie
 * würde ein Tippfehler in `umgebung` zu `undefined` als Endpoint und damit zu
 * einem kryptischen Netzwerkfehler führen.
 */
export function loeseEndpoint(config: EldaConfig): string {
  pflichtfeld(config.seriennummer, 'seriennummer');
  pflichtfeld(config.kundenpasswort, 'kundenpasswort');
  pflichtfeld(config.apiKey, 'apiKey');

  if (config.endpoint !== undefined) {
    return pflichtfeld(config.endpoint, 'endpoint');
  }

  const umgebung = config.umgebung;
  if (umgebung === undefined || !UMGEBUNGEN.includes(umgebung)) {
    throw new EldaError(
      `'umgebung' ist ${umgebung === undefined ? 'nicht gesetzt' : `'${String(umgebung)}'`}. ` +
        `Erlaubt sind ${UMGEBUNGEN.map((u) => `'${u}'`).join(', ')} — oder ein expliziter 'endpoint'.`,
    );
  }
  return ELDA_ENDPOINTS[umgebung];
}
