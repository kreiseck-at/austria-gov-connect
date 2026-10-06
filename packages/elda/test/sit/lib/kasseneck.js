'use strict';

// Brücke zu kasseneck: Die mBGM-Fälle rechnen mit derselben Lohn- und
// mBGM-Logik wie das Produkt (Abrechnung → baueMeldung → Paketoptionen), damit
// die SIT das Produkt prüft und keinen Nachbau. Pfad über KASSENECK_PFAD: ein
// kasseneck-Checkout, in dem `functions-lohn` installiert ist. Ohne ihn bauen
// diese Fälle nicht; der Katalog markiert sie mit `braucht: 'kasseneck'`.

const path = require('node:path');

const verfuegbar = () => Boolean(process.env.KASSENECK_PFAD);

function kasseneck() {
  const wurzel = process.env.KASSENECK_PFAD;
  if (!wurzel) {
    throw new Error('KASSENECK_PFAD fehlt – die mBGM-Fälle rechnen mit der Lohnlogik von kasseneck.');
  }
  const lohn = path.join(wurzel, 'functions-lohn');
  return {
    ladeParameter: require(path.join(lohn, 'lohnparameter-core')).ladeParameter,
    erstelleAbrechnung: require(path.join(lohn, 'lohnabrechnung-core')).erstelleAbrechnung,
    mbgm: require(path.join(lohn, 'mbgm-core')),
  };
}

module.exports = { kasseneck, verfuegbar };
