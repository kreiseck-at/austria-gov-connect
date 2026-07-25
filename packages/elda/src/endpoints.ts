/** ELDA-Betriebsumgebung. */
export type EldaUmgebung = 'produktion' | 'kundentest' | 'sit';

/** Transfer-Webservice-v4-Endpoints je Umgebung (alle Methoden gehen dorthin). */
export const ELDA_ENDPOINTS: Record<EldaUmgebung, string> = {
  produktion: 'https://online.elda.at/eldaws/transfer/v4/TransferService',
  kundentest: 'https://online-test.elda.at/eldaws/transfer/v4/TransferService',
  sit: 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService',
};

/** SOAP-Namespace des Transfer-Webservice v4. */
export const ELDA_NAMESPACE = 'http://v4.transfer.ws.elda.at/';
