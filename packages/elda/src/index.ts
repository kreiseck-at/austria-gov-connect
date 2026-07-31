export { createEldaTransfer, type EldaTransfer, type Gesendet, type Empfangen } from './transfer';
export {
  createEldaTransferRoh,
  type EldaTransferRoh,
  type EldaDatei,
  type SendenErgebnis,
  type AuflistenErgebnis,
  type EmpfangenErgebnis,
} from './transfer-roh';
export { type EldaConfig } from './konfiguration';
export { hashKundenpasswort, type KundenpasswortQuelle } from './security';
export { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
export { ELDA_STATUS } from './status';
export { findeRuecksendung, type Ruecksendung } from './zuordnung';
export { EldaError, EldaProtocolError, EldaStatusError } from './errors';
/**
 * Die Fehlerklassen der Transportschicht, weitergereicht aus
 * `@kreiseck/finanzonline-core`. Sie erben NICHT von `EldaError` und fallen
 * deshalb bei einer Fallunterscheidung, die nur `EldaError` kennt, in den
 * Sammelzweig — mit dem Ergebnis, dass ein Protokollfehler als „nicht
 * erreichbar" erscheint. Damit ein Aufrufer sie sauber trennen kann, ohne in
 * eine transitive Abhängigkeit zu greifen, stehen sie hier:
 *
 * - `FonTransportError` — die Anfrage kam nicht durch (DNS, TLS, Zeitlimit).
 *   Das ist der einzige Fall, der „nicht erreichbar" wirklich bedeutet.
 * - `FonProtocolError` — es kam eine Antwort, sie war aber nicht auswertbar.
 *   Trägt den rohen Körper in `rohantwort`.
 * - `FonSoapFaultError` — die Gegenstelle meldet einen SOAP-Fault.
 */
export {
  FonTransportError,
  FonProtocolError,
  FonSoapFaultError,
} from '@kreiseck/finanzonline-core';
export {
  anmeldung,
  abmeldung,
  aenderungsmeldung,
  richtigstellungAnmeldung,
  richtigstellungAbmeldung,
  stornoAnmeldung,
  stornoAbmeldung,
  erstelleBestand,
  wochenarbeitszeit,
  type MeldungsFelder,
} from './versichertenmeldung';
export { PFLICHT_E29, SATZART_TEXT, ALTERNATIVGRUPPEN, type Satzart, type Pflichtstufe } from './pflicht-e29';
export type { BestandOptionen, Hersteller, RohSatz } from './bestand';
