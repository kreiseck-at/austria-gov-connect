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

// --- Versichertenmeldung über kasseneck (N6) -----------------------------------
//
// Der VR-Versand von kasseneck liegt (Stand 12.10.2026) auf dem Branch
// `feature/elda-versichertenmeldung`. KASSENECK_VR_PFAD zeigt auf einen eigenen,
// nur gelesenen Checkout dieses Branches mit installiertem `functions-lohn`.
// Genutzt werden ausschließlich die reinen Module (ohne Firebase):
//   versichertenmeldung-core.js  Felder aus Mitarbeiter, Betrieb, Endabrechnung; Satzbau
//   elda-rueckmeldung-core.js    Referenzwert KE-VR-…, Deutung, Mitteilung, Clearing-Fall

const vrVerfuegbar = () => Boolean(process.env.KASSENECK_VR_PFAD);

function kasseneckVr() {
  const wurzel = process.env.KASSENECK_VR_PFAD;
  if (!wurzel) {
    throw new Error('KASSENECK_VR_PFAD fehlt – die K-Fälle bauen die Versichertenmeldung mit kasseneck.');
  }
  const lohn = path.join(wurzel, 'functions-lohn');
  return {
    vr: require(path.join(lohn, 'versichertenmeldung-core')),
    rueck: require(path.join(lohn, 'elda-rueckmeldung-core')),
  };
}

// --- Lohnzettel L16 über kasseneck (L12) -----------------------------------------
//
// Der L16-Bau von kasseneck liegt (Stand 13.10.2026) auf dem Branch
// `feature/l16-elda`. KASSENECK_L16_PFAD zeigt auf einen nur gelesenen Checkout
// dieses Branches mit installiertem `functions-lohn` (dort hängt
// `@kreiseck/elda-l16`). Genutzt wird nur das reine Modul `l16-elda-core.js`.

const l16Verfuegbar = () => Boolean(process.env.KASSENECK_L16_PFAD);

function kasseneckL16() {
  const wurzel = process.env.KASSENECK_L16_PFAD;
  if (!wurzel) {
    throw new Error('KASSENECK_L16_PFAD fehlt – der Fall L12 baut den L16 mit kasseneck.');
  }
  return require(path.join(wurzel, 'functions-lohn', 'l16-elda-core'));
}

/** Grund, warum ein Fall ohne Brücke nicht bauen kann – oder null. */
function brueckeFehlt(fall) {
  if (fall.braucht === 'kasseneck' && !verfuegbar()) return 'KASSENECK_PFAD (kasseneck-Checkout mit functions-lohn)';
  if (fall.braucht === 'kasseneck-vr' && !vrVerfuegbar()) {
    return 'KASSENECK_VR_PFAD (Checkout von feature/elda-versichertenmeldung mit functions-lohn)';
  }
  if (fall.braucht === 'kasseneck-l16' && !l16Verfuegbar()) {
    return 'KASSENECK_L16_PFAD (Checkout von feature/l16-elda mit functions-lohn)';
  }
  return null;
}

module.exports = { kasseneck, verfuegbar, kasseneckVr, vrVerfuegbar, kasseneckL16, l16Verfuegbar, brueckeFehlt };
