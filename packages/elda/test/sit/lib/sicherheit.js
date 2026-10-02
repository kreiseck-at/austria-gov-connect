'use strict';

// Sicherheitsgrenzen des SIT-Werkzeugs.
//
// Das Werkzeug darf ausschließlich die SIT-Plattform erreichen. Die Produktion
// trifft echte Kunden, der Kundentest kommt später mit eigenem
// Vertraulichkeitsmodus. Deshalb gibt es hier genau eine erlaubte Adresse, und
// `pruefeZiel` sitzt zusätzlich im `fetch` selbst: Selbst eine falsch gesetzte
// Umgebung oder ein manipulierter Endpoint kommt nicht über die Leitung.

const ERLAUBTE_ENDPOINTS = Object.freeze({
  sit: 'https://online-itu5test.elda.at/eldaws/transfer/v4/TransferService',
});

function endpointFuer(umgebung) {
  if (typeof umgebung !== 'string' || !Object.hasOwn(ERLAUBTE_ENDPOINTS, umgebung)) {
    throw new Error(`Umgebung '${umgebung}' ist im SIT-Werkzeug nicht erlaubt – nur 'sit'.`);
  }
  return ERLAUBTE_ENDPOINTS[umgebung];
}

function pruefeZiel(url) {
  const ziel = String(url);
  if (!Object.values(ERLAUBTE_ENDPOINTS).includes(ziel)) {
    throw new Error(`Ziel ${ziel} ist nicht erlaubt – das SIT-Werkzeug spricht nur mit der SIT-Plattform.`);
  }
}

/**
 * Der SIT lässt nur freigeschaltete Quell-Adressen zu und weist alles andere auf
 * Netzwerkebene ab. Ein Lauf von der falschen Leitung erzeugt nur Fehlbefunde.
 */
function pruefeQuellIp(ist, soll) {
  if (!soll) throw new Error('ELDA_SIT_QUELL_IP ist nicht gesetzt – erwartete Quell-Adresse fehlt.');
  if (!ist) throw new Error('Die eigene Quell-Adresse ließ sich nicht ermitteln – ohne sie kein Lauf.');
  if (ist !== soll) {
    throw new Error(`Quell-Adresse ${ist} statt ${soll} – läuft ein VPN oder ein Mobilfunk-Hotspot?`);
  }
}

module.exports = { ERLAUBTE_ENDPOINTS, endpointFuer, pruefeZiel, pruefeQuellIp };
