'use strict';

// `fetch` für das SIT-Werkzeug. Reihenfolge je Aufruf:
//
//   1. Ziel und Fenster prüfen – nur die SIT-Plattform, nur solange das Fenster
//      offen ist, für das der Lauf gestartet wurde; sonst geht nichts raus.
//      Weiterleitungen sind verboten: Ein 307/308 auf einen anderen Host würde
//      sonst denselben POST samt Zugangsdaten dorthin schicken.
//   2. Manipulation anwenden (Negativtests), sonst die Anfrage unverändert.
//   3. Anfrage geschwärzt in den Laufordner schreiben. Lässt sie sich nicht
//      schwärzen, wird sie auch nicht gesendet.
//   4. Senden, Antwort als Bytes lesen und geschwärzt mitschreiben – VOR dem
//      Parsen durch den Client, damit bei einem Absturz nichts verloren ist.
//      Eine inline (Base64) gelieferte Rücksendung wird darin vorher maskiert.
//   5. Die Antwort byte-gleich neu verpackt zurückgeben.

const { redigiereGeheimnisse } = require('../../../dist/redigieren.js');
const { pruefeZiel } = require('./sicherheit');
const { aktivesFenster } = require('./fenster');
const { maskierePayloads } = require('./maskierung');

/**
 * Jedes Geheimnis zusätzlich in der Form, in der seine UTF-8-Bytes nach einer
 * latin1-Dekodierung aussehen – so liest der Mitschnitt die Bytes. Für reines
 * ASCII sind beide Formen gleich.
 */
function mitBytesicht(geheimnisse) {
  const alle = { ...geheimnisse };
  for (const [name, wert] of Object.entries(geheimnisse)) {
    if (!wert) continue;
    const bytesicht = Buffer.from(String(wert), 'utf8').toString('latin1');
    if (bytesicht !== wert) alle[`${name}_bytes`] = bytesicht;
  }
  return alle;
}

function kopfzeilen(erste, headers) {
  return [erste, ...headers.map(([k, v]) => `${k}: ${v}`), '', ''].join('\n');
}

function erstelleSitFetch({
  ablage,
  lauf,
  geheimnisse,
  manipulation,
  fenster,
  jetzt = () => new Date(),
  echterFetch = fetch,
}) {
  if (!fenster) throw new Error('erstelleSitFetch braucht das Fenster, für das der Lauf gilt.');
  const schwarz = mitBytesicht(geheimnisse);
  let nr = 0;

  function schreibeGeschwaerzt(name, kopf, koerper) {
    // latin1 bildet jedes Byte umkehrbar auf ein Zeichen ab: MTOM-Antworten
    // bleiben byte-treu, auch wenn Teile binär sind.
    let roh = Buffer.concat([Buffer.from(kopf, 'latin1'), koerper]).toString('latin1');
    // Die Schwärzung sucht nach Wert und sähe die Seriennummer in Base64 nicht.
    if (geheimnisse.seriennummer) roh = maskierePayloads(roh, geheimnisse.seriennummer).text;
    ablage.schreibe(lauf.ordner, name, Buffer.from(redigiereGeheimnisse(roh, schwarz), 'latin1'));
  }

  return async function sitFetch(url, init = {}) {
    pruefeZiel(url);
    const offen = aktivesFenster(jetzt());
    if (offen !== fenster) {
      throw new Error(`Fenster ${fenster} ist zu (jetzt: ${offen ?? 'keines'}) – kein Aufruf mehr.`);
    }
    nr += 1;
    const nn = String(nr).padStart(2, '0');

    let anfrage = { body: String(init.body ?? ''), headers: { ...(init.headers ?? {}) } };
    if (manipulation) anfrage = manipulation(anfrage);
    const methode = /<v4:(\w+)/.exec(anfrage.body)?.[1] ?? 'unbekannt';

    // Der Payload ist der Bestand in Base64 – samt Seriennummer, an der die
    // wertbasierte Schwärzung vorbeiginge. Er liegt maskiert als bestand.dat daneben.
    const ohnePayload = anfrage.body.replace(
      /<payload>[\s\S]*?<\/payload>/,
      '<payload>***payload: maskierter Bestand in bestand.dat***</payload>',
    );
    schreibeGeschwaerzt(
      `${nn}-${methode}-anfrage.txt`,
      kopfzeilen(`POST ${url}`, Object.entries(anfrage.headers)),
      Buffer.from(ohnePayload, 'utf8'),
    );

    let res;
    try {
      res = await echterFetch(url, {
        ...init,
        body: anfrage.body,
        headers: anfrage.headers,
        redirect: 'error',
      });
    } catch (err) {
      ablage.protokolliere({
        art: 'netzfehler',
        lauf: lauf.id,
        nr,
        fehler: redigiereGeheimnisse(`${err.name}: ${err.message}`, schwarz),
      });
      throw err;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    try {
      schreibeGeschwaerzt(
        `${nn}-${methode}-antwort.txt`,
        kopfzeilen(`HTTP ${res.status} ${res.statusText}`, [...res.headers]),
        bytes,
      );
    } catch (err) {
      // Nicht werfen: Bei `empfangen` hinge an dieser Antwort die einzige Kopie
      // der Rücksendung. Weiterreichen, aber vermerken.
      ablage.protokolliere({
        art: 'hinweis',
        lauf: lauf.id,
        text: `Antwort-Mitschnitt fehlt: ${err.message}`,
      });
    }

    lauf.http = {
      status: res.status,
      contentType: res.headers.get('content-type'),
      wartung: res.status === 403 && /Wartung/.test(bytes.toString('latin1')),
    };

    const leer = res.status === 204 || res.status === 304;
    return new Response(leer ? null : bytes, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

module.exports = { erstelleSitFetch };
