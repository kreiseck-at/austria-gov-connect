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
export {
  artDerRuecksendung,
  liesMitteilung,
  MITTEILUNG_STATUS,
  liesClearing,
  ZUSTELLUNGSGRUND,
  DRINGLICHKEIT,
  MELDUNG_STATUS,
  MELDUNG_STATUS_ZUSATZ,
  MVB_CLEARING_VERSION,
  type RuecksendungsArt,
  type Mitteilung,
  type MitteilungMeldung,
  type MitteilungCode,
  type Dialogfall,
  type ClearingInhalt,
  type ClearingInformation,
  type Fachinformation,
} from './ruecksendung';
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
export { FonTransportError, FonProtocolError, FonSoapFaultError } from '@kreiseck/finanzonline-core';
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
export {
  BEST_VERSICHERTENMELDUNG,
  BEST_MBGM,
  VERSION_VERSICHERTENMELDUNG,
  VERSION_MBGM,
  UVST_ELDA,
  type BestandOptionen,
  type Hersteller,
  type RohSatz,
} from './bestand';

// --- Monatliche Beitragsgrundlagenmeldung (Kapitel E.32) -------------------
export {
  erstelleMbgmPaket,
  erstelleMbgmBestand,
  VERRECHNUNGSGRUNDLAGE,
  type Verfahren,
  type Verrechnungsgrundlage,
  type Beitragsgrundlagenmeldung,
  type Stornomeldung,
  type MbgmEintrag,
  type Beschaeftigungsfolge,
  type Tarifblock,
  type Verrechnungsbasis,
  type Verrechnungsposition,
  type PaketOptionen,
} from './mbgm';
export { VBTY_CODES, VPTY_CODES, KOMBINATION, EINS_ZU_EINS, type VbtyCode, type VptyCode } from './codes-e32';
export {
  PFLICHT_PAKET,
  PFLICHT_MBGM,
  PFLICHT_TARIFBLOCK,
  PFLICHT_VERRECHNUNGSBASIS,
  PFLICHT_VERRECHNUNGSPOSITION,
  ALTERNATIVGRUPPEN_E32,
  E32_SATZART_TEXT,
  type E32Satzart,
} from './pflicht-e32';
export {
  FELDER_PAKET,
  FELDER_MBGM,
  FELDER_TARIFBLOCK,
  FELDER_VERRECHNUNGSBASIS,
  FELDER_VERRECHNUNGSPOSITION,
} from './felder-e32';
export {
  pruefeMbgmPaket,
  pruefeBeitragskontonummer,
  HOECHSTANZAHL,
  BKNR_LAENGE,
  type Befund,
  type Schwere,
} from './pruefung-e32';
export { pruefeAbfolge, ABFOLGE } from './abfolge-e32';
export { berechneBeitragCent } from './beitrag-e32';

// --- VSNR-Anforderung (Kapitel E.30) und Adresse Versicherter (Kapitel E.31) --
export {
  vsnrAnforderung,
  erstelleVsnrAnforderungBestand,
  type VsnrAnforderungFelder,
} from './vsnr-anforderung';
export { adresseVersicherter, erstelleAdressmeldungBestand, type AdressmeldungFelder } from './adressmeldung';
export { PFLICHT_E30 } from './pflicht-e30';
export { PFLICHT_E31 } from './pflicht-e31';
export {
  BEST_VSNR_ANFORDERUNG,
  BEST_ADRESSE_VERSICHERTER,
  VERSION_VSNR_ANFORDERUNG,
  VERSION_ADRESSE_VERSICHERTER,
} from './bestand';
export { STAATEN, STAATEN_STAND, STAATSANGEHOERIGKEITEN, type Staat } from './staaten';

// --- Lohnzettel Finanz L16 (Kapitel E.13/E.14) ---------------------------------
export {
  erstelleLohnzettelBestand,
  lohnzettelSaetze,
  VSTR_LOHNZETTEL,
  type Lohnzettel,
  type LohnzettelArbeitgeber,
  type LohnzettelFelder,
  type LohnzettelUebermittlung,
  type LohnzettelBestandOptionen,
} from './lohnzettel';
export {
  FELDER_L1,
  SATZLAENGE_L1,
  LOHNZETTELVERSION,
  KINDERBLOECKE,
  KINDFELDER,
  VORZEICHEN_L1,
  BETRAEGE_OHNE_VORZEICHEN,
  kindfeld,
  type Lohnzettelversion,
  type Vorzeichenregel,
} from './felder-e14';
export { FELDER_I1, SATZLAENGE_I1 } from './felder-e13';
export { PFLICHT_I1, PFLICHT_L1, PFLICHT_KIND } from './pflicht-e14';
export {
  pruefeLohnzettel,
  jahressteuerNachRechenblatt2026,
  L16_GEPRUEFT,
  L16_NICHT_GEPRUEFT,
  type LohnzettelBefund,
} from './pruefung-e14';
export { L16_PRUEFKATALOG, L16_PRUEFKATALOG_QUELLE, type L16Regel } from './pruefkatalog-l16';
export { BEST_LOHNZETTEL_FINANZ } from './bestand';
