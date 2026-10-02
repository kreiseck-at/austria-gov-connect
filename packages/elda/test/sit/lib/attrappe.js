'use strict';

// Nur für Tests, per `node --require` vor sit.js geladen: ein nachgebauter SIT.
// Die Uhr steht auf ATTRAPPE_JETZT und läuft von dort weiter; Quell-IP und
// Dienst sind gefälscht – nichts geht ins Netz.
//
// Der Dienst prüft, dass die echte Seriennummer ankommt (SOAP und OBUS), und
// schickt sie in Meldung, Dateiname und Rücksendung zurück. So zeigt der Test,
// dass sie trotzdem in keiner Datei und keiner Ausgabe landet.

const EchtesDate = Date;
const versatz = EchtesDate.parse(process.env.ATTRAPPE_JETZT) - EchtesDate.now();
globalThis.Date = class extends EchtesDate {
  constructor(...args) {
    if (args.length === 0) super(EchtesDate.now() + versatz);
    else super(...args);
  }

  static now() {
    return EchtesDate.now() + versatz;
  }
};

const SIT = 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService';
const SN = process.env.ELDA_SIT_SERIENNUMMER;
const OBUS = SN.padStart(7, '0');
const GRENZE = 'uuid:attrappe';

/** Verpackt die Antwort so, wie ELDA (Apache CXF) es tut: immer multipart/related. */
function mtom(envelope, anhang) {
  const teile = [
    Buffer.from(
      `\r\n--${GRENZE}\r\n` +
        'Content-Type: application/xop+xml; charset=UTF-8; type="text/xml"\r\n' +
        'Content-Transfer-Encoding: binary\r\n' +
        'Content-ID: <root.message@cxf.apache.org>\r\n\r\n' +
        envelope,
      'utf8',
    ),
  ];
  if (anhang) {
    teile.push(
      Buffer.from(
        `\r\n--${GRENZE}\r\n` +
          'Content-Type: application/octet-stream\r\n' +
          'Content-Transfer-Encoding: binary\r\n' +
          'Content-ID: <datei@elda>\r\n\r\n',
        'latin1',
      ),
      anhang,
    );
  }
  teile.push(Buffer.from(`\r\n--${GRENZE}--\r\n`, 'latin1'));
  return new Response(Buffer.concat(teile), {
    status: 200,
    headers: {
      'content-type':
        `multipart/related; type="application/xop+xml"; boundary="${GRENZE}"; ` +
        'start="<root.message@cxf.apache.org>"; start-info="text/xml"',
    },
  });
}

const antwort = (methode, status, meldung, rest = '') =>
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
  `<ns2:${methode}Response xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
  `<serviceResult><messages>${meldung}</messages><statusCode>${status}</statusCode></serviceResult>` +
  `${rest}</return></ns2:${methode}Response></soap:Body></soap:Envelope>`;

const wert = (xml, name) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];

globalThis.fetch = async (url, init = {}) => {
  if (url === 'https://api.ipify.org') return new Response('192.0.2.10');
  if (url !== SIT) throw new Error(`NETZ IM TEST: ${url}`);
  const body = String(init.body);
  const methode = /<v4:(\w+)/.exec(body)[1];
  if (wert(body, 'seriennummer') !== SN) return mtom(antwort(methode, '558', 'Seriennummer falsch'));

  if (methode === 'senden') {
    const saetze = Buffer.from(wert(body, 'payload'), 'base64').toString('latin1').split('\r\n');
    if (!saetze.filter(Boolean).every((s) => s.slice(11, 18) === OBUS)) {
      return mtom(antwort(methode, '999', 'OBUS falsch'));
    }
    return mtom(
      antwort(methode, '000', `Bestand von ${SN} übernommen`, '<protokollnummer>18000001</protokollnummer>'),
    );
  }
  if (methode === 'ruecksendungenAuflisten') {
    const eintrag =
      `<ruecksendungen><dateiName>VR_${SN}_18000001.txt</dateiName>` +
      '<protokollnummer>18000002</protokollnummer></ruecksendungen>';
    return mtom(antwort(methode, '000', 'OK', eintrag));
  }
  if (methode === 'empfangen') {
    const datei =
      `<datei><id>7</id><name>VR_${SN}_18000001.txt</name><payload>` +
      '<xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:datei%40elda"/>' +
      '</payload></datei>';
    return mtom(antwort(methode, '000', 'OK', datei), Buffer.from(`Seriennummer ${SN}\r\nOBUS ${OBUS}\r\n`));
  }
  throw new Error(`Die Attrappe kennt ${methode} nicht.`);
};
