'use strict';

// Gezielte Abweichungen von einer gültigen Anfrage – für die Negativtests.
//
// Das Paket baut immer eine korrekte Anfrage (frische Nonce, aktuelles created,
// leere SOAPAction). Um zu sehen, wie ELDA auf Abweichungen reagiert, wird die
// fertige Anfrage im `fetch` umgeformt, statt einen zweiten Umschlag-Bau zu
// pflegen. Jede Umformung ist eine reine Funktion
// `({ body, headers }) → { body, headers }` und lässt ihre Eingabe unverändert.

function escapeXml(wert) {
  return String(wert).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function muster(name) {
  return new RegExp(`<${name}>[\\s\\S]*?</${name}>`);
}

function ersetzeErstes(body, name, neu) {
  if (!muster(name).test(body)) {
    throw new Error(
      `Element <${name}> kommt in der Anfrage nicht vor – Manipulation passt nicht zur Methode.`,
    );
  }
  return body.replace(muster(name), neu);
}

const setzeElement = (name, wert) => (anfrage) => ({
  ...anfrage,
  body: ersetzeErstes(anfrage.body, name, `<${name}>${escapeXml(wert)}</${name}>`),
});

const leereElement = (name) => (anfrage) => ({
  ...anfrage,
  body: ersetzeErstes(anfrage.body, name, `<${name}></${name}>`),
});

const entferneElement = (name) => (anfrage) => ({
  ...anfrage,
  body: ersetzeErstes(anfrage.body, name, ''),
});

const setzeHeader = (name, wert) => (anfrage) => ({
  ...anfrage,
  headers: { ...anfrage.headers, [name]: wert },
});

const kette =
  (...manipulationen) =>
  (anfrage) =>
    manipulationen.reduce((a, m) => m(a), anfrage);

/** Inhalt des ersten Elements (roh, wie er im Body steht) oder `undefined`. */
function elementWert(body, name) {
  const treffer = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body);
  return treffer ? treffer[1] : undefined;
}

module.exports = { setzeElement, leereElement, entferneElement, setzeHeader, kette, elementWert };
